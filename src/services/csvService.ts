import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Location, UnknownBarcode } from '../types';

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

export async function exportReport(locations: Location[], unknownBarcodes: UnknownBarcode[] = []): Promise<void> {
  const csv = serializeReport(locations, unknownBarcodes);
  const reportPath = `${FileSystem.documentDirectory}stocktaker_report.csv`;
  await FileSystem.writeAsStringAsync(reportPath, csv);
  await Sharing.shareAsync(reportPath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
