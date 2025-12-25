# API Key Security Guide 🔒

## ⚠️ Critical Security Concerns

You're absolutely right to be concerned! API keys can be:
- Stolen from client-side code
- Used maliciously if exposed
- Cost thousands of dollars if abused

## 🛡️ Security Measures Already Implemented

### ✅ What's Protected
1. **`.env` file is in `.gitignore`** - Keys won't be committed to git
2. **Environment variables** - Keys stored locally, not hardcoded
3. **Vite prefix system** - Only `VITE_` variables exposed (by design)

### ⚠️ What's NOT Protected (Client-Side Risk)
**IMPORTANT**: In a React/Vite app, ALL `VITE_` environment variables are **bundled into the client-side JavaScript**. This means:
- Anyone can open DevTools → Sources → find your API keys
- Keys are visible in the built JavaScript bundle
- Keys can be extracted from the app

## 🔐 Best Practices to Protect Your Keys

### 1. **Set API Key Restrictions** (CRITICAL)

#### Gemini API Key Restrictions
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" → "Credentials"
3. Click on your API key
4. Under "API restrictions":
   - ✅ Select "Restrict key"
   - ✅ Choose ONLY "Generative Language API"
5. Under "Application restrictions":
   - ✅ Select "HTTP referrers (web sites)"
   - ✅ Add your domain: `http://localhost:5173/*` (dev)
   - ✅ Add production domain: `https://yourdomain.com/*`
6. **Set Quota Limits**:
   - Go to "APIs & Services" → "Quotas"
   - Set daily/monthly request limits
   - Set cost limits (e.g., $50/month max)

#### Stripe Key Restrictions
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Use **Test Mode** keys for development
3. **Publishable keys are safe** - they can only create charges, not access funds
4. **NEVER expose Secret keys** (they start with `sk_`)
5. Set up webhook signatures for production

#### Supabase Key Restrictions
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Settings → API
3. The **anon key** is designed to be public (it's safe)
4. Use **Row Level Security (RLS)** policies to protect data
5. **NEVER expose the service_role key** (starts with `eyJ...`)

### 2. **Set Usage Quotas & Alerts**

#### Gemini Quota Setup
```bash
# In Google Cloud Console:
1. Go to "APIs & Services" → "Quotas"
2. Find "Generative Language API"
3. Set:
   - Requests per day: 1000 (adjust as needed)
   - Requests per minute: 10
   - Cost limit: $50/month (or your budget)
4. Enable email alerts at 50%, 75%, 90% of quota
```

#### Stripe Usage Monitoring
1. Dashboard → Developers → Webhooks
2. Set up alerts for:
   - Failed payments
   - Unusual activity
   - High-volume charges

### 3. **Monitor API Usage Daily**

#### Check Gemini Usage
- Google Cloud Console → "APIs & Services" → "Dashboard"
- Check daily request counts
- Review cost breakdown

#### Check Stripe Activity
- Dashboard → Payments
- Review all transactions
- Set up email notifications

### 4. **Use Backend Proxy (RECOMMENDED for Production)**

For production, you should **NEVER** put API keys in client-side code. Instead:

**Option A: Create a Backend API**
- Use Node.js/Express or Supabase Edge Functions
- Store keys on server only
- Client calls your API → Your API calls Gemini/Stripe
- Keys never leave the server

**Option B: Use Supabase Edge Functions**
- Store keys as Supabase secrets
- Create Edge Functions that proxy API calls
- Client calls Supabase → Supabase calls external APIs

### 5. **Rotate Keys Regularly**
- Change API keys every 90 days
- Immediately revoke if you suspect compromise
- Use different keys for dev/staging/production

## 🚨 Emergency Response Plan

If you suspect your keys are compromised:

1. **IMMEDIATELY** revoke the key in the provider dashboard
2. Generate a new key
3. Update your `.env` file
4. Check usage logs for unauthorized activity
5. Contact provider support if you see suspicious charges

## 📊 Recommended Setup for Your App

### Development (Current Setup - OK for now)
- ✅ Use test/restricted keys
- ✅ Set low quotas
- ✅ Monitor usage
- ✅ Use `.env` file (not committed)

### Production (Needs Backend)
- ❌ **DON'T** use client-side API keys
- ✅ Create backend API proxy
- ✅ Use Supabase Edge Functions
- ✅ Implement rate limiting
- ✅ Add authentication checks

## 🔧 Quick Security Checklist

- [ ] Set API key restrictions (domain/IP whitelist)
- [ ] Set daily/monthly quotas
- [ ] Enable usage alerts
- [ ] Use test keys for development
- [ ] Review usage logs weekly
- [ ] Rotate keys every 90 days
- [ ] Plan backend migration for production
- [ ] Set up cost alerts/budgets

## 💡 Cost Protection Tips

1. **Set Hard Limits**: Most APIs let you set spending caps
2. **Use Test Mode**: Stripe test keys can't charge real money
3. **Monitor Daily**: Check usage every day initially
4. **Start Small**: Begin with very low quotas, increase as needed
5. **Use Free Tiers**: Gemini has free tier, use it for development

## 📝 Example: Safe Gemini Setup

```javascript
// In Google Cloud Console, your key should have:
API Restrictions:
  ✅ Generative Language API only

Application Restrictions:
  ✅ HTTP referrers: 
     - http://localhost:5173/*
     - https://yourdomain.com/*

Quotas:
  ✅ Requests per day: 1000
  ✅ Requests per minute: 10
  ✅ Cost limit: $50/month
  ✅ Alert at: 50%, 75%, 90%
```

## 🎯 Next Steps

1. **Right Now**: Set restrictions and quotas on all your keys
2. **This Week**: Monitor usage daily
3. **Before Launch**: Implement backend proxy for production
4. **Ongoing**: Review and rotate keys quarterly

---

**Remember**: Client-side API keys are inherently less secure. For production apps with real users, you MUST use a backend proxy. The current setup is fine for development, but plan to migrate before public launch.

