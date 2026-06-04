# Auravo Web — Installation Guide

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| Node.js | ≥ 20.9.0 |
| npm | 10+ (for `npm ci`) |
| PocketBase | Running at `https://pb.auravo.ai` (or local for dev) |
| Git | Clone this repository |

**Optional (full voice features on self-hosted API):**

- Ollama + pulled model (e.g. `ollama pull qwen2.5:3b`)
- Python 3.11–3.12, ffmpeg, faster-whisper (`npm run setup:transcription`)

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
# Required — PocketBase public API (browser + server)
NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai

# Recommended for OAuth redirects on custom hosts
NEXT_PUBLIC_APP_URL=https://app.auravo.ai

# Ollama (server-side only)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
AURAVO_COACH_TIMEOUT_MS=180000

# Transcription (self-hosted API only)
TRANSCRIPTION_PROVIDER=faster-whisper
FASTER_WHISPER_MODEL=base
# FASTER_WHISPER_PYTHON=/opt/auravo-web/.venv-transcription/bin/python

# Dev: phone testing on LAN
# NEXT_ALLOWED_DEV_ORIGINS=192.168.1.37
```

### Build-time vs runtime

| Variable | When needed |
|----------|-------------|
| `NEXT_PUBLIC_POCKETBASE_URL` | **Build and runtime** (baked into client bundle at build) |
| `NEXT_PUBLIC_APP_URL` | Build recommended for OAuth |
| `OLLAMA_*`, `TRANSCRIPTION_*` | Runtime only (server) |

---

## 3. PocketBase setup

Complete **before** using assessment or dashboard data features:

1. Follow [POCKETBASE.md](./POCKETBASE.md) — create collections, CORS, Google OAuth.
2. Confirm health: `curl https://pb.auravo.ai/api/health`

---

## 4. Local development

```bash
npm run dev
# LAN access from phone:
npm run dev:lan
```

Open [http://localhost:3000](http://localhost:3000).

- Login: [http://localhost:3000/login](http://localhost:3000/login)
- Add `http://localhost:3000` to PocketBase allowed origins.

### Transcription setup (optional)

```bash
npm run setup:transcription   # Python venv + faster-whisper
# Ensure ffmpeg is on PATH: ffmpeg -version
```

Without this, set `TRANSCRIPTION_PROVIDER=placeholder` or `AURAVO_ALLOW_PLACEHOLDER_FALLBACK=1` for dev.

### Ollama (optional)

```bash
ollama pull qwen2.5:3b
ollama serve   # if not already running
```

---

## 5. Production build (local test)

```bash
npm run build
npm run start
```

Runs on [http://localhost:3000](http://localhost:3000) by default.

---

## 6. Deploy to Vercel

1. Connect GitHub repo to Vercel.
2. **Environment variables** (Project → Settings):
   - `NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai`
   - `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>` (or custom domain)
3. Build uses `vercel.json`: `npm ci` + `npm run build`.
4. Add Vercel URL to PocketBase **allowed origins** and Google OAuth redirect URIs.
5. Custom domain (optional): `app.auravo.ai` → CNAME to Vercel.

**Vercel limitations:** SQLite and local Whisper are not available on serverless alone. Use PocketBase for data; point `OLLAMA_BASE_URL` / transcription to an external host if needed.

---

## 7. Deploy with Podman/Docker (Debian VPS)

Example layout (matches a typical Hetzner + Cloudflare setup):

| Container | Port | Role |
|-----------|------|------|
| `auravo-web` | `127.0.0.1:3001→3000` | This app |
| `auth` (PocketBase) | `127.0.0.1:8080` | API |
| `router` (nginx) | `80`/`443` | Reverse proxy |

### 7.1 Build image

Example `Containerfile` (create in repo root if not present):

```dockerfile
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai
ARG NEXT_PUBLIC_APP_URL=https://auravo-web.auravo.ai
ENV NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
cd /opt/auravo-web
podman build \
  --build-arg NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai \
  --build-arg NEXT_PUBLIC_APP_URL=https://auravo-web.auravo.ai \
  -t auravo-web:latest .
```

### 7.2 Run container

On Hetzner, PocketBase runs as container `auth` on Podman network `voca`. The app must join that network and use an internal PB URL (host `/etc/hosts` often maps `pb.auravo.ai` → `127.0.0.1`, which breaks server-side HTTPS from inside containers).

**Ollama:** host `ollama serve` defaults to `127.0.0.1:11434`. Containers reach it via `host.containers.internal` only after binding Ollama on all interfaces:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '%s\n' '[Service]' 'Environment="OLLAMA_HOST=0.0.0.0:11434"' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
sudo systemctl daemon-reload && sudo systemctl restart ollama
```

**Nginx upload limit:** Quick Analysis final step uploads several WebM clips in one POST. The `auravo-web` vhost must set `client_max_body_size 100m;` (default nginx is 1m → HTTP 413). Other vhosts on the server (`voassess`, `wordle`) already use 100m.

**Deploy** (from repo root on the server):

```bash
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

Or manually:

```bash
podman volume create auravo-data  # once

podman run -d --name auravo-web \
  --network voca \
  -p 127.0.0.1:3001:3000 \
  -v auravo-data:/data \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai \
  -e NEXT_PUBLIC_APP_URL=https://auravo.ai \
  -e POCKETBASE_URL=http://auth:8080 \
  -e AURAVO_STORAGE=sqlite \
  -e AURAVO_DB_DIR=/data \
  -e OLLAMA_BASE_URL=http://host.containers.internal:11434 \
  -e OLLAMA_MODEL=qwen2.5:3b \
  -e TRANSCRIPTION_PROVIDER=faster-whisper \
  --replace \
  auravo-web:latest
```

Set `NEXT_PUBLIC_APP_URL` to your public hostname (`https://auravo.ai` or `https://auravo-web.auravo.ai`) for Google OAuth callbacks.

### 7.3 nginx upstream

Proxy your public hostname to the published port:

```nginx
server {
    server_name auravo-web.auravo.ai;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> If nginx runs **inside** a container, `127.0.0.1:3001` may be wrong — use the host gateway IP or Podman DNS name for `auravo-web`.

### 7.4 Cloudflare

- DNS: `auravo-web` → server IP (proxied orange cloud optional).
- SSL: **Full** if origin has HTTPS; **Flexible** if origin is HTTP only.

### 7.5 Verify

```bash
curl -sI http://127.0.0.1:3001/login
podman logs auravo-web --tail 30
```

---

## 8. Post-install checklist

- [ ] `NEXT_PUBLIC_POCKETBASE_URL` set at **build** time
- [ ] PocketBase collections created ([POCKETBASE.md](./POCKETBASE.md))
- [ ] CORS origins include all app URLs
- [ ] Google OAuth redirect URIs include `/api/auth/oauth2/callback`
- [ ] Login works at `/login`
- [ ] Dashboard loads after sign-in
- [ ] (Self-hosted) Ollama reachable from API container
- [ ] (Self-hosted) `npm run setup:transcription` + ffmpeg for real ASR

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

---

## See also

- [DESIGN.md](./DESIGN.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- [FAQ.md](./FAQ.md)
