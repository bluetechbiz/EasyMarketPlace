import { StripeProvider } from '@stripe/stripe-react-native';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { AppProvider, useAppContext } from '../src/context/AppContext';
import { supabase } from '../src/lib/supabase';
import { CartService } from '../src/services/cartService';
import { useCartStore } from '../src/store/cartStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const context = useAppContext();
  const loading = context?.loading ?? false;
  const setCartItems = useCartStore((s) => s.setItems);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setup = async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#f97316',
        });
      }
    };
    setup();
  }, []);

  useEffect(() => {
    const loadCart = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      try {
        const cart = await CartService.fetchCart(user.id);
        setCartItems(cart);
        console.log("🛒 GLOBAL CART LOADED:", cart.length);
      } catch (err) {
        console.log("❌ Cart init error:", err);
      }
    };
    loadCart();
  }, []);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(async () => {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: '900' }}>ELITE MARKET 🚀</Text>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 1. This points to your (tabs) folder */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* 2. Authentication */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />

      {/* 3. Order Success (Matches file in app/ folder) */}
      <Stack.Screen
        name="order-success"
        options={{ presentation: 'modal', headerShown: false }}
      />

      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey="pk_test_51TIQilBuQf8jr31CEIkL0ubsa5rNzr3IvgPaEqM4XBSwl9ZwiYd07vOgiIMQZb654DVt5MqHnpbDD4cIgBUHbjcM00qFZuaK3y"
      merchantIdentifier="merchant.com.sajer.mymarketplace"
    >
      <AppProvider>
        <RootLayoutContent />
      </AppProvider>
    </StripeProvider>
  );
}