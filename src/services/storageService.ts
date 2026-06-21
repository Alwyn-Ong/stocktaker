import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_KEY, SETTINGS_KEY, UNKNOWN_BARCODES_KEY,
  SUBMITTED_KEY, SESSION_SCANS_KEY, SESSION_UNKNOWN_BARCODES_KEY,
} from '../constants';
import { SessionScan, UnknownBarcode } from '../types';

type DoneState = Record<string, number>; // key: `${barcode}_${locationId}`
type UnknownBarcodeState = Record<string, { barcode: string; locationId: string }>; // key: `${barcode}_${locationId}`
type SubmittedState = Record<string, number>; // key: `${barcode}_${locationId}`

export type Settings = {
  checkedByAlias?: string;
};

const DEFAULT_SETTINGS: Settings = {};

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

export async function loadSubmittedState(): Promise<SubmittedState> {
  const raw = await AsyncStorage.getItem(SUBMITTED_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveSubmittedState(state: SubmittedState): Promise<void> {
  await AsyncStorage.setItem(SUBMITTED_KEY, JSON.stringify(state));
}

export async function loadSessionScans(): Promise<SessionScan[]> {
  const raw = await AsyncStorage.getItem(SESSION_SCANS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveSessionScans(scans: SessionScan[]): Promise<void> {
  await AsyncStorage.setItem(SESSION_SCANS_KEY, JSON.stringify(scans));
}

export async function loadSessionUnknownBarcodes(): Promise<UnknownBarcode[]> {
  const raw = await AsyncStorage.getItem(SESSION_UNKNOWN_BARCODES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveSessionUnknownBarcodes(barcodes: UnknownBarcode[]): Promise<void> {
  await AsyncStorage.setItem(SESSION_UNKNOWN_BARCODES_KEY, JSON.stringify(barcodes));
}
