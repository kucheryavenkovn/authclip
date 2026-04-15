// FILE: apps/obsidian-plugin/src/obsidian-vault-adapter.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Obsidian API implementation of VaultAdapter interface
//   SCOPE: Binary/text file read/write, directory creation, file listing, path normalization
//   DEPENDS: M-OBSIDIAN-PLUGIN (VaultAdapter), obsidian (App, TFile)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: RUNTIME
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   ObsidianVaultAdapter - Concrete vault adapter using Obsidian's vault API
// END_MODULE_MAP

import type { VaultAdapter } from "./vault-adapter";
import { TFile, type App } from "obsidian";

export class ObsidianVaultAdapter implements VaultAdapter {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    const normalized = this.normalize(path);
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    await this.app.vault.createBinary(normalized, buffer);
  }

  async writeText(path: string, data: string): Promise<void> {
    const normalized = this.normalize(path);
    const existing = await this.exists(normalized);
    if (existing) {
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, data);
        return;
      }
    }
    await this.app.vault.create(normalized, data);
  }

  async readText(path: string): Promise<string> {
    const normalized = this.normalize(path);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) throw new Error(`File not found: ${normalized}`);
    return await this.app.vault.read(file);
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.normalize(path);
    return await this.app.vault.adapter.exists(normalized);
  }

  async ensureDir(path: string): Promise<void> {
    if (!path) return;
    const normalized = this.normalize(path);
    const exists = await this.app.vault.adapter.exists(normalized);
    if (!exists) {
      await this.app.vault.createFolder(normalized);
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const normalized = this.normalize(dir);
    const exists = await this.app.vault.adapter.exists(normalized);
    if (!exists) return [];
    const result = await this.app.vault.adapter.list(normalized);
    return result.files;
  }

  private normalize(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
  }
}
