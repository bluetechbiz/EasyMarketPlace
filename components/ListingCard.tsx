import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Define the Props so TypeScript doesn't complain
type ListingCardProps = {
  item: any;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export function ListingCard({ item, onPress, isFavorite, onToggleFavorite }: ListingCardProps) {
  return (
    <TouchableOpacity 
      style={styles.itemCard} 
      onPress={onPress} 
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            contentFit="cover"
            transition={500}
            style={styles.itemImage}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image-outline" size={32} color="#9ca3af" />
          </View>
        )}
        
        {/* Favorite Heart Button */}
        <TouchableOpacity style={styles.favoriteButton} onPress={onToggleFavorite}>
          <Ionicons 
            name={isFavorite ? 'heart' : 'heart-outline'} 
            size={20} 
            color={isFavorite ? '#ef4444' : '#fff'} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.itemPrice}>€{Number(item.price).toFixed(2)}</Text>
        </View>
        <Text style={styles.itemLocation}>📍 {item.location}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ✅ This is the part that was missing or broken!
const styles = StyleSheet.create({
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: '48%', // This ensures 2 columns work in the FlatList
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    padding: 6,
  },
  cardContent: {
    padding: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  itemLocation: {
    fontSize: 11,
    color: '#64748b',
  },
});