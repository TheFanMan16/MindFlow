#!/usr/bin/env python3
"""
Script to replace real API keys with placeholders in markdown files.
Run this BEFORE committing changes, then use git filter-repo to scrub history.
"""

import re
import os
import sys
from pathlib import Path

# Patterns to identify API keys
PATTERNS = {
    'stripe_secret_test': (r'sk_test_[a-zA-Z0-9]{48,}', 'sk_test_your_stripe_secret_key_here'),
    'stripe_secret_live': (r'sk_live_[a-zA-Z0-9]{48,}', 'sk_live_your_stripe_secret_key_here'),
    'stripe_publishable_test': (r'pk_test_[a-zA-Z0-9]{48,}', 'pk_test_your_stripe_publishable_key_here'),
    'stripe_publishable_live': (r'pk_live_[a-zA-Z0-9]{48,}', 'pk_live_your_stripe_publishable_key_here'),
    'supabase_jwt': (r'eyJ[A-Za-z0-9_-]{200,}', 'eyJ_your_supabase_anon_key_here'),
    'supabase_url': (r'https://[a-z0-9]{20,}\.supabase\.co', 'https://your-project-id.supabase.co'),
    'gemini_key': (r'AIza[0-9A-Za-z\\-_]{35}', 'AIza_your_gemini_api_key_here'),
}

def find_keys_in_file(file_path):
    """Find all keys in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return []
    
    found_keys = []
    for key_type, (pattern, placeholder) in PATTERNS.items():
        matches = re.finditer(pattern, content)
        for match in matches:
            found_keys.append({
                'type': key_type,
                'match': match.group(0),
                'placeholder': placeholder,
                'start': match.start(),
                'end': match.end(),
                'line': content[:match.start()].count('\n') + 1
            })
    return found_keys

def replace_keys_in_file(file_path, dry_run=False):
    """Replace keys in a file with placeholders."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return False
    
    original_content = content
    replacements = []
    
    for key_type, (pattern, placeholder) in PATTERNS.items():
        def replace_func(match):
            replacements.append({
                'type': key_type,
                'original': match.group(0),
                'placeholder': placeholder,
                'line': original_content[:match.start()].count('\n') + 1
            })
            return placeholder
        
        content = re.sub(pattern, replace_func, content)
    
    if replacements:
        if not dry_run:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Replaced {len(replacements)} key(s) in {file_path}")
            for rep in replacements:
                print(f"   Line {rep['line']}: {rep['type']} -> {rep['placeholder']}")
        else:
            print(f"🔍 Would replace {len(replacements)} key(s) in {file_path}")
            for rep in replacements:
                print(f"   Line {rep['line']}: {rep['type']}: {rep['original'][:50]}... -> {rep['placeholder']}")
        return True
    return False

def main():
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")
    
    # Find all markdown files
    repo_root = Path(__file__).parent.parent
    md_files = list(repo_root.glob('*.md'))
    
    print(f"Scanning {len(md_files)} markdown files...\n")
    
    total_replacements = 0
    files_with_keys = []
    
    for md_file in md_files:
        if replace_keys_in_file(md_file, dry_run=dry_run):
            files_with_keys.append(md_file)
            total_replacements += 1
    
    if total_replacements == 0:
        print("\n✅ No API keys found in markdown files!")
        print("   All files appear to use placeholders already.")
    else:
        print(f"\n{'Would replace' if dry_run else 'Replaced'} keys in {total_replacements} file(s)")
        if not dry_run:
            print("\n⚠️  Next steps:")
            print("   1. Review the changes: git diff")
            print("   2. Commit the changes: git add *.md && git commit -m 'Replace API keys with placeholders'")
            print("   3. Use git filter-repo to scrub history (see scripts/scrub-keys-from-history.md)")

if __name__ == '__main__':
    main()
