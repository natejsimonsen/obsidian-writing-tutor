import { Editor, EditorPosition, MarkdownView, Notice, Plugin } from "obsidian";
import { requestCritique } from "./claude";
import { formatCritique } from "./format";
import { DEFAULT_SETTINGS, WritingTutorSettings, WritingTutorSettingTab } from "./settings";

const MAX_CONTEXT_CHARS = 6000;

export default class WritingTutorPlugin extends Plugin {
  settings: WritingTutorSettings = DEFAULT_SETTINGS;
  private inFlight = false;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new WritingTutorSettingTab(this.app, this));

    this.addCommand({
      id: "grade-selection",
      name: "Grade selected text",
      editorCheckCallback: (checking, editor, view) => {
        if (!(view instanceof MarkdownView) || !editor.somethingSelected()) return false;
        if (!checking) void this.gradeSelection(editor, view);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView) || !editor.somethingSelected()) return;
        menu.addItem((item) =>
          item
            .setTitle("Grade with Writing Tutor")
            .setIcon("graduation-cap")
            .onClick(() => void this.gradeSelection(editor, view))
        );
      })
    );
  }

  async gradeSelection(editor: Editor, view: MarkdownView) {
    if (this.inFlight) {
      new Notice("Writing Tutor is still grading the last passage.");
      return;
    }
    const selection = editor.getSelection();
    if (!selection.trim()) {
      new Notice("Select some text to grade.");
      return;
    }

    const to: EditorPosition = editor.getCursor("to");
    const insertAt: EditorPosition = { line: to.line, ch: editor.getLine(to.line).length };
    const noteTitle = view.file?.basename ?? "Untitled";
    const noteContext = this.settings.includeNoteContext ? trimContext(editor.getValue(), selection) : null;

    this.inFlight = true;
    const working = new Notice("Writing Tutor is reading…", 0);
    try {
      const critique = await requestCritique(
        this.settings.claudePath,
        this.settings.model,
        this.settings.timeoutSeconds,
        {
          selection,
          noteTitle,
          noteContext,
          extraInstructions: this.settings.extraInstructions,
          includeRevisedDraft: this.settings.includeRevisedDraft,
        }
      );
      const block = formatCritique(critique);
      editor.replaceRange(`\n\n${block}\n`, insertAt);
      new Notice(`Writing Tutor: ${critique.grade}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Writing Tutor failed: ${msg}`, 10000);
      console.error("[writing-tutor]", e);
    } finally {
      working.hide();
      this.inFlight = false;
    }
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
