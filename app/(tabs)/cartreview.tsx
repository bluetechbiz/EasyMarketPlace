import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useCartStore } from '../../src/store/cartStore';

const COLORS = {
  primary: '#f97316',
  bg: '#f8fafc',
  white: '#ffffff',
  textDark: '#0f172a',
  textGray: '#64748b',
};

const calculateMarketplaceSplit = (price: number) => {
  let rate = 0.20; 
  if (price <= 10) rate = 0.05;
  else if (price <= 50) rate = 0.12;

  const commission = parseFloat((price * rate).toFixed(2));
  const payout = parseFloat((price - commission).toFixed(2));

  return { commission, payout };
};

export default function CartReview() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const items = useCartStore((s) => s.items);
  const setItems = useCartStore((s) => s.setItems);
  const removeItemStore = useCartStore((s) => s.removeItem);
  const increaseQty = useCartStore((s) => s.increaseQty);
  const decreaseQty = useCartStore((s) => s.decreaseQty);
  const getTotal = useCartStore((s) => s.getTotal);

  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [reviewText, setReviewText] = useState<{ [key: string]: string }>({});
  const [address, setAddress] = useState(""); 

  const fetchCart = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          listing_id,
          quantity,
          listings (
            id,
            title,
            price,
            image_uri,
            image_uris,
            seller_id
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const formatted = (data || []).map((item: any) => {
        const listing = item.listings ?? {};
        return {
          id: item.id,
          listing_id: item.listing_id,
          seller_id: listing.seller_id, 
          title: listing?.title ?? 'Product',
          price: Number(listing?.price ?? 0),
          quantity: item.quantity ?? 1,
          image: listing.image_uri ?? (Array.isArray(listing.image_uris) ? listing.image_uris[0] : null),
        };
      });

      setItems(formatted);
    } catch (err) {
      console.log('❌ Cart error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchCart(); }, []));

  const subtotal = useMemo(() => getTotal(), [items]);
  const shipping = subtotal > 0 ? 4.99 : 0;
  const total = subtotal + shipping;

  const handleCheckout = async () => {
    if (total <= 0) return Alert.alert("Cart Empty");
    if (!address.trim()) return Alert.alert("Missing Address", "Please enter a shipping address.");

    try {
      setCheckoutLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login required");

      const { data, error } = await supabase.functions.invoke("create-payment-intent", {
        body: { amount: Math.round(total * 100), currency: "eur" },
      });

      if (error || !data?.paymentIntent) throw new Error("Payment failed");

      await initPaymentSheet({
        merchantDisplayName: "Elite Market",
        customerId: data.customer,
        customerEphemeralKeySecret: data.ephemeralKey,
        paymentIntentClientSecret: data.paymentIntent,
      });

      const { error: payError } = await presentPaymentSheet();
      if (payError) return; 

      const ordersToInsert = items.map((item) => {
        const rowTotal = item.price * item.quantity;
        const { commission, payout } = calculateMarketplaceSplit(rowTotal);
        
        return {
          buyer_id: user.id,
          seller_id: item.seller_id || user.id, 
          listing_id: item.listing_id,           
          amount: rowTotal,                     
          commission_fee: commission, 
          seller_payout: payout,      
          status: 'paid',
          shipping_address: address, 
        };
      });

      const { data: createdOrders, error: orderError } = await supabase
        .from('orders')
        .insert(ordersToInsert)
        .select('id'); 

      if (orderError) throw orderError;

      const newOrderId = createdOrders?.[0]?.id;
      await supabase.from('cart_items').delete().eq('user_id', user.id);
      setItems([]);

      router.replace({
        pathname: '/order-success',
        params: { orderId: newOrderId }
      });

    } catch (err: any) {
      console.log("❌ Checkout Error:", err);
      Alert.alert("Checkout Error", err.message || "Something went wrong");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const changeQty = async (item: any, delta: number) => {
    const newQty = Math.max(1, item.quantity + delta);
    if (delta > 0) increaseQty(item.id);
    else decreaseQty(item.id);
    await supabase.from('cart_items').update({ quantity: newQty }).eq('id', item.id);
  };

  const removeItem = async (id: string) => {
    removeItemStore(id);
    await supabase.from('cart_items').delete().eq('id', id);
  };

  const submitReview = async (listingId: string, cartItemId: string) => {
    const text = reviewText[cartItemId];
    if (!text) return Alert.alert("Write something first");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('reviews').insert({
      listing_id: listingId,
      user_id: user?.id,
      comment: text,
      rating: 5,
    });
    setReviewText(prev => ({ ...prev, [cartItemId]: '' }));
    Alert.alert("Review posted ⭐");
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <TouchableOpacity onPress={() => removeItem(item.id)}>
            <Ionicons name="trash-outline" size={20} color="red" />
          </TouchableOpacity>
        </View>
        <Text style={styles.price}>€{item.price.toFixed(2)}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity onPress={() => changeQty(item, -1)}><Ionicons name="remove-circle-outline" size={24} /></TouchableOpacity>
          <Text style={styles.qty}>{item.quantity}</Text>
          <TouchableOpacity onPress={() => changeQty(item, 1)}><Ionicons name="add-circle-outline" size={24} color={COLORS.primary} /></TouchableOpacity>
        </View>
        <TextInput
          placeholder="Write review..."
          value={reviewText[item.id] || ''}
          onChangeText={(t) => setReviewText(prev => ({ ...prev, [item.id]: t }))}
          style={styles.input}
        />
        <TouchableOpacity style={styles.reviewBtn} onPress={() => submitReview(item.listing_id, item.id)}>
          <Text>Post Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!loading && items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Your cart is empty 🛒</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView><Text style={styles.header}>🛒 Your Cart</Text></SafeAreaView>
      <ScrollView>
        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <TextInput
            placeholder="Enter full delivery address..."
            value={address}
            onChangeText={setAddress}
            multiline
            style={styles.addressInput}
          />
        </View>
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} /> : (
          <FlatList 
            scrollEnabled={false} 
            data={items} 
            keyExtractor={(i) => i.id} 
            renderItem={renderItem} 
          />
        )}
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.summary}><Text>Subtotal</Text><Text>€{subtotal.toFixed(2)}</Text></View>
        <View style={styles.summary}><Text>Shipping</Text><Text>€{shipping.toFixed(2)}</Text></View>
        <View style={styles.summaryTotal}><Text style={{ fontWeight: '800' }}>Total</Text><Text style={{ fontWeight: '800' }}>€{total.toFixed(2)}</Text></View>
        <TouchableOpacity style={styles.checkout} onPress={handleCheckout} disabled={checkoutLoading}>
          {checkoutLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Proceed to Checkout</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { fontSize: 22, fontWeight: '900', padding: 16 },
  addressSection: {
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 10,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  addressInput: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, height: 80, textAlignVertical: 'top', fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: '#fff', margin: 10, padding: 12, borderRadius: 12 },
  image: { width: 80, height: 80, borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontWeight: '700', flex: 1 },
  price: { color: COLORS.primary, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  qty: { marginHorizontal: 10, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#eee', marginTop: 8, padding: 6, borderRadius: 8 },
  reviewBtn: { marginTop: 6, backgroundColor: '#eee', padding: 6, borderRadius: 8, alignItems: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  summary: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  checkout: { marginTop: 10, backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});