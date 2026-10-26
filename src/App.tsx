import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Navbar } from './components/Navbar';
import { LobbyView } from './components/LobbyView';
import { Arena3DView } from './components/Arena3DView';
import { ServerInspector } from './components/ServerInspector';
import { DocsBridgeView } from './components/DocsBridgeView';
import {
  RoomState,
  Team,
  WeaponType,
  Vector3,
  ServerTickPayload,
} from './types';

interface AuditLogEntry {
  timestamp: number;
  event: string;
  data: any;
  type: 'info' | 'combat' | 'move' | 'room';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'arena' | 'view3d' | 'inspector' | 'docs'>('arena');
  const [isConnected, setIsConnected] = useState(false);
  const [ping, setPing] = useState(15);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>(() => {
    return localStorage.getItem('ave_player_id') || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  });
  const [sessionToken, setSessionToken] = useState<string>(() => {
    return localStorage.getItem('ave_session_token') || `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  });
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isSimulatingReconnect, setIsSimulatingReconnect] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const botSocketsRef = useRef<Socket[]>([]);

  // Persistent IDs
  useEffect(() => {
    localStorage.setItem('ave_player_id', localPlayerId);
    localStorage.setItem('ave_session_token', sessionToken);
  }, [localPlayerId, sessionToken]);

  const addLog = (event: string, data: any, type: 'info' | 'combat' | 'move' | 'room' = 'info') => {
    setLogs((prev) => [...prev.slice(-100), { timestamp: Date.now(), event, data, type }]);
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      addLog('connect', { socketId: socket.id }, 'info');
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      addLog('disconnect', { reason }, 'info');
    });

    socket.on('room:state', (state: RoomState) => {
      setRoomState(state);
      addLog('room:state', { code: state.code, matchState: state.matchState }, 'room');

      // Auto-switch to 3D View when match starts if on arena lobby
      if (state.matchState === 'IN_PROGRESS') {
        setActiveTab((prev) => (prev === 'arena' ? 'view3d' : prev));
      }
    });

    socket.on('room:created', (data) => {
      setRoomState(data.roomState);
      if (data.playerId) setLocalPlayerId(data.playerId);
      if (data.sessionToken) setSessionToken(data.sessionToken);
      addLog('room:created', data, 'room');
    });

    socket.on('room:joined', (data) => {
      setRoomState(data.roomState);
      if (data.playerId) setLocalPlayerId(data.playerId);
      if (data.sessionToken) setSessionToken(data.sessionToken);
      addLog('room:joined', data, 'room');
    });

    socket.on('room:reconnected', (data) => {
      setRoomState(data.roomState);
      addLog('room:reconnected', data, 'room');
    });

    socket.on('server:tick', (payload: ServerTickPayload) => {
      // Update player locations inside roomState without triggering full re-renders
      setRoomState((prev) => {
        if (!prev) return prev;
        const updatedPlayers = { ...prev.players };
        for (const p of payload.players) {
          if (updatedPlayers[p.id]) {
            updatedPlayers[p.id] = {
              ...updatedPlayers[p.id],
              position: p.position,
              velocity: p.velocity,
              rotationY: p.rotationY,
              pitch: p.pitch,
              health: p.health,
              armor: p.armor,
              isAlive: p.isAlive,
            };
          }
        }
        return { ...prev, players: updatedPlayers };
      });
    });

    socket.on('combat:hit', (data) => {
      addLog('combat:hit', data, 'combat');
    });

    socket.on('combat:elimination', (data) => {
      addLog('combat:elimination', data, 'combat');
    });

    socket.on('combat:shot_fired', (data) => {
      addLog('combat:shot_fired', { shooterId: data.shooterId, weapon: data.weapon }, 'combat');
    });

    socket.on('pong:check', ({ clientTimestamp }) => {
      const rtt = Math.max(1, Date.now() - clientTimestamp);
      setPing(rtt);
    });

    // Latency Ping Interval
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping:check', Date.now());
      }
    }, 3000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
      // Clean any bot sockets
      botSocketsRef.current.forEach((b) => b.disconnect());
    };
  }, []);

  // 1. Create Room
  const handleCreateRoom = (playerName: string, roomName: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:create',
      {
        playerName,
        roomName,
        playerId: localPlayerId,
        sessionToken,
      },
      (res: any) => {
        if (!res.success) {
          alert(res.error || 'Failed to create room');
        }
      }
    );
  };

  // 2. Join Room
  const handleJoinRoom = (roomCode: string, playerName: string, team?: Team) => {
    if (!socketRef.current) return;
    socketRef.current.emit(
      'room:join',
      {
        roomCode,
        playerName,
        team,
        playerId: localPlayerId,
        sessionToken,
      },
      (res: any) => {
        if (!res.success) {
          alert(res.error || 'Failed to join room');
        }
      }
    );
  };

  // 3. Toggle Ready
  const handleToggleReady = (isReady: boolean) => {
    if (!socketRef.current) return;
    socketRef.current.emit('player:ready', { isReady });
  };

  // 4. Change Team
  const handleChangeTeam = (newTeam: Team) => {
    if (!socketRef.current) return;
    socketRef.current.emit('team:change', { newTeam }, (res: any) => {
      if (!res.success) {
        alert(res.error || 'Failed to switch team');
      }
    });
  };

  // 5. Host Start Match
  const handleStartMatch = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('match:start', (res: any) => {
      if (!res.success) {
        alert(res.error || 'Failed to start match');
      }
    });
  };

  // 6. Send Movement (20Hz)
  const handleSendMovement = (
    pos: Vector3,
    vel: Vector3,
    rotY: number,
    pitch: number,
    seq: number
  ) => {
    if (!socketRef.current) return;
    socketRef.current.emit('player:move', {
      position: pos,
      velocity: vel,
      rotationY: rotY,
      pitch,
      sequence: seq,
      clientTime: Date.now(),
    });
  };

  // 7. Shoot Weapon
  const handleSendShoot = (
    weapon: WeaponType,
    origin: Vector3,
    dir: Vector3,
    targetId?: string
  ) => {
    if (!socketRef.current) return;
    socketRef.current.emit('player:shoot', {
      weapon,
      origin,
      direction: dir,
      targetPlayerId: targetId,
      clientTimestamp: Date.now(),
    });
  };

  // 8. Reload Weapon
  const handleSendReload = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('player:reload');
  };

  // 9. Switch Weapon
  const handleSwitchWeapon = (weapon: WeaponType) => {
    if (!socketRef.current) return;
    socketRef.current.emit('player:switch_weapon', { weapon });
  };

  // 10. Leave Room
  const handleLeaveRoom = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('room:leave');
    setRoomState(null);
    setActiveTab('arena');
    // Disconnect bots if any
    botSocketsRef.current.forEach((b) => b.disconnect());
    botSocketsRef.current = [];
  };

  // 11. Spawn 3v3 Bots to fill room
  const handleSpawnBots = () => {
    if (!roomState) return;
    const currentCount = Object.keys(roomState.players).length;
    const needed = Math.max(0, 6 - currentCount);

    if (needed === 0) {
      alert('Room is already full at 3v3 capacity (6 players).');
      return;
    }

    const botNames = ['Delta_Bot', 'Spectre_AI', 'Ranger_Bot', 'Ghost_AI', 'Valkyrie_Bot'];

    for (let i = 0; i < needed; i++) {
      const botSocket = io(window.location.origin, { transports: ['websocket'] });
      botSocketsRef.current.push(botSocket);

      botSocket.on('connect', () => {
        const botName = botNames[i % botNames.length];
        const botId = `bot_${Date.now()}_${i}`;
        const botToken = `tok_bot_${Date.now()}_${i}`;

        botSocket.emit(
          'room:join',
          {
            roomCode: roomState.code,
            playerName: botName,
            playerId: botId,
            sessionToken: botToken,
          },
          (res: any) => {
            if (res.success) {
              // Mark bot ready after 500ms
              setTimeout(() => {
                botSocket.emit('player:ready', { isReady: true });
              }, 400 + i * 200);
            }
          }
        );
      });
    }
  };

  // 12. Simulate Disconnect & Reconnect via Session Token
  const handleSimulateReconnect = () => {
    if (!socketRef.current || !roomState) return;
    setIsSimulatingReconnect(true);
    addLog('test:disconnect', { message: 'Intentionally closing socket to test grace period' }, 'info');

    socketRef.current.disconnect();

    setTimeout(() => {
      // Reconnect
      if (socketRef.current) {
        socketRef.current.connect();
        socketRef.current.once('connect', () => {
          addLog('test:reconnect', { sessionToken, roomCode: roomState.code }, 'info');
          socketRef.current?.emit('room:reconnect', { sessionToken }, (res: any) => {
            setIsSimulatingReconnect(false);
            if (res.success) {
              addLog('test:reconnected_ok', res, 'info');
            } else {
              alert(`Reconnect failed: ${res.error}`);
            }
          });
        });
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        roomCode={roomState?.code || null}
        isConnected={isConnected}
        ping={ping}
        matchState={roomState?.matchState}
        onLeaveRoom={roomState ? handleLeaveRoom : undefined}
      />

      {/* Main Content Areas */}
      <main className="flex-1">
        {activeTab === 'arena' && (
          <LobbyView
            roomState={roomState}
            localPlayerId={localPlayerId}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onToggleReady={handleToggleReady}
            onChangeTeam={handleChangeTeam}
            onStartMatch={handleStartMatch}
            onSpawnBots={handleSpawnBots}
            onSimulateReconnect={handleSimulateReconnect}
            isSimulatingReconnect={isSimulatingReconnect}
          />
        )}

        {activeTab === 'view3d' && (
          roomState ? (
            <Arena3DView
              roomState={roomState}
              localPlayerId={localPlayerId}
              onSendMovement={handleSendMovement}
              onSendShoot={handleSendShoot}
              onSendReload={handleSendReload}
              onSwitchWeapon={handleSwitchWeapon}
              onReturnToLobby={() => {
                if (roomState) {
                  setRoomState({ ...roomState, matchState: 'LOBBY' });
                }
                setActiveTab('arena');
              }}
            />
          ) : (
            <div className="max-w-md mx-auto py-20 text-center">
              <div className="text-amber-400 font-mono text-sm mb-2">No Active Room</div>
              <p className="text-xs text-neutral-400 mb-4">
                Please create or join a 3v3 room in the Lobby tab first before entering the 3D Avenue Arena.
              </p>
              <button
                onClick={() => setActiveTab('arena')}
                className="px-4 py-2 bg-amber-500 text-neutral-950 font-bold text-xs uppercase tracking-wider rounded"
              >
                Go to Lobby
              </button>
            </div>
          )
        )}

        {activeTab === 'inspector' && (
          <ServerInspector
            logs={logs}
            ping={ping}
            onClearLogs={() => setLogs([])}
            onJoinRoomByCode={(code) => {
              handleJoinRoom(code, 'Observer');
              setActiveTab('arena');
            }}
          />
        )}

        {activeTab === 'docs' && <DocsBridgeView />}
      </main>
    </div>
  );
}
