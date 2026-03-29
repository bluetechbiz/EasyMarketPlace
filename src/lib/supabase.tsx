import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// We switch to AsyncStorage to handle sessions larger than 2048 bytes
// This prevents the SecureStore warning and random logouts on Android.
const supabaseUrl = 'https://gjxfxibmjrbutovebjmq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqeGZ4aWJtanJidXRvdmViam1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjEwMjksImV4cCI6MjA4OTU5NzAyOX0.zuMkeJXCOPWnrO7YG0a5sUSz5RGn4382ACHuAVUJj7s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, 
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});