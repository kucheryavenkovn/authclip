import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startHttpServer } from "../src/http-server";
import type { ClipSettings } from "@authclip/shared-types";
import { DEFAULT_SETTINGS } from "@authclip/shared-types";
import type { VaultAdapter } from "../src/vault-adapter";

function makeVault(): VaultAdapter {
  const files = new Map<string, Uint8Array | string>();
  return {
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
}

function makePackage() {
  return {
    version: "1.0",
    source: {
      url: "https://example.com/article",
      title: "Test",
      capturedAt: "2026-04-14T10:00:00Z",
    },
    note: {
      pathHint: "Clippings/test.md",
      markdown: "# Test\n",
    },
    attachments: [],
    linkMap: [],
    options: { rewriteMode: "wikilink" as const, deduplicate: true },
  };
}

describe("HTTP server", () => {
  const port = 27199;
  let server: Awaited<ReturnType<typeof startHttpServer>>;

  beforeAll(async () => {
    const settings: ClipSettings = { ...DEFAULT_SETTINGS, port, authToken: "test-secret" };
    server = await startHttpServer(settings, makeVault());
  });

  afterAll(async () => {
    await server.close();
  });

  it("responds to health check", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("rejects missing auth token", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makePackage()),
    });
    expect(res.status).toBe(401);
  });

  it("rejects wrong auth token", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuthClip-Token": "wrong",
      },
      body: JSON.stringify(makePackage()),
    });
    expect(res.status).toBe(401);
  });

  it("accepts valid capture with correct token", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuthClip-Token": "test-secret",
      },
      body: JSON.stringify(makePackage()),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(body.notePath).toBeTruthy();
  });

  it("rejects invalid JSON", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/v1/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AuthClip-Token": "test-secret",
      },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });
});
