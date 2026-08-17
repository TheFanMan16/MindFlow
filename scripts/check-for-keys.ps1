# PowerShell script to check for API keys in markdown files and git history
# Run this before scrubbing history

Write-Host "Checking for API keys in markdown files..." -ForegroundColor Yellow

# Check markdown files for potential keys
$patterns = @(
    "sk_test_[a-zA-Z0-9]{48,}",  # Stripe secret keys (test)
    "sk_live_[a-zA-Z0-9]{48,}",  # Stripe secret keys (live)
    "pk_test_[a-zA-Z0-9]{48,}",  # Stripe publishable keys (test)
    "pk_live_[a-zA-Z0-9]{48,}",  # Stripe publishable keys (live)
    "eyJ[A-Za-z0-9_-]{200,}",    # JWT tokens (Supabase)
    "https://[a-z0-9]{20,}\.supabase\.co"  # Supabase project URLs
)

$found = $false

foreach ($pattern in $patterns) {
    Write-Host "`nChecking pattern: $pattern" -ForegroundColor Cyan
    $matches = Select-String -Path *.md -Pattern $pattern -AllMatches
    if ($matches) {
        $found = $true
        Write-Host "  FOUND in:" -ForegroundColor Red
        foreach ($match in $matches) {
            Write-Host "    - $($match.Filename):$($match.LineNumber)" -ForegroundColor Red
            Write-Host "      $($match.Line.Trim())" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No matches found" -ForegroundColor Green
    }
}

Write-Host "`n`nChecking git history..." -ForegroundColor Yellow
Write-Host "This may take a while..." -ForegroundColor Gray

# Check git history
$historyMatches = $false
foreach ($pattern in $patterns) {
    $gitResults = git log --all -p -S $pattern 2>$null
    if ($gitResults) {
        $historyMatches = $true
        Write-Host "`n  FOUND in git history: $pattern" -ForegroundColor Red
        Write-Host "    Run 'git log --all -p -S $pattern' to see details" -ForegroundColor Yellow
    }
}

if (-not $found -and -not $historyMatches) {
    Write-Host "`n✅ No API keys found in markdown files or recent history" -ForegroundColor Green
    Write-Host "   (Note: This doesn't guarantee keys aren't in older commits)" -ForegroundColor Gray
} else {
    Write-Host "`n⚠️ API keys found!" -ForegroundColor Red
    Write-Host "   See scripts/scrub-keys-from-history.md for removal instructions" -ForegroundColor Yellow
}
