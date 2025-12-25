# Supabase Setup Guide

## Step 1: Add Credentials to `.env`

Add these to your `.env` file (create it if it doesn't exist):

```env
VITE_SUPABASE_URL=https://mfzsyazsvuzyiexgzxbw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1menN5YXpzdnV6eWlleGd6eGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MDg0OTIsImV4cCI6MjA4MjE4NDQ5Mn0.JgEfrBx3c1yo5epCtPHylfhDf-KtQ_yEEMWIpaO8OCQ
```

## Step 2: Enable Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `mfzsyazsvuzyiexgzxbw`
3. Go to **Authentication** → **Providers**
4. Find **Google** and click **Enable**
5. You'll need:
   - **Client ID** from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - **Client Secret** from Google Cloud Console
6. Add **Authorized redirect URIs**:
   - `http://localhost:5173`
   - `https://mfzsyazsvuzyiexgzxbw.supabase.co/auth/v1/callback`

### Getting Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Application type: **Web application**
7. Authorized redirect URIs: Add `https://mfzsyazsvuzyiexgzxbw.supabase.co/auth/v1/callback`
8. Copy **Client ID** and **Client Secret**
9. Paste into Supabase Google provider settings

## Step 3: Create Database Table

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy and paste the SQL from `supabase/migrations/001_create_profiles_table.sql`
3. Click **Run**

This creates:
- `profiles` table with user info and plan type
- Row Level Security policies
- Automatic profile creation trigger on signup

## Step 4: Install Dependencies (if not already installed)

```bash
npm install @supabase/supabase-js
```

## Step 5: Test the Setup

1. Start your dev server: `npm run dev`
2. Go to Profile page
3. Click "Sign in with Google"
4. Complete Google OAuth flow
5. You should be redirected back and see your profile

## What Was Set Up

### ✅ Files Created/Updated:
- `src/lib/supabaseClient.js` - Supabase client initialization
- `src/components/ProfileMode.jsx` - Real Google OAuth integration
- `src/App.jsx` - Auth state management
- `supabase/migrations/001_create_profiles_table.sql` - Database schema

### ✅ Features:
- Google OAuth sign-in
- Automatic profile creation on first sign-in
- User profile loading from database
- Sign-out functionality
- Auth state persistence

## Database Schema

The `profiles` table includes:
- `id` (UUID) - References auth.users
- `email` (TEXT) - User email
- `full_name` (TEXT) - User's name
- `avatar_url` (TEXT) - Profile picture URL
- `plan_type` (TEXT) - 'free' or 'pro'
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Security

- ✅ Row Level Security (RLS) enabled
- ✅ Users can only read/update their own profile
- ✅ Automatic profile creation via database trigger
- ✅ Secure OAuth flow with Google

## Troubleshooting

**"Google sign-in not working"**
- Check that Google OAuth is enabled in Supabase
- Verify redirect URIs are correct
- Check browser console for errors

**"Profile not created"**
- Check that the migration SQL was run successfully
- Check Supabase logs for errors
- Verify the trigger function exists

**"Cannot read profile"**
- Check RLS policies are enabled
- Verify user is authenticated
- Check browser console for errors

