# Release flow

One command packages and publishes a release:

```bash
npm run release -- 1.1.0
```

`scripts/release.sh` then:

1. **Checks the user manual is fresh** — warns (and asks to confirm) if
   `USER_MANUAL.md` hasn't changed since the last release tag. Updating the
   manual (and the `Unreleased` section of `CHANGELOG.md`) is a *pre-step*
   done while implementing changes; the script packages it, it doesn't write it.
2. **Bumps the version** — `package.json` (which `app.config.js` reads),
   plus `versionName`/`versionCode` in `android/app/build.gradle`.
3. **Cuts the changelog** — renames `## Unreleased` to the new version + date
   and starts a fresh empty `Unreleased` section.
4. **Generates the slide deck** — `scripts/generate-manual-pptx.mjs` converts
   `USER_MANUAL.md` into `dist/Stocktaker_User_Manual_Slides.pptx` (title
   slide with version/date, one slide per manual section, long sections split
   across slides).
5. **Builds the release APK** — `gradlew assembleRelease` (sourcing
   `.env.local` for the Google ids embedded at bundle time), copied to
   `dist/Stocktaker.apk`. Note: release builds are currently signed with the
   debug keystore (see `android/app/build.gradle`) — fine for direct install,
   not for Play Store.
6. **Uploads to Drive** — `scripts/upload-release-to-drive.mjs` puts the deck
   and APK into **Stock Taking > App > Latest**. Files are updated *in place*
   (same Drive file id), so links shared to the "latest" files keep working.
7. **Commits and tags** `v<version>` locally. Nothing is ever pushed —
   pushing stays a manual step.

Flags: `--skip-apk`, `--skip-upload`, `--skip-git`, `--yes` (non-interactive,
for CI).

Regenerate just the deck without releasing: `npm run manual:pptx`.

## One-time setup for the Drive upload

The upload authenticates as *you* (OAuth refresh token), so files stay owned
by your account. Config lives in `.env.local` (or real env vars, which win):

| Variable | What it is |
| --- | --- |
| `GDRIVE_OAUTH_CLIENT_ID` / `GDRIVE_OAUTH_CLIENT_SECRET` | An OAuth client of type **Desktop app** — create one in the same Google Cloud project as the app's existing Android/iOS clients (APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app). |
| `GDRIVE_OAUTH_REFRESH_TOKEN` | Run `node scripts/get-drive-refresh-token.mjs`, open the printed URL, approve with the Google account that has edit access to the Latest folder, paste the printed token. |
| `GDRIVE_LATEST_FOLDER_ID` | Drive folder id of Stock Taking > App > Latest (the last path segment of the folder's URL). |

## Turning this into a GitHub Action later

The script is already CI-shaped; the workflow just supplies what the machine
provides locally:

- Secrets → env: the four `GDRIVE_*` vars plus the app's `GOOGLE_*` /
  `ANDROID_PACKAGE_NAME` / `APP_NAME` vars that `.env.local` provides today.
- Runner setup: `actions/setup-node`, `actions/setup-java` (17) and
  `android-actions/setup-android` replace `~/Android/Sdk` (drop the
  `android/local.properties` sdk.dir override in CI — `ANDROID_HOME` wins).
- Trigger: e.g. `workflow_dispatch` with a `version` input, then
  `npm ci && scripts/release.sh "$VERSION" --yes --skip-git`, and let the
  workflow push the tag/commit itself (or trigger *on* a pushed tag and skip
  the bump instead).
