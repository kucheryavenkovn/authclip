// FILE: packages/shared-types/src/capture-package.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define the canonical CapturePackage manifest and related types
//   SCOPE: RewriteMode, CaptureSource, CaptureNote, CaptureOptions, CaptureMeta, CapturePackage
//   DEPENDS: attachment.ts, link-map.ts
//   LINKS: M-SHARED-TYPES
//   ROLE: TYPES
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   RewriteMode - Link format: wikilink | relative-markdown
//   CaptureSource - Page origin: url, title, capturedAt
//   CaptureNote - Note content: pathHint, markdown
//   CaptureOptions - Per-capture settings
//   CaptureMeta - Optional page metadata
//   CapturePackage - Canonical clip manifest v1.0
// END_MODULE_MAP

export type RewriteMode = "wikilink" | "relative-markdown";

export interface CaptureSource {
  url: string;
  title: string;
  capturedAt: string;
}

export interface CaptureNote {
  pathHint: string;
  markdown: string;
}

export interface CaptureOptions {
  rewriteMode: RewriteMode;
  deduplicate: boolean;
  attachmentSubfolder?: string;
  maxAttachmentBytes?: number;
}

export interface CaptureMeta {
  author?: string;
  description?: string;
  published?: string;
  siteName?: string;
  domain?: string;
  favicon?: string;
  image?: string;
  language?: string;
  wordCount?: number;
}

export interface CapturePackage {
  version: "1.0";
  source: CaptureSource;
  note: CaptureNote;
  attachments: import("./attachment").AttachmentPayload[];
  linkMap: import("./link-map").LinkMapEntry[];
  options: CaptureOptions;
  meta?: CaptureMeta;
  selectedHtml?: string;
}
