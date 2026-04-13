import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';

// --- TYPES ---
interface ListingItem {
  id: string;
  title: string;
  price: number;
  location?: string;
  category?: string;
  image_uri?: string; // Supabase style
  imageUri?: string;  // Context style
  imageUris?: string[]; // Array style
  created_at: string;
  isSkeleton?: boolean;
}

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2;
const imageHeight = cardWidth * (3 / 4);
const PAGE_SIZE = 10;
const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Clothing', 'Vehicles', 'Other'];

// --- SKELETON CARD ---
const SkeletonCard = () => (
  <View style={[styles.itemCard, { width: cardWidth, marginHorizontal: 4 }]}>
    <View style={[styles.skeletonImage, { height: imageHeight }]} />
    <View style={styles.cardContent}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonLocation} />
    </View>
  </View>
);

// --- MEMOIZED CARD ---
const ExploreCard = memo(({ 
  item, 
  isFavorite, 
  onToggleFavorite,
  onPress 
}: { 
  item: ListingItem; 
  isFavorite: boolean; 
  onToggleFavorite: (item: ListingItem) => void;
  onPress: (id: string) => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // ✅ FIX: Fallback for all potential image property names
  const displayImage = useMemo(() => {
    return item.image_uri || item.imageUri || item.imageUris?.[0];
  }, [item.image_uri, item.imageUri, item.imageUris]);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0.8, duration: 100, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 100, useNativeDriver: true })
    ]).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(item.id)}
    >
      <Animated.View style={[styles.itemCard, { width: cardWidth, transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        <View style={styles.imageContainer}>
          {/* ✅ UPDATED IMAGE COMPONENT */}
          <Image 
            source={displayImage ? { uri: displayImage } : { uri: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?q=80&w=500' }} 
            recyclingKey={item.id}
            style={[styles.itemImage, { height: imageHeight }]} 
            contentFit="cover"
            transition={200}
            placeholder={{ blurhash: 'LKN]~^%2_3?7%M_Ps;Rj4n%9%Mof' }}
          />
          <TouchableOpacity 
            style={styles.favoriteButton} 
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onToggleFavorite(item)}
          >
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorite ? "#ef4444" : "#64748b"} 
            />
          </TouchableOpacity>
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>€{Number(item.price).toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.itemLocation}>📍 {item.location || 'Remote'}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

export default function ExploreScreen() {
  const router = useRouter();
  const { listings = [], favorites = [], addFavorite, removeFavorite } = useAppContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  const skeletonData = useMemo(() => Array(8).fill(null).map((_, i) => ({ id: `skeleton-${i}`, isSkeleton: true })), []);
  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.id)), [favorites]);

  useEffect(() => {
    // Shorter timer so users aren't waiting on nothing
    const timer = setTimeout(() => setIsLoadingInitial(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const filteredData = useMemo(() => {
    const search = searchQuery.toLowerCase();
    const data = listings.filter((item) => {
      const title = item.title?.toLowerCase() || '';
      const matchesSearch = search.length < 2 || title.includes(search);
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
    return data.slice(0, displayLimit);
  }, [searchQuery, activeCategory, listings, displayLimit]);

  const finalData = isLoadingInitial ? skeletonData : filteredData;

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingInitial && displayLimit < listings.length) {
      setDisplayLimit(prev => prev + PAGE_SIZE);
    }
  }, [displayLimit, listings.length, isLoadingInitial]);

  const handleToggleFavorite = useCallback((item: ListingItem) => {
    favoriteIds.has(item.id) ? removeFavorite(item.id) : addFavorite(item);
  }, [favoriteIds, addFavorite, removeFavorite]);

  const handleNavigate = useCallback((id: string) => {
    router.push({ pathname: '/details', params: { id } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.isSkeleton) return <SkeletonCard />;
    return (
      <ExploreCard 
        item={item as ListingItem} 
        isFavorite={favoriteIds.has(item.id)}
        onToggleFavorite={handleToggleFavorite}
        onPress={handleNavigate}
      />
    );
  }, [favoriteIds, handleToggleFavorite, handleNavigate]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlashList
        data={finalData}
        numColumns={2}
        estimatedItemSize={230}
        extraData={isLoadingInitial}
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Explore</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput
                placeholder="Search listings..."
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94a3b8"
                clearButtonMode="while-editing"
              />
            </View>
            <View style={styles.categoryContainer}>
              <FlashList
                horizontal
                estimatedItemSize={80}
                data={CATEGORIES}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => setActiveCategory(item)}
                    style={[styles.catChip, activeCategory === item && styles.catChipActive]}
                  >
                    <Text style={[styles.catChipText, activeCategory === item && styles.catChipTextActive]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingHorizontal: 20 }}
              />
            </View>
          </View>
        }
        renderItem={renderItem}
        ListEmptyComponent={
          !isLoadingInitial ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={60} color="#cbd5e1" />
              <Text style={styles.emptyText}>No results found</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          !isLoadingInitial && displayLimit < listings.length ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color="#10b981" />
          ) : <View style={{ height: 40 }} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  headerContainer: { backgroundColor: 'white', paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a', paddingHorizontal: 20, marginTop: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', marginHorizontal: 20, marginTop: 15, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#0f172a', marginLeft: 8 },
  categoryContainer: { height: 40, marginTop: 15 },
  catChip: { paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#f8fafc', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
  catChipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  catChipText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  catChipTextActive: { color: 'white' },
  itemCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, marginHorizontal: 8 },
  imageContainer: { position: 'relative' },
  itemImage: { width: '100%', backgroundColor: '#f1f5f9' },
  favoriteButton: { position: 'absolute', top: 8, right: 8, backgroundColor: 'white', padding: 6, borderRadius: 20 },
  priceBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priceBadgeText: { color: 'white', fontSize: 12, fontWeight: '800' },
  cardContent: { padding: 10 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  itemLocation: { fontSize: 11, color: '#64748b', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  skeletonImage: { backgroundColor: '#f1f5f9' },
  skeletonTitle: { height: 14, width: '70%', backgroundColor: '#f1f5f9', borderRadius: 4, marginBottom: 6, marginTop: 10 },
  skeletonLocation: { height: 10, width: '40%', backgroundColor: '#f1f5f9', borderRadius: 4 }
});