import type { AttachmentPayload, AttachmentStatus } from "@authclip/shared-types";
import type { VaultAdapter } from "./vault-adapter";

export interface AttachmentWriteResult {
  status: AttachmentStatus;
  resolvedPath: string;
}

export async function writeAttachment(
  attachment: AttachmentPayload,
  destPath: string,
  vault: VaultAdapter
): Promise<AttachmentWriteResult> {
  try {
    const bytes = decodeBase64(attachment.dataBase64);
    await vault.ensureDir(dirName(destPath));
    await vault.writeBinary(destPath, bytes);
    return {
      status: { id: attachment.id, status: "saved", vaultPath: destPath },
      resolvedPath: destPath,
    };
  } catch (err) {
    return {
      status: {
        id: attachment.id,
        status: "failed",
        code: "WRITE_FAILED",
        message: err instanceof Error ? err.message : "Unknown write error",
      },
      resolvedPath: destPath,
    };
  }
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function dirName(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash >= 0 ? path.slice(0, lastSlash) : "";
}
