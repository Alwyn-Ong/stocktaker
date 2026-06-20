import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

export default function LandingScreen({ navigation }: Props) {
  const hydrateSettings = useInventoryStore(s => s.hydrateSettings);

  useEffect(() => {
    hydrateSettings();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Exit app?', 'Are you sure you want to exit Stocktaker?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
        <Text style={styles.settingsBtnText}>⚙</Text>
      </TouchableOpacity>

      <View style={styles.center}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Stocktaker</Text>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => navigation.navigate('LocationPicker')}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  settingsBtn: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtnText: { fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 40 },
  continueBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
