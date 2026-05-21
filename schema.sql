-- Enable UUID-OSSP for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up any existing tables to avoid duplicate relations
DROP TABLE IF EXISTS public.bucket_list CASCADE;
DROP TABLE IF EXISTS public.medical_vault CASCADE;
DROP TABLE IF EXISTS public.sleep_logs CASCADE;
DROP TABLE IF EXISTS public.diet_logs CASCADE;
DROP TABLE IF EXISTS public.periods CASCADE;
DROP TABLE IF EXISTS public.finances CASCADE;
DROP TABLE IF EXISTS public.brainstorms CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.punishments CASCADE;
DROP TABLE IF EXISTS public.alarms CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;
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

-- 3. Reminders Table (Shared Reminders & Document Renewals)
CREATE TABLE public.reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- 'face_care', 'shaving', 'birthday', 'habit', 'document_renewal'
    due_date TIMESTAMPTZ NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    recurrence TEXT DEFAULT 'none'::text NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly', 'none'
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL, -- e.g., { "document_type": "Passport", "days_warning": [30, 7] }
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Shared Alarms Table (Wake-up Synchronization)
CREATE TABLE public.alarms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    purpose TEXT,
    alarm_time TIME NOT NULL, -- e.g. '07:00:00'
    days_active INT[] DEFAULT '{}'::INT[] NOT NULL, -- 0=Sunday, 1=Monday ... 6=Saturday
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    sync_mode TEXT DEFAULT 'simultaneous'::text NOT NULL, -- 'simultaneous', 'coordinated'
    last_fired TIMESTAMPTZ,
    user_1_status TEXT DEFAULT 'idle'::text NOT NULL, -- 'idle', 'ringing', 'snoozed', 'dismissed', 'failed'
    user_2_status TEXT DEFAULT 'idle'::text NOT NULL,
    snooze_count_1 INT DEFAULT 0 NOT NULL,
    snooze_count_2 INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Discipline & Punishments Table
CREATE TABLE public.punishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    offender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'alarm_skip', 'repayment_missed'
    penalty_type TEXT DEFAULT 'penalty_status'::text NOT NULL, -- 'visual_restriction', 'penalty_status', 'forfeit'
    description TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resolved_at TIMESTAMPTZ
);

-- 6. Shared Notes Table (Partner-visible note cards)
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
    content TEXT DEFAULT ''::text NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    updated_by UUID NOT NULL REFERENCES public.profiles(id),
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
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
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

---
--- ROW LEVEL SECURITY & RELATIONAL ACCESS POLICIES
---

-- Enable RLS on all active tables
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainstorms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;

-- Helper Function to resolve current user's active couple ID
CREATE OR REPLACE FUNCTION public.get_couple_id()
RETURNS UUID AS $$
    SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

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
    USING (auth.uid() = id);

-- Policies for Shared couple-scoped tables (Reminders, Alarms, Punishments, Notes, Brainstorms, Finances, Periods, Bucket List)
CREATE POLICY "Allow access to couple data"
    ON public.reminders FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to couple alarms"
    ON public.alarms FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to punishments"
    ON public.punishments FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to shared notes"
    ON public.notes FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to brainstorms"
    ON public.brainstorms FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to financial logs"
    ON public.finances FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to menstrual history"
    ON public.periods FOR ALL
    USING (couple_id = public.get_couple_id());

CREATE POLICY "Allow access to bucket list items"
    ON public.bucket_list FOR ALL
    USING (couple_id = public.get_couple_id());

-- Policies for Personal User-scoped tables (Diet, Sleep, Medical Records Vault)
CREATE POLICY "Allow access to own diet logs"
    ON public.diet_logs FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Allow access to own sleep logs"
    ON public.sleep_logs FOR ALL
    USING (user_id = auth.uid());

CREATE POLICY "Allow access to own and partner medical records"
    ON public.medical_vault FOR ALL
    USING (
        user_id = auth.uid()
        OR user_id IN (
            SELECT id FROM public.profiles WHERE couple_id = public.get_couple_id()
        )
    );

-- Triggers for Profile Creation on user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'display_name', 'User'),
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Database performance index optimizations for speed
CREATE INDEX idx_profiles_couple_id ON public.profiles(couple_id);
CREATE INDEX idx_reminders_couple_due ON public.reminders(couple_id, due_date);
CREATE INDEX idx_finances_couple_due ON public.finances(couple_id, due_date);
CREATE INDEX idx_alarms_couple_id ON public.alarms(couple_id);
CREATE INDEX idx_periods_couple_start ON public.periods(couple_id, start_date);
CREATE INDEX idx_medical_user_type ON public.medical_vault(user_id, metric_type);
