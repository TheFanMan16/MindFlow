-- 007_restore_study_loop_and_deck_overview.sql
--
-- A live-schema probe (2026-08-14) found that migration 005 was never applied
-- to production: topics, focus_sessions and recall_attempts do not exist, nor
-- does decks.topic_id - so exam topics, focus history and recall attempts have
-- been silently failing to persist. user_usage (the server's PDF quota table)
-- was also never created. This migration restores all of it idempotently, and
-- adds deck_overview: one aggregate view that gives the dashboard per-deck
-- totals, due counts and the real "last studied" timestamp
-- (MAX(flashcards.last_reviewed)) in a single query.

begin;

-- ============================================================
-- (A) Study loop - 005 verbatim, with policies made re-runnable
-- ============================================================
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exam_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own topics" ON topics;
CREATE POLICY "Users manage own topics"
  ON topics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Session',
  mode TEXT NOT NULL DEFAULT 'pomodoro',
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own focus sessions" ON focus_sessions;
CREATE POLICY "Users manage own focus sessions"
  ON focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started
  ON focus_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS recall_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  grade TEXT,
  summary TEXT,
  missing_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recall_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own recall attempts" ON recall_attempts;
CREATE POLICY "Users manage own recall attempts"
  ON recall_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recall_attempts_user_created
  ON recall_attempts(user_id, created_at DESC);

ALTER TABLE decks ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flashcards_user_due
  ON flashcards(user_id, next_review);

-- ============================================================
-- (B) user_usage - the Express server's monthly PDF quota table.
-- One row per user; the server mutates `month` in place on rollover.
-- Server-only: RLS is enabled with NO policies, so only service_role
-- (which bypasses RLS) can touch it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  flashcard_generations_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- (C) deck_overview - per-deck aggregates in one query.
-- security_invoker: the caller's RLS on decks/flashcards applies, so a
-- user sees only their own decks. "Last studied" is MAX(last_reviewed) -
-- NULL for a never-studied deck, which the UI renders as "never studied"
-- (decks has no updated_at, and created_at would fake a history).
-- Semantics mirror the current dashboard exactly: matured = box>=3,
-- in_progress = scheduled but not matured, due = next_review <= now().
-- ============================================================
CREATE OR REPLACE VIEW public.deck_overview
WITH (security_invoker = on) AS
SELECT
  d.id,
  d.user_id,
  d.title,
  d.created_at,
  COUNT(f.id)::int AS total,
  COUNT(f.id) FILTER (WHERE COALESCE(f.box, 1) >= 3)::int AS matured,
  COUNT(f.id) FILTER (WHERE COALESCE(f.box, 1) < 3 AND f.next_review IS NOT NULL)::int AS in_progress,
  COUNT(f.id) FILTER (WHERE f.next_review IS NOT NULL AND f.next_review <= now())::int AS due,
  MAX(f.last_reviewed) AS last_reviewed
FROM public.decks d
LEFT JOIN public.flashcards f ON f.deck_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.deck_overview TO authenticated;

NOTIFY pgrst, 'reload schema';

commit;
