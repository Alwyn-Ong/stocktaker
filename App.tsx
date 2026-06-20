import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LocationsScreen from './src/screens/LocationsScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ScannerScreen from './src/screens/ScannerScreen';

export type RootStackParamList = {
  Locations: undefined;
  Inventory: { locationId: string };
  Scanner: { locationId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Locations" component={LocationsScreen} />
        <Stack.Screen name="Inventory" component={InventoryScreen} />
        <Stack.Screen name="Scanner" component={ScannerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
