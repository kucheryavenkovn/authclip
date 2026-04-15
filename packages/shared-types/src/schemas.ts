// FILE: packages/shared-types/src/schemas.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Zod validation schemas for all shared types (runtime validation)
//   SCOPE: All Zod schemas re-exported from index.ts
//   DEPENDS: zod
//   LINKS: M-SHARED-TYPES
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ClipErrorCodeSchema - Zod enum for error codes
//   AssetSourceSchema - Zod enum for asset sources
//   DiscoveredAssetSchema - Zod object for discovered assets
//   AttachmentPayloadSchema - Zod object for attachment payloads
//   LinkMapEntrySchema - Zod object for link map entries
//   RewriteModeSchema - Zod enum for rewrite modes
//   CaptureSourceSchema - Zod object for capture source
//   CaptureNoteSchema - Zod object for capture note
//   CaptureOptionsSchema - Zod object for capture options
//   CaptureMetaSchema - Zod object for capture metadata
//   CapturePackageSchema - Zod object for full capture package
//   AttachmentStatusSavedSchema - Zod object for saved status
//   AttachmentStatusDeduplicatedSchema - Zod object for deduped status
//   AttachmentStatusFailedSchema - Zod object for failed status
//   AttachmentStatusSkippedSchema - Zod object for skipped status
//   AttachmentStatusSchema - Zod discriminated union for all statuses
//   ClipResultStatusSchema - Zod enum for result status
//   ResultReportErrorSchema - Zod object for error entries
//   ResultReportSchema - Zod object for result reports
// END_MODULE_MAP

import { z } from "zod";

export const ClipErrorCodeSchema = z.enum([
  "DISCOVERY_FAILED",
  "FETCH_FAILED",
  "FETCH_FORBIDDEN",
  "FETCH_TIMEOUT",
  "PAYLOAD_TOO_LARGE",
  "PLUGIN_UNAVAILABLE",
  "WRITE_FAILED",
  "REWRITE_FAILED",
  "MANIFEST_INVALID",
  "MANIFEST_VERSION_MISMATCH",
]);

export const AssetSourceSchema = z.enum([
  "img-src",
  "img-srcset",
  "picture-srcset",
  "css-bg",
]);

export const DiscoveredAssetSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  source: AssetSourceSchema,
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  selected: z.boolean(),
});

export const AttachmentPayloadSchema = z.object({
  id: z.string().min(1),
  originalUrl: z.string().min(1),
  mimeType: z.string().min(1),
  suggestedName: z.string().min(1),
  dataBase64: z.string().min(1),
  sha256: z.string().length(64).optional(),
});

export const LinkMapEntrySchema = z.object({
  from: z.string().min(1),
  attachmentId: z.string().min(1),
});

export const RewriteModeSchema = z.enum(["wikilink", "relative-markdown"]);

export const CaptureSourceSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  capturedAt: z.string().datetime({ offset: true }),
});

export const CaptureNoteSchema = z.object({
  pathHint: z.string().min(1),
  markdown: z.string(),
});

export const CaptureOptionsSchema = z.object({
  rewriteMode: RewriteModeSchema,
  deduplicate: z.boolean(),
  attachmentSubfolder: z.string().min(1).optional(),
  maxAttachmentBytes: z.number().int().positive().optional(),
});

export const CaptureMetaSchema = z.object({
  author: z.string().optional(),
  description: z.string().optional(),
  published: z.string().optional(),
  siteName: z.string().optional(),
  domain: z.string().optional(),
  favicon: z.string().optional(),
  image: z.string().optional(),
  language: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

export const CapturePackageSchema = z.object({
  version: z.literal("1.0"),
  source: CaptureSourceSchema,
  note: CaptureNoteSchema,
  attachments: z.array(AttachmentPayloadSchema),
  linkMap: z.array(LinkMapEntrySchema),
  options: CaptureOptionsSchema,
  meta: CaptureMetaSchema.optional(),
  selectedHtml: z.string().optional(),
});

export const AttachmentStatusSavedSchema = z.object({
  id: z.string().min(1),
  status: z.literal("saved"),
  vaultPath: z.string().min(1),
});

export const AttachmentStatusDeduplicatedSchema = z.object({
  id: z.string().min(1),
  status: z.literal("deduplicated"),
  vaultPath: z.string().min(1),
});

export const AttachmentStatusFailedSchema = z.object({
  id: z.string().min(1),
  status: z.literal("failed"),
  code: ClipErrorCodeSchema,
  message: z.string().min(1),
});

export const AttachmentStatusSkippedSchema = z.object({
  id: z.string().min(1),
  status: z.literal("skipped"),
});

export const AttachmentStatusSchema = z.discriminatedUnion("status", [
  AttachmentStatusSavedSchema,
  AttachmentStatusDeduplicatedSchema,
  AttachmentStatusFailedSchema,
  AttachmentStatusSkippedSchema,
]);

export const ClipResultStatusSchema = z.enum(["success", "partial", "failed"]);

export const ResultReportErrorSchema = z.object({
  code: ClipErrorCodeSchema,
  message: z.string().min(1),
});

export const ResultReportSchema = z.object({
  version: z.literal("1.0"),
  status: ClipResultStatusSchema,
  notePath: z.string().nullable(),
  attachments: z.array(AttachmentStatusSchema),
  errors: z.array(ResultReportErrorSchema),
});
