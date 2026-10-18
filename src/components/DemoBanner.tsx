import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInventoryStore } from '../store/inventoryStore';

export default function DemoBanner() {
  const navigation = useNavigation();
  const demoMode = useInventoryStore(s => s.demoMode);
  const exitDemo = useInventoryStore(s => s.exitDemo);

  if (!demoMode) return null;

  async function handleExit() {
    await exitDemo();
    navigation.dispatch({ type: 'POP_TO_TOP' });
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Demo mode — sample data, nothing is saved</Text>
      <TouchableOpacity onPress={handleExit}>
        <Text style={styles.exit}>Exit demo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF3CD',
  },
  text: { fontSize: 12, color: '#7A5C00' },
  exit: { fontSize: 12, fontWeight: '700', color: '#1565C0' },
});
