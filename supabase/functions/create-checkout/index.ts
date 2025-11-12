import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use the service role to reliably validate the user token in all environments
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("[CREATE-CHECKOUT] Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    const token = authHeader.replace("Bearer ", "");

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;

    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    console.log("[CREATE-CHECKOUT] User authenticated:", user.email);

    // Read price_id from body with safe fallback
    const DEFAULT_PRICE_ID = 'price_1SRzrKPFVcRfSdEa6X7WSrTV';
    let price_id: string | undefined;
    try {
      const raw = await req.text();
      if (raw) {
        const parsed = JSON.parse(raw);
        price_id = parsed?.price_id;
      }
    } catch (e) {
      console.log('[CREATE-CHECKOUT] Body parse failed, using fallback. Error:', e);
    }

    if (!price_id || !String(price_id).startsWith('price_')) {
      price_id = DEFAULT_PRICE_ID;
      console.log('[CREATE-CHECKOUT] price_id ausente/inválido. Usando default:', price_id);
    }

    console.log('[CREATE-CHECKOUT] Using price_id:', price_id);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_NOVA") || "";
    console.log(`[CREATE-CHECKOUT] Using Stripe key suffix: ${stripeKey ? stripeKey.slice(-6) : 'MISSING'}`);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log("[CREATE-CHECKOUT] Found existing customer:", customerId);
    } else {
      console.log("[CREATE-CHECKOUT] Creating new customer");
    }

    const origin = req.headers.get("origin") || "https://pxzvpnshhulrsjbeqqhn.supabase.co";
    console.log("[CREATE-CHECKOUT] Creating checkout session with price:", price_id);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        { price: price_id, quantity: 1 },
      ],
      mode: "subscription",
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: { user_id: user.id },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    console.log("[CREATE-CHECKOUT] Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[CREATE-CHECKOUT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
