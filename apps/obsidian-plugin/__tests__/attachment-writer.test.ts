import { describe, it, expect, vi } from "vitest";
import { writeAttachment } from "../src/attachment-writer";
import type { AttachmentPayload } from "@authclip/shared-types";
import type { VaultAdapter } from "../src/vault-adapter";

function makeAttachment(overrides?: Partial<AttachmentPayload>): AttachmentPayload {
  return {
    id: "att_001",
    originalUrl: "https://example.com/img.jpg",
    mimeType: "image/jpeg",
    suggestedName: "img.jpg",
    dataBase64: "dGVzdA==",
    ...overrides,
  };
}

function makeVault(files: Map<string, Uint8Array | string> = new Map()): VaultAdapter {
  return {
    async writeBinary(path, data) {
      files.set(path, data);
    },
    async writeText(path, data) {
      files.set(path, data);
    },
    async readText(path) {
      const f = files.get(path);
      if (f === undefined) throw new Error(`File not found: ${path}`);
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

describe("writeAttachment", () => {
  it("writes attachment and returns saved status", async () => {
    const vault = makeVault();
    const attachment = makeAttachment();

    const result = await writeAttachment(attachment, "Clippings/_assets/img.jpg", vault);

    expect(result.status).toEqual({
      id: "att_001",
      status: "saved",
      vaultPath: "Clippings/_assets/img.jpg",
    });
    expect(result.resolvedPath).toBe("Clippings/_assets/img.jpg");
  });

  it("returns failed status when vault write throws", async () => {
    const vault: VaultAdapter = {
      ...makeVault(),
      async writeBinary() {
        throw new Error("Disk full");
      },
    };

    const result = await writeAttachment(makeAttachment(), "out/img.jpg", vault);

    expect(result.status.status).toBe("failed");
    if (result.status.status === "failed") {
      expect(result.status.code).toBe("WRITE_FAILED");
      expect(result.status.message).toBe("Disk full");
    }
  });

  it("decodes base64 data correctly", async () => {
    const files = new Map<string, Uint8Array | string>();
    const vault = makeVault(files);

    const b64 = Buffer.from("hello world").toString("base64");
    await writeAttachment(
      makeAttachment({ dataBase64: b64 }),
      "out/test.bin",
      vault
    );

    const written = files.get("out/test.bin") as Uint8Array;
    expect(new TextDecoder().decode(written)).toBe("hello world");
  });
});
