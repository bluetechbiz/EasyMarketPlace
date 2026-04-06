import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
// ✅ Import the Provider too
import { AppProvider, useAppContext } from '../src/context/AppContext';

// Force native splash to hide
SplashScreen.hideAsync().catch(() => {});

function RootLayoutContent() {
  const context = useAppContext();
  const [showSplash, setShowSplash] = useState(true);

  const loading = context ? context.loading : false;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading) {
      setShowSplash(false);
    }
  }, [loading]);

  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 22 }}>Loading... 🚀</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

// 🏆 THIS IS THE CRITICAL WRAPPER PART
export default function RootLayout() {
  return (
    <AppProvider>
      <RootLayoutContent />
    </AppProvider>
  );
}