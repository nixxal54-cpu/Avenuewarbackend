# AVENUEWAR Production Multiplayer Server - Deployment & Architecture Guide

A production-ready, authoritative multiplayer server for **AVENUEWAR 3v3 Tactical Arena**, built with Node.js, Express, and Socket.IO.

---

## 1. System Architecture

```
                    ┌─────────────────────────────────┐
                    │  AVENUEWAR Client (Three.js)    │
                    │  (WebGL / Three.js + Socket.IO) │
                    └───────────────▲─────────────────┘
                                    │ WebSockets (WSS) / HTTP
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │             Nginx / Reverse Proxy & SSL                │
       │       - WebSocket Upgrade headers                      │
       │       - DDoS & SSL Termination                         │
       └────────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
       ┌────────────────────────────────────────────────────────┐
       │            AVENUEWAR Authoritative Server              │
       │                   (Port 3000)                          │
       │                                                        │
       │  ┌────────────────────┐      ┌──────────────────────┐  │
       │  │    RoomManager     │      │   MovementValidator  │  │
       │  │ (3v3 Cap, Codes)   │      │ (Anti-Speedhack/OOB) │  │
       │  └─────────┬──────────┘      └──────────┬───────────┘  │
       │            │                            │              │
       │  ┌─────────▼──────────┐      ┌──────────▼───────────┐  │
       │  │     Room State     │◄────►│     CombatSystem     │  │
       │  │ (20Hz Tick Broadcast│      │ (Authoritative Hit/  │  │
       │  │  Scores, Lifecycle)│      │  Armor/Eliminations) │  │
       │  └────────────────────┘      └──────────────────────┘  │
       └────────────────────────────────────────────────────────┘
```

### Key Principles
- **Authoritative Server**: The server computes player damage, hitboxes, eliminations, cooldowns, and match timers. Clients report intentions (move velocity, fire raycast) which the server validates before broadcasting.
- **Tick Rate**: Fixed 20Hz server tick loop (`TICK_INTERVAL_MS = 50ms`) broadcasting compact snapshots (`server:tick`).
- **Private 3v3 Rooms**: Custom 6-character room codes (`AVE-XXX`), 6-player hard limit, 3 players per team (`ALPHA` vs `BRAVO`).
- **Resilient Reconnection**: 30-second grace period with persistent `sessionToken` so players can reconnect seamlessly upon Wi-Fi/cellular drops.
- **Anti-Cheat Validation**:
  - Distance-per-tick capping to prevent speed-hacks and teleportation.
  - Rate limiting per socket (max 35 events/sec) to prevent packet spam.
  - Authoritative weapon fire rates, magazine limits, and reload timers.
  - Coordinate clamping within tactical Avenue boundaries.

---

## 2. Environment Variables (.env)

Create a `.env` file in the root directory:

```bash
# Server Port
PORT=3000

# Environment mode
NODE_ENV="production"

# Allowed CORS origins (comma-separated or * for development)
CORS_ORIGIN="https://avenuewar.example.com,http://localhost:3000"

# Gameplay Rules
MAX_PLAYERS_PER_ROOM=6
PLAYERS_PER_TEAM=3
MATCH_DURATION_SECONDS=300
SCORE_TO_WIN=20
SERVER_TICK_RATE_HZ=20
RECONNECT_TIMEOUT_MS=30000
RATE_LIMIT_ACTIONS_PER_SEC=35
```

---

## 3. Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Start development server (with hot client bundle)
npm run dev
```

---

## 4. Production Deployment

### Option A: PM2 Process Manager (Recommended for Single Server/VPS)

```bash
# 1. Build the production bundle
npm run build

# 2. Install PM2 globally
npm install -g pm2

# 3. Start with ecosystem config
pm2 start server.ts --name avenuewar-server --interpreter tsx --instances max --exec-mode cluster

# 4. Check status and logs
pm2 status
pm2 logs avenuewar-server
```

### Option B: Docker Container

Create a `Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000
CMD ["npx", "tsx", "server.ts"]
```

Build and run:
```bash
docker build -t avenuewar-server:latest .
docker run -d -p 3000:3000 --env-file .env --name avenuewar avenuewar-server:latest
```

---

## 5. Nginx Reverse Proxy Configuration

WebSocket connections require HTTP/1.1 upgrade headers. Use this Nginx configuration:

```nginx
server {
    listen 80;
    server_name arena.avenuewar.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name arena.avenuewar.com;

    ssl_certificate /etc/letsencrypt/live/arena.avenuewar.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arena.avenuewar.com/privkey.pem;

    # Socket.IO WebSocket endpoint
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # REST APIs & Web Client
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## 6. Authoritative REST APIs & Health Checks

- `GET /health`: Used by load balancers and Kubernetes liveness probes.
  ```json
  {
    "status": "healthy",
    "app": "AVENUEWAR Dedicated Multiplayer Server",
    "uptime": 1824.5,
    "activeRooms": 3,
    "tickRateHz": 20,
    "timestamp": 1729929292000
  }
  ```
- `GET /api/rooms`: List of active 3v3 rooms, player counts, and match progress.
- `GET /api/config`: Authoritative weapon stats, reload durations, and arena coordinates.
