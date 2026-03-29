import { Ionicons } from '@expo/vector-icons';
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
import { supabase } from '../../src/lib/supabase'; // ✅ Your Supabase client

export default function SignupScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const isFormValid = fullName.trim() && email.trim() && password.trim();

  const handleSignup = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (cleanPassword.length < 6) {
      Alert.alert('Security', 'Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      // ✅ SUPABASE SIGNUP LOGIC
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: fullName.trim(), // Save the name to user metadata
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        Alert.alert(
          'Account Created',
          'Welcome to the premium marketplace!',
          [{ text: 'Start Shopping', onPress: () => router.replace('/(tabs)/profile') }]
        );
      }
    } catch (error: any) {
      console.error('Signup failed:', error.message);
      Alert.alert('Signup Error', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [fullName, email, password, router, isFormValid]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
            <View style={styles.header}>
              <View style={styles.logoWrapper}>
                <Image
                  source={require('../../assets/mymarketplace-logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join our premium marketplace</Text>
            </View>

            <View style={styles.form}>
              {/* Full Name */}
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor="#cbd5e1"
                  value={fullName}
                  onChangeText={setFullName}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              {/* Email */}
              <Text style={styles.inputLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor="#cbd5e1"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              {/* Password */}
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#cbd5e1"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, (!isFormValid || isLoading) && styles.submitButtonDisabled]}
                onPress={handleSignup}
                disabled={!isFormValid || isLoading}
                activeOpacity={0.75}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>Register</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.loginText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 30 },
  logoWrapper: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  logoImage: { width: '100%', height: '100%' },
  title: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 16, color: '#64748b' },
  form: { width: '100%' },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#475569', marginLeft: 4, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, paddingHorizontal: 16, marginBottom: 18, borderWidth: 1, borderColor: '#e2e8f0', height: 60 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: '#1e293b' },
  submitButton: { backgroundColor: '#1e293b', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitButtonDisabled: { backgroundColor: '#94a3b8' },
  submitButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { color: '#64748b', fontSize: 15 },
  loginText: { color: '#1e293b', fontWeight: '800', fontSize: 15 }
});