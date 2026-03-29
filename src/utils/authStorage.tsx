import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as SecureStore from 'expo-secure-store';  // ← uncomment when ready

const USER_STORAGE_KEY = '@user_data';

/**
 * Save non-sensitive user data (profile info, preferences, etc.)
 * For tokens / sessions → use SecureStore instead
 */
export const saveUser = async (user: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Failed to save user to AsyncStorage', error);
  }
};

/**
 * Retrieve persisted user data
 * Returns null if missing, corrupted, or read fails
 */
export const getStoredUser = async (): Promise<any | null> => {
  try {
    const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Failed to read/parse stored user → clearing', error);
    await AsyncStorage.removeItem(USER_STORAGE_KEY).catch(() => {});
    return null;
  }
};

/**
 * Clear persisted user data (used on logout)
 */
export const clearUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear user storage', error);
  }
};

// ────────────────────────────────────────────────
//  Future: Secure storage for tokens / sessions
// ────────────────────────────────────────────────
/*
export const saveAuthToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync('auth_token', token);
  } catch (error) {
    console.error('SecureStore save failed', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.error('SecureStore read failed', error);
    return null;
  }
};

export const clearAuthToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync('auth_token');
  } catch (error) {
    console.error('SecureStore delete failed', error);
  }
};
*/