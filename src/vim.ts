import { MarkdownView, Plugin } from "obsidian";

interface VimApi {
  defineAction(name: string, fn: (cm: unknown) => void): void;
  mapCommand(keys: string, type: string, name: string, args: Record<string, unknown>, extra: Record<string, unknown>): void;
  unmap(keys: string, ctx?: string): boolean | void;
  exitVisualMode(cm: unknown, moveHead?: boolean): void;
}

const ACTION = "writingTutorGrade";
let installedKeys: string | null = null;

function getVim(): VimApi | null {
  const adapter = (window as unknown as { CodeMirrorAdapter?: { Vim?: VimApi } }).CodeMirrorAdapter;
  return adapter?.Vim ?? null;
}

/**
 * Bind `keys` in vim visual mode to the grade action. Returns false if vim isn't ready yet.
 * If the binding starts with `gv`, the default visual-mode `gv` is removed (it would fire first),
 * but it is kept in normal mode.
 */
export function installVimBinding(plugin: Plugin, keys: string, onFire: (view: MarkdownView) => void): boolean {
  const vim = getVim();
  if (!vim) return false;
  if (installedKeys) uninstallVimBinding();

  vim.defineAction(ACTION, (cm) => {
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    onFire(view);
    if (typeof vim.exitVisualMode === "function") vim.exitVisualMode(cm);
  });

  if (keys.startsWith("gv") && keys !== "gv") {
    vim.unmap("gv");
    vim.mapCommand("gv", "action", "reselectLastSelection", {}, { context: "normal" });
  }
  vim.mapCommand(keys, "action", ACTION, {}, { context: "visual" });
  installedKeys = keys;
  return true;
}

export function uninstallVimBinding(): void {
  const vim = getVim();
  if (!vim || !installedKeys) return;
  vim.unmap(installedKeys, "visual");
  if (installedKeys.startsWith("gv") && installedKeys !== "gv") {
    vim.unmap("gv", "normal");
    vim.mapCommand("gv", "action", "reselectLastSelection", {}, {});
  }
  installedKeys = null;
}
