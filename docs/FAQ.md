# Auravo Web — FAQ

## General

### What is auravo-web?

The Next.js web application for Auravo voice coaching: dashboard, **Quick Analysis**, initial assessment, daily practice, simulations, meeting prep, progress, and Auravord (`/wordle`). Auth uses PocketBase `users` at `pb.auravo.ai`.

### What is the difference between `auravo.ai`, `www.auravo.ai`, and `auravo-web.auravo.ai`?

| URL | Typical use |
|-----|-------------|
| `auravo.ai` / `www.auravo.ai` | Production web app (Hetzner) |
| `auravo-web.auravo.ai` | Same app on alternate hostname |
| `pb.auravo.ai` | PocketBase API — not the product UI |

Set `NEXT_PUBLIC_APP_URL` to the hostname you use for OAuth callbacks.

### Do we use SQLite or PocketBase for data?

**Both, depending on mode:**

| `AURAVO_STORAGE` | Session data | Auth |
|------------------|--------------|------|
| `sqlite` (Hetzner default) | `./data` or `/data/auravo.sqlite` | PocketBase |
| `pocketbase` | PocketBase collections | PocketBase |

Hetzner production uses **SQLite on volume `auravo-data`** plus PocketBase for login.

---

## Quick Analysis

### Is Quick Analysis public?

**No.** Sign in at `/login`, then open **Quick Analysis** from the sidebar (`/quick-analysis`).

### How many free assessments per day?

**3 per calendar day** (server local timezone). Starting an assessment calls `POST /api/quick-analysis/start`, which records one run.

### What happens on the 4th assessment?

A **Razorpay paywall**: ₹500/month or ₹5,000/year for unlimited sessions until subscription expiry.

### How long can I talk?

**5 minutes total recording** per assessment, shared across all questions. The UI shows remaining time.

### Why does analysis say “servers are busy”?

The server allows at most **5 parallel** Whisper/Groq jobs. Retry after a short wait.

### Does Quick Analysis use the same scoring as the full assessment?

It uses a dedicated pipeline in `src/lib/quick-analysis/` (Groq grammar/vocab/coach, Whisper segments, pronunciation highlighting). It is optimized for a short demo-style flow, not the full 4-segment baseline `runAnalysis()` path.

---

## Authentication

### Can I use the same login as the mobile app?

**Yes.** Both use PocketBase collection `users` at `pb.auravo.ai`.

### Is Google sign-in supported?

**Yes** on `/login`. Requires Google OAuth in Cloud Console and PocketBase `users` → OAuth2 → Google.

### Where is my session stored?

In the **`pb_auth` cookie** (httpOnly). PocketBase issues the JWT; Next mirrors it for SSR and API routes.

---

## Data & privacy

### Where are my recordings stored?

- **Practice / assessment (SQLite mode):** audio paths in SQLite + files under the app data directory on the server volume.
- **PocketBase mode:** file fields on PB records.
- **During processing:** temp files under `/tmp/auravo-audio`.

### Can I run the app without PocketBase?

**Not for production auth.** Sign-in requires PocketBase when `NEXT_PUBLIC_POCKETBASE_URL` is set. SQLite mode still uses PB for identity.

---

## Features

### Why is the dashboard empty after login?

You have not completed the **initial assessment** (`/assessment`). The radar chart appears after a baseline session is saved.

### Does the coach use AI?

**Yes.** Primary coach paths use **Groq** (`GROQ_API_KEY`, `llama-3.1-8b-instant`). Deterministic fallbacks apply when Groq fails or times out. Legacy **Ollama** paths exist for some narratives if configured.

### Does transcription work on Vercel alone?

**Not reliably.** Real transcription needs **faster-whisper + ffmpeg** on a long-running Node host (Hetzner container).

### What is Auravord?

The vocabulary mini-game at `/wordle` (nav label **Auravord**).

---

## Deployment

### Vercel vs Hetzner — which should I use?

| Goal | Suggestion |
|------|------------|
| Auth + UI only | Vercel + `pb.auravo.ai` |
| Full voice pipeline (Whisper, Quick Analysis, Groq) | Hetzner Podman (`scripts/deploy-hetzner.sh`) |

Production Quick Analysis runs on **Hetzner** at `https://www.auravo.ai`.

### What environment variables are required on Hetzner?

Minimum in `.env.production.local`:

```bash
GROQ_API_KEY=...
```

Also set at **build** time: `NEXT_PUBLIC_POCKETBASE_URL`, `NEXT_PUBLIC_APP_URL`.

Optional: `DEEPGRAM_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.

---

## Development

### How do I run locally?

```bash
npm ci
cp .env.example .env.local   # edit values
npm run dev
```

Open `http://localhost:3000/login`, then `/quick-analysis`.

### How do I run tests?

```bash
npm run test
```

---

## Getting help

1. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — symptom-based fixes  
2. [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — known limitations  
3. [POCKETBASE.md](./POCKETBASE.md) — backend setup  
4. [DESIGN.md](./DESIGN.md) — architecture and Quick Analysis flow  
