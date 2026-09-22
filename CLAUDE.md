# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working conventions

1. **Bump the version** in `package.json` with every change — semver: patch for fixes, minor for features.
2. **Update `CHANGELOG.md`** with every change; newest version at the top.
3. **Prefer cat vocabulary** when inventing new names, labels, or copy (or renaming existing ones). The app is CATlamus — mentioning meows is preferable. Think: meow, purr, prowl, whisker, paw, litter.

## Commands

```bash
npm start          # Run in development (hot-reloads renderer via ⌘R, but main.js changes require full restart)
npm run build      # Package as macOS .app + .dmg into dist/
python3 generate_icon.py  # Regenerate build/icon.png (requires Pillow)
```

> **Important:** VSCode sets `ELECTRON_RUN_AS_NODE=1`, which breaks Electron. The start script uses `env -u ELECTRON_RUN_AS_NODE electron .` to unset it.

## Architecture

Three-process Electron app with strict context isolation:

```
main.js          ← Node.js main process: BrowserWindow, native menus, all filesystem/dialog ops
preload.js       ← Bridge: exposes window.api to renderer via contextBridge
renderer/
  index.html     ← App shell (sidebar + editor pane + context menu)
  renderer.js    ← All UI logic, state, event handling
  styles.css     ← Dark theme, layout, component styles
```

**IPC pattern:** Renderer calls `window.api.X()` → preload invokes `ipcRenderer.invoke('ns:method')` → main process handles via `ipcMain.handle('ns:method', ...)` and does the actual filesystem work. Never add Node.js calls in the renderer.

**Settings persistence:** `~/Library/Application Support/Catlamus/settings.json` via `settings:get` / `settings:set` IPC. Currently stores: `lastFolder`, `lastFile`, `editorSplit`, `fontSize`.

## Key renderer state

```js
state = { rootPath, currentFile, showText, showMarkdown, dirty, saveTimeout, expanded }
```

- `showText` / `showMarkdown` are independent booleans — both true = split view, one true = full-width single panel, never both false
- `updatePanels()` applies CSS classes `mode-text` / `mode-markdown` to `#editor-pane` and manages editor flex widths
- Autosave: 30s debounce after last keystroke; also triggers `cleanImages` to remove unreferenced `images/` files
- Font size is managed via JS variable `fontSize` (default 14px), not CSS; ⌘+/⌘- to scale

## Key functions (renderer.js)

| Function | Purpose |
|---|---|
| `openFolder(path)` | Sets `state.rootPath`, clears expanded set, calls `loadTree`, saves to settings |
| `openFile(path)` | Loads file content into editor, updates state, saves `lastFile` to settings |
| `save()` | Writes file, triggers `cleanImages`, refreshes file tree |
| `loadTree(dir, container, depth)` | Recursively builds file tree DOM; respects `state.expanded` set |
| `updatePanels()` | Syncs CSS classes and editor flex widths to `showText`/`showMarkdown` state |
| `renderPreview()` | Parses markdown with `marked`, rewrites relative `src` to `file://` absolute paths |
| `applyFormat(action)` | Toolbar formatting — uses `wrap()` for inline (bold/italic/code) and `linePrefix()` for block (headings/lists) |
| `startRename(item, entry)` | Replaces tree item text node with an `<input>`, commits on Enter/blur, cancels on Escape |
| `makeResizer(el, getL, getR, setL, onEnd)` | Generic drag-resizer; used for sidebar and editor/preview split |
| `moveCursorByLines(delta)` | Page Up/Down handler — moves cursor by N logical lines, calls `scrollCursorIntoView()` |
| `applyFontSize(size)` | Clamps to 10–32px, sets `editor.style.fontSize`, persists to settings |
| `syncScroll(from, to)` | Proportional scroll sync between editor and preview; uses `scrollingSrc` flag to prevent loops |
| `openSearch()` / `stepSearch(dir)` | Find bar (⌘F/⌘G): case-insensitive matches, wrap-around next/prev keyed off the editor selection |
| `renderHighlights()` | Paints `#editor-highlights` — a pre-wrap overlay mirroring the textarea's metrics with `<mark>` per match (`.current` = orange); scrollTop synced to editor |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘S | Save |
| ⌘B / ⌘I / ⌘K | Bold / Italic / Link |
| ⌘F | Open find bar (prefilled from selection) |
| ⌘G / ⇧⌘G | Next / previous match (Enter/⇧Enter in find bar also work) |
| ⌘+ / ⌘- / ⌘0 | Font size up / down / reset |
| PageUp / PageDown | Move cursor by one visible page |
| Tab | Insert 2 spaces |

## Image handling

Pasting an image saves it to `images/image-<timestamp>.ext` next to the current `.md` file and inserts `![image](images/filename)`. On every save, `fs:cleanImages` scans all `.md` files in the same directory and deletes any `images/` files not referenced by any of them.

Preview uses `file://` absolute paths resolved from the current file's directory; `webSecurity: false` is set to allow cross-directory file loading.

## CSS layout

`#editor-pane` modes are driven by classes toggled by `updatePanels()`:
- `.mode-text` only → editor fills full width
- `.mode-markdown` only → editor `display:none`, preview fills full width
- both → split view with `#resizer-center` shown; editor width set by `editorSplitWidth` px

`-webkit-app-region: drag` is set on `#titlebar-drag`, `#editor-header`, and `#sidebar-header` for window dragging. All interactive elements explicitly set `no-drag`.
