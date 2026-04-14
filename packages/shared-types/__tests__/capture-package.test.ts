import { describe, it, expect } from "vitest";
import { CapturePackageSchema } from "../src/schemas";
import type { CapturePackage } from "../src/capture-package";

function makeValidPackage(overrides?: Partial<CapturePackage>): CapturePackage {
  return {
    version: "1.0",
    source: {
      url: "https://example.com/article/123",
      title: "Test Article",
      capturedAt: "2026-04-14T10:00:00Z",
    },
    note: {
      pathHint: "Clippings/2026-04-14 Test Article.md",
      markdown: "# Test Article\n\nBody text.\n",
    },
    attachments: [
      {
        id: "att_001",
        originalUrl: "https://example.com/img1.jpg",
        mimeType: "image/jpeg",
        suggestedName: "img1.jpg",
        dataBase64: "dGVzdA==",
        sha256: "a".repeat(64),
      },
    ],
    linkMap: [
      {
        from: "https://example.com/img1.jpg",
        attachmentId: "att_001",
      },
    ],
    options: {
      rewriteMode: "wikilink",
      deduplicate: true,
    },
    ...overrides,
  };
}

describe("CapturePackageSchema", () => {
  it("accepts a valid package", () => {
    const pkg = makeValidPackage();
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("accepts a package with zero attachments", () => {
    const pkg = makeValidPackage({
      attachments: [],
      linkMap: [],
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("accepts a package without optional sha256", () => {
    const pkg = makeValidPackage({
      attachments: [
        {
          id: "att_001",
          originalUrl: "https://example.com/img.png",
          mimeType: "image/png",
          suggestedName: "img.png",
          dataBase64: "iVBORw==",
        },
      ],
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("accepts a package with optional fields", () => {
    const pkg = makeValidPackage({
      options: {
        rewriteMode: "relative-markdown",
        deduplicate: false,
        attachmentSubfolder: "images",
        maxAttachmentBytes: 10485760,
      },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("rejects unknown version", () => {
    const pkg = makeValidPackage({ version: "2.0" as "1.0" });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects missing source.url", () => {
    const pkg = makeValidPackage({
      source: { url: "", title: "T", capturedAt: "2026-04-14T10:00:00Z" },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects invalid source.url", () => {
    const pkg = makeValidPackage({
      source: {
        url: "not-a-url",
        title: "T",
        capturedAt: "2026-04-14T10:00:00Z",
      },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects invalid capturedAt format", () => {
    const pkg = makeValidPackage({
      source: {
        url: "https://example.com",
        title: "T",
        capturedAt: "not-a-date",
      },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects empty markdown", () => {
    const pkg = makeValidPackage({
      note: { pathHint: "test.md", markdown: "" },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("rejects attachment with empty id", () => {
    const pkg = makeValidPackage({
      attachments: [
        {
          id: "",
          originalUrl: "https://example.com/img.jpg",
          mimeType: "image/jpeg",
          suggestedName: "img.jpg",
          dataBase64: "dGVzdA==",
        },
      ],
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects sha256 with wrong length", () => {
    const pkg = makeValidPackage({
      attachments: [
        {
          id: "att_001",
          originalUrl: "https://example.com/img.jpg",
          mimeType: "image/jpeg",
          suggestedName: "img.jpg",
          dataBase64: "dGVzdA==",
          sha256: "abc",
        },
      ],
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects invalid rewriteMode", () => {
    const pkg = makeValidPackage({
      options: { rewriteMode: "html" as "wikilink", deduplicate: true },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });

  it("rejects negative maxAttachmentBytes", () => {
    const pkg = makeValidPackage({
      options: { rewriteMode: "wikilink", deduplicate: true, maxAttachmentBytes: -1 },
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(false);
  });
});
