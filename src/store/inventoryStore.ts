import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import { Location, UnknownBarcode } from '../types';
import { loadCSV, exportReport, parseCSV, serializeReport } from '../services/csvService';
import {
  loadDoneState, saveDoneState, makeKey,
  loadUnknownBarcodes, saveUnknownBarcodes,
  loadSettings, saveSettings, StorageBackend,
} from '../services/storageService';
import * as googleAuthService from '../services/googleAuthService';
import * as googleDriveService from '../services/googleDriveService';
import { DEFAULT_CSV_PATH } from '../constants';

type InventoryStore = {
  locations: Location[];
  currentLocationId: string | null;
  csvPath: string | null;
  loading: boolean;
  error: string | null;
  unknownBarcodes: UnknownBarcode[];

  backend: StorageBackend;
  driveFileId: string | null;
  driveFileName: string | null;
  driveConnected: boolean;

  hydrateSettings: () => Promise<void>;
  loadFromCSV: (uri?: string) => Promise<void>;
  pickAndLoadCSV: () => Promise<void>;
  markDone: (barcode: string, locationId: string) => void;
  recordUnknownBarcode: (barcode: string, locationId: string) => void;
  setCurrentLocation: (id: string) => void;
  generateReport: () => Promise<void>;

  setBackend: (backend: StorageBackend) => Promise<void>;
  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  selectDriveFile: (fileId: string, fileName: string) => Promise<void>;
};

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  locations: [],
  currentLocationId: null,
  csvPath: null,
  loading: false,
  error: null,
  unknownBarcodes: [],

  backend: 'local',
  driveFileId: null,
  driveFileName: null,
  driveConnected: false,

  hydrateSettings: async () => {
    const settings = await loadSettings();
    const driveConnected = await googleAuthService.isSignedIn();
    set({
      backend: settings.backend,
      driveFileId: settings.driveFileId,
      driveFileName: settings.driveFileName,
      driveConnected,
    });
  },

  loadFromCSV: async (uri?: string) => {
    set({ loading: true, error: null });
    try {
      const { backend, driveFileId } = get();
      let locations: Location[];
      let path: string | null = null;

      if (backend === 'drive') {
        if (!driveFileId) throw new Error('No Google Drive file selected.');
        const content = await googleDriveService.downloadFile(driveFileId);
        locations = parseCSV(content);
      } else {
        path = uri ?? DEFAULT_CSV_PATH;
        locations = await loadCSV(path);
      }

      const doneState = await loadDoneState();

      // Merge persisted done state
      for (const loc of locations) {
        for (const item of loc.items) {
          const key = makeKey(item.barcode, loc.id);
          item.done = (doneState[key] ?? 0) >= 1;
        }
      }

      const unknownState = await loadUnknownBarcodes();
      set({ locations, csvPath: path, loading: false, unknownBarcodes: Object.values(unknownState) });
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
    const loc = get().locations.find(l => l.id === locationId);
    const item = loc?.items.find(i => i.barcode === barcode);
    if (!item || item.done) return;

    const locations = get().locations.map(l => {
      if (l.id !== locationId) return l;
      return {
        ...l,
        items: l.items.map(i => i.barcode === barcode ? { ...i, done: true } : i),
      };
    });
    set({ locations });

    loadDoneState().then(doneState => {
      const key = makeKey(barcode, locationId);
      doneState[key] = 1;
      saveDoneState(doneState);
    });
  },

  recordUnknownBarcode: (barcode: string, locationId: string) => {
    const { unknownBarcodes } = get();
    if (unknownBarcodes.some(u => u.barcode === barcode && u.locationId === locationId)) return;

    const next = [...unknownBarcodes, { barcode, locationId }];
    set({ unknownBarcodes: next });

    loadUnknownBarcodes().then(state => {
      state[makeKey(barcode, locationId)] = { barcode, locationId };
      saveUnknownBarcodes(state);
    });
  },

  setCurrentLocation: (id: string) => set({ currentLocationId: id }),

  generateReport: async () => {
    const { backend, driveFileId, locations, unknownBarcodes } = get();
    if (backend === 'drive') {
      if (!driveFileId) throw new Error('No Google Drive file selected.');
      const csv = serializeReport(locations, unknownBarcodes);
      await googleDriveService.uploadFile(driveFileId, csv);
    } else {
      await exportReport(locations, unknownBarcodes);
    }
  },

  setBackend: async (backend: StorageBackend) => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, backend });
    set({ backend });
  },

  connectDrive: async () => {
    await googleAuthService.signIn();
    set({ driveConnected: true });
  },

  disconnectDrive: async () => {
    await googleAuthService.signOut();
    const settings = await loadSettings();
    await saveSettings({ ...settings, driveFileId: null, driveFileName: null });
    set({ driveConnected: false, driveFileId: null, driveFileName: null });
  },

  selectDriveFile: async (fileId: string, fileName: string) => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, driveFileId: fileId, driveFileName: fileName });
    set({ driveFileId: fileId, driveFileName: fileName });
    await get().loadFromCSV();
  },
}));
