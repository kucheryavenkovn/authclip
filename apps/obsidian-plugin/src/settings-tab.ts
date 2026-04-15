// FILE: apps/obsidian-plugin/src/settings-tab.ts
// VERSION: 0.2.0
// START_MODULE_CONTRACT
//   PURPOSE: Obsidian settings UI for all AuthClip plugin configuration options
//   SCOPE: Settings form with port, auth token, note folder, attachment folder strategy, rewrite mode, source URL toggle
//   DEPENDS: M-OBSIDIAN-PLUGIN (ClipSettings)
//   LINKS: M-OBSIDIAN-PLUGIN
//   ROLE: UI_COMPONENT
//   MAP_MODE: EXPORTS
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
//   AuthClipSettingTab - Obsidian PluginSettingTab with all configuration fields
// END_MODULE_MAP

import type { App, Plugin } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";
import type { ClipSettings } from "./settings";

export class AuthClipSettingTab extends PluginSettingTab {
  plugin: { settings: ClipSettings; saveSettings: () => Promise<void> };

  constructor(
    app: App,
    plugin: Plugin & { settings: ClipSettings; saveSettings: () => Promise<void> }
  ) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.classList.add("authclip-settings");

    new Setting(containerEl)
      .setName("HTTP Port")
      .setDesc("Port for the localhost HTTP server")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.port))
          .setPlaceholder("27124")
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Auth Token")
      .setDesc("Shared secret for browser extension authentication. Leave empty to disable auth.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.authToken)
          .setPlaceholder("Leave empty for no auth")
          .onChange(async (value) => {
            this.plugin.settings.authToken = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default Note Folder")
      .setDesc("Folder path for new clipped notes")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.defaultNoteFolder)
          .setPlaceholder("Clippings")
          .onChange(async (value) => {
            this.plugin.settings.defaultNoteFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment Folder Strategy")
      .setDesc(
        "same-as-note: Same folder as the note\nsubfolder: Subfolder within note folder\nglobal: Single configured attachment folder"
      )
      .addDropdown((dd) =>
        dd
          .addOptions({
            "same-as-note": "Same as note",
            subfolder: "Subfolder",
            global: "Global folder",
          })
          .setValue(this.plugin.settings.attachmentFolderStrategy)
          .onChange(async (value) => {
            this.plugin.settings.attachmentFolderStrategy = value as ClipSettings["attachmentFolderStrategy"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Attachment Subfolder Name")
      .setDesc("Subfolder name when strategy is 'subfolder'")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.attachmentSubfolderName)
          .setPlaceholder("_assets")
          .onChange(async (value) => {
            this.plugin.settings.attachmentSubfolderName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Global Attachment Folder")
      .setDesc("Folder path when strategy is 'global'")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.globalAttachmentFolder)
          .setPlaceholder("attachments")
          .onChange(async (value) => {
            this.plugin.settings.globalAttachmentFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Rewrite Mode")
      .setDesc("wikilink: ![[image.jpg]]\nrelative-markdown: ![](./path/image.jpg)")
      .addDropdown((dd) =>
        dd
          .addOptions({ wikilink: "Wikilink", "relative-markdown": "Relative Markdown" })
          .setValue(this.plugin.settings.rewriteMode)
          .onChange(async (value) => {
            this.plugin.settings.rewriteMode = value as ClipSettings["rewriteMode"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Keep Source URL in Frontmatter")
      .setDesc("Store the original page URL in the note's frontmatter")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.keepSourceUrlInFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.keepSourceUrlInFrontmatter = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
