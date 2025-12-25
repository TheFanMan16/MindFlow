# API Keys Setup Guide

## ⚠️ Security Warning
**NEVER share your API keys with anyone or commit them to git!**

## Step 1: Create Your `.env` File

1. In the root directory of your project, create a file named `.env`
2. Copy the following template and fill in your actual keys:

```env
# Google Gemini API
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here

# Stripe (use test keys for development)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_key_here
VITE_STRIPE_PRICE_ID=price_1Si0mZCeNi12DQQTN2jcPYJT

# Supabase
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key_here

# Environment
VITE_ENV=development
```

## Step 2: Get Your API Keys

### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it in `.env` as `VITE_GEMINI_API_KEY`

### Stripe Publishable Key
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy the "Publishable key" (starts with `pk_test_` for test mode)
3. Paste it in `.env` as `VITE_STRIPE_PUBLISHABLE_KEY`
4. **Note**: For production, you'll need a production key (starts with `pk_live_`)

### Supabase Keys
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a new project or select existing one
3. Go to Settings → API
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

**Your current credentials:**
```env
VITE_SUPABASE_URL=https://mfzsyazsvuzyiexgzxbw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menN5YXpzdnV6eWlleGd6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDg0OTIsImV4cCI6MjA4MjE4NDQ5Mn0.JgEfrBx3c1yo5epCtPHylfhDf-KtQ_yEEMWIpaO8OCQ
```

## Step 3: Install Required Packages

```bash
# For Supabase
npm install @supabase/supabase-js

# For Stripe
npm install @stripe/stripe-js
```

## Step 4: Verify Setup

1. Restart your dev server (`npm run dev`)
2. Check the browser console - you should see warnings if keys are missing
3. The app will use these keys automatically through the config system

## Step 5: Test Your Keys

### Test Gemini
- Try generating flashcards - it should use Gemini instead of localhost

### Test Supabase
- Try signing in - it should connect to your Supabase project

### Test Stripe
- Try the subscription flow - it should use your Stripe account

## Production Deployment

For production:
1. Set environment variables in your hosting platform (Vercel, Netlify, etc.)
2. Use production Stripe keys (`pk_live_...`)
3. Ensure `.env` is in `.gitignore` (it already is)

## Troubleshooting

- **"API key is not configured"**: Check that your `.env` file exists and has the correct variable names
- **"Missing environment variables"**: Make sure all keys start with `VITE_` prefix
- **Keys not working**: Restart your dev server after adding/changing `.env` file

