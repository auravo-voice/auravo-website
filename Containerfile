FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_POCKETBASE_URL=https://pb.auravo.ai
ARG NEXT_PUBLIC_APP_URL=https://auravo.ai
ENV NEXT_PUBLIC_POCKETBASE_URL=$NEXT_PUBLIC_POCKETBASE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN python3 -m venv .venv-transcription && \
    .venv-transcription/bin/pip install --upgrade pip setuptools wheel && \
    .venv-transcription/bin/pip install -r scripts/requirements-transcription.txt
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
