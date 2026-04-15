const SKIP_TAGS = new Set([
	"script", "style", "svg", "path", "defs", "linearGradient", "stop",
	"button", "input", "textarea", "select", "form", "noscript", "iframe",
	"app-cmf-icon", "app-cmf-gravatar", "app-cmf-obj-like-groups",
	"app-cmf-doodle-icon", "mat-menu", "app-cmf-gravatar",
	"object", "embed", "portal", "slot", "template",
]);

const INLINE_TAGS = new Set([
	"span", "a", "strong", "b", "em", "i", "u", "s", "del", "strike",
	"code", "mark", "small", "sub", "sup", "abbr", "time", "var", "kbd",
	"samp", "bdo", "bdi", "data", "wbr", "br", "img",
	"cite", "dfn", "q", "label", "ruby", "rt", "rp", "bdi", "bdo",
]);

const NAMED_ENTITIES: Record<string, string> = {
	"nbsp": "\u00A0",
	"amp": "&",
	"lt": "<",
	"gt": ">",
	"quot": '"',
	"apos": "'",
	"copy": "\u00A9",
	"reg": "\u00AE",
	"trade": "\u2122",
	"mdash": "\u2014",
	"ndash": "\u2013",
	"laquo": "\u00AB",
	"raquo": "\u00BB",
	"hellip": "\u2026",
	"bull": "\u2022",
	"middot": "\u00B7",
	"lsquo": "\u2018",
	"rsquo": "\u2019",
	"ldquo": "\u201C",
	"rdquo": "\u201D",
	"para": "\u00B6",
	"sect": "\u00A7",
	"deg": "\u00B0",
	"plusmn": "\u00B1",
	"times": "\u00D7",
	"divide": "\u00F7",
	"euro": "\u20AC",
	"pound": "\u00A3",
	"yen": "\u00A5",
	"cent": "\u00A2",
	"rarr": "\u2192",
	"larr": "\u2190",
	"uarr": "\u2191",
	"darr": "\u2193",
	"forall": "\u2200",
	"exist": "\u2203",
	"ne": "\u2260",
	"le": "\u2264",
	"ge": "\u2265",
	"asymp": "\u2248",
	"infin": "\u221E",
	"sum": "\u2211",
	"prod": "\u220F",
	" radic": "\u221A",
};

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&#(\d+);/g, (_, num) => {
			const code = parseInt(num, 10);
			return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
		})
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
			const code = parseInt(hex, 16);
			return code > 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
		})
		.replace(/&([a-zA-Z]+);/g, (_, name) => {
			return NAMED_ENTITIES[name] ?? `&${name};`;
		});
}

function isBlock(el: Element): boolean {
	return !INLINE_TAGS.has(el.tagName.toLowerCase());
}

function getTextContent(el: Element): string {
	let text = "";
	for (const child of Array.from(el.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			text += child.textContent || "";
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			const ce = child as Element;
			if (ce.tagName.toLowerCase() === "br") {
				text += "\n";
			} else {
				text += getTextContent(ce);
			}
		}
	}
	return text;
}

function getBestImageFromPicture(picture: Element, baseUrl: string): string | null {
	let bestSrc = "";
	let bestWidth = 0;

	const sources = picture.querySelectorAll("source");
	for (const source of sources) {
		const type = source.getAttribute("type");
		if (type && !type.startsWith("image/")) continue;

		const srcset = source.getAttribute("srcset");
		if (!srcset) continue;

		const entries = parseSrcset(srcset, baseUrl);
		for (const entry of entries) {
			if (entry.width > bestWidth) {
				bestWidth = entry.width;
				bestSrc = entry.url;
			}
		}
	}

	if (!bestSrc) {
		const img = picture.querySelector("img");
		if (img) {
			const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
			bestSrc = resolveUrl(src, baseUrl);
		}
	}

	return bestSrc || null;
}

interface SrcsetEntry {
	url: string;
	width: number;
}

function parseSrcset(srcset: string, baseUrl: string): SrcsetEntry[] {
	return srcset.split(",").map((entry) => {
		const parts = entry.trim().split(/\s+/);
		const url = resolveUrl(parts[0] || "", baseUrl);
		let width = 0;
		if (parts[1]) {
			const wMatch = parts[1].match(/^(\d+)w$/);
			if (wMatch) width = parseInt(wMatch[1], 10);
		}
		return { url, width };
	}).filter(e => e.url && !e.url.startsWith("data:"));
}

function resolveUrl(src: string, baseUrl: string): string {
	if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
	try {
		return new URL(src, baseUrl).href;
	} catch {
		return src;
	}
}

function escapeMarkdownInline(text: string): string {
	return text
		.replace(/([\\`*_[\]{}])/g, "\\$1");
}

export function htmlToMarkdown(html: string, baseUrl: string): string {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	const body = doc.body;
	if (!body) return "";

	const parts: string[] = [];
	convertNode(body, parts, baseUrl, 0);

	let result = parts.join("");

	result = result
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\s+/, "")
		.replace(/\s+$/, "");

	return result;
}

function convertNode(
	node: Node,
	parts: string[],
	baseUrl: string,
	listDepth: number
): void {
	if (node.nodeType === Node.TEXT_NODE) {
		let text = node.textContent || "";
		text = text.replace(/[\t ]+/g, " ");
		parts.push(text);
		return;
	}

	if (node.nodeType !== Node.ELEMENT_NODE) return;

	const el = node as Element;
	const tag = el.tagName.toLowerCase();

	if (SKIP_TAGS.has(tag)) return;

	if (tag === "picture") {
		const src = getBestImageFromPicture(el, baseUrl);
		const alt = "";
		if (src && !src.startsWith("data:")) {
			parts.push(`![${alt}](${src})`);
		}
		return;
	}

	if (tag === "img") {
		let src = el.getAttribute("src") || el.getAttribute("data-src") || "";
		src = resolveUrl(src, baseUrl);
		const alt = el.getAttribute("alt") || "";

		if (!src || src.startsWith("data:") || src === "") return;

		const width = parseInt(el.getAttribute("width") || "0", 10);
		if (width > 0 && width <= 2) return;

		const height = parseInt(el.getAttribute("height") || "0", 10);
		if (height > 0 && height <= 2) return;

		const cls = (el.getAttribute("class") || "").toLowerCase();
		const skipClasses = ["icon", "emoji", "smiley", "avatar", "emoji-icon", "tracking-pixel"];
		for (const sc of skipClasses) {
			if (cls.includes(sc)) return;
		}

		parts.push(`![${alt}](${src})`);
		return;
	}

	if (tag === "source") {
		return;
	}

	if (tag === "br") {
		parts.push("\n");
		return;
	}

	if (tag === "hr") {
		parts.push("\n\n---\n\n");
		return;
	}

	if (tag === "h1") { parts.push("\n\n# "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }
	if (tag === "h2") { parts.push("\n\n## "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }
	if (tag === "h3") { parts.push("\n\n### "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }
	if (tag === "h4") { parts.push("\n\n#### "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }
	if (tag === "h5") { parts.push("\n\n##### "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }
	if (tag === "h6") { parts.push("\n\n###### "); convertChildren(el, parts, baseUrl, listDepth); parts.push("\n\n"); return; }

	if (tag === "p" || tag === "div" || tag === "section" || tag === "article") {
		const text = getTextContent(el).trim();
		if (!text) return;
		parts.push("\n\n");
		convertChildren(el, parts, baseUrl, listDepth);
		parts.push("\n\n");
		return;
	}

	if (tag === "strong" || tag === "b") {
		const text = getTextContent(el).trim();
		if (!text) return;
		parts.push(`**${text}**`);
		return;
	}

	if (tag === "em" || tag === "i") {
		const text = getTextContent(el).trim();
		if (!text) return;
		parts.push(`*${text}*`);
		return;
	}

	if (tag === "u") {
		parts.push("_");
		convertChildren(el, parts, baseUrl, listDepth);
		parts.push("_");
		return;
	}

	if (tag === "s" || tag === "del" || tag === "strike") {
		const text = getTextContent(el).trim();
		if (!text) return;
		parts.push(`~~${text}~~`);
		return;
	}

	if (tag === "ins") {
		parts.push("_");
		convertChildren(el, parts, baseUrl, listDepth);
		parts.push("_");
		return;
	}

	if (tag === "code") {
		const parent = el.parentElement;
		if (parent && parent.tagName.toLowerCase() === "pre") {
			convertChildren(el, parts, baseUrl, listDepth);
			return;
		}
		const code = getTextContent(el);
		if (code.includes("\n") || code.includes("`")) {
			parts.push(`\`\` ${code} \`\``);
		} else {
			parts.push(`\`${code}\``);
		}
		return;
	}

	if (tag === "pre") {
		const lang = el.getAttribute("data-lang") || el.getAttribute("data-language") || "";
		const codeEl = el.querySelector("code");
		const code = codeEl ? getTextContent(codeEl) : getTextContent(el);
		parts.push(`\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`);
		return;
	}

	if (tag === "blockquote") {
		parts.push("\n\n");
		const inner: string[] = [];
		convertChildren(el, inner, baseUrl, listDepth);
		const blockContent = inner.join("").replace(/\n{3,}/g, "\n\n").trim();
		const lines = blockContent.split("\n");
		for (const line of lines) {
			parts.push(`> ${line}\n`);
		}
		parts.push("\n");
		return;
	}

	if (tag === "a") {
		const href = el.getAttribute("href") || "";
		const text = getTextContent(el).trim();
		if (!text) return;
		if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
			parts.push(text);
			return;
		}
		parts.push(`[${text}](${resolveUrl(href, baseUrl)})`);
		return;
	}

	if (tag === "ul" || tag === "ol") {
		parts.push("\n\n");
		const items = Array.from(el.children).filter(
			(c) => c.tagName.toLowerCase() === "li"
		);
		const ordered = tag === "ol";
		let startNum = 1;
		if (ordered) {
			const startAttr = el.getAttribute("start");
			if (startAttr) startNum = parseInt(startAttr, 10) || 1;
		}
		items.forEach((li, i) => {
			const prefix = ordered ? `${startNum + i}. ` : "- ";
			const indent = "  ".repeat(listDepth);
			parts.push(`${indent}${prefix}`);
			convertChildren(li, parts, baseUrl, listDepth + 1);
			parts.push("\n");
		});
		parts.push("\n");
		return;
	}

	if (tag === "li") {
		parts.push("- ");
		convertChildren(el, parts, baseUrl, listDepth + 1);
		parts.push("\n");
		return;
	}

	if (tag === "dl") {
		parts.push("\n\n");
		const children = Array.from(el.children);
		for (const child of children) {
			const childTag = child.tagName.toLowerCase();
			if (childTag === "dt") {
				parts.push(`**${getTextContent(child).trim()}**\n`);
			} else if (childTag === "dd") {
				parts.push(`: ${getTextContent(child).trim()}\n\n`);
			}
		}
		return;
	}

	if (tag === "details") {
		const summary = el.querySelector("summary");
		if (summary) {
			parts.push(`\n\n**${getTextContent(summary).trim()}**\n\n`);
		}
		const inner: string[] = [];
		for (const child of Array.from(el.childNodes)) {
			if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName.toLowerCase() === "summary") {
				continue;
			}
			convertNode(child, inner, baseUrl, listDepth);
		}
		parts.push(inner.join(""));
		return;
	}

	if (tag === "summary") {
		return;
	}

	if (tag === "table") {
		convertTable(el, parts, baseUrl);
		return;
	}

	if (tag === "figure") {
		const img = el.querySelector("img");
		const picture = el.querySelector("picture");
		const caption = el.querySelector("figcaption");
		const captionText = caption ? getTextContent(caption).trim() : "";

		if (picture) {
			const src = getBestImageFromPicture(picture, baseUrl);
			if (src && !src.startsWith("data:")) {
				const alt = captionText || (img?.getAttribute("alt") || "");
				parts.push(`![${alt}](${src})`);
				if (captionText) {
					parts.push(`\n*${captionText}*`);
				}
				parts.push("\n\n");
				return;
			}
		}

		if (img) {
			const src = resolveUrl(img.getAttribute("src") || img.getAttribute("data-src") || "", baseUrl);
			const alt = captionText || (img.getAttribute("alt") || "");
			if (src && !src.startsWith("data:") && src !== "") {
				parts.push(`![${alt}](${src})`);
				if (captionText) {
					parts.push(`\n*${captionText}*`);
				}
				parts.push("\n\n");
				return;
			}
		}

		if (captionText) {
			parts.push(`*${captionText}*\n\n`);
		}

		convertChildren(el, parts, baseUrl, listDepth);
		return;
	}

	if (tag === "figcaption") {
		return;
	}

	if (tag === "mark") {
		parts.push("==");
		convertChildren(el, parts, baseUrl, listDepth);
		parts.push("==");
		return;
	}

	if (tag === "span") {
		convertChildren(el, parts, baseUrl, listDepth);
		return;
	}

	if (tag === "aside") {
		parts.push("\n\n");
		const inner: string[] = [];
		convertChildren(el, inner, baseUrl, listDepth);
		const content = inner.join("").replace(/\n{3,}/g, "\n\n").trim();
		const lines = content.split("\n");
		for (const line of lines) {
			parts.push(`> ${line}\n`);
		}
		parts.push("\n");
		return;
	}

	if (tag === "abbr") {
		const title = el.getAttribute("title");
		const text = getTextContent(el).trim();
		if (title) {
			parts.push(`${text} (${title})`);
		} else {
			parts.push(text);
		}
		return;
	}

	if (tag === "sup") {
		if (el.querySelector("a")) {
			convertChildren(el, parts, baseUrl, listDepth);
			return;
		}
		const text = getTextContent(el).trim();
		if (text) parts.push(`^${text}^`);
		return;
	}

	if (tag === "sub") {
		const text = getTextContent(el).trim();
		if (text) parts.push(`~${text}~`);
		return;
	}

	if (isBlock(el)) {
		parts.push("\n\n");
	}
	convertChildren(el, parts, baseUrl, listDepth);
	if (isBlock(el)) {
		parts.push("\n\n");
	}
}

function convertChildren(
	el: Element,
	parts: string[],
	baseUrl: string,
	listDepth: number
): void {
	for (const child of Array.from(el.childNodes)) {
		convertNode(child, parts, baseUrl, listDepth);
	}
}

function convertTable(table: Element, parts: string[], baseUrl: string): void {
	const rows = Array.from(table.querySelectorAll("tr"));
	if (rows.length === 0) return;

	const tableData: string[][] = [];
	const isHeaderRow: boolean[] = [];
	for (const row of rows) {
		const cells = Array.from(row.querySelectorAll("th, td"));
		const isHeader = cells.length > 0 && cells[0].tagName.toLowerCase() === "th";
		isHeaderRow.push(isHeader);
		const rowData = cells.map((cell) => {
			const inner: string[] = [];
			convertChildren(cell, inner, baseUrl, 0);
			return inner.join("").replace(/\n/g, " ").replace(/\|/g, "\\|").trim();
		});
		tableData.push(rowData);
	}

	if (tableData.length === 0) return;

	const maxCols = Math.max(...tableData.map((r) => r.length));

	parts.push("\n\n");
	let headerInserted = false;

	for (let i = 0; i < tableData.length; i++) {
		const row = tableData[i];
		while (row.length < maxCols) row.push("");
		parts.push("| " + row.join(" | ") + " |\n");

		if (!headerInserted && (isHeaderRow[i] || i === 0)) {
			parts.push("| " + row.map(() => "---").join(" | ") + " |\n");
			headerInserted = true;
		}
	}
	parts.push("\n");
}

export function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
	const urls: string[] = [];
	const seen = new Set<string>();
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	doc.querySelectorAll("img[src], img[data-src]").forEach((img) => {
		const src = (img.getAttribute("src") || img.getAttribute("data-src") || "").trim();
		if (src && !seen.has(src) && !src.startsWith("data:") && !src.startsWith("blob:")) {
			seen.add(src);
			try {
				urls.push(new URL(src, baseUrl).href);
			} catch {}
		}
	});

	doc.querySelectorAll("picture source[srcset]").forEach((source) => {
		const srcset = source.getAttribute("srcset") || "";
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
