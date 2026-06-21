import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { exportReport, serializeReport } from '../csvService';
import { Location, UnknownBarcode } from '../../types';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

jest.mock('../../utils/datetime', () => ({
  formatGMT8: jest.fn(() => '2026-06-21 12:00:00 (UTC+8)'),
}));

const mockedWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockedShareAsync = Sharing.shareAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'warehouse-a',
    name: 'Warehouse A',
    items: [],
    ...overrides,
  };
}

describe('serializeReport', () => {
  it('only includes scanned (done) items, headed by an Items Present row', () => {
    const locations: Location[] = [
      makeLocation({
        items: [
          { barcode: '012345', name: 'Widget', description: '', done: true },
          { barcode: '012346', name: 'Widget Two', description: '', done: false },
        ],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations));

    expect(parsed.data[0]).toEqual(['Items Present']);
    expect(parsed.data[1]).toEqual(['Location', 'Barcode', 'Item Name', 'Description']);
    expect(parsed.data[2]).toEqual(['Warehouse A', '012345', 'Widget', '']);
  });

  it('appends an unknown-barcodes section when unknown barcodes are present', () => {
    const locations: Location[] = [makeLocation()];
    const unknownBarcodes: UnknownBarcode[] = [{ barcode: '999999999999', locationId: 'warehouse-a' }];

    const csv = serializeReport(locations, unknownBarcodes);
    const parsed = Papa.parse<string[]>(csv);

    expect(parsed.data).toEqual(
      expect.arrayContaining([
        ['Unknown barcodes - not in master list'],
        ['Location', 'Barcode'],
        ['Warehouse A', '999999999999'],
      ])
    );
  });

  it('omits the unknown-barcodes section when there are none', () => {
    const locations: Location[] = [makeLocation()];

    const csv = serializeReport(locations, []);

    expect(csv).not.toContain('Unknown barcodes');
  });

  it('appends a footer with the checked-by name and a GMT+8 timestamp', () => {
    const locations: Location[] = [makeLocation()];

    const parsed = Papa.parse<string[]>(serializeReport(locations, [], 'Jane Doe'));

    expect(parsed.data).toEqual(
      expect.arrayContaining([
        ['Checked by: Jane Doe'],
        ['2026-06-21 12:00:00 (UTC+8)'],
      ])
    );
  });
});

describe('exportReport', () => {
  it('writes the report CSV and shares it', async () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: 'A small widget', done: true }],
      }),
    ];

    await exportReport(locations, [], 'Jane Doe');

    expect(mockedWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const [, csvContent] = mockedWriteAsStringAsync.mock.calls[0];
    const parsed = Papa.parse<string[]>(csvContent as string);

    expect(parsed.data[0]).toEqual(['Items Present']);
    expect(parsed.data[1]).toEqual(['Location', 'Barcode', 'Item Name', 'Description']);
    expect(parsed.data[2]).toEqual(['Warehouse A', '012345', 'Widget', 'A small widget']);
    expect(mockedShareAsync).toHaveBeenCalledTimes(1);
  });
});
