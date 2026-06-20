import React, { useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import LocationCard from '../components/LocationCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Locations'>;

export default function LocationsScreen({ navigation }: Props) {
  const { locations, loading, error, loadFromCSV, pickAndLoadCSV, setCurrentLocation, generateReport } =
    useInventoryStore();

  useEffect(() => {
    loadFromCSV(); // try default path on mount
  }, []);

  function handleLocationPress(locationId: string) {
    setCurrentLocation(locationId);
    navigation.navigate('Inventory', { locationId });
  }

  async function handleImport() {
    await pickAndLoadCSV();
  }

  async function handleReport() {
    if (locations.length === 0) {
      Alert.alert('No data', 'Import a CSV first.');
      return;
    }
    try {
      await generateReport();
    } catch {
      Alert.alert('Error', 'Could not generate report.');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Locations</Text>
        <TouchableOpacity onPress={handleImport} style={styles.importBtn}>
          <Text style={styles.importBtnText}>Import CSV</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />}

      {error && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No inventory loaded.</Text>
          <Text style={styles.emptySubText}>Tap "Import CSV" to get started.</Text>
        </View>
      )}

      <FlatList
        data={locations}
        keyExtractor={loc => loc.id}
        renderItem={({ item }) => (
          <LocationCard location={item} onPress={() => handleLocationPress(item.id)} />
        )}
        contentContainerStyle={styles.list}
      />

      {locations.length > 0 && (
        <TouchableOpacity onPress={handleReport} style={styles.reportBtn}>
          <Text style={styles.reportBtnText}>Generate Report</Text>
        </TouchableOpacity>
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
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  importBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  importBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  loader: { marginTop: 40 },
  list: { paddingVertical: 8 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptySubText: { fontSize: 14, color: '#aaa', marginTop: 6 },
  reportBtn: {
    margin: 16,
    backgroundColor: '#1565C0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
