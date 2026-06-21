jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  loadUnknownBarcodes, saveUnknownBarcodes,
  loadSubmittedState, saveSubmittedState,
  loadSessionScans, saveSessionScans,
  loadSessionUnknownBarcodes, saveSessionUnknownBarcodes,
} from '../storageService';

describe('unknown barcode persistence', () => {
  it('returns an empty object when nothing has been saved yet', async () => {
    expect(await loadUnknownBarcodes()).toEqual({});
  });

  it('round-trips saved unknown barcodes', async () => {
    await saveUnknownBarcodes({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
    });

    expect(await loadUnknownBarcodes()).toEqual({
      '999999999999_warehouse-a': { barcode: '999999999999', locationId: 'warehouse-a' },
    });
  });
});

describe('submitted-state persistence', () => {
  it('returns an empty object when nothing has been saved yet', async () => {
    expect(await loadSubmittedState()).toEqual({});
  });

  it('round-trips saved submitted state', async () => {
    await saveSubmittedState({ '012345_warehouse-a': 1 });

    expect(await loadSubmittedState()).toEqual({ '012345_warehouse-a': 1 });
  });
});

describe('session-scans persistence', () => {
  it('returns an empty array when nothing has been saved yet', async () => {
    expect(await loadSessionScans()).toEqual([]);
  });

  it('round-trips saved session scans', async () => {
    await saveSessionScans([{ barcode: '012345', locationId: 'warehouse-a', name: 'Widget' }]);

    expect(await loadSessionScans()).toEqual([
      { barcode: '012345', locationId: 'warehouse-a', name: 'Widget' },
    ]);
  });
});

describe('session-unknown-barcodes persistence', () => {
  it('returns an empty array when nothing has been saved yet', async () => {
    expect(await loadSessionUnknownBarcodes()).toEqual([]);
  });

  it('round-trips saved session unknown barcodes', async () => {
    await saveSessionUnknownBarcodes([{ barcode: '999999999999', locationId: 'warehouse-a' }]);

    expect(await loadSessionUnknownBarcodes()).toEqual([
      { barcode: '999999999999', locationId: 'warehouse-a' },
    ]);
  });
});
