# Signature Voice

A modern Astro + React app to discover your Voice Archetype. Includes a two-stage Supabase data capture:
- Stage 1 (Lead capture): Save user details as soon as they submit the form
- Stage 2 (Results): Update the same record after quiz completion with archetype and percentages

## Tech Stack
- Astro (frontend framework)
- React (interactive quiz components)
- Tailwind CSS (styling)
- Supabase (Postgres + RLS + REST)
- TypeScript/JavaScript

## Local Setup
- Prerequisites
  - Node.js 18+
  - npm (or yarn/pnpm)
- Install
  ```bash
  npm install
  ```
- Run dev
  ```bash
  npm run dev
  # open http://localhost:4321/
  ```
- Build
  ```bash
  npm run build
  # output in dist/
  ```

## Environment Variables
Create a `.env` at project root:
```env
PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```
Note: Values must start with `PUBLIC_` to be available in the Astro client.

## Supabase Setup (Two-Stage Capture)
1) Create a Supabase project and copy Project URL + anon public key (Settings → API)
2) Run the schema in `supabase-schema.sql` (SQL Editor → New query → Run)
3) If you face RLS errors, run `FIX_RLS.sql` to reset grants/policies.

### Table: `quiz_submissions`
Columns:
- `id` (uuid, pk)
- `name`, `email`, `phone`, `occupation`
- `quiz_taken` (boolean, default false)
- `archetype` (text, nullable)
- `archetype_percentages` (jsonb, nullable)
- `quiz_started_at`, `quiz_completed_at` (timestamptz)
- `submitted_at`, `created_at` (timestamptz)

### Stage 1 (on form submit)
`saveUserDetails(userData)` inserts a row with lead info and `quiz_taken=false`.
- Implemented in `src\lib\supabase.js`
- Triggered by `IntroScreen.jsx` via `VoiceArchetypeQuiz.jsx`

### Stage 2 (on results page)
`updateQuizResults(submissionId, results)` updates the same row with `quiz_taken=true`, `archetype`, `archetype_percentages`, and `quiz_completed_at`.
- Implemented in `src\lib\supabase.js`
- Triggered by `ResultsCard.jsx`

### RLS Policies (production-friendly)
If needed, re-apply with SQL Editor:
```sql
-- Enable RLS
ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Insert/Update allowed for anon & authenticated
CREATE POLICY IF NOT EXISTS "Enable insert for anon & authenticated"
ON public.quiz_submissions FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for anon & authenticated"
ON public.quiz_submissions FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);

-- Select allowed only for authenticated (admin dashboards)
CREATE POLICY IF NOT EXISTS "Enable select for authenticated"
ON public.quiz_submissions FOR SELECT TO authenticated
USING (true);

-- Ensure grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.quiz_submissions TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

## Useful Scripts
- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

## Deployment (Vercel/Netlify)
- Set environment variables on the host:
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
- Build command: `npm run build`
- Output directory: `dist`
- Test in prod:
  - Submit form (record with `quiz_taken=false`)
  - Complete quiz (record updates to `true` + result)

## Troubleshooting
- **RLS 42501 / 401 errors**
  - Run `FIX_RLS.sql` in Supabase SQL Editor to reset grants/policies
  - Confirm `.env` loaded and server restarted
- **Env not loading**
  - File name must be `.env` (not `.env.txt`)
  - Use `PUBLIC_` prefix
  - Restart dev server
- **Data not saving**
  - Check browser console network tab for POST to `/rest/v1/quiz_submissions`
  - Review Supabase logs

## Project Structure
```
├── public/
├── src/
│  ├── components/
│  │  └── quiz/ (IntroScreen, VoiceArchetypeQuiz, ResultsCard, etc.)
│  ├── lib/ (supabase.js)
│  └── pages/
│     └── voice-quiz.astro
├── supabase-schema.sql
├── FIX_RLS.sql                 # handy utility to fix RLS quickly if needed
├── package.json
└── README.md
```

## Contributing
- Issues and PRs are welcome.
- Keep README as the single source of truth; avoid scattering docs.

