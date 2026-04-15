import { describe, it, expect } from "vitest";
import { executeClipTransaction } from "../src/clip-transaction";
import type { CapturePackage, ClipSettings } from "@authclip/shared-types";
import { DEFAULT_SETTINGS } from "@authclip/shared-types";
import type { VaultAdapter } from "../src/vault-adapter";
import { TraceCollector } from "./trace-collector";

function makeVault(): {
  vault: VaultAdapter;
  files: Map<string, Uint8Array | string>;
} {
  const files = new Map<string, Uint8Array | string>();
  const vault: VaultAdapter = {
    async writeBinary(path, data) {
      files.set(path, data);
    },
    async writeText(path, data) {
      files.set(path, data);
    },
    async readText(path) {
      const f = files.get(path);
      if (f === undefined) throw new Error(`Not found: ${path}`);
      return typeof f === "string" ? f : new TextDecoder().decode(f);
    },
    async exists(path) {
      return files.has(path);
    },
    async ensureDir() {},
    async listFiles() {
      return Array.from(files.keys());
    },
  };
  return { vault, files };
}

function makePackage(overrides?: Partial<CapturePackage>): CapturePackage {
  return {
    version: "1.0",
    source: {
      url: "https://example.com/article",
      title: "Test Article",
      capturedAt: "2026-04-14T10:00:00Z",
    },
    note: {
      pathHint: "Clippings/2026-04-14 Test-Article.md",
      markdown: "# Test Article\n\nBody ![](https://example.com/img.jpg)\n",
    },
    attachments: [
      {
        id: "att_001",
        originalUrl: "https://example.com/img.jpg",
        mimeType: "image/jpeg",
        suggestedName: "img.jpg",
        dataBase64: Buffer.from("fake-image-data").toString("base64"),
      },
    ],
    linkMap: [
      { from: "https://example.com/img.jpg", attachmentId: "att_001" },
    ],
    options: {
      rewriteMode: "wikilink",
      deduplicate: true,
    },
    ...overrides,
  };
}

describe("executeClipTransaction", () => {
  it("writes attachment and note, returns success", async () => {
    const { vault, files } = makeVault();
    const settings: ClipSettings = { ...DEFAULT_SETTINGS };

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings,
      vault,
    });

    expect(report.status).toBe("success");
    expect(report.notePath).toBe("Clippings/2026-04-14 Test-Article.md");
    expect(report.attachments).toHaveLength(1);
    expect(report.attachments[0].status).toBe("saved");
    expect(report.errors).toHaveLength(0);

    const noteContent = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(noteContent).toContain("![[img.jpg]]");
    expect(noteContent).toContain("---");
    expect(noteContent).toContain("source_title: Test Article");
  });

  it("writes note even when attachment fails", async () => {
    const { vault, files } = makeVault();
    const failingVault: VaultAdapter = {
      ...vault,
      async writeBinary() {
        throw new Error("Write error");
      },
    };

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS },
      vault: failingVault,
    });

    expect(report.status).toBe("partial");
    expect(report.notePath).not.toBeNull();
    expect(report.attachments[0].status).toBe("failed");
    expect(files.has("Clippings/2026-04-14 Test-Article.md")).toBe(true);
  });

  it("handles zero attachments", async () => {
    const { vault, files } = makeVault();

    const report = await executeClipTransaction({
      pkg: makePackage({ attachments: [], linkMap: [] }),
      settings: { ...DEFAULT_SETTINGS },
      vault,
    });

    expect(report.status).toBe("success");
    expect(report.attachments).toHaveLength(0);
    expect(files.has("Clippings/2026-04-14 Test-Article.md")).toBe(true);
  });

  it("uses global attachment folder", async () => {
    const { vault, files } = makeVault();
    const settings: ClipSettings = {
      ...DEFAULT_SETTINGS,
      attachmentFolderStrategy: "global",
      globalAttachmentFolder: "attachments",
    };

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings,
      vault,
    });

    expect(report.status).toBe("success");
    const savedAtt = report.attachments.find((a) => a.status === "saved");
    if (savedAtt && savedAtt.status === "saved") {
      expect(savedAtt.vaultPath).toContain("attachments/");
    }
  });

  it("skips oversized attachments", async () => {
    const { vault } = makeVault();
    const settings: ClipSettings = {
      ...DEFAULT_SETTINGS,
      maxAttachmentBytes: 1,
    };

    const largeB64 = Buffer.from("x".repeat(100)).toString("base64");
    const report = await executeClipTransaction({
      pkg: makePackage({
        attachments: [
          {
            id: "att_big",
            originalUrl: "https://example.com/big.jpg",
            mimeType: "image/jpeg",
            suggestedName: "big.jpg",
            dataBase64: largeB64,
          },
        ],
        linkMap: [{ from: "https://example.com/big.jpg", attachmentId: "att_big" }],
      }),
      settings,
      vault,
    });

    expect(report.status).toBe("success");
    expect(report.attachments[0].status).toBe("skipped");
  });

  it("includes frontmatter with metadata", async () => {
    const { vault, files } = makeVault();

    await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS, keepSourceUrlInFrontmatter: true },
      vault,
    });

    const note = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(note).toContain('source_url: "https://example.com/article"');
    expect(note).toContain("captured_at:");
    expect(note).toContain("clipper_mode: authclip");
    expect(note).toContain("assets_saved: 1");
    expect(note).toContain("assets_failed: 0");
  });

  it("omits source_url when setting disabled", async () => {
    const { vault, files } = makeVault();

    await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS, keepSourceUrlInFrontmatter: false },
      vault,
    });

    const note = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(note).not.toContain("source_url:");
  });

  it("returns failed when note write fails", async () => {
    const { vault } = makeVault();
    const failingVault: VaultAdapter = {
      ...vault,
      async writeText() {
        throw new Error("Cannot write");
      },
    };

    const report = await executeClipTransaction({
      pkg: makePackage({ attachments: [], linkMap: [] }),
      settings: { ...DEFAULT_SETTINGS },
      vault: failingVault,
    });

    expect(report.status).toBe("failed");
    expect(report.notePath).toBeNull();
  });

  it("renames duplicate filenames within same transaction", async () => {
    const { vault, files } = makeVault();
    const b64 = Buffer.from("image-data").toString("base64");

    const report = await executeClipTransaction({
      pkg: makePackage({
        attachments: [
          {
            id: "att_001",
            originalUrl: "https://example.com/img.jpg",
            mimeType: "image/jpeg",
            suggestedName: "img.jpg",
            dataBase64: b64,
          },
          {
            id: "att_002",
            originalUrl: "https://other.com/img.jpg",
            mimeType: "image/jpeg",
            suggestedName: "img.jpg",
            dataBase64: b64,
          },
        ],
        linkMap: [
          { from: "https://example.com/img.jpg", attachmentId: "att_001" },
          { from: "https://other.com/img.jpg", attachmentId: "att_002" },
        ],
      }),
      settings: { ...DEFAULT_SETTINGS },
      vault,
    });

    expect(report.status).toBe("success");
    expect(report.attachments).toHaveLength(2);
    const paths = report.attachments
      .filter((a): a is typeof a & { status: "saved" } => a.status === "saved")
      .map((a) => a.vaultPath);
    expect(new Set(paths).size).toBe(2);
    expect(files.size).toBeGreaterThanOrEqual(3);
  });

  it("handles partial failure with some attachments succeeding", async () => {
    const { vault, files } = makeVault();
    let binaryCallCount = 0;
    const partialVault: VaultAdapter = {
      ...vault,
      async writeBinary(path, data) {
        binaryCallCount++;
        if (binaryCallCount > 1) throw new Error("Disk full after first");
        files.set(path, data);
      },
    };

    const b64 = Buffer.from("data").toString("base64");
    const report = await executeClipTransaction({
      pkg: makePackage({
        attachments: [
          {
            id: "att_001",
            originalUrl: "https://example.com/a.jpg",
            mimeType: "image/jpeg",
            suggestedName: "a.jpg",
            dataBase64: b64,
          },
          {
            id: "att_002",
            originalUrl: "https://example.com/b.jpg",
            mimeType: "image/jpeg",
            suggestedName: "b.jpg",
            dataBase64: b64,
          },
        ],
        linkMap: [
          { from: "https://example.com/a.jpg", attachmentId: "att_001" },
          { from: "https://example.com/b.jpg", attachmentId: "att_002" },
        ],
      }),
      settings: { ...DEFAULT_SETTINGS },
      vault: partialVault,
    });

    expect(report.status).toBe("partial");
    const savedCount = report.attachments.filter((a) => a.status === "saved").length;
    const failedCount = report.attachments.filter((a) => a.status === "failed").length;
    expect(savedCount + failedCount).toBe(2);
    expect(failedCount).toBeGreaterThanOrEqual(1);
    expect(report.notePath).not.toBeNull();
  });

  it("renames attachments when existing files in vault conflict", async () => {
    const { vault, files } = makeVault();
    files.set("Clippings/_assets/2026-04-14 Test-Article/img.jpg", new Uint8Array([0]));

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS },
      vault,
    });

    expect(report.status).toBe("success");
    const saved = report.attachments.find((a) => a.status === "saved");
    expect(saved).toBeDefined();
    if (saved && saved.status === "saved") {
      expect(saved.vaultPath).not.toBe("Clippings/_assets/2026-04-14 Test-Article/img.jpg");
      expect(saved.vaultPath).toContain("img-1.jpg");
    }
  });

  it("rewrites markdown for relative-markdown mode", async () => {
    const { vault, files } = makeVault();

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings: {
        ...DEFAULT_SETTINGS,
        rewriteMode: "relative-markdown",
      },
      vault,
    });

    expect(report.status).toBe("success");
    const noteContent = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(noteContent).toContain("img.jpg");
    expect(noteContent).not.toContain("![[");
  });

  it("handles same-as-note attachment strategy", async () => {
    const { vault, files } = makeVault();

    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings: {
        ...DEFAULT_SETTINGS,
        attachmentFolderStrategy: "same-as-note",
      },
      vault,
    });

    expect(report.status).toBe("success");
    const saved = report.attachments.find((a) => a.status === "saved");
    if (saved && saved.status === "saved") {
      expect(saved.vaultPath).toMatch(/^Clippings\//);
      expect(saved.vaultPath).not.toContain("_assets");
    }
  });

  it("counts assets_saved and assets_failed in frontmatter", async () => {
    const { vault, files } = makeVault();
    const failingVault: VaultAdapter = {
      ...vault,
      async writeBinary() {
        throw new Error("fail");
      },
    };

    const b64 = Buffer.from("data").toString("base64");
    const report = await executeClipTransaction({
      pkg: makePackage({
        attachments: [
          {
            id: "att_001",
            originalUrl: "https://example.com/a.jpg",
            mimeType: "image/jpeg",
            suggestedName: "a.jpg",
            dataBase64: b64,
          },
          {
            id: "att_002",
            originalUrl: "https://example.com/b.jpg",
            mimeType: "image/jpeg",
            suggestedName: "b.jpg",
            dataBase64: b64,
          },
        ],
        linkMap: [
          { from: "https://example.com/a.jpg", attachmentId: "att_001" },
          { from: "https://example.com/b.jpg", attachmentId: "att_002" },
        ],
      }),
      settings: { ...DEFAULT_SETTINGS },
      vault: failingVault,
    });

    expect(report.status).toBe("partial");
    const noteContent = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(noteContent).toContain("assets_saved: 0");
    expect(noteContent).toContain("assets_failed: 2");
  });

  it("handles three attachments with mixed outcomes", async () => {
    const { vault, files } = makeVault();
    let binaryWriteCount = 0;
    const mixedVault: VaultAdapter = {
      ...vault,
      async writeBinary(path, data) {
        binaryWriteCount++;
        if (binaryWriteCount === 2) throw new Error("Second write fails");
        files.set(path, data);
      },
    };

    const b64 = Buffer.from("data").toString("base64");
    const report = await executeClipTransaction({
      pkg: makePackage({
        attachments: [
          {
            id: "att_001",
            originalUrl: "https://example.com/a.jpg",
            mimeType: "image/jpeg",
            suggestedName: "a.jpg",
            dataBase64: b64,
          },
          {
            id: "att_002",
            originalUrl: "https://example.com/b.jpg",
            mimeType: "image/jpeg",
            suggestedName: "b.jpg",
            dataBase64: b64,
          },
          {
            id: "att_003",
            originalUrl: "https://example.com/c.jpg",
            mimeType: "image/jpeg",
            suggestedName: "c.jpg",
            dataBase64: b64,
          },
        ],
        linkMap: [
          { from: "https://example.com/a.jpg", attachmentId: "att_001" },
          { from: "https://example.com/b.jpg", attachmentId: "att_002" },
          { from: "https://example.com/c.jpg", attachmentId: "att_003" },
        ],
        note: {
          pathHint: "Clippings/2026-04-14 Test-Article.md",
          markdown: "# Test\n\n![](https://example.com/a.jpg) ![](https://example.com/b.jpg) ![](https://example.com/c.jpg)\n",
        },
      }),
      settings: { ...DEFAULT_SETTINGS },
      vault: mixedVault,
    });

    expect(report.status).toBe("partial");
    expect(report.attachments.filter((a) => a.status === "saved")).toHaveLength(2);
    expect(report.attachments.filter((a) => a.status === "failed")).toHaveLength(1);
    const noteContent = files.get("Clippings/2026-04-14 Test-Article.md") as string;
    expect(noteContent).toContain("![[a.jpg]]");
    expect(noteContent).toContain("<!-- authclip: failed to localize URL -->");
  });

  it("emits BLOCK_RECEIVE and BLOCK_CREATE_NOTE markers on success", async () => {
    const { vault } = makeVault();
    const trace = new TraceCollector();
    await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS },
      vault,
      log: trace.log,
    });
    trace.assertMarker("ObsidianPlugin][executeClipTransaction][BLOCK_RECEIVE");
    trace.assertMarker("ObsidianPlugin][executeClipTransaction][BLOCK_CREATE_NOTE");
    trace.assertMarker("ObsidianPlugin][writeAttachment][BLOCK_WRITE_FILE");
    trace.assertMarker("ObsidianPlugin][rewriteMarkdown][BLOCK_REWRITE_LINKS");
  });

  it("emits BLOCK_CREATE_NOTE even when attachments fail", async () => {
    const { vault } = makeVault();
    const failingVault: VaultAdapter = {
      ...vault,
      async writeBinary() {
        throw new Error("Write error");
      },
    };
    const trace = new TraceCollector();
    const report = await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS },
      vault: failingVault,
      log: trace.log,
    });
    expect(report.status).toBe("partial");
    trace.assertMarker("ObsidianPlugin][executeClipTransaction][BLOCK_CREATE_NOTE");
    trace.assertMarkerContaining("WRITE_FAILED");
  });

  it("emits BLOCK_RESOLVE_PATH marker", async () => {
    const { vault } = makeVault();
    const trace = new TraceCollector();
    await executeClipTransaction({
      pkg: makePackage(),
      settings: { ...DEFAULT_SETTINGS },
      vault,
      log: trace.log,
    });
    trace.assertMarker("ObsidianPlugin][resolveAttachmentPath][BLOCK_RESOLVE_PATH");
  });
});
