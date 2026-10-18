import { Location } from '../types';

export const DEMO_DISPLAY_NAME = 'Demo User';

// Barcodes that aren't in the sample inventory, used by the Scanner's
// "Simulate unknown" button.
export const DEMO_UNKNOWN_BARCODES = ['999000111222', '999000333444', '999000555666'];

// Built-in sample inventory for Demo Mode. A few items are already checked and
// two have moved (one away, one strayed in), so every list state (done, pending, mismatch badges) shows up
// without needing a master sheet.
export function buildDemoLocations(): Location[] {
  return [
    {
      id: 'warehouse-a',
      name: 'Warehouse A',
      items: [
        { barcode: '012345678905', name: 'Widget Small', description: 'Blue, 5cm', done: true, updatedAt: '2026-10-17 09:12:44 (UTC+8)', checkedBy: 'Jane Doe', currentLocation: 'Warehouse A' },
        { barcode: '012345678912', name: 'Widget Medium', description: 'Blue, 10cm', done: false },
        { barcode: '012345678929', name: 'Widget Large', description: 'Blue, 20cm', done: false },
        { barcode: '099887766554', name: 'Gizmo, Deluxe', description: 'Boxed', done: true, updatedAt: '2026-10-17 09:20:03 (UTC+8)', checkedBy: 'Jane Doe', currentLocation: 'Receiving Dock' },
        { barcode: '012345678936', name: 'Widget XL', description: 'Blue, 40cm', done: false },
      ],
    },
    {
      id: 'warehouse-b',
      name: 'Warehouse B',
      items: [
        { barcode: '111222333445', name: 'Bolt 10mm', description: 'Box of 100', done: false },
        { barcode: '111222333446', name: 'Bolt 12mm', description: 'Box of 100', done: false },
        { barcode: '111222333447', name: 'Washer Pack', description: 'Assorted', done: true, updatedAt: '2026-10-16 15:41:10 (UTC+8)', checkedBy: 'John Smith', currentLocation: 'Warehouse B' },
        { barcode: '111222333449', name: 'Spare Stock', description: 'Shelf 3', done: true, updatedAt: '2026-10-17 10:05:31 (UTC+8)', checkedBy: 'Jane Doe', currentLocation: 'Warehouse A' },
      ],
    },
    {
      id: 'receiving-dock',
      name: 'Receiving Dock',
      items: [
        { barcode: '222333444556', name: 'Pallet Wrap', description: '500mm roll', done: false },
        { barcode: '222333444557', name: 'Tape Roll', description: '48mm clear', done: false },
      ],
    },
  ];
}
