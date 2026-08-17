// Supabase Edge Function: Create Stripe Checkout Session
// 
// To deploy this function:
// 1. Install Supabase CLI: npm install -g supabase
// 2. Login: supabase login
// 3. Link project: supabase link --project-ref mfzsyazsvuzyiexgzxbw
// 4. Deploy: supabase functions deploy create-checkout-session
//
// Set environment variables in Supabase Dashboard:
// - STRIPE_SECRET_KEY: Your Stripe secret key (starts with sk_)
// - STRIPE_PRICE_ID: Your Stripe price ID (required)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== Checkout Session Request Received ===');
    
    // Check if Stripe secret key is configured
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('ERROR: STRIPE_SECRET_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    console.log('✅ STRIPE_SECRET_KEY found (length:', stripeSecretKey.length, ')');
    
    // Initialize Stripe with the secret key
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { userId } = await req.json();
    console.log('User ID received:', userId);

    if (!userId) {
      console.error('ERROR: User ID is missing');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get STRIPE_PRICE_ID from environment variables
    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    if (!priceId) {
      console.error('ERROR: STRIPE_PRICE_ID is not configured');
      return new Response(
        JSON.stringify({ error: 'STRIPE_PRICE_ID is not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    console.log('✅ STRIPE_PRICE_ID found:', priceId);

    // Get the origin from the request to set the success/cancel URLs
    // Default to localhost:5173 for development
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    const baseUrl = origin;
    console.log('Base URL:', baseUrl);

    console.log('Creating Stripe Checkout Session...');
    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: undefined, // Will be collected during checkout
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // CRITICAL: Hard-code locale to 'en' to prevent Stripe from trying to load locale files
      locale: 'en',
      success_url: `${baseUrl}/dashboard?success=true`,
      cancel_url: `${baseUrl}/dashboard?canceled=true`,
      client_reference_id: userId, // Store user ID for webhook processing
      metadata: {
        userId: userId,
      },
    });

    console.log('✅ Stripe Checkout Session created successfully. Session ID:', session.id);
    console.log('Checkout URL:', session.url);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('❌ ERROR creating checkout session:');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // If it's a Stripe error, log additional details
    if (error.type) {
      console.error('Stripe error type:', error.type);
    }
    if (error.code) {
      console.error('Stripe error code:', error.code);
    }
    if (error.param) {
      console.error('Stripe error param:', error.param);
    }
    if (error.decline_code) {
      console.error('Stripe decline code:', error.decline_code);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

