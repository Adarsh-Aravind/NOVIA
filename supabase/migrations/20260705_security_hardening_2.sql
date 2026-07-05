-- =====================================================================
-- NOVIA — Security hardening migration #2 (2026-07-05)
--
-- Safe to run (and RE-run) on an existing project: it only REPLACES RLS
-- policies to tighten WRITE access. It drops no data. Every policy is
-- dropped-if-exists before it is (re)created, so running this twice is safe.
--
-- Fixes (all are write-side privilege issues; reads are unchanged):
--   1. medical_vault: write access was as wide as read access, so a user
--      could INSERT / UPDATE / DELETE their PARTNER's medical records. Now
--      both partners may READ every row in the couple, but each user may
--      only WRITE their own rows.
--   2. Couple-scoped tables (complaints, complaint_replies, todos, notes,
--      brainstorms, bucket_list, finances) used `FOR ALL USING (couple_id
--      = get_couple_id())` with no WITH CHECK, so a client could forge the
--      author column (created_by / author_id / updated_by) and impersonate
--      their partner, or move a row into a different couple. INSERT is now
--      bound to the caller (author = auth.uid()) and UPDATE re-checks the
--      couple on the new row. Partner-side actions that legitimately touch
--      a row they didn't author (resolving a complaint, ticking a shared
--      todo) still work because UPDATE does not re-bind the original author.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. medical_vault — read shared within the couple, write own rows only
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow access to own and partner medical records" ON public.medical_vault;
DROP POLICY IF EXISTS "Read own and partner medical records" ON public.medical_vault;
DROP POLICY IF EXISTS "Insert own medical records" ON public.medical_vault;
DROP POLICY IF EXISTS "Update own medical records" ON public.medical_vault;
DROP POLICY IF EXISTS "Delete own medical records" ON public.medical_vault;

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

-- ---------------------------------------------------------------------
-- 2. Couple-scoped tables — bind the author on INSERT, pin the couple on
--    UPDATE. Each block drops the old permissive `FOR ALL` policy AND the
--    new per-command policies first, so the whole file is re-runnable.
-- ---------------------------------------------------------------------

-- Complaints (created_by)
DROP POLICY IF EXISTS "Allow access to couple complaints" ON public.complaints;
DROP POLICY IF EXISTS "Read couple complaints" ON public.complaints;
DROP POLICY IF EXISTS "Insert couple complaints" ON public.complaints;
DROP POLICY IF EXISTS "Update couple complaints" ON public.complaints;
DROP POLICY IF EXISTS "Delete couple complaints" ON public.complaints;
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

-- Complaint replies (author_id)
DROP POLICY IF EXISTS "Allow access to couple complaint replies" ON public.complaint_replies;
DROP POLICY IF EXISTS "Read couple complaint replies" ON public.complaint_replies;
DROP POLICY IF EXISTS "Insert couple complaint replies" ON public.complaint_replies;
DROP POLICY IF EXISTS "Update couple complaint replies" ON public.complaint_replies;
DROP POLICY IF EXISTS "Delete couple complaint replies" ON public.complaint_replies;
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

-- Todos (created_by)
DROP POLICY IF EXISTS "Allow access to couple todos" ON public.todos;
DROP POLICY IF EXISTS "Read couple todos" ON public.todos;
DROP POLICY IF EXISTS "Insert couple todos" ON public.todos;
DROP POLICY IF EXISTS "Update couple todos" ON public.todos;
DROP POLICY IF EXISTS "Delete couple todos" ON public.todos;
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

-- Notes (created_by on insert, updated_by stamped by the editor)
DROP POLICY IF EXISTS "Allow access to shared notes" ON public.notes;
DROP POLICY IF EXISTS "Read shared notes" ON public.notes;
DROP POLICY IF EXISTS "Insert shared notes" ON public.notes;
DROP POLICY IF EXISTS "Update shared notes" ON public.notes;
DROP POLICY IF EXISTS "Delete shared notes" ON public.notes;
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

-- Brainstorms (created_by)
DROP POLICY IF EXISTS "Allow access to brainstorms" ON public.brainstorms;
DROP POLICY IF EXISTS "Read brainstorms" ON public.brainstorms;
DROP POLICY IF EXISTS "Insert brainstorms" ON public.brainstorms;
DROP POLICY IF EXISTS "Update brainstorms" ON public.brainstorms;
DROP POLICY IF EXISTS "Delete brainstorms" ON public.brainstorms;
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

-- Finances (created_by; nullable but the client always stamps the caller)
-- Older projects created `finances` before the `created_by` column existed
-- (the app has a PGRST204 fallback for exactly this), so add it if missing.
ALTER TABLE public.finances
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "Allow access to financial logs" ON public.finances;
DROP POLICY IF EXISTS "Read financial logs" ON public.finances;
DROP POLICY IF EXISTS "Insert financial logs" ON public.finances;
DROP POLICY IF EXISTS "Update financial logs" ON public.finances;
DROP POLICY IF EXISTS "Delete financial logs" ON public.finances;
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

-- Bucket list (created_by; completed_by is stamped on UPDATE and left free)
-- Same as finances: add created_by if this project predates the column.
ALTER TABLE public.bucket_list
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "Allow access to bucket list items" ON public.bucket_list;
DROP POLICY IF EXISTS "Read bucket list items" ON public.bucket_list;
DROP POLICY IF EXISTS "Insert bucket list items" ON public.bucket_list;
DROP POLICY IF EXISTS "Update bucket list items" ON public.bucket_list;
DROP POLICY IF EXISTS "Delete bucket list items" ON public.bucket_list;
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

-- NOTE: periods stays `FOR ALL USING (couple_id = get_couple_id())` — it has
-- no author column, so there is nothing extra to bind. diet_logs / sleep_logs
-- are already scoped to `user_id = auth.uid()` for both read and write.

-- ---------------------------------------------------------------------
-- 3. Verify — after running the above, this should list the new per-command
--    policies (SELECT/INSERT/UPDATE/DELETE) for each table and show NO row
--    named "Allow access to ...". Read-only; safe to run anytime.
-- ---------------------------------------------------------------------
-- SELECT tablename, policyname, cmd
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('medical_vault','complaints','complaint_replies','todos',
--                      'notes','brainstorms','finances','bucket_list')
--  ORDER BY tablename, cmd;
