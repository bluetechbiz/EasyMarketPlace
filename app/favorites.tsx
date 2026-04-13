import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../src/context/AppContext';

const COLORS = {
  primary: '#22c55e',
  white: '#ffffff',
  grayLight: '#f8fafc',
  grayText: '#64748b',
  border: '#e2e8f0',
};

export default function FavoritesScreen() {
  const { favorites, toggleFavorite } = useAppContext();
  const router = useRouter();

  const renderFavoriteItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => router.push({ pathname: '/listing-details', params: { id: item.id } })}
    >
      <Image 
        source={{ uri: item.images?.[0] }} 
        style={styles.image} 
        contentFit="cover" 
        transition={200} 
      />
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.price}>${item.price}</Text>
          <TouchableOpacity onPress={() => toggleFavorite(item.id)}>
            <Ionicons name="heart" size={22} color="#ef4444" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.grayText} />
          <Text style={styles.locationText}>{item.location}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="heart-dislike-outline" size={60} color="#cbd5e1" />
      </View>
      <Text style={styles.emptyTitle}>No favorites yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the heart icon on any ad to save it here for later.
      </Text>
      <TouchableOpacity 
        style={styles.exploreButton} 
        onPress={() => router.back()}
      >
        <Text style={styles.exploreButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Saved Items</Text>
          <Text style={styles.headerCount}>{favorites.length} items</Text>
        </View>
        <View style={{ width: 40 }} /> 
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderFavoriteItem}
        contentContainerStyle={favorites.length > 0 ? styles.listContent : { flex: 1 }}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.grayLight },
  header: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTextContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  headerCount: { fontSize: 12, color: COLORS.grayText, fontWeight: '500' },
  listContent: { padding: 15 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 15,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: { width: 100, height: 100 },
  cardContent: { flex: 1, padding: 12, justifyContent: 'center' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  title: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  locationText: { fontSize: 11, color: COLORS.grayText, marginLeft: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 20 
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.grayText, textAlign: 'center', lineHeight: 20 },
  exploreButton: { 
    marginTop: 25, 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 30, 
    paddingVertical: 12, 
    borderRadius: 25 
  },
  exploreButtonText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});