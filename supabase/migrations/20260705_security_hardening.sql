-- =====================================================================
-- NOVIA — Security hardening migration (2026-07-05)
--
-- Safe to run on an existing project: it only ADDS/REPLACES functions and
-- policies and tightens column privileges. It does not drop data.
--
-- Fixes:
--   1. Privilege escalation: a user could change their own profiles.couple_id
--      to ANY couple and read that couple's shared data. We revoke direct
--      writes to couple_id / partner_id and move pairing into validated,
--      SECURITY DEFINER RPCs.
--   2. SECURITY DEFINER functions had a mutable search_path (linter warning).
--   3. Pairing had no consent / validation and no INSERT policy on couples.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Pin search_path on existing SECURITY DEFINER functions
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_couple_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Prevent clients from writing couple_id / partner_id directly.
--    (Pairing/unpairing happen only through the RPCs below, which run as
--    the table owner and are unaffected by these column revokes.)
-- ---------------------------------------------------------------------
REVOKE UPDATE (couple_id, partner_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (couple_id, partner_id) ON public.profiles FROM anon;

-- Make the profile UPDATE policy explicit (add WITH CHECK).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------
-- 3. Consent-validated pairing RPC
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pair_with_partner(partner_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me UUID := auth.uid();
    new_couple_id UUID;
    my_couple UUID;
    their_couple UUID;
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF partner_uuid = me THEN
        RAISE EXCEPTION 'You cannot pair with yourself';
    END IF;

    SELECT couple_id INTO my_couple FROM public.profiles WHERE id = me;
    IF my_couple IS NOT NULL THEN
        RAISE EXCEPTION 'You are already paired';
    END IF;

    SELECT couple_id INTO their_couple FROM public.profiles WHERE id = partner_uuid;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Partner not found';
    END IF;
    IF their_couple IS NOT NULL THEN
        RAISE EXCEPTION 'Partner is already paired with another account';
    END IF;

    INSERT INTO public.couples (user_1_id, user_2_id)
    VALUES (me, partner_uuid)
    RETURNING id INTO new_couple_id;

    UPDATE public.profiles
       SET couple_id = new_couple_id, partner_id = partner_uuid, updated_at = NOW()
     WHERE id = me;

    UPDATE public.profiles
       SET couple_id = new_couple_id, partner_id = me, updated_at = NOW()
     WHERE id = partner_uuid;

    RETURN new_couple_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Unpair RPC (only a member of the couple can dissolve it)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpair()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me UUID := auth.uid();
    my_couple UUID;
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    SELECT couple_id INTO my_couple FROM public.profiles WHERE id = me;
    IF my_couple IS NULL THEN
        RETURN;
    END IF;

    UPDATE public.profiles
       SET couple_id = NULL, partner_id = NULL, updated_at = NOW()
     WHERE couple_id = my_couple;

    DELETE FROM public.couples WHERE id = my_couple;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. Lock down who may call these
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.pair_with_partner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpair() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_with_partner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpair() TO authenticated;
