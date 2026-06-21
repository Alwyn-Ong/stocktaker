# Stocktaker User Manual

Stocktaker is a mobile app for doing a physical stock check: scan each item's
barcode at a location, then submit which items were found to a shared master
inventory sheet.

## 1. Starting the app

The first screen (Landing) shows the app logo and a button:

- **Connect Google** (not signed in yet) — tap it and sign in with the Google
  account that has access to the master inventory sheet. This is needed because
  inventory data is read from and written to a shared Google Sheet.
- **Continue** (already signed in) — goes straight to location selection.

If sign-in fails, you'll see a "Connection failed" alert with the reason — check
your internet connection and that you're using the correct Google account.

The gear icon in the top-right opens **Settings** (see section 5).

Pressing the phone's Back button on this screen asks you to confirm before
exiting the app.

## 2. Choosing a location

After connecting, you'll land on **Select Location**:

1. Pick a location from the dropdown.
2. Tap **Open** to load that location's item list.

## 3. Scanning items

Inside a location, you'll see the list of items and their status (done/not
done) plus two buttons at the bottom:

- **Scan** — opens the camera. Point it at a barcode:
  - Green toast (`✓ Item Name`) — item found and marked as present.
  - Orange toast (`Already scanned`) — item was already marked present this
    session or in a previous session; nothing changes.
  - Red toast (`Unknown barcode`) — the scanned barcode isn't in this
    location's item list. It's recorded separately and will appear in the
    report's "Unknown barcodes" section.
  - Tap **✕ Close** to return to the item list.
- **Finish / Generate Report** — goes to the Report screen (section 4).

You can switch to a different location at any time using the dropdown in the
header — your scanned progress is saved per item, not lost when switching.

## 4. Reviewing and submitting a report

The **Report** screen lists everything scanned in the *current session* (since
the app was last opened), split into "Scanned items" and "Unknown barcodes". If
nothing's been scanned yet, it shows an empty message instead.

Three actions at the bottom:

- **Cancel** — go back without submitting.
- **Print** — exports a CSV file of the session's results and opens the
  share sheet (e.g. to save it or send it elsewhere). This does not affect the
  master sheet.
- **Submit** — uploads the results to the master Google Sheet: each scanned
  item's row gets an "Updated At" timestamp and "Updated By" name. On success,
  the session list is cleared and you're returned to the Landing screen. If
  submit fails, nothing is cleared so you can retry.

The exported/submitted report uses the name set in **Checked by** (see below),
falling back to your signed-in Google account name if that's blank.

## 5. Settings

Reached via the gear icon on the Landing screen:

- **Checked by** — a name or alias shown on reports instead of your Google
  account name. Edits are saved when you tap away from the field.
- **Google account** — shows who's signed in, with a **Sign out** action.
  Signing out requires reconnecting before you can load inventory again.

## Troubleshooting

- **"Google master sheet is not configured"** — the app isn't set up with a
  master sheet ID; this is a configuration issue, not something fixable from
  the app itself.
- **"Could not determine signed-in Google account name"** when submitting —
  reconnect your Google account from Settings.
- **Could not load inventory** on the Select Location screen — usually a
  connectivity issue; check your internet connection and retry.
