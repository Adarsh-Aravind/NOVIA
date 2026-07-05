-- =====================================================================
-- NOVIA — Location sharing (2026-07-05)
--
-- Adds a couple-scoped `locations` table holding ONE latest position row
-- per user (upserted on user_id). Both partners may read each other's row;
-- each user may only write their own. Safe to run on an existing project.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.locations (
    user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    couple_id  UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    latitude   DOUBLE PRECISION NOT NULL,
    longitude  DOUBLE PRECISION NOT NULL,
    accuracy   DOUBLE PRECISION,           -- horizontal accuracy in metres
    place_label TEXT,                       -- optional reverse-geocoded label
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_couple_id ON public.locations(couple_id);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Both partners may READ every location row in their couple.
DROP POLICY IF EXISTS "Read couple locations" ON public.locations;
CREATE POLICY "Read couple locations"
    ON public.locations FOR SELECT
    USING (couple_id = public.get_couple_id());

-- A user may only INSERT their own row, and only into their own couple.
DROP POLICY IF EXISTS "Insert own location" ON public.locations;
CREATE POLICY "Insert own location"
    ON public.locations FOR INSERT
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

-- A user may only UPDATE their own row.
DROP POLICY IF EXISTS "Update own location" ON public.locations;
CREATE POLICY "Update own location"
    ON public.locations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

-- A user may stop sharing by deleting their own row.
DROP POLICY IF EXISTS "Delete own location" ON public.locations;
CREATE POLICY "Delete own location"
    ON public.locations FOR DELETE
    USING (user_id = auth.uid());

-- Stream row changes to the paired device over Supabase Realtime.
-- (ADD TABLE errors if the table is already in the publication, so guard it.)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL; -- publication not present on this project
END $$;
