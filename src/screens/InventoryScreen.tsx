import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Item } from '../types';
import { useInventoryStore } from '../store/inventoryStore';
import ItemRow, { Mismatch } from '../components/ItemRow';
import LocationDropdown from '../components/LocationDropdown';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import DemoBanner from '../components/DemoBanner';
import { exportReport, serializeReport } from '../services/csvService';
import { toLocationId } from '../services/googleSheetsService';
import { formatCheckedBy } from '../utils/checkedBy';

type Props = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

export default function InventoryScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const insets = useSafeAreaInsets();
  const locations = useInventoryStore(s => s.locations);
  const unknownBarcodes = useInventoryStore(s => s.unknownBarcodes);
  const checkedByAlias = useInventoryStore(s => s.checkedByAlias);
  const displayName = useInventoryStore(s => s.displayName);
  const loading = useInventoryStore(s => s.loading);
  const demoMode = useInventoryStore(s => s.demoMode);
  const setCurrentLocation = useInventoryStore(s => s.setCurrentLocation);
  const loadInventory = useInventoryStore(s => s.loadInventory);
  const generateReport = useInventoryStore(s => s.generateReport);
  const flushUnknownBarcodes = useInventoryStore(s => s.flushUnknownBarcodes);
  const location = locations.find(l => l.id === locationId);
  const [busy, setBusy] = useState(false);

  // Everything that should be here plus everything currently here: items whose
  // Current Location points elsewhere are flagged, and items from other
  // locations whose Current Location points here are appended.
  const listData: { item: Item; mismatch?: Mismatch }[] = [];
  if (location) {
    for (const item of location.items) {
      const away = item.currentLocation && toLocationId(item.currentLocation) !== locationId;
      listData.push(away
        ? { item, mismatch: { type: 'currently-in', locationName: item.currentLocation! } }
        : { item });
    }
    for (const other of locations) {
      if (other.id === locationId) continue;
      for (const item of other.items) {
        if (item.currentLocation && toLocationId(item.currentLocation) === locationId) {
          listData.push({ item, mismatch: { type: 'belongs-in', locationName: other.name } });
        }
      }
    }
  }

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

  async function handlePrint() {
    if (!location) return;
    setBusy(true);
    try {
      const checkedBy = formatCheckedBy(displayName, checkedByAlias);
      const locationUnknowns = unknownBarcodes.filter(u => u.locationId === locationId);
      if (demoMode) {
        const csv = serializeReport([location], locationUnknowns, checkedBy, locations);
        const file = new File(Paths.cache, `demo-report-${locationId}.csv`);
        if (file.exists) file.delete();
        file.create();
        file.write(csv);
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
        await flushUnknownBarcodes(locationId);
        return;
      }
      await exportReport([location], locationUnknowns, checkedBy, locations);
      await flushUnknownBarcodes(locationId);
      Alert.alert('Report uploaded', `${location.name} report has been uploaded to the reports folder.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not export report.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await generateReport(locationId);
      Alert.alert(
        demoMode ? 'Report submitted (demo)' : 'Report submitted',
        demoMode
          ? `${location!.name} has been updated locally.`
          : `${location!.name} has been updated on the master file.`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'← Back'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} disabled={loading || busy} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{loading ? 'Refreshing…' : '↻ Refresh'}</Text>
          </TouchableOpacity>
        </View>
        <LocationDropdown
          locations={locations}
          selectedId={locationId}
          onSelect={handleSwitchLocation}
        />
      </View>
      <DemoBanner />

      <FlatList
        data={listData}
        keyExtractor={entry => entry.item.barcode}
        renderItem={({ item: entry }) => <ItemRow item={entry.item} mismatch={entry.mismatch} />}
      />

      {busy && <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />}

      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.scanBtn]}
          onPress={() => navigation.navigate('Scanner', { locationId })}
          disabled={busy}
        >
          <Text style={styles.bottomBtnText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.printBtn]}
          onPress={handlePrint}
          disabled={busy}
        >
          <Text style={styles.bottomBtnText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.bottomBtn, styles.submitBtn]}
          onPress={handleSubmit}
          disabled={busy}
        >
          <Text style={styles.bottomBtnText}>Submit</Text>
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
  loader: { marginVertical: 12 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
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
  printBtn: { backgroundColor: '#757575' },
  submitBtn: { backgroundColor: '#1565C0' },
  bottomBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
