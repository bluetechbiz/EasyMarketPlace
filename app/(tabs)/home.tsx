import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import PostModal from '../post';

interface Item {
    id: string;
    title: string;
    price: number;
    location: string;
    category?: string;
    image_uri?: string | null;
    image_uris?: any | null;
    created_at: string;
    seller_id: string;
    user_id: string;
}

const PAGE_SIZE = 12;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=500';
const THEME_COLOR = '#f97316';

const cartScale = new Animated.Value(1);

const ListingCard = memo(({ item, width, imageHeight, onPress, onAddToCart, onBuyNow }: any) => {
    const [imgError, setImgError] = useState(false);

    const source = useMemo(() => {
        if (imgError) return { uri: FALLBACK_IMAGE };

        let rawUri: string | null = null;

        if (Array.isArray(item.image_uris) && item.image_uris.length > 0) {
            rawUri = item.image_uris[0];
        } else if (typeof item.image_uri === 'string') {
            rawUri = item.image_uri;
        }

        if (!rawUri) return { uri: FALLBACK_IMAGE };

        let clean = rawUri.trim();
        if (clean.startsWith('//')) clean = `https:${clean}`;
        if (!clean.startsWith('http')) clean = `https://${clean}`;

        return { uri: clean };
    }, [imgError, item]);

    return (
        <View style={[styles.card, { width }]}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => onPress(item.id)}>
                <Image
                    source={source}
                    style={[styles.img, { height: imageHeight }]}
                    contentFit="cover"
                    onError={() => setImgError(true)}
                />

                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.price}>€{Number(item.price).toFixed(2)}</Text>
                </View>
            </TouchableOpacity>

            <View style={styles.cardButtonContainer}>
                <TouchableOpacity style={styles.addToCartBtn} onPress={() => onAddToCart(item)}>
                    <Ionicons name="cart" size={16} color="white" />
                    <Text style={styles.addToCartText}>Cart</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.buyNowBtn} onPress={() => onBuyNow(item)}>
                    <Text style={styles.buyNowText}>Buy</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export default function HomeScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const [realListings, setRealListings] = useState<Item[]>([]);
    const [cartCount, setCartCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [postModalVisible, setPostModalVisible] = useState(false);

    const isFetchingRef = useRef(false);

    const cardWidth = (width - 48) / 2;
    const imageHeight = cardWidth;

    const fetchCartCount = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { count } = await supabase
            .from('cart_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        setCartCount(count || 0);
    };

    const animateCart = () => {
        Animated.sequence([
            Animated.timing(cartScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
            Animated.timing(cartScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
    };

    const fetchData = async () => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        setIsRefreshing(true);

        const { data, error } = await supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);

        if (error) console.log(error);

        setRealListings(data || []);
        setIsRefreshing(false);
        isFetchingRef.current = false;
    };

    useEffect(() => {
        fetchData();
        fetchCartCount();
    }, []);

    const handleAddToCart = async (item: Item) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return Alert.alert("Login required");

        const { data: existing } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('listing_id', item.id)
            .maybeSingle();

        if (existing) {
            await supabase
                .from('cart_items')
                .update({ quantity: existing.quantity + 1 })
                .eq('id', existing.id);
        } else {
            await supabase
                .from('cart_items')
                .insert({
                    user_id: user.id,
                    listing_id: item.id,
                    quantity: 1,
                });
        }

        animateCart();
        fetchCartCount();
        Alert.alert("🛒 Added to cart");
    };

    const handleBuyNow = async (item: Item) => {
        await handleAddToCart(item);
        router.push('/cartreview'); // ✅ FIXED ROUTE
    };

    const renderItem = ({ item }: { item: Item }) => (
        <ListingCard
            item={item}
            width={cardWidth}
            imageHeight={imageHeight}
            onPress={(id: string) => router.push({ pathname: "/cartreview", params: { itemId: id } })}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
        />
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.topBar}>
                <Text style={styles.logo}>ELITE MARKET</Text>

                <TouchableOpacity onPress={() => router.push('/cartreview')}>
                    <Animated.View style={{ transform: [{ scale: cartScale }] }}>
                        <Ionicons name="cart" size={26} color="#000" />
                        {cartCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{cartCount}</Text>
                            </View>
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </View>

            <FlashList
                data={realListings}
                numColumns={2}
                estimatedItemSize={300}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={fetchData} />
                }
            />

            <TouchableOpacity style={styles.fab} onPress={() => setPostModalVisible(true)}>
                <Ionicons name="camera" size={28} color="white" />
            </TouchableOpacity>

            <PostModal visible={postModalVisible} onClose={() => setPostModalVisible(false)} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },

    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 16,
    },

    logo: { fontSize: 20, fontWeight: '900' },

    badge: {
        position: 'absolute',
        right: -6,
        top: -4,
        backgroundColor: 'red',
        borderRadius: 10,
        paddingHorizontal: 5,
    },

    badgeText: { color: '#fff', fontSize: 10 },

    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        margin: 6,
        overflow: 'hidden',
    },

    img: { width: '100%' },

    info: { padding: 8 },

    title: { fontSize: 13, fontWeight: '600' },

    price: { color: THEME_COLOR, fontWeight: '800' },

    cardButtonContainer: {
        flexDirection: 'row',
        padding: 8,
    },

    addToCartBtn: {
        flex: 1,
        backgroundColor: THEME_COLOR,
        padding: 6,
        borderRadius: 6,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },

    buyNowBtn: {
        flex: 1,
        backgroundColor: '#000',
        marginLeft: 5,
        padding: 6,
        borderRadius: 6,
        alignItems: 'center',
    },

    addToCartText: { color: 'white', marginLeft: 4, fontSize: 12 },
    buyNowText: { color: 'white', fontSize: 12 },

    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: THEME_COLOR,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
});