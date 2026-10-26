import React, { useState } from 'react';
import {
  Users,
  Shield,
  Swords,
  Copy,
  Check,
  Bot,
  RefreshCw,
  Play,
  UserCheck,
  AlertCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { RoomState, Team, PlayerState } from '../types';

interface LobbyViewProps {
  roomState: RoomState | null;
  localPlayerId: string;
  onCreateRoom: (playerName: string, roomName: string) => void;
  onJoinRoom: (roomCode: string, playerName: string, team?: Team) => void;
  onToggleReady: (ready: boolean) => void;
  onChangeTeam: (team: Team) => void;
  onStartMatch: () => void;
  onSpawnBots: () => void;
  onSimulateReconnect: () => void;
  isSimulatingReconnect: boolean;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomState,
  localPlayerId,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onChangeTeam,
  onStartMatch,
  onSpawnBots,
  onSimulateReconnect,
  isSimulatingReconnect,
}) => {
  const [createName, setCreateName] = useState('Ghost');
  const [roomTitle, setRoomTitle] = useState('Avenue Skirmish 3v3');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('Spectre');
  const [joinTeam, setJoinTeam] = useState<Team>('BRAVO');
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const localPlayer = roomState?.players[localPlayerId];
  const isHost = localPlayer?.isHost;

  const handleCopy = () => {
    if (!roomState?.code) return;
    navigator.clipboard.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If NOT in a room, display Create / Join room screen
  if (!roomState) {
    return (
      <div className="max-w-5xl mx-auto py-10 px-4">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-4">
            <Shield className="w-3.5 h-3.5" />
            AUTHORITATIVE 3V3 MULTIPLAYER SERVER
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
            AVENUEWAR <span className="text-amber-500">TACTICAL ARENA</span>
          </h1>
          <p className="text-neutral-400 max-w-2xl mx-auto mt-3 text-sm md:text-base">
            Private 3v3 matches with authoritative server-side movement validation, anti-speedhack
            physics, line-of-sight shooting, 20Hz tick synchronizations, and seamless reconnection
            handling.
          </p>
        </div>

        {/* 2 Column Panels: Create Room & Join Room */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Create Room Panel */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">HOST PRIVATE 3V3 ROOM</h2>
                <p className="text-xs text-neutral-400">Generate a unique join code and configure teams</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onCreateRoom(createName, roomTitle);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase">
                  Your Call-sign / Nickname
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={18}
                  required
                  placeholder="e.g. Ghost, Viper, Phantom"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase">
                  Room Name
                </label>
                <input
                  type="text"
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  maxLength={30}
                  required
                  placeholder="e.g. Downtown Sector 4"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-neutral-950 font-bold py-3 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Create 3v3 Room
                </button>
              </div>
            </form>
          </div>

          {/* Join Room Panel */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide">JOIN EXISTING 3V3 ROOM</h2>
                <p className="text-xs text-neutral-400">Enter join code and choose your starting squad</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!joinCode) {
                  setActionError('Please enter a room code');
                  return;
                }
                onJoinRoom(joinCode, joinName, joinTeam);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase">
                  Room Join Code
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. AVE-829"
                  maxLength={10}
                  required
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-amber-400 font-mono tracking-widest uppercase placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase">
                  Your Call-sign
                </label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  maxLength={18}
                  required
                  placeholder="e.g. Spectre"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase">
                  Squad Choice
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJoinTeam('ALPHA')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      joinTeam === 'ALPHA'
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/30'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    TEAM ALPHA (Blue)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinTeam('BRAVO')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      joinTeam === 'BRAVO'
                        ? 'bg-red-600/30 border-red-500 text-red-300 shadow-sm shadow-red-500/30'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    TEAM BRAVO (Red)
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-lg p-4 text-center">
            <div className="text-2xl font-black text-amber-400 font-mono">3 vs 3</div>
            <div className="text-xs text-neutral-400 mt-1">Strict 6-Player Limit</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-lg p-4 text-center">
            <div className="text-2xl font-black text-emerald-400 font-mono">20 Hz</div>
            <div className="text-xs text-neutral-400 mt-1">Authoritative Tickrate</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-lg p-4 text-center">
            <div className="text-2xl font-black text-blue-400 font-mono">30s</div>
            <div className="text-xs text-neutral-400 mt-1">Reconnect Grace Window</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-lg p-4 text-center">
            <div className="text-2xl font-black text-red-400 font-mono">Anti-Cheat</div>
            <div className="text-xs text-neutral-400 mt-1">Speedhack & LOS Validation</div>
          </div>
        </div>
      </div>
    );
  }

  // Inside Active Room
  const playersList = Object.values(roomState.players);
  const alphaPlayers = playersList.filter((p) => p.team === 'ALPHA');
  const bravoPlayers = playersList.filter((p) => p.team === 'BRAVO');

  const canStartMatch =
    isHost &&
    roomState.matchState === 'LOBBY' &&
    playersList.length >= 2 &&
    alphaPlayers.length > 0 &&
    bravoPlayers.length > 0;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Top Banner / Room Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-wide uppercase">
              {roomState.name}
            </h1>
            <span
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded uppercase ${
                roomState.matchState === 'IN_PROGRESS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : roomState.matchState === 'STARTING'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-300'
              }`}
            >
              Status: {roomState.matchState}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            {playersList.length} / {roomState.maxPlayers} Players in Room • First to {roomState.scoreToWin} eliminations wins
          </p>
        </div>

        {/* Join Code Box */}
        <div className="flex items-center gap-3 bg-neutral-950 border border-neutral-700 px-4 py-2 rounded-lg">
          <div>
            <div className="text-[10px] text-neutral-400 uppercase font-mono">Private Join Code</div>
            <div className="text-lg font-black tracking-widest text-amber-400 font-mono">
              {roomState.code}
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors cursor-pointer"
            title="Copy join code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Countdown Alert Banner */}
      {roomState.matchState === 'STARTING' && (
        <div className="bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-amber-600/30 border border-amber-500/40 rounded-xl p-4 mb-6 text-center animate-pulse">
          <div className="text-amber-400 font-bold text-lg">
            MATCH STARTING IN {roomState.countdownSeconds} SECONDS!
          </div>
          <p className="text-xs text-neutral-300 mt-1">Preparing tactical arena positions...</p>
        </div>
      )}

      {/* 3v3 Squad Rosters */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* TEAM ALPHA (BLUE) */}
        <div className="bg-neutral-900/90 border border-blue-900/60 rounded-xl p-5 shadow-xl relative">
          <div className="flex items-center justify-between mb-4 border-b border-blue-900/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-400" />
              <h2 className="text-lg font-black text-blue-400 tracking-wider">TEAM ALPHA</h2>
              <span className="text-xs font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                {alphaPlayers.length} / 3
              </span>
            </div>
            {localPlayer && localPlayer.team !== 'ALPHA' && alphaPlayers.length < 3 && (
              <button
                onClick={() => onChangeTeam('ALPHA')}
                className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors cursor-pointer"
              >
                Switch to Alpha
              </button>
            )}
          </div>

          {/* Slots 1..3 */}
          <div className="space-y-3">
            {[0, 1, 2].map((index) => {
              const player = alphaPlayers[index];
              if (!player) {
                return (
                  <div
                    key={`alpha_empty_${index}`}
                    className="border border-dashed border-neutral-800 rounded-lg p-3.5 text-center text-xs text-neutral-500 font-mono"
                  >
                    Open Squad Slot #{index + 1}
                  </div>
                );
              }
              return (
                <div
                  key={player.id}
                  className={`border rounded-lg p-3.5 flex items-center justify-between transition-all ${
                    player.id === localPlayerId
                      ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-900/20'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center font-bold text-blue-300 text-xs">
                      A{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{player.name}</span>
                        {player.isHost && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            HOST
                          </span>
                        )}
                        {player.id === localPlayerId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-200">
                            YOU
                          </span>
                        )}
                        {!player.isConnected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            DISCONNECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>Loadout: {player.selectedWeapon.toUpperCase()}</span>
                        <span>•</span>
                        <span>{player.ping}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Ready State */}
                  <div>
                    {player.isReady ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2.5 py-1 rounded">
                        <Check className="w-3 h-3" /> READY
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* TEAM BRAVO (RED) */}
        <div className="bg-neutral-900/90 border border-red-900/60 rounded-xl p-5 shadow-xl relative">
          <div className="flex items-center justify-between mb-4 border-b border-red-900/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-400" />
              <h2 className="text-lg font-black text-red-400 tracking-wider">TEAM BRAVO</h2>
              <span className="text-xs font-mono bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800">
                {bravoPlayers.length} / 3
              </span>
            </div>
            {localPlayer && localPlayer.team !== 'BRAVO' && bravoPlayers.length < 3 && (
              <button
                onClick={() => onChangeTeam('BRAVO')}
                className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors cursor-pointer"
              >
                Switch to Bravo
              </button>
            )}
          </div>

          {/* Slots 1..3 */}
          <div className="space-y-3">
            {[0, 1, 2].map((index) => {
              const player = bravoPlayers[index];
              if (!player) {
                return (
                  <div
                    key={`bravo_empty_${index}`}
                    className="border border-dashed border-neutral-800 rounded-lg p-3.5 text-center text-xs text-neutral-500 font-mono"
                  >
                    Open Squad Slot #{index + 1}
                  </div>
                );
              }
              return (
                <div
                  key={player.id}
                  className={`border rounded-lg p-3.5 flex items-center justify-between transition-all ${
                    player.id === localPlayerId
                      ? 'bg-red-950/40 border-red-500/80 shadow-md shadow-red-900/20'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-red-500/20 border border-red-500/40 flex items-center justify-center font-bold text-red-300 text-xs">
                      B{index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{player.name}</span>
                        {player.isHost && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            HOST
                          </span>
                        )}
                        {player.id === localPlayerId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/30 text-red-200">
                            YOU
                          </span>
                        )}
                        {!player.isConnected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            DISCONNECTED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>Loadout: {player.selectedWeapon.toUpperCase()}</span>
                        <span>•</span>
                        <span>{player.ping}ms</span>
                      </div>
                    </div>
                  </div>

                  {/* Ready State */}
                  <div>
                    {player.isReady ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-600/40 px-2.5 py-1 rounded">
                        <Check className="w-3 h-3" /> READY
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-neutral-500 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lobby Action Controls & Testing Tools */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Ready Button */}
            {localPlayer && (
              <button
                onClick={() => onToggleReady(!localPlayer.isReady)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  localPlayer.isReady
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                {localPlayer.isReady ? 'Unready' : 'Ready Up'}
              </button>
            )}

            {/* Host Start Button */}
            {isHost && (
              <button
                onClick={onStartMatch}
                disabled={!canStartMatch}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
                  canStartMatch
                    ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/30'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                Start Match
              </button>
            )}

            {!isHost && (
              <span className="text-xs text-neutral-400 font-mono">
                Waiting for room host to initiate the countdown...
              </span>
            )}
          </div>

          {/* Developer Testing Tools */}
          <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-neutral-800 pt-3 md:pt-0 md:pl-4">
            {/* 3v3 Bot Fill Button */}
            {playersList.length < 6 && (
              <button
                onClick={onSpawnBots}
                className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-cyan-300 border border-cyan-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Spawns real simulated socket clients to fill remaining slots to 3v3"
              >
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                Fill 3v3 with Bots
              </button>
            )}

            {/* Disconnect & Reconnect Test */}
            <button
              onClick={onSimulateReconnect}
              disabled={isSimulatingReconnect}
              className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-amber-300 border border-amber-800/60 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Tests session token recovery by momentarily dropping socket"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  isSimulatingReconnect ? 'animate-spin' : ''
                }`}
              />
              Test Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
