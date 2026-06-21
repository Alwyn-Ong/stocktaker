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
  loadSettings: jest.fn().mockResolvedValue({}),
  saveSettings: jest.fn().mockResolvedValue(undefined),
  loadSubmittedState: jest.fn().mockResolvedValue({}),
  saveSubmittedState: jest.fn().mockResolvedValue(undefined),
  loadSessionScans: jest.fn().mockResolvedValue([]),
  saveSessionScans: jest.fn().mockResolvedValue(undefined),
  loadSessionUnknownBarcodes: jest.fn().mockResolvedValue([]),
  saveSessionUnknownBarcodes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/googleAuthService', () => ({
  isSignedIn: jest.fn().mockReturnValue(false),
  signIn: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  getDisplayName: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../services/googleSheetsService', () => ({
  getSheetSchema: jest.fn(),
  fetchLocationsFromSheet: jest.fn(),
  updateRows: jest.fn().mockResolvedValue(undefined),
  columnIndexToLetter: jest.fn(),
}));

import { useInventoryStore } from '../inventoryStore';
import {
  loadDoneState, saveDoneState, loadUnknownBarcodes, loadSettings, saveSettings,
  loadSubmittedState, saveSubmittedState, saveSessionScans, saveSessionUnknownBarcodes,
} from '../../services/storageService';
import * as googleAuthService from '../../services/googleAuthService';
import * as googleSheetsService from '../../services/googleSheetsService';

const flush = () => new Promise(resolve => setImmediate(resolve));

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(UTC\+8\)$/;

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
    submittedKeys: {},
    sheetSchema: null,
    checkedByAlias: null,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  seedLocation();
});

describe('hydrateSettings', () => {
  it('loads sign-in state, display name, and checked-by alias', async () => {
    (googleAuthService.isSignedIn as jest.Mock).mockReturnValue(true);
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    (loadSettings as jest.Mock).mockResolvedValue({ checkedByAlias: 'JD' });

    await useInventoryStore.getState().hydrateSettings();

    expect(useInventoryStore.getState().driveConnected).toBe(true);
    expect(useInventoryStore.getState().displayName).toBe('Jane Doe');
    expect(useInventoryStore.getState().checkedByAlias).toBe('JD');
  });

  it('skips fetching the display name when not signed in', async () => {
    (googleAuthService.isSignedIn as jest.Mock).mockReturnValue(false);

    await useInventoryStore.getState().hydrateSettings();

    expect(googleAuthService.getDisplayName).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().displayName).toBeNull();
  });
});

describe('loadInventory', () => {
  it('fetches locations from the master sheet and merges persisted done state', async () => {
    const schema = { sheetTitle: 'Sheet1', columnIndex: {} as any };
    (googleSheetsService.getSheetSchema as jest.Mock).mockResolvedValue(schema);
    (googleSheetsService.fetchLocationsFromSheet as jest.Mock).mockResolvedValue([
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        items: [{ barcode: '012345', name: 'Widget', description: '', done: false, rowIndex: 2 }],
      },
    ]);
    (loadDoneState as jest.Mock).mockResolvedValue({ '012345_warehouse-a': 1 });
    (loadUnknownBarcodes as jest.Mock).mockResolvedValue({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
    });

    await useInventoryStore.getState().loadInventory();

    const state = useInventoryStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.locations[0].items[0].done).toBe(true);
    expect(state.unknownBarcodes).toEqual([{ barcode: '999999999999', locationId: 'warehouse-a' }]);
    expect(state.sheetSchema).toBe(schema);
  });

  it('hydrates submittedKeys from persisted submitted state', async () => {
    (googleSheetsService.getSheetSchema as jest.Mock).mockResolvedValue({ sheetTitle: 'Sheet1', columnIndex: {} as any });
    (googleSheetsService.fetchLocationsFromSheet as jest.Mock).mockResolvedValue([]);
    (loadSubmittedState as jest.Mock).mockResolvedValue({ '012345_warehouse-a': 1 });

    await useInventoryStore.getState().loadInventory();

    expect(useInventoryStore.getState().submittedKeys).toEqual({ '012345_warehouse-a': true });
  });

  it('sets an error message when the sheet cannot be read', async () => {
    (googleSheetsService.getSheetSchema as jest.Mock).mockRejectedValue(
      new Error('Cannot access the configured master sheet.')
    );

    await useInventoryStore.getState().loadInventory();

    expect(useInventoryStore.getState().loading).toBe(false);
    expect(useInventoryStore.getState().error).toBe('Cannot access the configured master sheet.');
  });
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

  it('is a true no-op once the item has been confirmed submitted', async () => {
    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();
    useInventoryStore.setState({ sessionScans: [], submittedKeys: { '012345_warehouse-a': true } });
    jest.clearAllMocks();

    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();

    expect(saveDoneState).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
  });

  it('re-queues a done-but-unsubmitted item (recovery after a lost session)', async () => {
    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();
    useInventoryStore.setState({ sessionScans: [] }); // simulate a reload wiping the in-memory session
    jest.clearAllMocks();

    useInventoryStore.getState().markDone('012345', 'warehouse-a');
    await flush();

    expect(saveDoneState).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
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
  it('does nothing but clear the session when nothing was scanned', async () => {
    useInventoryStore.setState({ sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any } });

    await useInventoryStore.getState().generateReport();

    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('updates the matching master sheet rows with a timestamp and the checked-by alias', async () => {
    useInventoryStore.setState({
      checkedByAlias: 'JD',
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

    expect(googleAuthService.getDisplayName).not.toHaveBeenCalled();
    expect(googleSheetsService.updateRows).toHaveBeenCalledTimes(1);
    const [sheetId, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(sheetId).toBe('test-sheet-id');
    expect(updates).toEqual([
      { rowIndex: 5, updatedAt: expect.stringMatching(TIMESTAMP_RE), updatedBy: 'JD' },
    ]);
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('records submitted keys and persists the cleared session lists', async () => {
    useInventoryStore.setState({
      checkedByAlias: 'JD',
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [
        {
          id: 'warehouse-a',
          name: 'Warehouse A',
          items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 5 }],
        },
      ],
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await useInventoryStore.getState().generateReport();

    expect(useInventoryStore.getState().submittedKeys).toEqual({ '012345_warehouse-a': true });
    expect(saveSubmittedState).toHaveBeenCalledWith({ '012345_warehouse-a': 1 });
    expect(saveSessionScans).toHaveBeenCalledWith([]);
    expect(saveSessionUnknownBarcodes).toHaveBeenCalledWith([]);
  });

  it('falls back to the signed-in Google display name when no alias is set', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [
        {
          id: 'warehouse-a',
          name: 'Warehouse A',
          items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 5 }],
        },
      ],
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await useInventoryStore.getState().generateReport();

    const [, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(updates[0].updatedBy).toBe('Jane Doe');
  });

  it('throws when no alias is set and the Google display name cannot be determined', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue(null);
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await expect(useInventoryStore.getState().generateReport()).rejects.toThrow(
      'Could not determine signed-in Google account name. Reconnect Google in Settings.'
    );
    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
  });

  it('aborts without writing when a scanned item has no matching sheet row', async () => {
    useInventoryStore.setState({
      checkedByAlias: 'JD',
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

  it('throws when the sheet schema has not been loaded', async () => {
    useInventoryStore.setState({
      checkedByAlias: 'JD',
      sheetSchema: null,
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await expect(useInventoryStore.getState().generateReport()).rejects.toThrow(
      'Master sheet schema not loaded; reload before submitting.'
    );
  });
});

describe('connectDrive / disconnectDrive', () => {
  it('sets displayName on connect and clears it (and the cached schema) on disconnect', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');

    await useInventoryStore.getState().connectDrive();
    expect(useInventoryStore.getState().driveConnected).toBe(true);
    expect(useInventoryStore.getState().displayName).toBe('Jane Doe');

    await useInventoryStore.getState().disconnectDrive();
    expect(useInventoryStore.getState().driveConnected).toBe(false);
    expect(useInventoryStore.getState().displayName).toBeNull();
    expect(useInventoryStore.getState().sheetSchema).toBeNull();
  });
});

describe('setCheckedByAlias', () => {
  it('trims and persists the alias', async () => {
    (loadSettings as jest.Mock).mockResolvedValue({});

    await useInventoryStore.getState().setCheckedByAlias('  Jane Doe  ');

    expect(saveSettings).toHaveBeenCalledWith({ checkedByAlias: 'Jane Doe' });
    expect(useInventoryStore.getState().checkedByAlias).toBe('Jane Doe');
  });

  it('clears the alias when set to a blank string', async () => {
    (loadSettings as jest.Mock).mockResolvedValue({ checkedByAlias: 'Jane Doe' });

    await useInventoryStore.getState().setCheckedByAlias('   ');

    expect(saveSettings).toHaveBeenCalledWith({ checkedByAlias: undefined });
    expect(useInventoryStore.getState().checkedByAlias).toBeNull();
  });
});
