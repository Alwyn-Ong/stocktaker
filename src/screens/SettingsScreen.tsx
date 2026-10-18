import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useInventoryStore } from '../store/inventoryStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const {
    driveConnected, displayName, checkedByAlias, demoMode, exitDemo,
    disconnectDrive, hydrateSettings, setCheckedByAlias,
  } = useInventoryStore();

  const [alias, setAlias] = useState('');

  useEffect(() => {
    hydrateSettings();
  }, []);

  useEffect(() => {
    setAlias(checkedByAlias ?? '');
  }, [checkedByAlias]);

  function handleAliasBlur() {
    setCheckedByAlias(alias);
  }

  async function handleSignOut() {
    await disconnectDrive();
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
        <Text style={styles.sectionLabel}>Name (optional)</Text>
        <TextInput
          style={styles.input}
          value={alias}
          onChangeText={setAlias}
          onBlur={handleAliasBlur}
          placeholder="alias"
          placeholderTextColor="#aaa"
        />
        <Text style={styles.helperText}>
          Added in parentheses after your Google account name — e.g. &quot;{displayName || 'Jane Doe'} (Warehouse 2)&quot; — on the master sheet and reports.
        </Text>

        <Text style={[styles.sectionLabel, styles.accountLabel]}>Google account</Text>

        {demoMode ? (
          <>
            <Text style={styles.fileLabel}>Demo mode ({displayName})</Text>
            <TouchableOpacity style={styles.disconnectBtn} onPress={exitDemo}>
              <Text style={styles.disconnectBtnText}>Exit demo</Text>
            </TouchableOpacity>
          </>
        ) : driveConnected ? (
          <>
            <Text style={styles.fileLabel}>
              {displayName ? `Signed in as ${displayName}` : 'Signed in'}
            </Text>
            <TouchableOpacity style={styles.disconnectBtn} onPress={handleSignOut}>
              <Text style={styles.disconnectBtnText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.fileLabel}>Not connected.</Text>
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
  accountLabel: { marginTop: 24 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
  },
  helperText: { fontSize: 12, color: '#999', marginTop: 8 },
  disconnectBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  disconnectBtnText: { color: '#f44336', fontWeight: '600', fontSize: 15 },
  fileLabel: { fontSize: 14, color: '#555', marginBottom: 8 },
});
