-- Step Duel — daily step totals for the couple.
--
-- One row per user per day (the person's step count, sourced from Health
-- Connect on their device). Both partners may read every row in the couple so
-- the app can show a live you-vs-partner duel; a user may only write their own
-- rows. The client upserts its own daily total on (user_id, step_date), so the
-- same day is amended in place as steps accumulate rather than stacking rows.
-- Run this in the Supabase SQL editor.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.step_counts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    step_date DATE NOT NULL DEFAULT CURRENT_DATE,
    steps INTEGER NOT NULL DEFAULT 0 CHECK (steps >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- One total per person per day; the client upserts on this pair as steps
    -- climb through the day.
    CONSTRAINT uniq_steps_per_day UNIQUE (user_id, step_date)
);

ALTER TABLE public.step_counts ENABLE ROW LEVEL SECURITY;

-- Both partners READ every row in the couple; each user WRITES only their own.
DROP POLICY IF EXISTS "Read couple steps" ON public.step_counts;
CREATE POLICY "Read couple steps"
    ON public.step_counts FOR SELECT
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Insert own steps" ON public.step_counts;
CREATE POLICY "Insert own steps"
    ON public.step_counts FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Update own steps" ON public.step_counts;
CREATE POLICY "Update own steps"
    ON public.step_counts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Delete own steps" ON public.step_counts;
CREATE POLICY "Delete own steps"
    ON public.step_counts FOR DELETE
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_steps_couple_date ON public.step_counts(couple_id, step_date DESC);
