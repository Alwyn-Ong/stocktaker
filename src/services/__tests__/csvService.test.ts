import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { loadCSV, exportReport, serializeReport } from '../csvService';
import { Location } from '../../types';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///mock-doc-dir/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

const mockedReadAsStringAsync = FileSystem.readAsStringAsync as jest.Mock;
const mockedWriteAsStringAsync = FileSystem.writeAsStringAsync as jest.Mock;
const mockedShareAsync = Sharing.shareAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadCSV', () => {
  it('parses the Description column, trimming whitespace', async () => {
    mockedReadAsStringAsync.mockResolvedValue(
      'Location,Barcode,Item Name,Quantity,Description\n'
      + 'Warehouse A,012345,Widget,5,  A small widget  \n'
    );

    const locations = await loadCSV('file:///fake.csv');

    expect(locations[0].items[0].description).toBe('A small widget');
  });

  it('defaults description to an empty string when the column is blank or missing', async () => {
    mockedReadAsStringAsync.mockResolvedValue(
      'Location,Barcode,Item Name,Quantity,Description\n'
      + 'Warehouse A,012345,Widget,5,\n'
      + 'Warehouse A,012346,Widget Two,3\n'
    );

    const locations = await loadCSV('file:///fake.csv');

    expect(locations[0].items[0].description).toBe('');
    expect(locations[0].items[1].description).toBe('');
  });

  it('preserves commas inside quoted descriptions', async () => {
    mockedReadAsStringAsync.mockResolvedValue(
      'Location,Barcode,Item Name,Quantity,Description\n'
      + 'Warehouse A,012345,Gizmo,1,"Deluxe gizmo, gift wrapped"\n'
    );

    const locations = await loadCSV('file:///fake.csv');

    expect(locations[0].items[0].description).toBe('Deluxe gizmo, gift wrapped');
  });

  it('ignores the Quantity column entirely, even with malformed values', async () => {
    mockedReadAsStringAsync.mockResolvedValue(
      'Location,Barcode,Item Name,Quantity,Description\n'
      + 'Warehouse A,012345,Widget,abc,A widget\n'
    );

    const locations = await loadCSV('file:///fake.csv');

    expect(locations[0].items[0]).not.toHaveProperty('quantity');
  });

  it('tolerates a CSV with no Quantity column at all', async () => {
    mockedReadAsStringAsync.mockResolvedValue(
      'Location,Barcode,Item Name,Description\n'
      + 'Warehouse A,012345,Widget,A widget\n'
    );

    const locations = await loadCSV('file:///fake.csv');

    expect(locations[0].items[0].name).toBe('Widget');
  });
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
  it('only includes scanned (done) items', () => {
    const locations: Location[] = [
      makeLocation({
        items: [
          { barcode: '012345', name: 'Widget', description: '', done: true },
          { barcode: '012346', name: 'Widget Two', description: '', done: false },
        ],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations));

    expect(parsed.data[0]).toEqual(['Location', 'Barcode', 'Item Name', 'Description']);
    expect(parsed.data.length).toBe(2);
    expect(parsed.data[1]).toEqual(['Warehouse A', '012345', 'Widget', '']);
  });

  it('appends an Unknown Barcodes section when unknown barcodes are present', () => {
    const locations: Location[] = [makeLocation()];

    const csv = serializeReport(locations, [{ barcode: '999999999999', locationId: 'warehouse-a' }]);
    const parsed = Papa.parse<string[]>(csv);

    expect(parsed.data).toEqual(
      expect.arrayContaining([
        ['Unknown Barcodes'],
        ['Location', 'Barcode'],
        ['Warehouse A', '999999999999'],
      ])
    );
  });

  it('omits the Unknown Barcodes section when there are none', () => {
    const locations: Location[] = [makeLocation()];

    const csv = serializeReport(locations, []);

    expect(csv).not.toContain('Unknown Barcodes');
  });
});

describe('exportReport', () => {
  it('writes the report CSV and shares it', async () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: 'A small widget', done: true }],
      }),
    ];

    await exportReport(locations);

    expect(mockedWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const [, csvContent] = mockedWriteAsStringAsync.mock.calls[0];
    const parsed = Papa.parse<string[]>(csvContent as string);

    expect(parsed.data[0]).toEqual(['Location', 'Barcode', 'Item Name', 'Description']);
    expect(parsed.data[1]).toEqual(['Warehouse A', '012345', 'Widget', 'A small widget']);
    expect(mockedShareAsync).toHaveBeenCalledTimes(1);
  });
});
