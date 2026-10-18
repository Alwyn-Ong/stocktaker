import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Alert, BackHandler, ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const APP_NAME: string = Constants.expoConfig?.extra?.appName ?? 'Stocktaker';
const DEMO_ENABLED: boolean = Constants.expoConfig?.extra?.demoEnabled === true;

export default function LandingScreen({ navigation }: Props) {
  const { driveConnected, displayName, hydrateSettings, connectDrive, startDemo } = useInventoryStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrateSettings();
  }, []);

  async function handlePress() {
    if (driveConnected) {
      navigation.navigate('LocationPicker');
      return;
    }
    setBusy(true);
    try {
      await connectDrive();
    } catch (e: any) {
      Alert.alert('Connection failed', e?.message ?? 'Could not connect to Google.');
    } finally {
      setBusy(false);
    }
  }

  function handleDemo() {
    startDemo();
    navigation.navigate('LocationPicker');
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Exit app?', `Are you sure you want to exit ${APP_NAME}?`, [
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
        <Image source={require('../../assets/logo-override.png')} style={styles.logo} />
        <Text style={styles.title}>{APP_NAME}</Text>

        {driveConnected && (
          <Text style={styles.signedInText}>
            {displayName ? `Signed in as ${displayName}` : 'Signed in'}
          </Text>
        )}

        {busy ? (
          <ActivityIndicator color="#4CAF50" />
        ) : (
          <TouchableOpacity style={styles.continueBtn} onPress={handlePress}>
            <Text style={styles.continueBtnText}>
              {driveConnected ? 'Continue' : 'Connect Google'}
            </Text>
          </TouchableOpacity>
        )}

        {DEMO_ENABLED && !busy && (
          <TouchableOpacity style={styles.demoBtn} onPress={handleDemo}>
            <Text style={styles.demoBtnText}>Try Demo</Text>
          </TouchableOpacity>
        )}
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
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 20 },
  signedInText: { fontSize: 14, color: '#555', marginBottom: 20 },
  continueBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  demoBtn: { marginTop: 16, paddingHorizontal: 40, paddingVertical: 12 },
  demoBtnText: { color: '#1565C0', fontSize: 15, fontWeight: '600' },
  continueBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
