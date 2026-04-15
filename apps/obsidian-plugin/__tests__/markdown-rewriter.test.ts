import { describe, it, expect } from "vitest";
import { rewriteMarkdown } from "../src/markdown-rewriter";
import type { LinkMapEntry, AttachmentStatus } from "@authclip/shared-types";
import { TraceCollector } from "./trace-collector";

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

  it("leaves skipped attachments untouched", () => {
    const markdown = "![img](https://example.com/skip.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/skip.jpg", attachmentId: "skip" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["skip", { id: "skip", status: "skipped" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "Clippings/note.md"
    );

    expect(result).toBe("![img](https://example.com/skip.jpg)");
    expect(rewriteErrors).toHaveLength(0);
  });

  it("returns empty markdown unchanged", () => {
    const markdown = "";
    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, [], new Map(), "wikilink", "assets", "note.md"
    );
    expect(result).toBe("");
    expect(rewriteErrors).toHaveLength(0);
  });

  it("handles markdown with no images", () => {
    const markdown = "# Title\n\nJust text with **bold** and *italic*.\n";
    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, [], new Map(), "wikilink", "assets", "note.md"
    );
    expect(result).toBe(markdown);
    expect(rewriteErrors).toHaveLength(0);
  });

  it("rewrites same URL appearing multiple times", () => {
    const markdown = "A ![](https://example.com/img.jpg) B ![](https://example.com/img.jpg) C";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "assets/img.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(result).toBe("A ![[img.jpg]] B ![[img.jpg]] C");
  });

  it("preserves alt text in relative-markdown mode", () => {
    const markdown = "![My Photo](https://example.com/photo.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/photo.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "assets/photo.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "relative-markdown", "assets", "note.md"
    );

    expect(result).toBe("![My Photo](./assets/photo.jpg)");
  });

  it("computes relative path for nested note directory", () => {
    const markdown = "![img](https://example.com/img.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "attachments/img.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "relative-markdown", "attachments", "Notes/Projects/note.md"
    );

    expect(result).toBe("![img](../../attachments/img.jpg)");
  });

  it("computes relative path for root-level note", () => {
    const markdown = "![img](https://example.com/img.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "assets/img.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "relative-markdown", "assets", "note.md"
    );

    expect(result).toBe("![img](./assets/img.jpg)");
  });

  it("ignores linkMap entries with no matching attachment result", () => {
    const markdown = "![img](https://example.com/orphan.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/orphan.jpg", attachmentId: "orphan" },
    ];
    const results = new Map<string, AttachmentStatus>();

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(result).toBe(markdown);
    expect(rewriteErrors).toHaveLength(0);
  });

  it("handles URL with surrounding whitespace in markdown", () => {
    const markdown = "![img]( https://example.com/img.jpg )";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "assets/img.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(result).toBe("![[img.jpg]]");
  });

  it("handles multiple failures with correct error count", () => {
    const markdown = "A ![](https://x.com/1.jpg) B ![](https://x.com/2.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://x.com/1.jpg", attachmentId: "a1" },
      { from: "https://x.com/2.jpg", attachmentId: "a2" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["a1", { id: "a1", status: "failed", code: "WRITE_FAILED", message: "err1" }],
      ["a2", { id: "a2", status: "failed", code: "FETCH_FAILED", message: "err2" }],
    ]);

    const { rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(rewriteErrors).toHaveLength(2);
    expect(rewriteErrors[0].reason).toContain("WRITE_FAILED");
    expect(rewriteErrors[1].reason).toContain("FETCH_FAILED");
  });

  it("extracts filename from nested vaultPath for wikilink", () => {
    const markdown = "![img](https://example.com/img.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/img.jpg", attachmentId: "att_1" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_1", { id: "att_1", status: "saved", vaultPath: "Notes/Projects/_assets/my-image.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "Notes/Projects/_assets", "Notes/Projects/note.md"
    );

    expect(result).toBe("![[my-image.jpg]]");
  });

  it("handles deduplicated status same as saved for wikilink", () => {
    const markdown = "![x](https://example.com/dup.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/dup.jpg", attachmentId: "att_d" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_d", { id: "att_d", status: "deduplicated", vaultPath: "global/existing.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "global", "note.md"
    );

    expect(result).toBe("![[existing.jpg]]");
  });

  it("handles deduplicated status same as saved for relative-markdown", () => {
    const markdown = "![x](https://example.com/dup.jpg)";
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/dup.jpg", attachmentId: "att_d" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_d", { id: "att_d", status: "deduplicated", vaultPath: "global/existing.jpg" }],
    ]);

    const { markdown: result } = rewriteMarkdown(
      markdown, linkMap, results, "relative-markdown", "global", "note.md"
    );

    expect(result).toContain("existing.jpg");
  });

  it("rewrites HTML img tags to wikilinks", () => {
    const markdown = '<img src="https://example.com/html-img.jpg" alt="Photo">';
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/html-img.jpg", attachmentId: "att_html" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_html", { id: "att_html", status: "saved", vaultPath: "assets/html-img.jpg" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(result).toBe("![[html-img.jpg]]");
    expect(rewriteErrors).toHaveLength(0);
  });

  it("removes HTML img tags for failed attachments", () => {
    const markdown = '<img src="https://example.com/fail.jpg" alt="Fail">';
    const linkMap: LinkMapEntry[] = [
      { from: "https://example.com/fail.jpg", attachmentId: "att_fail" },
    ];
    const results = new Map<string, AttachmentStatus>([
      ["att_fail", { id: "att_fail", status: "failed", code: "FETCH_FAILED", message: "timeout" }],
    ]);

    const { markdown: result, rewriteErrors } = rewriteMarkdown(
      markdown, linkMap, results, "wikilink", "assets", "note.md"
    );

    expect(result).toBe("");
    expect(rewriteErrors).toHaveLength(1);
  });

  it("emits BLOCK_REWRITE_LINKS marker with mode and error count", () => {
    const trace = new TraceCollector();
    rewriteMarkdown(
      "plain text", [], new Map(), "wikilink", "assets", "note.md", trace.log
    );
    trace.assertMarker("ObsidianPlugin][rewriteMarkdown][BLOCK_REWRITE_LINKS");
    trace.assertMarkerContaining("mode=wikilink");
    trace.assertMarkerContaining("errors=0");
  });
});
