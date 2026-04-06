import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PaymentButton from '../../src/lib/PaymentButton';
import { supabase } from '../../src/lib/supabase';
import PostModal from '../post';

// --- TYPES ---
interface Item {
    id: string;
    title: string;
    price: number;
    location: string;
    category?: string; // ✅ Match your DB column name
    image_uri?: string | null;
    image_uris?: any | null; 
    created_at: string;
    seller_id: string; 
    user_id: string;   
}

interface Category {
    id: string;
    name: string;
}

const PAGE_SIZE = 12;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=500';

const ListingCard = React.memo(({ item, width, imageHeight, onPress }: { 
    item: Item, 
    width: number, 
    imageHeight: number, 
    onPress: (id: string) => void
}) => {
    const [imgError, setImgError] = useState(false);
    
    const source = useMemo(() => {
        if (imgError) return { uri: FALLBACK_IMAGE };
        let rawUri: string | null = null;
        if (item.image_uris && Array.isArray(item.image_uris) && item.image_uris.length > 0) {
            rawUri = item.image_uris[0];
        } else if (item.image_uri && typeof item.image_uri === 'string') {
            rawUri = item.image_uri;
        } else if (typeof item.image_uris === 'string' && item.image_uris.startsWith('[')) {
            try {
                const parsed = JSON.parse(item.image_uris);
                rawUri = Array.isArray(parsed) ? parsed[0] : parsed;
            } catch {
                rawUri = item.image_uris;
            }
        }
        if (!rawUri || typeof rawUri !== 'string') return { uri: FALLBACK_IMAGE };
        let cleanUrl = rawUri.trim();
        if (cleanUrl.startsWith('//')) {
            cleanUrl = `https:${cleanUrl}`;
        } else if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('file')) {
            cleanUrl = `https://${cleanUrl}`;
        }
        return { uri: cleanUrl };
    }, [imgError, item.image_uri, item.image_uris]);

    const cardStyle = useMemo(() => [styles.card, { width }], [width]);
    const imgStyle = useMemo(() => [styles.img, { height: imageHeight }], [imageHeight]);

    return (
        <View style={cardStyle}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item.id)}>
                <Image 
                    source={source} 
                    recyclingKey={item.id}
                    style={imgStyle} 
                    contentFit="cover" 
                    transition={200}
                    onError={() => setImgError(true)}
                    placeholder={{ blurhash: 'LKN]~^%2_3?7%M_Ps;Rj4n%9%Mof' }} 
                />
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.price}>€{Number(item.price).toFixed(2)}</Text>
                </View>
            </TouchableOpacity>
            
            <View style={styles.cardButtonContainer}>
                <PaymentButton 
                    displayPrice={item.price} 
                    listingId={item.id}
                    listingTitle={item.title}
                />
            </View>
        </View>
    );
});

export default function HomeScreen() {
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    
    const isMounted = useRef(true);
    const isFetchingRef = useRef(false);
    const activeCategoryIdRef = useRef('All');
    const searchRef = useRef('');
    const listRef = useRef<FlashList<Item>>(null);
    const hasMoreRef = useRef(true);

    const [realListings, setRealListings] = useState<Item[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeCategoryId, setActiveCategoryId] = useState('All');
    const [postModalVisible, setPostModalVisible] = useState(false);

    const cardWidth = useMemo(() => (windowWidth - 48) / 2, [windowWidth]);
    const imageHeight = useMemo(() => cardWidth * (9 / 16), [cardWidth]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        activeCategoryIdRef.current = activeCategoryId;
        searchRef.current = debouncedSearch.trim().toLowerCase();
    }, [activeCategoryId, debouncedSearch]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        const fetchCategories = async () => {
            const { data, error } = await supabase.from('categories').select('*').order('name');
            if (!error && isMounted.current && data) setCategories(data);
        };
        fetchCategories();
    }, []);

    const fetchData = useCallback(async (cursor?: string, isRefresh = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        if (isRefresh) {
            setIsRefreshing(true);
            hasMoreRef.current = true;
        } else if (cursor) {
            setIsLoadingMore(true);
        }
        try {
            let query = supabase
                .from('listings')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(PAGE_SIZE);
            if (cursor) query = query.lt('created_at', cursor);
            
            // ✅ FIX: Using 'category' column to match your database schema
            if (activeCategoryIdRef.current !== 'All') {
                query = query.eq('category', activeCategoryIdRef.current);
            }
            
            if (searchRef.current.length >= 2) query = query.ilike('title', `%${searchRef.current}%`);
            const { data, error } = await query;
            if (error) throw error;
            if (isMounted.current && data) {
                setRealListings(prev => {
                    const combined = isRefresh || !cursor ? data : [...prev, ...data];
                    return Array.from(new Map(combined.map(item => [item.id, item])).values()) as Item[];
                });
                hasMoreRef.current = data.length === PAGE_SIZE;
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            if (isMounted.current) Alert.alert("Error", "Check your connection.");
        } finally {
            isFetchingRef.current = false;
            setIsInitialLoading(false);
            setIsRefreshing(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchData(undefined, true);
    }, [activeCategoryId, debouncedSearch, fetchData]);

    useEffect(() => {
        const subscription = supabase
            .channel('marketplace_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, (payload) => {
                const item = payload.new as Item;
                // ✅ FIX: Matching logic updated to 'category'
                const matchesCat = activeCategoryIdRef.current === 'All' || item.category === activeCategoryIdRef.current;
                const matchesSearch = searchRef.current.length < 2 || item.title?.toLowerCase().includes(searchRef.current);
                if (payload.eventType === 'INSERT' && matchesCat && matchesSearch) {
                    setRealListings(current => [item, ...current.filter(i => i.id !== item.id)]);
                } else if (payload.eventType === 'UPDATE') {
                    setRealListings(current => {
                        if (!matchesCat || !matchesSearch) return current.filter(i => i.id !== item.id);
                        return current.map(i => i.id === item.id ? item : i);
                    });
                } else if (payload.eventType === 'DELETE') {
                    const oldItem = payload.old as { id: string };
                    setRealListings(current => current.filter(i => i.id !== oldItem.id));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(subscription); };
    }, []);

    const handlePress = useCallback((id: string) => {
        router.push({ pathname: "/details", params: { id } });
    }, [router]);

    const renderItem = useCallback(({ item }: { item: Item }) => (
        <ListingCard 
            item={item} 
            width={cardWidth} 
            imageHeight={imageHeight} 
            onPress={handlePress} 
        />
    ), [cardWidth, imageHeight, handlePress]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlashList
                ref={listRef}
                data={realListings}
                numColumns={2}
                estimatedItemSize={350} 
                drawDistance={windowWidth}
                windowSize={5}
                keyExtractor={(item) => item.id?.toString()}
                contentContainerStyle={styles.gridContainer}
                onEndReached={() => {
                    if (!isFetchingRef.current && hasMoreRef.current && realListings.length > 0) {
                        fetchData(realListings[realListings.length - 1].created_at);
                    }
                }}
                onEndReachedThreshold={0.5}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => fetchData(undefined, true)} />}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={18} color="#64748b" />
                            <TextInput 
                                style={styles.searchInput} 
                                placeholder="Search marketplace..." 
                                value={searchText} 
                                onChangeText={setSearchText} 
                                clearButtonMode="while-editing"
                            />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                            <TouchableOpacity 
                                onPress={() => setActiveCategoryId('All')} 
                                style={[styles.catChip, activeCategoryId === 'All' && styles.catChipActive]}
                            >
                                <Text style={[styles.catText, activeCategoryId === 'All' && styles.catTextActive]}>All</Text>
                            </TouchableOpacity>
                            {categories.map(cat => (
                                <TouchableOpacity 
                                    key={cat.id} 
                                    onPress={() => setActiveCategoryId(cat.name)} // ✅ Use cat.name for exact text matching
                                    style={[styles.catChip, activeCategoryId === cat.name && styles.catChipActive]}
                                >
                                    <Text style={[styles.catText, activeCategoryId === cat.name && styles.catTextActive]}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                }
                renderItem={renderItem}
                ListEmptyComponent={
                    !isInitialLoading ? (
                        <View style={styles.emptyBox}>
                            <Ionicons name="search-outline" size={50} color="#cbd5e1" />
                            <Text style={styles.emptyText}>
                                {debouncedSearch ? `No results for "${debouncedSearch}"` : "Nothing here yet"}
                            </Text>
                        </View>
                    ) : <ActivityIndicator size="large" style={{ marginTop: 50 }} color="#0f172a" />
                }
                ListFooterComponent={isLoadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color="#0f172a" /> : <View style={{ height: 40 }} />}
            />
            
            <TouchableOpacity style={styles.fab} onPress={() => setPostModalVisible(true)}>
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>

            <PostModal 
                visible={postModalVisible} 
                onClose={() => {
                    setPostModalVisible(false);
                    fetchData(undefined, true);
                }} 
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { backgroundColor: 'white', paddingBottom: 14 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 16, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12 },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
    catScroll: { paddingLeft: 16 },
    catChip: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f1f5f9', marginRight: 10, borderRadius: 20 },
    catChipActive: { backgroundColor: '#0f172a' },
    catText: { color: '#64748b', fontWeight: '700', fontSize: 14 },
    catTextActive: { color: 'white' },
    gridContainer: { paddingHorizontal: 16, paddingBottom: 100 },
    card: { 
        backgroundColor: 'white', 
        borderRadius: 16, 
        marginBottom: 16, 
        overflow: 'hidden', 
        elevation: 2, 
        shadowColor: '#000', 
        shadowOpacity: 0.05, 
        shadowRadius: 10 
    },
    img: { width: '100%', backgroundColor: '#f1f5f9' },
    info: { padding: 12, paddingBottom: 8 },
    title: { fontWeight: '700', fontSize: 14, color: '#1e293b' },
    price: { color: '#10b981', fontWeight: '800', marginTop: 4, fontSize: 15 },
    cardButtonContainer: {
        padding: 10,
        paddingTop: 0,
    },
    fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#0f172a', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
    emptyBox: { alignItems: 'center', marginTop: 80 },
    emptyText: { marginTop: 10, color: '#94a3b8', fontSize: 16, fontWeight: '500' }
});