-- Auto-detected payments between the two partners.
--
-- Replaces the hand-entered finance ledger (subscriptions, borrowings,
-- settle-up) with a plain feed of payments the notification listener observed.
-- The old `finances` table is deliberately left in place: it holds real
-- records, and dropping it is the user's call, not a code cleanup.
--
-- Idempotent — safe to re-run against an existing project.

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    -- The device that *observed* the payment, which is not necessarily the
    -- payer: `direction` is stated relative to this user.
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    -- The other party's name exactly as the payment app rendered it. Parsed
    -- fields only — the raw notification text is never stored.
    counterparty TEXT NOT NULL,
    source_package TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    -- Guards against Android re-posting the same notification to the same
    -- device. Cross-device duplicates are a different problem, handled in
    -- record_transaction() below.
    dedup_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uniq_txn_per_device UNIQUE (couple_id, user_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_txn_couple_time
    ON public.transactions(couple_id, occurred_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Mirrors step_counts: both partners read every row in the couple, each user
-- writes only their own observations.
DROP POLICY IF EXISTS "Read couple transactions" ON public.transactions;
CREATE POLICY "Read couple transactions"
    ON public.transactions FOR SELECT
    USING (couple_id = public.get_couple_id());

DROP POLICY IF EXISTS "Insert own transactions" ON public.transactions;
CREATE POLICY "Insert own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND user_id = auth.uid());

DROP POLICY IF EXISTS "Delete own transactions" ON public.transactions;
CREATE POLICY "Delete own transactions"
    ON public.transactions FOR DELETE
    USING (user_id = auth.uid());

-- No UPDATE policy: an observed payment is a fact, not something to edit.

---
--- record_transaction — the only write path
---
-- Both phones witness the same payment from opposite sides: his "You paid ₹500
-- to Gayathri" and her "₹500 received from Adarsh" are one event, and a naive
-- insert-on-both would show the couple every transfer twice.
--
-- A dedup_key built from an amount plus a minute bucket cannot solve this on
-- its own: the two notifications land seconds apart and routinely straddle a
-- minute boundary, and the phones' clocks need not agree. So the pairing test
-- lives here instead, where both devices meet, and is deliberately narrow —
-- it merges only a row from the *other* partner, in the *opposite* direction,
-- for the same amount, within PAIR_WINDOW. Three minutes rather than one:
-- the carrier does not deliver the two banks' texts simultaneously, and a
-- window too tight shows the couple every transfer twice. Two genuine payments
-- of the same amount in the same direction are never collapsed.
--
-- The advisory lock serialises the check-then-insert per couple, so two
-- devices posting simultaneously can't both miss each other's row.
CREATE OR REPLACE FUNCTION public.record_transaction(
    p_direction TEXT,
    p_amount NUMERIC,
    p_counterparty TEXT,
    p_source_package TEXT,
    p_occurred_at TIMESTAMPTZ,
    p_dedup_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_couple_id UUID;
    v_existing UUID;
    v_id UUID;
    PAIR_WINDOW CONSTANT INTERVAL := INTERVAL '3 minutes';
BEGIN
    SELECT couple_id INTO v_couple_id FROM public.profiles WHERE id = auth.uid();
    IF v_couple_id IS NULL THEN
        RAISE EXCEPTION 'not paired';
    END IF;

    IF p_direction NOT IN ('sent', 'received') THEN
        RAISE EXCEPTION 'bad direction';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_couple_id::TEXT, 0));

    -- The partner already logged this same payment from the other side.
    SELECT id INTO v_existing
    FROM public.transactions
    WHERE couple_id = v_couple_id
      AND user_id <> auth.uid()
      AND direction <> p_direction
      AND amount = p_amount
      AND occurred_at BETWEEN p_occurred_at - PAIR_WINDOW AND p_occurred_at + PAIR_WINDOW
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN v_existing;
    END IF;

    INSERT INTO public.transactions
        (couple_id, user_id, direction, amount, counterparty, source_package, occurred_at, dedup_key)
    VALUES
        (v_couple_id, auth.uid(), p_direction, p_amount, p_counterparty, p_source_package, p_occurred_at, p_dedup_key)
    ON CONFLICT (couple_id, user_id, dedup_key) DO NOTHING
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
        -- Lost to our own earlier insert of the identical notification.
        SELECT id INTO v_id
        FROM public.transactions
        WHERE couple_id = v_couple_id AND user_id = auth.uid() AND dedup_key = p_dedup_key;
    END IF;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_transaction(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_transaction(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

---
--- Realtime
---
-- A postgres_changes subscription needs its table published, or the client
-- subscribes successfully and then receives nothing at all.
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- already published
    WHEN undefined_object THEN NULL;  -- publication absent on this project
END $$;
