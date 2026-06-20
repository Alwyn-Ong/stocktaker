import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import ItemRow from '../components/ItemRow';

type Props = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

export default function InventoryScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const locations = useInventoryStore(s => s.locations);
  const location = locations.find(l => l.id === locationId);

  if (!location) {
    return (
      <View style={styles.center}>
        <Text>Location not found.</Text>
      </View>
    );
  }

  const done = location.items.filter(i => i.done).length;
  const total = location.items.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'← Back'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{location.name}</Text>
          <Text style={styles.progress}>{done}/{total} done</Text>
        </View>
      </View>

      <FlatList
        data={location.items}
        keyExtractor={item => item.barcode}
        renderItem={({ item }) => <ItemRow item={item} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Scanner', { locationId })}
      >
        <Text style={styles.fabText}>Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerBar: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { marginBottom: 8 },
  backText: { color: '#4CAF50', fontSize: 15 },
  headerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  progress: { fontSize: 14, color: '#666' },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: '#4CAF50',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
