import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './server/RoomManager';
import { setupSocketHandlers } from './server/socketHandler';
import { SERVER_CONFIG, WEAPON_REGISTRY } from './server/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createAvenueWarServer() {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: SERVER_CONFIG.CORS_ORIGIN === '*' ? true : SERVER_CONFIG.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  const roomManager = new RoomManager(io);
  setupSocketHandlers(io, roomManager);

  app.use(express.json());

  // CORS middleware for REST endpoints
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health and Monitoring API
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      app: 'AVENUEWAR Dedicated Multiplayer Server',
      version: '1.0.0',
      uptime: process.uptime(),
      activeRooms: roomManager.getRoomCount(),
      tickRateHz: SERVER_CONFIG.TICK_RATE_HZ,
      timestamp: Date.now(),
    });
  });

  // Public Rooms API
  app.get('/api/rooms', (_req, res) => {
    res.json({
      rooms: roomManager.getRoomSummaries(),
      count: roomManager.getRoomCount(),
    });
  });

  // Game & Weapon Metadata API (Authoritative Source)
  app.get('/api/config', (_req, res) => {
    res.json({
      weapons: WEAPON_REGISTRY,
      arena: SERVER_CONFIG.ARENA,
      spawns: SERVER_CONFIG.SPAWNS,
      rules: {
        maxPlayersPerRoom: SERVER_CONFIG.MAX_PLAYERS_PER_ROOM,
        playersPerTeam: SERVER_CONFIG.PLAYERS_PER_TEAM,
        matchDurationSeconds: SERVER_CONFIG.MATCH_DURATION_SECONDS,
        scoreToWin: SERVER_CONFIG.SCORE_TO_WIN,
        tickRateHz: SERVER_CONFIG.TICK_RATE_HZ,
        reconnectGracePeriodMs: SERVER_CONFIG.RECONNECT_GRACE_PERIOD_MS,
      },
    });
  });

  // In development, mount Vite dev server as middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built client assets
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  return { app, httpServer, io, roomManager };
}

// Auto-start when executed directly
if (process.env.NODE_ENV !== 'test') {
  createAvenueWarServer().then(({ httpServer }) => {
    const PORT = SERVER_CONFIG.PORT || 3000;
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`[AVENUEWAR] Authoritative 3v3 Multiplayer Server`);
      console.log(`Port: ${PORT} | Tick Rate: ${SERVER_CONFIG.TICK_RATE_HZ}Hz`);
      console.log(`Ready for private 3v3 room connections.`);
      console.log(`===============================================`);
    });
  });
}
