import type {
  CapturePackage,
  CaptureSource,
  CaptureNote,
  CaptureOptions,
  CaptureMeta,
  AttachmentPayload,
  LinkMapEntry,
  RewriteMode,
} from "@authclip/shared-types";
import { sanitizeFilename } from "@authclip/shared-types";

export interface PackageInput {
  source: Omit<CaptureSource, "capturedAt">;
  markdown: string;
  attachments: AttachmentPayload[];
  rewriteMode?: RewriteMode;
  deduplicate?: boolean;
  attachmentSubfolder?: string;
  maxAttachmentBytes?: number;
  meta?: CaptureMeta;
  selectedHtml?: string;
}

function buildLinkMap(attachments: AttachmentPayload[]): LinkMapEntry[] {
  return attachments.map((att) => ({
    from: att.originalUrl,
    attachmentId: att.id,
  }));
}

function buildPathHint(title: string): string {
  const safe = sanitizeFilename(title);
  const date = new Date().toISOString().slice(0, 10);
  return `Clippings/${date} ${safe}.md`;
}

export function buildCapturePackage(input: PackageInput): CapturePackage {
  const attachments = input.attachments;
  const linkMap = buildLinkMap(attachments);

  const options: CaptureOptions = {
    rewriteMode: input.rewriteMode ?? "wikilink",
    deduplicate: input.deduplicate ?? true,
    ...(input.attachmentSubfolder != null && { attachmentSubfolder: input.attachmentSubfolder }),
    ...(input.maxAttachmentBytes != null && { maxAttachmentBytes: input.maxAttachmentBytes }),
  };

  const source: CaptureSource = {
    ...input.source,
    capturedAt: new Date().toISOString(),
  };

  const note: CaptureNote = {
    pathHint: buildPathHint(input.source.title),
    markdown: input.markdown,
  };

  return {
    version: "1.0",
    source,
    note,
    attachments,
    linkMap,
    options,
    ...(input.meta && { meta: input.meta }),
    ...(input.selectedHtml && { selectedHtml: input.selectedHtml }),
  };
}
