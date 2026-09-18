#!/bin/bash
# Installiert die Abhängigkeiten, damit Build, Lint und Tests in einer
# Web-Session sofort laufen. Lokal passiert nichts – dort ist das Repo
# bereits eingerichtet.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# npm install statt npm ci: der Containerzustand wird nach dem Hook
# zwischengespeichert, und install ist idempotent.
npm install --no-audit --no-fund
