import { describe, it, expect, beforeEach } from "vitest";
import { discoverAssets, parseSrcset, resetIdCounter } from "../src/asset-discovery";

const BASE = "https://example.com/article/123";

function makeDoc(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(`<html><body>${html}</body></html>`, "text/html");
}

beforeEach(() => resetIdCounter());

describe("parseSrcset", () => {
  it("parses single URL", () => {
    expect(parseSrcset("img.jpg")).toEqual(["img.jpg"]);
  });

  it("parses URL with width descriptor", () => {
    expect(parseSrcset("img.jpg 800w")).toEqual(["img.jpg"]);
  });

  it("parses multiple entries", () => {
    expect(parseSrcset("small.jpg 400w, large.jpg 800w")).toEqual([
      "small.jpg",
      "large.jpg",
    ]);
  });

  it("parses URLs with density descriptor", () => {
    expect(parseSrcset("img.png 1x, img-2x.png 2x")).toEqual([
      "img.png",
      "img-2x.png",
    ]);
  });

  it("handles trailing comma", () => {
    expect(parseSrcset("a.jpg 100w, ")).toEqual(["a.jpg"]);
  });

  it("returns empty for empty string", () => {
    expect(parseSrcset("")).toEqual([]);
  });
});

describe("discoverAssets", () => {
  it("discovers img[src]", () => {
    const doc = makeDoc(`<img src="https://example.com/photo.jpg">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      url: "https://example.com/photo.jpg",
      source: "img-src",
      selected: true,
    });
    expect(assets[0].id).toMatch(/^asset_\d+$/);
  });

  it("discovers relative img[src] resolved against base", () => {
    const doc = makeDoc(`<img src="/images/photo.png">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(1);
    expect(assets[0].url).toBe("https://example.com/images/photo.png");
    expect(assets[0].source).toBe("img-src");
  });

  it("discovers img[srcset] URLs", () => {
    const doc = makeDoc(`<img srcset="sm.jpg 400w, lg.jpg 800w">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(2);
    expect(assets.map((a) => a.url)).toEqual([
      "https://example.com/article/sm.jpg",
      "https://example.com/article/lg.jpg",
    ]);
    expect(assets.every((a) => a.source === "img-srcset")).toBe(true);
  });

  it("discovers picture source[srcset] URLs", () => {
    const doc = makeDoc(`
      <picture>
        <source srcset="desktop.webp 1200w" media="(min-width: 800px)">
        <img src="mobile.jpg">
      </picture>
    `);
    const assets = discoverAssets(doc.body, BASE);
    const urls = assets.map((a) => a.url);
    expect(urls).toContain("https://example.com/article/desktop.webp");
    expect(urls).toContain("https://example.com/article/mobile.jpg");
    expect(assets.find((a) => a.url.endsWith("desktop.webp"))!.source).toBe(
      "picture-srcset"
    );
  });

  it("deduplicates by URL", () => {
    const doc = makeDoc(`
      <img src="photo.jpg">
      <img src="photo.jpg">
      <img srcset="photo.jpg 800w">
    `);
    const assets = discoverAssets(doc.body, BASE);
    const photoUrls = assets.filter((a) => a.url.endsWith("/photo.jpg"));
    expect(photoUrls).toHaveLength(1);
  });

  it("skips empty src", () => {
    const doc = makeDoc(`<img src="">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(0);
  });

  it("skips whitespace-only src", () => {
    const doc = makeDoc(`<img src="   ">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(0);
  });

  it("skips unresolvable URLs", () => {
    const doc = makeDoc(`<img src="http://[invalid">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(0);
  });

  it("returns empty for DOM with no images", () => {
    const doc = makeDoc(`<p>Just text</p>`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(0);
  });

  it("handles data: URIs", () => {
    const doc = makeDoc(`<img src="data:image/png;base64,abc123">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(1);
    expect(assets[0].url).toBe("data:image/png;base64,abc123");
  });

  it("handles blob: URIs", () => {
    const doc = makeDoc(`<img src="blob:https://example.com/abc-123">`);
    const assets = discoverAssets(doc.body, BASE);
    expect(assets).toHaveLength(1);
    expect(assets[0].url).toBe("blob:https://example.com/abc-123");
  });

  it("assigns sequential IDs", () => {
    const doc = makeDoc(`
      <img src="a.jpg">
      <img src="b.jpg">
      <img src="c.jpg">
    `);
    const assets = discoverAssets(doc.body, BASE);
    const ids = assets.map((a) => a.id);
    expect(ids).toEqual(["asset_1", "asset_2", "asset_3"]);
  });

  it("scans only within provided root", () => {
    const doc = makeDoc(`
      <div id="article"><img src="inside.jpg"></div>
      <div id="sidebar"><img src="outside.jpg"></div>
    `);
    const root = doc.getElementById("article")!;
    const assets = discoverAssets(root, BASE);
    expect(assets).toHaveLength(1);
    expect(assets[0].url).toContain("inside.jpg");
  });
});
