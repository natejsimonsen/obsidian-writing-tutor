# Writing Tutor for Obsidian

Highlight a passage, run **Grade selected text**, and Claude Code grades it, says what works, says what could be better, and appends an italicized revised draft.

## How it works

The plugin shells out to the `claude` CLI in headless mode (`claude -p`) with a tutor system prompt and a JSON schema. Nothing is sent anywhere except through your existing Claude Code login. Tools and your Claude Code settings/CLAUDE.md files are disabled for the call, so the tutor only sees the passage.

## Install

1. `npm install && npm run build`
2. Symlink or copy this folder to `<vault>/.obsidian/plugins/writing-tutor`
3. Enable **Writing Tutor** under Settings → Community plugins

## Use

Select text, then fire the tutor one of these ways:

- Vim mode: visual-select and type `gvs` (configurable in settings).
- Right-click → **Grade with Writing Tutor**.
- Command palette → **Grade selected text (sidebar)**. Bind a hotkey if you like.
- The **Grade selection** button in the sidebar.

The sidebar opens on the right with the grade, a one-line summary, what works, what could be better, and the revised draft as a word diff (red strikethrough = removed, green = added). **Accept revision** replaces the original passage in the note. It refuses if the passage changed since grading. **Copy revision** puts the clean rewrite on the clipboard.

Nothing runs in the background. The tutor only reads when you ask.

### Vim note

Vim's built-in `gv` fires the moment you type it, so `gvs` can't be reached unless `gv` is removed in visual mode. The plugin does that (normal-mode `gv` still works). Pick a different sequence in settings if you want visual-mode `gv` back.

## Inline mode

**Grade selected text (insert into note)** writes the feedback into the note instead:

```
> [!tip] Writing tutor · Grade: B+
> One-sentence summary.
>
> **What works**
> - ...
>
> **What could be better**
> - ...

**Revised draft**

*The rewritten passage, in italics.*
```
