import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import { exportReport } from '../services/csvService';
import { formatCheckedBy } from '../utils/checkedBy';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;

export default function ReportScreen({ navigation }: Props) {
  const {
    locations, unknownBarcodes, sessionScans, sessionUnknownBarcodes,
    checkedByAlias, displayName, generateReport,
  } = useInventoryStore();
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  function locationName(id: string) {
    return locations.find(l => l.id === id)?.name ?? id;
  }

  async function handleSubmit() {
    setBusy(true);
    try {
      await generateReport();
      Alert.alert('Report submitted', 'The master file has been updated.', [
        { text: 'OK', onPress: () => navigation.navigate('Landing') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    setBusy(true);
    try {
      await exportReport(locations, unknownBarcodes, formatCheckedBy(displayName, checkedByAlias));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not export report.');
    } finally {
      setBusy(false);
    }
  }

  const isEmpty = sessionScans.length === 0 && sessionUnknownBarcodes.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.title}>Report</Text>
        <Text style={styles.subtitle}>Changes made this session</Text>
      </View>

      {isEmpty && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nothing scanned this session yet.</Text>
        </View>
      )}

      {!isEmpty && (
        <FlatList
          style={styles.list}
          data={sessionScans}
          keyExtractor={(item, index) => `${item.locationId}_${item.barcode}_${index}`}
          ListHeaderComponent={sessionScans.length > 0 ? <Text style={styles.sectionLabel}>Scanned items</Text> : null}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>{locationName(item.locationId)} · {item.barcode}</Text>
            </View>
          )}
          ListFooterComponent={
            sessionUnknownBarcodes.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>Unknown barcodes</Text>
                {sessionUnknownBarcodes.map((u, index) => (
                  <View key={`${u.locationId}_${u.barcode}_${index}`} style={styles.row}>
                    <Text style={styles.rowName}>{u.barcode}</Text>
                    <Text style={styles.rowMeta}>{locationName(u.locationId)}</Text>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      )}

      {busy && <ActivityIndicator style={styles.loader} size="large" color="#4CAF50" />}

      <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => navigation.goBack()} disabled={busy}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.printBtn]} onPress={handlePrint} disabled={busy}>
          <Text style={styles.btnText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.submitBtn]} onPress={handleSubmit} disabled={busy}>
          <Text style={styles.btnText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  subtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 15, color: '#aaa' },
  list: { flex: 1 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  rowMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  loader: { marginVertical: 12 },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: { backgroundColor: '#eee' },
  cancelBtnText: { color: '#555', fontWeight: '700', fontSize: 14 },
  printBtn: { backgroundColor: '#757575' },
  submitBtn: { backgroundColor: '#1565C0' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
