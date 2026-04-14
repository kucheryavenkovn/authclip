import { describe, it, expect } from "vitest";
import { validateCapturePackage } from "../src/manifest-validator";

describe("validateCapturePackage", () => {
  function makeValidPackage() {
    return {
      version: "1.0",
      source: {
        url: "https://example.com/article",
        title: "Test Article",
        capturedAt: "2026-04-14T10:00:00Z",
      },
      note: {
        pathHint: "Clippings/test.md",
        markdown: "# Test\n\n![](https://example.com/img.jpg)\n",
      },
      attachments: [
        {
          id: "att_001",
          originalUrl: "https://example.com/img.jpg",
          mimeType: "image/jpeg",
          suggestedName: "img.jpg",
          dataBase64: "dGVzdA==",
        },
      ],
      linkMap: [
        { from: "https://example.com/img.jpg", attachmentId: "att_001" },
      ],
      options: {
        rewriteMode: "wikilink",
        deduplicate: true,
      },
    };
  }

  it("accepts a valid package", () => {
    const result = validateCapturePackage(makeValidPackage());
    expect(result.valid).toBe(true);
    expect(result.pkg).not.toBeNull();
    expect(result.errorMessage).toBeNull();
  });

  it("rejects missing version", () => {
    const pkg = makeValidPackage();
    delete (pkg as Record<string, unknown>).version;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("MANIFEST_INVALID");
  });

  it("rejects wrong major version", () => {
    const pkg = { ...makeValidPackage(), version: "2.0" };
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("MANIFEST_VERSION_MISMATCH");
  });

  it("rejects missing source", () => {
    const pkg = makeValidPackage();
    delete (pkg as Record<string, unknown>).source;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid source.url", () => {
    const pkg = makeValidPackage();
    pkg.source.url = "not-a-url";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects missing note.markdown", () => {
    const pkg = makeValidPackage();
    pkg.note.markdown = undefined as unknown as string;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects empty attachments array is fine", () => {
    const pkg = makeValidPackage();
    pkg.attachments = [];
    pkg.linkMap = [];
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });

  it("rejects invalid rewriteMode", () => {
    const pkg = makeValidPackage();
    pkg.options.rewriteMode = "html" as "wikilink";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects non-object input", () => {
    const result = validateCapturePackage("not json");
    expect(result.valid).toBe(false);
  });

  it("rejects null input", () => {
    const result = validateCapturePackage(null);
    expect(result.valid).toBe(false);
  });
});
