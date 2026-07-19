-- Finance rework.
--
-- 1. Replace the "[SELF_LIABILITY] " item_name prefix hack with a real column.
--    Encoding a flag in a user-visible text field meant the marker showed up in
--    notification bodies, broke if anyone edited the name, and had to be
--    string-stripped at every read site.
-- 2. Track when a recurring item was last settled, so marking a monthly
--    subscription "paid" can roll its due date forward instead of retiring it.

ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS is_self_liability BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;

ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW());

-- Backfill existing rows, then strip the marker out of the display name.
UPDATE public.finances
SET is_self_liability = TRUE,
    item_name = SUBSTRING(item_name FROM LENGTH('[SELF_LIABILITY] ') + 1)
WHERE starts_with(item_name, '[SELF_LIABILITY] ');

-- Due-date lookups drive both the ledger sort and the reminder scheduler.
CREATE INDEX IF NOT EXISTS finances_couple_due_idx
    ON public.finances (couple_id, due_date);
