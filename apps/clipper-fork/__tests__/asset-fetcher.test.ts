import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAssets } from "../src/asset-fetcher";
import type { DiscoveredAsset } from "@authclip/shared-types";
import { TraceCollector } from "./trace-collector";

const BASE_ASSET: Omit<DiscoveredAsset, "id" | "url"> = {
  source: "img-src",
  selected: true,
};

function makeAsset(url: string, overrides?: Partial<DiscoveredAsset>): DiscoveredAsset {
  return { id: `asset_${url}`, url, ...BASE_ASSET, ...overrides };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOk(url: string, body: string, contentType = "image/jpeg") {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo) => {
    const requestedUrl = typeof input === "string" ? input : input.url;
    if (requestedUrl === url) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": contentType }),
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      };
    }
    return { ok: false, status: 404, headers: new Headers() };
  });
}

describe("fetchAssets", () => {
  it("fetches a single asset successfully", async () => {
    mockFetchOk("https://example.com/photo.jpg", "hello");
    const result = await fetchAssets([makeAsset("https://example.com/photo.jpg")]);
    expect(result.attachments).toHaveLength(1);
    expect(result.failures).toHaveLength(0);
    const att = result.attachments[0];
    expect(att.originalUrl).toBe("https://example.com/photo.jpg");
    expect(att.mimeType).toBe("image/jpeg");
    expect(att.dataBase64).toBe(btoa("hello"));
    expect(att.suggestedName).toBe("photo.jpg");
  });

  it("handles HTTP error as FETCH_FAILED", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    });
    const result = await fetchAssets([makeAsset("https://example.com/bad.jpg")]);
    expect(result.attachments).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].code).toBe("FETCH_FAILED");
    expect(result.failures[0].message).toBe("HTTP 500");
  });

  it("handles HTTP 403 as FETCH_FORBIDDEN", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
    });
    const result = await fetchAssets([makeAsset("https://example.com/forbidden.jpg")]);
    expect(result.failures[0].code).toBe("FETCH_FORBIDDEN");
  });

  it("handles network error as FETCH_FAILED", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await fetchAssets([makeAsset("https://example.com/down.jpg")]);
    expect(result.failures[0].code).toBe("FETCH_FAILED");
    expect(result.failures[0].message).toBe("Failed to fetch");
  });

  it("handles abort as FETCH_TIMEOUT", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError")
    );
    const result = await fetchAssets([makeAsset("https://example.com/slow.jpg")]);
    expect(result.failures[0].code).toBe("FETCH_TIMEOUT");
  });

  it("skips deselected assets", async () => {
    mockFetchOk("https://example.com/a.jpg", "data");
    const result = await fetchAssets([
      makeAsset("https://example.com/a.jpg"),
      makeAsset("https://example.com/b.jpg", { selected: false }),
    ]);
    expect(result.attachments).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("enforces maxBytes via content-length header", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "2000" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const result = await fetchAssets(
      [makeAsset("https://example.com/big.jpg")],
      { maxBytes: 1000 }
    );
    expect(result.failures[0].code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("enforces maxBytes via actual body size", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(2000),
    });
    const result = await fetchAssets(
      [makeAsset("https://example.com/big.jpg")],
      { maxBytes: 1000 }
    );
    expect(result.failures[0].code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("fetches multiple assets in parallel", async () => {
    const order: string[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      order.push(url);
      await new Promise((r) => setTimeout(r, 10));
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => new TextEncoder().encode("x").buffer,
      };
    });
    const assets = [
      makeAsset("https://example.com/1.png"),
      makeAsset("https://example.com/2.png"),
      makeAsset("https://example.com/3.png"),
    ];
    const result = await fetchAssets(assets, { concurrency: 3 });
    expect(result.attachments).toHaveLength(3);
    expect(result.failures).toHaveLength(0);
  });

  it("mixes successes and failures", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("bad")) {
        return { ok: false, status: 500, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => new TextEncoder().encode("ok").buffer,
      };
    });
    const result = await fetchAssets([
      makeAsset("https://example.com/good.jpg"),
      makeAsset("https://example.com/bad.jpg"),
    ]);
    expect(result.attachments).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
  });

  it("guesses mime type from URL when no content-type header", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new TextEncoder().encode(".").buffer,
    });
    const result = await fetchAssets([makeAsset("https://example.com/icon.svg")]);
    expect(result.attachments[0].mimeType).toBe("image/svg+xml");
  });

  it("uses credentials: include", async () => {
    mockFetchOk("https://example.com/x.jpg", "d");
    await fetchAssets([makeAsset("https://example.com/x.jpg")]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/x.jpg",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("emits BLOCK_FETCH_ASSET marker per asset", async () => {
    mockFetchOk("https://example.com/photo.jpg", "data");
    const trace = new TraceCollector();
    await fetchAssets([makeAsset("https://example.com/photo.jpg")], undefined, trace.log);
    trace.assertMarker("ClipperFork][fetchAssets][BLOCK_FETCH_ASSET");
    trace.assertMarkerContaining("fetched assetId=asset_https://example.com/photo.jpg");
  });

  it("emits FETCH_FORBIDDEN marker for 403", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers(),
    });
    const trace = new TraceCollector();
    await fetchAssets([makeAsset("https://example.com/forbidden.jpg")], undefined, trace.log);
    trace.assertMarkerContaining("FETCH_FORBIDDEN");
  });

  it("emits summary marker with counts", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("bad")) {
        return { ok: false, status: 500, headers: new Headers() };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => new TextEncoder().encode("ok").buffer,
      };
    });
    const trace = new TraceCollector();
    await fetchAssets([
      makeAsset("https://example.com/good.jpg"),
      makeAsset("https://example.com/bad.jpg"),
    ], undefined, trace.log);
    trace.assertMarkerContaining("fetched=1 failed=1");
  });
});
