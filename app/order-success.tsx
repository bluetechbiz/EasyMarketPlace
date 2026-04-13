import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Ensure we are catching the orderId correctly from the navigation params
  const orderId = params?.orderId;

  const handleTrackOrder = () => {
    if (!orderId || orderId === 'undefined') {
      Alert.alert("Missing ID", "We couldn't retrieve the Order ID. Please check your internet connection.");
      return;
    }

    router.push({
      pathname: '/order-tracking',
      params: { orderId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>

        {/* SUCCESS ICON */}
        <View style={styles.iconBox}>
          <Ionicons name="checkmark-circle" size={110} color="#22c55e" />
        </View>

        {/* TITLE */}
        <Text style={styles.title}>Order Confirmed 🎉</Text>

        {/* SUBTEXT */}
        <Text style={styles.subtitle}>
          Your order has been placed successfully and is now being processed.
        </Text>

        {/* ORDER ID */}
        <View style={styles.orderBox}>
          <Text style={styles.orderLabel}>Order ID</Text>
          <Text style={styles.orderId} numberOfLines={1}>
            {orderId && orderId !== 'undefined' ? String(orderId) : 'Processing...'}
          </Text>
        </View>

        {/* TRACK BUTTON */}
        <TouchableOpacity
          style={[styles.trackBtn, (!orderId || orderId === 'undefined') && { opacity: 0.5 }]}
          onPress={handleTrackOrder}
        >
          <Ionicons name="locate" size={18} color="#fff" />
          <Text style={styles.trackText}>Track Your Order</Text>
        </TouchableOpacity>

        {/* CONTINUE SHOPPING */}
        <TouchableOpacity
          style={styles.shopBtn}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.shopText}>Continue Shopping</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  iconBox: {
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  orderBox: {
    backgroundColor: '#f1f5f9',
    width: '100%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  orderLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 4,
  },
  trackBtn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f97316',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  shopBtn: {
    paddingVertical: 12,
  },
  shopText: {
    color: '#0f172a',
    fontWeight: '700',
  },
});