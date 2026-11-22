-- NOVIA Next: Weather of us (mood history) and the Together streak.
--
-- Additive only, and idempotent.

-- 1. Mood history -------------------------------------------------------------
-- One row each time someone's mood changes. It is written by a trigger on
-- profiles rather than by the app, so it captures a change made in either app,
-- the current NOVIA or NOVIA Next.
CREATE TABLE IF NOT EXISTS public.mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mood TEXT NOT NULL,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mood_logs_couple_time_idx ON public.mood_logs (couple_id, logged_at DESC);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read couple mood logs" ON public.mood_logs;
CREATE POLICY "Read couple mood logs"
    ON public.mood_logs FOR SELECT
    USING (couple_id = public.get_couple_id());
-- No insert/update/delete policy: only the trigger below writes here.

CREATE OR REPLACE FUNCTION public.log_mood_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.couple_id IS NOT NULL
       AND NEW.current_mood IS NOT NULL
       AND NEW.current_mood IS DISTINCT FROM OLD.current_mood THEN
        INSERT INTO public.mood_logs (couple_id, user_id, mood, logged_at)
        VALUES (NEW.couple_id, NEW.id, NEW.current_mood, COALESCE(NEW.mood_updated_at, NOW()));
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_mood_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_log_mood ON public.profiles;
CREATE TRIGGER profiles_log_mood
    AFTER UPDATE OF current_mood ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.log_mood_change();

-- 2. Together streak -----------------------------------------------------------
-- One row per person per day they opened NOVIA Next. The streak is the run of
-- consecutive days on which both of you have a row.
CREATE TABLE IF NOT EXISTS public.together_days (
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (couple_id, user_id, day)
);

ALTER TABLE public.together_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read couple together days" ON public.together_days;
DROP POLICY IF EXISTS "Insert own together days" ON public.together_days;
CREATE POLICY "Read couple together days"
    ON public.together_days FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert own together days"
    ON public.together_days FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND user_id = auth.uid());

-- Live on both phones, so a streak lights up the moment the other one opens.
ALTER TABLE public.together_days REPLICA IDENTITY FULL;
ALTER TABLE public.mood_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.together_days;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mood_logs;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
    END;
END $$;
