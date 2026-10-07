import { App, PluginSettingTab, Setting } from "obsidian";
import type WritingTutorPlugin from "./main";

export interface WritingTutorSettings {
  claudePath: string;
  model: string;
  timeoutSeconds: number;
  extraInstructions: string;
  includeNoteContext: boolean;
  includeRevisedDraft: boolean;
}

export const DEFAULT_SETTINGS: WritingTutorSettings = {
  claudePath: "claude",
  model: "sonnet",
  timeoutSeconds: 120,
  extraInstructions: "",
  includeNoteContext: true,
  includeRevisedDraft: true,
};

export class WritingTutorSettingTab extends PluginSettingTab {
  plugin: WritingTutorPlugin;

  constructor(app: App, plugin: WritingTutorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Claude CLI path")
      .setDesc("Command or full path to the Claude Code binary. Leave as 'claude' if it is on your PATH.")
      .addText((t) =>
        t.setValue(this.plugin.settings.claudePath).onChange(async (v) => {
          this.plugin.settings.claudePath = v.trim() || "claude";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Model")
      .setDesc("Passed to claude --model. Aliases like sonnet, opus, or haiku work.")
      .addText((t) =>
        t.setValue(this.plugin.settings.model).onChange(async (v) => {
          this.plugin.settings.model = v.trim() || DEFAULT_SETTINGS.model;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Timeout (seconds)")
      .setDesc("Give up on a grade after this long.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.timeoutSeconds)).onChange(async (v) => {
          const n = parseInt(v, 10);
          this.plugin.settings.timeoutSeconds = Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.timeoutSeconds;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Include note context")
      .setDesc("Send the surrounding note (trimmed) so the tutor understands what the passage is for.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.includeNoteContext).onChange(async (v) => {
          this.plugin.settings.includeNoteContext = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Include revised draft")
      .setDesc("Append an italicized rewrite of the passage below the feedback.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.includeRevisedDraft).onChange(async (v) => {
          this.plugin.settings.includeRevisedDraft = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Extra instructions")
      .setDesc("Optional. Tell the tutor what you are working on or what to focus on, e.g. 'I write technical blog posts for engineers.'")
      .addTextArea((t) => {
        t.inputEl.rows = 4;
        t.inputEl.cols = 50;
        t.setValue(this.plugin.settings.extraInstructions).onChange(async (v) => {
          this.plugin.settings.extraInstructions = v;
          await this.plugin.saveSettings();
        });
      });
  }
}
