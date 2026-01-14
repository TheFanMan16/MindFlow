/**
 * Stripe Integration Utility
 * 
 * This file provides a utility function to load Stripe with locale hardcoded to 'en'
 * to prevent locale import errors.
 * 
 * NOTE: Currently, the app uses direct window.location redirects for checkout,
 * so this utility is not actively used. However, if you need to use Stripe Elements
 * or other client-side Stripe features in the future, use this function.
 */

import config from '../config/api';

// Lazy load Stripe (only when needed)
let stripePromise = null;

/**
 * Get Stripe instance with locale hardcoded to 'en'
 * This prevents Stripe from trying to dynamically load locale files
 */
export async function getStripe() {
  if (!config.stripe.publishableKey) {
    throw new Error('Stripe publishable key is not configured. Please check your .env file.');
  }

  if (!stripePromise) {
    const { loadStripe } = await import('@stripe/stripe-js');
    // CRITICAL: Hard-code locale to 'en' to prevent locale import errors
    stripePromise = loadStripe(config.stripe.publishableKey, {
      locale: 'en' // This stops Stripe from trying to dynamically "find" a locale
    });
  }

  return stripePromise;
}

