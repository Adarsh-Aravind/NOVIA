-- Step Duel — quarterly stakes / forfeit.
--
-- One row per couple per 3-month period (period_key like '2026-Q3'), holding the
-- forfeit the season's loser owes the champion — set and agreed by either
-- partner. Both partners read it; whoever writes stamps themselves as set_by.
-- The client upserts on (couple_id, period_key), so editing this season's stakes
-- amends the row in place. Run this in the Supabase SQL editor.
--
-- Depends on 20260728_step_counts.sql (same feature). Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.step_forfeits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL,          -- calendar quarter, e.g. '2026-Q3'
    forfeit TEXT NOT NULL,             -- the dare/stakes the loser owes
    set_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uniq_forfeit_per_period UNIQUE (couple_id, period_key)
);

ALTER TABLE public.step_forfeits ENABLE ROW LEVEL SECURITY;

-- Couple-trusted: both partners read, and either may set/edit their couple's
-- stakes, but the writer must stamp themselves as set_by.
DROP POLICY IF EXISTS "Read couple forfeits" ON public.step_forfeits;
CREATE POLICY "Read couple forfeits"
    ON public.step_forfeits FOR SELECT
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Insert couple forfeit" ON public.step_forfeits;
CREATE POLICY "Insert couple forfeit"
    ON public.step_forfeits FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND set_by = auth.uid());

DROP POLICY IF EXISTS "Update couple forfeit" ON public.step_forfeits;
CREATE POLICY "Update couple forfeit"
    ON public.step_forfeits FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id() AND set_by = auth.uid());

DROP POLICY IF EXISTS "Delete couple forfeit" ON public.step_forfeits;
CREATE POLICY "Delete couple forfeit"
    ON public.step_forfeits FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE INDEX IF NOT EXISTS idx_forfeits_couple_period ON public.step_forfeits(couple_id, period_key);
