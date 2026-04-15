// FILE: apps/clipper-fork/src/transport.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: HTTP transport client for sending CapturePackages to Obsidian plugin
//   SCOPE: Health check, capture POST, auth token header, timeout handling, error classification
//   DEPENDS: M-SHARED-TYPES (ResultReport)
//   LINKS: M-CLIPPER-FORK
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   TransportOptions - HTTP config: port, authToken, timeoutMs
//   TransportError - Error class with code and statusCode
//   checkHealth - GET /v1/health to check plugin availability
//   sendCapturePackage - POST CapturePackage to /v1/capture
// END_MODULE_MAP

import type { ResultReport } from "@authclip/shared-types";

export interface TransportOptions {
  port: number;
  authToken?: string;
  timeoutMs?: number;
}

export class TransportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "TransportError";
  }
}

// START_CONTRACT: checkHealth
//   PURPOSE: Check if Obsidian plugin is reachable
//   INPUTS: { options: TransportOptions }
//   OUTPUTS: { boolean - true if plugin responds 200 }
//   SIDE_EFFECTS: Network request
//   LINKS: M-CLIPPER-FORK
// END_CONTRACT: checkHealth
export async function checkHealth(options: TransportOptions, log?: (msg: string) => void): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
    const resp = await fetch(`http://127.0.0.1:${options.port}/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ok = resp.ok;
    log?.(`[ClipperFork][checkHealth][BLOCK_TRANSPORT] health=${ok} port=${options.port}`);
    return ok;
  } catch {
    log?.(`[ClipperFork][checkHealth][BLOCK_TRANSPORT] health=false port=${options.port}`);
    return false;
  }
}

// START_CONTRACT: sendCapturePackage
//   PURPOSE: POST CapturePackage to Obsidian plugin and return ResultReport
//   INPUTS: { pkg: unknown, options: TransportOptions }
//   OUTPUTS: { ResultReport - plugin response }
//   SIDE_EFFECTS: Network request with optional auth token header
//   LINKS: M-CLIPPER-FORK
// END_CONTRACT: sendCapturePackage
export async function sendCapturePackage(
  pkg: unknown,
  options: TransportOptions,
  log?: (msg: string) => void
): Promise<ResultReport> {
  // START_BLOCK_TRANSPORT
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.authToken) {
      headers["X-AuthClip-Token"] = options.authToken;
    }

    log?.(`[ClipperFork][sendCapturePackage][BLOCK_TRANSPORT] sending to port=${options.port} hasAuth=${!!options.authToken}`);

    const resp = await fetch(`http://127.0.0.1:${options.port}/v1/capture`, {
      method: "POST",
      headers,
      body: JSON.stringify(pkg),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const body = await resp.json();

    if (!resp.ok) {
      const errorReport = body as ResultReport;
      const firstError = errorReport.errors?.[0];
      const code = firstError?.code ?? "PLUGIN_UNAVAILABLE";
      log?.(`[ClipperFork][sendCapturePackage][BLOCK_TRANSPORT] HTTP ${resp.status} code=${code}`);
      throw new TransportError(
        firstError?.message ?? `HTTP ${resp.status}`,
        code,
        resp.status
      );
    }

    log?.(`[ClipperFork][sendCapturePackage][BLOCK_TRANSPORT] success status=${(body as ResultReport).status}`);
    return body as ResultReport;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof TransportError) throw err;
    log?.(`[ClipperFork][sendCapturePackage][BLOCK_TRANSPORT] PLUGIN_UNAVAILABLE`);
    throw new TransportError(
      err instanceof Error ? err.message : "Unknown transport error",
      "PLUGIN_UNAVAILABLE"
    );
  }
  // END_BLOCK_TRANSPORT
}
