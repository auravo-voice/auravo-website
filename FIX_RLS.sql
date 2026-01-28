-- =====================================================
-- COMPLETE FIX: Row-Level Security for quiz_submissions
-- =====================================================
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Allow anonymous updates" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Allow authenticated reads" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Enable insert for anon users" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Enable update for anon users" ON public.quiz_submissions;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.quiz_submissions;

-- Step 3: CRITICAL - Grant table-level privileges to anon and authenticated roles
-- This is what was missing!
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.quiz_submissions TO anon, authenticated;

-- Also grant on sequences if needed
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Step 4: Ensure RLS is enabled
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create policies with correct syntax
-- Policy for INSERT (both anon and authenticated can insert)
CREATE POLICY "Enable insert for all users"
ON public.quiz_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy for UPDATE (both anon and authenticated can update)
CREATE POLICY "Enable update for all users"
ON public.quiz_submissions
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Policy for SELECT (only authenticated can read - for admin dashboard)
CREATE POLICY "Enable select for authenticated users"
ON public.quiz_submissions
FOR SELECT
TO authenticated
USING (true);

-- Step 6: Verify everything is set up correctly
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'RLS SETUP COMPLETE!';
    RAISE NOTICE '==============================================';
END $$;

-- Verify grants
SELECT 
    grantee, 
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'quiz_submissions'
    AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- Verify policies
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'quiz_submissions'
ORDER BY cmd;

-- Expected output:
-- GRANTS: anon should have INSERT, SELECT, UPDATE, DELETE
-- POLICIES: 3 policies (INSERT, UPDATE, SELECT)
