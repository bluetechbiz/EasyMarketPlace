import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { OrderService } from "../src/services/orderService";
import { useCartStore } from "../src/store/cartStore";

const STATUS_FLOW = [
  "paid",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

export default function OrderTracking() {
  const params = useLocalSearchParams();
  const orderId = params?.orderId as string | undefined;

  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [order, setOrder] = useState<any>(null);
  const [tracking, setTracking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🚀 ORDER ID:", orderId);

    if (!orderId) {
      setLoading(false);
      return;
    }

    load();

    const sub = OrderService.subscribeToOrder(orderId, async () => {
      load();
    });

    return () => {
      sub.unsubscribe();
    };
  }, [orderId]);

  const load = async () => {
    try {
      const orderData = await OrderService.getOrder(orderId!);
      const trackingData = await OrderService.getTracking(orderId!);

      setOrder(orderData);
      setTracking(trackingData || []);
    } catch (e) {
      console.log("❌ Tracking load error:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!orderId) {
    return (
      <View style={styles.center}>
        <Text style={{ fontWeight: "bold", color: "red" }}>❌ No Order Found</Text>
        <Text>Please place an order first</Text>
      </View>
    );
  }

  if (loading || !order) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const eta = order.estimated_delivery
    ? new Date(order.estimated_delivery)
    : OrderService.getETA(order.status, order.created_at);

  const handleBuyAgain = () => {
    order.order_items?.forEach((item: any) => {
      addItem({
        id: item.id,
        listing_id: item.listing_id,
        title: item.title,
        price: item.price,
        image: item.image,
        quantity: 1,
      });
    });
    router.push("/(tabs)/cartreview");
  };

  const normalizedStatus = order.status?.toLowerCase() || "";
  const currentIndex = STATUS_FLOW.indexOf(normalizedStatus);
  const progress = currentIndex === -1 ? 10 : ((currentIndex + 1) / STATUS_FLOW.length) * 100;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 Track Your Order</Text>

      {/* ETA */}
      <Text style={styles.eta}>
        Estimated Delivery: {eta ? eta.toLocaleString() : "Calculating..."}
      </Text>

      {/* NEW: SHIPPING ADDRESS BOX */}
      <View style={styles.addressBox}>
        <Text style={styles.addressLabel}>SHIPPING TO:</Text>
        <Text style={styles.addressValue}>
          {order.shipping_address || "No address provided"}
        </Text>
      </View>

      {/* PROGRESS BAR */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {/* STATUS DISPLAY */}
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>
          STATUS: {normalizedStatus.toUpperCase()}
        </Text>
      </View>

      {/* TIMELINE */}
      <FlatList
        data={tracking}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={{ color: "#94a3b8", textAlign: 'center', marginTop: 20 }}>
            Waiting for warehouse updates...
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.timelineItem}>
            <View style={styles.timelinePoint} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStatus}>✔ {item.status.toUpperCase()}</Text>
              <Text style={styles.timelineMsg}>{item.message}</Text>
              <Text style={styles.timelineDate}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      />

      {/* BUY AGAIN BUTTON */}
      {normalizedStatus === "delivered" && (
        <TouchableOpacity style={styles.buyAgain} onPress={handleBuyAgain}>
          <Text style={styles.buyText}>🔁 Buy Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "900", marginBottom: 5, color: "#0f172a" },
  eta: { marginBottom: 15, fontWeight: "600", color: "#2563eb", fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ADDRESS BOX STYLES
  addressBox: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  addressLabel: { 
    fontSize: 10, 
    color: '#64748b', 
    fontWeight: '800', 
    letterSpacing: 1,
    marginBottom: 4 
  },
  addressValue: { 
    fontSize: 14, 
    color: '#0f172a', 
    fontWeight: '500',
    lineHeight: 20
  },

  progressBar: {
    height: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: "#22c55e",
    borderRadius: 10,
  },
  statusBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusText: { fontWeight: "800", color: "#16a34a", fontSize: 12, letterSpacing: 1 },
  timelineItem: { flexDirection: 'row', marginBottom: 20 },
  timelinePoint: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', marginTop: 4, marginRight: 15 },
  timelineContent: { flex: 1, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  timelineStatus: { fontWeight: "800", color: "#0f172a", fontSize: 14, marginBottom: 2 },
  timelineMsg: { color: "#64748b", fontSize: 13 },
  timelineDate: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  buyAgain: { backgroundColor: "#f97316", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  buyText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});