import { create } from 'zustand';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { Location, UnknownBarcode, SessionScan } from '../types';
import { loadCSV, exportReport } from '../services/csvService';
import {
  loadDoneState, saveDoneState, makeKey,
  loadUnknownBarcodes, saveUnknownBarcodes,
  loadSettings, saveSettings, StorageBackend,
} from '../services/storageService';
import * as googleAuthService from '../services/googleAuthService';
import * as googleSheetsService from '../services/googleSheetsService';
import { DEFAULT_CSV_PATH } from '../constants';

const MASTER_SHEET_ID: string = Constants.expoConfig?.extra?.googleMasterSheetId ?? '';

type InventoryStore = {
  locations: Location[];
  currentLocationId: string | null;
  csvPath: string | null;
  loading: boolean;
  error: string | null;
  unknownBarcodes: UnknownBarcode[];
  sessionScans: SessionScan[];
  sessionUnknownBarcodes: UnknownBarcode[];

  backend: StorageBackend;
  driveConnected: boolean;
  displayName: string | null;
  sheetSchema: googleSheetsService.SheetSchema | null;

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
};

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  locations: [],
  currentLocationId: null,
  csvPath: null,
  loading: false,
  error: null,
  unknownBarcodes: [],
  sessionScans: [],
  sessionUnknownBarcodes: [],

  backend: 'local',
  driveConnected: false,
  displayName: null,
  sheetSchema: null,

  hydrateSettings: async () => {
    const settings = await loadSettings();
    const driveConnected = await googleAuthService.isSignedIn();
    const displayName = driveConnected ? await googleAuthService.getDisplayName() : null;
    set({
      backend: settings.backend,
      driveConnected,
      displayName,
    });
  },

  loadFromCSV: async (uri?: string) => {
    set({ loading: true, error: null });
    try {
      const { backend } = get();
      let locations: Location[];
      let path: string | null = null;
      let sheetSchema: googleSheetsService.SheetSchema | null = get().sheetSchema;

      if (backend === 'drive') {
        if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
        sheetSchema = await googleSheetsService.getSheetSchema(MASTER_SHEET_ID);
        locations = await googleSheetsService.fetchLocationsFromSheet(MASTER_SHEET_ID, sheetSchema);
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
      set({ locations, csvPath: path, sheetSchema, loading: false, unknownBarcodes: Object.values(unknownState) });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load data' });
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
    set({ locations, sessionScans: [...get().sessionScans, { barcode, locationId, name: item.name }] });

    loadDoneState().then(doneState => {
      const key = makeKey(barcode, locationId);
      doneState[key] = 1;
      saveDoneState(doneState);
    });
  },

  recordUnknownBarcode: (barcode: string, locationId: string) => {
    const { unknownBarcodes, sessionUnknownBarcodes } = get();
    if (unknownBarcodes.some(u => u.barcode === barcode && u.locationId === locationId)) return;

    const next = [...unknownBarcodes, { barcode, locationId }];
    set({ unknownBarcodes: next, sessionUnknownBarcodes: [...sessionUnknownBarcodes, { barcode, locationId }] });

    loadUnknownBarcodes().then(state => {
      state[makeKey(barcode, locationId)] = { barcode, locationId };
      saveUnknownBarcodes(state);
    });
  },

  setCurrentLocation: (id: string) => set({ currentLocationId: id }),

  generateReport: async () => {
    const { backend, locations, unknownBarcodes, sessionScans, sheetSchema } = get();
    if (backend === 'drive') {
      if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
      if (!sheetSchema) throw new Error('Master sheet schema not loaded; reload before submitting.');

      if (sessionScans.length > 0) {
        const displayName = await googleAuthService.getDisplayName();
        if (!displayName) {
          throw new Error('Could not determine signed-in Google account name. Reconnect Google Drive in Settings.');
        }

        const updatedAt = new Date().toISOString();
        const updates: googleSheetsService.SheetRowUpdate[] = [];
        for (const scan of sessionScans) {
          const loc = locations.find(l => l.id === scan.locationId);
          const item = loc?.items.find(i => i.barcode === scan.barcode);
          if (!item || item.rowIndex == null) {
            throw new Error('Some scanned items could not be matched to a master sheet row; submit aborted.');
          }
          updates.push({ rowIndex: item.rowIndex, updatedAt, updatedBy: displayName });
        }

        await googleSheetsService.updateRows(MASTER_SHEET_ID, sheetSchema, updates);
      }
    } else {
      await exportReport(locations, unknownBarcodes);
    }
    set({ sessionScans: [], sessionUnknownBarcodes: [] });
  },

  setBackend: async (backend: StorageBackend) => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, backend });
    set({ backend });
  },

  connectDrive: async () => {
    await googleAuthService.signIn();
    const displayName = await googleAuthService.getDisplayName();
    set({ driveConnected: true, displayName });
  },

  disconnectDrive: async () => {
    await googleAuthService.signOut();
    set({ driveConnected: false, displayName: null, sheetSchema: null });
  },
}));
