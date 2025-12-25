# Stripe Setup - Quick Start ✅

## Your Stripe Price ID
```
price_1Si0mZCeNi12DQQTN2jcPYJT
```

This has been added to the config! ✅

## What's Been Set Up

✅ **Price ID configured** in `src/config/api.js`
✅ **Subscription handler** updated in ProfileMode.jsx
✅ **Stripe utility** functions created
✅ **Edge Function templates** for checkout and webhooks

## Next Steps (15 minutes)

### 1. Add Stripe Keys to `.env`

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

The price ID is already hardcoded, but you can override it:
```env
VITE_STRIPE_PRICE_ID=price_1Si0mZCeNi12DQQTN2jcPYJT
```

### 2. Deploy Supabase Edge Functions

**Prerequisites:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref mfzsyazsvuzyiexgzxbw
```

**Set Secrets in Supabase Dashboard:**
- Settings → Edge Functions → Secrets
- Add: `STRIPE_SECRET_KEY` = your Stripe secret key (starts with `sk_`)

**Deploy:**
```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

### 3. Configure Stripe Webhook

1. Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://mfzsyazsvuzyiexgzxbw.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook secret → Add as `STRIPE_WEBHOOK_SECRET` in Supabase secrets

## How It Works

1. User clicks "Subscribe" → Calls Edge Function
2. Edge Function creates Stripe checkout session
3. User redirected to Stripe → Enters payment
4. Stripe sends webhook → Updates database `plan_type` to 'pro'
5. User redirected back → Sees pro status

## Testing

Use Stripe test card: `4242 4242 4242 4242`

## Files Created

- `supabase/functions/create-checkout-session/index.ts` - Creates checkout
- `supabase/functions/stripe-webhook/index.ts` - Handles webhooks
- `src/utils/stripe.js` - Updated with price ID
- `STRIPE_SETUP.md` - Detailed guide

See `STRIPE_SETUP.md` for full instructions!

