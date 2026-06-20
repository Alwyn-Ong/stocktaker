jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { loadUnknownBarcodes, saveUnknownBarcodes } from '../storageService';

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
