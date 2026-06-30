# Auravo Web — Documentation

Documentation for the **auravo-web** Next.js application (voice coaching product UI).

| Document | Purpose |
|----------|---------|
| [DESIGN.md](./DESIGN.md) | Architecture, Quick Analysis, billing, auth, deployment |
| [CODE_ARCHITECTURE.md](./CODE_ARCHITECTURE.md) | Code-level layout: modules, routes, pipelines, DB, conventions |
| [INSTALLATION.md](./INSTALLATION.md) | Local dev, Vercel, and Hetzner (Podman) install |
| [POCKETBASE.md](./POCKETBASE.md) | PocketBase collections, CORS, OAuth, storage modes |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common failures and fixes |
| [FAQ.md](./FAQ.md) | Frequently asked questions |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Limitations and tracked gaps |

## Quick links

- **App (production):** `https://www.auravo.ai` (Hetzner) or `https://auravo-web.auravo.ai`
- **PocketBase API:** `https://pb.auravo.ai`
- **Login:** `/login` · **Signup:** `/signup`
- **Quick Analysis (signed in):** `/quick-analysis`

## Requirements at a glance

| Component | Required for | Where it runs |
|-----------|--------------|---------------|
| Node.js ≥ 20.9 | Build & run Next | Dev machine / container / Vercel |
| PocketBase | Auth (always when `NEXT_PUBLIC_POCKETBASE_URL` set) | `pb.auravo.ai` (Hetzner) |
| SQLite volume | Session data + Quick Analysis limits (Hetzner default) | `auravo-data` Podman volume → `/data` |
| Groq API | Coach copy, grammar/vocab, Quick Analysis | Server env `GROQ_API_KEY` |
| faster-whisper + ffmpeg | Real transcription | Hetzner container (not Vercel-only) |
| Deepgram (optional) | Quick Analysis Voca voice (Aura TTS) | Server env; falls back to browser TTS |
| Razorpay (optional) | Quick Analysis paid tier | Server env `RAZORPAY_KEY_*` |
| Reverse proxy | HTTPS, large uploads | nginx + Cloudflare (`client_max_body_size 100m` for Quick Analysis) |

## Storage model (important)

Production on Hetzner uses **`AURAVO_STORAGE=sqlite`** with PocketBase **only for auth**:

- `pb_auth` cookie → PocketBase user id
- Practice sessions, scores, Quick Analysis runs, subscriptions → SQLite file on persistent volume

Set `AURAVO_STORAGE=pocketbase` to store app data in PocketBase collections instead (see [POCKETBASE.md](./POCKETBASE.md)).
