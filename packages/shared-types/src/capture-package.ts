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
