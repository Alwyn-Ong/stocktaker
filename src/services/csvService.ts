import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { DEFAULT_CSV_PATH } from '../constants';
import { Item, Location } from '../types';

type CSVRow = {
  Location: string;
  Barcode: string;
  'Item Name': string;
  Quantity: string;
};

export async function loadCSV(uri?: string): Promise<Location[]> {
  const path = uri ?? DEFAULT_CSV_PATH;
  const content = await FileSystem.readAsStringAsync(path);
  const result = Papa.parse<CSVRow>(content, { header: true, skipEmptyLines: true });

  const locationMap = new Map<string, Location>();

  for (const row of result.data) {
    const name = row.Location?.trim();
    const barcode = row.Barcode?.trim();
    const itemName = row['Item Name']?.trim();
    const quantity = parseInt(row.Quantity?.trim() ?? '0', 10);

    if (!name || !barcode || !itemName) continue;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (!locationMap.has(id)) {
      locationMap.set(id, { id, name, items: [] });
    }

    locationMap.get(id)!.items.push({
      barcode,
      name: itemName,
      quantity: isNaN(quantity) ? 0 : quantity,
      scannedCount: 0,
      done: false,
    });
  }

  return Array.from(locationMap.values());
}

export async function exportReport(locations: Location[]): Promise<void> {
  const rows: string[][] = [['Location', 'Barcode', 'Item Name', 'Quantity', 'Status']];

  for (const loc of locations) {
    for (const item of loc.items) {
      rows.push([
        loc.name,
        item.barcode,
        item.name,
        String(item.quantity),
        item.done ? 'Done' : 'Pending',
      ]);
    }
  }

  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  const reportPath = `${FileSystem.documentDirectory}stocktaker_report.csv`;
  await FileSystem.writeAsStringAsync(reportPath, csv);
  await Sharing.shareAsync(reportPath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
