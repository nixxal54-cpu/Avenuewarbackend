# AVENUEWAR Client Integration & Zombie Survival Architecture Bridge

This document details how to integrate any Three.js client (such as your existing **Zombie Survival** or single-player game architecture) into this authoritative Socket.IO multiplayer server without breaking single-player modes or existing game mechanics.

---

## 1. Preserving Existing Architecture (Modular Network Layer)

In clean Three.js game architecture, gameplay controllers (player movement, camera, animations, sounds) should remain completely decoupled from the transport layer.

We recommend adding a dedicated `MultiplayerManager.ts` that acts as the bridge:

```
┌────────────────────────────────────────────────────────┐
│             AVENUEWAR Client Architecture              │
│                                                        │
│  ┌─────────────────────────┐ ┌──────────────────────┐  │
│  │ Single-Player / Zombie  │ │  Tactical 3v3 Arena  │  │
│  │     Survival Mode       │ │      Multiplayer     │  │
│  └───────────┬─────────────┘ └──────────┬───────────┘  │
│              │                          │              │
│              ▼                          ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │     Three.js Game Engine (Renderer, Assets)      │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │    NetworkAdapter / MultiplayerManager.ts        │  │
│  │    (Socket.IO client, tick interpolation)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Socket.IO Protocol Specification

### Connection Setup
```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
```

### Emitted Events (Client -> Server)

| Event | Payload | Description |
|---|---|---|
| `room:create` | `{ playerName: string, roomName?: string, playerId?: string, sessionToken?: string }` | Creates a new private 3v3 room and assigns host. |
| `room:join` | `{ roomCode: string, playerName: string, team?: 'ALPHA' \| 'BRAVO', sessionToken?: string }` | Joins a room by 6-char code (e.g. `AVE-829`). Rejects if room has 6 players. |
| `room:reconnect` | `{ sessionToken: string }` | Reconnects to an existing room slot within the 30s grace period. |
| `team:change` | `{ newTeam: 'ALPHA' \| 'BRAVO' }` | Switches team (max 3 players per team). |
| `player:ready` | `{ isReady: boolean }` | Toggles player readiness. |
| `match:start` | None | Host can force-start match once at least 2 players are in lobby. |
| `player:move` | `{ position: Vector3, velocity: Vector3, rotationY: number, pitch: number, sequence: number, clientTime: number }` | Sends client movement at 20-30Hz. Validated authoritatively against speed limits. |
| `player:shoot` | `{ weapon: 'rifle' \| 'shotgun' \| 'sniper' \| 'smg' \| 'pistol', origin: Vector3, direction: Vector3, targetPlayerId?: string, clientTimestamp: number }` | Reports shot attempt. Server validates cooldown, ammo, line-of-sight & applies damage. |
| `player:reload` | None | Initiates weapon reload. Server tracks duration. |
| `player:switch_weapon` | `{ weapon: string }` | Switches selected firearm. |
| `ping:check` | `timestamp: number` | Server responds with `pong:check` to measure RTT latency. |
| `room:leave` | None | Leaves room cleanly. |

---

### Listened Events (Server -> Client)

| Event | Payload | Description |
|---|---|---|
| `room:state` | `RoomState` | Full room snapshot (scores, players, matchState, countdown). |
| `server:tick` | `{ tickNumber, serverTimestamp, players: [...] }` | 20Hz compact state snapshot for smooth interpolation. |
| `combat:shot_fired` | `{ shooterId, weapon, origin, direction, ammoRemaining }` | Spawn muzzle flash, bullet tracer, and audio. |
| `combat:hit` | `{ shooterId, victimId, damage, isHeadshot, victimHealth, victimArmor }` | Trigger hitmarker, blood impact, and shield damage sound. |
| `combat:elimination` | `{ entry: KillFeedEntry, scores }` | Show killfeed toast and update team scores. |
| `player:reconnected` | `{ playerId, name }` | Restores remote player from disconnected state. |
| `match:starting` | `{ countdownSeconds }` | 5-second countdown HUD. |
| `match:started` | `{ timeRemaining, scores }` | Match active, unlocks player controls. |
| `match:ended` | `{ winnerTeam, scores, reason }` | Displays victory/defeat screen and post-game stats. |

---

## 3. Entity Interpolation (Smoothing the 20Hz Server Ticks)

Because the server broadcasts positions at 20Hz (every 50ms), the Three.js client should use linear interpolation (lerp) inside its `requestAnimationFrame` render loop:

```typescript
// Inside your Three.js render loop:
function updateRemotePlayers(delta: number) {
  for (const remotePlayer of remotePlayers.values()) {
    // Interpolate position smoothly
    remotePlayer.mesh.position.lerp(remotePlayer.targetPosition, 0.25);
    
    // Smooth rotation
    remotePlayer.mesh.rotation.y += (remotePlayer.targetRotationY - remotePlayer.mesh.rotation.y) * 0.2;
  }
}
```

---

## 4. Zombie Survival vs Tactical 3v3 Mode Selector

In your main menu or level selector, simply check mode:
```typescript
if (gameMode === 'ZOMBIE_SURVIVAL') {
  // Use existing single-player/offline Zombie AI loop
  initZombieSurvival();
} else if (gameMode === 'AVENUEWAR_3V3') {
  // Connect to MultiplayerManager and join/create 3v3 room
  multiplayerManager.connect();
}
```
All your zombie AI meshes, sound effects, particle pools, and weapon models remain 100% reusable across both modes!
