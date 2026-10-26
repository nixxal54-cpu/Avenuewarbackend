import React, { useState } from 'react';
import {
  BookOpen,
  Code,
  Server,
  Layers,
  Copy,
  Check,
  ShieldCheck,
  Cpu,
  Terminal,
} from 'lucide-react';

export const DocsBridgeView: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const clientAdapterSnippet = `// client/NetworkAdapter.ts (Three.js Bridge)
import { io, Socket } from 'socket.io-client';

export class AvenueWarNetworkAdapter {
  private socket: Socket;
  private roomCode: string | null = null;
  private sessionToken: string;

  constructor(serverUrl: string = window.location.origin) {
    this.sessionToken = localStorage.getItem('avenuewar_session') || 
      'tok_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('avenuewar_session', this.sessionToken);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });

    this.setupListeners();
  }

  // 1. Join Private 3v3 Room
  public joinRoom(roomCode: string, playerName: string, team: 'ALPHA' | 'BRAVO') {
    this.socket.emit('room:join', {
      roomCode,
      playerName,
      team,
      sessionToken: this.sessionToken,
    }, (res: any) => {
      if (res.success) {
        this.roomCode = res.roomCode;
        console.log('Joined 3v3 room:', res.roomCode);
      }
    });
  }

  // 2. Authoritative 20Hz Movement Tick
  public sendMovement(pos: THREE.Vector3, vel: THREE.Vector3, rotY: number, pitch: number, seq: number) {
    this.socket.emit('player:move', {
      position: { x: pos.x, y: pos.y, z: pos.z },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
      rotationY: rotY,
      pitch: pitch,
      sequence: seq,
      clientTime: Date.now(),
    });
  }

  // 3. Authoritative Combat Fire Ray
  public shootWeapon(weapon: string, origin: THREE.Vector3, dir: THREE.Vector3, targetId?: string) {
    this.socket.emit('player:shoot', {
      weapon,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: dir.x, y: dir.y, z: dir.z },
      targetPlayerId: targetId,
      clientTimestamp: Date.now(),
    });
  }

  private setupListeners() {
    this.socket.on('server:tick', (payload) => {
      // Interpolate remote players smoothly in Three.js render loop
    });

    this.socket.on('combat:hit', (hit) => {
      // Trigger blood particle and hitmarker sound
    });

    this.socket.on('combat:elimination', (entry) => {
      // Show killfeed notification and play sound
    });
  }
}`;

  const nginxSnippet = `server {
    listen 80;
    server_name arena.avenuewar.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name arena.avenuewar.com;

    ssl_certificate /etc/letsencrypt/live/arena.avenuewar.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/arena.avenuewar.com/privkey.pem;

    # Socket.IO WebSocket with automatic upgrades
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}`;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-2">
          <BookOpen className="w-3.5 h-3.5" />
          ARCHITECTURE & INTEGRATION
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">
          CLIENT INTEGRATION & DEPLOYMENT GUIDE
        </h1>
        <p className="text-xs text-neutral-400 font-mono mt-1">
          How to connect your existing Three.js game files (and preserve Zombie Survival) with the
          production multiplayer server.
        </p>
      </div>

      {/* Preservation of Zombie Survival & Architecture */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              PRESERVING ZOMBIE SURVIVAL & SEPARATING SERVER
            </h2>
            <p className="text-xs text-neutral-400">
              Clean separation between client rendering, AI singleplayer, and 3v3 authoritative server
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 text-xs font-mono text-neutral-300">
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-amber-400 font-bold mb-1">1. Decoupled Transport Layer</div>
            <p className="text-neutral-400">
              The multiplayer server resides under <code className="text-white">/server</code> and exposes
              pure Socket.IO events. Your single-player Zombie Survival logic remains completely untouched.
            </p>
          </div>
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-emerald-400 font-bold mb-1">2. Reusable Assets & Controls</div>
            <p className="text-neutral-400">
              Player movement controllers, weapon sounds, muzzle flashes, and camera setups can be shared
              between Zombie Survival and AvenueWar 3v3 Arena without code duplication.
            </p>
          </div>
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-cyan-400 font-bold mb-1">3. Game Mode Routing</div>
            <p className="text-neutral-400">
              A simple game mode switch boots either the offline Zombie AI manager or the
              Socket.IO NetworkAdapter, keeping both games in one high-performance codebase.
            </p>
          </div>
        </div>
      </div>

      {/* Three.js Client Adapter Code Snippet */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase">
              Three.js Client Network Adapter (Ready to drop into existing game)
            </h2>
          </div>
          <button
            onClick={() => copyToClipboard(clientAdapterSnippet, 'adapter')}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
          >
            {copiedKey === 'adapter' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto max-h-96">
          {clientAdapterSnippet}
        </pre>
      </div>

      {/* Production Nginx Reverse Proxy Setup */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase">
              Nginx Production Reverse Proxy (WebSocket Upgrades)
            </h2>
          </div>
          <button
            onClick={() => copyToClipboard(nginxSnippet, 'nginx')}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
          >
            {copiedKey === 'nginx' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Nginx Config</span>
              </>
            )}
          </button>
        </div>

        <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto max-h-80">
          {nginxSnippet}
        </pre>
      </div>

      {/* Deploy to Render Section */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-wide uppercase">
              Deploying to Render (render.yaml Blueprint)
            </h2>
          </div>
          <button
            onClick={() =>
              copyToClipboard(
                `services:
  - type: web
    name: avenuewar-multiplayer
    runtime: node
    plan: starter # or free
    region: oregon
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGIN
        value: "*"
      - key: MAX_PLAYERS_PER_ROOM
        value: "6"
      - key: PLAYERS_PER_TEAM
        value: "3"
      - key: MATCH_DURATION_SECONDS
        value: "300"
      - key: SCORE_TO_WIN
        value: "20"
      - key: SERVER_TICK_RATE_HZ
        value: "20"
      - key: RECONNECT_TIMEOUT_MS
        value: "30000"
      - key: RATE_LIMIT_ACTIONS_PER_SEC
        value: "35"`,
                'render'
              )
            }
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
          >
            {copiedKey === 'render' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy render.yaml</span>
              </>
            )}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4 text-xs font-mono">
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-amber-400 font-bold mb-1">Option A: Blueprint (1-Click)</div>
            <p className="text-neutral-400 mb-2">
              Push your code to GitHub, open Render Dashboard, click <b>New + → Blueprint</b>, and select your repo.
              Render automatically detects <code className="text-white">render.yaml</code>.
            </p>
          </div>
          <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800">
            <div className="text-cyan-400 font-bold mb-1">Option B: Manual Web Service</div>
            <p className="text-neutral-400 mb-2">
              In Render, click <b>New + → Web Service</b>. Set Build Command to <code className="text-white">npm install && npm run build</code> and Start Command to <code className="text-white">npm start</code>.
            </p>
          </div>
        </div>

        <pre className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 font-mono text-xs text-neutral-300 overflow-x-auto max-h-60">
{`# render.yaml (included in root directory)
services:
  - type: web
    name: avenuewar-multiplayer
    runtime: node
    plan: starter # or free
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health`}
        </pre>
      </div>
    </div>
  );
};
