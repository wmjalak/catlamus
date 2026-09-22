# Changelog

All notable changes to Catlamus, newest litter first. 🐾

## 1.3.3 — 2026-09-22

### Changed
- Bumped the CI actions from v4 to v7 (`checkout`, `setup-node`,
  `upload-artifact`), clearing the warning that they were being forced off the
  deprecated Node 20 runtime onto Node 24.

## 1.3.2 — 2026-09-22

### Fixed
- CI packaged the app fine but then fell over on `GitHub Personal Access Token
  is not set`: electron-builder detects CI and tries to publish to a GitHub
  release. The workflow now passes `--publish never`.

## 1.3.1 — 2026-09-22

### Fixed
- `package-lock.json` pointed 346 of its packages at an internal Artifactory
  mirror, so `npm ci` failed with `ENOTFOUND` for anyone outside that network —
  including CI. All `resolved` URLs now point at `registry.npmjs.org`; the
  integrity hashes were unchanged and still verify.
- Replaced the `OWNER` placeholder in the `package.json` repository, homepage and
  bugs URLs and in the README CI badge with the real `wmjalak` repository.

### Added
- The `.github/` litter the 1.3.0 notes promised but never shipped: a CI workflow
  that installs, syntax-checks and packages the app on macOS and uploads the dmg,
  plus bug-report and feature-request issue forms and a pull-request template.

## 1.3.0 — 2026-09-22

### Added
- Made the litter box presentable for GitHub: `LICENSE` (MIT), `CONTRIBUTING.md`,
  `.gitignore`, `.editorconfig`, issue and pull-request templates, and a CI
  workflow that installs, syntax-checks and packages the app on macOS.
- `npm run check` — syntax-checks `main.js`, `preload.js` and `renderer.js`.
- Full project metadata in `package.json`: license, author, repository,
  homepage, bugs, keywords and an `engines` floor of Node 18.

### Changed
- README rewritten: badges, keyboard-shortcut table, the Gatekeeper /
  `npm run free` story, updated project structure and contributing pointers.

## 1.2.0 — 2026-08-17

### Added
- **`scripts/free-the-cat.sh`** and an `npm run free` shortcut: since Catlamus
  ships unsigned (no Apple Developer ID) and un-notarized, macOS Gatekeeper
  warns that "Apple cannot check it for malicious software" on a downloaded
  copy. The script ad-hoc signs the app and strips the `com.apple.quarantine`
  flag so it launches with no warning. It now runs automatically after
  `npm run build` (`postbuild`), and can be re-run on any Mac the app is copied
  to. This does not bypass a real malware check — it only clears the "unverified
  developer" prompt for an app you built yourself.

## 1.1.1 — 2026-07-09

### Fixed
- The application menu (About / Quit) showed a lowercase "catlamus" when run in
  development; added `productName` so the app presents itself with proper
  capital-C dignity, as a cat should.

## 1.1.0 — 2026-07-09

### Added
- **Prowl** (find in file): ⌘F opens a search field over the open markdown file,
  prefilled from the current selection. Matches are counted ("2 of 8"),
  case-insensitive, and stepped with ⌘G / Enter (next) and ⇧⌘G / ⇧Enter
  (previous), wrapping at either end like a cat circling back. Escape pounces
  the bar away and returns focus to the editor.
- All matches are highlighted in the text editor (current match in orange) and
  in the rendered Markdown view.

## 1.0.0

### Added
- Initial release: markdown file tree with drag-to-reorder and inline rename,
  text/markdown/split editing modes, formatting toolbar, autosave with
  unreferenced-image cleanup, image paste, font scaling, scroll sync.
