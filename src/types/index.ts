export type Item = {
  barcode: string;
  name: string;
  description: string;
  quantity: number;
  scannedCount: number;
  done: boolean;
};

export type Location = {
  id: string;
  name: string;
  items: Item[];
};
