FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-dev \
    python3-venv \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/requirements-transcription.txt scripts/requirements-transcription.txt
RUN python3 -m venv .venv-transcription && \
    .venv-transcription/bin/pip install --upgrade pip setuptools wheel && \
    mkdir -p /wheels && \
    .venv-transcription/bin/pip wheel praat-parselmouth -w /wheels && \
    .venv-transcription/bin/pip install --find-links=/wheels --prefer-binary -r scripts/requirements-transcription.txt

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai
ARG NEXT_PUBLIC_APP_URL=https://www.auravo.ai
ENV NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
