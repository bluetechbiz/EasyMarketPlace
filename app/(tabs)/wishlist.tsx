import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image'; // High-performance Image
import { useRouter } from 'expo-router';
import { memo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../src/context/AppContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const IMAGE_HEIGHT = CARD_WIDTH * (9 / 16); // 16:9 Aspect Ratio

type Item = {
  id: string;
  title: string;
  price: number;
  location: string;
  imageUri?: string | null;
  imageUris?: string[]; // NEW
  userId?: string;
};

const ListingCard = memo(({ item, onDelete }: { item: Item; onDelete: (id: string) => void }) => {
  const router = useRouter();

  const displayImage = item.imageUris?.[0] || item.imageUri || item.image_uri;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${item.title} for €${item.price} in ${item.location}! Found on Easy Italia.`,
      });
    } catch (error) {
      console.log('Share error', error);
    }
  };

  const handleMessage = () => {
    router.push({
      pathname: '/(tabs)/chat',
      params: { 
        itemId: item.id, 
        sellerId: item.userId, 
        itemTitle: item.title 
      }
    });
  };

  return (
    <View style={styles.listing_cardContainer}>
      <View style={styles.listing_imageWrapper}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={{ width: '100%', height: IMAGE_HEIGHT }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.listing_placeholder, { height: IMAGE_HEIGHT }]}>
            <Ionicons name="image-outline" size={30} color="#94a3b8" />
          </View>
        )}
        <TouchableOpacity 
          style={styles.listing_deleteBadge} 
          onPress={() => {
            Alert.alert('Delete', 'Remove this item?', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', style: 'destructive', onPress: () => onDelete(item.id) }
            ]);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.listing_content}>
        <Text style={styles.listing_titleText} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.listing_priceText}>€{Number(item.price).toFixed(2)}</Text>
        <Text style={styles.listing_locationText} numberOfLines={1}>📍 {item.location || 'Remote'}</Text>
        
        <View style={styles.listing_divider} />
        
        <View style={styles.listing_actionRow}>
          <TouchableOpacity 
            style={styles.listing_btn} 
            onPress={handleMessage}
            activeOpacity={0.6}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#22c55e" />
            <Text style={[styles.listing_btnText, { color: '#22c55e' }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.listing_btn} 
            onPress={handleShare}
            activeOpacity={0.6}
          >
            <Ionicons name="share-social-outline" size={20} color="#64748b" />
            <Text style={styles.listing_btnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function MyListings() {
  const { listings = [], currentUser, deleteListing, loading } = useAppContext();
  const router = useRouter();

  const myListings = listings.filter(item => item.userId === currentUser?.id);

  if (loading) {
    return (
      <View style={styles.listing_center}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.listing_safeArea} edges={['top']}>
      <View style={styles.listing_header}>
        <Text style={styles.listing_headerText}>My Listings ({myListings.length})</Text>
      </View>

      <FlatList
        data={myListings}
        numColumns={2}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ListingCard item={item} onDelete={deleteListing} />}
        contentContainerStyle={styles.listing_listPadding}
        columnWrapperStyle={styles.listing_columnGap}
        ListEmptyComponent={
          <View style={styles.listing_emptyContainer}>
            <Ionicons name="basket-outline" size={60} color="#cbd5e1" />
            <Text style={styles.listing_emptyText}>No items listed yet</Text>
            <TouchableOpacity 
                style={styles.listing_addBtn}
                onPress={() => router.push('/(tabs)/post-item')}
            >
                <Text style={styles.listing_addBtnText}>Post Now</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  listing_safeArea: { flex: 1, backgroundColor: '#fff' },
  listing_header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listing_headerText: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  listing_listPadding: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 10 },
  listing_columnGap: { justifyContent: 'space-between' },
  listing_center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  listing_cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  listing_imageWrapper: { position: 'relative' },
  listing_placeholder: { backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
  listing_deleteBadge: { 
    position: 'absolute', 
    top: 8, 
    right: 8, 
    backgroundColor: 'white', 
    padding: 6, 
    borderRadius: 10,
    elevation: 2 
  },
  listing_content: { padding: 10 },
  listing_titleText: { fontSize: 14, fontWeight: '600', color: '#334155' },
  listing_priceText: { fontSize: 16, fontWeight: 'bold', color: '#22c55e', marginVertical: 2 },
  listing_locationText: { fontSize: 11, color: '#64748b' },
  listing_divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },
  listing_actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listing_btn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  listing_btnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },

  listing_emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  listing_emptyText: { marginTop: 10, color: '#94a3b8', fontSize: 16 },
  listing_addBtn: { marginTop: 20, backgroundColor: '#22c55e', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  listing_addBtnText: { color: '#fff', fontWeight: 'bold' }
});