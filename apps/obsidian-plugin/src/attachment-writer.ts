// FILE: apps/obsidian-plugin/src/attachment-writer.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Decode base64 attachment data and write binary files to vault
//   SCOPE: Base64 decoding, directory creation, binary write, error classification
//   DEPENDS: M-SHARED-TYPES (AttachmentPayload, AttachmentStatus), M-OBSIDIAN-PLUGIN (VaultAdapter)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   AttachmentWriteResult - Single write result: status + resolvedPath
//   writeAttachment - Decode base64 and write binary to vault path
// END_MODULE_MAP

import type { AttachmentPayload, AttachmentStatus } from "@authclip/shared-types";
import type { VaultAdapter } from "./vault-adapter";

export interface AttachmentWriteResult {
  status: AttachmentStatus;
  resolvedPath: string;
}

// START_CONTRACT: writeAttachment
//   PURPOSE: Decode base64 attachment data and write binary file to vault
//   INPUTS: { attachment: AttachmentPayload, destPath: string, vault: VaultAdapter }
//   OUTPUTS: { AttachmentWriteResult - status (saved/failed) + resolvedPath }
//   SIDE_EFFECTS: Creates directory and writes file to vault
//   LINKS: M-SHARED-TYPES, M-OBSIDIAN-PLUGIN
// END_CONTRACT: writeAttachment
export async function writeAttachment(
  attachment: AttachmentPayload,
  destPath: string,
  vault: VaultAdapter
): Promise<AttachmentWriteResult> {
  // START_BLOCK_WRITE_FILE
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
  // END_BLOCK_WRITE_FILE
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
