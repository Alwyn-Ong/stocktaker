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

When updating master file
4. users to login via google auth
5. updated at timestamp + user's name

UI changes:
1. Landing page central logo image (circular, placeholder)
2. goes into a page with a dropdown of which location
3. upon selecting location, go into a page with just the location items
   a. there should be a dropdown on top to change location
   b. bottom button to open barcode scanner
   c. bottom button to finish / generate report
4. Report screen
   a. contain all the changes made in this session
   b. submit / print / cancel buttons
   c. submit updates master file in google drive

gdrive integration
1. user should login to their own gmail for auth, and access the specific shared file on their drive

 
