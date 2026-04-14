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
