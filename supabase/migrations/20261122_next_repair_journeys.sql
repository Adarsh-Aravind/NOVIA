-- NOVIA Next: the Repair Room and Walk Together.
--
-- Additive only. The current app reads and writes complaints exactly as before
-- (title, body, status); the new columns are optional and it ignores them.
-- Idempotent, so it is safe to re-run.

-- 1. Repair Room ------------------------------------------------------------
-- A complaint becomes a repair: what I feel, what I need, one small ask, an
-- optional cool-down before talking, and who has said "we're good". It is
-- resolved once both partners have.
ALTER TABLE public.complaints
    ADD COLUMN IF NOT EXISTS feel TEXT,
    ADD COLUMN IF NOT EXISTS need TEXT,
    ADD COLUMN IF NOT EXISTS ask TEXT,
    ADD COLUMN IF NOT EXISTS cool_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS repaired_by UUID[] NOT NULL DEFAULT '{}';

-- Confirm (or take back) "we're good" atomically, so two taps landing at once
-- can't overwrite each other. SECURITY INVOKER: RLS still decides which rows
-- the caller can touch.
CREATE OR REPLACE FUNCTION public.confirm_repair(complaint UUID, confirmed BOOLEAN DEFAULT TRUE)
RETURNS public.complaints
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    rec public.complaints;
BEGIN
    UPDATE public.complaints c
       SET repaired_by = CASE
                WHEN confirmed THEN ARRAY(SELECT DISTINCT unnest(c.repaired_by || auth.uid()))
                ELSE array_remove(c.repaired_by, auth.uid())
            END,
           updated_at = NOW()
     WHERE c.id = complaint
       AND c.couple_id = public.get_couple_id()
    RETURNING * INTO rec;

    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'Repair not found';
    END IF;

    UPDATE public.complaints
       SET status = CASE WHEN cardinality(rec.repaired_by) >= 2 THEN 'resolved' ELSE 'open' END
     WHERE id = rec.id
    RETURNING * INTO rec;

    RETURN rec;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_repair(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_repair(UUID, BOOLEAN) TO authenticated;

-- 2. Walk Together -----------------------------------------------------------
-- A route between two places. Progress is the couple's combined steps since
-- started_on against target_steps, read from step_counts; nothing is stored
-- per day here.
CREATE TABLE IF NOT EXISTS public.journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    from_name TEXT NOT NULL,
    from_lat DOUBLE PRECISION NOT NULL,
    from_lng DOUBLE PRECISION NOT NULL,
    to_name TEXT NOT NULL,
    to_lat DOUBLE PRECISION NOT NULL,
    to_lng DOUBLE PRECISION NOT NULL,
    target_steps INTEGER NOT NULL CHECK (target_steps > 0),
    started_on DATE NOT NULL DEFAULT CURRENT_DATE,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS journeys_couple_created_idx ON public.journeys (couple_id, created_at DESC);

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read couple journeys" ON public.journeys;
DROP POLICY IF EXISTS "Insert couple journeys" ON public.journeys;
DROP POLICY IF EXISTS "Update couple journeys" ON public.journeys;
DROP POLICY IF EXISTS "Delete couple journeys" ON public.journeys;

CREATE POLICY "Read couple journeys"
    ON public.journeys FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert couple journeys"
    ON public.journeys FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update couple journeys"
    ON public.journeys FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete couple journeys"
    ON public.journeys FOR DELETE
    USING (couple_id = public.get_couple_id());

-- Live on both phones (see the realtime note in schema.sql).
ALTER TABLE public.journeys REPLICA IDENTITY FULL;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.journeys;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;
