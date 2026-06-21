import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import ItemRow from '../components/ItemRow';
import LocationDropdown from '../components/LocationDropdown';

type Props = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

export default function InventoryScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const insets = useSafeAreaInsets();
  const locations = useInventoryStore(s => s.locations);
  const loading = useInventoryStore(s => s.loading);
  const setCurrentLocation = useInventoryStore(s => s.setCurrentLocation);
  const loadInventory = useInventoryStore(s => s.loadInventory);
  const location = locations.find(l => l.id === locationId);

  if (!location) {
    return (
      <View style={styles.center}>
        <Text>Location not found.</Text>
      </View>
    );
  }

  function handleSwitchLocation(id: string) {
    setCurrentLocation(id);
    navigation.setParams({ locationId: id });
  }

  async function handleRefresh() {
    await loadInventory();
    const { error } = useInventoryStore.getState();
    if (error) Alert.alert('Refresh failed', error);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'← Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} disabled={loading} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{loading ? 'Refreshing…' : '↻ Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <LocationDropdown
          locations={locations}
          selectedId={locationId}
          onSelect={handleSwitchLocation}
        />
      </View>

      <FlatList
        data={location.items}
        keyExtractor={item => item.barcode}
        renderItem={({ item }) => <ItemRow item={item} />}
      />

      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.scanBtn]}
          onPress={() => navigation.navigate('Scanner', { locationId })}
        >
          <Text style={styles.bottomBtnText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.reportBtn]}
          onPress={() => navigation.navigate('Report')}
        >
          <Text style={styles.bottomBtnText}>Finish / Generate Report</Text>
        </TouchableOpacity>
      </View>
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
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {},
  backText: { color: '#4CAF50', fontSize: 15 },
  refreshBtn: {},
  refreshText: { color: '#1565C0', fontSize: 15 },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  bottomBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  scanBtn: { backgroundColor: '#4CAF50' },
  reportBtn: { backgroundColor: '#1565C0' },
  bottomBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
