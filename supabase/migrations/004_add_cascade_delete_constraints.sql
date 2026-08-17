-- Migration: Add ON DELETE CASCADE to all foreign key constraints referencing auth.users or profiles
-- Run this after running 003_find_fk_constraints.sql to identify all constraints

-- Note: This migration uses a safer approach - it checks for each constraint individually
-- and only updates if the constraint exists and doesn't already have CASCADE

-- 1. Ensure profiles.id has CASCADE (should already have it from initial migration, but ensuring)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
            AND tc.table_name = 'profiles' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND rc.delete_rule != 'CASCADE'
    ) THEN
        ALTER TABLE public.profiles 
            DROP CONSTRAINT IF EXISTS profiles_id_fkey CASCADE;
        
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_id_fkey
            FOREIGN KEY (id) 
            REFERENCES auth.users(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Ensure user_stats.user_id has CASCADE (should already have it, but ensuring)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc 
            ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'public'
            AND tc.table_name = 'user_stats' 
            AND tc.constraint_type = 'FOREIGN KEY'
            AND rc.delete_rule != 'CASCADE'
    ) THEN
        ALTER TABLE public.user_stats 
            DROP CONSTRAINT IF EXISTS user_stats_user_id_fkey CASCADE;
        
        ALTER TABLE public.user_stats
            ADD CONSTRAINT user_stats_user_id_fkey
            FOREIGN KEY (user_id) 
            REFERENCES public.profiles(id) 
            ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Update flashcards.user_id constraint (if table exists)
DO $$
DECLARE
    constraint_to_drop TEXT;
BEGIN
    -- Find the constraint name for flashcards.user_id -> profiles.id
    SELECT tc.constraint_name INTO constraint_to_drop
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = 'flashcards' 
        AND kcu.column_name = 'user_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule != 'CASCADE'
    LIMIT 1;
    
    IF constraint_to_drop IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS %I', constraint_to_drop);
        EXECUTE format('ALTER TABLE public.flashcards ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE', constraint_to_drop);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- Table doesn't exist, skip
        NULL;
END $$;

-- 4. Update decks.user_id constraint (if table exists)
DO $$
DECLARE
    constraint_to_drop TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_to_drop
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = 'decks' 
        AND kcu.column_name = 'user_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule != 'CASCADE'
    LIMIT 1;
    
    IF constraint_to_drop IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.decks DROP CONSTRAINT IF EXISTS %I', constraint_to_drop);
        EXECUTE format('ALTER TABLE public.decks ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE', constraint_to_drop);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 5. Update user_usage.user_id constraint (if table exists)
DO $$
DECLARE
    constraint_to_drop TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_to_drop
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = 'user_usage' 
        AND kcu.column_name = 'user_id'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule != 'CASCADE'
    LIMIT 1;
    
    IF constraint_to_drop IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.user_usage DROP CONSTRAINT IF EXISTS %I', constraint_to_drop);
        EXECUTE format('ALTER TABLE public.user_usage ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE', constraint_to_drop);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- 6. Update flashcards.deck_id constraint (if it exists and references decks)
DO $$
DECLARE
    constraint_to_drop TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_to_drop
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
        AND tc.table_name = 'flashcards' 
        AND kcu.column_name = 'deck_id'
        AND ccu.table_name = 'decks'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND rc.delete_rule != 'CASCADE'
    LIMIT 1;
    
    IF constraint_to_drop IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.flashcards DROP CONSTRAINT IF EXISTS %I', constraint_to_drop);
        EXECUTE format('ALTER TABLE public.flashcards ADD CONSTRAINT %I FOREIGN KEY (deck_id) REFERENCES public.decks(id) ON DELETE CASCADE', constraint_to_drop);
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

-- Final verification query (run this to see all constraints and their delete rules)
SELECT 
    tc.table_schema || '.' || tc.table_name AS table_name,
    kcu.column_name,
    ccu.table_schema || '.' || ccu.table_name AS referenced_table,
    rc.delete_rule
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
WHERE 
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (
        (ccu.table_name = 'users' AND ccu.table_schema = 'auth')
        OR (ccu.table_name = 'profiles' AND ccu.table_schema = 'public')
        OR (ccu.table_name = 'decks' AND ccu.table_schema = 'public')
    )
ORDER BY 
    tc.table_name, kcu.column_name;