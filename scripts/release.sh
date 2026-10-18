#!/usr/bin/env bash
#
# Cuts a release: bumps the version everywhere, cuts the changelog, generates
# the user-manual slide deck, builds the release APK, and uploads the deck +
# APK to Drive (Stock Taking > App > Latest).
#
# Usage: scripts/release.sh <version> [--skip-apk] [--skip-upload] [--skip-git] [--yes]
#
#   <version>       new semver, e.g. 1.1.0
#   --skip-apk      don't build the APK (and don't upload it)
#   --skip-upload   build everything but don't touch Drive
#   --skip-git      don't create the release commit + tag
#   --yes           non-interactive: skip the USER_MANUAL.md freshness prompt
#
# Prerequisite: USER_MANUAL.md (and CHANGELOG.md "Unreleased") already reflect
# what's shipping — this script packages the manual, it doesn't write it.
# Drive upload config: see scripts/upload-release-to-drive.mjs and RELEASE.md.
# Nothing is ever pushed to a git remote; that stays manual.

set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/release.sh <version> [--skip-apk] [--skip-upload] [--skip-git] [--yes]" >&2
  exit 1
fi
shift

SKIP_APK=0 SKIP_UPLOAD=0 SKIP_GIT=0 ASSUME_YES=0
for opt in "$@"; do
  case "$opt" in
    --skip-apk) SKIP_APK=1 ;;
    --skip-upload) SKIP_UPLOAD=1 ;;
    --skip-git) SKIP_GIT=1 ;;
    --yes) ASSUME_YES=1 ;;
    *) echo "Unknown option: $opt" >&2; exit 1 ;;
  esac
done

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "Tag v$VERSION already exists." >&2
  exit 1
fi

# --- 1. Check the manual was actually updated for this release --------------
LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [[ -n "$LAST_TAG" ]] && git diff --quiet "$LAST_TAG" -- USER_MANUAL.md; then
  echo "WARNING: USER_MANUAL.md has not changed since $LAST_TAG."
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    read -r -p "Release anyway? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || exit 1
  fi
fi

# --- 2. Bump versions --------------------------------------------------------
# package.json (app.config.js reads its version from there)
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null

# android/app/build.gradle: versionName = $VERSION, versionCode += 1
GRADLE=android/app/build.gradle
CODE="$(grep -oP 'versionCode \K[0-9]+' "$GRADLE")"
sed -i "s/versionCode $CODE/versionCode $((CODE + 1))/" "$GRADLE"
sed -i "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$GRADLE"
echo "Version: $VERSION (android versionCode $((CODE + 1)))"

# --- 3. Cut the changelog ----------------------------------------------------
if grep -q "^## Unreleased$" CHANGELOG.md; then
  sed -i "0,/^## Unreleased$/s//## Unreleased\n\n## $VERSION — $(date +%Y-%m-%d)/" CHANGELOG.md
  echo "Changelog: Unreleased -> $VERSION"
fi

# --- 4. Generate the manual slide deck ---------------------------------------
mkdir -p dist
node scripts/generate-manual-pptx.mjs --version "$VERSION" \
  --out dist/Stocktaker_User_Manual_Slides.pptx

# --- 5. Build the release APK -------------------------------------------------
if [[ "$SKIP_APK" -ne 1 ]]; then
  # app.config.js reads Google ids etc. from the environment at bundle time
  if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi
  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
  export PATH="$ANDROID_HOME/platform-tools:$PATH"
  ./android/gradlew -p android assembleRelease
  cp android/app/build/outputs/apk/release/app-release.apk dist/Stocktaker.apk
  echo "APK: dist/Stocktaker.apk"
fi

# --- 6. Upload to Drive (Stock Taking > App > Latest) -------------------------
if [[ "$SKIP_UPLOAD" -ne 1 ]]; then
  ARTIFACTS=(dist/Stocktaker_User_Manual_Slides.pptx)
  [[ "$SKIP_APK" -ne 1 ]] && ARTIFACTS+=(dist/Stocktaker.apk)
  RELEASE_VERSION="$VERSION" node scripts/upload-release-to-drive.mjs "${ARTIFACTS[@]}"
fi

# --- 7. Release commit + tag (local only, never pushed) -----------------------
if [[ "$SKIP_GIT" -ne 1 ]]; then
  git add package.json package-lock.json "$GRADLE" CHANGELOG.md USER_MANUAL.md
  git commit -m "Cut release v$VERSION"
  git tag "v$VERSION"
  echo "Committed and tagged v$VERSION (not pushed)."
fi

echo "Release v$VERSION done."
