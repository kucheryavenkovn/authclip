// FILE: apps/obsidian-plugin/src/manifest-validator.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Validate incoming CapturePackage manifests with Zod schema and version check
//   SCOPE: Package validation, version compatibility check
//   DEPENDS: M-SHARED-TYPES (CapturePackageSchema, CapturePackage)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ValidationResult - Validation outcome: valid, pkg, errorMessage
//   validateCapturePackage - Validate raw input against CapturePackageSchema
// END_MODULE_MAP

import { CapturePackageSchema } from "@authclip/shared-types";
import type { CapturePackage } from "@authclip/shared-types";

export interface ValidationResult {
  valid: boolean;
  pkg: CapturePackage | null;
  errorMessage: string | null;
}

const SUPPORTED_MAJOR = 1;

// START_CONTRACT: validateCapturePackage
//   PURPOSE: Validate raw input against CapturePackage Zod schema with version check
//   INPUTS: { raw: unknown }
//   OUTPUTS: { ValidationResult - valid, parsed package, or error message }
//   SIDE_EFFECTS: none
//   LINKS: M-SHARED-TYPES, M-OBSIDIAN-PLUGIN
// END_CONTRACT: validateCapturePackage
export function validateCapturePackage(raw: unknown): ValidationResult {
  // START_BLOCK_VALIDATE
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      pkg: null,
      errorMessage: "MANIFEST_INVALID: expected a non-null object",
    };
  }

  const version = (raw as Record<string, unknown>).version;
  if (typeof version === "string") {
    const [majorStr] = version.split(".");
    const major = Number(majorStr);
    if (!isNaN(major) && major !== SUPPORTED_MAJOR) {
      return {
        valid: false,
        pkg: null,
        errorMessage: `MANIFEST_VERSION_MISMATCH: supported major version is ${SUPPORTED_MAJOR}, received ${major}`,
      };
    }
  }

  const parseResult = CapturePackageSchema.safeParse(raw);

  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    const path = firstIssue?.path.join(".") ?? "root";
    const message = firstIssue?.message ?? "Unknown validation error";
    return {
      valid: false,
      pkg: null,
      errorMessage: `MANIFEST_INVALID: ${path} — ${message}`,
    };
  }

  return { valid: true, pkg: parseResult.data, errorMessage: null };
  // END_BLOCK_VALIDATE
}
