# Supabase Setup - Quick Start ✅

## What I've Set Up

✅ **Supabase client** (`src/lib/supabaseClient.js`)
✅ **Google OAuth sign-in** (ProfileMode.jsx)
✅ **Auth state management** (App.jsx)
✅ **Database schema** (SQL migration file)
✅ **Profile creation on signup** (automatic trigger)

## Next Steps (5 minutes)

### 1. Add to `.env` file

Create/edit `.env` in root directory:

```env
VITE_SUPABASE_URL=https://mfzsyazsvuzyiexgzxbw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menN5YXpzdnV6eWlleGd6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDg0OTIsImV4cCI6MjA4MjE4NDQ5Mn0.JgEfrBx3c1yo5epCtPHylfhDf-KtQ_yEEMWIpaO8OCQ
```

### 2. Run Database Migration

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New query**
5. Copy contents of `supabase/migrations/001_create_profiles_table.sql`
6. Paste and click **Run**

This creates:
- `profiles` table
- Row Level Security policies
- Auto-create profile trigger

### 3. Enable Google OAuth

1. Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** → Click **Enable**
3. Get credentials from [Google Cloud Console](https://console.cloud.google.com/):
   - Create OAuth 2.0 Client ID
   - Add redirect URI: `https://mfzsyazsvuzyiexgzxbw.supabase.co/auth/v1/callback`
   - Copy Client ID and Secret
4. Paste into Supabase Google provider settings
5. Save

### 4. Test It!

```bash
npm run dev
```

1. Go to Profile page
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Profile should appear automatically! 🎉

## What Happens When User Signs In

1. User clicks "Sign in with Google"
2. Redirected to Google OAuth
3. After approval, redirected back to app
4. **Database trigger** automatically creates profile row
5. App loads profile from database
6. User sees their info + plan type

## Database Schema

```sql
profiles (
  id UUID (references auth.users),
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  plan_type TEXT ('free' or 'pro'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Troubleshooting

**"Sign in button doesn't work"**
- Check `.env` file has correct credentials
- Restart dev server after adding `.env`

**"Profile not created"**
- Make sure SQL migration was run
- Check Supabase logs for errors

**"Google OAuth error"**
- Verify Google OAuth is enabled in Supabase
- Check redirect URI matches exactly

See `SUPABASE_SETUP.md` for detailed instructions.

