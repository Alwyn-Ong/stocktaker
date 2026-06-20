import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import { Location } from '../types';
import { loadCSV, exportReport } from '../services/csvService';
import { loadDoneState, saveDoneState, makeKey } from '../services/storageService';
import { DEFAULT_CSV_PATH } from '../constants';

type InventoryStore = {
  locations: Location[];
  currentLocationId: string | null;
  csvPath: string | null;
  loading: boolean;
  error: string | null;

  loadFromCSV: (uri?: string) => Promise<void>;
  pickAndLoadCSV: () => Promise<void>;
  markDone: (barcode: string, locationId: string) => void;
  setCurrentLocation: (id: string) => void;
  generateReport: () => Promise<void>;
};

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  locations: [],
  currentLocationId: null,
  csvPath: null,
  loading: false,
  error: null,

  loadFromCSV: async (uri?: string) => {
    set({ loading: true, error: null });
    try {
      const path = uri ?? DEFAULT_CSV_PATH;
      const locations = await loadCSV(path);
      const doneState = await loadDoneState();

      // Merge persisted done state
      for (const loc of locations) {
        for (const item of loc.items) {
          const key = makeKey(item.barcode, loc.id);
          const scannedCount = doneState[key] ?? 0;
          item.scannedCount = scannedCount;
          item.done = scannedCount >= 1;
        }
      }

      set({ locations, csvPath: path, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load CSV' });
    }
  },

  pickAndLoadCSV: async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'text/comma-separated-values' });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    await get().loadFromCSV(uri);
  },

  markDone: (barcode: string, locationId: string) => {
    const locations = get().locations.map(loc => {
      if (loc.id !== locationId) return loc;
      return {
        ...loc,
        items: loc.items.map(item => {
          if (item.barcode !== barcode) return item;
          const scannedCount = item.scannedCount + 1;
          return { ...item, scannedCount, done: scannedCount >= 1 };
        }),
      };
    });
    set({ locations });

    // Persist
    loadDoneState().then(doneState => {
      const key = makeKey(barcode, locationId);
      const loc = locations.find(l => l.id === locationId);
      const item = loc?.items.find(i => i.barcode === barcode);
      if (item) {
        doneState[key] = item.scannedCount;
        saveDoneState(doneState);
      }
    });
  },

  setCurrentLocation: (id: string) => set({ currentLocationId: id }),

  generateReport: async () => {
    await exportReport(get().locations);
  },
}));
