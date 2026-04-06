import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
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
const ADMIN_EMAILS = ['sajero351@gmail.com']; 

const COLORS = {
  primary: '#10b981', 
  white: '#ffffff',
  grayLight: '#f8fafc',
  grayText: '#64748b',
  red: '#ef4444',
  blue: '#3b82f6',
  dark: '#0f172a',
  purple: '#8b5cf6',
};

interface Order {
  id: string;
  amount: number;
  created_at: string;
  status: string;
  listings: { title: string; image_uri: string } | null;
}

export default function ProfileScreen() {
  const { currentUser, listings = [], favorites = [], logout } = useAppContext();
  const router = useRouter();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [isEditingName, setIsEditingName] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Robust Admin Check
  const isAdmin = useMemo(() => {
    const email = currentUser?.email || currentUser?.user_metadata?.email;
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.toLowerCase().trim());
  }, [currentUser]);

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
        if (profile.avatar_url) {
          setAvatarUri(`${profile.avatar_url}?t=${Date.now()}`);
        }
      }

      setLoadingActivity(true);
      const { data: purchaseData } = await supabase
        .from('orders')
        .select('*, listings(title, image_uri)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      const { data: salesData } = await supabase
        .from('orders')
        .select('*, listings(title, image_uri)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setOrders(purchaseData || []);
      setSales(salesData || []);
    } catch (err: any) {
      console.error('Load Profile Error:', err.message);
    } finally {
      setLoadingActivity(false);
    }
  }, [currentUser]);

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
      const { error } = await supabase.from('profiles').update({ full_name: displayName.trim() }).eq('id', user.id);
      if (error) throw error;
      setIsEditingName(false);
      Alert.alert('Success', 'Profile updated');
    } catch (err) {
      Alert.alert('Error', 'Could not save name');
    }
  };

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Error', 'Gallery access required');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1, 
      });
      if (result.canceled || !result.assets?.[0]) return;

      setIsLoadingAvatar(true);
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri, [{ resize: { width: 400, height: 400 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      const fileName = `avatar-${currentUser?.id}-${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(manipResult.uri, { encoding: 'base64' });
      const { error: uploadError } = await supabase.storage.from('AVATARS').upload(fileName, decode(base64), { 
        upsert: true, contentType: 'image/jpeg' 
      });

      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('AVATARS').getPublicUrl(fileName);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', currentUser?.id);

      setAvatarUri(`${urlData.publicUrl}?t=${Date.now()}`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setIsLoadingAvatar(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await logout?.();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}>
          
          <View style={styles.header}>
            <View style={styles.brandBadge}>
              <Image source={require('../../assets/icon_v1.png')} style={styles.brandIcon} contentFit="contain" />
              <Text style={styles.brandText}>MYMARKETPLACE</Text>
            </View>

            <TouchableOpacity onPress={pickAvatar} disabled={isLoadingAvatar}>
              <View style={styles.avatarContainer}>
                {isLoadingAvatar ? (
                  <View style={[styles.avatar, styles.loaderContainer]}><ActivityIndicator color={COLORS.primary} /></View>
                ) : (
                  <>
                    <Image source={{ uri: avatarUri || DEFAULT_AVATAR }} style={styles.avatar} contentFit="cover" cachePolicy="none" />
                    <View style={styles.cameraOverlay}><Ionicons name="camera" size={16} color={COLORS.white} /></View>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {isEditingName ? (
              <View style={styles.nameEditContainer}>
                <TextInput style={styles.nameInput} value={displayName} onChangeText={setDisplayName} autoFocus onSubmitEditing={saveName} />
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
            <View style={styles.statDivider} />
            <View style={styles.statCard}><Text style={styles.statValue}>{orders.length + sales.length}</Text><Text style={styles.statLabel}>Deals</Text></View>
          </View>

          <View style={styles.activityWrapper}>
            <Text style={styles.menuSectionTitle}>ACTIVITY HUB</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity style={[styles.tab, activeTab === 'buying' && styles.activeTab]} onPress={() => setActiveTab('buying')}>
                <Text style={[styles.tabText, activeTab === 'buying' && styles.activeTabText]}>Purchases</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, activeTab === 'selling' && styles.activeTab]} onPress={() => setActiveTab('selling')}>
                <Text style={[styles.tabText, activeTab === 'selling' && styles.activeTabText]}>Sales</Text>
              </TouchableOpacity>
            </View>

            {loadingActivity ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.orderList}>
                {(activeTab === 'buying' ? orders : sales).slice(0, 5).map((item) => (
                  <View key={item.id} style={styles.orderItem}>
                    <View style={styles.orderIconBox}>
                      <Ionicons name={activeTab === 'buying' ? "basket" : "cash"} size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle} numberOfLines={1}>{item.listings?.title || 'Order'}</Text>
                      <Text style={styles.orderDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.orderAmount}>€{item.amount.toFixed(2)}</Text>
                  </View>
                ))}
                {(activeTab === 'buying' ? orders : sales).length === 0 && (
                  <Text style={styles.emptyText}>No activity found yet.</Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.menuWrapper}>
            <Text style={styles.menuSectionTitle}>ACCOUNT SETTINGS</Text>
            <View style={styles.menuCard}>
              <MenuButton icon="chatbubbles-outline" color={COLORS.blue} label="Messages" onPress={() => router.push('/(tabs)/chat')} />
              <MenuButton icon="heart-outline" color={COLORS.red} label="Your Favorites" onPress={() => router.push('/favorites')} isLast />
            </View>

            {isAdmin && (
              <View style={{ marginTop: 24 }}>
                <Text style={[styles.menuSectionTitle, { color: COLORS.purple }]}>ADMIN TOOLS</Text>
                <View style={[styles.menuCard, { borderColor: COLORS.purple, borderWidth: 0.5 }]}>
                  <MenuButton icon="cloud-download-outline" color={COLORS.purple} label="AliExpress Importer" onPress={() => router.push('/admin/import')} />
                  <MenuButton icon="cube-outline" color="#64748b" label="Fulfillment Center" onPress={() => router.push('/admin/orders')} isLast />
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const MenuButton = ({ icon, color, label, onPress, isLast }: any) => (
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
  activityWrapper: { marginTop: 24, paddingHorizontal: 20 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  activeTab: { backgroundColor: COLORS.white, elevation: 2 },
  tabText: { fontWeight: '700', color: COLORS.grayText, fontSize: 13 },
  activeTabText: { color: COLORS.primary },
  orderList: { backgroundColor: COLORS.white, borderRadius: 20, padding: 12 },
  orderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  orderIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#ecfdf5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  orderTitle: { fontWeight: '700', color: COLORS.dark, fontSize: 14 },
  orderDate: { fontSize: 11, color: COLORS.grayText },
  orderAmount: { fontWeight: '800', color: COLORS.dark },
  emptyText: { textAlign: 'center', padding: 20, color: COLORS.grayText, fontStyle: 'italic' },
  menuWrapper: { marginTop: 24, paddingHorizontal: 20 },
  menuSectionTitle: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 10, marginLeft: 4, letterSpacing: 0.5 },
  menuCard: { backgroundColor: COLORS.white, borderRadius: 20, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  menuText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' },
  signOutButton: { marginHorizontal: 20, marginTop: 24, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#fee2e2', marginBottom: 40 },
  signOutText: { color: COLORS.red, fontWeight: 'bold', fontSize: 16 },
});