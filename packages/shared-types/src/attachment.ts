// FILE: packages/shared-types/src/attachment.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define asset discovery and attachment payload types
//   SCOPE: AssetSource, DiscoveredAsset, AttachmentPayload, per-attachment status variants
//   DEPENDS: errors.ts
//   LINKS: M-SHARED-TYPES
//   ROLE: TYPES
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   AssetSource - Asset origin discriminator
//   DiscoveredAsset - Single discovered image asset
//   AttachmentPayload - Binary attachment with metadata
//   AttachmentResultStatus - Outcome: saved | deduplicated | failed | skipped
//   AttachmentStatusSaved - Saved with vaultPath
//   AttachmentStatusDeduplicated - Deduped with vaultPath
//   AttachmentStatusFailed - Failed with error code
//   AttachmentStatusSkipped - Skipped (size limit)
//   AttachmentStatus - Discriminated union of all status variants
// END_MODULE_MAP

export type AssetSource = "img-src" | "img-srcset" | "picture-srcset" | "css-bg";

export interface DiscoveredAsset {
  id: string;
  url: string;
  source: AssetSource;
  mimeType?: string;
  sizeBytes?: number;
  selected: boolean;
}

export interface AttachmentPayload {
  id: string;
  originalUrl: string;
  mimeType: string;
  suggestedName: string;
  dataBase64: string;
  sha256?: string;
}

export type AttachmentResultStatus = "saved" | "deduplicated" | "failed" | "skipped";

export interface AttachmentStatusSaved {
  id: string;
  status: "saved";
  vaultPath: string;
}

export interface AttachmentStatusDeduplicated {
  id: string;
  status: "deduplicated";
  vaultPath: string;
}

export interface AttachmentStatusFailed {
  id: string;
  status: "failed";
  code: import("./errors").ClipErrorCode;
  message: string;
}

export interface AttachmentStatusSkipped {
  id: string;
  status: "skipped";
}

export type AttachmentStatus =
  | AttachmentStatusSaved
  | AttachmentStatusDeduplicated
  | AttachmentStatusFailed
  | AttachmentStatusSkipped;
