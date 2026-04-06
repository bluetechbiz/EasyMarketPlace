import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { itemId } = await req.json();
    const apiKey = Deno.env.get('RAPID_API_KEY');

    if (!itemId) {
      throw new Error("Missing itemId in request body");
    }

    const response = await fetch(
      `https://aliexpress-datahub.p.rapidapi.com/item_detail_2?itemId=${itemId}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': apiKey || '',
          'X-RapidAPI-Host': 'aliexpress-datahub.p.rapidapi.com'
        }
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})