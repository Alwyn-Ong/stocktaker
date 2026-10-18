export type Item = {
  barcode: string;
  name: string;
  description: string;
  done: boolean;
  checkedBy?: string;
  updatedAt?: string;
  rowIndex?: number;
  // Where the item was last scanned ("Current Location" sheet column); unset
  // when the column is blank. Differs from the containing Location when misplaced.
  currentLocation?: string;
};

export type Location = {
  id: string;
  name: string;
  items: Item[];
};

export type UnknownBarcode = {
  barcode: string;
  locationId: string;
};

export type SessionScan = {
  barcode: string;
  locationId: string;
  name: string;
};
