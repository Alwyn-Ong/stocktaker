export type Item = {
  barcode: string;
  name: string;
  quantity: number;
  scannedCount: number;
  done: boolean;
};

export type Location = {
  id: string;
  name: string;
  items: Item[];
};
