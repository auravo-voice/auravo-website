# Auravo Web — Installation Guide

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| Node.js | ≥ 20.9.0 |
| npm | 10+ (for `npm ci`) |
| PocketBase | Running at `https://pb.auravo.ai` (auth; required for sign-in) |
| Git | Clone this repository |

**Self-hosted voice stack (Hetzner / local full features):**

- Python 3.11–3.12, ffmpeg, faster-whisper (`npm run setup:transcription`)
- Groq API key (`GROQ_API_KEY`) — coaching and Quick Analysis scoring
- Deepgram API key (optional) — Quick Analysis Voca TTS
- Razorpay keys (optional) — Quick Analysis paid tier

**Optional (legacy / fallback coach paths):**

- Ollama + pulled model (e.g. `ollama pull qwen2.5:3b`)

---

## 1. Clone and install

```bash
git clone <your-repo-url> auravo-web
cd auravo-web
npm ci
```

> **Vercel:** Always commit `package-lock.json` after dependency changes. `npm ci` fails if lockfile and `package.json` are out of sync.

---

## 2. Environment variables

Create `.env.local` in the project root (never commit secrets):

```bash
# Storage: sqlite (default) or pocketbase
AURAVO_STORAGE=sqlite
# AURAVO_DB_DIR=./data

# Required — PocketBase (auth)
NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai

# Recommended for OAuth redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Required for coaching + Quick Analysis scoring
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant

# Quick Analysis Voca voice (optional — browser TTS fallback)
DEEPGRAM_API_KEY=your_deepgram_key

# Quick Analysis subscriptions (optional)
# RAZORPAY_KEY_ID=rzp_test_...
# RAZORPAY_KEY_SECRET=...

# Transcription (self-hosted API)
TRANSCRIPTION_PROVIDER=faster-whisper
FASTER_WHISPER_MODEL=small
# FASTER_WHISPER_PYTHON=/path/to/.venv-transcription/bin/python

# Dev: phone testing on LAN
# NEXT_ALLOWED_DEV_ORIGINS=192.168.1.37
```

See [`.env.example`](../.env.example) for the full list.

### Build-time vs runtime

| Variable | When needed |
|----------|-------------|
| `NEXT_PUBLIC_POCKETBASE_URL` | **Build and runtime** (baked into client bundle at build) |
| `NEXT_PUBLIC_APP_URL` | Build recommended for OAuth |
| `GROQ_*`, `DEEPGRAM_*`, `RAZORPAY_*`, `TRANSCRIPTION_*`, `AURAVO_DB_DIR` | Runtime only (server) |

---

## 3. PocketBase setup

1. Follow [POCKETBASE.md](./POCKETBASE.md) — auth collection `users`, optional data collections if `AURAVO_STORAGE=pocketbase`.
2. Confirm health: `curl https://pb.auravo.ai/api/health`
3. Add `http://localhost:3000` to PocketBase **allowed origins**.

On **Hetzner production**, auth uses PocketBase while app data uses **SQLite** on volume `auravo-data` (`AURAVO_STORAGE=sqlite`).

---

## 4. Local development

```bash
npm run dev
# LAN access from phone:
npm run dev:lan
```

Open [http://localhost:3000/login](http://localhost:3000/login).

- **Quick Analysis:** `/quick-analysis` (requires sign-in)
- **Dashboard:** `/dashboard`

### Transcription setup

```bash
npm run setup:transcription   # Python venv + faster-whisper
ffmpeg -version
```

Without this, set `AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1` for dev only.

---

## 5. Production build (local test)

```bash
npm run build
npm run start
```

---

## 6. Deploy to Vercel

1. Connect GitHub repo to Vercel.
2. **Environment variables:**
   - `NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai`
   - `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>`
   - `GROQ_API_KEY` (if API routes run on Vercel)
3. Add Vercel URL to PocketBase allowed origins and Google OAuth redirect URIs.

**Vercel limitations:** SQLite and local Whisper are not available on serverless alone. Quick Analysis, assessment finalize, and practice recording need a **self-hosted** Node container (Hetzner) or will return transcription/coach errors.

---

## 7. Deploy with Podman (Hetzner production)

Canonical production host: `https://www.auravo.ai` on server `91.99.144.77`.

| Container | Port | Role |
|-----------|------|------|
| `auravo-web` | `127.0.0.1:3001→3000` | This app |
| `auth` (PocketBase) | internal `8080` | Auth API |
| `router` (nginx) | `80`/`443` | Reverse proxy |

### 7.1 Repository layout on server

```bash
/opt/auravo-web          # git clone
/opt/auravo-web/.env.production.local   # secrets (not in git)
```

### 7.2 Secrets file (`.env.production.local`)

```bash
GROQ_API_KEY=...
GROQ_MODEL=llama-3.1-8b-instant
DEEPGRAM_API_KEY=...          # optional
RAZORPAY_KEY_ID=...           # optional — Quick Analysis billing
RAZORPAY_KEY_SECRET=...
```

### 7.3 Deploy script

From the server:

```bash
cd /opt/auravo-web
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

The script:

1. Sources `.env.production.local`
2. `git pull origin main`
3. `podman build` (see repo `Containerfile` — Node + Python Whisper stack)
4. Restarts `auravo-web` with:
   - `AURAVO_STORAGE=sqlite`, `AURAVO_DB_DIR=/data`
   - Volume `auravo-data:/data` (persistent SQLite + uploads)
   - `POCKETBASE_URL=http://auth:8080` on Podman network `voca`
   - `GROQ_API_KEY`, `DEEPGRAM_API_KEY`, `RAZORPAY_*`
5. Health checks: `/login`, PocketBase reachability

### 7.4 nginx upload limit (required for Quick Analysis)

Quick Analysis full analysis uploads **multiple WebM clips** in one POST. Set on the `auravo-web` vhost:

```nginx
client_max_body_size 100m;
```

Default nginx `1m` causes HTTP **413** on the final analysis step.

### 7.5 PocketBase from inside the container

Use **`POCKETBASE_URL=http://auth:8080`** on the `voca` network. Do not rely on `pb.auravo.ai` resolving to `127.0.0.1` inside the container.

### 7.6 Verify

```bash
curl -sI http://127.0.0.1:3001/login
curl -sI https://www.auravo.ai/quick-analysis   # redirects to login if unsigned
podman logs auravo-web --tail 30
cd /opt/auravo-web && git log -1 --oneline
```

### 7.7 SQLite data location

```bash
podman volume inspect auravo-data
# DB file: auravo.sqlite under volume mount (/data in container)
```

Tables include `quick_analysis_run` (daily usage) and `user_subscription` (Razorpay entitlements).

---

## 8. Post-install checklist

- [ ] `NEXT_PUBLIC_POCKETBASE_URL` set at **build** time
- [ ] `GROQ_API_KEY` set at runtime (Hetzner `.env.production.local`)
- [ ] PocketBase CORS includes all app URLs
- [ ] Google OAuth redirect URIs include `/api/auth/oauth2/callback`
- [ ] Login works at `/login`
- [ ] `/quick-analysis` loads after sign-in
- [ ] nginx `client_max_body_size 100m` for Quick Analysis
- [ ] (Paid tier) `RAZORPAY_KEY_*` in production env
- [ ] `npm run setup:transcription` + ffmpeg for real ASR (included in Containerfile)

---

## 9. Scripts reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run dev:lan` | Dev on `0.0.0.0` |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run test` | Vitest |
| `npm run setup:transcription` | Python ASR venv |
| `./scripts/deploy-hetzner.sh` | Hetzner Podman deploy |

---

## See also

- [DESIGN.md](./DESIGN.md) — Quick Analysis architecture
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [FAQ.md](./FAQ.md)
