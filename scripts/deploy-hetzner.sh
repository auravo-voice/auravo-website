#!/usr/bin/env bash
# Deploy auravo-web on Hetzner (Podman). Run on the server from /opt/auravo-web.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/auravo-web}"
IMAGE="${IMAGE:-auravo-web:latest}"
CONTAINER="${CONTAINER:-auravo-web}"
NETWORK="${NETWORK:-voca}"
DATA_VOLUME="${DATA_VOLUME:-auravo-data}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production.local}"

NEXT_PUBLIC_POCKETBASE_URL="${NEXT_PUBLIC_POCKETBASE_URL:-https://pb.auravo.ai}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://www.auravo.ai}"
POCKETBASE_URL="${POCKETBASE_URL:-http://auth:8080}"
GROQ_MODEL="${GROQ_MODEL:-llama-3.1-8b-instant}"

cd "$APP_DIR"

if [ -f "$ENV_FILE" ]; then
  echo "==> Loading secrets from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${GROQ_API_KEY:?Set GROQ_API_KEY in $ENV_FILE before deploy}"

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

podman run -d --replace --name "$CONTAINER" \
  --network "$NETWORK" \
  -p 127.0.0.1:3001:3000 \
  -v "${DATA_VOLUME}:/data" \
  -e NODE_ENV=production \
  -e "NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL" \
  -e "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" \
  -e "POCKETBASE_URL=$POCKETBASE_URL" \
  -e AURAVO_STORAGE=sqlite \
  -e AURAVO_DB_DIR=/data \
  -e "GROQ_API_KEY=$GROQ_API_KEY" \
  -e "GROQ_MODEL=$GROQ_MODEL" \
  -e "DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY:-}" \
  -e FASTER_WHISPER_MODEL=small \
  -e TRANSCRIPTION_PROVIDER=faster-whisper \
  -e FASTER_WHISPER_PYTHON=/app/.venv-transcription/bin/python \
  "$IMAGE"

echo "==> Health checks"
sleep 3
curl -sf http://127.0.0.1:3001/login >/dev/null && echo "OK: /login"
podman exec "$CONTAINER" node -e "
  fetch(process.env.POCKETBASE_URL + '/api/health')
    .then((r) => r.json())
    .then((pb) => console.log('PocketBase', pb.code, 'Groq model', process.env.GROQ_MODEL))
    .catch((e) => { console.error(e); process.exit(1); });
"

echo "==> Deploy complete ($NEXT_PUBLIC_APP_URL)"
