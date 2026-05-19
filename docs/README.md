# Auravo Web — Documentation

Documentation for the **auravo-web** Next.js application (voice coaching product UI).

| Document | Purpose |
|----------|---------|
| [DESIGN.md](./DESIGN.md) | Architecture, data flow, auth, and deployment topology |
| [INSTALLATION.md](./INSTALLATION.md) | Local dev, Vercel, and container (Podman/Docker) install |
| [POCKETBASE.md](./POCKETBASE.md) | PocketBase collections, CORS, OAuth |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common failures and fixes |
| [FAQ.md](./FAQ.md) | Frequently asked questions |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Limitations and tracked gaps |

## Quick links

- **App (production):** `https://app.auravo.ai` or your host (e.g. `https://auravo-web.auravo.ai`)
- **PocketBase API:** `https://pb.auravo.ai`
- **Login:** `/login` · **Signup:** `/signup`

## Requirements at a glance

| Component | Required for | Where it runs |
|-----------|--------------|---------------|
| Node.js ≥ 20.9 | Build & run Next | Dev machine / container / Vercel |
| PocketBase | Auth + all persisted data | `pb.auravo.ai` (Hetzner) |
| Ollama | Coach narratives (optional fallback without) | Same host or private URL |
| faster-whisper + ffmpeg | Real transcription | Host running API routes (not Vercel-only) |
| Reverse proxy | HTTPS public access | nginx + Cloudflare |
