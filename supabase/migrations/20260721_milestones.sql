-- Relationship milestones / anniversaries ("On this day").
--
-- Couple-scoped dates that recur (first date, anniversary, a monthiversary) or
-- fire once. The client reuses the existing todo/notification scheduling to
-- surface a day-before heads-up and a day-of celebration, and renders an
-- "On this day" card on the Hub. Run this in the Supabase SQL editor.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    milestone_date DATE NOT NULL,               -- the original date (e.g. first date)
    recurrence TEXT DEFAULT 'yearly'::text NOT NULL, -- 'yearly', 'monthly', 'once'
    emoji TEXT,                                  -- optional decorative glyph
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Reads are couple-scoped; INSERT additionally binds created_by to auth.uid()
-- so a client cannot forge authorship. UPDATE/DELETE re-check the couple so
-- either partner can edit or remove a shared milestone.
DROP POLICY IF EXISTS "Read couple milestones" ON public.milestones;
CREATE POLICY "Read couple milestones"
    ON public.milestones FOR SELECT
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Insert couple milestones" ON public.milestones;
CREATE POLICY "Insert couple milestones"
    ON public.milestones FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "Update couple milestones" ON public.milestones;
CREATE POLICY "Update couple milestones"
    ON public.milestones FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Delete couple milestones" ON public.milestones;
CREATE POLICY "Delete couple milestones"
    ON public.milestones FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE INDEX IF NOT EXISTS idx_milestones_couple_date ON public.milestones(couple_id, milestone_date);
