// FILE: packages/shared-types/src/link-map.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Define link map entry type for URL-to-attachment mapping
//   SCOPE: LinkMapEntry
//   DEPENDS: none
//   LINKS: M-SHARED-TYPES
//   ROLE: TYPES
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   LinkMapEntry - Maps original URL to attachment id
// END_MODULE_MAP

export interface LinkMapEntry {
  path: string;
  attachmentId: string;
}
