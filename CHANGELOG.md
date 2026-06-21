# Changelog

## Unreleased

### Added
- Google Drive storage backend: connect/disconnect against one locked master Google Sheet (id configured via `GOOGLE_MASTER_SHEET_ID` in `.env.local`), and a Settings screen for choosing between local and Drive storage.
- `googleSheetsService`: reads/writes the master sheet via the Sheets API v4 REST endpoints (`spreadsheets.get`, `values.get`, `values:batchUpdate`), with header-name-driven column lookup.
- `googleAuthService` exposes the signed-in Google account's display name (from the native sign-in result) for use as the "Updated By" value.
- Submitting a report against the Drive backend stamps "Updated At"/"Updated By" columns on each scanned item's row in the master sheet, rather than overwriting the whole file.
- `Item.rowIndex`: optional field set by the Drive backend to track which sheet row an item came from.
- Unknown-barcode capture: barcodes scanned that aren't in the master list are persisted and listed in a separate "Unknown Barcodes" section of the generated report.
- Confirmation dialog when pressing the Android hardware back button on the Landing screen (app exit).
- `LandingScreen` (new root route): circular logo placeholder, "Continue" button, and Settings access.
- `LocationPickerScreen`: CSV import entry point with a dropdown-based location selector.
- `LocationDropdown` component: shared closed-row/modal location picker used by `LocationPickerScreen` and `InventoryScreen`.
- `ReportScreen`: review step before generating a report, listing only items and unknown barcodes scanned in the current session, with Submit, Print, and Cancel actions.
- `sessionScans`/`sessionUnknownBarcodes` in-memory store fields, appended to by `markDone`/`recordUnknownBarcode`, reset on every app launch.
- `src/utils/datetime.ts`: `formatGMT8()` helper formatting a `Date` as `YYYY-MM-DD HH:mm:ss (UTC+8)`, regardless of device timezone.

### Changed
- `Item` dropped `quantity`/`scannedCount` in favor of a single `done` boolean; re-scanning an already-done item is now a no-op instead of incrementing a counter.
- Generated report now only includes scanned items; the `Quantity` and `Status` columns were removed.
- `csvService.parseCSV` no longer reads the `Quantity` column from the master CSV.
- Navigation flow changed from a single location-list root screen to `Landing → LocationPicker → Inventory ⇄ Scanner`, with `Report` reachable from `Inventory`.
- `InventoryScreen` header now shows an inline `LocationDropdown` for switching locations in place (no back navigation) instead of a static location name; the circular "Scan" FAB was replaced by a two-button bottom bar ("Scan" and "Finish / Generate Report").
- "Generate Report" no longer runs immediately from the location list; it now navigates to `ReportScreen`, whose Submit button calls the existing `generateReport()`.
- `ReportScreen`'s Submit failure alert now shows the specific error message instead of a generic failure string.
- `SettingsScreen`'s Drive section shows "Signed in as {name}" instead of an active-file label.
- Replaced `app.json` with `app.config.js`, which reads the Android `package` name and `extra.google*` values from gitignored `.env.local` (see `.env.local.example`) via Expo's built-in dotenv support, instead of hardcoding them in a committed file.
- `googleAuthService` now uses `@react-native-google-signin/google-signin` (native Android Credential Manager flow) instead of `expo-auth-session`'s browser-based authorization-code flow. Google's authorization server rejects custom-scheme `redirect_uri` values (e.g. `stocktaker://`) for "Android" type OAuth clients with `Error 400: invalid_request`, and Expo itself deprecated Google support in `expo-auth-session` as of SDK 49. The native library re-uses the same Android OAuth client (validated by package name + SHA-1, already configured) with no redirect URI involved.
- OAuth scope narrowed from `https://www.googleapis.com/auth/drive` to `https://www.googleapis.com/auth/spreadsheets`, matching the Sheets-only API surface actually used (also a lower Google verification tier: "sensitive" rather than "restricted").
- `app.config.js`: dropped the now-unused `scheme`/`GOOGLE_ANDROID_CLIENT_ID` config and the `expo-web-browser`/`expo-secure-store` plugins; added `ios.bundleIdentifier` (required by the new plugin's prebuild step) and the `@react-native-google-signin/google-signin` plugin.
- `generateReport()` now clears `sessionScans`/`sessionUnknownBarcodes` after a successful submit (either backend); previously they were never cleared until app restart, so the Report screen kept showing already-submitted items. Still preserved on a failed submit, so the user can retry without re-scanning.
- `inventoryStore.generateReport()`'s Drive "Updated At" stamp now uses `formatGMT8()` instead of `Date.toISOString()`.
- `SettingsScreen` no longer has an inline "Connect Google" button (that action moved to `LandingScreen`); it now shows an editable "Checked by" alias field (persisted via `setCheckedByAlias`) and, when signed in, a "Sign out" action.
- `LandingScreen` now drives the Google sign-in flow directly: shows a "Connect Google" button when signed out (replacing the always-enabled "Continue" button), and "Signed in as {name}" plus "Continue" once connected.
- `app.config.js` now reads `expo.name`/`expo.icon` from `APP_NAME`/`APP_ICON` env vars (defaults: `'Stocktaker'` / `./assets/icon.png`), and exposes `appName` via `extra` for runtime use. New keys added to `.env.local.example` (blank).
- `LandingScreen`'s title text and exit-confirmation alert now read the app name from `Constants.expoConfig.extra.appName` instead of a hardcoded `'Stocktaker'` string.
- `LandingScreen`'s logo `Image` now requires `assets/logo-override.png` (a committed generic placeholder, currently identical to `assets/icon.png`) instead of `assets/icon.png` directly, so a custom logo can be swapped in locally by overwriting that file's bytes without touching tracked source code. The override file's content is intentionally not customized in this commit.
- `csvService.serializeReport`/`exportReport` now take a `checkedBy` string: the scanned-items table is headed by an "Items Present" row, the unknown-barcode section is labeled "Unknown barcodes - not in master list", and a footer with "Checked by: {name}" plus a GMT+8 generated timestamp (`formatGMT8`) is appended.
- `ReportScreen`'s Print action now passes `checkedByAlias`/`displayName` through to `exportReport` as the report's `checkedBy` value.
- `App.tsx` wrapped in `SafeAreaProvider`; `InventoryScreen`'s and `ReportScreen`'s bottom button bars and `ScannerScreen`'s overlay now add `useSafeAreaInsets()` bottom (and, for the scanner's top bar, top) padding so the buttons clear Android's gesture nav bar.
- `USER_MANUAL.md`: end-user guide covering sign-in, location selection, scanning, report submission, and Settings.
- `AGENTS.md` Workflow section now requires `USER_MANUAL.md` to be kept up to date when user-facing behavior changes.
- `csvService.test.ts` and `inventoryStore.test.ts` rewritten to match the Sheets-backend implementation: removed `loadCSV` and `backend`-field coverage (both removed from the implementation in earlier changes), and added coverage for `serializeReport`'s new header/footer format, `hydrateSettings`, `loadInventory`, `setCheckedByAlias`, and the alias/display-name fallback paths in `generateReport`.
- `ReportScreen`'s Print failure alert now shows the specific error message instead of a generic failure string (matching the existing Submit failure alert).

### Removed
- "Qty: N" display from inventory item rows.
- `LocationsScreen` and its `FlatList` of `LocationCard` rows (superseded by `LandingScreen` + `LocationPickerScreen`).
- `googleDriveService.ts` and the Drive file browse/pick UI in `SettingsScreen` (superseded by `googleSheetsService` and the locked master sheet config). `driveFileId`/`driveFileName` removed from `Settings`.
- Local CSV import/export backend: `csvService.parseCSV`/`loadCSV`, the `DocumentPicker`-based file picker on `LocationPickerScreen`, and `Settings.backend`/`StorageBackend`. The master Google Sheet is now the app's only data source.
- All implemented entries from `changes.md`, including the four legacy `[DONE]` items that had been left in place across prior commits instead of being removed.
