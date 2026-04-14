import { describe, it, expect } from "vitest";
import {
  resolveNotePath,
  resolveAttachmentDir,
  resolveAttachmentPath,
  joinPosix,
} from "../src/path-resolver";

describe("joinPosix", () => {
  it("joins segments with /", () => {
    expect(joinPosix("a", "b", "c")).toBe("a/b/c");
  });

  it("filters empty segments", () => {
    expect(joinPosix("", "a", "", "b")).toBe("a/b");
  });

  it("collapses double slashes", () => {
    expect(joinPosix("a/", "/b")).toBe("a/b");
  });
});

describe("resolveNotePath", () => {
  it("places note in default folder", () => {
    expect(resolveNotePath("Clippings/2026-04-14 Title.md", "Clippings")).toBe(
      "Clippings/2026-04-14 Title.md"
    );
  });

  it("uses filename from pathHint", () => {
    expect(resolveNotePath("some/deep/path/note.md", "Notes")).toBe("Notes/note.md");
  });
});

describe("resolveAttachmentDir", () => {
  it("same-as-note returns note folder", () => {
    expect(
      resolveAttachmentDir("Clippings/2026-04-14 Title.md", "same-as-note", "_assets", "attachments")
    ).toBe("Clippings");
  });

  it("same-as-note with root-level note returns empty string", () => {
    expect(
      resolveAttachmentDir("note.md", "same-as-note", "_assets", "attachments")
    ).toBe("");
  });

  it("subfolder creates subfolder with note stem", () => {
    expect(
      resolveAttachmentDir(
        "Clippings/2026-04-14 Title.md",
        "subfolder",
        "_assets",
        "attachments"
      )
    ).toBe("Clippings/_assets/2026-04-14 Title");
  });

  it("subfolder with root-level note", () => {
    expect(
      resolveAttachmentDir("note.md", "subfolder", "_assets", "attachments")
    ).toBe("_assets/note");
  });

  it("global returns global folder", () => {
    expect(
      resolveAttachmentDir("Clippings/note.md", "global", "_assets", "attachments")
    ).toBe("attachments");
  });
});

describe("resolveAttachmentPath", () => {
  it("returns path with safe name", () => {
    const existing = new Set<string>();
    expect(resolveAttachmentPath("Clippings/_assets", "photo.jpg", existing)).toBe(
      "Clippings/_assets/photo.jpg"
    );
  });

  it("renames on conflict", () => {
    const existing = new Set(["photo.jpg"]);
    expect(resolveAttachmentPath("Clippings/_assets", "photo.jpg", existing)).toBe(
      "Clippings/_assets/photo-1.jpg"
    );
  });

  it("does not mutate the input set", () => {
    const existing = new Set<string>();
    resolveAttachmentPath("dir", "file.png", existing);
    expect(existing.has("file.png")).toBe(false);
  });
});
