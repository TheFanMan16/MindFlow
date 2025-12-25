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
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return new Response('No signature', { status: 400 });
    }

    const body = await req.text();
    
    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        
        if (userId) {
          // Update user's plan to 'pro'
          const { error } = await supabase
            .from('profiles')
            .update({ 
              plan_type: 'pro',
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (error) {
            console.error('Error updating profile:', error);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          // Downgrade user's plan to 'free'
          const { error } = await supabase
            .from('profiles')
            .update({ 
              plan_type: 'free',
              updated_at: new Date().toISOString(),
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
        
        // Update plan based on subscription status
        if (userId) {
          const planType = subscription.status === 'active' ? 'pro' : 'free';
          
          const { error } = await supabase
            .from('profiles')
            .update({ 
              plan_type: planType,
              updated_at: new Date().toISOString(),
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
