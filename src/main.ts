import { Editor, EditorPosition, MarkdownView, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { requestCritique } from "./claude";
import { formatCritique } from "./format";
import { DEFAULT_SETTINGS, WritingTutorSettings, WritingTutorSettingTab } from "./settings";
import { GradeOrigin, VIEW_TYPE, WritingTutorView } from "./view";
import { installVimBinding, uninstallVimBinding } from "./vim";

const MAX_CONTEXT_CHARS = 6000;
type Mode = "sidebar" | "inline";

export default class WritingTutorPlugin extends Plugin {
  settings: WritingTutorSettings = DEFAULT_SETTINGS;
  private inFlight = false;
  private vimInstalled = false;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new WritingTutorSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new WritingTutorView(leaf, this));

    this.addCommand({
      id: "grade-selection",
      name: "Grade selected text (sidebar)",
      editorCheckCallback: (checking, editor, view) => {
        if (!(view instanceof MarkdownView) || !editor.somethingSelected()) return false;
        if (!checking) void this.gradeSelection(editor, view, "sidebar");
        return true;
      },
    });
    this.addCommand({
      id: "grade-selection-inline",
      name: "Grade selected text (insert into note)",
      editorCheckCallback: (checking, editor, view) => {
        if (!(view instanceof MarkdownView) || !editor.somethingSelected()) return false;
        if (!checking) void this.gradeSelection(editor, view, "inline");
        return true;
      },
    });
    this.addCommand({
      id: "open-sidebar",
      name: "Open Writing Tutor sidebar",
      callback: () => void this.getView(true),
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView) || !editor.somethingSelected()) return;
        menu.addItem((item) =>
          item.setTitle("Grade with Writing Tutor").setIcon("graduation-cap")
            .onClick(() => void this.gradeSelection(editor, view, "sidebar"))
        );
      })
    );

    this.app.workspace.onLayoutReady(() => this.tryInstallVim());
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.tryInstallVim()));
  }

  onunload() {
    uninstallVimBinding();
  }

  tryInstallVim() {
    if (this.vimInstalled || !this.settings.vimKeys.trim()) return;
    this.vimInstalled = installVimBinding(this, this.settings.vimKeys.trim(), (view) => {
      void this.gradeSelection(view.editor, view, "sidebar");
    });
  }

  reinstallVim() {
    uninstallVimBinding();
    this.vimInstalled = false;
    this.tryInstallVim();
  }

  async gradeActiveSelection(mode: Mode) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
      ?? this.app.workspace.getLeavesOfType("markdown").map((l) => l.view).find((v): v is MarkdownView => v instanceof MarkdownView && v.editor.somethingSelected());
    if (!view || !view.editor.somethingSelected()) {
      new Notice("Select some text in a note first.");
      return;
    }
    await this.gradeSelection(view.editor, view, mode);
  }

  async gradeSelection(editor: Editor, view: MarkdownView, mode: Mode) {
    if (this.inFlight) {
      new Notice("Writing Tutor is still grading the last passage.");
      return;
    }
    const selection = editor.getSelection();
    if (!selection.trim()) {
      new Notice("Select some text to grade.");
      return;
    }

    const from: EditorPosition = editor.getCursor("from");
    const to: EditorPosition = editor.getCursor("to");
    const origin: GradeOrigin = { filePath: view.file?.path ?? "", from, to, original: selection };
    const insertAt: EditorPosition = { line: to.line, ch: editor.getLine(to.line).length };
    const noteTitle = view.file?.basename ?? "Untitled";
    const noteContext = this.settings.includeNoteContext ? trimContext(editor.getValue(), selection) : null;

    const sidebar = mode === "sidebar" ? await this.getView(true) : null;
    sidebar?.setLoading(origin);

    this.inFlight = true;
    const working = sidebar ? null : new Notice("Writing Tutor is reading…", 0);
    try {
      const critique = await requestCritique(
        this.settings.claudePath, this.settings.model, this.settings.timeoutSeconds,
        {
          selection, noteTitle, noteContext,
          extraInstructions: this.settings.extraInstructions,
          includeRevisedDraft: this.settings.includeRevisedDraft,
        }
      );
      if (sidebar) {
        sidebar.setResult(origin, critique);
      } else {
        editor.replaceRange(`\n\n${formatCritique(critique)}\n`, insertAt);
        new Notice(`Writing Tutor: ${critique.grade}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (sidebar) sidebar.setError(msg);
      else new Notice(`Writing Tutor failed: ${msg}`, 10000);
      console.error("[writing-tutor]", e);
    } finally {
      working?.hide();
      this.inFlight = false;
    }
  }

  async getView(reveal: boolean): Promise<WritingTutorView | null> {
    let leaf: WorkspaceLeaf | null = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      if (!leaf) return null;
      await leaf.setViewState({ type: VIEW_TYPE, active: false });
    }
    if (reveal) void this.app.workspace.revealLeaf(leaf);
    return leaf.view instanceof WritingTutorView ? leaf.view : null;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/** Return the note text around the selection, capped so long notes don't blow up the prompt. */
function trimContext(note: string, selection: string): string | null {
  const idx = note.indexOf(selection);
  if (note.length <= MAX_CONTEXT_CHARS) return note;
  if (idx < 0) return note.slice(0, MAX_CONTEXT_CHARS);
  const half = Math.floor((MAX_CONTEXT_CHARS - selection.length) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(note.length, idx + selection.length + half);
  return (start > 0 ? "…" : "") + note.slice(start, end) + (end < note.length ? "…" : "");
}
