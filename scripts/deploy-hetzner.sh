#!/usr/bin/env bash
# Deploy auravo-web on Hetzner (Podman). Run on the server from /opt/auravo-web.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/auravo-web}"
IMAGE="${IMAGE:-auravo-web:latest}"
CONTAINER="${CONTAINER:-auravo-web}"
NETWORK="${NETWORK:-voca}"
DATA_VOLUME="${DATA_VOLUME:-auravo-data}"

NEXT_PUBLIC_POCKETBASE_URL="${NEXT_PUBLIC_POCKETBASE_URL:-https://pb.auravo.ai}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://www.auravo.ai}"
POCKETBASE_URL="${POCKETBASE_URL:-http://auth:8080}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://host.containers.internal:11434}"

cd "$APP_DIR"

echo "==> Pull latest"
git pull origin main

echo "==> Build image"
podman build \
  --build-arg "NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL" \
  --build-arg "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" \
  -t "$IMAGE" \
  -f Containerfile .

podman volume exists "$DATA_VOLUME" || podman volume create "$DATA_VOLUME"

echo "==> Restart container"
podman stop "$CONTAINER" 2>/dev/null || true
podman rm "$CONTAINER" 2>/dev/null || true

podman run -d --name "$CONTAINER" \
  --network "$NETWORK" \
  -p 127.0.0.1:3001:3000 \
  -v "${DATA_VOLUME}:/data" \
  -e NODE_ENV=production \
  -e "NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL" \
  -e "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" \
  -e "POCKETBASE_URL=$POCKETBASE_URL" \
  -e AURAVO_STORAGE=sqlite \
  -e AURAVO_DB_DIR=/data \
  -e "OLLAMA_BASE_URL=$OLLAMA_BASE_URL" \
  -e OLLAMA_MODEL=qwen2.5:3b \
  -e AURAVO_COACH_TIMEOUT_MS=180000 \
  -e TRANSCRIPTION_PROVIDER=faster-whisper \
  -e FASTER_WHISPER_MODEL=base \
  -e FASTER_WHISPER_PYTHON=/app/.venv-transcription/bin/python \
  --replace \
  "$IMAGE"

echo "==> Health checks"
sleep 3
curl -sf http://127.0.0.1:3001/login >/dev/null && echo "OK: /login"
podman exec "$CONTAINER" node -e "
  Promise.all([
    fetch(process.env.POCKETBASE_URL + '/api/health').then((r) => r.json()),
    fetch(process.env.OLLAMA_BASE_URL + '/api/tags').then((r) => r.ok),
  ]).then(([pb, ollama]) => console.log('PocketBase', pb.code, 'Ollama', ollama ? 'ok' : 'fail'))
    .catch((e) => { console.error(e); process.exit(1); });
"

echo "==> Deploy complete ($NEXT_PUBLIC_APP_URL)"
