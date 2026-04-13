import * as Notifications from 'expo-notifications';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { registerForPushNotificationsAsync } from '../src/lib/notifications';

// Keep splash screen visible
SplashScreen.preventAutoHideAsync().catch(() => {});

// Notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Index() {
  const { currentUser, isLoading } = useAppContext();

  const [isReady, setIsReady] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // -----------------------------
  // NOTIFICATION SETUP
  // -----------------------------
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {});

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // -----------------------------
  // SAFETY TIMEOUT (AUTH FIX)
  // -----------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('Auth timeout triggered');
        setIsTimedOut(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  // -----------------------------
  // APP INITIALIZATION
  // -----------------------------
  useEffect(() => {
    const prepare = async () => {
      if (!isLoading || isTimedOut) {
        try {
          if (currentUser?.id) {
            await registerForPushNotificationsAsync(currentUser.id);
          }
        } catch (e) {
          console.warn('Push registration failed', e);
        } finally {
          await SplashScreen.hideAsync().catch(() => {});
          setIsReady(true);
        }
      }
    };

    prepare();
  }, [isLoading, isTimedOut, currentUser?.id]);

  // -----------------------------
  // LOADING SCREEN
  // -----------------------------
  if (!isReady && !isTimedOut) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#fff',
        }}
      >
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={{ marginTop: 10, fontWeight: '600', color: '#666' }}>
          Loading Marketplace...
        </Text>
      </View>
    );
  }

  // -----------------------------
  // REDIRECT IF NOT LOGGED IN
  // -----------------------------
  if (!currentUser || isTimedOut) {
    return <Redirect href="/(auth)/login" />;
  }

  // -----------------------------
  // MAIN APP ENTRY
  // -----------------------------
  return <Redirect href="/(tabs)/home" />;
}