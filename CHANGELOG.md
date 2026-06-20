# Changelog

## Unreleased

### Added
- Google Drive storage backend: connect/disconnect, file picker, and a Settings screen for choosing between local and Drive storage.
- Unknown-barcode capture: barcodes scanned that aren't in the master list are persisted and listed in a separate "Unknown Barcodes" section of the generated report.
- Confirmation dialog when pressing the Android hardware back button on the Locations screen (app exit).

### Changed
- `Item` dropped `quantity`/`scannedCount` in favor of a single `done` boolean; re-scanning an already-done item is now a no-op instead of incrementing a counter.
- Generated report now only includes scanned items; the `Quantity` and `Status` columns were removed.
- `csvService.parseCSV` no longer reads the `Quantity` column from the master CSV.

### Removed
- "Qty: N" display from inventory item rows.
