import { fetchAssets } from "./asset-discovery-wrapper";
import { buildCapturePackage } from "./package-builder";
import { sendCapturePackage, checkHealth } from "./transport";
import { buildVariables, render, setSelectorSender } from "@authclip/template-engine";

const DEFAULT_TEMPLATE = `# {{title}}

Источник: {{url}}
{% if author %}
Автор: {{author}}
{% endif %}
{% if published %}
Дата: {{published}}
{% endif %}

---

{{content}}`;

async function getTemplate(): Promise<string> {
	try {
		const result = await chrome.storage.sync.get("clipTemplate");
		return (result as { clipTemplate?: string }).clipTemplate || DEFAULT_TEMPLATE;
	} catch {
		return DEFAULT_TEMPLATE;
	}
}

interface ClipRequestMessage {
	type: "CLIP_PAGE";
	port: number;
	authToken?: string;
}

interface HealthCheckMessage {
	type: "HEALTH_CHECK";
	port: number;
	authToken?: string;
}

type IncomingMessage = ClipRequestMessage | HealthCheckMessage;

let highlighterModeState: { [tabId: number]: boolean } = {};

function getHighlighterModeForTab(tabId: number): boolean {
	return highlighterModeState[tabId] ?? false;
}

function isValidUrl(url: string | undefined): boolean {
	if (!url) return false;
	return url.startsWith("http://") || url.startsWith("https://");
}

async function ensureContentScript(tabId: number): Promise<void> {
	try {
		await chrome.tabs.sendMessage(tabId, { action: "ping" });
	} catch {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["content.js"],
		});
		for (let i = 0; i < 8; i++) {
			try {
				await chrome.tabs.sendMessage(tabId, { action: "ping" });
				return;
			} catch {
				await new Promise((r) => setTimeout(r, 50));
			}
		}
		throw new Error("Content script did not respond after injection");
	}
}

async function setHighlighterMode(tabId: number, activate: boolean): Promise<void> {
	try {
		const tab = await chrome.tabs.get(tabId);
		if (!tab?.url || !isValidUrl(tab.url)) return;

		await ensureContentScript(tabId);
		highlighterModeState[tabId] = activate;
		await chrome.tabs.sendMessage(tabId, { action: "setHighlighterMode", isActive: activate });
		updateContextMenu(tabId);
	} catch {
		highlighterModeState[tabId] = false;
		updateContextMenu(tabId);
	}
}

async function toggleHighlighterMode(tabId: number): Promise<void> {
	const newMode = !getHighlighterModeForTab(tabId);
	await setHighlighterMode(tabId, newMode);
}

async function updateContextMenu(tabId: number): Promise<void> {
	try {
		await chrome.contextMenus.removeAll();
		const isHighlighterMode = getHighlighterModeForTab(tabId);

		await chrome.contextMenus.create({
			id: "clip-page",
			title: "Clip to Obsidian",
			contexts: ["page", "selection"],
		});

		await chrome.contextMenus.create({
			id: isHighlighterMode ? "exit-highlighter" : "enter-highlighter",
			title: isHighlighterMode ? "Exit Highlighter" : "Enter Highlighter",
			contexts: ["page", "image", "video", "audio"],
		});

		if (isHighlighterMode) {
			await chrome.contextMenus.create({
				id: "highlight-selection",
				title: "Add to highlights",
				contexts: ["selection"],
			});
			await chrome.contextMenus.create({
				id: "highlight-element",
				title: "Add to highlights",
				contexts: ["image", "video", "audio"],
			});
		}
	} catch {}
}

chrome.tabs.onRemoved.addListener((tabId) => {
	delete highlighterModeState[tabId];
});

chrome.tabs.onActivated.addListener((activeInfo) => {
	updateContextMenu(activeInfo.tabId);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (!tab?.id) return;

	if (info.menuItemId === "clip-page") {
		const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (currentTab?.id) {
			chrome.runtime.sendMessage({ type: "CLIP_PAGE", port: 27124 });
		}
	} else if (info.menuItemId === "enter-highlighter") {
		await setHighlighterMode(tab.id, true);
	} else if (info.menuItemId === "exit-highlighter") {
		await setHighlighterMode(tab.id, false);
	} else if (info.menuItemId === "highlight-selection") {
		highlighterModeState[tab.id] = true;
		await ensureContentScript(tab.id);
		await chrome.tabs.sendMessage(tab.id, {
			action: "highlightSelection",
			isActive: true,
			highlightData: {
				id: Date.now().toString(),
				type: "text",
				content: info.selectionText || "",
			},
		});
		updateContextMenu(tab.id);
	} else if (info.menuItemId === "highlight-element") {
		highlighterModeState[tab.id] = true;
		await ensureContentScript(tab.id);
		await chrome.tabs.sendMessage(tab.id, {
			action: "highlightElement",
			isActive: true,
			targetElementInfo: {
				mediaType: info.mediaType === "image" ? "img" : info.mediaType,
				srcUrl: info.srcUrl,
				pageUrl: info.pageUrl,
			},
		});
		updateContextMenu(tab.id);
	}
});

chrome.commands?.onCommand?.addListener(async (command) => {
	if (command === "toggle_highlighter") {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id) {
			await ensureContentScript(tab.id);
			await toggleHighlighterMode(tab.id);
		}
	}
});

chrome.runtime.onMessage.addListener(
	(
		message: any,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: unknown) => void
	) => {
		if (message.type === "CLIP_PAGE") {
			handleClipPage(message, sendResponse);
			return true;
		}

		if (message.type === "HEALTH_CHECK") {
			handleHealthCheck(message, sendResponse);
			return true;
		}

		if (message.action === "highlighterModeChanged" && sender.tab?.id !== undefined) {
			highlighterModeState[sender.tab.id] = message.isActive;
			updateContextMenu(sender.tab.id);
			sendResponse({ success: true });
			return false;
		}

		if (message.action === "getHighlighterMode" && sender.tab?.id !== undefined) {
			sendResponse({ isActive: getHighlighterModeForTab(sender.tab.id) });
			return false;
		}

		return false;
	}
);

chrome.runtime.onInstalled.addListener(() => {
	chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
		if (tab?.id) updateContextMenu(tab.id);
	});
});

async function handleClipPage(
	msg: ClipRequestMessage,
	sendResponse: (response: unknown) => void
): Promise<void> {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab?.id) {
			sendResponse({ success: false, error: "No active tab" });
			return;
		}

		await ensureContentScript(tab.id);

		const tabId = tab.id;

		setSelectorSender(async (targetTabId: number, message: any) => {
			return chrome.tabs.sendMessage(targetTabId, message);
		});

		const pageData = await chrome.tabs.sendMessage(tabId, {
			action: "getPageContent",
		});

		if (!pageData || pageData.success === false) {
			sendResponse({
				success: false,
				error: pageData?.error || "Failed to extract page content",
			});
			return;
		}

		const {
			title,
			url,
			markdown,
			selectedHtml,
			fullHtml,
			imageUrls,
			meta,
			metaTags,
			schemaOrgData,
			highlights,
		} = pageData as {
			title: string;
			url: string;
			markdown: string;
			selectedHtml?: string;
			fullHtml?: string;
			imageUrls: string[];
			meta: {
				author?: string;
				description?: string;
				published?: string;
				siteName?: string;
				domain?: string;
				favicon?: string;
				image?: string;
				language?: string;
				wordCount?: number;
			};
			metaTags?: { name?: string | null; property?: string | null; content: string | null }[];
			schemaOrgData?: any;
			highlights?: any[];
		};

		const variables = buildVariables({
			title,
			author: meta.author || "",
			content: markdown,
			contentHtml: selectedHtml || fullHtml || "",
			url,
			fullHtml: fullHtml || "",
			description: meta.description || "",
			favicon: meta.favicon || "",
			image: meta.image || "",
			published: meta.published || "",
			site: meta.siteName || "",
			language: meta.language || "",
			wordCount: meta.wordCount || 0,
			selection: "",
			selectionHtml: selectedHtml || "",
			highlights: highlights?.length ? JSON.stringify(highlights) : "",
			schemaOrgData: schemaOrgData || null,
			metaTags: metaTags || [],
		});

		const template = await getTemplate();

		const renderResult = await render(template, {
			variables,
			currentUrl: url,
			tabId,
			asyncResolver: async (name: string, ctx: any) => {
				if (name.startsWith("selector:") || name.startsWith("selectorHtml:")) {
					const extractHtml = name.startsWith("selectorHtml:");
					const prefix = extractHtml ? "selectorHtml:" : "selector:";
					const selectorPart = name.slice(prefix.length);
					const attrMatch = selectorPart.match(/^(.+?)\?(.+)$/);
					const selector = attrMatch ? attrMatch[1] : selectorPart;
					const attribute = attrMatch ? attrMatch[2] : undefined;
					try {
						console.log("[AuthClip] Resolving selector:", selector, "extractHtml:", extractHtml);
						const response = await chrome.tabs.sendMessage(ctx.tabId, {
							action: "extractContent",
							selector: selector.replace(/\\"/g, '"'),
							attribute,
							extractHtml,
						});
						const content = response?.content ?? "";
						console.log("[AuthClip] Selector resolved, content length:", typeof content === "string" ? content.length : JSON.stringify(content).length);
						return content;
					} catch (e) {
						console.error("[AuthClip] Selector resolution failed:", e);
						return "";
					}
				}
				return undefined;
			},
		});

		console.log("[AuthClip] Template compiled, output length:", renderResult.output.length, "errors:", renderResult.errors.length, "deferred:", renderResult.hasDeferredVariables);
		if (renderResult.errors.length > 0) {
			console.error("[AuthClip] Render errors:", renderResult.errors);
		}

		const compiledMarkdown = renderResult.output;

		const allImageUrls = [...new Set([...imageUrls, ...extractImageUrls(compiledMarkdown)])];

		const assets = allImageUrls.map((imgUrl: string, i: number) => ({
			id: `asset_${i + 1}`,
			url: imgUrl,
			source: "img-src" as const,
			selected: true,
		}));

		const { attachments, failures } = await fetchAssets(assets, {
			maxBytes: 25 * 1024 * 1024,
		});

		const pkg = buildCapturePackage({
			source: { url, title },
			markdown: compiledMarkdown,
			attachments,
			meta: {
				author: meta.author,
				description: meta.description,
				published: meta.published,
				siteName: meta.siteName,
				domain: meta.domain,
				favicon: meta.favicon,
				image: meta.image,
				language: meta.language,
				wordCount: meta.wordCount,
			},
			selectedHtml,
		});

		const report = await sendCapturePackage(pkg, {
			port: msg.port,
			authToken: msg.authToken,
		});

		sendResponse({
			success: report.status !== "failed",
			status: report.status,
			notePath: report.notePath,
			savedCount: report.attachments.filter((a) => a.status === "saved").length,
			failedCount: report.attachments.filter((a) => a.status === "failed").length,
			fetchFailures: failures.length,
			errors: report.errors,
		});
	} catch (err) {
		sendResponse({
			success: false,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

function extractImageUrls(markdown: string): string[] {
	const urls: string[] = [];
	const imgRegex = /!\[.*?\]\(([^)]+)\)/g;
	let match: RegExpExecArray | null;
	while ((match = imgRegex.exec(markdown)) !== null) {
		const src = match[1];
		if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
			urls.push(src);
		}
	}
	return urls;
}

async function handleHealthCheck(
	msg: HealthCheckMessage,
	sendResponse: (response: unknown) => void
): Promise<void> {
	try {
		const healthy = await checkHealth({
			port: msg.port,
			authToken: msg.authToken,
		});
		sendResponse({ healthy });
	} catch {
		sendResponse({ healthy: false });
	}
}
