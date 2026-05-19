# Auravo Web

Next.js voice coaching app for Auravo — dashboard, assessment, practice, simulations, and meeting prep. Auth and data live in **PocketBase** (`https://pb.auravo.ai`), shared with the mobile app.

## Quick start

```bash
npm ci
cp .env.example .env.local   # set NEXT_PUBLIC_POCKETBASE_URL
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## Documentation

Full docs live in **[`docs/`](./docs/README.md)**:

| Doc | Description |
|-----|-------------|
| [Design](./docs/DESIGN.md) | Architecture and data flow |
| [Installation](./docs/INSTALLATION.md) | Local, Vercel, and container deploy |
| [PocketBase](./docs/POCKETBASE.md) | Collections, CORS, OAuth |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | 502, auth, transcription, etc. |
| [FAQ](./docs/FAQ.md) | Common questions |
| [Known issues](./docs/KNOWN_ISSUES.md) | Limitations and gaps |

## Stack

- Next.js 16 · React 19 · TypeScript · Tailwind
- PocketBase (auth + persistence)
- Ollama (coach copy, optional)
- faster-whisper (transcription, self-hosted)

## Deploy

- **Vercel:** `npm ci` + `npm run build` — set `NEXT_PUBLIC_POCKETBASE_URL` in project env.
- **Container:** See [Installation → Podman/Docker](./docs/INSTALLATION.md#7-deploy-with-podmandocker-debian-vps).
