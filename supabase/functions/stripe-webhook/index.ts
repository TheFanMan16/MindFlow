// Supabase Edge Function: Stripe Webhook Handler
// 
// This function handles Stripe webhooks to update user subscription status
//
// To deploy: supabase functions deploy stripe-webhook
//
// In Stripe Dashboard:
// 1. Go to Developers → Webhooks
// 2. Add endpoint: https://mfzsyazsvuzyiexgzxbw.supabase.co/functions/v1/stripe-webhook
// 3. Select events:
//    - checkout.session.completed
//    - customer.subscription.updated
//    - customer.subscription.deleted
// 4. Copy the webhook signing secret
// 5. Set STRIPE_WEBHOOK_SECRET in Supabase Dashboard → Settings → Edge Functions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize crypto provider for async webhook verification (required for Deno)
const cryptoProvider = Stripe.createSubtleCryptoProvider();

// Get Supabase credentials
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// CRITICAL: Use SERVICE_ROLE_KEY to bypass Row Level Security (RLS)
// This allows the webhook to update profiles without RLS restrictions
if (!supabaseServiceKey) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured in Edge Function secrets!');
  console.error('  - This will cause the webhook to fail when updating profiles');
  console.error('  - Add SUPABASE_SERVICE_ROLE_KEY to Supabase Dashboard → Edge Functions → Secrets');
} else {
  console.log('✅ SUPABASE_SERVICE_ROLE_KEY is configured (length:', supabaseServiceKey.length, ')');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    console.log('📥 Webhook request received');
    
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('❌ No Stripe signature in headers');
      return new Response('No signature', { status: 400 });
    }

    // Read raw body as text (CRITICAL: must be raw text, not JSON)
    const body = await req.text();
    
    // Verify webhook signature using async method (required for Deno runtime)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        cryptoProvider
      );
      console.log('✅ Webhook signature verified. Event type:', event.type);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // CRITICAL: Extract userId from client_reference_id (primary) or metadata (backup)
        const userId = session.client_reference_id || session.metadata?.userId;
        
        console.log('🔔 Checkout session completed event received');
        console.log('  - Session ID:', session.id);
        console.log('  - client_reference_id:', session.client_reference_id);
        console.log('  - metadata:', session.metadata);
        console.log('  - Extracted User ID:', userId);
        
        if (!userId) {
          console.warn('❌ No user ID found in checkout session');
          console.warn('  - client_reference_id:', session.client_reference_id);
          console.warn('  - metadata.userId:', session.metadata?.userId);
          break;
        }

        console.log('📝 Updating profile to Pro for user:', userId);
        console.log('  - Using SERVICE_ROLE_KEY to bypass RLS:', supabaseServiceKey ? 'Yes' : 'No');
        
        // Update user's plan to 'pro' - ONLY update is_pro (database only has this column)
        // CRITICAL: Using SERVICE_ROLE_KEY bypasses RLS, so this will work
        const { data, error } = await supabase
          .from('profiles')
          .update({ 
            is_pro: true,
          })
          .eq('id', userId)
          .select(); // Return updated data for verification

        if (error) {
          console.error('❌ Error updating profile:', error);
          console.error('  - Error code:', error.code);
          console.error('  - Error message:', error.message);
          console.error('  - Error details:', error.details);
          console.error('  - Error hint:', error.hint);
          
          // If profile doesn't exist, try to create it
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            console.log('⚠️ Profile not found, attempting to create new profile...');
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                is_pro: true,
                streak_count: 0,
                total_focus_minutes: 0,
                is_admin: false,
              })
              .select()
              .single();

            if (createError) {
              console.error('❌ Error creating profile:', createError);
              console.error('  - Error code:', createError.code);
              console.error('  - Error message:', createError.message);
            } else {
              console.log('✅ Profile created and set to Pro:', newProfile);
            }
          }
        } else {
          console.log('✅ Successfully updated profile to Pro for user:', userId);
          if (data && data.length > 0) {
            console.log('  - Updated profile data:', JSON.stringify(data[0], null, 2));
            console.log('  - is_pro:', data[0].is_pro);
          } else {
            console.warn('  - Warning: Update succeeded but no data returned (row count:', data?.length || 0, ')');
            console.warn('  - This might indicate the profile does not exist for user:', userId);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          // Downgrade user's plan to 'free' - ONLY update is_pro
          const { error } = await supabase
            .from('profiles')
            .update({ 
              is_pro: false,
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating profile:', error);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        // Update plan based on subscription status - ONLY update is_pro
        if (userId) {
          const isActive = subscription.status === 'active';
          
          const { error } = await supabase
            .from('profiles')
            .update({ 
              is_pro: isActive,
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating profile:', error);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
});
