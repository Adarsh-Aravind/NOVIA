-- Stop together_days leaking user ids through Realtime DELETE events.
--
-- Supabase Realtime can't apply RLS to DELETE events (the row is gone), so
-- every subscriber with SELECT on a published table receives them, and with
-- RLS on, the old record carries only the primary-key columns. together_days
-- had PRIMARY KEY (couple_id, user_id, day), so when a couple unpaired (unpair()
-- deletes the couples row and the rows cascade) any signed-in user listening
-- for DELETE on this table received both partners' user ids. A user id is
-- enough to pair with someone who is unpaired (pair_with_partner is one-sided),
-- and pairing opens their partner-readable data such as medical_vault.
--
-- A surrogate key means a DELETE event carries only a random id. Uniqueness
-- of (couple_id, user_id, day) moves to a UNIQUE constraint, which is all the
-- client's upsert (onConflict 'couple_id,user_id,day') needs.
--
-- Idempotent.

ALTER TABLE public.together_days ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT uuid_generate_v4();

DO $$
DECLARE
    pk_cols TEXT;
BEGIN
    SELECT string_agg(a.attname, ',' ORDER BY a.attname)
      INTO pk_cols
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
     WHERE i.indrelid = 'public.together_days'::regclass AND i.indisprimary;

    IF pk_cols IS DISTINCT FROM 'id' THEN
        ALTER TABLE public.together_days DROP CONSTRAINT IF EXISTS together_days_pkey;
        ALTER TABLE public.together_days ADD CONSTRAINT together_days_pkey PRIMARY KEY (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.together_days'::regclass AND conname = 'together_days_couple_user_day_key'
    ) THEN
        ALTER TABLE public.together_days
            ADD CONSTRAINT together_days_couple_user_day_key UNIQUE (couple_id, user_id, day);
    END IF;
END $$;

-- REPLICA IDENTITY FULL stays (INSERT/UPDATE events are RLS-checked); with RLS
-- on, DELETE events now carry only the random id.
