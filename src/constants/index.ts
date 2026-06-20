import * as FileSystem from 'expo-file-system/legacy';

export const DEFAULT_CSV_PATH = `${FileSystem.documentDirectory}stocktaker.csv`;
export const STORAGE_KEY = 'stocktaker_done_state';
