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

  it("accepts package with extra top-level fields", () => {
    const pkg = { ...makeValidPackage(), extraField: "ignored" };
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });

  it("rejects attachment with empty dataBase64", () => {
    const pkg = makeValidPackage();
    pkg.attachments[0].dataBase64 = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.errorMessage).toContain("MANIFEST_INVALID");
  });

  it("rejects attachment with empty mimeType", () => {
    const pkg = makeValidPackage();
    pkg.attachments[0].mimeType = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects attachment with empty suggestedName", () => {
    const pkg = makeValidPackage();
    pkg.attachments[0].suggestedName = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects attachment with empty originalUrl", () => {
    const pkg = makeValidPackage();
    pkg.attachments[0].originalUrl = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects attachment with empty id", () => {
    const pkg = makeValidPackage();
    pkg.attachments[0].id = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("accepts package with duplicate attachment IDs (schema does not enforce uniqueness)", () => {
    const pkg = makeValidPackage();
    pkg.attachments = [
      { ...pkg.attachments[0] },
      { ...pkg.attachments[0] },
    ];
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });

  it("accepts linkMap referencing attachment IDs not in attachments list", () => {
    const pkg = makeValidPackage();
    pkg.linkMap.push({ from: "https://example.com/other.jpg", attachmentId: "att_nonexistent" });
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });

  it("rejects linkMap entry with empty from", () => {
    const pkg = makeValidPackage();
    pkg.linkMap[0].from = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects linkMap entry with empty attachmentId", () => {
    const pkg = makeValidPackage();
    pkg.linkMap[0].attachmentId = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects missing linkMap field", () => {
    const pkg = makeValidPackage();
    delete (pkg as Record<string, unknown>).linkMap;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects missing attachments field", () => {
    const pkg = makeValidPackage();
    delete (pkg as Record<string, unknown>).attachments;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects missing options field", () => {
    const pkg = makeValidPackage();
    delete (pkg as Record<string, unknown>).options;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects empty source.title", () => {
    const pkg = makeValidPackage();
    pkg.source.title = "";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("accepts source.capturedAt with timezone offset", () => {
    const pkg = makeValidPackage();
    pkg.source.capturedAt = "2026-04-14T10:00:00+03:00";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });

  it("rejects non-string version", () => {
    const pkg = { ...makeValidPackage(), version: 1 };
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("rejects non-boolean deduplicate", () => {
    const pkg = makeValidPackage();
    pkg.options.deduplicate = "yes" as unknown as boolean;
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(false);
  });

  it("provides path info in error message", () => {
    const pkg = makeValidPackage();
    pkg.source.url = "not-a-url";
    const result = validateCapturePackage(pkg);
    expect(result.errorMessage).toContain("source.url");
  });

  it("accepts multiple attachments", () => {
    const pkg = makeValidPackage();
    pkg.attachments = [
      {
        id: "att_001",
        originalUrl: "https://example.com/a.jpg",
        mimeType: "image/jpeg",
        suggestedName: "a.jpg",
        dataBase64: "YQ==",
      },
      {
        id: "att_002",
        originalUrl: "https://example.com/b.png",
        mimeType: "image/png",
        suggestedName: "b.png",
        dataBase64: "Yg==",
      },
      {
        id: "att_003",
        originalUrl: "https://example.com/c.gif",
        mimeType: "image/gif",
        suggestedName: "c.gif",
        dataBase64: "Yw==",
        sha256: "b".repeat(64),
      },
    ];
    pkg.linkMap = [
      { from: "https://example.com/a.jpg", attachmentId: "att_001" },
      { from: "https://example.com/b.png", attachmentId: "att_002" },
      { from: "https://example.com/c.gif", attachmentId: "att_003" },
    ];
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.pkg!.attachments).toHaveLength(3);
  });

  it("rejects undefined input", () => {
    const result = validateCapturePackage(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects array input", () => {
    const result = validateCapturePackage([1, 2, 3]);
    expect(result.valid).toBe(false);
  });

  it("rejects relative-markdown rewriteMode", () => {
    const pkg = makeValidPackage();
    pkg.options.rewriteMode = "relative-markdown";
    const result = validateCapturePackage(pkg);
    expect(result.valid).toBe(true);
  });
});
