# PowerShell script to replace API keys with placeholders in markdown files
# Run this BEFORE committing changes, then use git filter-repo to scrub history

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Continue"

# Patterns to identify and replace API keys
$patterns = @{
    'stripe_secret_test' = @{
        Pattern = 'sk_test_[a-zA-Z0-9]{48,}'
        Replacement = 'sk_test_your_stripe_secret_key_here'
    }
    'stripe_secret_live' = @{
        Pattern = 'sk_live_[a-zA-Z0-9]{48,}'
        Replacement = 'sk_live_your_stripe_secret_key_here'
    }
    'stripe_publishable_test' = @{
        Pattern = 'pk_test_[a-zA-Z0-9]{48,}'
        Replacement = 'pk_test_your_stripe_publishable_key_here'
    }
    'stripe_publishable_live' = @{
        Pattern = 'pk_live_[a-zA-Z0-9]{48,}'
        Replacement = 'pk_live_your_stripe_publishable_key_here'
    }
    'supabase_jwt' = @{
        Pattern = 'eyJ[A-Za-z0-9_-]{200,}'
        Replacement = 'eyJ_your_supabase_anon_key_here'
    }
    'supabase_url' = @{
        Pattern = 'https://[a-z0-9]{20,}\.supabase\.co'
        Replacement = 'https://your-project-id.supabase.co'
    }
    'gemini_key' = @{
        Pattern = 'AIza[0-9A-Za-z\-_]{35}'
        Replacement = 'AIza_your_gemini_api_key_here'
    }
}

Write-Host "`nScanning markdown files for API keys..." -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN MODE - No files will be modified`n" -ForegroundColor Yellow
}

# Find all markdown files
$repoRoot = Get-Location
$mdFiles = Get-ChildItem -Path $repoRoot -Filter "*.md" -File

Write-Host "Found $($mdFiles.Count) markdown files`n" -ForegroundColor Gray

$totalReplacements = 0
$filesModified = @()

foreach ($file in $mdFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        $originalContent = $content
        $fileReplacements = @()
        
        foreach ($keyType in $patterns.Keys) {
            $pattern = $patterns[$keyType].Pattern
            $replacement = $patterns[$keyType].Replacement
            
            if ($content -match $pattern) {
                $matches = [regex]::Matches($content, $pattern)
                foreach ($match in $matches) {
                    $lineNumber = ($content.Substring(0, $match.Index) -split "`n").Count
                    $fileReplacements += @{
                        Type = $keyType
                        Original = $match.Value
                        Replacement = $replacement
                        Line = $lineNumber
                    }
                    $content = $content -replace [regex]::Escape($match.Value), $replacement
                }
            }
        }
        
        if ($fileReplacements.Count -gt 0) {
            if (-not $DryRun) {
                Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
                Write-Host "✅ Replaced $($fileReplacements.Count) key(s) in $($file.Name)" -ForegroundColor Green
            } else {
                Write-Host "🔍 Would replace $($fileReplacements.Count) key(s) in $($file.Name)" -ForegroundColor Yellow
            }
            
            foreach ($rep in $fileReplacements) {
                $preview = if ($rep.Original.Length -gt 50) { $rep.Original.Substring(0, 50) + "..." } else { $rep.Original }
                Write-Host "   Line $($rep.Line): $($rep.Type)" -ForegroundColor Gray
                Write-Host "      $preview -> $($rep.Replacement)" -ForegroundColor DarkGray
            }
            
            $filesModified += $file.Name
            $totalReplacements += $fileReplacements.Count
        }
    }
    catch {
        Write-Host "❌ Error processing $($file.Name): $_" -ForegroundColor Red
    }
}

Write-Host "`n" -NoNewline
if ($totalReplacements -eq 0) {
    Write-Host "✅ No API keys found in markdown files!" -ForegroundColor Green
    Write-Host "   All files appear to use placeholders already." -ForegroundColor Gray
} else {
    if ($DryRun) {
        Write-Host "Would replace $totalReplacements key(s) in $($filesModified.Count) file(s)" -ForegroundColor Yellow
        Write-Host "`nRun without -DryRun to apply changes:" -ForegroundColor Cyan
        Write-Host "   .\scripts\replace-keys-in-files.ps1" -ForegroundColor White
    } else {
        Write-Host "✅ Replaced $totalReplacements key(s) in $($filesModified.Count) file(s)" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Cyan
        Write-Host "   1. Review changes: git diff" -ForegroundColor White
        Write-Host '   2. Commit changes: git add *.md' -ForegroundColor White
        Write-Host '   3. Use git-filter-repo to scrub history (see GIT_HISTORY_KEY_SCRUBBING.md)' -ForegroundColor White
    }
}
