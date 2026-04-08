// app/index.tsx
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAppContext } from '../src/context/AppContext';

export default function Index() {
  const { currentUser, isLoading } = useAppContext();
  const [isTimedOut, setIsTimedOut] = useState(false);

  // 1. Safety Timeout: Don't let the user stare at a spinner forever
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn("Auth check timed out. Redirecting to login as fallback.");
        setIsTimedOut(true);
      }
    }, 8000); // 8 seconds is the "sweet spot" for mobile patience

    return () => clearTimeout(timer);
  }, [isLoading]);

  // 2. Hide Splash Screen when loading is done OR timeout hits
  useEffect(() => {
    if (!isLoading || isTimedOut) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading, isTimedOut]);

  // 3. While strictly loading (and not timed out), show the brand-colored spinner
  if (isLoading && !isTimedOut) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // 4. THE REDIRECT LOGIC (with your 'replace' and 'timeout' suggestions)
  // If no user found OR if the session check hung for too long, send to Login
  if (!currentUser || isTimedOut) {
    return <Redirect href="/(auth)/login" replace />;
  }

  // 5. Success: User is authenticated, send to Home
  return <Redirect href="/(tabs)/home" replace />;
}