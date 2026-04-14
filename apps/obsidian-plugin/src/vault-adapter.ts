export interface VaultAdapter {
  writeBinary(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, data: string): Promise<void>;
  readText(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  ensureDir(path: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
}
