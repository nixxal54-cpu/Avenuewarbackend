export type Team = 'ALPHA' | 'BRAVO';
export type MatchState = 'LOBBY' | 'STARTING' | 'IN_PROGRESS' | 'ENDED';
export type PlayerRole = 'ASSAULT' | 'SNIPER' | 'SUPPORT' | 'SCOUT';
export type WeaponType = 'rifle' | 'shotgun' | 'sniper' | 'smg' | 'pistol';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  socketId: string;
  sessionToken: string;
  name: string;
  team: Team;
  role: PlayerRole;
  isReady: boolean;
  isHost: boolean;
  isConnected: boolean;
  disconnectedAt: number | null;
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  isAlive: boolean;
  eliminations: number;
  deaths: number;
  damageDealt: number;
  selectedWeapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  reloadStartTime: number;
  lastShotTime: number;
  position: Vector3;
  velocity: Vector3;
  rotationY: number;
  pitch: number;
  lastSequence: number;
  lastUpdateTimestamp: number;
  ping: number;
}

export interface KillFeedEntry {
  id: string;
  timestamp: number;
  killerId: string;
  killerName: string;
  killerTeam: Team;
  victimId: string;
  victimName: string;
  victimTeam: Team;
  weapon: WeaponType;
  isHeadshot: boolean;
}

export interface MatchScores {
  ALPHA: number;
  BRAVO: number;
}

export interface RoomState {
  code: string;
  name: string;
  hostId: string;
  matchState: MatchState;
  maxPlayers: number;
  teamLimit: number;
  scoreToWin: number;
  scores: MatchScores;
  timeRemainingSeconds: number;
  matchDurationSeconds: number;
  countdownSeconds: number;
  winnerTeam: Team | 'DRAW' | null;
  players: Record<string, PlayerState>;
  killFeed: KillFeedEntry[];
  createdAt: number;
}

export interface ServerTickPayload {
  tickNumber: number;
  serverTimestamp: number;
  players: Array<{
    id: string;
    position: Vector3;
    velocity: Vector3;
    rotationY: number;
    pitch: number;
    health: number;
    armor: number;
    isAlive: boolean;
    lastSequence: number;
  }>;
}
