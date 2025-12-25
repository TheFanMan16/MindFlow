# Stripe Integration Setup Guide

## ✅ What's Been Set Up

- Stripe price ID added to config: `price_1Si0mZCeNi12DQQTN2jcPYJT`
- Subscription handler in ProfileMode.jsx
- Stripe utility functions
- Supabase Edge Function templates for checkout and webhooks

## Step 1: Add Stripe Keys to `.env`

Add to your `.env` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_STRIPE_PRICE_ID=price_1Si0mZCeNi12DQQTN2jcPYJT
```

**Note**: The price ID is already hardcoded in the config as a fallback, but you can override it with the env variable.

## Step 2: Deploy Supabase Edge Functions

### Prerequisites
```bash
npm install -g supabase
```

### Deploy Checkout Function

1. **Link your project:**
   ```bash
   supabase login
   supabase link --project-ref mfzsyazsvuzyiexgzxbw
   ```

2. **Set environment variables in Supabase Dashboard:**
   - Go to: Settings → Edge Functions → Secrets
   - Add: `STRIPE_SECRET_KEY` = your Stripe secret key (starts with `sk_`)

3. **Deploy the function:**
   ```bash
   supabase functions deploy create-checkout-session
   ```

### Deploy Webhook Function

1. **Set environment variables:**
   - `STRIPE_SECRET_KEY` (same as above)
   - `STRIPE_WEBHOOK_SECRET` (get from Stripe dashboard, step 3)
   - `SUPABASE_URL` = `https://mfzsyazsvuzyiexgzxbw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key (from Settings → API)

2. **Deploy:**
   ```bash
   supabase functions deploy stripe-webhook
   ```

## Step 3: Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://mfzsyazsvuzyiexgzxbw.supabase.co/functions/v1/stripe-webhook`
4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **Add endpoint**
6. **Copy the webhook signing secret** (starts with `whsec_`)
7. Add it as `STRIPE_WEBHOOK_SECRET` in Supabase Edge Functions secrets

## Step 4: Handle Checkout Success

Update your ProfileMode or create a checkout success handler:

```javascript
// In ProfileMode.jsx or App.jsx
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  if (sessionId) {
    // Checkout successful - webhook will update the database
    // Just refresh the user profile
    loadUserProfile();
    
    // Remove session_id from URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);
```

## How It Works

1. **User clicks "Subscribe"** → Calls `createCheckoutSession()`
2. **Edge Function creates Stripe session** → Returns session ID
3. **User redirected to Stripe Checkout** → Enters payment info
4. **Stripe processes payment** → Sends webhook to your Edge Function
5. **Webhook updates database** → Sets `plan_type` to 'pro'
6. **User redirected back** → Sees updated plan status

## Testing

### Test Mode
1. Use test publishable key (`pk_test_...`)
2. Use test price ID (create one in Stripe test mode)
3. Use test card: `4242 4242 4242 4242`
4. Any future expiry date, any CVC

### Test Webhook Locally
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # Mac
# or download from: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local function
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## Security Notes

✅ **Stripe secret key** stays on server (Supabase Edge Functions)
✅ **Publishable key** is safe for client-side use
✅ **Webhook signature verification** prevents fake webhooks
✅ **User ID stored in metadata** for secure profile updates

## Troubleshooting

**"Function not found"**
- Make sure you deployed the function: `supabase functions deploy create-checkout-session`
- Check function is listed in Supabase Dashboard → Edge Functions

**"Stripe secret key not set"**
- Add `STRIPE_SECRET_KEY` in Supabase Dashboard → Settings → Edge Functions → Secrets

**"Webhook not working"**
- Verify webhook URL in Stripe Dashboard
- Check webhook secret is set correctly
- View logs: `supabase functions logs stripe-webhook`

**"Plan not updating"**
- Check webhook events are being received in Stripe Dashboard
- Verify webhook function logs
- Check database directly to see if plan_type is updating

## Next Steps

After testing:
1. Create production price ID in Stripe
2. Update price ID in config or `.env`
3. Use production publishable key (`pk_live_...`)
4. Update webhook endpoint URL to production domain

