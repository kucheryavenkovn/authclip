// FILE: packages/shared-types/src/settings.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define plugin and extension configuration model with defaults
//   SCOPE: ClipSettings interface and DEFAULT_SETTINGS constant
//   DEPENDS: capture-package.ts (RewriteMode)
//   LINKS: M-SHARED-TYPES
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ClipSettings - Full configuration model
//   DEFAULT_SETTINGS - Frozen default settings object
// END_MODULE_MAP

import type { RewriteMode } from "./capture-package";

export interface ClipSettings {
  port: number;
  authToken: string;
  defaultNoteFolder: string;
  attachmentFolderStrategy: "same-as-note" | "subfolder" | "global";
  attachmentSubfolderName: string;
  globalAttachmentFolder: string;
  rewriteMode: RewriteMode;
  conflictStrategy: "rename" | "overwrite" | "deduplicate";
  failurePolicy: "save-note-anyway" | "abort-on-any-error";
  deduplicateByHash: boolean;
  maxAttachmentBytes: number;
  includeBackgroundImages: boolean;
  keepSourceUrlInFrontmatter: boolean;
}

export const DEFAULT_SETTINGS: Readonly<ClipSettings> = {
  port: 27124,
  authToken: "",
  defaultNoteFolder: "Clippings",
  attachmentFolderStrategy: "subfolder",
  attachmentSubfolderName: "_assets",
  globalAttachmentFolder: "attachments",
  rewriteMode: "wikilink",
  conflictStrategy: "rename",
  failurePolicy: "save-note-anyway",
  deduplicateByHash: true,
  maxAttachmentBytes: 25 * 1024 * 1024,
  includeBackgroundImages: false,
  keepSourceUrlInFrontmatter: true,
};
