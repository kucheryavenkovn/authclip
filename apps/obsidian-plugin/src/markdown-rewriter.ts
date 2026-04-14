import type {
  LinkMapEntry,
  AttachmentStatus,
  RewriteMode,
} from "@authclip/shared-types";

export interface RewriteResult {
  markdown: string;
  rewriteErrors: Array<{ url: string; reason: string }>;
}

const IMAGE_MD_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

export function rewriteMarkdown(
  markdown: string,
  linkMap: LinkMapEntry[],
  attachmentResults: Map<string, AttachmentStatus>,
  rewriteMode: RewriteMode,
  attachmentDir: string,
  notePath: string
): RewriteResult {
  const urlToStatus = new Map<string, AttachmentStatus>();
  for (const entry of linkMap) {
    const status = attachmentResults.get(entry.attachmentId);
    if (status) {
      urlToStatus.set(entry.from, status);
    }
  }

  const rewriteErrors: Array<{ url: string; reason: string }> = [];
  const result = markdown.replace(IMAGE_MD_PATTERN, (fullMatch, altText, url) => {
    const trimmedUrl = url.trim();
    const status = urlToStatus.get(trimmedUrl);
    if (!status) return fullMatch;

    if (status.status === "saved" || status.status === "deduplicated") {
      const vaultPath = status.vaultPath;
      if (rewriteMode === "wikilink") {
        const filename = vaultPath.slice(vaultPath.lastIndexOf("/") + 1);
        return `![[${filename}]]`;
      } else {
        const noteDir = notePath.includes("/")
          ? notePath.slice(0, notePath.lastIndexOf("/"))
          : "";
        const relativePath = computeRelativePath(noteDir, vaultPath);
        return `![${altText}](${relativePath})`;
      }
    }

    if (status.status === "failed") {
      rewriteErrors.push({ url: trimmedUrl, reason: `attachment failed: ${status.code}` });
      return `${fullMatch}<!-- authclip: failed to localize URL -->`;
    }

    return fullMatch;
  });

  return { markdown: result, rewriteErrors };
}

function computeRelativePath(fromDir: string, toPath: string): string {
  if (!fromDir) return `./${toPath}`;

  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = toPath.split("/").filter(Boolean);

  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  const upCount = fromParts.length - commonLength;
  const remaining = toParts.slice(commonLength);
  const ups = upCount > 0 ? "../".repeat(upCount) : "./";

  return `${ups}${remaining.join("/")}`;
}
