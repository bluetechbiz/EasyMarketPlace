import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body = await req.text();
    const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    let event;

    // 1. Verify Webhook Signature
    if (endpointSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
      } catch (err) {
        console.error(`❌ Signature verification failed: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
      }
    } else {
      // Local testing fallback
      event = JSON.parse(body);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Handle 'payment_intent.succeeded'
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;

      // FIX 1: Metadata safety check
      if (!orderId) {
        console.error("❌ Missing orderId in metadata");
        return new Response("Missing orderId", { status: 400 });
      }

      console.log(`✅ Payment received for Order: ${orderId}`);

      // FIX 2: Prevent double updates (Idempotency)
      const { data: existingOrder } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (existingOrder?.status === 'completed') {
        console.log("⚠️ Order already completed, skipping");
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);

      if (error) throw error;
      console.log(`🔔 Database updated: Order ${orderId} is now COMPLETED`);
    }

    // FIX 3: Handle failed payments
    else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId) {
        console.log(`❌ Payment failed for Order: ${orderId}`);
        await supabaseAdmin
          .from('orders')
          .update({ status: 'failed' })
          .eq('id', orderId);
      }
    }

    // FIX 4: Log unknown events
    else {
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});