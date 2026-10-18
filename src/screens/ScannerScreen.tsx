import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import { toLocationId } from '../services/googleSheetsService';
import { DEMO_UNKNOWN_BARCODES } from '../demo/demoData';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);
  const cooldown = useRef(false);
  const askedPermission = useRef(false);

  const { locations, recordScan, recordUnknownBarcode, sessionScans, demoMode } = useInventoryStore();
  const location = locations.find(l => l.id === locationId);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && !askedPermission.current) {
      askedPermission.current = true;
      requestPermission();
    }
  }, [permission]);

  function showToast(message: string, color: string) {
    setToast({ message, color });
    setTimeout(() => setToast(null), 2000);
  }

  function handleBarCodeScanned({ data }: BarcodeScanningResult) {
    if (cooldown.current) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 2500);
    processBarcode(data);
  }

  function simulateItem() {
    const pending = new Set(sessionScans.map(s => s.barcode));
    const open = (l: typeof locations[number]) => l.items.filter(i => !i.done && !pending.has(i.barcode));
    const here = location ? open(location) : [];
    const pool = here.length > 0 ? here : locations.flatMap(open);
    if (pool.length === 0) {
      showToast('No unscanned demo items left', '#FF9800');
      return;
    }
    processBarcode(pool[Math.floor(Math.random() * pool.length)].barcode);
  }

  function simulateUnknown() {
    processBarcode(DEMO_UNKNOWN_BARCODES[Math.floor(Math.random() * DEMO_UNKNOWN_BARCODES.length)]);
  }

  function processBarcode(data: string) {
    if (!location) return;

    // The barcode may belong to any location, not just the one being scanned.
    const home = locations.find(l => l.items.some(i => i.barcode === data));
    const item = home?.items.find(i => i.barcode === data);
    if (!home || !item) {
      recordUnknownBarcode(data, locationId);
      showToast(`Unknown barcode: ${data}`, '#f44336');
      return;
    }

    const pending = sessionScans.some(s => s.barcode === data);
    const currentId = item.currentLocation ? toLocationId(item.currentLocation) : home.id;
    if (item.done && currentId === locationId && !pending) {
      showToast(`Already scanned: ${item.name}`, '#FF9800');
      return;
    }

    recordScan(data, locationId);
    if (home.id !== locationId) {
      showToast(`✓ ${item.name} — belongs in ${home.name}`, '#FF9800');
    } else {
      showToast(`✓ ${item.name}`, '#4CAF50');
    }
  }

  if (!permission) {
    return <View style={styles.center}><Text>Requesting camera permission…</Text></View>;
  }
  if (!permission.granted && !demoMode) {
    return <View style={styles.center}><Text>Camera permission denied.</Text></View>;
  }

  return (
    <View style={styles.container}>
      {permission.granted ? (
        <CameraView
          onBarcodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      <View style={[styles.overlay, { paddingBottom: 48 + insets.bottom }]}>
        <View style={[styles.topBar, { paddingTop: 56 + insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={styles.locationLabel}>{location?.name}</Text>
        </View>

        <View style={styles.reticle} />

        {toast && (
          <View style={[styles.toast, { backgroundColor: toast.color }]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}

        {demoMode ? (
          <View style={styles.demoRow}>
            <TouchableOpacity style={styles.demoBtn} onPress={simulateItem}>
              <Text style={styles.demoBtnText}>Simulate item</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.demoBtn, styles.demoBtnAlt]} onPress={simulateUnknown}>
              <Text style={styles.demoBtnText}>Simulate unknown</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.hint}>Point camera at a barcode</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: { padding: 8 },
  closeText: { color: '#fff', fontSize: 16 },
  locationLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  reticle: {
    alignSelf: 'center',
    width: 240,
    height: 160,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  toast: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  placeholder: { backgroundColor: '#111' },
  demoRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  demoBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  demoBtnAlt: { backgroundColor: '#f44336' },
  demoBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  hint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 14 },
});
