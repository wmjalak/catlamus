# Catlamus 🐈

A lightweight Markdown editor for macOS, built with Electron. Nine lives, zero clutter.

[![CI](https://github.com/wmjalak/catlamus/actions/workflows/ci.yml/badge.svg)](https://github.com/wmjalak/catlamus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **File tree sidebar** — browse folders, create, rename, and delete `.md` files
- **Dual editing modes** — plain text, live Markdown preview, or both side-by-side
- **Formatting toolbar** — bold, italic, strikethrough, headings, code, links, lists, blockquotes, horizontal rules
- **Prowl (find in file)** — ⌘F with match counts, wrap-around stepping, and highlighted hits
- **Image paste** — dropped into `images/` next to the file; unreferenced ones are swept up on save
- **Autosave** — 30 seconds after the last keystroke
- **Session restore** — remembers the last folder, file, split, and font size
- **Resizable panes** — drag the sidebar and editor/preview dividers

## Requirements

- macOS (arm64)
- Node.js 18 or newer

## Getting started

```bash
npm install
npm start
```

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| ⌘S | Save |
| ⌘B / ⌘I / ⌘K | Bold / Italic / Link |
| ⌘F | Open find bar (prefilled from selection) |
| ⌘G / ⇧⌘G | Next / previous match |
| ⌘+ / ⌘- / ⌘0 | Font size up / down / reset |
| PageUp / PageDown | Move cursor by one visible page |
| Tab | Insert 2 spaces |

## Build

Produces a `.app` bundle and a `.dmg` installer in `dist/`:

```bash
npm run build
```

Catlamus ships unsigned (no Apple Developer ID) and un-notarized, so macOS
Gatekeeper warns that "Apple cannot check it for malicious software" on a copy
you downloaded. `npm run build` automatically runs `scripts/free-the-cat.sh`,
which ad-hoc signs the app and clears the `com.apple.quarantine` flag. Re-run it
on any Mac you copy the app to:

```bash
npm run free
```

The app icon can be regenerated with:

```bash
pip3 install Pillow
python3 generate_icon.py
```

## Project structure

```
├── main.js            # Electron main process: window, menus, IPC, filesystem
├── preload.js         # contextBridge — exposes window.api to the renderer
├── renderer/
│   ├── index.html     # App layout
│   ├── renderer.js    # UI logic and state
│   └── styles.css     # Dark theme styles
├── scripts/
│   └── free-the-cat.sh  # Ad-hoc sign + de-quarantine the built app
├── generate_icon.py   # Icon generator (Pillow)
└── build/
    └── icon.png       # App icon (1024×1024)
```

Settings live in `~/Library/Application Support/Catlamus/settings.json`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are logged in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE) © Jani Laakso
