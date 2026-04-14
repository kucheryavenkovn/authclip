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
