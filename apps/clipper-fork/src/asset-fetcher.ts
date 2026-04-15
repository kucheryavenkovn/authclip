// FILE: apps/clipper-fork/src/asset-fetcher.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Download selected assets in browser session context with concurrency, timeout, and size limits
//   SCOPE: Concurrent asset fetching, base64 encoding, MIME detection, error classification
//   DEPENDS: M-SHARED-TYPES (DiscoveredAsset, AttachmentPayload, ClipErrorCode, extractFilenameFromUrl, sanitizeFilename)
//   LINKS: M-CLIPPER-FORK
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   FetchFailure - Single fetch failure record
//   FetchResult - Outcome: attachments[] + failures[]
//   FetchOptions - Config: concurrency, maxBytes, timeoutMs
//   fetchAssets - Download selected assets concurrently
// END_MODULE_MAP

import type { DiscoveredAsset, AttachmentPayload, ClipErrorCode } from "@authclip/shared-types";
import { extractFilenameFromUrl, sanitizeFilename } from "@authclip/shared-types";

export interface FetchFailure {
  assetId: string;
  url: string;
  code: ClipErrorCode;
  message: string;
}

export interface FetchResult {
  attachments: AttachmentPayload[];
  failures: FetchFailure[];
}

export interface FetchOptions {
  concurrency?: number;
  maxBytes?: number;
  timeoutMs?: number;
}

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 30_000;
const MIME_FALLBACK = "application/octet-stream";

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function guessMime(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot >= 0) {
      const ext = pathname.slice(dot).toLowerCase();
      return EXT_MIME[ext] ?? MIME_FALLBACK;
    }
  } catch {}
  return MIME_FALLBACK;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

async function fetchSingle(
  asset: DiscoveredAsset,
  timeoutMs: number,
  maxBytes: number | undefined
): Promise<{ payload: AttachmentPayload } | { failure: FetchFailure }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(asset.url, {
      credentials: "include",
      signal: controller.signal,
    });

    if (!resp.ok) {
      const code: ClipErrorCode = resp.status === 403 ? "FETCH_FORBIDDEN" : "FETCH_FAILED";
      return {
        failure: {
          assetId: asset.id,
          url: asset.url,
          code,
          message: `HTTP ${resp.status}`,
        },
      };
    }

    const contentLength = resp.headers.get("content-length");
    if (maxBytes && contentLength && Number(contentLength) > maxBytes) {
      return {
        failure: {
          assetId: asset.id,
          url: asset.url,
          code: "PAYLOAD_TOO_LARGE",
          message: `Content-Length ${contentLength} exceeds max ${maxBytes}`,
        },
      };
    }

    const buffer = await resp.arrayBuffer();

    if (maxBytes && buffer.byteLength > maxBytes) {
      return {
        failure: {
          assetId: asset.id,
          url: asset.url,
          code: "PAYLOAD_TOO_LARGE",
          message: `Body size ${buffer.byteLength} exceeds max ${maxBytes}`,
        },
      };
    }

    const contentType = resp.headers.get("content-type");
    const mimeType = contentType?.split(";")[0]?.trim() || guessMime(asset.url);
    const suggestedName = sanitizeFilename(extractFilenameFromUrl(asset.url));

    return {
      payload: {
        id: asset.id,
        originalUrl: asset.url,
        mimeType,
        suggestedName,
        dataBase64: arrayBufferToBase64(buffer),
      },
    };
  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    return {
      failure: {
        assetId: asset.id,
        url: asset.url,
        code: isAbort ? "FETCH_TIMEOUT" : "FETCH_FAILED",
        message: err instanceof Error ? err.message : "Unknown error",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// START_CONTRACT: fetchAssets
//   PURPOSE: Download selected assets concurrently with timeout and size limits
//   INPUTS: { assets: DiscoveredAsset[], options: FetchOptions }
//   OUTPUTS: { FetchResult - attachments + failures }
//   SIDE_EFFECTS: Network requests with credentials: include
//   LINKS: M-SHARED-TYPES
// END_CONTRACT: fetchAssets
export async function fetchAssets(
  assets: DiscoveredAsset[],
  options?: FetchOptions,
  log?: (msg: string) => void
): Promise<FetchResult> {
  // START_BLOCK_FETCH_ASSET
  const selected = assets.filter((a) => a.selected);
  const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options?.maxBytes;

  const attachments: AttachmentPayload[] = [];
  const failures: FetchFailure[] = [];

  const queue = [...selected];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < queue.length) {
      const current = queue[index++];
      if (!current) break;
      const result = await fetchSingle(current, timeoutMs, maxBytes);
      if ("payload" in result) {
        attachments.push(result.payload);
        log?.(`[ClipperFork][fetchAssets][BLOCK_FETCH_ASSET] fetched assetId=${current.id}`);
      } else {
        failures.push(result.failure);
        log?.(`[ClipperFork][fetchAssets][BLOCK_FETCH_ASSET] ${result.failure.code} assetId=${current.id}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, selected.length) }, () => worker());
  await Promise.all(workers);

  log?.(`[ClipperFork][fetchAssets][BLOCK_FETCH_ASSET] completed fetched=${attachments.length} failed=${failures.length}`);
  return { attachments, failures };
  // END_BLOCK_FETCH_ASSET
}
