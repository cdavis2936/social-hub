# Social App Starter (Chat + Voice/Video + Reels)

This project now includes all requested upgrades:
- PostgreSQL + Prisma for users, messages, reels
- TURN/STUN runtime configuration for WebRTC clients
- Reel processing queue with Redis + BullMQ + FFmpeg moderation/transcoding

## Stack

- API + realtime: `Node.js`, `Express`, `Socket.IO`
- DB: `PostgreSQL` + `Prisma`
- Queue: `Redis` + `BullMQ`
- RTC relay: `coturn`
- Reel processing: `FFmpeg`/`FFprobe`

## 1) Configure env

```bash
cp .env.example .env
```

## 2) Start infra services

```bash
docker compose up -d postgres redis coturn
```

## 3) Install dependencies and generate Prisma client

```bash
npm install
npm run prisma:generate
npm run db:push
```

If Docker is unavailable for PostgreSQL, use the built-in local user-space cluster:

```bash
./scripts/local-postgres.sh bootstrap
npm run db:push
```

## 4) Run app server and worker

Terminal 1:
```bash
npm run start
```

Terminal 2:
```bash
npm run worker
```

Open `http://localhost:4000`.

## API Overview

- `POST /api/auth/register` `{ username, password }`
- `POST /api/auth/login` `{ username, password }`
- `GET /api/config/rtc` (auth)
- `GET /api/users` (auth)
- `GET /api/messages/:peerId` (auth)
- `POST /api/reels` multipart (`video`, `caption`) (auth)
- `GET /api/reels` (auth, ready reels only)
- `GET /api/reels/mine` (auth, includes processing status)
- `POST /api/reels/:reelId/like` (auth)

## Reel pipeline behavior

- Uploaded reel starts as `PROCESSING`
- Caption moderation blocks a small restricted-terms list
- Video duration over `MAX_REEL_DURATION_SECONDS` (default `60`) is rejected
- Successful jobs are transcoded to MP4 and marked `READY`
- Feed returns only `READY` reels
- If Redis is unavailable, server falls back to inline processing automatically

## TURN notes

- Client reads ICE servers from `/api/config/rtc`
- Configure `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` in `.env`
- Included coturn config (`infra/turnserver.conf`) is local/dev-oriented

## Production checklist

- Move TURN auth to dynamic ephemeral credentials
- Add stronger moderation (vision/audio models, abuse pipeline)
- Add auth hardening, rate limits, and device/session controls
- Add observability and retry/dead-letter handling for jobs
