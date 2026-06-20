import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { DEFAULT_CSV_PATH } from '../constants';
import { Location, UnknownBarcode } from '../types';

type CSVRow = {
  Location: string;
  Barcode: string;
  'Item Name': string;
  Description?: string;
};

export function parseCSV(content: string): Location[] {
  const result = Papa.parse<CSVRow>(content, { header: true, skipEmptyLines: true });

  const locationMap = new Map<string, Location>();

  for (const row of result.data) {
    const name = row.Location?.trim();
    const barcode = row.Barcode?.trim();
    const itemName = row['Item Name']?.trim();
    const description = row.Description?.trim() ?? '';

    if (!name || !barcode || !itemName) continue;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (!locationMap.has(id)) {
      locationMap.set(id, { id, name, items: [] });
    }

    locationMap.get(id)!.items.push({
      barcode,
      name: itemName,
      description,
      done: false,
    });
  }

  return Array.from(locationMap.values());
}

export function serializeReport(locations: Location[], unknownBarcodes: UnknownBarcode[] = []): string {
  const rows: string[][] = [['Location', 'Barcode', 'Item Name', 'Description']];

  for (const loc of locations) {
    for (const item of loc.items) {
      if (!item.done) continue;
      rows.push([loc.name, item.barcode, item.name, item.description]);
    }
  }

  if (unknownBarcodes.length > 0) {
    rows.push([]);
    rows.push(['Unknown Barcodes']);
    rows.push(['Location', 'Barcode']);
    for (const unknown of unknownBarcodes) {
      const loc = locations.find(l => l.id === unknown.locationId);
      rows.push([loc?.name ?? unknown.locationId, unknown.barcode]);
    }
  }

  return rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function loadCSV(uri?: string): Promise<Location[]> {
  const path = uri ?? DEFAULT_CSV_PATH;
  const content = await FileSystem.readAsStringAsync(path);
  return parseCSV(content);
}

export async function exportReport(locations: Location[], unknownBarcodes: UnknownBarcode[] = []): Promise<void> {
  const csv = serializeReport(locations, unknownBarcodes);
  const reportPath = `${FileSystem.documentDirectory}stocktaker_report.csv`;
  await FileSystem.writeAsStringAsync(reportPath, csv);
  await Sharing.shareAsync(reportPath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
