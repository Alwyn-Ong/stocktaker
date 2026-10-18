jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { googleMasterSheetId: 'test-sheet-id' } } },
}));

jest.mock('../../services/storageService', () => ({
  loadUnknownBarcodes: jest.fn().mockResolvedValue({}),
  saveUnknownBarcodes: jest.fn().mockResolvedValue(undefined),
  makeKey: (barcode: string, locationId: string) => `${barcode}_${locationId}`,
  loadSettings: jest.fn().mockResolvedValue({}),
  saveSettings: jest.fn().mockResolvedValue(undefined),
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
  appendUnknownBarcodes: jest.fn().mockResolvedValue(undefined),
  columnIndexToLetter: jest.fn(),
  toLocationId: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
}));

import { useInventoryStore } from '../inventoryStore';
import {
  loadUnknownBarcodes, saveUnknownBarcodes, loadSettings, saveSettings,
  loadSessionScans, saveSessionScans, saveSessionUnknownBarcodes,
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
  it('fetches locations from the master sheet, taking done status from the sheet itself', async () => {
    const schema = { sheetTitle: 'Sheet1', columnIndex: {} as any };
    (googleSheetsService.getSheetSchema as jest.Mock).mockResolvedValue(schema);
    (googleSheetsService.fetchLocationsFromSheet as jest.Mock).mockResolvedValue([
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 2 }],
      },
    ]);
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

  it('marks items still pending submission as done even if the sheet has not caught up yet', async () => {
    (googleSheetsService.getSheetSchema as jest.Mock).mockResolvedValue({ sheetTitle: 'Sheet1', columnIndex: {} as any });
    (googleSheetsService.fetchLocationsFromSheet as jest.Mock).mockResolvedValue([
      {
        id: 'warehouse-a',
        name: 'Warehouse A',
        items: [{ barcode: '012345', name: 'Widget', description: '', done: false, rowIndex: 2 }],
      },
    ]);
    (loadSessionScans as jest.Mock).mockResolvedValue([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);

    await useInventoryStore.getState().loadInventory();

    expect(useInventoryStore.getState().locations[0].items[0].done).toBe(true);
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

describe('recordScan', () => {
  it('marks an unscanned item done, stamps its current location, and queues it for submission', async () => {
    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();

    const item = useInventoryStore.getState().locations[0].items[0];
    expect(item.done).toBe(true);
    expect(item.currentLocation).toBe('Warehouse A');
    expect(saveSessionScans).toHaveBeenCalledTimes(1);
  });

  it('appends to sessionScans', async () => {
    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
  });

  it('keeps a single queued scan when re-scanned at the same location', async () => {
    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();

    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();

    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
  });

  it('is a true no-op once the item has been confirmed submitted at that location', async () => {
    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();
    useInventoryStore.setState({ sessionScans: [] }); // submit succeeded; sheet now confirms this row
    jest.clearAllMocks();

    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();

    expect(saveSessionScans).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
  });

  it('records a scan at another location, moving the queued scan and current location there', async () => {
    useInventoryStore.setState({
      locations: [
        ...useInventoryStore.getState().locations,
        { id: 'warehouse-b', name: 'Warehouse B', items: [] },
      ],
    });

    useInventoryStore.getState().recordScan('012345', 'warehouse-a');
    await flush();
    useInventoryStore.getState().recordScan('012345', 'warehouse-b');
    await flush();

    const item = useInventoryStore.getState().locations[0].items[0];
    expect(item.done).toBe(true);
    expect(item.currentLocation).toBe('Warehouse B');
    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-b', name: 'Widget' },
    ]);
  });

  it('re-records a sheet-confirmed item when scanned at a different location', async () => {
    useInventoryStore.setState({
      locations: [
        {
          id: 'warehouse-a',
          name: 'Warehouse A',
          items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 2 }],
        },
        { id: 'warehouse-b', name: 'Warehouse B', items: [] },
      ],
    });

    useInventoryStore.getState().recordScan('012345', 'warehouse-b');
    await flush();

    const item = useInventoryStore.getState().locations[0].items[0];
    expect(item.currentLocation).toBe('Warehouse B');
    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '012345', locationId: 'warehouse-b', name: 'Widget' },
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

    await useInventoryStore.getState().generateReport('warehouse-a');

    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('updates the matching master sheet rows with a timestamp and the Google name plus checked-by alias', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
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

    await useInventoryStore.getState().generateReport('warehouse-a');

    expect(googleSheetsService.updateRows).toHaveBeenCalledTimes(1);
    const [sheetId, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(sheetId).toBe('test-sheet-id');
    expect(updates).toEqual([
      { rowIndex: 5, updatedAt: expect.stringMatching(TIMESTAMP_RE), updatedBy: 'Jane Doe (JD)', currentLocation: 'Warehouse A' },
    ]);
    expect(useInventoryStore.getState().sessionScans).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('appends session unknown barcodes to the dedicated sheet, resolving location names', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [{ id: 'warehouse-a', name: 'Warehouse A', items: [] }],
      sessionScans: [],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
    });

    await useInventoryStore.getState().generateReport('warehouse-a');

    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
    expect(googleSheetsService.appendUnknownBarcodes).toHaveBeenCalledTimes(1);
    const [sheetId, rows, recordedAt, recordedBy] =
      (googleSheetsService.appendUnknownBarcodes as jest.Mock).mock.calls[0];
    expect(sheetId).toBe('test-sheet-id');
    expect(rows).toEqual([{ location: 'Warehouse A', barcode: '999999999999' }]);
    expect(recordedAt).toEqual(expect.stringMatching(TIMESTAMP_RE));
    expect(recordedBy).toBe('Jane Doe');
  });

  it('clears persisted unknown barcodes for the submitted location only', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    (loadUnknownBarcodes as jest.Mock).mockResolvedValue({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
      '888888888888_warehouse-b': { barcode: '888888888888', locationId: 'warehouse-b' },
    });
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [{ id: 'warehouse-a', name: 'Warehouse A', items: [] }],
      sessionScans: [],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
      unknownBarcodes: [
        { barcode: '999999999999', locationId: 'warehouse-a' },
        { barcode: '888888888888', locationId: 'warehouse-b' },
      ],
    });

    await useInventoryStore.getState().generateReport('warehouse-a');

    expect(saveUnknownBarcodes).toHaveBeenCalledWith({
      '888888888888_warehouse-b': { barcode: '888888888888', locationId: 'warehouse-b' },
    });
    expect(useInventoryStore.getState().unknownBarcodes).toEqual([
      { barcode: '888888888888', locationId: 'warehouse-b' },
    ]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('only submits and clears the given location, leaving other locations queued', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      locations: [
        { id: 'warehouse-a', name: 'Warehouse A', items: [{ barcode: '012345', name: 'Widget', description: '', done: true, rowIndex: 5 }] },
        { id: 'warehouse-b', name: 'Warehouse B', items: [{ barcode: '067890', name: 'Gadget', description: '', done: true, rowIndex: 9 }] },
      ],
      sessionScans: [
        { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
        { barcode: '067890', locationId: 'warehouse-b', name: 'Gadget' },
      ],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-b' }],
    });

    await useInventoryStore.getState().generateReport('warehouse-a');

    const [, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(updates).toEqual([
      { rowIndex: 5, updatedAt: expect.stringMatching(TIMESTAMP_RE), updatedBy: 'Jane Doe', currentLocation: 'Warehouse A' },
    ]);
    expect(googleSheetsService.appendUnknownBarcodes).not.toHaveBeenCalled();
    expect(useInventoryStore.getState().sessionScans).toEqual([
      { barcode: '067890', locationId: 'warehouse-b', name: 'Gadget' },
    ]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([
      { barcode: '999999999999', locationId: 'warehouse-b' },
    ]);
  });

  it('persists the cleared session lists after a successful submit', async () => {
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

    await useInventoryStore.getState().generateReport('warehouse-a');

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

    await useInventoryStore.getState().generateReport('warehouse-a');

    const [, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(updates[0].updatedBy).toBe('Jane Doe');
  });

  it('falls back to the checked-by alias when the Google display name is unavailable', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue(null);
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

    await useInventoryStore.getState().generateReport('warehouse-a');

    const [, , updates] = (googleSheetsService.updateRows as jest.Mock).mock.calls[0];
    expect(updates[0].updatedBy).toBe('JD');
  });

  it('throws when no alias is set and the Google display name cannot be determined', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue(null);
    useInventoryStore.setState({
      checkedByAlias: null,
      sheetSchema: { sheetTitle: 'Sheet1', columnIndex: {} as any },
      sessionScans: [{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }],
    });

    await expect(useInventoryStore.getState().generateReport('warehouse-a')).rejects.toThrow(
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

    await expect(useInventoryStore.getState().generateReport('warehouse-a')).rejects.toThrow(
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

    await expect(useInventoryStore.getState().generateReport('warehouse-a')).rejects.toThrow(
      'Master sheet schema not loaded; reload before submitting.'
    );
  });
});

describe('flushUnknownBarcodes', () => {
  it('appends session unknowns to the sheet and clears them for the location', async () => {
    (googleAuthService.getDisplayName as jest.Mock).mockResolvedValue('Jane Doe');
    (loadUnknownBarcodes as jest.Mock).mockResolvedValue({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
    });
    useInventoryStore.setState({
      checkedByAlias: null,
      locations: [{ id: 'warehouse-a', name: 'Warehouse A', items: [] }],
      sessionUnknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
      unknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
    });

    await useInventoryStore.getState().flushUnknownBarcodes('warehouse-a');

    expect(googleSheetsService.appendUnknownBarcodes).toHaveBeenCalledTimes(1);
    const [sheetId, rows, recordedAt, recordedBy] =
      (googleSheetsService.appendUnknownBarcodes as jest.Mock).mock.calls[0];
    expect(sheetId).toBe('test-sheet-id');
    expect(rows).toEqual([{ location: 'Warehouse A', barcode: '999999999999' }]);
    expect(recordedAt).toEqual(expect.stringMatching(TIMESTAMP_RE));
    expect(recordedBy).toBe('Jane Doe');
    expect(saveUnknownBarcodes).toHaveBeenCalledWith({});
    expect(useInventoryStore.getState().unknownBarcodes).toEqual([]);
    expect(useInventoryStore.getState().sessionUnknownBarcodes).toEqual([]);
  });

  it('clears persisted unknowns without a sheet append when the session has none', async () => {
    (loadUnknownBarcodes as jest.Mock).mockResolvedValue({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
    });
    useInventoryStore.setState({
      locations: [{ id: 'warehouse-a', name: 'Warehouse A', items: [] }],
      sessionUnknownBarcodes: [],
      unknownBarcodes: [{ barcode: '999999999999', locationId: 'warehouse-a' }],
    });

    await useInventoryStore.getState().flushUnknownBarcodes('warehouse-a');

    expect(googleSheetsService.appendUnknownBarcodes).not.toHaveBeenCalled();
    expect(googleAuthService.getDisplayName).not.toHaveBeenCalled();
    expect(saveUnknownBarcodes).toHaveBeenCalledWith({});
    expect(useInventoryStore.getState().unknownBarcodes).toEqual([]);
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

describe('demo mode', () => {
  beforeEach(() => {
    useInventoryStore.setState({ demoMode: false, driveConnected: false, displayName: null });
  });

  it('startDemo then loadInventory seeds sample data without touching Sheets', async () => {
    useInventoryStore.getState().startDemo();
    await useInventoryStore.getState().loadInventory();

    const state = useInventoryStore.getState();
    expect(state.demoMode).toBe(true);
    expect(state.displayName).toBe('Demo User');
    expect(state.locations.length).toBeGreaterThan(0);
    expect(googleSheetsService.fetchLocationsFromSheet).not.toHaveBeenCalled();
  });

  it('recordScan does not persist session scans', async () => {
    useInventoryStore.getState().startDemo();
    await useInventoryStore.getState().loadInventory();
    const { locations } = useInventoryStore.getState();
    const item = locations[0].items.find(i => !i.done)!;

    useInventoryStore.getState().recordScan(item.barcode, locations[0].id);
    await flush();

    expect(useInventoryStore.getState().sessionScans).toHaveLength(1);
    expect(saveSessionScans).not.toHaveBeenCalled();
  });

  it('generateReport marks scanned items done locally with no Sheets writes', async () => {
    useInventoryStore.getState().startDemo();
    await useInventoryStore.getState().loadInventory();
    const { locations } = useInventoryStore.getState();
    const loc = locations[0];
    const item = loc.items.find(i => !i.done)!;

    useInventoryStore.getState().recordScan(item.barcode, loc.id);
    await useInventoryStore.getState().generateReport(loc.id);

    const updated = useInventoryStore.getState().locations[0].items.find(i => i.barcode === item.barcode)!;
    expect(updated.done).toBe(true);
    expect(useInventoryStore.getState().sessionScans).toHaveLength(0);
    expect(googleSheetsService.updateRows).not.toHaveBeenCalled();
    expect(googleSheetsService.appendUnknownBarcodes).not.toHaveBeenCalled();
  });

  it('exitDemo clears demo state', async () => {
    useInventoryStore.getState().startDemo();
    await useInventoryStore.getState().loadInventory();
    await useInventoryStore.getState().exitDemo();

    const state = useInventoryStore.getState();
    expect(state.demoMode).toBe(false);
    expect(state.locations).toEqual([]);
    expect(state.displayName).not.toBe('Demo User');
  });
});
