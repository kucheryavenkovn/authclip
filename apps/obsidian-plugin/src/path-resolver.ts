// FILE: apps/obsidian-plugin/src/path-resolver.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Resolve note paths, attachment directories, and unique attachment file paths
//   SCOPE: Path resolution for all three attachment strategies, unique name generation, POSIX path joining
//   DEPENDS: M-SHARED-TYPES (ClipSettings, generateSafeName)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   resolveNotePath - Compute note path from pathHint and defaultNoteFolder
//   resolveAttachmentDir - Compute attachment dir from strategy
//   resolveAttachmentPath - Compute unique attachment file path
//   joinPosix - Join path segments with forward slashes
// END_MODULE_MAP

import type { ClipSettings } from "@authclip/shared-types";
import { generateSafeName } from "@authclip/shared-types";

export function resolveNotePath(
  pathHint: string,
  defaultNoteFolder: string
): string {
  const parts = pathHint.split("/");
  const filename = parts.pop() ?? "untitled.md";
  return joinPosix(defaultNoteFolder, filename);
}

export function resolveAttachmentDir(
  notePath: string,
  strategy: ClipSettings["attachmentFolderStrategy"],
  subfolderName: string,
  globalAttachmentFolder: string
): string {
  switch (strategy) {
    case "same-as-note": {
      const lastSlash = notePath.lastIndexOf("/");
      return lastSlash >= 0 ? notePath.slice(0, lastSlash) : "";
    }
    case "subfolder": {
      const lastSlash = notePath.lastIndexOf("/");
      const noteFolder = lastSlash >= 0 ? notePath.slice(0, lastSlash) : "";
      const noteFile = lastSlash >= 0 ? notePath.slice(lastSlash + 1) : notePath;
      const dotIndex = noteFile.lastIndexOf(".");
      const noteStem = dotIndex > 0 ? noteFile.slice(0, dotIndex) : noteFile;
      return joinPosix(noteFolder, subfolderName, noteStem);
    }
    case "global":
      return globalAttachmentFolder;
  }
}

export function resolveAttachmentPath(
  attachmentDir: string,
  suggestedName: string,
  existingNames: ReadonlySet<string>
): string {
  const safeName = generateSafeName(suggestedName, existingNames);
  return joinPosix(attachmentDir, safeName);
}

export function joinPosix(...segments: string[]): string {
  return segments
    .filter((s) => s.length > 0)
    .join("/")
    .replace(/\/+/g, "/");
}
