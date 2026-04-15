// FILE: apps/obsidian-plugin/src/markdown-rewriter.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Replace external image URLs in markdown with local wikilinks or relative paths
//   SCOPE: Markdown image pattern matching, HTML img tag handling, wikilink/relative mode, path computation
//   DEPENDS: M-SHARED-TYPES (LinkMapEntry, AttachmentStatus, RewriteMode)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RewriteResult - Outcome: markdown + rewriteErrors
//   rewriteMarkdown - Replace external URLs with local links based on attachment results
// END_MODULE_MAP

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
const IMAGE_HTML_PATTERN = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;

// START_CONTRACT: rewriteMarkdown
//   PURPOSE: Replace external image URLs in markdown with local wikilinks or relative paths
//   INPUTS: { markdown: string, linkMap: LinkMapEntry[], attachmentResults: Map<string, AttachmentStatus>, rewriteMode: RewriteMode, attachmentDir: string, notePath: string }
//   OUTPUTS: { RewriteResult - rewritten markdown + errors }
//   SIDE_EFFECTS: none
//   LINKS: M-SHARED-TYPES, M-OBSIDIAN-PLUGIN
// END_CONTRACT: rewriteMarkdown
export function rewriteMarkdown(
  markdown: string,
  linkMap: LinkMapEntry[],
  attachmentResults: Map<string, AttachmentStatus>,
  rewriteMode: RewriteMode,
  attachmentDir: string,
  notePath: string
): RewriteResult {
  // START_BLOCK_REWRITE_LINKS
  const urlToStatus = new Map<string, AttachmentStatus>();
  for (const entry of linkMap) {
    const status = attachmentResults.get(entry.attachmentId);
    if (status) {
      urlToStatus.set(entry.from, status);
    }
  }

  const rewriteErrors: Array<{ url: string; reason: string }> = [];

  let result = markdown.replace(IMAGE_MD_PATTERN, (fullMatch, altText, url) => {
    const trimmedUrl = url.trim();
    const status = urlToStatus.get(trimmedUrl);
    if (!status) return fullMatch;

    if (status.status === "saved" || status.status === "deduplicated") {
      return formatImageRef(status.vaultPath, altText, rewriteMode, notePath);
    }

    if (status.status === "failed") {
      rewriteErrors.push({ url: trimmedUrl, reason: `attachment failed: ${status.code}` });
      return `${fullMatch}<!-- authclip: failed to localize URL -->`;
    }

    return fullMatch;
  });

  result = result.replace(IMAGE_HTML_PATTERN, (fullMatch, src, alt) => {
    const trimmedSrc = src.trim();
    const status = urlToStatus.get(trimmedSrc);
    if (!status) return "";

    if (status.status === "saved" || status.status === "deduplicated") {
      return formatImageRef(status.vaultPath, alt || "", rewriteMode, notePath);
    }

    if (status.status === "failed") {
      rewriteErrors.push({ url: trimmedSrc, reason: `attachment failed: ${status.code}` });
      return "";
    }

    return "";
  });

  return { markdown: result, rewriteErrors };
  // END_BLOCK_REWRITE_LINKS
}

function formatImageRef(
  vaultPath: string,
  altText: string,
  rewriteMode: RewriteMode,
  notePath: string
): string {
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
