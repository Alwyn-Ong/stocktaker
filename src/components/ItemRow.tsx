import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Item } from '../types';

export type Mismatch = {
  type: 'currently-in' | 'belongs-in';
  locationName: string;
};

type Props = { item: Item; mismatch?: Mismatch };

export default function ItemRow({ item, mismatch }: Props) {
  return (
    <View style={[styles.row, item.done && styles.rowDone, mismatch && styles.rowMismatch]}>
      <View style={styles.info}>
        <Text style={[styles.name, item.done && styles.textDone]}>{item.name}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <Text style={styles.barcode}>{item.barcode}</Text>
        {mismatch && (
          <Text style={styles.mismatch}>
            {mismatch.type === 'currently-in'
              ? `⚠ Currently in: ${mismatch.locationName}`
              : `⚠ Belongs in: ${mismatch.locationName}`}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        {item.done && <Text style={styles.check}>✓</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  rowDone: { backgroundColor: '#f6fff6' },
  rowMismatch: { backgroundColor: '#FFF8E1' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  textDone: { textDecorationLine: 'line-through', color: '#888' },
  description: { fontSize: 13, color: '#666', marginTop: 2 },
  barcode: { fontSize: 12, color: '#aaa', marginTop: 2 },
  mismatch: { fontSize: 13, color: '#E65100', fontWeight: '600', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  check: { fontSize: 18, color: '#4CAF50', fontWeight: '700' },
});
