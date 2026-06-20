import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation, route }: Props) {
  const { locationId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [toast, setToast] = useState<{ message: string; color: string } | null>(null);
  const cooldown = useRef(false);

  const { locations, markDone, recordUnknownBarcode } = useInventoryStore();
  const location = locations.find(l => l.id === locationId);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission]);

  function showToast(message: string, color: string) {
    setToast({ message, color });
    setTimeout(() => setToast(null), 2000);
  }

  function handleBarCodeScanned({ data }: BarcodeScanningResult) {
    if (cooldown.current) return;
    cooldown.current = true;
    setTimeout(() => { cooldown.current = false; }, 2500);

    if (!location) return;

    const item = location.items.find(i => i.barcode === data);
    if (!item) {
      recordUnknownBarcode(data, locationId);
      showToast(`Unknown barcode: ${data}`, '#f44336');
      return;
    }
    if (item.done) {
      showToast(`Already scanned: ${item.name}`, '#FF9800');
      return;
    }

    markDone(data, locationId);
    showToast(`✓ ${item.name}`, '#4CAF50');
  }

  if (!permission) {
    return <View style={styles.center}><Text>Requesting camera permission…</Text></View>;
  }
  if (!permission.granted) {
    return <View style={styles.center}><Text>Camera permission denied.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={handleBarCodeScanned}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.overlay}>
        <View style={styles.topBar}>
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

        <Text style={styles.hint}>Point camera at a barcode</Text>
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
    paddingBottom: 48,
  },
  topBar: {
    paddingTop: 56,
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
  hint: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 14 },
});
