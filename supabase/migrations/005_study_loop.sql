-- Phase 1: the closed study loop.
-- Topics become the spine that connects focus sessions, recall attempts and
-- flashcard decks. Focus sessions and recall attempts move server-side so the
-- dashboard can show real history (they previously lived only in
-- localStorage / component state).

-- ============================================================
-- topics
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

CREATE POLICY "Users manage own topics"
  ON topics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

-- ============================================================
-- focus_sessions (was localStorage 'timerSessionHistory' only)
-- ============================================================
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

CREATE POLICY "Users manage own focus sessions"
  ON focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started
  ON focus_sessions(user_id, started_at DESC);

-- ============================================================
-- recall_attempts (was discarded on unmount)
-- ============================================================
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

CREATE POLICY "Users manage own recall attempts"
  ON recall_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_recall_attempts_user_created
  ON recall_attempts(user_id, created_at DESC);

-- ============================================================
-- decks gain an optional topic link
-- ============================================================
ALTER TABLE decks ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

-- The study queue filters on due date now, so index it.
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due
  ON flashcards(user_id, next_review);
