// FILE: packages/shared-types/src/index.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Barrel re-export of all shared types, schemas, sanitization utilities, and constants
//   SCOPE: Re-exports from errors, attachment, link-map, capture-package, settings, result-report, sanitize, schemas
//   DEPENDS: none (internal barrel)
//   LINKS: M-SHARED-TYPES
//   ROLE: BARREL
//   MAP_MODE: SUMMARY
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   Re-exports all types, schemas, sanitization functions, and DEFAULT_SETTINGS
// END_MODULE_MAP

export type { ClipErrorCode } from "./errors";
export type {
  AssetSource,
  DiscoveredAsset,
  AttachmentPayload,
  AttachmentResultStatus,
  AttachmentStatus,
  AttachmentStatusSaved,
  AttachmentStatusDeduplicated,
  AttachmentStatusFailed,
  AttachmentStatusSkipped,
} from "./attachment";
export type { LinkMapEntry } from "./link-map";
export type {
  RewriteMode,
  CaptureSource,
  CaptureNote,
  CaptureOptions,
  CapturePackage,
  CaptureMeta,
} from "./capture-package";
export type {
  ClipResultStatus,
  ResultReportError,
  ResultReport,
} from "./result-report";
export type { ClipSettings } from "./settings";
export {
  DEFAULT_SETTINGS,
} from "./settings";
export {
  sanitizeFilename,
  generateSafeName,
  extractFilenameFromUrl,
} from "./sanitize";
export { buildResultStatus } from "./result-report";
export {
  ClipErrorCodeSchema,
  AssetSourceSchema,
  DiscoveredAssetSchema,
  AttachmentPayloadSchema,
  LinkMapEntrySchema,
  RewriteModeSchema,
  CaptureSourceSchema,
  CaptureNoteSchema,
  CaptureOptionsSchema,
  CaptureMetaSchema,
  CapturePackageSchema,
  AttachmentStatusSavedSchema,
  AttachmentStatusDeduplicatedSchema,
  AttachmentStatusFailedSchema,
  AttachmentStatusSkippedSchema,
  AttachmentStatusSchema,
  ClipResultStatusSchema,
  ResultReportErrorSchema,
  ResultReportSchema,
} from "./schemas";
