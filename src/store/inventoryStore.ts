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
import { formatCheckedBy } from '../utils/checkedBy';

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
  recordScan: (barcode: string, locationId: string) => void;
  recordUnknownBarcode: (barcode: string, locationId: string) => void;
  setCurrentLocation: (id: string) => void;
  generateReport: (locationId: string) => Promise<void>;
  flushUnknownBarcodes: (locationId: string) => Promise<void>;

  connectDrive: () => Promise<void>;
  disconnectDrive: () => Promise<void>;
  setCheckedByAlias: (alias: string) => Promise<void>;
};

export const useInventoryStore = create<InventoryStore>((set, get) => {
  // Appends the location's session unknown barcodes to the "Unknown Barcodes"
  // tab, then drops every unknown for that location from state and storage —
  // once the sheet has them, the app no longer needs to remember them.
  async function submitLocationUnknowns(locationId: string, recordedAt: string, recordedBy: string): Promise<void> {
    const { locations, sessionUnknownBarcodes } = get();
    const unknowns = sessionUnknownBarcodes.filter(u => u.locationId === locationId);
    if (unknowns.length > 0) {
      const rows = unknowns.map(u => ({
        location: locations.find(l => l.id === u.locationId)?.name ?? u.locationId,
        barcode: u.barcode,
      }));
      await googleSheetsService.appendUnknownBarcodes(MASTER_SHEET_ID, rows, recordedAt, recordedBy);
    }

    const persisted = await loadUnknownBarcodes();
    for (const key of Object.keys(persisted)) {
      if (persisted[key].locationId === locationId) delete persisted[key];
    }
    await saveUnknownBarcodes(persisted);

    const remainingSession = get().sessionUnknownBarcodes.filter(u => u.locationId !== locationId);
    set({
      unknownBarcodes: get().unknownBarcodes.filter(u => u.locationId !== locationId),
      sessionUnknownBarcodes: remainingSession,
    });
    await saveSessionUnknownBarcodes(remainingSession);
  }

  return {
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
      const nameById = new Map(locations.map(l => [l.id, l.name]));
      const pendingByBarcode = new Map(sessionScans.map(s => [s.barcode, s.locationId]));
      for (const loc of locations) {
        for (const item of loc.items) {
          const scannedAt = pendingByBarcode.get(item.barcode);
          if (scannedAt) {
            item.done = true;
            item.currentLocation = nameById.get(scannedAt) ?? scannedAt;
          }
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

  recordScan: (barcode: string, locationId: string) => {
    const locations = get().locations;
    const home = locations.find(l => l.items.some(i => i.barcode === barcode));
    const item = home?.items.find(i => i.barcode === barcode);
    if (!home || !item) return;

    const sessionScans = get().sessionScans;
    const pending = sessionScans.some(s => s.barcode === barcode);
    // A blank Current Location on the sheet means the item hasn't moved.
    const currentId = item.currentLocation ? googleSheetsService.toLocationId(item.currentLocation) : home.id;
    if (item.done && currentId === locationId && !pending) return; // already confirmed here on the sheet

    const scannedName = locations.find(l => l.id === locationId)?.name ?? locationId;
    const nextLocations = locations.map(l => ({
      ...l,
      items: l.items.map(i => i.barcode === barcode ? { ...i, done: true, currentLocation: scannedName } : i),
    }));
    // An item can only be in one place: a re-scan elsewhere moves the queued scan.
    const nextScans = [
      ...sessionScans.filter(s => s.barcode !== barcode),
      { barcode, locationId, name: item.name },
    ];
    set({ locations: nextLocations, sessionScans: nextScans });
    saveSessionScans(nextScans);
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

  generateReport: async (locationId: string) => {
    const { locations, sessionScans, sessionUnknownBarcodes, sheetSchema } = get();
    if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
    if (!sheetSchema) throw new Error('Master sheet schema not loaded; reload before submitting.');

    const scans = sessionScans.filter(s => s.locationId === locationId);
    const unknowns = sessionUnknownBarcodes.filter(u => u.locationId === locationId);

    const updatedAt = formatGMT8();
    let checkedBy = '';
    if (scans.length > 0 || unknowns.length > 0) {
      const displayName = await googleAuthService.getDisplayName();
      checkedBy = formatCheckedBy(displayName, get().checkedByAlias);
      if (!checkedBy) {
        throw new Error('Could not determine signed-in Google account name. Reconnect Google in Settings.');
      }
    }

    if (scans.length > 0) {
      const locationName = locations.find(l => l.id === locationId)?.name ?? locationId;
      const updates: googleSheetsService.SheetRowUpdate[] = [];
      for (const scan of scans) {
        // The item may belong to another location; its row still gets this
        // location written as Current Location.
        const item = locations.flatMap(l => l.items).find(i => i.barcode === scan.barcode);
        if (!item || item.rowIndex == null) {
          throw new Error('Some scanned items could not be matched to a master sheet row; submit aborted.');
        }
        updates.push({ rowIndex: item.rowIndex, updatedAt, updatedBy: checkedBy, currentLocation: locationName });
      }

      await googleSheetsService.updateRows(MASTER_SHEET_ID, sheetSchema, updates);

      // Mirror the master sheet locally so the report reflects the just-submitted rows.
      const submittedBarcodes = new Set(scans.map(s => s.barcode));
      const syncedLocations = get().locations.map(l => ({
        ...l,
        items: l.items.map(i =>
          submittedBarcodes.has(i.barcode)
            ? { ...i, done: true, updatedAt, checkedBy, currentLocation: locationName }
            : i
        ),
      }));
      set({ locations: syncedLocations });
    }

    await submitLocationUnknowns(locationId, updatedAt, checkedBy);

    const remainingScans = sessionScans.filter(s => s.locationId !== locationId);
    set({ sessionScans: remainingScans });
    await saveSessionScans(remainingScans);
  },

  flushUnknownBarcodes: async (locationId: string) => {
    if (!MASTER_SHEET_ID) throw new Error('Google master sheet is not configured.');
    let checkedBy = '';
    if (get().sessionUnknownBarcodes.some(u => u.locationId === locationId)) {
      const displayName = await googleAuthService.getDisplayName();
      checkedBy = formatCheckedBy(displayName, get().checkedByAlias);
      if (!checkedBy) {
        throw new Error('Could not determine signed-in Google account name. Reconnect Google in Settings.');
      }
    }
    await submitLocationUnknowns(locationId, formatGMT8(), checkedBy);
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
  };
});
