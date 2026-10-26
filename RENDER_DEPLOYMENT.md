# Deploying AVENUEWAR on Render

This guide provides step-by-step instructions for deploying the **AVENUEWAR 3v3 Multiplayer Server** to [Render](https://render.com).

Render natively supports **WebSockets (Socket.IO)** with SSL certificates, health checks, and automatic git deployments.

---

## Method 1: 1-Click Blueprint Deployment (Recommended)

This repository includes a `render.yaml` blueprint.

1. Push this repository to GitHub or GitLab.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** in the top right and select **Blueprint**.
4. Connect your GitHub/GitLab repository.
5. Render will automatically detect `render.yaml` and configure:
   - **Service Name**: `avenuewar-multiplayer`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
   - All necessary environment variables (`TICK_RATE_HZ`, `MAX_PLAYERS_PER_ROOM`, `CORS_ORIGIN`, etc.)
6. Click **Apply**. Render will build and deploy your service!

---

## Method 2: Manual Web Service Setup via Dashboard

If you prefer to configure manually:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Select your repository.
3. Configure the settings:
   - **Name**: `avenuewar-multiplayer`
   - **Region**: Choose the region closest to your players (e.g. *Oregon (US West)* or *Frankfurt (EU)*).
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: 
     ```bash
     npm install --legacy-peer-deps && npm run build
     ```
   - **Start Command**: 
     ```bash
     npm start
     ```
   - **Plan**: 
     - *Free*: Good for testing (spins down after 15 min of inactivity).
     - *Starter* ($7/mo): **Recommended for game servers** (stays active 24/7 without idle sleep during matches).

4. Expand **Advanced** and set:
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: `Yes`

5. Under **Environment Variables**, add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production static file serving and optimization |
| `CORS_ORIGIN` | `*` | Allowed client origins (or specify your custom game domain) |
| `MAX_PLAYERS_PER_ROOM` | `6` | 3v3 maximum player limit |
| `PLAYERS_PER_TEAM` | `3` | Maximum players per Alpha/Bravo squad |
| `MATCH_DURATION_SECONDS` | `300` | 5-minute match clock |
| `SCORE_TO_WIN` | `20` | Eliminations required for victory |
| `SERVER_TICK_RATE_HZ` | `20` | Authoritative tick rate (50ms intervals) |
| `RECONNECT_TIMEOUT_MS` | `30000` | 30s session token grace period |
| `RATE_LIMIT_ACTIONS_PER_SEC` | `35` | Anti-spam packet rate limiter |

6. Click **Create Web Service**.

---

## How WebSockets Work on Render

- Render automatically terminates SSL (`https://` and `wss://`).
- WebSockets use standard HTTP/1.1 Upgrade headers. Render's load balancer forwards WebSocket frames directly to your Node process without extra proxy configuration.
- Your server's health check is available at `https://<your-service-name>.onrender.com/health`.
- The public rooms API is available at `https://<your-service-name>.onrender.com/api/rooms`.

---

## Connecting Your Three.js / Zombie Survival Client

In your Three.js game client, point Socket.IO to your Render service URL:

```typescript
import { io } from 'socket.io-client';

const RENDER_SERVER_URL = 'https://avenuewar-multiplayer.onrender.com';

const socket = io(RENDER_SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Connected to AVENUEWAR server on Render! Socket ID:', socket.id);
});
```

---

## Troubleshooting

1. **Cold Starts on Free Tier**:
   On the Free plan, Render puts services to sleep after 15 minutes without incoming HTTP traffic. When a new player connects, it takes ~30-50 seconds to wake up. For zero-downtime 3v3 tournaments, upgrade to the Starter plan ($7/mo).
2. **CORS Errors**:
   If connecting from an external game launcher or website, verify `CORS_ORIGIN` in Render is set to `*` or includes your game client domain (e.g., `https://mygame.com`).
3. **Build Timeout**:
   Our build step compiles both the server and Vite client in under 20 seconds, well within Render's 15-minute build limit.
