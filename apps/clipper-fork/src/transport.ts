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

export async function checkHealth(options: TransportOptions): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
    const resp = await fetch(`http://127.0.0.1:${options.port}/v1/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

export async function sendCapturePackage(
  pkg: unknown,
  options: TransportOptions
): Promise<ResultReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (options.authToken) {
      headers["X-AuthClip-Token"] = options.authToken;
    }

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
      throw new TransportError(
        firstError?.message ?? `HTTP ${resp.status}`,
        firstError?.code ?? "PLUGIN_UNAVAILABLE",
        resp.status
      );
    }

    return body as ResultReport;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof TransportError) throw err;
    throw new TransportError(
      err instanceof Error ? err.message : "Unknown transport error",
      "PLUGIN_UNAVAILABLE"
    );
  }
}
