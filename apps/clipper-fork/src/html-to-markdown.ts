const SKIP_TAGS = new Set([
	"script", "style", "svg", "path", "defs", "linearGradient", "stop",
	"button", "input", "textarea", "select", "form", "noscript", "iframe",
	"app-cmf-icon", "app-cmf-gravatar", "app-cmf-obj-like-groups",
	"app-cmf-doodle-icon", "mat-menu", "app-cmf-gravatar",
]);

const INLINE_TAGS = new Set([
	"span", "a", "strong", "b", "em", "i", "u", "s", "del", "strike",
	"code", "mark", "small", "sub", "sup", "abbr", "time", "var", "kbd",
	"samp", "bdo", "bdi", "data", "wbr", "br", "img",
	"cite", "dfn", "q",
]);

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

function resolveUrl(src: string, baseUrl: string): string {
	if (!src || src.startsWith("data:") || src.startsWith("blob:")) return src;
	try {
		return new URL(src, baseUrl).href;
	} catch {
		return src;
	}
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

	if (tag === "img") {
		const src = resolveUrl(el.getAttribute("src") || "", baseUrl);
		const alt = el.getAttribute("alt") || "";
		if (src && !src.startsWith("data:") && src !== "") {
			parts.push(`![${alt}](${src})`);
		}
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

	if (tag === "code") {
		const parent = el.parentElement;
		if (parent && parent.tagName.toLowerCase() === "pre") {
			convertChildren(el, parts, baseUrl, listDepth);
			return;
		}
		parts.push(`\`${getTextContent(el)}\``);
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
		items.forEach((li, i) => {
			const prefix = ordered ? `${i + 1}. ` : "- ";
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

	if (tag === "table") {
		convertTable(el, parts, baseUrl);
		return;
	}

	if (tag === "figure") {
		const img = el.querySelector("img");
		const caption = el.querySelector("figcaption");
		if (img) {
			const src = resolveUrl(img.getAttribute("src") || "", baseUrl);
			const alt = caption ? getTextContent(caption).trim() : (img.getAttribute("alt") || "");
			parts.push(`![${alt}](${src})`);
			if (caption && alt) {
				parts.push(`\n*${alt}*`);
			}
			parts.push("\n\n");
			return;
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
	for (const row of rows) {
		const cells = Array.from(row.querySelectorAll("th, td"));
		const rowData = cells.map((cell) => {
			const inner: string[] = [];
			convertChildren(cell, inner, baseUrl, 0);
			return inner.join("").replace(/\n/g, " ").trim();
		});
		tableData.push(rowData);
	}

	if (tableData.length === 0) return;

	const maxCols = Math.max(...tableData.map((r) => r.length));

	parts.push("\n\n");
	for (let i = 0; i < tableData.length; i++) {
		const row = tableData[i];
		while (row.length < maxCols) row.push("");
		parts.push("| " + row.join(" | ") + " |\n");
		if (i === 0) {
			parts.push("| " + row.map(() => "---").join(" | ") + " |\n");
		}
	}
	parts.push("\n");
}

export function extractImageUrlsFromHtml(html: string, baseUrl: string): string[] {
	const urls: string[] = [];
	const seen = new Set<string>();
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, "text/html");

	doc.querySelectorAll("img[src]").forEach((img) => {
		const src = img.getAttribute("src")?.trim();
		if (src && !seen.has(src) && !src.startsWith("data:") && !src.startsWith("blob:")) {
			seen.add(src);
			try {
				urls.push(new URL(src, baseUrl).href);
			} catch {}
		}
	});

	return urls;
}
