#!/usr/bin/env bash
#
# Copies your private artwork from branding/ (gitignored) over the generic
# placeholders in assets/, and tells git to ignore those local modifications
# so they can't be committed by accident.
#
# Usage: scripts/apply-branding.sh          apply
#        scripts/apply-branding.sh --undo   restore the committed placeholders

set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(icon.png logo-override.png android-icon-foreground.png android-icon-background.png android-icon-monochrome.png)

if [[ "${1:-}" == "--undo" ]]; then
  for f in "${FILES[@]}"; do
    git update-index --no-skip-worktree "assets/$f"
    git checkout HEAD -- "assets/$f"
  done
  echo "Restored placeholder assets."
  exit 0
fi

for f in "${FILES[@]}"; do
  if [[ -f "branding/$f" ]]; then
    cp "branding/$f" "assets/$f"
    git update-index --skip-worktree "assets/$f"
    echo "applied $f"
  fi
done
