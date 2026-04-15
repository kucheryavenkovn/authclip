// START_MODULE_MAP
//   ClipTransactionInput - Transaction input: pkg, settings, vault
//   executeClipTransaction - Full clip orchestration producing ResultReport
// END_MODULE_MAP

// START_CHANGE_SUMMARY
//   LAST_CHANGE: v0.2.0 - Initial GRACE markup added to existing implementation
// END_CHANGE_SUMMARY

import type {
  CapturePackage,
  AttachmentStatus,
  ResultReport,
  ClipSettings,
} from "@authclip/shared-types";
import { buildResultStatus } from "@authclip/shared-types";
import type { VaultAdapter } from "./vault-adapter";
import { writeAttachment } from "./attachment-writer";
import { rewriteMarkdown } from "./markdown-rewriter";
import {
  resolveNotePath,
  resolveAttachmentDir,
  resolveAttachmentPath,
} from "./path-resolver";

export interface ClipTransactionInput {
  pkg: CapturePackage;
  settings: ClipSettings;
  vault: VaultAdapter;
}

// START_CONTRACT: executeClipTransaction
//   PURPOSE: Orchestrate full clip: resolve paths, write attachments, rewrite markdown, create note
//   INPUTS: { input: ClipTransactionInput - pkg, settings, vault }
//   OUTPUTS: { ResultReport - version, status, notePath, attachments, errors }
//   SIDE_EFFECTS: Creates directories, writes binary files and note to vault
//   LINKS: M-SHARED-TYPES, M-OBSIDIAN-PLUGIN
// END_CONTRACT: executeClipTransaction
export async function executeClipTransaction(
  input: ClipTransactionInput
): Promise<ResultReport> {
  // START_BLOCK_RECEIVE
  const { pkg, settings, vault } = input;
  const errors: ResultReport["errors"] = [];

  const notePath = resolveNotePath(pkg.note.pathHint, settings.defaultNoteFolder);
  const attachDir = resolveAttachmentDir(
    notePath,
    settings.attachmentFolderStrategy,
    settings.attachmentSubfolderName,
    settings.globalAttachmentFolder
  );

  const attachmentResults = new Map<string, AttachmentStatus>();
  const existingFiles = await listExistingFiles(vault, attachDir);
  const usedNames = new Set(existingFiles.map((f) => f.slice(f.lastIndexOf("/") + 1)));

  for (const attachment of pkg.attachments) {
    const maxBytes = pkg.options.maxAttachmentBytes ?? settings.maxAttachmentBytes;
    if (maxBytes && attachment.dataBase64.length > maxBytes * 1.37) {
      attachmentResults.set(attachment.id, {
        id: attachment.id,
        status: "skipped",
      });
      continue;
    }

    const destPath = resolveAttachmentPath(attachDir, attachment.suggestedName, usedNames);
    usedNames.add(destPath.slice(destPath.lastIndexOf("/") + 1));

    const result = await writeAttachment(attachment, destPath, vault);
    attachmentResults.set(attachment.id, result.status);

    if (result.status.status === "failed") {
      errors.push({
        code: result.status.code,
        message: result.status.message,
      });
    }
  }

  const { markdown: rewritten, rewriteErrors } = rewriteMarkdown(
    pkg.note.markdown,
    pkg.linkMap,
    attachmentResults,
    settings.rewriteMode,
    attachDir,
    notePath
  );

  for (const re of rewriteErrors) {
    errors.push({ code: "REWRITE_FAILED", message: `URL ${re.url}: ${re.reason}` });
  }

  const finalMarkdown = prependFrontmatter(rewritten, pkg, attachmentResults, settings);

  // END_BLOCK_RECEIVE

  // START_BLOCK_CREATE_NOTE
  let noteSaved = false;
  try {
    await vault.ensureDir(dirName(notePath));
    await vault.writeText(notePath, finalMarkdown);
    noteSaved = true;
  } catch (err) {
    errors.push({
      code: "WRITE_FAILED",
      message: `Failed to write note: ${err instanceof Error ? err.message : "Unknown"}`,
    });
  }

  const allAttachments = Array.from(attachmentResults.values());
  const status = buildResultStatus(allAttachments, noteSaved);

  return {
    version: "1.0",
    status,
    notePath: noteSaved ? notePath : null,
    attachments: allAttachments,
    errors,
  };
  // END_BLOCK_CREATE_NOTE
}

async function listExistingFiles(vault: VaultAdapter, dir: string): Promise<string[]> {
  try {
    return await vault.listFiles(dir);
  } catch {
    return [];
  }
}

function prependFrontmatter(
  markdown: string,
  pkg: CapturePackage,
  results: Map<string, AttachmentStatus>,
  settings: ClipSettings
): string {
  const saved = Array.from(results.values()).filter((a) => a.status === "saved").length;
  const failed = Array.from(results.values()).filter((a) => a.status === "failed").length;

  const lines: string[] = ["---"];
  lines.push(`source_title: ${yamlString(pkg.source.title)}`);
  if (settings.keepSourceUrlInFrontmatter) {
    lines.push(`source_url: ${yamlString(pkg.source.url)}`);
  }
  lines.push(`captured_at: ${yamlString(pkg.source.capturedAt)}`);
  lines.push(`clipper_mode: authclip`);
  if (pkg.meta?.author) lines.push(`author: ${yamlString(pkg.meta.author)}`);
  if (pkg.meta?.description) lines.push(`description: ${yamlString(pkg.meta.description)}`);
  if (pkg.meta?.published) lines.push(`published: ${yamlString(pkg.meta.published)}`);
  if (pkg.meta?.siteName) lines.push(`site_name: ${yamlString(pkg.meta.siteName)}`);
  if (pkg.meta?.domain) lines.push(`domain: ${yamlString(pkg.meta.domain)}`);
  if (pkg.meta?.language) lines.push(`language: ${yamlString(pkg.meta.language)}`);
  if (pkg.meta?.wordCount) lines.push(`word_count: ${pkg.meta.wordCount}`);
  lines.push(`assets_saved: ${saved}`);
  lines.push(`assets_failed: ${failed}`);
  lines.push("---");
  lines.push("");

  return lines.join("\n") + markdown;
}

function yamlString(value: string): string {
  if (value.includes('"') || value.includes("\n") || value.includes(":")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function dirName(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
}
