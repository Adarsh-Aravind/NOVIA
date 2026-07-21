-- Daily check-in / gratitude prompt.
--
-- One row per user per day (feeling + optional gratitude line). Both partners
-- may read every row in the couple, so the app can show each other's current
-- feeling, today's gratitude, and a partner-visible check-in streak. A user may
-- only write their own rows. Run this in the Supabase SQL editor.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    feeling TEXT NOT NULL,          -- an emoji glyph, e.g. '😊'
    gratitude TEXT,                 -- optional "one thing I'm grateful for"
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- One check-in per person per day; the client upserts on this pair so a
    -- partner can amend today's mood without stacking duplicate rows.
    CONSTRAINT uniq_checkin_per_day UNIQUE (user_id, check_in_date)
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Both partners READ every row in the couple; each user WRITES only their own.
DROP POLICY IF EXISTS "Read couple check-ins" ON public.check_ins;
CREATE POLICY "Read couple check-ins"
    ON public.check_ins FOR SELECT
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Insert own check-in" ON public.check_ins;
CREATE POLICY "Insert own check-in"
    ON public.check_ins FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Update own check-in" ON public.check_ins;
CREATE POLICY "Update own check-in"
    ON public.check_ins FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Delete own check-in" ON public.check_ins;
CREATE POLICY "Delete own check-in"
    ON public.check_ins FOR DELETE
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_checkins_couple_date ON public.check_ins(couple_id, check_in_date DESC);
