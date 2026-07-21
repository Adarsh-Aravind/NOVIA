-- Enable UUID-OSSP for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up any existing tables to avoid duplicate relations
DROP TABLE IF EXISTS public.check_ins CASCADE;
DROP TABLE IF EXISTS public.milestones CASCADE;
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.bucket_list CASCADE;
DROP TABLE IF EXISTS public.medical_vault CASCADE;
DROP TABLE IF EXISTS public.sleep_logs CASCADE;
DROP TABLE IF EXISTS public.diet_logs CASCADE;
DROP TABLE IF EXISTS public.periods CASCADE;
DROP TABLE IF EXISTS public.finances CASCADE;
DROP TABLE IF EXISTS public.brainstorms CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.app_updates CASCADE;
DROP TABLE IF EXISTS public.todos CASCADE;
DROP TABLE IF EXISTS public.complaint_replies CASCADE;
DROP TABLE IF EXISTS public.complaints CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.couples CASCADE;

-- 1. Couples Table (Relates two authenticated users)
CREATE TABLE public.couples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_couple_pairing UNIQUE (user_1_id, user_2_id),
    CONSTRAINT users_distinct CHECK (user_1_id <> user_2_id)
);

-- 2. User Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    couple_id UUID REFERENCES public.couples(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    current_mood TEXT DEFAULT 'Neutral'::text NOT NULL,
    mood_updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Complaint Box (ticket + reply thread), couple-scoped
CREATE TABLE public.complaints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT DEFAULT ''::text NOT NULL,
    status TEXT DEFAULT 'open'::text NOT NULL, -- 'open', 'resolved'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.complaint_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Shared Todo list with recurring reminders, couple-scoped
CREATE TABLE public.todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    notes TEXT,
    due_at TIMESTAMPTZ NOT NULL, -- chosen reminder time (first fire)
    recurrence TEXT DEFAULT 'once'::text NOT NULL, -- 'once', 'weekly', 'monthly', 'yearly'
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Global Updates / changelog (visible to every authenticated user)
CREATE TABLE public.app_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT DEFAULT ''::text NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Shared Notes Table (Partner-visible note cards)
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    content TEXT DEFAULT ''::text NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    updated_by UUID NOT NULL REFERENCES public.profiles(id),
    -- Emoji reactions as a { userId: emoji } map; each partner has one reaction.
    reactions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Brainstorms Table (Ideas & Brainstorming Tabs)
CREATE TABLE public.brainstorms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'todo', 'study', 'date_ideas'
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Subscriptions & Borrowings Table (Finances)
CREATE TABLE public.finances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'subscription', 'borrowing'
    item_name TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    lender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    borrower_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    due_date TIMESTAMPTZ NOT NULL,
    renewal_cycle TEXT DEFAULT 'none'::text NOT NULL, -- 'monthly', 'yearly', 'none'
    status TEXT DEFAULT 'pending'::text NOT NULL, -- 'pending', 'paid', 'overdue'
    -- Personal debt owned by created_by: excluded from shared totals and from
    -- the who-owes-whom settlement.
    is_self_liability BOOLEAN DEFAULT FALSE NOT NULL,
    last_paid_at TIMESTAMPTZ, -- last settlement; recurring items roll due_date forward
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT check_lender_borrower CHECK (
        (type = 'borrowing' AND lender_id IS NOT NULL AND borrower_id IS NOT NULL) OR
        (type = 'subscription')
    )
);

-- 9. Periods & Cycles Table (Menstrual Tracking)
CREATE TABLE public.periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    cycle_length_override INT, -- Custom cycle length override if standard calculations are bypassed
    symptoms TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Diet & Sleep Logs Table (Daily Tracking Metrics)
CREATE TABLE public.diet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    calories INT NOT NULL,
    meal_type TEXT NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
    food_description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE public.sleep_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sleep_time TIMESTAMPTZ NOT NULL,
    wake_time TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL, -- Calculated automatically on frontend/backend
    quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 11. Medical Vault Table (Credentials & Historical Logs)
CREATE TABLE public.medical_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'height', 'weight', 'blood_group', 'blood_pressure', 'blood_sugar', 'hospital_visit'
    value_json JSONB NOT NULL, -- e.g. { "systolic": 120, "diastolic": 80 } or { "height_cm": 178 }
    record_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attachments TEXT[] DEFAULT '{}'::TEXT[] NOT NULL, -- Supabase Storage paths
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 12. Shared Bucket List Table
CREATE TABLE public.bucket_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'traveling', 'fine_dining', 'adventure', 'learning'
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 13. Location Sharing Table (One latest position per user, couple-scoped)
CREATE TABLE public.locations (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION, -- horizontal accuracy in metres
    place_label TEXT, -- optional reverse-geocoded label
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 14. Relationship Milestones / Anniversaries ("On this day"), couple-scoped
CREATE TABLE public.milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    milestone_date DATE NOT NULL,               -- the original date (e.g. first date)
    recurrence TEXT DEFAULT 'yearly'::text NOT NULL, -- 'yearly', 'monthly', 'once'
    emoji TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 15. Daily Check-in / Gratitude (one row per user per day), couple-scoped
CREATE TABLE public.check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
    feeling TEXT NOT NULL,          -- an emoji glyph, e.g. '😊'
    gratitude TEXT,                 -- optional "one thing I'm grateful for"
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uniq_checkin_per_day UNIQUE (user_id, check_in_date)
);

---
--- ROW LEVEL SECURITY & RELATIONAL ACCESS POLICIES
---

-- Enable RLS on all active tables
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

-- Helper Function to resolve current user's active couple ID
CREATE OR REPLACE FUNCTION public.get_couple_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Policies for Couples table (A user can only select/insert records they are part of)
CREATE POLICY "Users can view their own couple pairing"
    ON public.couples FOR SELECT
    USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Policies for Profiles table
CREATE POLICY "Users can view their own and partner's profile"
    ON public.profiles FOR SELECT
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Clients may not write couple_id / partner_id directly; pairing goes through
-- the SECURITY DEFINER RPCs defined at the end of this file.
REVOKE UPDATE (couple_id, partner_id) ON public.profiles FROM authenticated;
REVOKE UPDATE (couple_id, partner_id) ON public.profiles FROM anon;

-- Policies for Shared couple-scoped tables. Reads are couple-scoped; writes
-- additionally bind the author column to auth.uid() on INSERT so a client
-- cannot forge created_by / author_id / updated_by to impersonate its partner.
-- UPDATE only re-checks the couple so partner-side actions (resolving a
-- complaint, ticking a shared todo) keep working.
CREATE POLICY "Read couple complaints"
    ON public.complaints FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert couple complaints"
    ON public.complaints FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update couple complaints"
    ON public.complaints FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete couple complaints"
    ON public.complaints FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Read couple complaint replies"
    ON public.complaint_replies FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert couple complaint replies"
    ON public.complaint_replies FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND author_id = auth.uid());
CREATE POLICY "Update couple complaint replies"
    ON public.complaint_replies FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete couple complaint replies"
    ON public.complaint_replies FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Read couple todos"
    ON public.todos FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert couple todos"
    ON public.todos FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update couple todos"
    ON public.todos FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete couple todos"
    ON public.todos FOR DELETE
    USING (couple_id = public.get_couple_id());

-- Changelog is world-readable to any signed-in user; writes are dev-only (SQL editor).
CREATE POLICY "Authenticated users can read updates"
    ON public.app_updates FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Read shared notes"
    ON public.notes FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert shared notes"
    ON public.notes FOR INSERT
    WITH CHECK (
        couple_id = public.get_couple_id()
        AND created_by = auth.uid()
        AND updated_by = auth.uid()
    );
CREATE POLICY "Update shared notes"
    ON public.notes FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id() AND updated_by = auth.uid());
CREATE POLICY "Delete shared notes"
    ON public.notes FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Read brainstorms"
    ON public.brainstorms FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert brainstorms"
    ON public.brainstorms FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update brainstorms"
    ON public.brainstorms FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete brainstorms"
    ON public.brainstorms FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Read financial logs"
    ON public.finances FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert financial logs"
    ON public.finances FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update financial logs"
    ON public.finances FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete financial logs"
    ON public.finances FOR DELETE
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to menstrual history"
    ON public.periods FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Read bucket list items"
    ON public.bucket_list FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert bucket list items"
    ON public.bucket_list FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update bucket list items"
    ON public.bucket_list FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete bucket list items"
    ON public.bucket_list FOR DELETE
    USING (couple_id = public.get_couple_id());

-- Location sharing: both partners may READ every row in their couple, but a
-- user may only write (insert/update/delete) their own position row.
CREATE POLICY "Read couple locations"
    ON public.locations FOR SELECT
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Insert own location"
    ON public.locations FOR INSERT
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

CREATE POLICY "Update own location"
    ON public.locations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());

CREATE POLICY "Delete own location"
    ON public.locations FOR DELETE
    USING (user_id = auth.uid());

-- Milestones: couple-scoped reads; INSERT binds created_by to auth.uid().
CREATE POLICY "Read couple milestones"
    ON public.milestones FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert couple milestones"
    ON public.milestones FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND created_by = auth.uid());
CREATE POLICY "Update couple milestones"
    ON public.milestones FOR UPDATE
    USING (couple_id = public.get_couple_id())
    WITH CHECK (couple_id = public.get_couple_id());
CREATE POLICY "Delete couple milestones"
    ON public.milestones FOR DELETE
    USING (couple_id = public.get_couple_id());

-- Check-ins: both partners READ every row in the couple; each user WRITES only
-- their own rows.
CREATE POLICY "Read couple check-ins"
    ON public.check_ins FOR SELECT
    USING (couple_id = public.get_couple_id());
CREATE POLICY "Insert own check-in"
    ON public.check_ins FOR INSERT
    WITH CHECK (couple_id = public.get_couple_id() AND user_id = auth.uid());
CREATE POLICY "Update own check-in"
    ON public.check_ins FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND couple_id = public.get_couple_id());
CREATE POLICY "Delete own check-in"
    ON public.check_ins FOR DELETE
    USING (user_id = auth.uid());

-- Policies for Personal User-scoped tables (Diet, Sleep, Medical Records Vault)
CREATE POLICY "Allow access to own diet logs"
    ON public.diet_logs FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Allow access to own sleep logs"
    ON public.sleep_logs FOR ALL
    USING (user_id = auth.uid());

-- Both partners may READ every record in the couple, but each user may only
-- WRITE (insert/update/delete) their own rows.
CREATE POLICY "Read own and partner medical records"
    ON public.medical_vault FOR SELECT
    USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT id FROM public.profiles WHERE couple_id = public.get_couple_id()
        )
    );

CREATE POLICY "Insert own medical records"
    ON public.medical_vault FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own medical records"
    ON public.medical_vault FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own medical records"
    ON public.medical_vault FOR DELETE
    USING (user_id = auth.uid());

-- Triggers for Profile Creation on user sign-up
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

-- Consent-validated pairing / unpairing (see migration 20260705_security_hardening.sql)
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

REVOKE ALL ON FUNCTION public.pair_with_partner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unpair() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pair_with_partner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpair() TO authenticated;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Database performance index optimizations for speed
CREATE INDEX idx_profiles_couple_id ON public.profiles(couple_id);
CREATE INDEX idx_complaints_couple_created ON public.complaints(couple_id, created_at DESC);
CREATE INDEX idx_complaint_replies_complaint ON public.complaint_replies(complaint_id, created_at);
CREATE INDEX idx_todos_couple_due ON public.todos(couple_id, due_at);
CREATE INDEX idx_app_updates_created ON public.app_updates(created_at DESC);
CREATE INDEX idx_finances_couple_due ON public.finances(couple_id, due_date);
CREATE INDEX idx_periods_couple_start ON public.periods(couple_id, start_date);
CREATE INDEX idx_medical_user_type ON public.medical_vault(user_id, metric_type);
CREATE INDEX idx_locations_couple_id ON public.locations(couple_id);
CREATE INDEX idx_milestones_couple_date ON public.milestones(couple_id, milestone_date);
CREATE INDEX idx_checkins_couple_date ON public.check_ins(couple_id, check_in_date DESC);
