import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY, SETTINGS_KEY, UNKNOWN_BARCODES_KEY } from '../constants';

type DoneState = Record<string, number>; // key: `${barcode}_${locationId}`
type UnknownBarcodeState = Record<string, { barcode: string; locationId: string }>; // key: `${barcode}_${locationId}`

export type StorageBackend = 'local' | 'drive';

export type Settings = {
  backend: StorageBackend;
  driveFileId: string | null;
  driveFileName: string | null;
};

const DEFAULT_SETTINGS: Settings = {
  backend: 'local',
  driveFileId: null,
  driveFileName: null,
};

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadDoneState(): Promise<DoneState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveDoneState(state: DoneState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function makeKey(barcode: string, locationId: string): string {
  return `${barcode}_${locationId}`;
}

export async function loadUnknownBarcodes(): Promise<UnknownBarcodeState> {
  const raw = await AsyncStorage.getItem(UNKNOWN_BARCODES_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveUnknownBarcodes(state: UnknownBarcodeState): Promise<void> {
  await AsyncStorage.setItem(UNKNOWN_BARCODES_KEY, JSON.stringify(state));
}
