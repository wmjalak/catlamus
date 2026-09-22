# Contributing to Catlamus

Thanks for prowling by! Catlamus is a small Electron app, so the house rules are short.

## Getting set up

```bash
npm install
npm start
```

⌘R reloads the renderer. Changes to `main.js` need a full restart.

> If you run from a VSCode terminal, note that VSCode sets `ELECTRON_RUN_AS_NODE=1`,
> which breaks Electron. The `start` script already unsets it with
> `env -u ELECTRON_RUN_AS_NODE`.

## House rules

1. **Bump the version** in `package.json` with every change — patch for fixes,
   minor for features.
2. **Update `CHANGELOG.md`**, newest version at the top.
3. **Prefer cat vocabulary** for new names, labels, and copy: meow, purr, prowl,
   whisker, paw, litter. The app is called Catlamus for a reason.
4. **Keep the process boundary clean.** No Node.js calls in the renderer — go
   through `window.api` → `preload.js` → an `ipcMain.handle` in `main.js`.

## Before opening a pull request

```bash
npm run check   # syntax-checks main, preload, and renderer
npm start       # click through the change by paw
```

Commit subjects follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`.

## Architecture in one breath

```
main.js       Node.js main process — window, native menus, all filesystem and dialog work
preload.js    contextBridge — exposes window.api to the renderer
renderer/     index.html + renderer.js + styles.css — all UI logic and state
```

See `CLAUDE.md` for a fuller map of state, key functions, and shortcuts.
