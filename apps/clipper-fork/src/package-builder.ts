// FILE: apps/clipper-fork/src/package-builder.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Assemble markdown + attachments into a valid CapturePackage manifest
//   SCOPE: CapturePackage construction, linkMap generation, pathHint generation
//   DEPENDS: M-SHARED-TYPES (CapturePackage, CaptureSource, CaptureNote, CaptureOptions, CaptureMeta, AttachmentPayload, LinkMapEntry, RewriteMode, sanitizeFilename)
//   LINKS: M-CLIPPER-FORK
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   PackageInput - Input for buildCapturePackage
//   buildCapturePackage - Assemble CapturePackage from inputs
// END_MODULE_MAP

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

// START_CONTRACT: buildCapturePackage
//   PURPOSE: Assemble markdown + attachments into a valid CapturePackage
//   INPUTS: { input: PackageInput - source, markdown, attachments, options }
//   OUTPUTS: { CapturePackage - complete manifest ready for transport }
//   SIDE_EFFECTS: none
//   LINKS: M-SHARED-TYPES
// END_CONTRACT: buildCapturePackage
export function buildCapturePackage(input: PackageInput, log?: (msg: string) => void): CapturePackage {
  // START_BLOCK_BUILD_PACKAGE
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

  const pkg: CapturePackage = {
    version: "1.0",
    source,
    note,
    attachments,
    linkMap,
    options,
    ...(input.meta && { meta: input.meta }),
    ...(input.selectedHtml && { selectedHtml: input.selectedHtml }),
  };

  log?.(`[ClipperFork][buildCapturePackage][BLOCK_BUILD_PACKAGE] package built attachments=${attachments.length} linkMap=${linkMap.length}`);
  return pkg;
  // END_BLOCK_BUILD_PACKAGE
}
