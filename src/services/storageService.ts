import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '../constants';

type DoneState = Record<string, number>; // key: `${barcode}_${locationId}`

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
