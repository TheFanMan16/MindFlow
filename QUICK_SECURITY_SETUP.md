# Quick Security Setup (5 Minutes) ⚡

## Step 1: Restrict Your Gemini API Key (2 min)

1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your Gemini API key
3. Under "API restrictions":
   - ✅ Select "Restrict key"
   - ✅ Choose "Generative Language API" only
4. Under "Application restrictions":
   - ✅ Select "HTTP referrers"
   - ✅ Add: `http://localhost:5173/*`
5. Click "Save"

## Step 2: Set Quota Limits (2 min)

1. Go to https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Find "Requests per day"
3. Click edit (pencil icon)
4. Set to: **1000 requests/day** (adjust as needed)
5. Enable email alerts at 50%, 75%, 90%
6. Click "Save"

## Step 3: Set Cost Budget Alert (1 min)

1. Go to https://console.cloud.google.com/billing/budgets
2. Create new budget
3. Set amount: **$50/month** (or your limit)
4. Add alert emails
5. Save

## ✅ Done!

Your API key is now:
- ✅ Restricted to only Generative Language API
- ✅ Restricted to localhost only
- ✅ Limited to 1000 requests/day
- ✅ Monitored with alerts

## 🔍 Monitor Usage

Check daily at: https://console.cloud.google.com/apis/dashboard

---

**For Stripe**: Use test keys (`pk_test_...`) - they can't charge real money.

**For Supabase**: The anon key is safe to use client-side (it's designed for that).

