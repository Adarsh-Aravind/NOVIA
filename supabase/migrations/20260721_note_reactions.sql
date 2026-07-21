-- Emoji reactions on shared notes.
--
-- Reactions are stored inline on each note as a JSONB map of { userId: emoji },
-- so each partner has at most one reaction per note. This rides the existing
-- `notes` realtime + RLS path (no new table or subscription needed).
--
-- The existing "Update shared notes" policy already lets a couple member update
-- a note as long as they set updated_by = auth.uid(); the client does exactly
-- that when toggling a reaction, and never changes updated_at (so reacting does
-- not reorder the note grid). No policy changes are required.
--
-- Safe to run more than once.

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;
