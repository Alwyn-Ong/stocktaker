import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Item } from '../types';

type Props = { item: Item };

export default function ItemRow({ item }: Props) {
  return (
    <View style={[styles.row, item.done && styles.rowDone]}>
      <View style={styles.info}>
        <Text style={[styles.name, item.done && styles.textDone]}>{item.name}</Text>
        <Text style={styles.barcode}>{item.barcode}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.qty}>Qty: {item.quantity}</Text>
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
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '500', color: '#1a1a1a' },
  textDone: { textDecorationLine: 'line-through', color: '#888' },
  barcode: { fontSize: 12, color: '#aaa', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  qty: { fontSize: 13, color: '#666' },
  check: { fontSize: 18, color: '#4CAF50', fontWeight: '700' },
});
