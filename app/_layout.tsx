// 1. MUST BE AT THE VERY TOP
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContext } from '../src/context/AppContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootLayoutInner />
      </AppProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutInner() {
  const { currentUser, loading } = useAppContext();
  const router = useRouter();
  const segments = useSegments();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Splash fade animation
  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 800, 
      useNativeDriver: true 
    }).start();
  }, []);

  // Redirect logic
  useEffect(() => {
    if (loading) return;
    
    const inAuthGroup = segments[0] === '(auth)';
    
    if (!currentUser && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (currentUser && inAuthGroup) {
      router.replace('/');
    }
  }, [loading, currentUser, segments]);

  // Splash screen while loading
  if (loading || currentUser === undefined) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#22c55e' }}>
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <View style={{ 
            width: 120, 
            height: 120, 
            borderRadius: 60, 
            backgroundColor: 'rgba(255,255,255,0.2)', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginBottom: 20 
          }}>
            <Ionicons name="cart" size={60} color="white" />
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="details" options={{ presentation: 'card' }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}