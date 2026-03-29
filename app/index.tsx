// app/index.tsx
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppContext } from '../src/context/AppContext';

export default function Index() {
  const { currentUser, isLoading } = useAppContext();

  // 1. While checking the session, show a clean loader
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // 2. If no user is found, redirect to the Login screen
  if (!currentUser) {
    return <Redirect href="/(auth)/login" replace />;
  }

  // 3. If user is logged in, redirect to the Home tab
  return <Redirect href="/(tabs)/home" replace />;
}