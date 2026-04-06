import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('CUSTOM_URL') || Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');

    const supabaseAdmin = createClient(url!, key!, { auth: { persistSession: false } });

    // 1. Auth & Data
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Authentication failed");

    const { listingId, buyerId } = await req.json();

    // 2. Fetch Listing
    const { data: listing, error: listError } = await supabaseAdmin
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (listError || !listing) throw new Error("Listing not found");

    const sellerId = listing.seller_id || listing.user_id;

    // 3. SECURITY: Prevent buying your own item
    if (sellerId === buyerId) {
      throw new Error("You cannot purchase your own item. Please log in with a different account to test.");
    }

    // 4. Create Order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([{
        listing_id: listingId,
        buyer_id: buyerId,
        seller_id: sellerId,
        amount: Number(listing.price),
        status: 'pending'
      }])
      .select().single();

    if (orderError) throw new Error("Database Order Error: " + orderError.message);

    // 5. Stripe
    const stripe = new Stripe(stripeSecret!, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(listing.price) * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: order.id }
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, orderId: order.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});