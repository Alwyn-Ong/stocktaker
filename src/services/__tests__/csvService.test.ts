import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Papa from 'papaparse';
import { loadCSV, exportReport } from '../csvService';
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
});

describe('exportReport', () => {
  it('includes a Description column with each item\'s description', async () => {
    const locations: Location[] = [
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        items: [
          {
            barcode: '012345',
            name: 'Widget',
            description: 'A small widget',
            quantity: 5,
            scannedCount: 0,
            done: false,
          },
        ],
      },
    ];

    await exportReport(locations);

    expect(mockedWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const [, csvContent] = mockedWriteAsStringAsync.mock.calls[0];
    const parsed = Papa.parse<string[]>(csvContent as string);

    expect(parsed.data[0]).toEqual(['Location', 'Barcode', 'Item Name', 'Description', 'Quantity', 'Status']);
    expect(parsed.data[1]).toEqual(['Warehouse A', '012345', 'Widget', 'A small widget', '5', 'Pending']);
    expect(mockedShareAsync).toHaveBeenCalledTimes(1);
  });
});
