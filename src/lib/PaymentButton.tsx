import { useStripe } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from './supabase';

interface PaymentButtonProps {
  listingId: string;
  listingTitle?: string;
  displayPrice: number; 
}

const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 Minutes

const PaymentButton = ({ listingId, listingTitle, displayPrice }: PaymentButtonProps) => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Cache the client secret to prevent unnecessary Edge Function calls
  const cachedIntent = useRef<{ secret: string; created: number } | null>(null);

  const handlePayment = async () => {
    if (loading) return; 

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert("Authentication Required", "Please log in to complete your purchase.");
      router.push('/(auth)/login');
      return;
    }

    setLoading(true);

    try {
      let clientSecret: string;
      const now = Date.now();

      // 1. Fetch Client Secret (with Cache & Timeout)
      if (cachedIntent.current && (now - cachedIntent.current.created < CACHE_EXPIRY_MS)) {
        clientSecret = cachedIntent.current.secret;
      } else {
        const fetchIntent = supabase.functions.invoke('stripe-payment', {
          body: { listingId }, 
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout. Please check your connection.")), 12000)
        );

        const { data, error } = await Promise.race([fetchIntent, timeout]);

        if (error) throw new Error(error.message || 'Server error');
        if (!data?.clientSecret) throw new Error('Initialization failed.');

        clientSecret = data.clientSecret;
        cachedIntent.current = { secret: data.clientSecret, created: now };
      }

      // 2. Initialize Stripe Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'EasyMarketPlace',
        defaultBillingDetails: { email: session.user.email },
        allowsDelayedPaymentMethods: true,
        appearance: {
          colors: { primary: '#10b981' },
          shapes: { borderRadius: 12 }
        },
      });

      if (initError) {
        cachedIntent.current = null;
        throw new Error(initError.message);
      }

      // 3. Present the Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          cachedIntent.current = null;
          Alert.alert('Payment Error', presentError.message);
        }
      } else {
        // ✅ 4. SUCCESS! Save Order to Supabase
        
        // Fetch the seller_id from the listing first
        const { data: listingData } = await supabase
          .from('listings')
          .select('user_id')
          .eq('id', listingId)
          .single();

        // Insert into your 'orders' table
        const { error: orderError } = await supabase
          .from('orders')
          .insert({
            listing_id: listingId,
            buyer_id: session.user.id,
            seller_id: listingData?.user_id, // Links to the person who posted the item
            amount: displayPrice,
            status: 'completed'
          });

        if (orderError) {
          console.error("Order Record Error:", orderError.message);
        }

        cachedIntent.current = null;
        Alert.alert(
          'Success ✨',
          'Payment confirmed! Your order is being processed.',
          [
            { text: 'View Orders', onPress: () => router.push('/(tabs)/profile') },
            { text: 'Continue Shopping', style: 'cancel' }
          ]
        );
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      Alert.alert('Payment Error', message);
      cachedIntent.current = null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[
          styles.button, 
          loading && styles.disabled,
          { opacity: loading ? 0.8 : 1 }
        ]} 
        onPress={handlePayment} 
        disabled={loading}
      >
        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
            <Text style={styles.text}>Securing...</Text>
          </View>
        ) : (
          <Text style={styles.text} numberOfLines={1}>
            Pay Now • €{Number(displayPrice).toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    width: '100%', 
    paddingHorizontal: 4 
  },
  button: {
    backgroundColor: '#10b981', 
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  disabled: { 
    backgroundColor: '#94a3b8' 
  },
  text: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 15, 
    letterSpacing: 0.3 
  },
});

export default PaymentButton;