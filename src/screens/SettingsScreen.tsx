import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';
import { listCSVFiles, DriveFile } from '../services/googleDriveService';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const {
    backend, driveFileId, driveFileName, driveConnected,
    setBackend, connectDrive, disconnectDrive, selectDriveFile, hydrateSettings,
  } = useInventoryStore();

  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrateSettings();
  }, []);

  async function handleSelectLocal() {
    await setBackend('local');
    setFiles(null);
  }

  async function handleSelectDrive() {
    await setBackend('drive');
  }

  async function handleConnect() {
    setBusy(true);
    try {
      await connectDrive();
      await fetchFiles();
    } catch (e: any) {
      Alert.alert('Connection failed', e?.message ?? 'Could not connect to Google Drive.');
    } finally {
      setBusy(false);
    }
  }

  async function fetchFiles() {
    setBusy(true);
    try {
      const result = await listCSVFiles();
      setFiles(result);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not list Drive files.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFile(file: DriveFile) {
    setBusy(true);
    try {
      await selectDriveFile(file.id, file.name);
      setFiles(null);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not select file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    await disconnectDrive();
    setFiles(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionLabel}>Storage</Text>

        <TouchableOpacity
          style={[styles.option, backend === 'local' && styles.optionSelected]}
          onPress={handleSelectLocal}
        >
          <Text style={styles.optionText}>Local file</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, backend === 'drive' && styles.optionSelected]}
          onPress={handleSelectDrive}
        >
          <Text style={styles.optionText}>Google Drive</Text>
        </TouchableOpacity>

        {backend === 'drive' && (
          <View style={styles.driveSection}>
            {busy && <ActivityIndicator style={styles.loader} color="#4CAF50" />}

            {!busy && !driveConnected && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleConnect}>
                <Text style={styles.actionBtnText}>Connect Google Drive</Text>
              </TouchableOpacity>
            )}

            {!busy && driveConnected && driveFileId && !files && (
              <>
                <Text style={styles.fileLabel}>Active file: {driveFileName}</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={fetchFiles}>
                  <Text style={styles.actionBtnText}>Change file</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
                  <Text style={styles.disconnectBtnText}>Disconnect</Text>
                </TouchableOpacity>
              </>
            )}

            {!busy && driveConnected && (!driveFileId || files) && (
              <>
                <Text style={styles.fileLabel}>Choose a CSV file:</Text>
                <FlatList
                  data={files ?? []}
                  keyExtractor={f => f.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.fileRow} onPress={() => handlePickFile(item)}>
                      <Text style={styles.fileRowText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <TouchableOpacity style={styles.actionBtn} onPress={fetchFiles}>
                      <Text style={styles.actionBtnText}>Load files</Text>
                    </TouchableOpacity>
                  }
                />
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { marginRight: 12 },
  backText: { color: '#1565C0', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#888', marginBottom: 8 },
  option: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: { borderColor: '#4CAF50' },
  optionText: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  driveSection: { marginTop: 16 },
  loader: { marginTop: 16 },
  actionBtn: {
    backgroundColor: '#1565C0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  disconnectBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  disconnectBtnText: { color: '#f44336', fontWeight: '600', fontSize: 15 },
  fileLabel: { fontSize: 14, color: '#555', marginBottom: 8 },
  fileRow: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 6,
  },
  fileRowText: { fontSize: 15, color: '#1a1a1a' },
});
