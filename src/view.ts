import { ItemView, MarkdownView, Notice, WorkspaceLeaf, EditorPosition, setIcon } from "obsidian";
import { diffWords } from "diff";
import type { Critique } from "./claude";
import type WritingTutorPlugin from "./main";

export const VIEW_TYPE = "writing-tutor";

export interface GradeOrigin {
  filePath: string;
  from: EditorPosition;
  to: EditorPosition;
  original: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; origin: GradeOrigin }
  | { kind: "ready"; origin: GradeOrigin; critique: Critique }
  | { kind: "error"; message: string };

export class WritingTutorView extends ItemView {
  private plugin: WritingTutorPlugin;
  private state: State = { kind: "idle" };

  constructor(leaf: WorkspaceLeaf, plugin: WritingTutorPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Writing Tutor"; }
  getIcon() { return "graduation-cap"; }

  async onOpen() { this.render(); }

  setLoading(origin: GradeOrigin) { this.state = { kind: "loading", origin }; this.render(); }
  setResult(origin: GradeOrigin, critique: Critique) { this.state = { kind: "ready", origin, critique }; this.render(); }
  setError(message: string) { this.state = { kind: "error", message }; this.render(); }
  clear() { this.state = { kind: "idle" }; this.render(); }

  private render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("wt-root");

    const header = root.createDiv({ cls: "wt-header" });
    header.createEl("h4", { text: "Writing Tutor" });
    const gradeBtn = header.createEl("button", { text: "Grade selection", cls: "mod-cta" });
    gradeBtn.onclick = () => void this.plugin.gradeActiveSelection("sidebar");

    const body = root.createDiv({ cls: "wt-body" });
    const s = this.state;

    if (s.kind === "idle") {
      body.createEl("p", { cls: "wt-muted", text: "Select some text, then press the button, right-click → Grade with Writing Tutor, or use the vim binding in visual mode." });
      return;
    }
    if (s.kind === "loading") {
      const row = body.createDiv({ cls: "wt-loading" });
      setIcon(row.createSpan({ cls: "wt-spin" }), "loader");
      row.createSpan({ text: " Reading your passage…" });
      body.createEl("blockquote", { cls: "wt-original", text: s.origin.original });
      return;
    }
    if (s.kind === "error") {
      body.createEl("p", { cls: "wt-error", text: s.message });
      return;
    }

    const { critique: c, origin } = s;
    const top = body.createDiv({ cls: "wt-grade-row" });
    top.createSpan({ cls: "wt-grade", text: c.grade });
    if (c.summary) top.createSpan({ cls: "wt-summary", text: c.summary });

    if (c.strengths.length) {
      body.createEl("h5", { text: "What works" });
      const ul = body.createEl("ul");
      for (const t of c.strengths) ul.createEl("li", { text: t });
    }
    if (c.improvements.length) {
      body.createEl("h5", { text: "What could be better" });
      const ul = body.createEl("ul");
      for (const t of c.improvements) ul.createEl("li", { text: t });
    }

    if (c.revised) {
      body.createEl("h5", { text: "Revised draft" });
      const diffEl = body.createDiv({ cls: "wt-diff" });
      for (const part of diffWords(origin.original, c.revised)) {
        const cls = part.added ? "wt-ins" : part.removed ? "wt-del" : "wt-same";
        diffEl.createSpan({ cls, text: part.value });
      }
      const actions = body.createDiv({ cls: "wt-actions" });
      const accept = actions.createEl("button", { text: "Accept revision", cls: "mod-cta" });
      accept.onclick = () => this.accept(origin, c.revised);
      const copy = actions.createEl("button", { text: "Copy revision" });
      copy.onclick = () => { void navigator.clipboard.writeText(c.revised); new Notice("Copied revision."); };
      const dismiss = actions.createEl("button", { text: "Dismiss" });
      dismiss.onclick = () => this.clear();
    }
  }

  private accept(origin: GradeOrigin, revised: string) {
    const view = this.app.workspace.getLeavesOfType("markdown")
      .map((l) => l.view)
      .find((v): v is MarkdownView => v instanceof MarkdownView && v.file?.path === origin.filePath);
    if (!view) {
      new Notice("Open the note that was graded before accepting.");
      return;
    }
    const editor = view.editor;
    let current: string;
    try {
      current = editor.getRange(origin.from, origin.to);
    } catch {
      current = "";
    }
    if (current !== origin.original) {
      new Notice("The passage changed since it was graded. Re-grade it first.", 6000);
      return;
    }
    editor.replaceRange(revised, origin.from, origin.to);
    this.app.workspace.revealLeaf(view.leaf);
    new Notice("Revision applied.");
    this.clear();
  }
}
