# Auravo Web — FAQ

## General

### What is auravo-web?

The Next.js web application for Auravo voice coaching: dashboard, initial assessment, daily practice, simulations, meeting prep, progress, and Wordle. It uses the same PocketBase `users` accounts as the mobile app.

### What is the difference between `auravo.ai`, `app.auravo.ai`, and `auravo-web.auravo.ai`?

| URL | Typical use |
|-----|-------------|
| `auravo.ai` | Marketing / landing |
| `app.auravo.ai` | Production web app (documented default) |
| `auravo-web.auravo.ai` | Same app on a custom deploy hostname (e.g. your Hetzner container) |
| `pb.auravo.ai` | PocketBase API only — not the product UI |

All app hostnames run **this codebase**; only DNS and env (`NEXT_PUBLIC_APP_URL`) differ.

### Do we still use a local database (SQLite)?

**No.** The web app stores everything in **PocketBase**. There is no `./data/auravo.sqlite` on the Next server anymore.

---

## Authentication

### Can I use the same login as the mobile app?

**Yes.** Both use PocketBase collection `users` at `pb.auravo.ai`.

### Is Google sign-in supported?

**Yes** on `/login` — “Continue with Google”. Requires Google OAuth in Cloud Console and PocketBase `users` → OAuth2 → Google.

### Is Apple sign-in supported?

**Not yet** in the web UI (placeholder was removed; not implemented).

### Where is my session stored?

In the **`pb_auth` cookie** (httpOnly on the server). PocketBase issues the auth token; the Next app mirrors it for SSR and API routes.

---

## Data & privacy

### Where are my recordings stored?

**PocketBase file fields** on records (`practice_sessions`, `baseline_segments`, `simulation_turns`, etc.) on the server hosting `pb.auravo.ai`.

### Does the web app keep audio on the server disk?

Only **temporarily** under `/tmp/auravo-audio` during processing (transcription/analysis). That folder is not the long-term store.

### Can I run the app without PocketBase?

**No.** Auth and all session data require PocketBase.

---

## Features

### Why is the dashboard empty after login?

You have not completed the **initial assessment** (`/assessment`). The radar chart appears after a baseline session is saved to PocketBase.

### Does the coach use AI?

**Yes**, when **Ollama** is running and reachable. Otherwise the app uses **deterministic fallback** text (still functional, less rich).

### Does transcription work on Vercel alone?

**Not reliably.** Real transcription needs **faster-whisper + ffmpeg** on a host with subprocess support. Vercel can use a **placeholder** transcript or call a self-hosted API if you split the architecture.

### What is Wordle?

A vocabulary mini-game in the app (`/wordle`). Separate from voice sessions.

---

## Deployment

### Vercel vs Hetzner container — which should I use?

| Goal | Suggestion |
|------|------------|
| Fast UI deploy, auth, PB CRUD | Vercel + `pb.auravo.ai` |
| Full voice pipeline (Whisper + Ollama) on one box | Container on Hetzner (your Podman setup) |
| Best of both | Vercel for UI, API routes that need ML on Hetzner (advanced) |

### What environment variables are required?

Minimum:

```bash
NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai
```

Set at **build time** for production images and Vercel.

### Why did Vercel fail on `npm ci`?

`package-lock.json` was out of sync with `package.json`. Regenerate lockfile locally, commit, and push. See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## Development

### How do I run locally?

```bash
npm ci
cp .env.example .env.local   # edit values
npm run dev
```

Open `http://localhost:3000/login`.

### How do I run tests?

```bash
npm run test
```

---

## Getting help

1. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — symptom-based fixes  
2. [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — known limitations  
3. [POCKETBASE.md](./POCKETBASE.md) — backend setup  
