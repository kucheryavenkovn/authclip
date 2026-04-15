// FILE: apps/obsidian-plugin/src/settings.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Settings loading and re-export for Obsidian plugin
//   SCOPE: loadSettings function that merges saved data with defaults
//   DEPENDS: M-SHARED-TYPES (ClipSettings, DEFAULT_SETTINGS)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   loadSettings - Merge saved settings with DEFAULT_SETTINGS
// END_MODULE_MAP

import type { ClipSettings } from "@authclip/shared-types";
import { DEFAULT_SETTINGS } from "@authclip/shared-types";

export { DEFAULT_SETTINGS } from "@authclip/shared-types";
export type { ClipSettings };

export function loadSettings(data: Record<string, unknown>): ClipSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...data,
  } as ClipSettings;
}
