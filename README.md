# Writing Tutor for Obsidian

Highlight a passage, run **Grade selected text**, and Claude Code grades it, says what works, says what could be better, and appends an italicized revised draft.

## How it works

The plugin shells out to the `claude` CLI in headless mode (`claude -p`) with a tutor system prompt and a JSON schema. Nothing is sent anywhere except through your existing Claude Code login. Tools and your Claude Code settings/CLAUDE.md files are disabled for the call, so the tutor only sees the passage.

## Install

1. `npm install && npm run build`
2. Symlink or copy this folder to `<vault>/.obsidian/plugins/writing-tutor`
3. Enable **Writing Tutor** under Settings → Community plugins

## Use

- Select text, then run the command palette → **Grade selected text**, or right-click → **Grade with Writing Tutor**.
- Bind a hotkey under Settings → Hotkeys if you want one.
- Settings let you change the model, timeout, whether to include the surrounding note as context, and add standing instructions for the tutor.

## Output

A callout is inserted after the selection:

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
