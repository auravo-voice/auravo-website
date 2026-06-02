# Auravo Web — End-to-End Design Document

## 1) Purpose and scope

`auravo-web` is the production web client for Auravo voice coaching. It supports:

- onboarding assessment (4-segment baseline),
- daily practice with task-level review,
- simulation conversations,
- meeting-prep planning and rehearsal,
- progress dashboard/journal,
- vocabulary mini-game (`/wordle`, branded in UI as **Auravord**).

This document describes the current architecture, runtime behavior, data flows, deployment model, and operational tradeoffs.

For setup/runbook details see [INSTALLATION.md](./INSTALLATION.md) and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## 2) Design goals

- **Single canonical analysis pipeline** for all speaking flows.
- **Predictable coaching output** via structured JSON + schema validation.
- **Graceful degradation** when external AI/transcription dependencies fail.
- **Portable storage** (SQLite or PocketBase-backed query adapters).
- **Production reliability** on self-hosted Hetzner (Podman) and cloud environments.
- **Fast rebuilds** for Python speech stack via layered image caching.

---

## 3) System context

```mermaid
flowchart LR
  Browser[Browser / Next UI] --> NextApp[Next.js 16 App Router]
  NextApp --> APIRoutes[API Routes (Node runtime)]
  APIRoutes --> AuthPB[PocketBase auth/API]
  APIRoutes --> Storage[(SQLite or PocketBase-backed data)]
  APIRoutes --> Tmp[/tmp/auravo-audio]
  APIRoutes --> Whisper[faster-whisper + ffmpeg + Python]
  APIRoutes --> Acoustic[Parselmouth + librosa + VAD]
  APIRoutes --> Groq[Groq chat completions API]
```

### Hostname roles

| Host | Role |
|---|---|
| `auravo.ai` / `www.auravo.ai` | Public web entrypoint |
| `app.auravo.ai` / `auravo-web.auravo.ai` | App host (deployment-dependent) |
| `pb.auravo.ai` | PocketBase API/admin host |

---

## 4) Technology stack

| Layer | Choice |
|---|---|
| Web framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Styling/UI | Tailwind CSS, Radix UI primitives |
| Validation | Zod |
| Speech transcription | `faster-whisper` (Python subprocess), `ffmpeg` |
| Acoustic analysis | `praat-parselmouth`, `librosa`, VAD |
| Coaching LLM | Groq OpenAI-compatible chat completions |
| Data backend | Storage adapter (`sqlite` or `pocketbase`) |
| Auth | PocketBase auth (`pb_auth`) |
| Tests | Vitest |

---

## 5) Repository architecture

```text
app/
  (app)/
    assessment/
    dashboard/
    practice/
    simulations/
    meeting-prep/
    progress/
    wordle/
  api/                         # Route handlers (auth, analysis, practice, simulations)
src/
  lib/analysis/                # Canonical runAnalysis orchestration
  lib/coach/                   # Coach generation + deterministic fallbacks
  lib/groq/                    # Groq env + structured chat client
  lib/assessment/              # Baseline payload parsing, segment transcript shaping
  lib/transcription/           # Adapter layer for speech-to-text
  lib/storage/                 # Storage env and path resolution
  db/queries/                  # Backend-agnostic query façade + implementations
  components/                  # Shared UI
scripts/
  deploy-hetzner.sh            # Production deploy script (Podman)
Containerfile                  # App image build including Python speech toolchain
```

---

## 6) Runtime configuration

### Core environment variables

- `AURAVO_STORAGE=sqlite|pocketbase`  
  Selects persistence query backend (`sqlite` default).
- `NEXT_PUBLIC_POCKETBASE_URL`  
  Browser-facing PocketBase URL (also signals PB auth availability).
- `POCKETBASE_URL`  
  Server-side PocketBase URL for route handlers.
- `GROQ_API_KEY`, `GROQ_MODEL`  
  Coaching provider and model (`llama-3.1-8b-instant` default).
- `AURAVO_COACH_TIMEOUT_MS`  
  Timeout budget used by Groq coach paths.
- `TRANSCRIPTION_PROVIDER`, `FASTER_WHISPER_MODEL`, `FASTER_WHISPER_PYTHON`  
  Speech stack selection and execution path.

### Storage mode strategy

- **SQLite mode**: local persistence for app session artifacts (common on Hetzner container deployment).
- **PocketBase mode**: app data read/write via PocketBase query implementation.
- Auth can still be PocketBase while data storage backend differs.

---

## 7) Authentication and authorization

- Auth uses PocketBase users and `pb_auth` cookie.
- Supported flows:
  - email/password sign-in and sign-up,
  - Google OAuth2 redirect flow.
- Protected API routes and app surfaces resolve user identity via server auth helpers.
- Domain-aware cookie settings are used for production hosts.

No sensitive inference calls are executed client-side; Groq calls are server-only.

---

## 8) Canonical analysis pipeline

`runAnalysis()` in `src/lib/analysis/run-analysis.ts` is the central orchestrator used by assessment, practice, simulations, and meeting-prep finalization.

### Pipeline stages

1. **Input resolution**
   - Single audio or concatenated multi-part audio.
   - Optional pre-transcribed fallback path.
2. **Parallel heavy stage**
   - transcription (faster-whisper),
   - acoustic extraction (Parselmouth + librosa),
   - VAD extraction.
3. **Deterministic scoring stage**
   - derived speech metrics,
   - six-dimension score computation,
   - transcript-deep flags.
4. **Context stage**
   - optional conversation metrics (simulation/meeting rehearsal).
5. **Recommendation stage**
   - candidate exercise selection from week plan.
6. **Coach stage**
   - final coaching summary (Groq, with deterministic fallback behavior),
   - optional exercise task review (Groq).
7. **Persistence shaping**
   - canonical JSON serialized into session transcript analysis payload.

### Output contract

`CanonicalAnalysis` includes transcript, model metadata, six scores, explanation bundle, coach summary, optional task review, optional conversation metrics, and candidate exercises.

---

## 9) Groq-first coaching architecture

### Shared client

- `src/lib/groq/chat-json.ts` exposes structured chat with:
  - JSON extraction,
  - schema validation (Zod),
  - timeout and network error handling,
  - typed message contract.

### Features now routed to Groq

- transcript coaching summaries,
- dashboard narrative,
- task review,
- scenarios generation,
- progress journal synthesis,
- simulation turn coach and custom scenario generation,
- meeting-prep plan and rehearsal turn coach.

### Failure behavior

- If Groq fails/timeout occurs, user-facing routes return deterministic fallback content where defined.
- Warnings are surfaced through coach serve result wrappers without breaking primary user flow.

---

## 10) Assessment architecture (multi-segment baseline)

### Segment model

Assessment captures 4 segments in fixed order:

1. `passage` (read-aloud),
2. `open_q1`,
3. `open_q2`,
4. `visual`.

Draft uploads are stored per segment; finalize verifies completeness, resolves audio, and executes canonical analysis.

### Finalize behavior

- Concatenates segment audio for highest-quality full-pass analysis.
- If transcription infra is unavailable, degrades to concatenated pre-transcribed segment text (if available).
- Persists practice session, transcript, scores, and serialized analysis metadata.

### Results rendering detail

Assessment results now support per-segment transcript display:

- UI section **“What you said”** presents the learner-generated response segments as separate blocks:
  - `open_q1`,
  - `open_q2`,
  - `visual`.
- The read-aloud passage is intentionally excluded from these response blocks.
- For older records without per-segment rows, UI falls back to combined transcript text.

---

## 11) Data model and persistence contracts

Primary entities (logical model):

- **Users**: auth profile and onboarding goal.
- **Practice sessions**: top-level speaking session records.
- **Session transcripts**: text + serialized analysis JSON.
- **Session scores**: six-dimension numeric scores.
- **Onboarding baseline link**: user’s selected baseline session.
- **Baseline segments**: draft/final segment-level assessment rows.
- **Simulation turns**: turn-level simulation artifacts.

Key design choice: route handlers consume query façade modules in `src/db/queries/*`, so storage backend can switch with minimal feature-level changes.

---

## 12) API surface overview

Representative route groups:

- `app/api/auth/*` — login, signup, oauth start/callback, logout.
- `app/api/assessment/draft/*` — segment upload + baseline finalize.
- `app/api/practice/*` — daily practice lifecycle.
- `app/api/simulations/*` — start/turn/finalize and custom scenario.
- `app/api/meeting-prep/*` — plan/start/turn/finalize.
- `app/api/coach/scenarios` and related serving endpoints.

Route handlers are thin orchestrators: validate input, enforce auth, call core services, return typed JSON.

---

## 13) Deployment architecture (Hetzner reference)

### Runtime pattern

- Podman container `auravo-web` bound to `127.0.0.1:3001`.
- Reverse proxy routes public traffic to app container.
- App joins internal network for service-to-service communication.
- Secrets loaded from `/opt/auravo-web/.env.production.local`.

### Build strategy

`Containerfile` builds Node app plus Python speech environment in-layer.

Important optimization:

- Parselmouth wheel is built once into `/wheels` and then installed from wheel cache in subsequent builds (when requirements layer cache is valid).

This significantly reduces rebuild time on ARM64 hosts.

---

## 14) Reliability, degradation, and performance

### Reliability patterns

- Deterministic fallback content for coach-dependent features.
- Explicit timeout and error typing for external model calls.
- Segment draft model allows resume/re-record without losing progress.
- Canonical analysis serialization keeps downstream UI stable.

### Performance patterns

- Parallelization of transcription/acoustic/VAD.
- Input fingerprinting for feature pipeline cache opportunities.
- Separation of heavy Python toolchain into cacheable image layers.
- Scoped unstable/cache usage on selected read endpoints.

---

## 15) Security and compliance notes

- `NEXT_PUBLIC_*` variables are non-secret only.
- `GROQ_API_KEY` must remain server-side; rotate immediately if exposed.
- OAuth redirect URIs and PocketBase allowed origins must match active hosts.
- User-scoped data access is enforced through auth-aware query/routing layers.

---

## 16) Current naming/UI conventions

- Vocabulary game route remains `/wordle` for compatibility.
- User-facing brand label is **Auravord** in navigation and game UI.

---

## 17) Open risks and future evolution

- Large-model dependency on external Groq availability can still increase latency under provider/network stress.
- Long-running audio analysis remains CPU-heavy; horizontal scaling requires queue/worker strategy if throughput grows.
- Additional schema versioning for persisted `analysis_json` may be warranted as features expand.

---

## 18) Usage guide

This section is a practical runbook for engineers who need to run, verify, and deploy the system quickly.

### A) Local development (fast path)

1. Install dependencies:
   - `npm ci`
2. Create env file:
   - `cp .env.example .env.local`
3. Set required env vars in `.env.local`:
   - `NEXT_PUBLIC_POCKETBASE_URL`
   - `GROQ_API_KEY`
   - optional: `GROQ_MODEL`, `AURAVO_STORAGE`, transcription vars.
4. Start the app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000/login`

Recommended quick validation:

- Login flow works (`/login` -> `/dashboard`).
- Assessment can start and save segment drafts.
- `/wordle` renders with Auravord label.

### B) Core feature usage (end-to-end)

#### 1. Assessment baseline

1. Navigate to `/assessment`.
2. Record all four segments.
3. Finalize baseline.
4. Confirm results page shows:
   - six skill scores,
   - coach insights,
   - **What you said** split into three response blocks (`open_q1`, `open_q2`, `visual`).

If transcription fails, validate degraded fallback behavior and warning copy.

#### 2. Daily practice

1. Navigate to `/practice/today`.
2. Complete an exercise recording.
3. Verify:
   - task review returns structured content,
   - coaching summary appears,
   - persistence reflects latest session.

#### 3. Simulations

1. Start a scenario from `/simulations`.
2. Send at least 2 turns.
3. Verify assistant turn generation and finalize behavior.

#### 4. Meeting prep

1. Create a plan from `/meeting-prep`.
2. Start rehearsal.
3. Confirm turn-by-turn coaching plus fallback resilience.

### C) Runtime knobs and what they affect

- `GROQ_API_KEY`  
  Enables live coach generation across dashboard/practice/simulations/meeting-prep.
- `GROQ_MODEL`  
  Controls model used by Groq structured chat.
- `AURAVO_COACH_TIMEOUT_MS`  
  Governs LLM timeout before fallback.
- `AURAVO_STORAGE`  
  Switches query backend (`sqlite` default).
- `FASTER_WHISPER_MODEL`  
  Speech model quality/speed tradeoff.

### D) Pre-merge / pre-deploy checklist

- `npm test -- --run` passes.
- `npx tsc --noEmit` passes.
- No accidental secret changes (`.env*` uncommitted).
- Diff includes intended routes/UI text only.
- If changing analysis/payload contracts, verify backward fallback behavior.

### E) Hetzner deployment steps

Server-side canonical flow:

1. Ensure `/opt/auravo-web/.env.production.local` contains:
   - `GROQ_API_KEY`
   - `GROQ_MODEL`
2. Run deploy script:
   - `cd /opt/auravo-web && ./scripts/deploy-hetzner.sh`
3. Script performs:
   - `git pull origin main`
   - `podman build` with cached layers
   - container restart
   - health checks (`/login`, PocketBase reachability)

### F) Post-deploy verification

Run on server:

- `cd /opt/auravo-web && git log -1 --oneline`
- `podman ps --filter name=auravo-web`
- `curl -sf http://127.0.0.1:3001/login`

Run externally:

- `curl -I https://www.auravo.ai/login`
- open `/assessment/results` and `/wordle` in browser.

Expected:

- new commit hash visible on server,
- app routes return `200`,
- Groq model visible in deploy script health output.

### G) Troubleshooting shortcuts

- Coach/fallback issues:
  - confirm `GROQ_API_KEY` and outbound network.
- Slow rebuilds:
  - verify Parselmouth wheel layer cache hit in build logs.
- Auth callback issues:
  - validate OAuth redirect URI and cookie domain config.
- PB access failures:
  - verify `POCKETBASE_URL` from inside container network.

---

## 19) Related documents

- [INSTALLATION.md](./INSTALLATION.md)
- [POCKETBASE.md](./POCKETBASE.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [FAQ.md](./FAQ.md)
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)
