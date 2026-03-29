import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
// Use the legacy import path for SDK 54 compatibility
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';
import { supabase } from '../../src/lib/supabase';

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=68';
const COLORS = {
  primary: '#10b981', // Your MyMarketPlace Emerald
  white: '#ffffff',
  grayLight: '#f8fafc',
  grayText: '#64748b',
  red: '#ef4444',
  blue: '#3b82f6',
  dark: '#0f172a',
};

interface MenuButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}

export default function ProfileScreen() {
  const { currentUser, listings = [], favorites = [], logout } = useAppContext();
  const router = useRouter();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [isEditingName, setIsEditingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const myListings = useMemo(
    () => listings.filter((item) => item.userId === currentUser?.id),
    [listings, currentUser]
  );

  const loadProfileData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (profile) {
        setDisplayName(profile.full_name || 'User');
        setAvatarUri(profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : null);
      }
    } catch (err: any) {
      console.error('Load Profile Error:', err.message);
    }
  }, []);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const saveName = async () => {
    if (!displayName.trim()) return Alert.alert('Error', 'Name cannot be empty');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ full_name: displayName.trim() })
        .eq('id', user.id);

      if (error) throw error;
      setIsEditingName(false);
      Alert.alert('Success', 'Profile updated');
    } catch (err: any) {
      Alert.alert('Error', 'Could not save name');
    }
  };

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Error', 'Gallery access required');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, 
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, 
      });

      if (result.canceled || !result.assets?.[0]) return;

      setIsLoadingAvatar(true);
      const assetUri = result.assets[0].uri;

      const manipResult = await ImageManipulator.manipulateAsync(
        assetUri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileName = `avatar-${currentUser?.id || Date.now()}-${Date.now()}.jpg`;

      if (avatarUri && !avatarUri.includes('pravatar.cc')) {
        try {
          const oldPath = avatarUri.split('/').pop()?.split('?')[0];
          if (oldPath) {
            await supabase.storage.from('AVATARS').remove([oldPath]);
          }
        } catch (e) {
          console.log("Cleanup skipped");
        }
      }

      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, {
        encoding: 'base64', 
      });

      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from('AVATARS') 
        .upload(fileName, arrayBuffer, { 
          upsert: true, 
          contentType: 'image/jpeg' 
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('AVATARS').getPublicUrl(fileName);
      
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', currentUser?.id);

      if (dbError) throw dbError;

      setAvatarUri(`${urlData.publicUrl}?t=${Date.now()}`);
      Alert.alert('Success', 'Profile picture updated!');
    } catch (err: any) {
      console.error('Upload Error Details:', err);
      Alert.alert('Upload Failed', `Error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await logout?.();
              router.replace('/(auth)/login');
            } catch (err) {
              Alert.alert('Error', 'Could not sign out properly.');
            }
          } 
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <View style={styles.header}>
            {/* BRANDING BADGE */}
            <View style={styles.brandBadge}>
               <Image 
                source={require('../../assets/icon_v1.png')}
                style={styles.brandIcon}
                contentFit="contain"
              />
              <Text style={styles.brandText}>MYMARKETPLACE</Text>
            </View>

            <TouchableOpacity onPress={pickAvatar} disabled={isLoadingAvatar}>
              <View style={styles.avatarContainer}>
                {isLoadingAvatar ? (
                  <View style={[styles.avatar, styles.loaderContainer]}><ActivityIndicator color={COLORS.primary} /></View>
                ) : (
                  <>
                    <Image 
                        source={{ uri: avatarUri || DEFAULT_AVATAR }} 
                        style={styles.avatar} 
                        cachePolicy="none" 
                        transition={200} 
                    />
                    <View style={styles.cameraOverlay}><Ionicons name="camera" size={16} color={COLORS.white} /></View>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {isEditingName ? (
              <View style={styles.nameEditContainer}>
                <TextInput
                  style={styles.nameInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoFocus
                  onSubmitEditing={saveName}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                />
                <TouchableOpacity onPress={saveName}><Ionicons name="checkmark-circle" size={28} color={COLORS.white} /></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.nameRow}>
                <Text style={styles.name}>{displayName}</Text>
                <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statCard}><Text style={styles.statValue}>{myListings.length}</Text><Text style={styles.statLabel}>Ads</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}><Text style={styles.statValue}>{favorites.length}</Text><Text style={styles.statLabel}>Saved</Text></View>
          </View>

          <View style={styles.menuWrapper}>
            <Text style={styles.menuSectionTitle}>ACCOUNT DASHBOARD</Text>
            <View style={styles.menuCard}>
              <MenuButton 
                icon="chatbubbles-outline" 
                color={COLORS.blue} 
                label="Messages" 
                onPress={() => router.push('/(tabs)/chat')} 
              />
              <MenuButton 
                icon="heart-outline" 
                color={COLORS.red} 
                label="Your Favorites" 
                onPress={() => router.push('/favorites')} 
                isLast 
              />
            </View>
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MenuButton = ({ icon, color, label, onPress, isLast }: MenuButtonProps) => (
  <TouchableOpacity style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]} onPress={onPress}>
    <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}><Ionicons name={icon} size={20} color={color} /></View>
    <Text style={styles.menuText}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.grayLight },
  header: { paddingTop: 10, paddingBottom: 60, alignItems: 'center', backgroundColor: COLORS.primary, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  brandBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 20 },
  brandIcon: { width: 16, height: 16, marginRight: 6 },
  brandText: { color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.white },
  loaderContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.dark, borderRadius: 15, width: 30, height: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 22, fontWeight: 'bold', color: COLORS.white },
  nameEditContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, width: '70%' },
  nameInput: { flex: 1, fontSize: 18, fontWeight: 'bold', color: COLORS.white, height: 45 },
  statsContainer: { flexDirection: 'row', backgroundColor: COLORS.white, marginTop: -30, marginHorizontal: 24, borderRadius: 20, paddingVertical: 20, elevation: 5 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.dark },
  statLabel: { fontSize: 12, color: COLORS.grayText },
  statDivider: { width: 1, height: '50%', backgroundColor: '#f1f5f9', alignSelf: 'center' },
  menuWrapper: { marginTop: 24, paddingHorizontal: 20 },
  menuSectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 10, marginLeft: 4, letterSpacing: 0.5 },
  menuCard: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' },
  signOutButton: { marginHorizontal: 20, marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#fee2e2' },
  signOutText: { color: COLORS.red, fontWeight: 'bold', fontSize: 16 },
});