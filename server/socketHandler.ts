import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager';
import { Team, WeaponType, ClientMovementPayload, ClientShootPayload } from './types';
import { SERVER_CONFIG, WEAPON_REGISTRY } from './config';
import { CombatSystem } from './CombatSystem';

export function setupSocketHandlers(io: Server, roomManager: RoomManager) {
  // Track action rate limiting per socket
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  function isRateLimited(socketId: string): boolean {
    const now = Date.now();
    let limiter = rateLimitMap.get(socketId);

    if (!limiter || now > limiter.resetTime) {
      limiter = { count: 1, resetTime: now + 1000 };
      rateLimitMap.set(socketId, limiter);
      return false;
    }

    limiter.count++;
    return limiter.count > SERVER_CONFIG.RATE_LIMIT_ACTIONS_PER_SEC;
  }

  io.on('connection', (socket: Socket) => {
    // 1. Create Room
    socket.on(
      'room:create',
      (
        data: {
          playerName: string;
          roomName?: string;
          playerId?: string;
          sessionToken?: string;
        },
        callback?: (res: any) => void
      ) => {
        if (isRateLimited(socket.id)) {
          if (callback) callback({ success: false, error: 'Rate limit exceeded' });
          return;
        }

        const playerId = data?.playerId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sessionToken =
          data?.sessionToken || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const playerName = (data?.playerName || 'Operator').trim().slice(0, 18);

        const result = roomManager.createRoom(
          {
            id: playerId,
            socketId: socket.id,
            name: playerName,
            sessionToken,
          },
          data?.roomName
        );

        if (!result.success || !result.room) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(result.room.state.code);

        const response = {
          success: true,
          roomCode: result.room.state.code,
          roomState: result.room.state,
          playerId,
          sessionToken,
        };

        if (callback) callback(response);
        socket.emit('room:created', response);
      }
    );

    // 2. Join Room
    socket.on(
      'room:join',
      (
        data: {
          roomCode: string;
          playerName: string;
          team?: Team;
          playerId?: string;
          sessionToken?: string;
        },
        callback?: (res: any) => void
      ) => {
        if (isRateLimited(socket.id)) {
          if (callback) callback({ success: false, error: 'Rate limit exceeded' });
          return;
        }

        if (!data?.roomCode) {
          if (callback) callback({ success: false, error: 'Room code is required' });
          return;
        }

        const room = roomManager.getRoom(data.roomCode);
        if (!room) {
          if (callback) callback({ success: false, error: `Room "${data.roomCode}" not found` });
          return;
        }

        const playerId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const sessionToken =
          data.sessionToken || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        const playerName = (data.playerName || 'Operator').trim().slice(0, 18);

        const result = room.addPlayer(
          playerId,
          socket.id,
          playerName,
          sessionToken,
          false,
          data.team
        );

        if (!result.success || !result.player) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(room.state.code);
        roomManager.registerPlayerSocket(socket.id, sessionToken, room.state.code, playerId);

        const response = {
          success: true,
          roomCode: room.state.code,
          roomState: room.state,
          player: result.player,
          playerId,
          sessionToken,
        };

        if (callback) callback(response);
        socket.emit('room:joined', response);
      }
    );

    // 3. Reconnect to Room via Session Token
    socket.on(
      'room:reconnect',
      (
        data: {
          sessionToken: string;
        },
        callback?: (res: any) => void
      ) => {
        if (!data?.sessionToken) {
          if (callback) callback({ success: false, error: 'Session token required' });
          return;
        }

        const mapping = roomManager.getPlayerBySession(data.sessionToken);
        if (!mapping) {
          if (callback) callback({ success: false, error: 'Session expired or not found' });
          return;
        }

        const { room } = mapping;
        const result = room.handleReconnect(data.sessionToken, socket.id);

        if (!result.success || !result.player) {
          if (callback) callback({ success: false, error: result.error });
          return;
        }

        socket.join(room.state.code);
        roomManager.registerPlayerSocket(socket.id, data.sessionToken, room.state.code, result.player.id);

        const response = {
          success: true,
          roomCode: room.state.code,
          roomState: room.state,
          player: result.player,
        };

        if (callback) callback(response);
        socket.emit('room:reconnected', response);
      }
    );

    // 4. Change Team (ALPHA vs BRAVO)
    socket.on('team:change', (data: { newTeam: Team }, callback?: (res: any) => void) => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      if (data.newTeam !== 'ALPHA' && data.newTeam !== 'BRAVO') {
        if (callback) callback({ success: false, error: 'Invalid team selection' });
        return;
      }

      const result = mapping.room.changeTeam(mapping.playerId, data.newTeam);
      if (callback) callback(result);
    });

    // 5. Toggle Ready State
    socket.on('player:ready', (data: { isReady: boolean }, callback?: (res: any) => void) => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      const result = mapping.room.setPlayerReady(mapping.playerId, !!data?.isReady);
      if (callback) callback(result);
    });

    // 6. Host Force Start Match
    socket.on('match:start', (callback?: (res: any) => void) => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      const player = mapping.room.state.players[mapping.playerId];
      if (!player || !player.isHost) {
        if (callback) callback({ success: false, error: 'Only room host can start the match' });
        return;
      }

      const connected = Object.values(mapping.room.state.players).filter((p) => p.isConnected);
      if (connected.length < 2) {
        if (callback) callback({ success: false, error: 'Need at least 2 players to start a 3v3 match' });
        return;
      }

      mapping.room.startCountdown();
      if (callback) callback({ success: true });
    });

    // 7. Authoritative Movement Update
    socket.on('player:move', (payload: ClientMovementPayload) => {
      if (isRateLimited(socket.id)) return;
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) return;

      mapping.room.handlePlayerMovement(mapping.playerId, payload);
    });

    // 8. Server-Validated Shooting
    socket.on('player:shoot', (payload: ClientShootPayload, callback?: (res: any) => void) => {
      if (isRateLimited(socket.id)) {
        if (callback) callback({ success: false, error: 'Rate limit exceeded' });
        return;
      }

      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      const result = mapping.room.handlePlayerShoot(mapping.playerId, payload);
      if (callback) callback(result);
    });

    // 9. Weapon Reload
    socket.on('player:reload', (callback?: (res: any) => void) => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) return;

      const player = mapping.room.state.players[mapping.playerId];
      if (!player) return;

      const result = CombatSystem.startReload(player);
      if (result.success) {
        io.to(mapping.room.state.code).emit('player:reloading', {
          playerId: player.id,
          reloadTimeMs: result.reloadTimeMs,
        });
      }
      if (callback) callback(result);
    });

    // 10. Switch Selected Weapon
    socket.on('player:switch_weapon', (data: { weapon: WeaponType }, callback?: (res: any) => void) => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (!mapping) return;

      const player = mapping.room.state.players[mapping.playerId];
      if (!player || !WEAPON_REGISTRY[data.weapon]) {
        if (callback) callback({ success: false, error: 'Invalid weapon' });
        return;
      }

      player.selectedWeapon = data.weapon;
      player.ammo = WEAPON_REGISTRY[data.weapon].magazineSize;
      player.isReloading = false;

      mapping.room.broadcastState();
      if (callback) callback({ success: true, weapon: data.weapon, ammo: player.ammo });
    });

    // 11. Ping / Latency Check
    socket.on('ping:check', (timestamp: number, callback?: (serverTime: number) => void) => {
      const serverTime = Date.now();
      if (callback) callback(serverTime);
      socket.emit('pong:check', { clientTimestamp: timestamp, serverTime });
    });

    // 12. Leave Room
    socket.on('room:leave', () => {
      const mapping = roomManager.getPlayerBySocket(socket.id);
      if (mapping) {
        socket.leave(mapping.room.state.code);
        mapping.room.removePlayer(mapping.playerId);
      }
    });

    // 13. Disconnect
    socket.on('disconnect', () => {
      rateLimitMap.delete(socket.id);
      roomManager.handleSocketDisconnect(socket.id);
    });
  });
}
