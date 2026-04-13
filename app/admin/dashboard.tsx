import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total_orders: 0, total_revenue: 0, pending_orders: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();

    // 💎 REAL-TIME: Postgres Changes Listener
    const channel = supabase
      .channel("admin-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchAdminData(); 
        }
      )
      .subscribe();

    return () => {
      // Clean up the channel to prevent ghost subscriptions
      supabase.removeChannel(channel);
      channel.unsubscribe(); 
    };
  }, []);

  async function fetchAdminData() {
    try {
      setLoading(true);
      const { data: statData } = await supabase.from('admin_stats').select('*').single();
      const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      
      setOrders(orderData || []);
      setStats(statData || { total_orders: 0, total_revenue: 0, pending_orders: 0 });
    } catch (error) {
      console.error("Admin Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId, nextStatus, pushToken) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`https://gjxfxibmjrbutovebjmq.supabase.co/functions/v1/update-order-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          order_id: orderId, 
          status: nextStatus, 
          pushToken: pushToken ?? undefined 
        })
      });
      
      if (response.ok) {
        fetchAdminData();
        Alert.alert("Success", `Order updated to ${nextStatus.toUpperCase()} 🚚`);
      } else {
        const errorData = await response.json();
        Alert.alert("Error", errorData.error || "Update failed");
      }
    } catch (error) {
      Alert.alert("Network Error", "Check connection to Edge Functions");
    }
  }

  // ❗ Performance Boost using useMemo
  const filteredOrders = useMemo(() => {
    const query = search.toLowerCase();
    return orders.filter(o => 
      (o.id || "").toLowerCase().includes(query) || 
      (o.status || "").toLowerCase().includes(query)
    );
  }, [orders, search]);

  if (loading && orders.length === 0) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.adminTitle}>Admin Console</Text>
          {/* ✅ FIXED: Changed div to View */}
          <View style={styles.liveIndicator}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE UPDATES ACTIVE</Text>
          </View>
        </View>
        <Text style={styles.countBadge}>{filteredOrders.length} Orders</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Revenue</Text>
          <Text style={[styles.statValue, {color: '#10b981'}]}>
            €{Number(stats?.total_revenue ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Needs Action</Text>
          <Text style={styles.statValue}>{stats?.pending_orders ?? 0}</Text>
        </View>
      </View>

      <TextInput 
        style={styles.searchBar} 
        placeholder="Filter by ID or Status..." 
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        initialNumToRender={10}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderId}>ID: {(item.id || "").slice(0, 8)}</Text>
                <Text style={styles.dateText}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'No date'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.statusBadgeText}>{(item.status || "UNKNOWN").toUpperCase()}</Text>
              </View>
            </View>
            
            <Text style={styles.totalText}>€{Number(item.total_amount || item.amount || 0).toFixed(2)}</Text>

            <View style={styles.buttonRow}>
              {(item.status === 'paid' || item.status === 'pending') && (
                <TouchableOpacity onPress={() => updateStatus(item.id, 'packed', item.push_token)} style={styles.btn}>
                  <Text style={styles.btnText}>📦 Pack Order</Text>
                </TouchableOpacity>
              )}
              {item.status === 'packed' && (
                <TouchableOpacity onPress={() => updateStatus(item.id, 'shipped', item.push_token)} style={[styles.btn, {backgroundColor: '#3b82f6'}]}>
                  <Text style={styles.btnText}>🚚 Ship Order</Text>
                </TouchableOpacity>
              )}
              {item.status === 'shipped' && (
                <TouchableOpacity onPress={() => updateStatus(item.id, 'delivered', item.push_token)} style={[styles.btn, {backgroundColor: '#10b981'}]}>
                  <Text style={styles.btnText}>✅ Mark Delivered</Text>
                </TouchableOpacity>
              )}
              {item.status === 'delivered' && (
                <View style={styles.completedBadge}><Text style={styles.completedText}>ORDER CLOSED</Text></View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function getStatusColor(status) {
  switch (status) {
    case 'pending': return '#f1f5f9';
    case 'paid': return '#fef3c7';
    case 'packed': return '#e0e7ff';
    case 'shipped': return '#dbeafe';
    case 'delivered': return '#dcfce7';
    default: return '#f1f5f9';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 45, marginBottom: 20 },
  adminTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 },
  liveText: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.5 },
  countBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '600', color: '#475569' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 20, elevation: 3 },
  statLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0f172a' },
  searchBar: { backgroundColor: '#fff', padding: 16, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  orderCard: { backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 12, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  dateText: { color: '#94a3b8', fontSize: 11 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '800', color: '#475569' },
  totalText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 15 },
  buttonRow: { flexDirection: 'row', minHeight: 45 },
  btn: { flex: 1, backgroundColor: '#f97316', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  completedBadge: { flex: 1, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12, alignItems: 'center' },
  completedText: { color: '#94a3b8', fontWeight: '800', fontSize: 12 }
});