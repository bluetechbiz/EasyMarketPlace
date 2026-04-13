import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
// ⚠️ NEW IMPORT
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';

interface Order {
    id: string;
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
    created_at: string;
    tracking_number?: string;
    customer_info?: {
        name: string;
        address: string;
        city: string;
        phone: string;
    };
    listings?: {
        title: string;
        price: number;
        supplier_cost?: number;
        source_url?: string;
    };
}

const statusConfig = {
    pending: { bg: '#fef3c7', text: '#92400e' },
    shipped: { bg: '#dbeafe', text: '#1e40af' },
    delivered: { bg: '#dcfce7', text: '#166534' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
};

function OrdersContent() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    
    // ⚠️ USE INSETS INSTEAD OF RECT-NATIVE SAFEAREAVIEW
    const insets = useSafeAreaInsets();
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select('*, listings(title, price, supplier_cost, source_url)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Fetch error:', error.message);
        } else {
            setOrders(data?.filter(o => o.listings) || []);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchOrders();
    }, []);

    const safeFetch = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(fetchOrders, 300);
    }, []);

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('orders-hub')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, safeFetch)
            .subscribe();

        return () => { 
            if (debounceRef.current) clearTimeout(debounceRef.current);
            channel.unsubscribe();
        };
    }, [safeFetch]);

    const openLink = async (url?: string) => {
        if (!url) return;
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) await Linking.openURL(url);
        } catch (e) {
            Alert.alert("Error", "Could not open link.");
        }
    };

    const renderOrderItem = ({ item }: { item: Order }) => {
        const sellingPrice = item.listings?.price || 0;
        const supplierCost = item.listings?.supplier_cost ?? (sellingPrice / 1.3);
        const profit = sellingPrice - supplierCost;
        const isRealProfit = !!item.listings?.supplier_cost;

        const formattedDate = new Intl.DateTimeFormat('en-GB', { 
            dateStyle: 'medium' 
        }).format(new Date(item.created_at));

        const statusStyle = statusConfig[item.status] || statusConfig.pending;

        return (
            <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                        <Text style={styles.dateText}>{formattedDate}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.text }]}>
                            {item.status.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <Text style={styles.productTitle} numberOfLines={2}>
                    {item.listings?.title || "Product no longer available"}
                </Text>

                <View style={styles.rowBetween}>
                    <View>
                        <Text style={styles.label}>REVENUE</Text>
                        <Text style={styles.price}>€{sellingPrice.toFixed(2)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.label}>{isRealProfit ? 'NET PROFIT' : 'EST. PROFIT'}</Text>
                        <Text style={[styles.profit, profit < 0 && { color: '#ef4444' }]}>
                            {profit >= 0 ? '+' : '-'}€{Math.abs(profit).toFixed(2)}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openLink(item.listings?.source_url)}>
                        <Ionicons name="cart" size={16} color="white" />
                        <Text style={styles.actionText}>Source</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.trackBtn, !item.tracking_number && { opacity: 0.3 }]} 
                        onPress={() => {
                            if (item.tracking_number) {
                                const trackUrl = `https://www.17track.net/en/track#nums=${encodeURIComponent(item.tracking_number)}`;
                                openLink(trackUrl);
                            }
                        }}
                        disabled={!item.tracking_number}
                    >
                        <Ionicons name="bus" size={16} color="#4f46e5" />
                        <Text style={styles.trackBtnText}>Track</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.customerBtn} onPress={() => setSelectedOrder(item)}>
                        <Ionicons name="person" size={16} color="#1e293b" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Fulfillment Hub</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={orders}
                    keyExtractor={(item) => item.id}
                    renderItem={renderOrderItem}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
                    }
                    ListEmptyComponent={<Text style={styles.emptyText}>No active orders.</Text>}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                />
            )}

            <Modal visible={!!selectedOrder} animationType="fade" transparent>
                <TouchableWithoutFeedback onPress={() => setSelectedOrder(null)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalCard}>
                                <Text style={styles.modalTitle}>Shipping Info</Text>
                                <View style={styles.infoBox}>
                                    <Text style={styles.modalLabel}>NAME</Text>
                                    <Text style={styles.modalValue}>{selectedOrder?.customer_info?.name || 'N/A'}</Text>
                                    <Text style={styles.modalLabel}>ADDRESS</Text>
                                    <Text style={styles.modalValue}>{selectedOrder?.customer_info?.address || 'N/A'}</Text>
                                    <Text style={styles.modalLabel}>CITY</Text>
                                    <Text style={styles.modalValue}>{selectedOrder?.customer_info?.city || 'N/A'}</Text>
                                    <Text style={styles.modalLabel}>PHONE</Text>
                                    <Text style={styles.modalValue}>{selectedOrder?.customer_info?.phone || 'N/A'}</Text>
                                </View>
                                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
                                    <Text style={styles.closeText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

// ⚠️ WRAP WITH PROVIDER FOR THE HOOK TO WORK
export default function OrdersScreen() {
    return (
        <SafeAreaProvider>
            <OrdersContent />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 10 },
    title: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
    orderCard: { backgroundColor: 'white', padding: 20, borderRadius: 24, marginBottom: 15, elevation: 2, shadowOpacity: 0.05 },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    orderId: { fontSize: 11, fontWeight: '800', color: '#94a3b8' },
    dateText: { fontSize: 11, color: '#94a3b8' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '900' },
    productTitle: { fontSize: 16, fontWeight: '700', marginVertical: 12, color: '#1e293b' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16 },
    label: { fontSize: 8, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
    price: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
    profit: { color: '#22c55e', fontWeight: 'bold', fontSize: 14 },
    actionsRow: { flexDirection: 'row', marginTop: 15 },
    actionBtn: { flex: 2, backgroundColor: '#4f46e5', flexDirection: 'row', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    trackBtn: { flex: 2, backgroundColor: '#f1f5f9', flexDirection: 'row', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 10 },
    customerBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    actionText: { color: 'white', marginLeft: 8, fontSize: 12, fontWeight: 'bold' },
    trackBtnText: { color: '#4f46e5', marginLeft: 8, fontSize: 12, fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 100, color: '#94a3b8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', padding: 20 },
    modalCard: { backgroundColor: 'white', padding: 25, borderRadius: 32 },
    modalTitle: { fontSize: 20, fontWeight: '900', marginBottom: 20, color: '#0f172a' },
    infoBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 20 },
    modalLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginTop: 10 },
    modalValue: { fontSize: 15, color: '#1e293b', fontWeight: '600' },
    closeBtn: { backgroundColor: '#1e293b', marginTop: 20, padding: 18, borderRadius: 18, alignItems: 'center' },
    closeText: { color: 'white', fontWeight: 'bold' }
});