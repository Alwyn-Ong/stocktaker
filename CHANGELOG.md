# Changelog

## Unreleased

### Added
- Google Drive storage backend: connect/disconnect, file picker, and a Settings screen for choosing between local and Drive storage.
- Unknown-barcode capture: barcodes scanned that aren't in the master list are persisted and listed in a separate "Unknown Barcodes" section of the generated report.
- Confirmation dialog when pressing the Android hardware back button on the Landing screen (app exit).
- `LandingScreen` (new root route): circular logo placeholder, "Continue" button, and Settings access.
- `LocationPickerScreen`: CSV import entry point with a dropdown-based location selector.
- `LocationDropdown` component: shared closed-row/modal location picker used by `LocationPickerScreen` and `InventoryScreen`.
- `ReportScreen`: review step before generating a report, listing only items and unknown barcodes scanned in the current session, with Submit, Print, and Cancel actions.
- `sessionScans`/`sessionUnknownBarcodes` in-memory store fields, appended to by `markDone`/`recordUnknownBarcode`, reset on every app launch.

### Changed
- `Item` dropped `quantity`/`scannedCount` in favor of a single `done` boolean; re-scanning an already-done item is now a no-op instead of incrementing a counter.
- Generated report now only includes scanned items; the `Quantity` and `Status` columns were removed.
- `csvService.parseCSV` no longer reads the `Quantity` column from the master CSV.
- Navigation flow changed from a single location-list root screen to `Landing → LocationPicker → Inventory ⇄ Scanner`, with `Report` reachable from `Inventory`.
- `InventoryScreen` header now shows an inline `LocationDropdown` for switching locations in place (no back navigation) instead of a static location name; the circular "Scan" FAB was replaced by a two-button bottom bar ("Scan" and "Finish / Generate Report").
- "Generate Report" no longer runs immediately from the location list; it now navigates to `ReportScreen`, whose Submit button calls the existing `generateReport()`.

### Removed
- "Qty: N" display from inventory item rows.
- `LocationsScreen` and its `FlatList` of `LocationCard` rows (superseded by `LandingScreen` + `LocationPickerScreen`).
