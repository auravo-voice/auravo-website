# Auravo Web — Code Architecture

Code-level reference for engineers working in the repository. For product behavior, deployment runbooks, and operational tradeoffs, see [DESIGN.md](./DESIGN.md). For setup, see [INSTALLATION.md](./INSTALLATION.md).

---

## 1. Repository layout

```text
auravo-web/
├── app/                    # Next.js App Router (pages + API routes)
├── src/
│   ├── lib/                # Domain logic (analysis, auth, billing, coach, …)
│   ├── db/                 # Schema, client, query façades (sqlite | pocketbase)
│   ├── components/         # Shared React UI (ui/, auth/, app-chrome, …)
│   ├── config/             # App constants (nav, etc.)
│   └── data/               # Static config data (onboarding goals)
├── app/quick-analysis/     # Quick Analysis client flow (components, hooks, copy)
├── public/                 # Static assets + pre-generated QA TTS MP3s
├── tests/                  # Vitest (mirrors src/lib domains)
├── scripts/                # Deploy, transcription, TTS generation, Python ASR
├── docs/                   # Documentation
├── proxy.ts                # Next 16 edge proxy (anonymous cookie minting)
├── Containerfile           # Production Podman image
└── data/                   # Local SQLite + uploads (gitignored, created at runtime)
```

**Path aliases (`tsconfig.json`):**

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@/app/*` | `app/*` |

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Drizzle + `better-sqlite3`, PocketBase SDK, Zod, Vitest.

---

## 2. App Router structure

### 2.1 Pages

| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` | Marketing landing |
| `/login`, `/signup` | `app/login/page.tsx`, `app/signup/page.tsx` | PocketBase auth forms |
| `/onboarding` | `app/onboarding/page.tsx` | Goal picker → Quick Analysis |
| `(app)/*` | `app/(app)/` | Authenticated shell (`AppChrome` sidebar) |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | Home, baseline summary, coach narrative |
| `/quick-analysis` | `app/(app)/quick-analysis/page.tsx` | Signed-in Quick Analysis |
| `/assessment` | `app/(app)/assessment/` | Legacy 4-segment baseline |
| `/practice/today` | `app/(app)/practice/today/page.tsx` | Daily practice |
| `/simulations`, `/meeting-prep`, `/progress`, `/learning-path` | `app/(app)/…` | Coach features |
| `/wordle` | `app/(app)/wordle/page.tsx` | Auravord (Wordle) |
| `/observability` | `app/(app)/observability/page.tsx` | Admin QA review |
| `/settings` | `app/(app)/settings/page.tsx` | Profile / goal |

**`(app)` layout:** `app/(app)/layout.tsx` wraps pages in `AppChrome`. Nav items live in `src/config/nav.ts`.

**Quick Analysis UI** is not a route group — shared client code under `app/quick-analysis/` is imported by the page.

### 2.2 API routes

All voice/analysis handlers use `export const runtime = "nodejs"` and `dynamic = "force-dynamic"`.

| Prefix | Routes | Responsibility |
|--------|--------|----------------|
| `api/auth/` | `login`, `signup`, `logout`, `session`, `oauth2/start`, `oauth2/callback` | PocketBase identity + cookies |
| `api/quick-analysis/` | `start`, `analyze`, `usage`, `tts`, `submit` | Quick Analysis + billing gates |
| `api/billing/razorpay/` | `create-order`, `verify` | Subscription checkout |
| `api/assessment/` | `draft`, `draft/segment`, `draft/finalize`, `complete` | Legacy baseline |
| `api/practice/` | `exercise` | Daily practice finalize |
| `api/simulations/` | `start`, `turn`, `finalize`, `custom` | Simulations |
| `api/meeting-prep/` | `plan`, `start`, `turn`, `finalize` | Meeting prep |
| `api/coach/` | `scenarios` | Scenario library |
| `api/session/` | `attach`, `baseline-handoff` | Cookie repair after assessment |
| `api/observability/` | `review` | Human review annotations |

---

## 3. `src/lib/` modules

Domain logic lives here. Almost all orchestration modules import `"server-only"`.

| Directory | Entry points | Role |
|-----------|--------------|------|
| `analysis/` | `run-analysis.ts` | **Canonical voice pipeline** — all speaking flows converge here |
| `assessment/` | `dimensions-from-scores.ts`, heuristics | Scoring helpers, segment merge |
| `audio/` | `concat.ts`, `vad.ts`, `acoustic.ts` | ffmpeg, Python feature extraction |
| `auth/` | `session.ts`, `require-auth.ts`, `oauth2.ts` | Identity, cookies, API guards |
| `billing/` | `quick-analysis-entitlement.ts`, `plans.ts`, `razorpay.ts` | Paywall, Razorpay, session quotas |
| `coach/` | `final-summary.ts`, `transcript-analysis.ts` | Groq coaching + deterministic fallbacks |
| `groq/` | `chat-json.ts` | Structured JSON chat (Zod), 429 retries |
| `quick-analysis/` | `run-full-analysis.ts`, `concurrency.ts` | QA-specific analysis, slot limiter |
| `transcription/` | `index.ts`, `faster-whisper.ts` | Adapter: faster-whisper or placeholder |
| `practice/`, `simulations/`, `meeting-prep/` | Feature orchestrators | Week plan, turns, plans |
| `pocketbase/` | `errors.ts`, `server.ts` | PB client helpers, error mapping |
| `storage/` | `env.ts`, `audio-path.ts` | Backend selector, audio path resolution |
| `vocabulary/` | `wordle-stats.ts` | Auravord game logic |

**Deprecated alias:** `ollamaChatStructured` in `groq/chat-json.ts` points to Groq (legacy Ollama paths mostly migrated).

---

## 4. Database layer

### 4.1 Storage adapter

```typescript
// src/lib/storage/env.ts
AURAVO_STORAGE=sqlite      // default (Hetzner production)
AURAVO_STORAGE=pocketbase  // all app data in PB collections
```

**Auth is always PocketBase** when `NEXT_PUBLIC_POCKETBASE_URL` is set — independent of `AURAVO_STORAGE`.

**Query façades** (`src/db/queries/*.ts`) delegate to `sqlite/` or `pocketbase/`:

```typescript
// src/db/queries/user.ts
const impl = isPocketBaseStorage() ? pocketbase : sqlite;
export const ensureUserProfile = impl.ensureUserProfile;
```

Façades: `user`, `sessions`, `baseline`, `baseline-segments`, `simulations`, `sessions-analytics`, `practice-persist`, `observability`.

**SQLite-only (not abstracted):** `sqlite/quick-analysis-usage.ts`, `sqlite/quick-analysis-leads.ts` — billing and lead funnel.

### 4.2 SQLite client

- **Schema:** `src/db/schema.ts` (Drizzle)
- **DDL bootstrap:** `src/db/init-sql.ts` (executed on first open)
- **Client:** `src/db/client.ts` — singleton, WAL mode, additive `ALTER TABLE` migrations
- **Path:** `{AURAVO_DB_DIR}/{AURAVO_DB_FILE}` → default `./data/auravo.sqlite`

### 4.3 Tables

| Table | Purpose |
|-------|---------|
| `user_profile` | Local learner profile (synced from PB user id) |
| `practice_session` | Recorded audio sessions (`kind`, path, duration, `segments_json`) |
| `baseline_segment` | Assessment draft/final segments |
| `simulation_turn` | Per-turn simulation transcript + optional audio |
| `session_transcript` | Full transcript + `analysis_json` (`CanonicalAnalysis`) |
| `session_scores` | Six dimension scores |
| `onboarding_baseline` | User → baseline session link |
| `recording_review` | Observability QA notes |
| `quick_analysis_run` | Free-tier daily usage |
| `user_subscription` | Razorpay plan, expiry, `sessions_limit`, `sessions_used` |
| `quick_analysis_lead` | Public funnel contact + scores |

---

## 5. Authentication

### 5.1 Flow

```text
Browser → POST /api/auth/login | signup
       → PocketBase (https://pb.auravo.ai)
       → pb_auth httpOnly cookie
       → auravo_user_id cookie (SQLite sync)
```

**Signup:** `app/api/auth/signup/route.ts` → `users.create` → `requestVerification`. Errors mapped via `pocketBaseAuthErrorMessage()` in `src/lib/pocketbase/errors.ts`.

**OAuth:** `/api/auth/oauth2/start` → Google → `/api/auth/oauth2/callback` → `authWithOAuth2Code`.

### 5.2 Identity resolution

`src/lib/auth/session.ts`:

1. Valid `pb_auth` → PocketBase user id; if SQLite, `ensureUserProfile()`.
2. Else → `auravo_user_id` cookie (anonymous UUID).

**API guard:** `requireApiUserId()` → 401 JSON.

**Edge proxy (`proxy.ts`):** Mints anonymous `auravo_user_id` only in SQLite dev mode when no auth cookies exist.

### 5.3 Cookies

| Cookie | httpOnly | Role |
|--------|----------|------|
| `pb_auth` | yes | PocketBase auth store |
| `auravo_user_id` | no | Client-readable user id for SQLite flows |
| `auravo_pending_baseline_session` | yes | Safari baseline handoff workaround |
| OAuth state cookies | yes | OAuth2 CSRF protection |

---

## 6. Analysis pipeline

### 6.1 Canonical entry: `runAnalysis()`

**File:** `src/lib/analysis/run-analysis.ts`

All finalize routes call this and persist `CanonicalAnalysis` to `session_transcript.analysis_json`.

```text
audio (single | concat) ─┬─ transcription (faster-whisper)
                         ├─ acoustic features (Python)
                         └─ VAD (Python)
        → derive metrics → six-dimension scores
        → Groq (grammar, vocabulary, coach summary) [parallel]
        → recommendations + optional task review
```

**Failure model:** `TranscriptionUnavailableError` → HTTP 503. Groq failures → deterministic fallbacks (`fallbackUsed: true`).

### 6.2 Quick Analysis variant

**Server:** `src/lib/quick-analysis/run-full-analysis.ts`

- Per-segment browser STT or Whisper (`prepare-analysis-segment.ts`)
- Stitched transcript → `runAnalysis` with `reusePreTranscription: true` (no second concat Whisper)
- Groq polish per segment, phonetic hints for flagged words
- Persist via `persistQuickAnalysisBaseline()`

**Client:** `app/quick-analysis/quick-analysis-flow.tsx` — step machine, recording, prefetch, paywall.

**API modes** (`app/api/quick-analysis/analyze/route.ts`):

| Mode | Use |
|------|-----|
| `segment` | Prefetch Whisper per clip |
| `transcript` | Midpoint scoring from Q3 text |
| `full` | Final baseline + results |
| `deterministic` | Fast score without full pipeline |
| `polish-segments` | Display polish only |

**Concurrency:** `withQuickAnalysisConcurrency()` — max 5 parallel jobs (`QUICK_ANALYSIS_MAX_PARALLEL`).

### 6.3 TTS

1. Static MP3 from `public/quick-analysis/tts/` (`app/quick-analysis/tts-prompts.ts`)
2. Fallback: `POST /api/quick-analysis/tts` (Deepgram Aura)
3. Fallback: browser `speechSynthesis`

Generate static files: `npm run generate:qa-tts`.

---

## 7. Billing and entitlements

**Scope:** Quick Analysis + Voca practice sessions (SQLite only).

| Piece | Location |
|-------|----------|
| Plans | `src/lib/billing/plans.ts` — ₹700/mo · 50 sessions, ₹7000/yr · 500 sessions |
| Entitlement | `src/lib/billing/quick-analysis-entitlement.ts` |
| Usage DB | `src/db/queries/sqlite/quick-analysis-usage.ts` |
| Razorpay | `src/lib/billing/razorpay.ts` |

**Free tier:** 3 Quick Analysis starts/day (`QUICK_ANALYSIS_FREE_DAILY_LIMIT`). First baseline exempt.

**Paid tier:** Shared session pool (`sessions_used` / `sessions_limit` on `user_subscription`). QA start and completed practice exercise increment usage.

**Paywall:** HTTP 402 + `PAYWALL_REQUIRED` from `/api/quick-analysis/start` and practice route.

**Checkout:** `create-order` → Razorpay widget → `verify` → `upsertUserSubscription` (resets `sessions_used`).

**Admin bypass:** `AURAVO_ADMIN_USER_IDS` / role check in `src/lib/auth/admin.ts`.

---

## 8. End-to-end flows (code paths)

### 8.1 Signup → dashboard → Quick Analysis

```text
/signup → POST /api/auth/signup
       → PB users.create + requestVerification

/login  → POST /api/auth/login
       → authWithPassword → savePocketBaseAuthCookie
       → ensureUserProfile (SQLite)

/dashboard → getOnboardingBaselineForUser()
            → coach narrative (Groq, optional)

/quick-analysis → QuickAnalysisFlow
               → GET /api/quick-analysis/usage
               → POST /api/quick-analysis/start (slot + paywall)
               → record clips + prefetch segment Whisper
               → POST /api/quick-analysis/analyze mode=full
               → runQuickAnalysisFull → persistQuickAnalysisBaseline
```

### 8.2 Daily practice

```text
/practice/today → PracticeRunner
               → POST /api/practice/exercise (multipart audio)
               → runAnalysis → SQLite persist
               → recordCompletedVocaPractice (if subscribed)
```

### 8.3 Legacy assessment

```text
/assessment → /api/assessment/draft/* (segment upload)
           → /api/assessment/draft/finalize
           → runAnalysis → onboarding_baseline
```

---

## 9. External integrations

| Service | Env vars | Code touchpoints |
|---------|----------|------------------|
| **PocketBase** | `NEXT_PUBLIC_POCKETBASE_URL`, `POCKETBASE_URL` | `src/lib/pocketbase.ts`, `app/api/auth/*` |
| **Groq** | `GROQ_API_KEY`, `GROQ_MODEL`, `AURAVO_COACH_TIMEOUT_MS` | `src/lib/groq/`, coach + analysis modules |
| **faster-whisper** | `FASTER_WHISPER_*`, `TRANSCRIPTION_PROVIDER` | `src/lib/transcription/`, `scripts/transcribe_faster_whisper.py` |
| **Deepgram** | `DEEPGRAM_API_KEY` | `app/api/quick-analysis/tts/route.ts`, TTS generator script |
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | `src/lib/billing/razorpay.ts`, billing API routes |

**Python subprocesses** (Containerfile + local venv via `npm run setup:transcription`):

- `scripts/transcribe_faster_whisper.py`
- `scripts/extract_acoustic.py`
- `scripts/extract_vad.py`

---

## 10. Frontend conventions

- **UI primitives:** shadcn/Radix under `src/components/ui/`
- **Auth state:** `AuthProvider` polls `/api/auth/session`; root layout passes server snapshot
- **Client fetch:** `readJsonResponse()` — always parse JSON safely
- **Dynamic pages:** Voice routes use `export const dynamic = "force-dynamic"`
- **Coach degradation:** `CoachDegradedBanner`, `CoachLoadError` when Groq/transcription fails

---

## 11. Testing

| Aspect | Detail |
|--------|--------|
| Runner | Vitest 4 — `npm test` |
| Config | `vitest.config.ts` — Node env, `@/` aliases |
| Location | `tests/` grouped by domain (`analysis/`, `billing/`, `quick-analysis/`, …) |
| Stub | `tests/stubs/server-only.ts` for server modules |
| Style | Unit tests on pure logic in `src/lib/`; no Playwright e2e in repo |

---

## 12. Build and deploy

| Target | Mechanism |
|--------|-----------|
| **Local dev** | `npm run dev` — requires `.env.local` (see `.env.example`) |
| **Hetzner prod** | `Containerfile` + `scripts/deploy-hetzner.sh` — Podman, volume `/data`, port 3001 |
| **Vercel** | `vercel.json` — frontend only; Whisper/Groq routes need self-hosted backend |

**Build-time env (baked into client):** `NEXT_PUBLIC_POCKETBASE_URL`, `NEXT_PUBLIC_APP_URL`.

**Runtime-only:** `GROQ_*`, `RAZORPAY_*`, `FASTER_WHISPER_*`, `AURAVO_DB_DIR`, secrets.

---

## 13. Conventions checklist

- Import `"server-only"` in any module that touches DB, filesystem, subprocesses, or secrets.
- Never call Groq/Whisper/Razorpay from client components — server routes only.
- Persist analysis as `CanonicalAnalysis` JSON for consistency across features.
- Use query façades in `src/db/queries/` — do not import `sqlite/` directly from routes unless billing/leads.
- API routes that accept audio: multipart form, write to `{AURAVO_DB_DIR}/uploads/`.
- Next.js 16: read `node_modules/next/dist/docs/` before changing routing/proxy APIs; use `proxy.ts` not legacy middleware patterns where applicable.

---

## 14. Where to start reading

| Task | Start here |
|------|------------|
| Change scoring | `src/lib/analysis/run-analysis.ts`, `src/lib/assessment/heuristics.ts` |
| Change Quick Analysis UX | `app/quick-analysis/quick-analysis-flow.tsx`, `app/quick-analysis/copy.ts` |
| Change QA server logic | `app/api/quick-analysis/analyze/route.ts`, `run-full-analysis.ts` |
| Change billing | `src/lib/billing/plans.ts`, `quick-analysis-entitlement.ts` |
| Change auth errors | `src/lib/pocketbase/errors.ts`, `app/api/auth/signup/route.ts` |
| Add DB column | `src/db/schema.ts` + `src/db/init-sql.ts` + migration in `src/db/client.ts` |
| Add API route | Mirror existing route: `runtime = "nodejs"`, `requireApiUserId()` |
| Deploy | `scripts/deploy-hetzner.sh`, `Containerfile` |

---

## Related docs

| Doc | Focus |
|-----|-------|
| [DESIGN.md](./DESIGN.md) | Product architecture, deployment topology, Quick Analysis UX spec |
| [INSTALLATION.md](./INSTALLATION.md) | Local setup, env vars, Hetzner runbook |
| [POCKETBASE.md](./POCKETBASE.md) | Collections, CORS, OAuth admin steps |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Production failure modes |
