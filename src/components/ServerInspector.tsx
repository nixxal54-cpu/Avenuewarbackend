import React, { useEffect, useState } from 'react';
import {
  Server,
  Activity,
  Shield,
  Zap,
  Terminal,
  RefreshCw,
  Users,
  Crosshair,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ServerInspectorProps {
  logs: Array<{ timestamp: number; event: string; data: any; type: 'info' | 'combat' | 'move' | 'room' }>;
  ping: number;
  onClearLogs: () => void;
  onJoinRoomByCode: (code: string) => void;
}

export const ServerInspector: React.FC<ServerInspectorProps> = ({
  logs,
  ping,
  onClearLogs,
  onJoinRoomByCode,
}) => {
  const [filter, setFilter] = useState<'all' | 'combat' | 'move' | 'room'>('all');
  const [healthData, setHealthData] = useState<any>(null);
  const [roomsData, setRoomsData] = useState<any[]>([]);
  const [configData, setConfigData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchServerAPIs = async () => {
    setIsRefreshing(true);
    try {
      const [hRes, rRes, cRes] = await Promise.all([
        fetch('/health').then((r) => r.json()).catch(() => null),
        fetch('/api/rooms').then((r) => r.json()).catch(() => ({ rooms: [] })),
        fetch('/api/config').then((r) => r.json()).catch(() => null),
      ]);
      if (hRes) setHealthData(hRes);
      if (rRes?.rooms) setRoomsData(rRes.rooms);
      if (cRes) setConfigData(cRes);
    } catch (err) {
      console.error('Error fetching server info', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServerAPIs();
    const interval = setInterval(fetchServerAPIs, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((l) => (filter === 'all' ? true : l.type === filter));

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono mb-2">
            <Activity className="w-3.5 h-3.5" />
            LIVE TELEMETRY & DIAGNOSTICS
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">
            SERVER INSPECTOR & METRICS
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Real-time authoritative socket packets, active 3v3 rooms, and combat validation engine.
          </p>
        </div>

        <button
          onClick={fetchServerAPIs}
          disabled={isRefreshing}
          className="px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 border border-neutral-700 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>SERVER TICKRATE</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {healthData?.tickRateHz || 20} <span className="text-xs text-neutral-500">Hz</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">Fixed 50ms interval</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>SOCKET LATENCY</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {ping} <span className="text-xs text-neutral-500">ms</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono mt-1">WebSocket RTT Ping</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>ACTIVE 3V3 ROOMS</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {roomsData.length}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">Max 50 concurrent rooms</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-neutral-400 text-xs font-mono">
            <span>UPTIME</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-2">
            {healthData ? Math.floor(healthData.uptime) : 0} <span className="text-xs text-neutral-500">sec</span>
          </div>
          <div className="text-[11px] text-neutral-400 font-mono mt-1">Node.js Express daemon</div>
        </div>
      </div>

      {/* 2 Column: Active Rooms List & Authoritative Weapon Config */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Active Rooms */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Active 3v3 Rooms ({roomsData.length})
            </h2>
            <span className="text-[10px] text-neutral-400 font-mono">REST: /api/rooms</span>
          </div>

          {roomsData.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500 font-mono">
              No active rooms currently open. Create a room in the Lobby tab!
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {roomsData.map((room) => (
                <div
                  key={room.code}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{room.name}</span>
                      <span className="text-xs font-mono font-bold text-amber-400 px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700">
                        {room.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-1 flex items-center gap-2">
                      <span className="text-blue-400">Alpha: {room.alphaCount}/3</span>
                      <span>•</span>
                      <span className="text-red-400">Bravo: {room.bravoCount}/3</span>
                      <span>•</span>
                      <span className="uppercase text-neutral-300">{room.matchState}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onJoinRoomByCode(room.code)}
                    className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-mono text-cyan-300 border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Authoritative Weapon Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-red-400" />
              Authoritative Weapon Specs
            </h2>
            <span className="text-[10px] text-neutral-400 font-mono">REST: /api/config</span>
          </div>

          {configData?.weapons ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 text-[10px] uppercase">
                    <th className="pb-2">Weapon</th>
                    <th className="pb-2">Damage</th>
                    <th className="pb-2">HS Mult</th>
                    <th className="pb-2">RPM / Rate</th>
                    <th className="pb-2">Range</th>
                    <th className="pb-2">Mag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {Object.values(configData.weapons).map((w: any) => (
                    <tr key={w.id} className="hover:bg-neutral-950/50">
                      <td className="py-2 font-bold text-white uppercase">{w.id}</td>
                      <td className="py-2 text-amber-400 font-bold">{w.damage}</td>
                      <td className="py-2">{w.headshotMultiplier}x</td>
                      <td className="py-2">{w.fireRateMs}ms</td>
                      <td className="py-2">{w.maxRange}m</td>
                      <td className="py-2 text-cyan-400">{w.magazineSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-neutral-500 font-mono">
              Loading weapon configuration from server...
            </div>
          )}
        </div>
      </div>

      {/* Real-time Socket Event Audit Log */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Socket Event Stream ({filteredLogs.length})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Pills */}
            <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-[11px] font-mono">
              {(['all', 'combat', 'room', 'move'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-2.5 py-0.5 rounded capitalize transition-colors ${
                    filter === t
                      ? 'bg-neutral-800 text-white font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <button
              onClick={onClearLogs}
              className="text-[11px] font-mono px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Log Viewer Container */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto space-y-1.5">
          {filteredLogs.length === 0 ? (
            <div className="text-neutral-500 text-center py-6">No socket events captured yet.</div>
          ) : (
            filteredLogs.slice(-40).map((l, i) => (
              <div key={i} className="flex items-start gap-2 hover:bg-neutral-900/60 p-1 rounded">
                <span className="text-neutral-500 text-[10px]">
                  {new Date(l.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`px-1.5 rounded text-[10px] uppercase font-bold ${
                    l.type === 'combat'
                      ? 'bg-red-950/80 text-red-300 border border-red-800/50'
                      : l.type === 'room'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50'
                      : l.type === 'move'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800/50'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {l.event}
                </span>
                <span className="text-neutral-300 text-[11px] truncate flex-1">
                  {JSON.stringify(l.data)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
