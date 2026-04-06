import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../src/lib/supabase';

// --- CONSTANTS ---
const ITEM_HEIGHT = 92; 
const DEFAULT_AVATAR = 'https://via.placeholder.com/100';

// --- TYPES ---
interface ConversationItem {
    id: string;
    last_message: string;
    updated_at: string;
    listing_id: string;
    listing: { title: string; image_uri: string; price: number };
    other_user: { full_name: string; avatar_url: string };
    seller_id: string;
}

// --- HELPERS ---
const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// --- MEMOIZED COMPONENTS ---
const ChatRow = memo(({ item, onPress }: { item: ConversationItem; onPress: (item: ConversationItem) => void }) => (
    <TouchableOpacity style={styles.chatCard} onPress={() => onPress(item)} activeOpacity={0.7}>
        <Image 
            source={{ uri: item.other_user?.avatar_url || DEFAULT_AVATAR }} 
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
));

export default function InboxScreen() {
    const router = useRouter();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // --- LOGIC ---

    const fetchConversations = useCallback(async (isSilent = false) => {
        // Prevent running if we don't have a user session yet
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData.user?.id;
        
        if (!currentUserId) return;
        if (userId !== currentUserId) setUserId(currentUserId);

        if (!isSilent) setLoading(true);
        
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    id, last_message, updated_at, buyer_id, seller_id, listing_id,
                    listing:listings(title, image_uri, price),
                    buyer:profiles!conversations_buyer_id_fkey(full_name, avatar_url),
                    seller:profiles!conversations_seller_id_fkey(full_name, avatar_url)
                `)
                .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            const formatted: ConversationItem[] = (data || [])
                .filter((conv: any) => conv.id)
                .map((conv: any) => {
                    const isBuyer = conv.buyer_id === currentUserId;
                    return {
                        id: conv.id,
                        listing_id: conv.listing_id,
                        seller_id: conv.seller_id,
                        last_message: conv.last_message || 'No messages yet',
                        updated_at: conv.updated_at || new Date().toISOString(),
                        listing: conv.listing || { title: 'Item', image_uri: '', price: 0 },
                        other_user: (isBuyer ? conv.seller : conv.buyer) || { 
                            full_name: 'User', 
                            avatar_url: DEFAULT_AVATAR 
                        },
                    };
                });

            setConversations(formatted);
        } catch (err) {
            console.error('Inbox Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    const handleRealtimeUpdate = useCallback((payload: any) => {
        if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(c => c.id !== payload.old.id));
            return;
        }

        const data = payload.new;
        if (!data) return;

        if (payload.eventType === 'INSERT') {
            fetchConversations(true);
            return;
        }

        setConversations(prev => {
            const existing = prev.find(c => c.id === data.id);
            const filtered = prev.filter(c => c.id !== data.id);

            const updatedItem: ConversationItem = {
                id: data.id,
                listing_id: data.listing_id,
                seller_id: data.seller_id,
                last_message: data.last_message || 'No messages yet',
                updated_at: data.updated_at || new Date().toISOString(),
                listing: existing?.listing || { title: 'Item', image_uri: '', price: 0 },
                other_user: existing?.other_user || { full_name: 'User', avatar_url: DEFAULT_AVATAR }
            };

            return [updatedItem, ...filtered];
        });
    }, [fetchConversations]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('inbox-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations', filter: `buyer_id=eq.${userId}` },
                handleRealtimeUpdate
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations', filter: `seller_id=eq.${userId}` },
                handleRealtimeUpdate
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, handleRealtimeUpdate]);

    const handlePress = useCallback((it: ConversationItem) => {
        router.push({
            pathname: "/chat",
            params: { 
                itemId: it.listing_id, 
                sellerId: it.seller_id,
                sellerName: it.other_user?.full_name,
                productName: it.listing?.title,
                price: `€${it.listing?.price}`,
                productImage: encodeURIComponent(it.listing?.image_uri || '')
            }
        });
    }, [router]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchConversations(true);
    }, [fetchConversations]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator color="#22c55e" size="large" />
                </View>
            ) : (
                <FlatList
                    data={conversations}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <ChatRow item={item} onPress={handlePress} />}
                    contentContainerStyle={styles.list}
                    getItemLayout={(_, index) => ({
                        length: ITEM_HEIGHT,
                        offset: ITEM_HEIGHT * index,
                        index,
                    })}
                    initialNumToRender={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={80} color="#f1f5f9" />
                            <Text style={styles.emptyText}>No conversations yet.</Text>
                        </View>
                    }
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
    chatCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc', height: ITEM_HEIGHT },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#f1f5f9' },
    content: { flex: 1, marginLeft: 15, marginRight: 5 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    userName: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    time: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    lastMessage: { fontSize: 14, color: '#64748b', marginBottom: 6 },
    productTag: { fontSize: 11, color: '#22c55e', fontWeight: '700', backgroundColor: '#f0fdf4', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
    emptyText: { marginTop: 16, fontSize: 18, color: '#94a3b8', fontWeight: '600' },
});