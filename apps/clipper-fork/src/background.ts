import { fetchAssets } from "./asset-discovery-wrapper";
import { buildCapturePackage } from "./package-builder";

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

chrome.runtime.onMessage.addListener(
  (
    message: IncomingMessage,
    _sender: chrome.runtime.MessageSender,
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

    return false;
  }
);

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

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent,
    });

    if (!results?.[0]?.result) {
      sendResponse({ success: false, error: "Failed to extract page content" });
      return;
    }

    const pageData = results[0].result as {
      title: string;
      url: string;
      markdown: string;
      imageUrls: string[];
    };

    const baseUrl = pageData.url;

    const assets = pageData.imageUrls.map((url, i) => ({
      id: `asset_${i + 1}`,
      url,
      source: "img-src" as const,
      selected: true,
    }));

    const { attachments, failures } = await fetchAssets(assets, {
      maxBytes: 25 * 1024 * 1024,
    });

    const pkg = buildCapturePackage({
      source: { url: pageData.url, title: pageData.title },
      markdown: pageData.markdown,
      attachments,
    });

    const { sendCapturePackage } = await import("./transport");
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

async function handleHealthCheck(
  msg: HealthCheckMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const { checkHealth } = await import("./transport");
    const healthy = await checkHealth({
      port: msg.port,
      authToken: msg.authToken,
    });
    sendResponse({ healthy });
  } catch {
    sendResponse({ healthy: false });
  }
}

function extractPageContent(): {
  title: string;
  url: string;
  markdown: string;
  imageUrls: string[];
} {
  const title = document.title || "Untitled";
  const url = location.href;

  const article =
    document.querySelector("article") ??
    document.querySelector('[role="main"]') ??
    document.querySelector("main") ??
    document.body;

  const imageUrls: string[] = [];
  const seen = new Set<string>();

  article.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src")?.trim();
    if (src && !seen.has(src)) {
      seen.add(src);
      try {
        imageUrls.push(new URL(src, url).href);
      } catch {}
    }
  });

  article.querySelectorAll("img[srcset], picture source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset") || "";
    srcset.split(",").forEach((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (parts[0]) {
        try {
          const resolved = new URL(parts[0], url).href;
          if (!seen.has(resolved)) {
            seen.add(resolved);
            imageUrls.push(resolved);
          }
        } catch {}
      }
    });
  });

  function elementToMd(el: Element): string {
    const parts: string[] = [];

    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        parts.push(child.textContent || "");
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const ce = child as HTMLElement;
        const tag = ce.tagName.toLowerCase();

        if (tag === "h1") parts.push(`# ${ce.textContent?.trim()}\n\n`);
        else if (tag === "h2") parts.push(`## ${ce.textContent?.trim()}\n\n`);
        else if (tag === "h3") parts.push(`### ${ce.textContent?.trim()}\n\n`);
        else if (tag === "h4") parts.push(`#### ${ce.textContent?.trim()}\n\n`);
        else if (tag === "h5") parts.push(`##### ${ce.textContent?.trim()}\n\n`);
        else if (tag === "h6") parts.push(`###### ${ce.textContent?.trim()}\n\n`);
        else if (tag === "p") parts.push(`${elementToMd(ce)}\n\n`);
        else if (tag === "br") parts.push("\n");
        else if (tag === "strong" || tag === "b") parts.push(`**${ce.textContent}**`);
        else if (tag === "em" || tag === "i") parts.push(`*${ce.textContent}*`);
        else if (tag === "code") parts.push(`\`${ce.textContent}\``);
        else if (tag === "pre") parts.push(`\`\`\`\n${ce.textContent}\n\`\`\`\n\n`);
        else if (tag === "a") {
          const href = ce.getAttribute("href") || "";
          parts.push(`[${ce.textContent}](${href})`);
        } else if (tag === "img") {
          const src = ce.getAttribute("src") || "";
          const alt = ce.getAttribute("alt") || "";
          parts.push(`![${alt}](${src})`);
        } else if (tag === "ul" || tag === "ol") {
          const items = Array.from(ce.children);
          items.forEach((li, i) => {
            const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
            parts.push(`${prefix}${elementToMd(li).trim()}\n`);
          });
          parts.push("\n");
        } else if (tag === "li") {
          parts.push(elementToMd(ce));
        } else if (tag === "blockquote") parts.push(`> ${elementToMd(ce).trim()}\n\n`);
        else if (tag === "hr") parts.push("---\n\n");
        else if (tag === "script" || tag === "style" || tag === "nav" || tag === "footer") {
          // skip
        } else {
          parts.push(elementToMd(ce));
        }
      }
    }

    return parts.join("");
  }

  const markdown = elementToMd(article)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { title, url, markdown, imageUrls };
}
