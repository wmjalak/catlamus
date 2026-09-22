#!/usr/bin/env bash
#
# free-the-cat.sh — let Catlamus out of Gatekeeper's carrier. 🐈
#
# Catlamus is not signed with an Apple Developer ID and is not notarized, so
# macOS Gatekeeper greets a freshly downloaded copy with a scary "Apple cannot
# check it for malicious software" box. This is NOT malware — it just means
# Apple has never inspected the app. This script does the two things that make
# the warning go away on a given Mac:
#
#   1. Ad-hoc code-signs the app (a signature owned by no one, "-"), which
#      Apple Silicon requires just to launch, and
#   2. Removes the com.apple.quarantine flag that arms the Gatekeeper prompt.
#
# Usage:
#   ./scripts/free-the-cat.sh [/path/to/Catlamus.app]
#
# With no argument it looks for the app in dist/mac-arm64/Catlamus.app.
# Run it on ANY Mac after copying/downloading the app there — the quarantine
# flag is attached at download time, so it must be cleared on the target Mac.

set -euo pipefail

APP="${1:-dist/mac-arm64/Catlamus.app}"

if [ ! -d "$APP" ]; then
  echo "🙀 No app found at: $APP"
  echo "   Build it first with 'npm run build', or pass the path explicitly."
  exit 1
fi

echo "🐾 Ad-hoc signing $APP ..."
codesign --force --deep --sign - "$APP"

echo "🐾 Removing quarantine flag ..."
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "🐾 Verifying signature ..."
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -1 || true

echo "😺 Done — Catlamus is free to prowl. Double-click away."
