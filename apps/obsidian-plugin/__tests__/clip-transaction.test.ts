import { describe, it, expect } from "vitest";
import { executeClipTransaction } from "../src/clip-transaction";
import type { CapturePackage, ClipSettings } from "@authclip/shared-types";
import { DEFAULT_SETTINGS } from "@authclip/shared-types";
import type { VaultAdapter } from "../src/vault-adapter";

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
});
