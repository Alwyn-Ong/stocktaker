import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Location } from '../types';

type Props = {
  locations: Location[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export default function LocationDropdown({ locations, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const selected = locations.find(l => l.id === selectedId) ?? null;

  function renderCount(location: Location) {
    const total = location.items.length;
    const done = location.items.filter(i => i.done).length;
    return `${done}/${total}`;
  }

  function handleSelect(id: string) {
    onSelect(id);
    setOpen(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.closed} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <View style={styles.closedText}>
          <Text style={styles.closedName}>{selected ? selected.name : 'Select location'}</Text>
          {selected && <Text style={styles.closedCount}>{renderCount(selected)} done</Text>}
        </View>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Select Location</Text>
            <FlatList
              data={locations}
              keyExtractor={loc => loc.id}
              renderItem={({ item }) => {
                const total = item.items.length;
                const done = item.items.filter(i => i.done).length;
                const progress = total > 0 ? done / total : 0;
                const isSelected = item.id === selectedId;
                return (
                  <TouchableOpacity
                    style={[styles.row, isSelected && styles.rowSelected]}
                    onPress={() => handleSelect(item.id)}
                  >
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowCount}>{done}/{total}</Text>
                    </View>
                    <View style={styles.trackBg}>
                      <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  closedText: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  closedName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  closedCount: { fontSize: 13, color: '#666' },
  chevron: { fontSize: 16, color: '#666' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    maxHeight: '70%',
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  row: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#f5f5f5',
  },
  rowSelected: { backgroundColor: '#E8F5E9' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rowCount: { fontSize: 13, color: '#666' },
  trackBg: { height: 6, borderRadius: 3, backgroundColor: '#e0e0e0' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
});
