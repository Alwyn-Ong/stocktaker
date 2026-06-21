jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleMasterSheetId: 'test-sheet-id' } } },
}));

jest.mock('../../services/storageService', () => ({
  loadDoneState: jest.fn().mockResolvedValue({}),
  saveDoneState: jest.fn().mockResolvedValue(undefined),
  loadUnknownBarcodes: jest.fn().mockResolvedValue({}),
  saveUnknownBarcodes: jest.fn().mockResolvedValue(undefined),
  makeKey: (barcode: string, locationId: string) => `${barcode}_${locationId}`,
  loadSettings: jest.fn().mockResolvedValue({ backend: 'local' }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/csvService', () => ({
  loadCSV: jest.fn(),
  exportReport: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/googleAuthService', () => ({
  isSignedIn: jest.fn().mockResolvedValue(false),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getDisplayName: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/googleSheetsService', () => ({
  getSheetSchema: jest.fn(),
  fetchLocationsFromSheet: jest.fn(),
  updateRows: jest.fn().mockResolvedValue(undefined),
  columnIndexToLetter: jest.fn(),
}));

import { useInventoryStore } from '../inventoryStore';
import { saveDoneState } from '../../services/storageService';
import { exportReport } from '../../services/csvService';
import * as googleAuthService from '../../services/googleAuthService';
import * as googleSheetsService from '../../services/googleSheetsService';

const flush = () => new Promise(resolve => setImmediate(resolve));

function seedLocation() {
  useInventoryStore.setState({
    locations: [
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        items: [{ barcode: '012345', name: 'Widget', description: '', done: false }],
      },
    ],
    unknownBarcodes: [],
    sessionScans: [],
    sessionUnknownBarcodes: [],
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  seedLocation();
});

describe('markDone', () => {
  it('marks an unscanned item done and persists it', async () => {
    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();

    const item = useInventoryStore.getState().locations[0].items[0];
    expect(item.done).toBe(true);
    expect(saveDoneState).toHaveBeenCalledTimes(1);
  });

  it('appends to sessionScans', async () => {
    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
  });

  it('is a no-op when the item is already done', async () => {
    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();
    jest.clearAllMocks();

    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();

    expect(saveDoneState).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toHaveLength(1);
  });
});

describe('recordUnknownBarcode', () => {
  it('adds a new unknown barcode once', async () => {
    useInventoryStore.getState().recordUnknownBarcode('999999999999', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().unknownBarcodes).toEqual([
      { barcode: '999999999999', locationId: 'warehouse-a' },
    ]);
  });

  it('appends to sessionUnknownBarcodes', async () => {
    useInventoryStore.getState().recordUnknownBarcode('999999999999', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([
      { barcode: '999999999999', locationId: 'warehouse-a' },
    ]);
  });

  it('does not duplicate the same barcode+location', async () => {
    useInventoryStore.getState().recordUnknownBarcode('999999999999', 'warehouse-a');
    await flush();
    useInventoryStore.getState().recordUnknownBarcode('999999999999', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().unknownBarcodes).toHaveLength(1);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toHaveLength(1);
  });
});

describe('generateReport', () => {
  it('exports the current locations and unknown barcodes (local backend)', async () => {
    useInventoryStore.setState({
      unknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
    });

    await useInventoryStore.getState().generateReport();

    expect(exportReport).toHaveBeenCalledWith(
      useInventoryStore.getState().locations,
      [{ barcode: '999999999999', locationId: 'warehouse-a' }]
    );
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('updates the matching master sheet rows with a timestamp and the signed-in user (drive backend)', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    useInventoryStore.setState({
      backend: 'drive',
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [
        {
          id: 'warehouse-a',
          name: 'Warehouse A',
          items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 5 }],
        },
      ],
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
    });

    await useInventoryStore.getState().generateReport();

    expect(googleSheetsService.updateRows).toHaveBeenCalledTimes(1);
    const [sheetId, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(sheetId).toBe('test-sheet-id');
    expect(updates).toEqual([
      { rowIndex: 5, updatedAt: expect.any(String), updatedBy: 'Jane Doe' },
    ]);
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('aborts without writing when a scanned item has no matching sheet row', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    useInventoryStore.setState({
      backend: 'drive',
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [
        {
          id: 'warehouse-a',
          name: 'Warehouse A',
          items: [{ barcode: '012345', name: 'Widget', description: '', done: true }],
        },
      ],
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await expect(useInventoryStore.getState().generateReport()).rejects.toThrow(
      'Some scanned items could not be matched to a master sheet row; submit aborted.'
    );
    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
  });
});

describe('connectDrive / disconnectDrive', () => {
  it('sets displayName on connect and clears it on disconnect', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');

    await useInventoryStore.getState().connectDrive();
    expect(useInventoryStore.getState().driveConnected).toBe(true);
    expect(useInventoryStore.getState().displayName).toBe('Jane Doe');

    await useInventoryStore.getState().disconnectDrive();
    expect(useInventoryStore.getState().driveConnected).toBe(false);
    expect(useInventoryStore.getState().displayName).toBeNull();
  });
});
