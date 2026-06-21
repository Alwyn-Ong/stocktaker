Changes to data structure

1. [DONE] Change all quantity to one
   - Implemented as a binary scanned/not-scanned model: quantity and scan-count
     were dropped entirely rather than displayed as a fixed "1".

Misc
2. [DONE] Exit confirm dialog on back
   - Scoped to app exit only: confirmation shows when pressing the Android
     hardware back button on the Locations (root) screen. Back/close buttons
     within Scanner and Inventory navigate immediately, no prompt.

Generated file
3. [DONE, modified] generated only contains things they scan, acknowledge list at the end.
   - Report now only contains scanned items. No acknowledge list for
     not-yet-scanned master items was added (decided against during planning).
4. [DONE] If there are unknown barcodes in the list, add them separately
   - Unrecognized scans are persisted and appended as an "Unknown Barcodes"
     section (Location, Barcode) at the end of the generated report.


Add a date and time at the bottom of the generated report
Add the name: "Checked by: "
For the "Unknown Barcodes" string in the report, add it to "Unknown barcodes - not in master list"
For the checked items, add a "Items Present" on top

For the google drive in settings, move it to tot main page beside continue. 

generate a user manual. update claude to update the user manual on every change if necessary.

also push up the buttons like scan and finish/ generate report, it seems to be clashing with my phone's back / change app button

update the app name and the app icon and main page icon to the private branding do NOT commit this. 

change the app name to also come from env var

also, changes the timestamps to GMT+8 / UTC+8
