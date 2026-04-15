// FILE: apps/obsidian-plugin/src/vault-adapter.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Abstract interface for vault file operations (decouples from Obsidian API)
//   SCOPE: writeBinary, writeText, readText, exists, ensureDir, listFiles
//   DEPENDS: none
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: TYPES
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   VaultAdapter - Interface for vault file operations
// END_MODULE_MAP

export interface VaultAdapter {
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, data: string): Promise<void>;
  readText(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
}
