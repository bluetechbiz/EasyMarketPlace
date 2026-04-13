import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { order_id, status } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ⏱ ETA SYSTEM
    const now = new Date();
    let eta = null;
    let progress = 0;

    if (status === "packed") {
      eta = new Date(now.getTime() + 30 * 60000); // 30 min
      progress = 25;
    }

    if (status === "shipped") {
      eta = new Date(now.getTime() + 20 * 60000); // 20 min
      progress = 70;
    }

    if (status === "delivered") {
      eta = now;
      progress = 100;
    }

    // 🚚 UPDATE ORDER
    const { error } = await supabase
      .from("orders")
      .update({
        status,
        estimated_delivery: eta,
        delivery_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    if (error) throw error;

    // 📦 TRACKING EVENT
    await supabase.from("order_tracking").insert({
      order_id,
      status,
      message: `Order is now ${status} (ETA updated)`,
      created_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});