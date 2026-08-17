# Finding Keys in Git History

This document helps identify if there are real API keys in your git history before running filter-repo.

## Steps to Check for Keys in History

1. **Search for Stripe keys:**
   ```powershell
   git log --all -S "sk_test_" --source --all
   git log --all -S "pk_test_" --source --all
   git log --all -S "sk_live_" --source --all
   git log --all -S "pk_live_" --source --all
   ```

2. **Search for Supabase JWT tokens (long eyJ strings):**
   ```powershell
   git log --all -S "eyJ" -p | Select-String -Pattern "eyJ[A-Za-z0-9_-]{100,}"
   ```

3. **Search for specific project URLs:**
   ```powershell
   git log --all -p | Select-String -Pattern "https://[a-z0-9]+\.supabase\.co"
   ```

## Before Running filter-repo

⚠️ **IMPORTANT**: Make a backup first!
```powershell
# Create a backup branch
git branch backup-before-filter-repo
```

## Running git filter-repo

See `scripts/scrub-keys-from-history.md` for the actual filter-repo commands.
