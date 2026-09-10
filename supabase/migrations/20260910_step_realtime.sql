-- =====================================================================
-- NOVIA — Realtime publication repair (2026-09-10)
--
-- Every `postgres_changes` subscription in the app requires its table to be a
-- member of the `supabase_realtime` publication. Without membership the client
-- subscribes successfully and then silently receives nothing: a dead feed that
-- is indistinguishable from a working one.
--
-- That is what broke the Step Duel. 20260728_step_counts.sql and
-- 20260728_step_forfeits.sql created the tables and their RLS policies but
-- never published them (unlike 20260705_location_sharing.sql, which does it
-- correctly for `locations`), so each phone only ever saw the partner's steps
-- as of its own last cold start — "the counter doesn't sync between our
-- phones".
--
-- This publishes every table the app actually subscribes to, not just the step
-- pair, so any other silently-dead feed is repaired at the same time. Tables
-- already in the publication are skipped.
--
-- REPLICA IDENTITY FULL puts every column in the pre-image of an UPDATE/DELETE,
-- so the `couple_id=eq.<id>` filters (and RLS) can be evaluated on those events
-- too, not only on INSERT. step_counts in particular is upserted all day long,
-- so nearly every event on it is an UPDATE — without this the filter has
-- nothing to match against. These tables are small; the extra WAL volume is
-- negligible next to getting the filters right.
--
-- Keep the list below in step with the `table:` names passed to
-- supabase.channel() in App.tsx and src/hooks/*.
--
-- Safe to run more than once. Run it in the Supabase SQL editor.
-- =====================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'profiles',
        'notes',
        'todos',
        'complaints',
        'complaint_replies',
        'milestones',
        'check_ins',
        'periods',
        'finances',
        'bucket_list',
        'app_updates',
        'step_counts',
        'step_forfeits'
    ]
    LOOP
        -- Skip anything this project doesn't have, so an older database that
        -- predates a feature's migration doesn't abort the whole run.
        IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
            RAISE NOTICE 'skipping %, table not present', t;
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);

        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
            RAISE NOTICE 'published %', t;
        EXCEPTION
            WHEN duplicate_object THEN NULL; -- already a member
            WHEN undefined_object THEN NULL; -- publication absent on this project
        END;
    END LOOP;
END $$;
