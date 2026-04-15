// FILE: packages/shared-types/src/errors.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define all clip error codes used across AuthClip
//   SCOPE: Error code union type
//   DEPENDS: none
//   LINKS: M-SHARED-TYPES
//   ROLE: TYPES
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ClipErrorCode - Union of all error codes for clip pipeline
// END_MODULE_MAP

export type ClipErrorCode =
  | "DISCOVERY_FAILED"
  | "FETCH_FAILED"
  | "FETCH_FORBIDDEN"
  | "FETCH_TIMEOUT"
  | "PAYLOAD_TOO_LARGE"
  | "PLUGIN_UNAVAILABLE"
  | "WRITE_FAILED"
  | "REWRITE_FAILED"
  | "MANIFEST_INVALID"
  | "MANIFEST_VERSION_MISMATCH";
