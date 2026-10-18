import Papa from 'papaparse';
import { exportReport, serializeReport } from '../csvService';
import { uploadCsvToFolder } from '../googleDriveService';
import { Location, UnknownBarcode } from '../../types';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleReportFolderId: 'test-folder-id' } } },
}));

jest.mock('../googleDriveService', () => ({
  uploadCsvToFolder: jest.fn(),
}));

// Pulled in via googleSheetsService (for toLocationId); its native Google
// Sign-In module doesn't load under Jest.
jest.mock('../googleAuthService', () => ({}));

jest.mock('../../utils/datetime', () => ({
  formatGMT8: jest.fn(() => '2026-06-21 12:00:00 (UTC+8)'),
}));

const mockedUploadCsvToFolder = uploadCsvToFolder as jest.Mock;

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
  it('groups items under a location header and lists both checked and unchecked items', () => {
    const locations: Location[] = [
      makeLocation({
        items: [
          { barcode: '012345', name: 'Widget', description: '', done: true, checkedBy: 'Alex', updatedAt: '2026-06-21 10:00:00' },
          { barcode: '012346', name: 'Widget Two', description: '', done: false },
        ],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations));

    expect(parsed.data[0]).toEqual(['Warehouse A']);
    expect(parsed.data[1]).toEqual(['Barcode', 'Item Name', 'Description', 'Current Location', 'Status', 'Updated At', 'Checked By']);
    expect(parsed.data[2]).toEqual(['012345', 'Widget', '', '', 'Checked', '2026-06-21 10:00:00', 'Alex']);
    expect(parsed.data[3]).toEqual(['012346', 'Widget Two', '', '', 'Unchecked', '', '']);
  });

  it('includes the item current location when set', () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: '', done: true, checkedBy: 'Alex', updatedAt: '2026-06-21 10:00:00', currentLocation: 'Warehouse B' }],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations));

    expect(parsed.data[2]).toEqual(['012345', 'Widget', '', 'Warehouse B', 'Checked', '2026-06-21 10:00:00', 'Alex']);
  });

  it('falls back to the report checked-by for checked items with no per-item checker', () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: '', done: true, updatedAt: '2026-06-21 10:00:00' }],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations, [], 'Jane Doe'));

    expect(parsed.data[2]).toEqual(['012345', 'Widget', '', '', 'Checked', '2026-06-21 10:00:00', 'Jane Doe']);
  });

  it('keeps a scanned-but-unsubmitted item Unchecked with no timestamp', () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: '', done: true }],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations, [], 'Jane Doe'));

    expect(parsed.data[2]).toEqual(['012345', 'Widget', '', '', 'Unchecked', '', '']);
  });

  it('appends a belong-elsewhere section for items from other locations currently here', () => {
    const locations: Location[] = [makeLocation()];
    const allLocations: Location[] = [
      ...locations,
      makeLocation({
        id: 'warehouse-b',
        name: 'Warehouse B',
        items: [
          { barcode: '0777', name: 'Stray', description: 'Misplaced widget', done: true, checkedBy: 'Alex', updatedAt: '2026-06-21 10:00:00', currentLocation: 'Warehouse A' },
          { barcode: '0778', name: 'Homebody', description: '', done: false, currentLocation: 'Warehouse B' },
        ],
      }),
    ];

    const parsed = Papa.parse<string[]>(serializeReport(locations, [], '', allLocations));

    expect(parsed.data).toEqual(
      expect.arrayContaining([
        ['Items currently here - belong elsewhere'],
        ['Barcode', 'Item Name', 'Description', 'Belongs In', 'Status', 'Updated At', 'Checked By'],
        ['0777', 'Stray', 'Misplaced widget', 'Warehouse B', 'Checked', '2026-06-21 10:00:00', 'Alex'],
      ])
    );
    expect(parsed.data).not.toEqual(expect.arrayContaining([expect.arrayContaining(['0778'])]));
  });

  it('omits the belong-elsewhere section when no other items are currently here', () => {
    const locations: Location[] = [makeLocation()];
    const allLocations: Location[] = [
      ...locations,
      makeLocation({
        id: 'warehouse-b',
        name: 'Warehouse B',
        items: [{ barcode: '0778', name: 'Homebody', description: '', done: false, currentLocation: 'Warehouse B' }],
      }),
    ];

    const csv = serializeReport(locations, [], '', allLocations);

    expect(csv).not.toContain('belong elsewhere');
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

  it('appends a footer with the generator and a GMT+8 timestamp', () => {
    const locations: Location[] = [makeLocation()];

    const parsed = Papa.parse<string[]>(serializeReport(locations, [], 'Jane Doe (Warehouse A)'));

    expect(parsed.data).toEqual(
      expect.arrayContaining([
        ['Generated by:'],
        ['Jane Doe (Warehouse A)'],
        ['2026-06-21 12:00:00 (UTC+8)'],
      ])
    );
  });
});

describe('exportReport', () => {
  it('uploads the report CSV to the configured Drive folder', async () => {
    const locations: Location[] = [
      makeLocation({
        items: [{ barcode: '012345', name: 'Widget', description: 'A small widget', done: true, checkedBy: 'Jane Doe', updatedAt: '2026-06-21 10:00:00' }],
      }),
    ];

    await exportReport(locations, [], 'Jane Doe');

    expect(mockedUploadCsvToFolder).toHaveBeenCalledTimes(1);
    const [folderId, fileName, csvContent] = mockedUploadCsvToFolder.mock.calls[0];

    expect(folderId).toBe('test-folder-id');
    expect(fileName).toBe('Warehouse A - 2026-06-21 12:00:00 (UTC+8).csv');

    const parsed = Papa.parse<string[]>(csvContent as string);
    expect(parsed.data[0]).toEqual(['Warehouse A']);
    expect(parsed.data[1]).toEqual(['Barcode', 'Item Name', 'Description', 'Current Location', 'Status', 'Updated At', 'Checked By']);
    expect(parsed.data[2]).toEqual(['012345', 'Widget', 'A small widget', '', 'Checked', '2026-06-21 10:00:00', 'Jane Doe']);
  });
});
