jest.mock('../../services/storageService', () => ({
  loadDoneState: jest.fn().mockResolvedValue({}),
  saveDoneState: jest.fn().mockResolvedValue(undefined),
  loadUnknownBarcodes: jest.fn().mockResolvedValue({}),
  saveUnknownBarcodes: jest.fn().mockResolvedValue(undefined),
  makeKey: (barcode: string, locationId: string) => `${barcode}_${locationId}`,
  loadSettings: jest.fn().mockResolvedValue({ backend: 'local', driveFileId: null, driveFileName: null }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/csvService', () => ({
  loadCSV: jest.fn(),
  exportReport: jest.fn().mockResolvedValue(undefined),
  parseCSV: jest.fn(),
  serializeReport: jest.fn().mockReturnValue(''),
}));

jest.mock('../../services/googleAuthService', () => ({
  isSignedIn: jest.fn().mockResolvedValue(false),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('../../services/googleDriveService', () => ({
  uploadFile: jest.fn().mockResolvedValue(undefined),
  downloadFile: jest.fn(),
}));

import { useInventoryStore } from '../inventoryStore';
import { saveDoneState } from '../../services/storageService';
import { exportReport } from '../../services/csvService';

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
    useInventoryStore.setState({ unknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }] });

    await useInventoryStore.getState().generateReport();

    expect(exportReport).toHaveBeenCalledWith(
      useInventoryStore.getState().locations,
      [{ barcode: '999999999999', locationId: 'warehouse-a' }]
    );
  });
});
