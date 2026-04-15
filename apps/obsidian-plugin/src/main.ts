// FILE: apps/obsidian-plugin/src/main.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Main Obsidian plugin class — manages settings, HTTP server lifecycle, and plugin registration
//   SCOPE: Plugin onload/onunload, settings load/save, HTTP server start/stop/restart
//   DEPENDS: M-SHARED-TYPES (ClipSettings), M-OBSIDIAN-PLUGIN (DEFAULT_SETTINGS, loadSettings, AuthClipSettingTab, startHttpServer, ObsidianVaultAdapter)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: ENTRY_POINT
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   AuthClipPlugin - Main plugin class (default export)
// END_MODULE_MAP

import { Plugin, Notice } from "obsidian";
import type { ClipSettings } from "./settings";
import { DEFAULT_SETTINGS, loadSettings } from "./settings";
import { AuthClipSettingTab } from "./settings-tab";
import { startHttpServer, type HttpServerResult } from "./http-server";
import { ObsidianVaultAdapter } from "./obsidian-vault-adapter";

export default class AuthClipPlugin extends Plugin {
  settings: ClipSettings = { ...DEFAULT_SETTINGS };
  private server: HttpServerResult | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new AuthClipSettingTab(this.app, this));

    await this.startServer();
  }

  onunload(): void {
    this.stopServer();
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = loadSettings((data ?? {}) as Record<string, unknown>);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    await this.restartServer();
  }

  private async startServer(): Promise<void> {
    try {
      const vault = new ObsidianVaultAdapter(this.app);
      this.server = await startHttpServer(this.settings, vault, (msg) =>
        console.log(`[AuthClip] ${msg}`)
      );
      new Notice(`AuthClip listening on port ${this.server.port}`);
    } catch (err) {
      console.error(`[AuthClip] Failed to start HTTP server:`, err);
      new Notice(`AuthClip: failed to start HTTP server — ${err instanceof Error ? err.message : err}`);
    }
  }

  private stopServer(): void {
    if (this.server) {
      this.server.close().catch(() => {});
      this.server = null;
    }
  }

  private async restartServer(): Promise<void> {
    this.stopServer();
    await this.startServer();
  }
}
