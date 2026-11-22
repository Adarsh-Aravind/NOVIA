-- 1. Pairing needs consent.
-- 2. The retired `locations` table stops leaking user ids through Realtime.
--
-- Idempotent: safe to run more than once.

-- 1. Pairing needs consent ---------------------------------------------------
--
-- Until now pair_with_partner() paired two accounts on the say-so of one of
-- them: knowing someone's user id was enough. Now pairing is a request the
-- other person accepts.
--
--   pair_with_partner(partner)   If `partner` has already asked you, this pairs
--                                you (it is the accept). Otherwise it records
--                                your request and returns NULL. Same name and
--                                signature as before, so older app builds keep
--                                working; they just can't pair one-sidedly.
--   incoming_pair_requests()     Requests waiting for you, with who sent them.
--   respond_pair_request(id, b)  Accept (pair) or decline.
--   cancel_pair_request()        Withdraw the request you sent.
--
-- The requester learns nothing about the target (not their name, and not
-- whether they exist or are already paired) until the target accepts, so
-- sending requests can't be used to probe ids. Requests expire after 7 days.

CREATE TABLE IF NOT EXISTS public.pair_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pair_requests_from_to_key UNIQUE (from_user, to_user),
    CONSTRAINT pair_requests_not_self CHECK (from_user <> to_user)
);

-- No policies at all: clients can't read or write this table directly. The
-- functions below are the only way in.
ALTER TABLE public.pair_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pair_requests FROM anon, authenticated;

-- The pairing itself, shared by the accept paths. Not callable by clients.
CREATE OR REPLACE FUNCTION public._pair_accounts(a UUID, b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_couple UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (a, b) AND couple_id IS NOT NULL) THEN
        RAISE EXCEPTION 'One of you is already paired';
    END IF;

    INSERT INTO public.couples (user_1_id, user_2_id) VALUES (a, b) RETURNING id INTO new_couple;
    UPDATE public.profiles SET couple_id = new_couple, partner_id = b, updated_at = NOW() WHERE id = a;
    UPDATE public.profiles SET couple_id = new_couple, partner_id = a, updated_at = NOW() WHERE id = b;

    -- Every other request involving either of them is now moot.
    DELETE FROM public.pair_requests WHERE from_user IN (a, b) OR to_user IN (a, b);
    RETURN new_couple;
END;
$$;
REVOKE ALL ON FUNCTION public._pair_accounts(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pair_with_partner(partner_uuid UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me UUID := auth.uid();
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF partner_uuid IS NULL OR partner_uuid = me THEN
        RAISE EXCEPTION 'That is your own key. Paste your partner''s key instead.';
    END IF;
    IF (SELECT couple_id FROM public.profiles WHERE id = me) IS NOT NULL THEN
        RAISE EXCEPTION 'You are already paired';
    END IF;

    -- They asked first, recently: this is the accept.
    IF EXISTS (
        SELECT 1 FROM public.pair_requests
         WHERE from_user = partner_uuid AND to_user = me AND created_at > NOW() - INTERVAL '7 days'
    ) THEN
        RETURN public._pair_accounts(partner_uuid, me);
    END IF;

    -- Otherwise record the request. Say nothing about whether the target
    -- exists or is paired, so this can't be used to probe ids.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = partner_uuid AND couple_id IS NULL) THEN
        INSERT INTO public.pair_requests (from_user, to_user)
        VALUES (me, partner_uuid)
        ON CONFLICT (from_user, to_user) DO UPDATE SET created_at = NOW();
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.incoming_pair_requests()
RETURNS TABLE (id UUID, from_user UUID, display_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT r.id, r.from_user, COALESCE(NULLIF(TRIM(p.display_name), ''), 'Someone'), r.created_at
      FROM public.pair_requests r
      JOIN public.profiles p ON p.id = r.from_user
     WHERE r.to_user = auth.uid()
       AND r.created_at > NOW() - INTERVAL '7 days'
       AND p.couple_id IS NULL
     ORDER BY r.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.respond_pair_request(request UUID, accept BOOLEAN)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    me UUID := auth.uid();
    requester UUID;
BEGIN
    IF me IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    SELECT from_user INTO requester
      FROM public.pair_requests
     WHERE id = request AND to_user = me AND created_at > NOW() - INTERVAL '7 days';
    IF requester IS NULL THEN
        RAISE EXCEPTION 'That request has expired or was withdrawn';
    END IF;

    IF NOT accept THEN
        DELETE FROM public.pair_requests WHERE id = request;
        RETURN NULL;
    END IF;
    RETURN public._pair_accounts(requester, me);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_pair_request()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM public.pair_requests WHERE from_user = auth.uid();
$$;

-- Whether you have a request out (without saying to whom it went, beyond the
-- key you typed yourself).
CREATE OR REPLACE FUNCTION public.outgoing_pair_request()
RETURNS TABLE (to_user UUID, created_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT r.to_user, r.created_at
      FROM public.pair_requests r
     WHERE r.from_user = auth.uid() AND r.created_at > NOW() - INTERVAL '7 days'
     ORDER BY r.created_at DESC
     LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.pair_with_partner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.incoming_pair_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_pair_request(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pair_request() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.outgoing_pair_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_with_partner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incoming_pair_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_pair_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pair_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.outgoing_pair_request() TO authenticated;

-- 2. Retired `locations` table ------------------------------------------------
--
-- Location sharing was removed from the app, but the table is still in the
-- Realtime publication with user_id as its primary key. Realtime can't apply
-- RLS to DELETE events, and with RLS on they carry only the primary key, so any
-- signed-in listener received the user id of anyone whose row was deleted.
-- Nothing reads it any more, so it simply leaves live sync. No data is touched.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE public.locations;
    END IF;
END $$;
