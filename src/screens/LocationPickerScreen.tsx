import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import LocationDropdown from '../components/LocationDropdown';

type Props = NativeStackScreenProps<RootStackParamList, 'LocationPicker'>;

export default function LocationPickerScreen({ navigation }: Props) {
  const {
    locations, loading, error, currentLocationId,
    loadInventory, setCurrentLocation,
  } = useInventoryStore();

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    if (!currentLocationId && locations.length > 0) {
      setCurrentLocation(locations[0].id);
    }
  }, [locations, currentLocationId]);

  function handleOpen() {
    if (!currentLocationId) {
      Alert.alert('No location selected', 'Select a location first.');
      return;
    }
    navigation.navigate('Inventory', { locationId: currentLocationId });
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹ Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Select Location</Text>
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />}

      {error && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Could not load inventory.</Text>
          <Text style={styles.emptySubText}>{error}</Text>
        </View>
      )}

      {!loading && locations.length > 0 && (
        <View style={styles.content}>
          <LocationDropdown
            locations={locations}
            selectedId={currentLocationId}
            onSelect={setCurrentLocation}
          />

          <TouchableOpacity style={styles.openBtn} onPress={handleOpen}>
            <Text style={styles.openBtnText}>Open</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {},
  backText: { color: '#1565C0', fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  loader: { marginTop: 40 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptySubText: { fontSize: 14, color: '#aaa', marginTop: 6 },
  content: { padding: 16 },
  openBtn: {
    marginTop: 16,
    backgroundColor: '#1565C0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  openBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
