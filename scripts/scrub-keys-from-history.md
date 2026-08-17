# Scrubbing API Keys from Git History

⚠️ **WARNING**: This will rewrite git history. Make a backup first!

## Prerequisites

1. **Install git-filter-repo:**
   ```powershell
   pip install git-filter-repo
   ```
   
   Or on Windows with chocolatey:
   ```powershell
   choco install git-filter-repo
   ```

2. **Backup your repository:**
   ```powershell
   git branch backup-before-filter-repo
   git tag backup-before-filter-repo
   ```

3. **Check if you have a remote (this will rewrite history!):**
   ```powershell
   git remote -v
   ```

## Step 1: Identify Keys to Remove

Run these to find keys in history:
```powershell
# Stripe keys
git log --all -S "sk_test_" --source --all
git log --all -S "pk_test_" --source --all

# Supabase JWT tokens
git log --all -p | Select-String -Pattern "eyJ[A-Za-z0-9_-]{100,}"
```

## Step 2: Create Replacement File

Create a file `replacements.txt` with patterns to replace:

```
sk_test_[YOUR_ACTUAL_KEY_PATTERN_HERE]==>sk_test_your_stripe_secret_key_here
pk_test_[YOUR_ACTUAL_KEY_PATTERN_HERE]==>pk_test_your_stripe_publishable_key_here
eyJ[YOUR_ACTUAL_JWT_PATTERN_HERE]==>eyJ_your_supabase_anon_key_here
https://[YOUR_PROJECT].supabase.co==>https://your-project-id.supabase.co
```

## Step 3: Run git-filter-repo

### Option A: Replace specific strings

```powershell
# Replace Stripe secret key
git filter-repo --replace-text <(echo "sk_test_ACTUAL_KEY_HERE==>sk_test_your_stripe_secret_key_here")

# Replace Stripe publishable key
git filter-repo --replace-text <(echo "pk_test_ACTUAL_KEY_HERE==>pk_test_your_stripe_publishable_key_here")

# Replace Supabase JWT token
git filter-repo --replace-text <(echo "eyJ_ACTUAL_JWT_HERE==>eyJ_your_supabase_anon_key_here")
```

### Option B: Use a replacements file (recommended)

1. Create `replacements.txt`:
```
sk_test_YOUR_ACTUAL_KEY==>sk_test_your_stripe_secret_key_here
pk_test_YOUR_ACTUAL_KEY==>pk_test_your_stripe_publishable_key_here
eyJ_YOUR_ACTUAL_JWT==>eyJ_your_supabase_anon_key_here
https://YOUR_PROJECT.supabase.co==>https://your-project-id.supabase.co
```

2. Run filter-repo:
```powershell
git filter-repo --replace-text replacements.txt
```

## Step 4: Force Push (if you have a remote)

⚠️ **WARNING**: This rewrites history. Coordinate with your team first!

```powershell
git push origin --force --all
git push origin --force --tags
```

## Alternative: BFG Repo-Cleaner (easier to use)

1. Download BFG: https://rtyley.github.io/bfg-repo-cleaner/

2. Create `replacements.txt`:
```
sk_test_ACTUAL_KEY==>sk_test_your_stripe_secret_key_here
pk_test_ACTUAL_KEY==>pk_test_your_stripe_publishable_key_here
eyJ_ACTUAL_JWT==>eyJ_your_supabase_anon_key_here
```

3. Run BFG:
```powershell
java -jar bfg.jar --replace-text replacements.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

## After Scrubbing

1. **Verify the replacements:**
   ```powershell
   git log --all -p | Select-String -Pattern "sk_test_|pk_test_|eyJ"
   ```

2. **All keys should now be placeholders**

3. **If using GitHub/GitLab:**
   - Rotate your API keys immediately
   - Keys may still be accessible via GitHub/GitLab's database/caches
   - Consider all exposed keys compromised
