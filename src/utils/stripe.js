/**
 * Stripe Integration
 * 
 * Handles Stripe payment and subscription operations.
 * 
 * To install: npm install @stripe/stripe-js
 */

import config from '../config/api';
import { supabase } from '../lib/supabaseClient';

// Lazy load Stripe (only when needed)
let stripePromise = null;

/**
 * Get Stripe instance
 */
export async function getStripe() {
  if (!config.stripe.publishableKey) {
    throw new Error('Stripe publishable key is not configured. Please check your .env file.');
  }

  if (!stripePromise) {
    const { loadStripe } = await import('@stripe/stripe-js');
    stripePromise = loadStripe(config.stripe.publishableKey);
  }

  return stripePromise;
}

/**
 * Create a checkout session via Supabase Edge Function
 * @param {string} priceId - The Stripe price ID (defaults to config price ID)
 * @param {string} userId - The user ID for the subscription
 * @returns {Promise<void>} Redirects to Stripe Checkout
 */
export async function createCheckoutSession(priceId = null, userId = null) {
  // This MUST call your backend API (Supabase Edge Function or your server)
  // Stripe secret keys should NEVER be in client code
  
  const finalPriceId = priceId || config.stripe.priceId;
  
  if (!finalPriceId) {
    throw new Error('Stripe price ID is not configured');
  }

  try {
    // Use Supabase Edge Function to create checkout session
    // This keeps the Stripe secret key on the server
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { 
        priceId: finalPriceId,
        userId: userId,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.sessionId) {
      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      const { error: redirectError } = await stripe.redirectToCheckout({ 
        sessionId: data.sessionId 
      });
      
      if (redirectError) {
        throw redirectError;
      }
    } else if (data?.url) {
      // If the function returns a URL directly, redirect to it
      window.location.href = data.url;
    } else {
      throw new Error('Invalid response from checkout session creation');
    }
  } catch (error) {
    console.error('Stripe checkout error:', error);
    throw error;
  }
}

