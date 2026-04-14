import Defuddle from "defuddle";
import { createMarkdownContent } from "defuddle/full";
import * as highlighter from "./highlighter";

declare global {
	interface Window {
		authclipGeneration?: number;
	}
}

let highlighterCssLoaded = false;

function ensureHighlighterCss(): Promise<void> {
	if (highlighterCssLoaded) return Promise.resolve();
	return new Promise((resolve) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = chrome.runtime.getURL("highlighter.css");
		link.onload = () => {
			highlighterCssLoaded = true;
			resolve();
		};
		link.onerror = () => resolve();
		(document.head || document.documentElement).appendChild(link);
	});
}

window.authclipGeneration = (window.authclipGeneration ?? 0) + 1;
const myGeneration = window.authclipGeneration;

function flattenShadowDom(doc: Document): Promise<void> {
	return new Promise((resolve) => {
		if (typeof chrome === "undefined" || !chrome.scripting) {
			doc.querySelectorAll("*").forEach((el) => {
				if ((el as any).shadowRoot && (el as any).shadowRoot.innerHTML) {
					el.setAttribute("data-defuddle-shadow", (el as any).shadowRoot.innerHTML);
				}
			});
			resolve();
			return;
		}
		const script = doc.createElement("script");
		script.src = chrome.runtime.getURL("flatten-shadow-dom.js");
		script.onload = () => {
			script.remove();
			resolve();
		};
		script.onerror = () => resolve();
		(doc.head || doc.documentElement).appendChild(script);
	});
}

function resolveRelativeUrls(doc: Document): void {
	doc.querySelectorAll("[src], [href]").forEach((element) => {
		(["src", "href", "srcset"] as const).forEach((attr) => {
			const value = element.getAttribute(attr);
			if (!value) return;

			if (attr === "srcset") {
				const newSrcset = value
					.split(",")
					.map((src) => {
						const [url, size] = src.trim().split(" ");
						try {
							const absoluteUrl = new URL(url, doc.baseURI).href;
							return `${absoluteUrl}${size ? " " + size : ""}`;
						} catch {
							return src;
						}
					})
					.join(", ");
				element.setAttribute(attr, newSrcset);
			} else if (
				!value.startsWith("http") &&
				!value.startsWith("data:") &&
				!value.startsWith("#") &&
				!value.startsWith("//")
			) {
				try {
					const absoluteUrl = new URL(value, doc.baseURI).href;
					element.setAttribute(attr, absoluteUrl);
				} catch {}
			}
		});
	});
}

function collectImageUrls(article: Element, baseUrl: string): string[] {
	const urls: string[] = [];
	const seen = new Set<string>();

	article.querySelectorAll("img[src]").forEach((img) => {
		const src = img.getAttribute("src")?.trim();
		if (src && !seen.has(src)) {
			seen.add(src);
			try {
				urls.push(new URL(src, baseUrl).href);
			} catch {}
		}
	});

	article.querySelectorAll("img[srcset], picture source[srcset]").forEach((el) => {
		const srcset = el.getAttribute("srcset") || "";
		srcset.split(",").forEach((entry) => {
			const parts = entry.trim().split(/\s+/);
			if (parts[0]) {
				try {
					const resolved = new URL(parts[0], baseUrl).href;
					if (!seen.has(resolved)) {
						seen.add(resolved);
						urls.push(resolved);
					}
				} catch {}
			}
		});
	});

	return urls;
}

highlighter.loadHighlights();

chrome.runtime.onMessage.addListener((request: any, _sender, sendResponse) => {
	if (window.authclipGeneration !== myGeneration) return;

	if (request.action === "ping") {
		sendResponse({});
		return true;
	}

	if (request.action === "getPageContent") {
		const flattenTimeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
		Promise.race([flattenShadowDom(document), flattenTimeout]).then(async () => {
			try {
				let selectedHtml = "";
				const selection = window.getSelection();
				if (selection && selection.rangeCount > 0) {
					const range = selection.getRangeAt(0);
					const clonedSelection = range.cloneContents();
					const div = document.createElement("div");
					div.appendChild(clonedSelection);
					selectedHtml = div.innerHTML;
				}

				const defuddle = new Defuddle(document, { url: document.URL });
				const parseTimeout = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("parseAsync timeout")), 8000)
				);
				const defuddled = await Promise.race([defuddle.parseAsync(), parseTimeout]).catch(
					() => defuddle.parse()
				);

				const parser = new DOMParser();
				const doc = parser.parseFromString(
					document.documentElement.outerHTML,
					"text/html"
				);
				doc.querySelectorAll("script, style").forEach((el) => el.remove());
				doc.querySelectorAll("*").forEach((el) => el.removeAttribute("style"));
				resolveRelativeUrls(doc);

				const article =
					doc.querySelector("article") ??
					doc.querySelector('[role="main"]') ??
					doc.querySelector("main") ??
					doc.body;
				const cleanedHtml = article.innerHTML;
				const imageUrls = collectImageUrls(article, document.URL);

				let content = defuddled.content;
				if (selectedHtml) {
					content = selectedHtml;
				}

				const hlHighlights = highlighter.getHighlights();
				const markdown = createMarkdownContent(content, document.URL);

				const response = {
					title: (defuddled as any).title || document.title || "Untitled",
					url: document.URL,
					markdown,
					fullHtml: cleanedHtml,
					selectedHtml,
					imageUrls,
					highlights: hlHighlights,
					meta: {
						author: (defuddled as any).author || "",
						description: (defuddled as any).description || "",
						published: (defuddled as any).published || "",
						siteName: (defuddled as any).site || "",
						domain: new URL(document.URL).hostname,
						favicon: (defuddled as any).favicon || "",
						image: (defuddled as any).image || "",
						language: (defuddled as any).language || "",
						wordCount: (defuddled as any).wordCount || 0,
					},
					schemaOrgData: (defuddled as any).schemaOrgData || null,
					metaTags:
						(defuddled as any).metaTags?.map(
							(t: { name?: string | null; property?: string | null; content: string | null }) => ({
								name: t.name || null,
								property: t.property || null,
								content: t.content,
							})
						) || [],
				};
				sendResponse(response);
			} catch (error: unknown) {
				sendResponse({
					success: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		});
		return true;
	}

	if (request.action === "setHighlighterMode") {
		ensureHighlighterCss().then(() => {
			highlighter.toggleHighlighterMenu(request.isActive);
			sendResponse({ success: true });
		});
		return true;
	}

	if (request.action === "paintHighlights") {
		ensureHighlighterCss().then(() => highlighter.loadHighlights()).then(() => {
			highlighter.applyHighlights();
			sendResponse({ success: true });
		});
		return true;
	}

	if (request.action === "clearHighlights") {
		highlighter.clearHighlights();
		sendResponse({ success: true });
		return true;
	}

	if (request.action === "highlightSelection") {
		ensureHighlighterCss();
		highlighter.toggleHighlighterMenu(true);
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) {
			highlighter.handleTextSelection(sel);
		}
		sendResponse({ success: true });
		return true;
	}

	if (request.action === "highlightElement") {
		ensureHighlighterCss();
		highlighter.toggleHighlighterMenu(true);
		if (request.targetElementInfo) {
			const { mediaType, srcUrl } = request.targetElementInfo;
			let elementToHighlight: Element | null = document.querySelector(`${mediaType}[src="${srcUrl}"]`);
			if (!elementToHighlight) {
				const elements = Array.from(document.getElementsByTagName(mediaType));
				for (const el of elements) {
					if ((el as HTMLImageElement).src === srcUrl) {
						elementToHighlight = el;
						break;
					}
				}
			}
			if (elementToHighlight) {
				highlighter.highlightElement(elementToHighlight);
			}
		}
		sendResponse({ success: true });
		return true;
	}

	if (request.action === "getHighlighterState") {
		const hasHighlights = highlighter.getHighlights().length > 0;
		sendResponse({ hasHighlights });
		return true;
	}

	if (request.action === "extractContent") {
		const { selector, attribute, extractHtml } = request as {
			selector: string;
			attribute?: string;
			extractHtml?: boolean;
		};
		try {
			const elements = document.querySelectorAll(selector);
			if (elements.length === 0) {
				sendResponse({ content: "" });
				return true;
			}
			if (elements.length === 1) {
				const el = elements[0];
				if (attribute) {
					sendResponse({ content: el.getAttribute(attribute) || "" });
				} else if (extractHtml) {
					sendResponse({ content: el.innerHTML });
				} else {
					sendResponse({ content: el.textContent || "" });
				}
				return true;
			}
			const items: string[] = [];
			elements.forEach((el) => {
				if (attribute) {
					items.push(el.getAttribute(attribute) || "");
				} else if (extractHtml) {
					items.push(el.innerHTML);
				} else {
					items.push(el.textContent || "");
				}
			});
			sendResponse({ content: items });
		} catch {
			sendResponse({ content: "" });
		}
		return true;
	}

	return false;
});
