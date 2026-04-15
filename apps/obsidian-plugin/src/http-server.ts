// FILE: apps/obsidian-plugin/src/http-server.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Localhost HTTP server for receiving CapturePackages from browser extension
//   SCOPE: HTTP server lifecycle, health endpoint, capture endpoint, auth token validation, body size limit
//   DEPENDS: M-SHARED-TYPES (ClipSettings), M-OBSIDIAN-PLUGIN (VaultAdapter, validateCapturePackage, executeClipTransaction)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   HttpServerResult - Server handle with port and close function
//   startHttpServer - Start localhost HTTP server on 127.0.0.1
// END_MODULE_MAP

import type { IncomingMessage, ServerResponse } from "http";
import { createServer } from "http";
import type { ClipSettings } from "@authclip/shared-types";
import { validateCapturePackage } from "./manifest-validator";
import { executeClipTransaction } from "./clip-transaction";
import type { VaultAdapter } from "./vault-adapter";

const MAX_BODY_BYTES = 50 * 1024 * 1024;

export interface HttpServerResult {
  port: number;
  close: () => Promise<void>;
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytesReceived = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: object): void {
  const json = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

export async function startHttpServer(
  settings: ClipSettings,
  vault: VaultAdapter,
  log?: (msg: string) => void
): Promise<HttpServerResult> {
  const logger = log ?? (() => {});

  const server = createServer(async (req, res) => {
    try {
      const url = req.url?.split("?")[0];

      if (url === "/v1/health" && req.method === "GET") {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (url === "/v1/capture" && req.method === "POST") {
        await handleCapture(req, res, settings, vault, logger);
        return;
      }

      sendJson(res, 404, { error: "NOT_FOUND" });
    } catch (err) {
      logger(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
      sendJson(res, 500, {
        version: "1.0",
        status: "failed",
        notePath: null,
        attachments: [],
        errors: [
          {
            code: "WRITE_FAILED",
            message: "Internal server error",
          },
        ],
      });
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(settings.port, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : settings.port;
      logger(`AuthClip HTTP server listening on 127.0.0.1:${port}`);
      resolve({
        port,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
    server.on("error", (err: Error) => {
      reject(err);
    });
  });
}

async function handleCapture(
  req: IncomingMessage,
  res: ServerResponse,
  settings: ClipSettings,
  vault: VaultAdapter,
  logger: (msg: string) => void
): Promise<void> {
  if (settings.authToken) {
    // START_BLOCK_AUTH_CHECK
    const token = req.headers["x-authclip-token"];
    if (token !== settings.authToken) {
      logger(`[ObsidianPlugin][handleCapture][BLOCK_AUTH_CHECK] rejected: invalid auth token`);
      sendJson(res, 401, {
        version: "1.0",
        status: "failed",
        notePath: null,
        attachments: [],
        errors: [{ code: "MANIFEST_INVALID", message: "Invalid auth token" }],
      });
      return;
    }
    logger(`[ObsidianPlugin][handleCapture][BLOCK_AUTH_CHECK] auth token validated`);
    // END_BLOCK_AUTH_CHECK
  }

  let body: string;
  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (err) {
    if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
      sendJson(res, 413, {
        version: "1.0",
        status: "failed",
        notePath: null,
        attachments: [],
        errors: [{ code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds 50 MB limit" }],
      });
      return;
    }
    sendJson(res, 400, {
      version: "1.0",
      status: "failed",
      notePath: null,
      attachments: [],
      errors: [{ code: "MANIFEST_INVALID", message: "Failed to read request body" }],
    });
    return;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    sendJson(res, 400, {
      version: "1.0",
      status: "failed",
      notePath: null,
      attachments: [],
      errors: [{ code: "MANIFEST_INVALID", message: "Invalid JSON" }],
    });
    return;
  }

  const validation = validateCapturePackage(raw, logger);
  if (!validation.valid) {
    const code = validation.errorMessage!.startsWith("MANIFEST_VERSION_MISMATCH")
      ? "MANIFEST_VERSION_MISMATCH"
      : "MANIFEST_INVALID";
    logger(`[ObsidianPlugin][handleCapture][BLOCK_VALIDATE] rejected: ${code}`);
    sendJson(res, 400, {
      version: "1.0",
      status: "failed",
      notePath: null,
      attachments: [],
      errors: [{ code, message: validation.errorMessage! }],
    });
    return;
  }

  const report = await executeClipTransaction({
    pkg: validation.pkg!,
    settings,
    vault,
    log: logger,
  });

  const httpStatus = report.status === "failed" ? 500 : 200;
  logger(`Clip result: ${report.status}, note=${report.notePath}, attachments=${report.attachments.length}`);
  sendJson(res, httpStatus, report);
}
