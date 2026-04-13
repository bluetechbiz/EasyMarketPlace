import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../src/context/AppContext';
import { supabase } from '../src/lib/supabase';

const { width } = Dimensions.get('window');
const PLACEHOLDER_IMAGE = require('../assets/adaptive_v1.png');

type Listing = {
    id: string;
    title: string;
    price: number;
    image_uri?: string;
    image_uris?: any; 
    description?: string;
    user_id: string;
    updated_at?: string;
    profiles?: { full_name: string };
};

export default function DetailsScreen() {
    const { id } = useLocalSearchParams();
    const listingId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);
    const router = useRouter();
    const { favorites, addFavorite, removeFavorite, user } = useAppContext();

    const [item, setItem] = useState<Listing | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const isFavorite = useMemo(() => 
        favorites.some(f => String(f.id) === String(listingId)), 
    [favorites, listingId]);

    const isOwnListing = useMemo(() => user?.id === item?.user_id, [user?.id, item?.user_id]);

    const fetchItemDetails = useCallback(async () => {
        if (!listingId) return;
        try {
            const { data, error } = await supabase
                .from('listings')
                .select(`*, profiles:user_id (full_name)`)
                .eq('id', String(listingId))
                .single();
            if (error) throw error;
            setItem(data as Listing);
        } catch (err: any) {
            console.error("Fetch Error:", err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [listingId]);

    useEffect(() => { fetchItemDetails(); }, [fetchItemDetails]);

    const displayImages = useMemo(() => {
        if (!item) return [PLACEHOLDER_IMAGE];
        let rawImages: any[] = [];
        if (item.image_uris && Array.isArray(item.image_uris) && item.image_uris.length > 0) {
            rawImages = item.image_uris;
        } else if (item.image_uri && typeof item.image_uri === 'string') {
            rawImages = [item.image_uri];
        } else if (typeof item.image_uris === 'string' && item.image_uris.trim().length > 0) {
            try {
                const parsed = JSON.parse(item.image_uris);
                rawImages = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
                rawImages = [item.image_uris];
            }
        }
        const cacheBuster = item?.updated_at ? `t=${new Date(item.updated_at).getTime()}` : `t=${Date.now()}`;
        const cleaned = rawImages.map(img => {
            if (!img || typeof img !== 'string') return null;
            let url = img.trim();
            if (url.startsWith('//')) url = `https:${url}`;
            else if (!url.startsWith('http') && !url.startsWith('file://')) url = `https://${url}`;
            const sep = url.includes('?') ? '&' : '?';
            return `${url}${sep}${cacheBuster}`;
        }).filter(Boolean);
        return cleaned.length > 0 ? cleaned : [PLACEHOLDER_IMAGE];
    }, [item]);

    const formattedPrice = useMemo(() => 
        new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(item?.price || 0), 
    [item?.price]);

    const notifySellerOfInquiry = async () => {
        if (!item || !user) return;
        try {
            const { data: sellerProfile } = await supabase
                .from('profiles')
                .select('push_token')
                .eq('id', item.user_id)
                .single();

            if (sellerProfile?.push_token) {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: sellerProfile.push_token,
                        sound: 'default',
                        title: '💬 New Interest!',
                        body: `${user.full_name || 'Someone'} is interested in your ${item.title}`,
                        data: { itemId: item.id },
                    }),
                });
                console.log("✅ Seller notified!");
            }
        } catch (err) {
            console.error("Error notifying seller:", err);
        }
    };

    const handleChatPress = useCallback(() => {
        if (!item || isOwnListing) return;
        notifySellerOfInquiry();
        router.push({
            pathname: '/chat',
            params: {
                itemId: item.id,
                sellerId: item.user_id,
                sellerName: item.profiles?.full_name || 'Seller',
                productName: item.title,
                price: formattedPrice,
                productImage: encodeURIComponent(String(displayImages[0] || '')),
            },
        });
    }, [item, isOwnListing, displayImages, formattedPrice, user]);

    const handleScroll = useCallback((e: any) => {
        const offset = e.nativeEvent.contentOffset.x;
        const index = Math.min(
            displayImages.length - 1,
            Math.max(0, Math.floor((offset + width / 2) / width))
        );
        setActiveImageIndex(index);
    }, [displayImages.length]);

    const toggleFavorite = useCallback(() => {
        if (!item) return;
        isFavorite ? removeFavorite(item.id) : addFavorite(item);
    }, [item, isFavorite, addFavorite, removeFavorite]);

    const renderHeader = useCallback(() => (
        <View style={styles.imageWrapper}>
            <FlatList
                data={displayImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={32}
                keyExtractor={(_, index) => `img-${index}`}
                renderItem={({ item: imgSource }) => (
                    <Image
                        source={typeof imgSource === 'string' ? { uri: imgSource } : imgSource}
                        style={styles.image}
                        contentFit="cover"
                        transition={200}
                        placeholder={PLACEHOLDER_IMAGE}
                    />
                )}
            />
            {displayImages.length > 1 && (
                <View style={styles.pagination}>
                    {displayImages.map((_, i) => (
                        <View key={i} style={[styles.dot, activeImageIndex === i ? styles.activeDot : styles.inactiveDot]} />
                    ))}
                </View>
            )}
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={24} color="black" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
                <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={26} color={isFavorite ? "#ef4444" : "#0f172a"} />
            </TouchableOpacity>
        </View>
    ), [displayImages, activeImageIndex, isFavorite, toggleFavorite]);

    const renderFooter = useCallback(() => (
        <View style={styles.infoContainer}>
            <Text style={styles.price}>{formattedPrice}</Text>
            <Text style={styles.title}>{item?.title}</Text>
            {/* FIXED: Changed <div> to <View> */}
            <View style={styles.divider} /> 
            <View style={styles.sellerRow}>
                <View style={styles.sellerAvatar}><Ionicons name="person" size={20} color="white" /></View>
                <View style={{ marginLeft: 12 }}>
                    <Text style={styles.sellerLabel}>Seller</Text>
                    <Text style={styles.sellerName}>{item?.profiles?.full_name || 'Verified Seller'}</Text>
                </View>
            </View>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item?.description || 'No description provided.'}</Text>
        </View>
    ), [item, formattedPrice]);

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#10b981" /></View>;

    return (
        <View style={styles.container}>
            <FlatList
                data={[]} 
                renderItem={() => null}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={renderFooter}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItemDetails(); }} />}
                contentContainerStyle={{ paddingBottom: 120 }}
                bounces={false}
            />
            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <TouchableOpacity 
                    style={[styles.chatButton, isOwnListing && styles.disabledBtn]} 
                    onPress={handleChatPress}
                    disabled={isOwnListing}
                >
                    <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                    <Text style={styles.chatButtonText}>
                        {isOwnListing ? "This is your listing" : "Chat with Seller"}
                    </Text>
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageWrapper: { width: width, height: width * (4 / 3), backgroundColor: '#f1f5f9' },
    image: { width: width, height: '100%' },
    pagination: { position: 'absolute', bottom: 20, flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    activeDot: { backgroundColor: '#10b981', width: 22 },
    inactiveDot: { backgroundColor: 'rgba(255,255,255,0.6)' },
    backButton: { position: 'absolute', top: 50, left: 20, backgroundColor: 'white', padding: 10, borderRadius: 25, elevation: 5 },
    favoriteButton: { position: 'absolute', top: 50, right: 20, backgroundColor: 'white', padding: 10, borderRadius: 25, elevation: 5 },
    infoContainer: { padding: 24 },
    price: { fontSize: 32, fontWeight: '900', color: '#10b981', marginBottom: 6 },
    title: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 20 },
    sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, backgroundColor: '#f8fafc', padding: 15, borderRadius: 16 },
    sellerAvatar: { backgroundColor: '#cbd5e1', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sellerLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase' },
    sellerName: { fontSize: 16, color: '#0f172a', fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
    description: { fontSize: 16, color: '#475569', lineHeight: 26 },
    footer: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    chatButton: { backgroundColor: '#10b981', flexDirection: 'row', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 10, elevation: 3 },
    disabledBtn: { backgroundColor: '#94a3b8' },
    chatButtonText: { color: 'white', fontSize: 18, fontWeight: '800' }
});