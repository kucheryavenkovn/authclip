import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildCapturePackage } from "../src/package-builder";
import type { AttachmentPayload } from "@authclip/shared-types";
import { CapturePackageSchema } from "@authclip/shared-types";

const FIXED_NOW = new Date("2026-04-14T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makePayload(overrides?: Partial<AttachmentPayload>): AttachmentPayload {
  return {
    id: "att_001",
    originalUrl: "https://example.com/img.jpg",
    mimeType: "image/jpeg",
    suggestedName: "img.jpg",
    dataBase64: "dGVzdA==",
    ...overrides,
  };
}

describe("buildCapturePackage", () => {
  it("builds a valid CapturePackage with all required fields", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/article", title: "Test Article" },
      markdown: "# Test\n\nBody text.\n",
      attachments: [makePayload()],
    });

    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);

    expect(pkg.version).toBe("1.0");
    expect(pkg.source.url).toBe("https://example.com/article");
    expect(pkg.source.title).toBe("Test Article");
    expect(pkg.source.capturedAt).toBe("2026-04-14T12:00:00.000Z");
    expect(pkg.note.markdown).toBe("# Test\n\nBody text.\n");
    expect(pkg.attachments).toHaveLength(1);
    expect(pkg.linkMap).toEqual([
      { from: "https://example.com/img.jpg", attachmentId: "att_001" },
    ]);
    expect(pkg.options.rewriteMode).toBe("wikilink");
    expect(pkg.options.deduplicate).toBe(true);
  });

  it("generates pathHint from title and date", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "My Article" },
      markdown: "text",
      attachments: [],
    });
    expect(pkg.note.pathHint).toBe("Clippings/2026-04-14 My-Article.md");
  });

  it("sanitizes title in pathHint", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: 'Bad<>:Name|?.md' },
      markdown: "text",
      attachments: [],
    });
    expect(pkg.note.pathHint).not.toContain("<");
    expect(pkg.note.pathHint).not.toContain(">");
  });

  it("builds linkMap from attachments", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [
        makePayload({ id: "att_1", originalUrl: "https://example.com/a.jpg" }),
        makePayload({ id: "att_2", originalUrl: "https://example.com/b.png" }),
      ],
    });
    expect(pkg.linkMap).toEqual([
      { from: "https://example.com/a.jpg", attachmentId: "att_1" },
      { from: "https://example.com/b.png", attachmentId: "att_2" },
    ]);
  });

  it("defaults rewriteMode to wikilink", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
    });
    expect(pkg.options.rewriteMode).toBe("wikilink");
  });

  it("accepts custom rewriteMode", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
      rewriteMode: "relative-markdown",
    });
    expect(pkg.options.rewriteMode).toBe("relative-markdown");
  });

  it("defaults deduplicate to true", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
    });
    expect(pkg.options.deduplicate).toBe(true);
  });

  it("accepts optional attachmentSubfolder", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
      attachmentSubfolder: "images",
    });
    expect(pkg.options.attachmentSubfolder).toBe("images");
  });

  it("omits attachmentSubfolder when not provided", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
    });
    expect(pkg.options.attachmentSubfolder).toBeUndefined();
  });

  it("accepts optional maxAttachmentBytes", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "text",
      attachments: [],
      maxAttachmentBytes: 10_000_000,
    });
    expect(pkg.options.maxAttachmentBytes).toBe(10_000_000);
  });

  it("handles zero attachments", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "T" },
      markdown: "# No images\n\nText only.",
      attachments: [],
    });
    expect(pkg.attachments).toEqual([]);
    expect(pkg.linkMap).toEqual([]);
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });

  it("produces a package that passes zod validation", () => {
    const pkg = buildCapturePackage({
      source: { url: "https://example.com/a", title: "Full Test" },
      markdown: "# Full Test\n\n![](https://example.com/photo.jpg)\n",
      attachments: [
        makePayload({
          id: "att_photo",
          originalUrl: "https://example.com/photo.jpg",
          suggestedName: "photo.jpg",
        }),
      ],
      rewriteMode: "wikilink",
      deduplicate: true,
      attachmentSubfolder: "_assets",
    });
    const result = CapturePackageSchema.safeParse(pkg);
    expect(result.success).toBe(true);
  });
});
