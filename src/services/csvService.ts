import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Location, UnknownBarcode } from '../types';
import { formatGMT8 } from '../utils/datetime';

export function serializeReport(locations: Location[], unknownBarcodes: UnknownBarcode[] = [], checkedBy: string = ''): string {
  const rows: string[][] = [['Items Present'], ['Location', 'Barcode', 'Item Name', 'Description']];

  for (const loc of locations) {
    for (const item of loc.items) {
      if (!item.done) continue;
      rows.push([loc.name, item.barcode, item.name, item.description]);
    }
  }

  if (unknownBarcodes.length > 0) {
    rows.push([]);
    rows.push(['Unknown barcodes - not in master list']);
    rows.push(['Location', 'Barcode']);
    for (const unknown of unknownBarcodes) {
      const loc = locations.find(l => l.id === unknown.locationId);
      rows.push([loc?.name ?? unknown.locationId, unknown.barcode]);
    }
  }

  rows.push([]);
  rows.push([`Checked by: ${checkedBy}`]);
  rows.push([formatGMT8()]);

  return rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

export async function exportReport(locations: Location[], unknownBarcodes: UnknownBarcode[] = [], checkedBy: string = ''): Promise<void> {
  const csv = serializeReport(locations, unknownBarcodes, checkedBy);
  const reportPath = `${FileSystem.documentDirectory}stocktaker_report.csv`;
  await FileSystem.writeAsStringAsync(reportPath, csv);
  await Sharing.shareAsync(reportPath, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
}
