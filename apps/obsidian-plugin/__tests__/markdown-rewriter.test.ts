import { describe, it, expect } from "vitest";
import { rewriteMarkdown } from "../src/markdown-rewriter";
import type { LinkMapEntry, AttachmentStatus } from "@authclip/shared-types";

describe("rewriteMarkdown", () => {
  it("rewrites saved attachment to wikilink", () => {
    const markdown = "![alt](https://example.com/img.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "Clippings/_assets/img.jpg" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toBe("![[img.jpg]]");
    expect(rewriteErrors).toHaveLength(0);
  });

  it("rewrites saved attachment to relative markdown", () => {
    const markdown = "![alt](https://example.com/img.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "Clippings/_assets/img.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "relative-markdown", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toBe("![alt](./_assets/img.jpg)");
  });

  it("leaves deduplicated URLs rewritten", () => {
    const markdown = "![photo](https://example.com/photo.png)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/photo.png", attachmentId: "att_2" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_2", { id: "att_2", status: "deduplicated", vaultPath: "Clippings/_assets/photo.png" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toBe("![[photo.png]]");
  });

  it("adds comment for failed attachments", () => {
    const markdown = "![img](https://example.com/broken.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/broken.jpg", attachmentId: "att_3" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_3", { id: "att_3", status: "failed", code: "WRITE_FAILED", message: "disk error" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toContain("<!-- authclip: failed to localize URL -->");
    expect(result).toContain("https://example.com/broken.jpg");
    expect(rewriteErrors).toHaveLength(1);
  });

  it("leaves unknown URLs untouched", () => {
    const markdown = "![img](https://unknown.com/image.jpg)";
    const linkMap: LinkMapEntry[] = [];
    const results = new Map<string, AttachmentStatus>();

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toBe(markdown);
    expect(rewriteErrors).toHaveLength(0);
  });

  it("rewrites multiple images in one document", () => {
    const markdown = "Text ![](https://a.com/1.jpg) middle ![](https://b.com/2.png) end";
    const linkMap: LinkMapEntry[] = [
      { from: "https://a.com/1.jpg", attachmentId: "a1" },
      { from: "https://b.com/2.png", attachmentId: "b2" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["a1", { id: "a1", status: "saved", vaultPath: "Clippings/_assets/1.jpg" }],
      ["b2", { id: "b2", status: "saved", vaultPath: "Clippings/_assets/2.png" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Clippings/_assets", "Clippings/note.md"
    );

    expect(result).toBe("Text ![[1.jpg]] middle ![[2.png]] end");
  });

  it("handles mixed saved/failed attachments", () => {
    const markdown = "A ![](https://ok.com/a.jpg) B ![](https://fail.com/b.jpg) C";
    const linkMap: LinkMapEntry[] = [
      { from: "https://ok.com/a.jpg", attachmentId: "ok" },
      { from: "https://fail.com/b.jpg", attachmentId: "fail" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["ok", { id: "ok", status: "saved", vaultPath: "assets/a.jpg" }],
      ["fail", { id: "fail", status: "failed", code: "WRITE_FAILED", message: "err" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "Clippings/note.md"
    );

    expect(result).toContain("![[a.jpg]]");
    expect(result).toContain("https://fail.com/b.jpg");
    expect(result).toContain("<!-- authclip: failed to localize URL -->");
    expect(rewriteErrors).toHaveLength(1);
  });
});
