import { getValidAccessToken } from './googleAuthService';
import { Location } from '../types';

const REQUIRED_HEADERS = ['Location', 'Barcode', 'Item Name', 'Description', 'Updated At', 'Updated By'] as const;
type RequiredHeader = typeof REQUIRED_HEADERS[number];

export type SheetSchema = {
  sheetTitle: string;
  columnIndex: Record<RequiredHeader, number>;
};

export type SheetRowUpdate = {
  rowIndex: number;
  updatedAt: string;
  updatedBy: string;
};

export function columnIndexToLetter(index: number): string {
  let n = index + 1;
  let letter = '';
  while (n > 0) {
    n--;
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26);
  }
  return letter;
}

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getValidAccessToken();
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${accessToken}` },
  });
}

export async function getSheetSchema(spreadsheetId: string): Promise<SheetSchema> {
  const metaResponse = await authedFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  );
  if (!metaResponse.ok) {
    throw new Error(`Cannot access the configured master sheet (id: ${spreadsheetId}). Check sharing settings. (HTTP ${metaResponse.status})`);
  }
  const meta = await metaResponse.json();
  const sheetTitle = meta.sheets?.[0]?.properties?.title;
  if (!sheetTitle) {
    throw new Error('Master sheet has no tabs.');
  }

  const headerResponse = await authedFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetTitle)}!1:1`
  );
  if (!headerResponse.ok) {
    throw new Error(`Failed to read master sheet header row. (HTTP ${headerResponse.status})`);
  }
  const headerData = await headerResponse.json();
  const headerRow: string[] = headerData.values?.[0] ?? [];

  const columnIndex = {} as Record<RequiredHeader, number>;
  const missing: string[] = [];
  for (const header of REQUIRED_HEADERS) {
    const index = headerRow.indexOf(header);
    if (index === -1) {
      missing.push(header);
    } else {
      columnIndex[header] = index;
    }
  }
  if (missing.length > 0) {
    throw new Error(`Master sheet is missing required column(s): ${missing.join(', ')}`);
  }

  return { sheetTitle, columnIndex };
}

export async function fetchLocationsFromSheet(spreadsheetId: string, schema: SheetSchema): Promise<Location[]> {
  const maxColumnIndex = Math.max(...Object.values(schema.columnIndex));
  const range = `${encodeURIComponent(schema.sheetTitle)}!A2:${columnIndexToLetter(maxColumnIndex)}`;
  const response = await authedFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`
  );
  if (!response.ok) {
    throw new Error(`Failed to read master sheet rows. (HTTP ${response.status})`);
  }
  const data = await response.json();
  const rows: string[][] = data.values ?? [];

  const locationMap = new Map<string, Location>();

  rows.forEach((row, i) => {
    const name = row[schema.columnIndex.Location]?.trim();
    const barcode = row[schema.columnIndex.Barcode]?.trim();
    const itemName = row[schema.columnIndex['Item Name']]?.trim();
    const description = row[schema.columnIndex.Description]?.trim() ?? '';

    if (!name || !barcode || !itemName) return;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    if (!locationMap.has(id)) {
      locationMap.set(id, { id, name, items: [] });
    }

    locationMap.get(id)!.items.push({
      barcode,
      name: itemName,
      description,
      done: false,
      rowIndex: i + 2,
    });
  });

  return Array.from(locationMap.values());
}

export async function updateRows(spreadsheetId: string, schema: SheetSchema, updates: SheetRowUpdate[]): Promise<void> {
  if (updates.length === 0) return;

  const updatedAtCol = columnIndexToLetter(schema.columnIndex['Updated At']);
  const updatedByCol = columnIndexToLetter(schema.columnIndex['Updated By']);

  const data = updates.flatMap(u => [
    { range: `${schema.sheetTitle}!${updatedAtCol}${u.rowIndex}`, values: [[u.updatedAt]] },
    { range: `${schema.sheetTitle}!${updatedByCol}${u.rowIndex}`, values: [[u.updatedBy]] },
  ]);

  const response = await authedFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("You don't have edit access to the master sheet. Ask the sheet owner for Editor permission.");
    }
    throw new Error(`Failed to update master sheet. (HTTP ${response.status})`);
  }
}
