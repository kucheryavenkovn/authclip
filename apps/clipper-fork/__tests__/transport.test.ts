import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sendCapturePackage, checkHealth, TransportError } from "../src/transport";
import type { ResultReport } from "@authclip/shared-types";
import { TraceCollector } from "./trace-collector";

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";

function startMockServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function jsonRes(res: ServerResponse, status: number, body: object) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

describe("checkHealth", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const s = await startMockServer((_req, res) => {
      jsonRes(res, 200, { status: "ok" });
    });
    server = s.server;
    port = s.port;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("returns true for running server", async () => {
    const trace = new TraceCollector();
    const result = await checkHealth({ port }, trace.log);
    expect(result).toBe(true);
    trace.assertMarker("ClipperFork][checkHealth][BLOCK_TRANSPORT");
  });

  it("returns false for offline server", async () => {
    const trace = new TraceCollector();
    const result = await checkHealth({ port: 59999 }, trace.log);
    expect(result).toBe(false);
    trace.assertMarker("ClipperFork][checkHealth][BLOCK_TRANSPORT");
  });
});

describe("sendCapturePackage", () => {
  let server: Server;
  let port: number;

  beforeAll(async () => {
    const s = await startMockServer((req, res) => {
      if (req.url === "/v1/capture" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk: string) => { body += chunk; });
        req.on("end", () => {
          const parsed = JSON.parse(body);
          if (req.headers["x-authclip-token"] === "valid-token") {
            const report: ResultReport = {
              version: "1.0",
              status: "success",
              notePath: "Clippings/test.md",
              attachments: [],
              errors: [],
            };
            jsonRes(res, 200, report);
          } else if (req.headers["x-authclip-token"] === undefined && parsed._noAuth) {
            const report: ResultReport = {
              version: "1.0",
              status: "success",
              notePath: "Clippings/test.md",
              attachments: [],
              errors: [],
            };
            jsonRes(res, 200, report);
          } else {
            jsonRes(res, 401, {
              version: "1.0",
              status: "failed",
              notePath: null,
              attachments: [],
              errors: [{ code: "MANIFEST_INVALID", message: "Invalid auth token" }],
            });
          }
        });
      } else if (req.url === "/v1/health") {
        jsonRes(res, 200, { status: "ok" });
      } else {
        jsonRes(res, 404, { error: "NOT_FOUND" });
      }
    });
    server = s.server;
    port = s.port;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("POSTs package and returns ResultReport", async () => {
    const trace = new TraceCollector();
    const pkg = { version: "1.0", _noAuth: true };
    const result = await sendCapturePackage(pkg, { port, authToken: undefined }, trace.log);
    expect(result.status).toBe("success");
    expect(result.notePath).toBe("Clippings/test.md");
    trace.assertMarker("ClipperFork][sendCapturePackage][BLOCK_TRANSPORT");
    trace.assertMarkerContaining("success");
  });

  it("sends auth header when provided", async () => {
    const trace = new TraceCollector();
    const pkg = { version: "1.0" };
    const result = await sendCapturePackage(pkg, { port, authToken: "valid-token" }, trace.log);
    expect(result.status).toBe("success");
    trace.assertMarkerContaining("hasAuth=true");
  });

  it("throws TransportError on auth failure", async () => {
    const trace = new TraceCollector();
    const pkg = { version: "1.0" };
    try {
      await sendCapturePackage(pkg, { port, authToken: "bad-token" }, trace.log);
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TransportError);
      expect((err as TransportError).code).toBe("MANIFEST_INVALID");
      expect((err as TransportError).statusCode).toBe(401);
    }
    trace.assertMarkerContaining("HTTP 401");
  });

  it("throws TransportError(PLUGIN_UNAVAILABLE) on offline server", async () => {
    const trace = new TraceCollector();
    const pkg = { version: "1.0" };
    try {
      await sendCapturePackage(pkg, { port: 59999, timeoutMs: 1000 }, trace.log);
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TransportError);
      expect((err as TransportError).code).toBe("PLUGIN_UNAVAILABLE");
    }
    trace.assertMarkerContaining("PLUGIN_UNAVAILABLE");
  });

  it("does not log auth token values in trace", async () => {
    const trace = new TraceCollector();
    const pkg = { version: "1.0" };
    try {
      await sendCapturePackage(pkg, { port, authToken: "super-secret-value-12345" }, trace.log);
    } catch {}
    trace.assertNoMarkerContaining("super-secret-value-12345");
    trace.assertNoSecrets();
  });
});
