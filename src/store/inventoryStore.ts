import { create } from 'zustand';
import Constants from 'expo-constants';
import { Location, UnknownBarcode, SessionScan } from '../types';
import {
  makeKey,
  loadUnknownBarcodes, saveUnknownBarcodes,
  loadSettings, saveSettings,
  loadSessionScans, saveSessionScans,
  loadSessionUnknownBarcodes, saveSessionUnknownBarcodes,
} from '../services/storageService';
import * as googleAuthService from '../services/googleAuthService';
import * as googleSheetsService from '../services/googleSheetsService';
import { formatGMT8 } from '../utils/datetime';

const MASTER_SHEET_ID: string = Constants.expoConfig?.extra?.googleMasterSheetId ?? '';

type InventoryStore = {
  locations: Location[];
  currentLocationId: string | null;
  loading: boolean;
  error: string | null;
  unknownBarcodes: UnknownBarcode[];
  sessionScans: SessionScan[];
  sessionUnknownBarcodes: UnknownBarcode[];

  driveConnected: boolean;
  displayName: string | null;
  checkedByAlias: string | null;
  sheetSchema: googleSheetsService.SheetSchema | null;

  hydrateSettings: () => Promise<void>;
  loadInventory: () => Promise<void>;
  markDone: (barcode: string, locationId: string) => void;
  recordUnknownBarcode: (barcode: string, locationId: string) => void;
  setCurrentLocation: (id: string) => void;
  generateReport: () => Promise<void>;

  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  setCheckedByAlias: (alias: string) => Promise<void>;
};

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  locations: [],
  currentLocationId: null,
  loading: false,
  error: null,
  unknownBarcodes: [],
  sessionScans: [],
  sessionUnknownBarcodes: [],

  driveConnected: false,
  displayName: null,
  checkedByAlias: null,
  sheetSchema: null,

  hydrateSettings: async () => {
    const driveConnected = await googleAuthService.isSignedIn();
    const displayName = driveConnected ? await googleAuthService.getDisplayName() : null;
    const settings = await loadSettings();
    set({ driveConnected, displayName, checkedByAlias: settings.checkedByAlias ?? null });
  },

  loadInventory: async () => {
    set({ loading: true, error: null });
    try {
      if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
      const sheetSchema = await googleSheetsService.getSheetSchema(MASTER_SHEET_ID);
      const locations = await googleSheetsService.fetchLocationsFromSheet(MASTER_SHEET_ID, sheetSchema);

      const sessionScans = await loadSessionScans();
      const sessionUnknownBarcodes = await loadSessionUnknownBarcodes();

      // Scans not yet confirmed submitted won't show as done on the sheet yet.
      const pendingKeys = new Set(sessionScans.map(s => makeKey(s.barcode, s.locationId)));
      for (const loc of locations) {
        for (const item of loc.items) {
          if (pendingKeys.has(makeKey(item.barcode, loc.id))) item.done = true;
        }
      }

      const unknownState = await loadUnknownBarcodes();

      set({
        locations, sheetSchema, loading: false,
        unknownBarcodes: Object.values(unknownState),
        sessionScans, sessionUnknownBarcodes,
      });
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load data' });
    }
  },

  markDone: (barcode: string, locationId: string) => {
    const loc = get().locations.find(l => l.id === locationId);
    const item = loc?.items.find(i => i.barcode === barcode);
    if (!item) return;

    const sessionScans = get().sessionScans;
    const pending = sessionScans.some(s => s.barcode === barcode && s.locationId === locationId);
    if (item.done && !pending) return; // already confirmed on the sheet

    if (!item.done) {
      const locations = get().locations.map(l => {
        if (l.id !== locationId) return l;
        return {
          ...l,
          items: l.items.map(i => i.barcode === barcode ? { ...i, done: true } : i),
        };
      });
      set({ locations });
    }

    if (!pending) {
      const next = [...sessionScans, { barcode, locationId, name: item.name }];
      set({ sessionScans: next });
      saveSessionScans(next);
    }
  },

  recordUnknownBarcode: (barcode: string, locationId: string) => {
    const { unknownBarcodes, sessionUnknownBarcodes } = get();
    if (unknownBarcodes.some(u => u.barcode === barcode && u.locationId === locationId)) return;

    const next = [...unknownBarcodes, { barcode, locationId }];
    const nextSession = [...sessionUnknownBarcodes, { barcode, locationId }];
    set({ unknownBarcodes: next, sessionUnknownBarcodes: nextSession });
    saveSessionUnknownBarcodes(nextSession);

    loadUnknownBarcodes().then(state => {
      state[makeKey(barcode, locationId)] = { barcode, locationId };
      saveUnknownBarcodes(state);
    });
  },

  setCurrentLocation: (id: string) => set({ currentLocationId: id }),

  generateReport: async () => {
    const { locations, sessionScans, sheetSchema } = get();
    if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
    if (!sheetSchema) throw new Error('Master sheet schema not loaded; reload before submitting.');

    if (sessionScans.length > 0) {
      const checkedBy = get().checkedByAlias || await googleAuthService.getDisplayName();
      if (!checkedBy) {
        throw new Error('Could not determine signed-in Google account name. Reconnect Google in Settings.');
      }

      const updatedAt = formatGMT8();
      const updates: googleSheetsService.SheetRowUpdate[] = [];
      for (const scan of sessionScans) {
        const loc = locations.find(l => l.id === scan.locationId);
        const item = loc?.items.find(i => i.barcode === scan.barcode);
        if (!item || item.rowIndex == null) {
          throw new Error('Some scanned items could not be matched to a master sheet row; submit aborted.');
        }
        updates.push({ rowIndex: item.rowIndex, updatedAt, updatedBy: checkedBy });
      }

      await googleSheetsService.updateRows(MASTER_SHEET_ID, sheetSchema, updates);
    }
    set({ sessionScans: [], sessionUnknownBarcodes: [] });
    await saveSessionScans([]);
    await saveSessionUnknownBarcodes([]);
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

  setCheckedByAlias: async (alias: string) => {
    const trimmed = alias.trim();
    const settings = await loadSettings();
    await saveSettings({ ...settings, checkedByAlias: trimmed || undefined });
    set({ checkedByAlias: trimmed || null });
  },
}));
