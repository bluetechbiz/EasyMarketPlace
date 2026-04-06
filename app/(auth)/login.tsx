import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ CORRECTED PATH
import { supabase } from '../../src/lib/supabase';

// ==========================================
// LOGIN SCREEN COMPONENT (Elite + Fixed)
// ==========================================
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);

  // 🔧 ELITE VALIDATION: Button only lights up if email pattern is actually valid
  const isFormValid = /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  const handleLogin = useCallback(async () => {
    if (isLoading) return;
    
    const cleanEmail = email.trim();
    const cleanPassword = password.trim(); 

    if (!cleanEmail || !cleanPassword) {
      Alert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (error) throw error;
      
      if (data.user) router.replace('/(tabs)/profile');
    } catch (error: any) {
      const msg = error.message.toLowerCase();
      if (msg.includes('invalid login credentials')) {
        Alert.alert('Login Failed', 'Incorrect email or password.');
      } else if (msg.includes('network')) {
        Alert.alert('Network Error', 'Please check your internet connection.');
      } else {
        Alert.alert('Error', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isLoading, router]);

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'mymarketplace://reset-password',
      });
      if (error) throw error;
      Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={['#F8FAFC', '#EEF2F7']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ flex: 1 }}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent} 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
            >
              
              <View style={styles.mainCard}>
                <View style={styles.logoContainer}>
                  <Image 
                    source={require('../../assets/mymarketplace-logo.png')} 
                    style={styles.logoImage} 
                    resizeMode="contain" 
                  />
                </View>

                <Text style={styles.headerTitle}>Welcome Back!</Text>
                <Text style={styles.headerSubtitle}>Sign in to continue</Text>

                {/* EMAIL INPUT */}
                <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputFocused]}>
                  <Feather name="mail" size={20} color={focusedInput === 'email' ? '#00A37A' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor="#cbd5e1"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    value={email}
                    onChangeText={setEmail} // 🔧 No more jumping cursor
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email" 
                    textContentType="emailAddress" // 🔧 iOS Autofill hint
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>

                {/* PASSWORD INPUT */}
                <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputFocused]}>
                  <Feather name="lock" size={20} color={focusedInput === 'password' ? '#00A37A' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#cbd5e1"
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    value={password}
                    onChangeText={setPassword} 
                    secureTextEntry={!showPassword}
                    autoComplete="password" 
                    textContentType="password" // 🔧 iOS Autofill hint
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  onPress={handleForgotPassword} 
                  style={styles.forgotPassBtn}
                  disabled={isResetting || isLoading} 
                >
                  {isResetting ? (
                    <ActivityIndicator size="small" color="#00A37A" />
                  ) : (
                    <Text style={styles.forgotPassText}>Forgot Password?</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleLogin} 
                  disabled={!isFormValid || isLoading} 
                  style={styles.buttonContainer} 
                  activeOpacity={0.9}
                >
                  <LinearGradient 
                    colors={(!isFormValid || isLoading) ? ['#CBD5E1', '#94A3B8'] : ['#00C897', '#00A37A']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }} 
                    style={styles.actionBtn}
                  >
                    {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.actionBtnText}>Log In</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.dividerContainer}>
                  {/* ✅ FIXED: Replaced <div> with <View> */}
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or sign in with</Text>
                  <View style={styles.dividerLine} />
                </View>

                <View style={styles.socialWrapper}>
                  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }} style={styles.socialIcon} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/733/733547.png' }} style={styles.socialIcon} />
                  </TouchableOpacity>
                </View>

                <View style={styles.footerWrapper}>
                  <Text style={styles.footerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                    <Text style={styles.linkText}>Register</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  mainCard: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 24, paddingVertical: 35, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 10 },
  logoContainer: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
  logoImage: { width: '60%', height: '60%' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 6 },
  headerSubtitle: { fontSize: 16, color: '#64748b', marginBottom: 35 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 18, marginBottom: 16, paddingHorizontal: 16, width: '100%', height: 62, borderWidth: 1.5, borderColor: '#F1F5F9' },
  inputFocused: { borderColor: '#00A37A', backgroundColor: '#FFFFFF' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#1e293b', fontWeight: '500' },
  forgotPassBtn: { alignSelf: 'flex-end', marginBottom: 30, height: 20, justifyContent: 'center' },
  forgotPassText: { color: '#00A37A', fontWeight: '700', fontSize: 14 },
  buttonContainer: { width: '100%', marginBottom: 20 },
  actionBtn: { borderRadius: 18, height: 62, width: '100%', justifyContent: 'center', alignItems: 'center', shadowColor: '#00A37A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, letterSpacing: 0.8 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, width: '100%' },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 10, color: '#64748B', fontSize: 14 },
  socialWrapper: { flexDirection: 'row', justifyContent: 'center', marginBottom: 25 },
  socialBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', marginHorizontal: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  socialIcon: { width: 24, height: 24 },
  footerWrapper: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 15, color: '#64748b' },
  linkText: { fontSize: 15, color: '#00A37A', fontWeight: '800' },
});