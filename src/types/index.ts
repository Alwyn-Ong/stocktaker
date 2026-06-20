export type Item = {
  barcode: string;
  name: string;
  description: string;
  done: boolean;
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
