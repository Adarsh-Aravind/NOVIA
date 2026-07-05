-- NOVIA 2.1 — Retire the alarm subsystem; add Complaint Box, shared Todos,
-- and a global Updates/changelog. Run this in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- 1. Retire the alarm subsystem
-- ---------------------------------------------------------------------------
-- The sync-alarm + over-snooze punishment + routine-reminder features are gone.
-- Dropping these tables is optional cleanup; skip if you want to keep the data.
DROP TABLE IF EXISTS public.alarms CASCADE;
DROP TABLE IF EXISTS public.punishments CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Complaint Box (ticket + reply thread), couple-scoped
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT DEFAULT ''::text NOT NULL,
    status TEXT DEFAULT 'open'::text NOT NULL, -- 'open', 'resolved'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.complaint_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Shared Todo list with recurring reminders, couple-scoped
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    due_at TIMESTAMPTZ NOT NULL, -- chosen reminder time (first fire)
    recurrence TEXT DEFAULT 'once'::text NOT NULL, -- 'once', 'weekly', 'monthly', 'yearly'
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------------
-- 4. Global Updates / changelog (visible to every authenticated user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT ''::text NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

-- Couple-scoped tables reuse the existing public.get_couple_id() helper.
DROP POLICY IF EXISTS "Allow access to couple complaints" ON public.complaints;
CREATE POLICY "Allow access to couple complaints"
    ON public.complaints FOR ALL
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Allow access to couple complaint replies" ON public.complaint_replies;
CREATE POLICY "Allow access to couple complaint replies"
    ON public.complaint_replies FOR ALL
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Allow access to couple todos" ON public.todos;
CREATE POLICY "Allow access to couple todos"
    ON public.todos FOR ALL
    USING (couple_id = public.get_couple_id());

-- Changelog is world-readable to any signed-in user; writes are dev-only (SQL editor).
DROP POLICY IF EXISTS "Authenticated users can read updates" ON public.app_updates;
CREATE POLICY "Authenticated users can read updates"
    ON public.app_updates FOR SELECT
    TO authenticated
    USING (true);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_complaints_couple_created ON public.complaints(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaint_replies_complaint ON public.complaint_replies(complaint_id, created_at);
CREATE INDEX IF NOT EXISTS idx_todos_couple_due ON public.todos(couple_id, due_at);
CREATE INDEX IF NOT EXISTS idx_app_updates_created ON public.app_updates(created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed the first changelog entry (optional — see docs/UPDATES.md)
-- ---------------------------------------------------------------------------
INSERT INTO public.app_updates (version, title, body) VALUES
  ('2.1.0', 'Complaint Box, Todos, Daily Vocabulary',
   'Retired the sync-alarm feature. Added a Complaint Box you can both reply to, a shared Todo list with weekly/monthly/yearly reminders, a daily vocabulary word, and this What''s New page. Refreshed the navigation with icons.');
