## What changed

<!-- A short description of the change, and why. -->

## House rules

- [ ] Version bumped in `package.json` (patch for fixes, minor for features)
- [ ] `CHANGELOG.md` updated, newest version at the top
- [ ] Cat vocabulary used for any new names, labels or copy 🐾
- [ ] No Node.js calls in the renderer — went through `window.api` → `preload.js` → `ipcMain.handle`

## Checked by paw

- [ ] `npm run check` passes
- [ ] `npm start` — clicked through the change
