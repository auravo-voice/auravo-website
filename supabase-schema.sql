-- =====================================================
-- Supabase Database Schema for Voice Archetype Quiz
-- =====================================================
-- 
-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to SQL Editor
-- 3. Create a new query
-- 4. Copy and paste this entire SQL script
-- 5. Click "Run" to execute
-- =====================================================

-- Create the quiz_submissions table
CREATE TABLE IF NOT EXISTS quiz_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  occupation TEXT NOT NULL,
  quiz_taken BOOLEAN DEFAULT FALSE,
  archetype TEXT,
  archetype_percentages JSONB,
  quiz_started_at TIMESTAMP WITH TIME ZONE,
  quiz_completed_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_email ON quiz_submissions(email);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_archetype ON quiz_submissions(archetype);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_submitted_at ON quiz_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_taken ON quiz_submissions(quiz_taken);

-- Enable Row Level Security (RLS)
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow INSERT for anonymous and authenticated users
CREATE POLICY "Enable insert for anon users" 
ON quiz_submissions
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Create policy to allow UPDATE for anonymous and authenticated users
CREATE POLICY "Enable update for anon users" 
ON quiz_submissions
FOR UPDATE 
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Create policy to allow SELECT for authenticated users only (for admin dashboard)
CREATE POLICY "Enable read for authenticated users" 
ON quiz_submissions
FOR SELECT 
TO authenticated
USING (true);

-- Optional: Create a view for analytics (counts by archetype)
CREATE OR REPLACE VIEW archetype_statistics AS
SELECT 
  archetype,
  COUNT(*) as total_submissions,
  COUNT(DISTINCT email) as unique_users,
  MIN(submitted_at) as first_submission,
  MAX(submitted_at) as latest_submission
FROM quiz_submissions
WHERE quiz_taken = TRUE
GROUP BY archetype
ORDER BY total_submissions DESC;

-- Create a view for lead tracking
CREATE OR REPLACE VIEW lead_statistics AS
SELECT 
  COUNT(*) as total_leads,
  COUNT(CASE WHEN quiz_taken = TRUE THEN 1 END) as completed_quizzes,
  COUNT(CASE WHEN quiz_taken = FALSE THEN 1 END) as incomplete_quizzes,
  ROUND(COUNT(CASE WHEN quiz_taken = TRUE THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as completion_rate
FROM quiz_submissions;

-- Grant access to the views
GRANT SELECT ON archetype_statistics TO anon, authenticated;
GRANT SELECT ON lead_statistics TO anon, authenticated;

-- =====================================================
-- Sample Queries for Testing
-- =====================================================

-- View all submissions
-- SELECT * FROM quiz_submissions ORDER BY submitted_at DESC;

-- Count submissions by archetype
-- SELECT archetype, COUNT(*) FROM quiz_submissions GROUP BY archetype;

-- Get recent submissions (last 7 days)
-- SELECT * FROM quiz_submissions 
-- WHERE submitted_at > NOW() - INTERVAL '7 days'
-- ORDER BY submitted_at DESC;

-- Find duplicate emails
-- SELECT email, COUNT(*) FROM quiz_submissions 
-- GROUP BY email HAVING COUNT(*) > 1;

-- View incomplete quizzes (leads who didn't finish)
-- SELECT name, email, phone, occupation, submitted_at 
-- FROM quiz_submissions 
-- WHERE quiz_taken = FALSE 
-- ORDER BY submitted_at DESC;

-- View completed quizzes only
-- SELECT name, email, archetype, quiz_completed_at 
-- FROM quiz_submissions 
-- WHERE quiz_taken = TRUE 
-- ORDER BY quiz_completed_at DESC;

-- Check completion rate
-- SELECT * FROM lead_statistics;
