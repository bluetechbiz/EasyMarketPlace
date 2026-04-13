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

// ✅ PATH: Adjust to reach your supabase client
import { supabase } from '../../src/lib/supabase';

// ==========================================
// SIGNUP SCREEN (Elite Production Tier)
// ==========================================
export default function SignupScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // 🔧 3. Instant Visual Feedback Logic
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const isPasswordTooShort = password.length > 0 && password.length < 6;

  // 🔧 Validation Logic (Elite Level)
  const isFormValid = 
    fullName.trim().length >= 2 && 
    /\S+@\S+\.\S+/.test(email) && 
    password.length >= 6 &&
    password === confirmPassword;

  const handleSignup = useCallback(async () => {
    if (!isFormValid || isLoading) return;
    
    // 🟡 1. Final Trim (Prevents cursor jump while typing)
    const cleanEmail = email.trim().toLowerCase(); 
    const cleanPassword = password.trim();
    const cleanName = fullName.trim();

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: { 
          data: { full_name: cleanName } 
        },
      });

      if (error) throw error;

      if (data.user) {
        Alert.alert(
          'Success', 
          'Welcome! Please check your email to verify your account.', 
          [{ text: 'Got it', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (error: any) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes('already registered') || msg.includes('user exists')) {
        Alert.alert('Account Exists', 'This email is already registered. Try logging in.');
      } else if (msg.includes('invalid email')) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
      } else if (msg.includes('password')) {
        Alert.alert('Weak Password', 'Password should be at least 6 characters.');
      } else if (msg.includes('network') || msg.includes('fetch')) {
        Alert.alert('Network Error', 'Check your internet connection.');
      } else {
        Alert.alert('Signup Error', error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fullName, email, password, confirmPassword, router, isFormValid, isLoading]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient colors={['#F8FAFC', '#EEF2F7']} style={{ flex: 1 }}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              
              <View style={styles.mainCard}>
                <View style={styles.logoContainer}>
                  <Image source={require('../../assets/mymarketplace-logo.png')} style={styles.logoImage} resizeMode="contain" />
                </View>

                <Text style={styles.headerTitle}>Create Account</Text>
                <Text style={styles.headerSubtitle}>Join our premium marketplace</Text>

                {/* NAME INPUT */}
                <View style={[styles.inputWrapper, focusedInput === 'name' && styles.inputFocused]}>
                  <Feather name="user" size={20} color={focusedInput === 'name' ? '#00A37A' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#cbd5e1"
                    onFocus={() => setFocusedInput('name')}
                    onBlur={() => setFocusedInput(null)}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    autoComplete="name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>

                {/* EMAIL INPUT */}
                <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputFocused]}>
                  <Feather name="mail" size={20} color={focusedInput === 'email' ? '#00A37A' : '#94A3B8'} style={styles.inputIcon} />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#cbd5e1"
                    onFocus={() => setFocusedInput('email')}
                    onBlur={() => setFocusedInput(null)}
                    value={email}
                    // 🟡 1. Lowercase only (No trim here to prevent cursor jump)
                    onChangeText={(text) => setEmail(text.toLowerCase())} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email" 
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>

                {/* PASSWORD INPUT */}
                <View style={[
                  styles.inputWrapper, 
                  focusedInput === 'password' && styles.inputFocused,
                  isPasswordTooShort && { borderColor: '#ef4444' }
                ]}>
                  <Feather name="lock" size={20} color={isPasswordTooShort ? '#ef4444' : (focusedInput === 'password' ? '#00A37A' : '#94A3B8')} style={styles.inputIcon} />
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
                    autoComplete="password-new" 
                    textContentType="newPassword"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {/* 🟡 2. Password Strength Hint */}
                {isPasswordTooShort && (
                  <Text style={styles.strengthHint}>Password must be at least 6 characters</Text>
                )}

                {/* CONFIRM PASSWORD INPUT */}
                <View style={[
                  styles.inputWrapper, 
                  focusedInput === 'confirmPassword' && styles.inputFocused,
                  !passwordsMatch && { borderColor: '#ef4444', borderWidth: 2 },
                  password.length < 6 && { opacity: 0.6, backgroundColor: '#F8FAFC' }
                ]}>
                  <Feather name="shield" size={20} color={!passwordsMatch ? '#ef4444' : (focusedInput === 'confirmPassword' ? '#00A37A' : '#94A3B8')} style={styles.inputIcon} />
                  <TextInput
                    ref={confirmPasswordRef}
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor="#cbd5e1"
                    // 🟡 3. Disable Confirm until Password is valid length
                    editable={password.length >= 6} 
                    onFocus={() => setFocusedInput('confirmPassword')}
                    onBlur={() => setFocusedInput(null)}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                  />
                </View>

                <TouchableOpacity 
                  onPress={handleSignup} 
                  disabled={!isFormValid || isLoading} 
                  style={styles.buttonContainer} 
                  activeOpacity={0.8}
                >
                  <LinearGradient 
                    colors={(!isFormValid || isLoading) ? ['#CBD5E1', '#94A3B8'] : ['#00C897', '#00A37A']} 
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }} 
                    style={styles.actionBtn}
                  >
                    {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.actionBtnText}>Create Account</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footerWrapper}>
                  <Text style={styles.footerText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                    <Text style={styles.linkText}>Sign In</Text>
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
  strengthHint: { alignSelf: 'flex-start', color: '#ef4444', fontSize: 12, marginTop: -12, marginBottom: 12, marginLeft: 8, fontWeight: '600' },
  buttonContainer: { width: '100%', marginTop: 10, marginBottom: 20 },
  actionBtn: { borderRadius: 18, height: 62, width: '100%', justifyContent: 'center', alignItems: 'center', shadowColor: '#00A37A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  actionBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, letterSpacing: 0.8 },
  footerWrapper: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 15, color: '#64748b' },
  linkText: { fontSize: 15, color: '#00A37A', fontWeight: '800' },
});