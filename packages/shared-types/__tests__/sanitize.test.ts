import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  generateSafeName,
  extractFilenameFromUrl,
} from "../src/sanitize";

describe("sanitizeFilename", () => {
  it("returns untitled for empty string", () => {
    expect(sanitizeFilename("")).toBe("untitled");
  });

  it("preserves simple valid names", () => {
    expect(sanitizeFilename("photo.jpg")).toBe("photo.jpg");
  });

  it("replaces unsafe characters with dashes", () => {
    expect(sanitizeFilename('file<>:name|.jpg')).toBe("file-name-.jpg");
  });

  it("replaces backslashes and forward slashes", () => {
    expect(sanitizeFilename("path\\to/file.jpg")).toBe("path-to-file.jpg");
  });

  it("replaces null bytes", () => {
    expect(sanitizeFilename("file\x00name.jpg")).toBe("file-name.jpg");
  });

  it("replaces control characters", () => {
    expect(sanitizeFilename("file\x01\x02name.jpg")).toBe("file-name.jpg");
  });

  it("replaces whitespace with dashes", () => {
    expect(sanitizeFilename("my file name.jpg")).toBe("my-file-name.jpg");
  });

  it("replaces multiple whitespace with single dash", () => {
    expect(sanitizeFilename("my  file.jpg")).toBe("my-file.jpg");
  });

  it("trims leading and trailing dashes", () => {
    expect(sanitizeFilename("---file.jpg---")).toBe("file.jpg");
  });

  it("trims leading and trailing spaces", () => {
    expect(sanitizeFilename("  file.jpg  ")).toBe("file.jpg");
  });

  it("neutralizes path traversal by removing slashes and collapsing dots", () => {
    const result = sanitizeFilename("../../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("..");
    expect(result).toContain("etc-passwd");
  });

  it("handles double dots", () => {
    expect(sanitizeFilename("file..name.jpg")).toBe("file.name.jpg");
  });

  it("truncates long names to MAX_NAME_LENGTH", () => {
    const longName = "a".repeat(300) + ".jpg";
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });

  it("returns untitled for names that sanitize to empty", () => {
    expect(sanitizeFilename("!!!")).toBe("untitled");
  });

  it("handles Unicode characters", () => {
    expect(sanitizeFilename("фото.jpg")).toBe("фото.jpg");
  });

  it("handles name with only dots", () => {
    expect(sanitizeFilename("...")).toBe("untitled");
  });

  it("handles non-string input gracefully", () => {
    expect(sanitizeFilename(null as unknown as string)).toBe("untitled");
  });

  it("preserves dots that are part of extension", () => {
    expect(sanitizeFilename("my.file.name.jpg")).toBe("my.file.name.jpg");
  });
});

describe("generateSafeName", () => {
  it("returns sanitized name when no conflict", () => {
    const existing = new Set<string>();
    expect(generateSafeName("photo.jpg", existing)).toBe("photo.jpg");
  });

  it("appends -1 when name exists", () => {
    const existing = new Set(["photo.jpg"]);
    expect(generateSafeName("photo.jpg", existing)).toBe("photo-1.jpg");
  });

  it("increments counter until unique name found", () => {
    const existing = new Set(["photo.jpg", "photo-1.jpg", "photo-2.jpg"]);
    expect(generateSafeName("photo.jpg", existing)).toBe("photo-3.jpg");
  });

  it("handles name without extension", () => {
    const existing = new Set(["readme"]);
    expect(generateSafeName("readme", existing)).toBe("readme-1");
  });

  it("sanitizes before checking conflicts", () => {
    const existing = new Set<string>();
    expect(generateSafeName("my<>file.jpg", existing)).toBe("my-file.jpg");
  });

  it("handles empty existing set", () => {
    const existing = new Set<string>();
    expect(generateSafeName("image.png", existing)).toBe("image.png");
  });
});

describe("extractFilenameFromUrl", () => {
  it("extracts filename from simple URL", () => {
    expect(extractFilenameFromUrl("https://example.com/images/photo.jpg")).toBe(
      "photo.jpg"
    );
  });

  it("extracts filename from URL with query params", () => {
    expect(
      extractFilenameFromUrl("https://example.com/img.png?w=200&h=100")
    ).toBe("img.png");
  });

  it("extracts filename from URL with hash", () => {
    expect(extractFilenameFromUrl("https://example.com/img.jpg#section")).toBe(
      "img.jpg"
    );
  });

  it("handles URL-encoded filenames", () => {
    expect(
      extractFilenameFromUrl("https://example.com/%D1%84%D0%BE%D1%82%D0%BE.jpg")
    ).toBe("фото.jpg");
  });

  it("returns untitled for URL with no filename", () => {
    expect(extractFilenameFromUrl("https://example.com/")).toBe("untitled");
  });

  it("returns untitled for URL with trailing slash only", () => {
    expect(extractFilenameFromUrl("https://example.com/path/")).toBe(
      "untitled"
    );
  });

  it("sanitizes non-URL input", () => {
    expect(extractFilenameFromUrl("not a url at all")).toBe("not-a-url-at-all");
  });

  it("handles data URI gracefully", () => {
    expect(extractFilenameFromUrl("data:image/png;base64,abc123")).toBe(
      "untitled"
    );
  });

  it("handles blob URIs", () => {
    expect(extractFilenameFromUrl("blob:https://example.com/uuid-123")).toBe(
      "untitled"
    );
  });

  it("extracts filename from deeply nested path", () => {
    expect(
      extractFilenameFromUrl("https://cdn.example.com/a/b/c/d/image.webp")
    ).toBe("image.webp");
  });

  it("extracts filename from URL with port", () => {
    expect(
      extractFilenameFromUrl("https://example.com:8443/files/doc.pdf")
    ).toBe("doc.pdf");
  });

  it("returns untitled for URL with fragment only on root", () => {
    expect(extractFilenameFromUrl("https://example.com/#section")).toBe(
      "untitled"
    );
  });

  it("extracts filename from URL with very long query string", () => {
    expect(
      extractFilenameFromUrl("https://example.com/photo.jpg?token=abc123&sig=xyz456&expires=9999999")
    ).toBe("photo.jpg");
  });

  it("extracts filename from URL with encoded slashes as decoded last segment", () => {
    const result = extractFilenameFromUrl("https://example.com/path%2Fto%2Ffile.jpg");
    expect(result).toBe("path/to/file.jpg");
  });

  it("returns untitled for hidden file starting with dot", () => {
    expect(extractFilenameFromUrl("https://example.com/.hidden")).toBe(
      "untitled"
    );
  });
});

describe("sanitizeFilename security edge cases", () => {
  it("neutralizes path traversal with backslashes", () => {
    const result = sanitizeFilename("..\\..\\windows\\system32");
    expect(result).not.toContain("\\");
    expect(result).not.toContain("..");
  });

  it("neutralizes mixed path traversal", () => {
    const result = sanitizeFilename("../..\\etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
    expect(result).not.toContain("..");
  });

  it("handles tab characters", () => {
    expect(sanitizeFilename("file\tname.jpg")).toBe("file-name.jpg");
  });

  it("handles newline characters", () => {
    expect(sanitizeFilename("file\nname.jpg")).toBe("file-name.jpg");
  });

  it("handles carriage return characters", () => {
    expect(sanitizeFilename("file\rname.jpg")).toBe("file-name.jpg");
  });

  it("handles names with only underscores after trim", () => {
    const result = sanitizeFilename("_ _ _");
    expect(result).toBe("untitled");
  });

  it("handles names with only dashes", () => {
    expect(sanitizeFilename("---")).toBe("untitled");
  });

  it("handles exclamation marks", () => {
    expect(sanitizeFilename("file!name.jpg")).toBe("file-name.jpg");
  });

  it("handles consecutive special characters", () => {
    const result = sanitizeFilename("file<>?*|name.jpg");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain("?");
    expect(result).not.toContain("*");
    expect(result).not.toContain("|");
  });

  it("handles null byte injection", () => {
    const result = sanitizeFilename("file\x00.jpg");
    expect(result).not.toContain("\x00");
  });

  it("handles name with many consecutive dots", () => {
    const result = sanitizeFilename("file.....name.jpg");
    expect(result).not.toContain("..");
  });

  it("handles very long extension", () => {
    const longExt = "a".repeat(50) + "." + "b".repeat(50);
    const result = sanitizeFilename(longExt);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("preserves hyphens within name", () => {
    expect(sanitizeFilename("my-photo-2026.jpg")).toBe("my-photo-2026.jpg");
  });

  it("preserves underscores within name", () => {
    expect(sanitizeFilename("my_photo_2026.jpg")).toBe("my_photo_2026.jpg");
  });

  it("handles mixed case extension", () => {
    expect(sanitizeFilename("photo.JPG")).toBe("photo.JPG");
  });
});

describe("generateSafeName edge cases", () => {
  it("handles large number of conflicts efficiently", () => {
    const existing = new Set<string>();
    for (let i = 1; i <= 100; i++) {
      existing.add(`photo-${i}.jpg`);
    }
    existing.add("photo.jpg");
    expect(generateSafeName("photo.jpg", existing)).toBe("photo-101.jpg");
  });

  it("handles conflicting name without extension", () => {
    const existing = new Set(["untitled", "untitled-1"]);
    expect(generateSafeName("untitled", existing)).toBe("untitled-2");
  });

  it("handles name where sanitized version conflicts", () => {
    const existing = new Set(["my-file.jpg"]);
    expect(generateSafeName("my<>file.jpg", existing)).toBe("my-file-1.jpg");
  });

  it("handles extension with multiple dots", () => {
    const existing = new Set<string>();
    expect(generateSafeName("archive.tar.gz", existing)).toBe("archive.tar.gz");
  });

  it("handles extension conflict with multiple dots", () => {
    const existing = new Set(["archive.tar.gz"]);
    expect(generateSafeName("archive.tar.gz", existing)).toBe("archive.tar-1.gz");
  });

  it("does not modify the existing names set", () => {
    const existing = new Set(["photo.jpg"]);
    const sizeBefore = existing.size;
    generateSafeName("photo.jpg", existing);
    expect(existing.size).toBe(sizeBefore);
  });
});
