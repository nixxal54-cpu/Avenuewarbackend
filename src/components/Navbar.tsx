import React from 'react';
import {
  Shield,
  Activity,
  Copy,
  Check,
  Radio,
  Server,
  BookOpen,
  Crosshair,
  Users,
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'arena' | 'view3d' | 'inspector' | 'docs';
  setActiveTab: (tab: 'arena' | 'view3d' | 'inspector' | 'docs') => void;
  roomCode: string | null;
  isConnected: boolean;
  ping: number;
  matchState?: string;
  onLeaveRoom?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  roomCode,
  isConnected,
  ping,
  matchState,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="bg-neutral-950 border-b border-neutral-800 text-neutral-100 select-none sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-600 via-red-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-950/40 border border-amber-500/30">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-widest text-lg bg-gradient-to-r from-amber-400 via-neutral-100 to-amber-500 bg-clip-text text-transparent">
                AVENUEWAR
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                3v3 SERVER
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono">
              Authoritative 20Hz Tickrate • Node.js + Socket.IO
            </p>
          </div>
        </div>

        {/* Room Code Badge if in Room */}
        {roomCode && (
          <div className="hidden md:flex items-center gap-2 bg-neutral-900 border border-neutral-700/80 rounded-lg px-3 py-1.5 shadow-inner">
            <span className="text-xs text-neutral-400 font-mono uppercase">Room Code:</span>
            <span className="text-sm font-black tracking-wider text-amber-400 font-mono">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy Room Join Code"
              className="p-1 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {matchState && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ml-1 uppercase font-mono ${
                  matchState === 'IN_PROGRESS'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                    : matchState === 'STARTING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {matchState}
              </span>
            )}
            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="text-xs ml-2 px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/50 transition-colors"
              >
                Leave
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-neutral-900/90 p-1 rounded-lg border border-neutral-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('arena')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'arena'
                ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Lobby & 3v3</span>
          </button>
          <button
            onClick={() => setActiveTab('view3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'view3d'
                ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            <span>3D Arena</span>
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'inspector'
                ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Server Inspector</span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
              activeTab === 'docs'
                ? 'bg-neutral-800 text-white shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Docs & Bridge</span>
          </button>
        </nav>

        {/* Server Connection Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-neutral-300 font-mono">
              {isConnected ? `${ping}ms` : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
