import { CapturePackageSchema } from "@authclip/shared-types";
import type { CapturePackage } from "@authclip/shared-types";

export interface ValidationResult {
  valid: boolean;
  pkg: CapturePackage | null;
  errorMessage: string | null;
}

const SUPPORTED_MAJOR = 1;

export function validateCapturePackage(raw: unknown): ValidationResult {
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
}
