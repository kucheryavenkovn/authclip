// FILE: packages/shared-types/src/sanitize.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Filename sanitization and safe name generation for vault writes
//   SCOPE: sanitizeFilename, generateSafeName, extractFilenameFromUrl
//   DEPENDS: none
//   LINKS: M-SHARED-TYPES
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   sanitizeFilename - Remove unsafe characters, enforce length limit
//   generateSafeName - Generate unique filename with conflict counter
//   extractFilenameFromUrl - Extract filename from URL, handle data:/blob:
// END_MODULE_MAP

const UNSAFE_CHARS = /[<>:"/\\|?*\x00-\x1f!]/g;
const REPEATED_DOTS = /\.{2,}/g;
const CONSECUTIVE_DASHES = /-{2,}/g;
const TRIM_DASHES = /^[-_\s]+|[-_\s]+$/g;
const WHITESPACE = /\s+/g;
const MAX_NAME_LENGTH = 200;
const DOT_ONLY = /^\.+$/;

export function sanitizeFilename(name: string): string {
  if (!name || typeof name !== "string") return "untitled";

  let sanitized = name
    .replace(UNSAFE_CHARS, "-")
    .replace(REPEATED_DOTS, ".")
    .replace(WHITESPACE, "-")
    .replace(CONSECUTIVE_DASHES, "-")
    .replace(TRIM_DASHES, "");

  if (!sanitized || DOT_ONLY.test(sanitized)) sanitized = "untitled";

  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_NAME_LENGTH);
  }

  sanitized = sanitized.replace(TRIM_DASHES, "");

  return sanitized || "untitled";
}

export function generateSafeName(
  preferredName: string,
  existingNames: ReadonlySet<string>
): string {
  const base = sanitizeFilename(preferredName);
  const dotIndex = base.lastIndexOf(".");
  const stem = dotIndex > 0 ? base.slice(0, dotIndex) : base;
  const ext = dotIndex > 0 ? base.slice(dotIndex) : "";

  if (!existingNames.has(base)) return base;

  let counter = 1;
  let candidate: string;
  do {
    candidate = `${stem}-${counter}${ext}`;
    counter++;
  } while (existingNames.has(candidate));

  return candidate;
}

export function extractFilenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === "data:") return "untitled";
    if (parsed.protocol === "blob:") return "untitled";

    const pathname = parsed.pathname;
    if (pathname.endsWith("/")) return "untitled";

    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments.pop();

    if (lastSegment) {
      const decoded = decodeURIComponent(lastSegment);
      if (decoded && decoded.length > 0 && !decoded.startsWith(".")) {
        return decoded;
      }
    }
  } catch {
    return sanitizeFilename(url);
  }

  return "untitled";
}
