import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';

// --- TYPES ---
interface SupabaseConversation {
    id: string;
    last_message: string | null;
    updated_at: string;
    buyer_id: string;
    seller_id: string;
    listing_id: string;
    listing: { title: string; image_uri: string; price: number };
    buyer: { full_name: string; avatar_url: string };
    seller: { full_name: string; avatar_url: string };
}

interface ConversationItem {
    id: string;
    last_message: string;
    updated_at: string;
    listing_id: string;
    listing: { title: string; image_uri: string; price: number };
    other_user: { full_name: string; avatar_url: string };
    seller_id: string; // Added for chat params
}

// --- MEMOIZED COMPONENTS ---

const ChatRow = memo(({ item, onPress }: { item: ConversationItem; onPress: (item: ConversationItem) => void }) => {
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <TouchableOpacity style={styles.chatCard} onPress={() => onPress(item)}>
            <Image 
                source={{ uri: item.other_user?.avatar_url || 'https://via.placeholder.com/100' }} 
                style={styles.avatar}
                transition={200}
            />
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={styles.userName} numberOfLines={1}>{item.other_user?.full_name || 'User'}</Text>
                    <Text style={styles.time}>{formatTime(item.updated_at)}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>{item.last_message}</Text>
                <Text style={styles.productTag}>📦 {item.listing?.title}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </TouchableOpacity>
    );
});

const EmptyState = memo(({ onExplore }: { onExplore: () => void }) => (
    <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={80} color="#f1f5f9" />
        <Text style={styles.emptyText}>No conversations yet.</Text>
        <TouchableOpacity onPress={onExplore} style={styles.emptyButton}>
            <Text style={styles.emptyButtonText}>Explore Marketplace</Text>
        </TouchableOpacity>
    </View>
));

export default function InboxScreen() {
    const router = useRouter();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    id, last_message, updated_at, buyer_id, seller_id, listing_id,
                    listing:listings(title, image_uri, price),
                    buyer:profiles!conversations_buyer_id_fkey(full_name, avatar_url),
                    seller:profiles!conversations_seller_id_fkey(full_name, avatar_url)
                `)
                .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const formatted: ConversationItem[] = (data as any[]).map((conv) => {
                const isBuyer = conv.buyer_id === user.id;
                return {
                    id: conv.id,
                    listing_id: conv.listing_id,
                    seller_id: conv.seller_id,
                    last_message: conv.last_message || 'No messages yet',
                    updated_at: conv.updated_at,
                    listing: conv.listing,
                    other_user: isBuyer ? conv.seller : conv.buyer,
                };
            });

            setConversations(formatted);
        } catch (err) {
            console.error('Inbox error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchConversations(); }, []);

    const handlePress = useCallback((item: ConversationItem) => {
        if (!item.listing_id) {
            Alert.alert("Error", "This conversation is no longer linked to a listing.");
            return;
        }

        router.push({
            pathname: "/chat", // Update this to "/(tabs)/chat" if "/chat" doesn't work
            params: { 
                itemId: item.listing_id, 
                sellerId: item.seller_id,
                sellerName: item.other_user?.full_name,
                productName: item.listing?.title,
                price: `€${item.listing?.price}`,
                productImage: encodeURIComponent(item.listing?.image_uri || 'https://via.placeholder.com/600')
            }
        });
    }, []);

    const goToHome = useCallback(() => router.replace('/'), []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#22c55e" size="large" />
                    <Text style={styles.loadingText}>Loading your chats...</Text>
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <ChatRow item={item} onPress={handlePress} />}
                    contentContainerStyle={styles.list}
                    initialNumToRender={10}
                    windowSize={5}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={fetchConversations} tintColor="#22c55e" />
                    }
                    ListEmptyComponent={<EmptyState onExplore={goToHome} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'white' },
    header: { paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerTitle: { fontSize: 28, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
    list: { flexGrow: 1 },
    chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f1f5f9' },
    content: { flex: 1, marginLeft: 15, marginRight: 5 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    userName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    time: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    lastMessage: { fontSize: 14, color: '#64748b', marginBottom: 6 },
    productTag: { fontSize: 11, color: '#22c55e', fontWeight: '700', backgroundColor: '#f0fdf4', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: '#94a3b8', fontWeight: '500' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
    emptyText: { marginTop: 16, fontSize: 18, color: '#94a3b8', fontWeight: '600' },
    emptyButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#22c55e', borderRadius: 25 },
    emptyButtonText: { color: 'white', fontWeight: '700', fontSize: 14 },
});