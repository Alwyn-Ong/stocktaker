import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Location } from '../types';

type Props = {
  location: Location;
  onPress: () => void;
};

export default function LocationCard({ location, onPress }: Props) {
  const total = location.items.length;
  const done = location.items.filter(i => i.done).length;
  const progress = total > 0 ? done / total : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.name}>{location.name}</Text>
        <Text style={styles.count}>{done}/{total}</Text>
      </View>
      <View style={styles.trackBg}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  count: { fontSize: 14, color: '#666' },
  trackBg: { height: 6, borderRadius: 3, backgroundColor: '#e0e0e0' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
});
