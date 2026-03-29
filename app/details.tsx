import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../src/context/AppContext'; // Import context
import { supabase } from '../src/lib/supabase';

const { width } = Dimensions.get('window');

export default function DetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { favorites, addFavorite, removeFavorite } = useAppContext(); // Context helpers
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [displayImage, setDisplayImage] = useState<string | null>(null);

  // Check if this specific item is in favorites
  const isFavorite = useMemo(() => 
    favorites.some(f => f.id === id), 
  [favorites, id]);

  const fetchItemDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          profiles!fk_listings_profile (
            full_name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setItem(data);

      if (data.image_uri) {
        if (data.image_uri.startsWith('http')) {
          setDisplayImage(data.image_uri);
        } else {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('listing-images')
            .createSignedUrl(data.image_uri, 3600);
          
          if (signedError) {
            const { data: publicData } = supabase.storage
              .from('listing-images')
              .getPublicUrl(data.image_uri);
            setDisplayImage(publicData.publicUrl);
          } else {
            setDisplayImage(signedData.signedUrl);
          }
        }
      }
    } catch (error: any) {
      console.error("Fetch Error:", error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchItemDetails();
  }, [fetchItemDetails, id]);

  const productInfo = useMemo(() => ({
    name: item?.title || 'Listing',
    price: item?.price ? `€${item.price}` : '',
    seller: item?.profiles?.full_name || 'Seller'
  }), [item]);

  const handleToggleFavorite = async () => {
    if (!item) return;
    if (isFavorite) {
      await removeFavorite(item.id);
    } else {
      // We map the DB item to the Item type expected by AppContext
      await addFavorite({
        id: item.id,
        title: item.title,
        price: item.price,
        location: item.location,
        category: item.category,
        imageUri: displayImage,
        imageUris: item.image_uris || [displayImage],
        userId: item.user_id,
        status: item.status
      });
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchItemDetails();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        bounces={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.imageContainer}>
          <Image
            source={displayImage || 'https://via.placeholder.com/600'}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="black" />
          </TouchableOpacity>

          {/* Favorite Button Overlay */}
          <TouchableOpacity style={styles.favoriteButton} onPress={handleToggleFavorite}>
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={26} 
              color={isFavorite ? "#ef4444" : "#0f172a"} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.price}>{productInfo.price}</Text>
          <Text style={styles.title}>{productInfo.name}</Text>
          <View style={styles.divider} />
          
          <View style={styles.sellerRow}>
            <Ionicons name="person-circle-outline" size={24} color="#64748b" />
            <View style={{ marginLeft: 8 }}>
                <Text style={styles.sellerLabel}>Seller</Text>
                <Text style={styles.sellerName}>{productInfo.seller}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{item?.description || 'No description provided.'}</Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            router.push({
              pathname: '/chat',
              params: {
                itemId: item.id,
                sellerId: item.user_id,
                sellerName: productInfo.seller,
                productName: productInfo.name,
                price: productInfo.price,
                productImage: encodeURIComponent(displayImage || ''),
              },
            })
          }
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="white" />
          <Text style={styles.chatButtonText}>Chat with Seller</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },
  imageContainer: { width: width, height: width * (9 / 16), backgroundColor: '#f1f5f9' },
  image: { width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  favoriteButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoContainer: { padding: 20 },
  price: { fontSize: 28, fontWeight: '800', color: '#22c55e', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 20 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sellerLabel: { fontSize: 12, color: '#64748b' },
  sellerName: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  description: { fontSize: 16, color: '#64748b', lineHeight: 24 },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  chatButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  chatButtonText: { color: 'white', fontSize: 16, fontWeight: '700' },
});