import { WeaponStats, WeaponType, Vector3 } from './types';

export const SERVER_CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  MAX_ROOMS: 50,
  MAX_PLAYERS_PER_ROOM: 6, // 3v3 maximum
  PLAYERS_PER_TEAM: 3,
  MATCH_DURATION_SECONDS: 300, // 5 minutes
  SCORE_TO_WIN: 20, // 20 eliminations to win
  LOBBY_COUNTDOWN_SECONDS: 5,
  RESPAWN_DELAY_SECONDS: 4,
  RECONNECT_GRACE_PERIOD_MS: 30000, // 30 seconds
  TICK_RATE_HZ: 20, // 20 updates per second
  TICK_INTERVAL_MS: 1000 / 20, // 50ms
  RATE_LIMIT_ACTIONS_PER_SEC: 35, // max actions per socket
  
  // Arena geometry limits (Avenue tactical urban map)
  ARENA: {
    MIN_X: -50,
    MAX_X: 50,
    MIN_Z: -75,
    MAX_Z: 75,
    MIN_Y: 0,
    MAX_Y: 15,
  },

  // Authoritative movement limits
  MOVEMENT: {
    MAX_SPEED_UNITS_PER_SEC: 14.0, // standard sprint speed
    SPEED_TOLERANCE_MULTIPLIER: 1.35, // allows lag spikes / packet burst
    TELEPORT_THRESHOLD: 25.0, // immediately flagged as invalid jump
  },

  // Team Spawn points along Avenue
  SPAWNS: {
    ALPHA: [
      { x: -15, y: 1, z: -55 },
      { x: 0, y: 1, z: -58 },
      { x: 15, y: 1, z: -55 },
    ] as Vector3[],
    BRAVO: [
      { x: -15, y: 1, z: 55 },
      { x: 0, y: 1, z: 58 },
      { x: 15, y: 1, z: 55 },
    ] as Vector3[],
  },
};

export const WEAPON_REGISTRY: Record<WeaponType, WeaponStats> = {
  rifle: {
    id: 'rifle',
    name: 'M4A1 Avenue Carbine',
    damage: 28,
    headshotMultiplier: 2.0,
    fireRateMs: 110, // ~545 RPM
    maxRange: 90,
    spreadAngle: 0.04,
    magazineSize: 30,
    reloadTimeMs: 2200,
  },
  smg: {
    id: 'smg',
    name: 'Vector Tactical 9mm',
    damage: 19,
    headshotMultiplier: 1.75,
    fireRateMs: 70, // ~850 RPM
    maxRange: 45,
    spreadAngle: 0.07,
    magazineSize: 33,
    reloadTimeMs: 1800,
  },
  shotgun: {
    id: 'shotgun',
    name: 'SPAS-12 Avenue Breacher',
    damage: 85, // close-quarter devastating
    headshotMultiplier: 1.5,
    fireRateMs: 750,
    maxRange: 25,
    spreadAngle: 0.12,
    magazineSize: 8,
    reloadTimeMs: 2800,
  },
  sniper: {
    id: 'sniper',
    name: 'AWM .338 Magnum',
    damage: 95,
    headshotMultiplier: 2.5, // 1-shot headshot
    fireRateMs: 1200,
    maxRange: 140,
    spreadAngle: 0.01,
    magazineSize: 5,
    reloadTimeMs: 3200,
  },
  pistol: {
    id: 'pistol',
    name: 'USP-S Tactical Sidearm',
    damage: 24,
    headshotMultiplier: 2.0,
    fireRateMs: 220,
    maxRange: 50,
    spreadAngle: 0.03,
    magazineSize: 15,
    reloadTimeMs: 1400,
  },
};
