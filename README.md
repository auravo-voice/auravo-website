# Auravo Web

Next.js voice coaching app for Auravo — dashboard, Quick Analysis, initial assessment, practice, simulations, meeting prep, and progress. **Auth** uses PocketBase (`https://pb.auravo.ai`). **Session data** uses a storage adapter: SQLite on Hetzner (default production) or PocketBase collections when `AURAVO_STORAGE=pocketbase`.

## Quick start

```bash
npm ci
cp .env.example .env.local   # set NEXT_PUBLIC_POCKETBASE_URL, GROQ_API_KEY, etc.
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## Documentation

Full docs live in **[`docs/`](./docs/README.md)**:

| Doc | Description |
|-----|-------------|
| [Design](./docs/DESIGN.md) | Architecture, Quick Analysis, billing, data flow |
| [Installation](./docs/INSTALLATION.md) | Local, Vercel, and Hetzner (Podman) deploy |
| [PocketBase](./docs/POCKETBASE.md) | Collections, CORS, OAuth, storage modes |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | 502, auth, transcription, Quick Analysis, Razorpay |
| [FAQ](./docs/FAQ.md) | Common questions |
| [Known issues](./docs/KNOWN_ISSUES.md) | Limitations and gaps |

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind
- PocketBase (auth; optional full data backend)
- SQLite via `better-sqlite3` (default on Hetzner for sessions + Quick Analysis usage)
- Groq (`llama-3.1-8b-instant`) — transcript coaching, Quick Analysis scoring
- faster-whisper + ffmpeg (transcription, self-hosted)
- Deepgram Aura (Quick Analysis coach TTS, optional)
- Razorpay (Quick Analysis subscriptions)

## Deploy

- **Hetzner (production):** `cd /opt/auravo-web && ./scripts/deploy-hetzner.sh` — see [Installation](./docs/INSTALLATION.md).
- **Vercel:** `npm ci` + `npm run build` — set `NEXT_PUBLIC_POCKETBASE_URL`; voice/Whisper routes need a self-hosted API or will degrade.
