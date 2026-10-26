import {
  RoomState,
  PlayerState,
  Team,
  MatchState,
  WeaponType,
  Vector3,
  ClientMovementPayload,
  ClientShootPayload,
  KillFeedEntry,
  ServerTickPayload,
} from './types';
import { SERVER_CONFIG, WEAPON_REGISTRY } from './config';
import { MovementValidator } from './MovementValidator';
import { CombatSystem } from './CombatSystem';

export class Room {
  public state: RoomState;
  private tickInterval: NodeJS.Timeout | null = null;
  private matchTimerInterval: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private currentTick: number = 0;
  private onBroadcastTick: (roomCode: string, payload: ServerTickPayload) => void;
  private onBroadcastState: (roomCode: string, state: RoomState) => void;
  private onBroadcastEvent: (roomCode: string, event: string, data: any) => void;
  private onRoomEmpty: (roomCode: string) => void;

  constructor(
    code: string,
    name: string,
    hostPlayer: { id: string; socketId: string; name: string; sessionToken: string },
    callbacks: {
      onBroadcastTick: (roomCode: string, payload: ServerTickPayload) => void;
      onBroadcastState: (roomCode: string, state: RoomState) => void;
      onBroadcastEvent: (roomCode: string, event: string, data: any) => void;
      onRoomEmpty: (roomCode: string) => void;
    }
  ) {
    this.onBroadcastTick = callbacks.onBroadcastTick;
    this.onBroadcastState = callbacks.onBroadcastState;
    this.onBroadcastEvent = callbacks.onBroadcastEvent;
    this.onRoomEmpty = callbacks.onRoomEmpty;

    this.state = {
      code,
      name,
      hostId: hostPlayer.id,
      matchState: 'LOBBY',
      maxPlayers: SERVER_CONFIG.MAX_PLAYERS_PER_ROOM, // 6
      teamLimit: SERVER_CONFIG.PLAYERS_PER_TEAM, // 3
      scoreToWin: SERVER_CONFIG.SCORE_TO_WIN,
      scores: {
        ALPHA: 0,
        BRAVO: 0,
      },
      timeRemainingSeconds: SERVER_CONFIG.MATCH_DURATION_SECONDS,
      matchDurationSeconds: SERVER_CONFIG.MATCH_DURATION_SECONDS,
      countdownSeconds: SERVER_CONFIG.LOBBY_COUNTDOWN_SECONDS,
      winnerTeam: null,
      players: {},
      killFeed: [],
      createdAt: Date.now(),
    };

    // Add host as first player (Team ALPHA)
    this.addPlayer(hostPlayer.id, hostPlayer.socketId, hostPlayer.name, hostPlayer.sessionToken, true, 'ALPHA');
  }

  /**
   * Generates a default player state
   */
  private createInitialPlayerState(
    id: string,
    socketId: string,
    name: string,
    sessionToken: string,
    isHost: boolean,
    team: Team
  ): PlayerState {
    const spawnIndex = Object.values(this.state.players).filter((p) => p.team === team).length % 3;
    const spawnPoint = SERVER_CONFIG.SPAWNS[team][spawnIndex] || { x: 0, y: 1, z: 0 };

    return {
      id,
      socketId,
      sessionToken,
      name: name.trim().slice(0, 18) || `Operator_${id.slice(0, 4)}`,
      team,
      role: 'ASSAULT',
      isReady: isHost, // host ready by default
      isHost,
      isConnected: true,
      disconnectedAt: null,
      health: 100,
      maxHealth: 100,
      armor: 50,
      maxArmor: 50,
      isAlive: true,
      eliminations: 0,
      deaths: 0,
      damageDealt: 0,
      selectedWeapon: 'rifle',
      ammo: WEAPON_REGISTRY.rifle.magazineSize,
      isReloading: false,
      reloadStartTime: 0,
      lastShotTime: 0,
      position: { ...spawnPoint },
      velocity: { x: 0, y: 0, z: 0 },
      rotationY: team === 'ALPHA' ? 0 : Math.PI, // Face opponent side
      pitch: 0,
      lastSequence: 0,
      lastUpdateTimestamp: Date.now(),
      ping: 15,
    };
  }

  /**
   * Adds a player to the room with strict 6-player limit and team balancing
   */
  public addPlayer(
    id: string,
    socketId: string,
    name: string,
    sessionToken: string,
    isHost: boolean = false,
    requestedTeam?: Team
  ): { success: boolean; player?: PlayerState; error?: string } {
    const activePlayers = Object.values(this.state.players).filter(
      (p) => p.isConnected || (p.disconnectedAt && Date.now() - p.disconnectedAt < SERVER_CONFIG.RECONNECT_GRACE_PERIOD_MS)
    );

    if (activePlayers.length >= this.state.maxPlayers) {
      return { success: false, error: 'Room is full (maximum 6 players for 3v3)' };
    }

    if (this.state.matchState === 'IN_PROGRESS' || this.state.matchState === 'STARTING') {
      return { success: false, error: 'Match is already in progress' };
    }

    // Determine team
    let team: Team;
    const alphaCount = Object.values(this.state.players).filter((p) => p.team === 'ALPHA').length;
    const bravoCount = Object.values(this.state.players).filter((p) => p.team === 'BRAVO').length;

    if (requestedTeam === 'ALPHA' && alphaCount < this.state.teamLimit) {
      team = 'ALPHA';
    } else if (requestedTeam === 'BRAVO' && bravoCount < this.state.teamLimit) {
      team = 'BRAVO';
    } else {
      // Auto-balance to smaller team
      team = alphaCount <= bravoCount ? 'ALPHA' : 'BRAVO';
    }

    const player = this.createInitialPlayerState(id, socketId, name, sessionToken, isHost, team);
    this.state.players[id] = player;

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'player:joined', { player, roomCode: this.state.code });

    return { success: true, player };
  }

  /**
   * Reconnects a player using their persistent sessionToken
   */
  public handleReconnect(
    sessionToken: string,
    newSocketId: string
  ): { success: boolean; player?: PlayerState; error?: string } {
    const player = Object.values(this.state.players).find((p) => p.sessionToken === sessionToken);

    if (!player) {
      return { success: false, error: 'Session token not found in room' };
    }

    // Restore connection
    player.socketId = newSocketId;
    player.isConnected = true;
    player.disconnectedAt = null;

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'player:reconnected', {
      playerId: player.id,
      name: player.name,
      roomCode: this.state.code,
    });

    return { success: true, player };
  }

  /**
   * Changes player team with 3-player capacity limit
   */
  public changeTeam(playerId: string, newTeam: Team): { success: boolean; error?: string } {
    if (this.state.matchState !== 'LOBBY') {
      return { success: false, error: 'Teams cannot be changed during an active match' };
    }

    const player = this.state.players[playerId];
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    if (player.team === newTeam) {
      return { success: true };
    }

    const countOnNewTeam = Object.values(this.state.players).filter((p) => p.team === newTeam).length;
    if (countOnNewTeam >= this.state.teamLimit) {
      return { success: false, error: `Team ${newTeam} is full (max 3 players)` };
    }

    player.team = newTeam;
    // Update spawn position according to new team
    const spawnIndex = countOnNewTeam % 3;
    player.position = { ...SERVER_CONFIG.SPAWNS[newTeam][spawnIndex] };
    player.rotationY = newTeam === 'ALPHA' ? 0 : Math.PI;

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'team:updated', { playerId, newTeam });
    return { success: true };
  }

  /**
   * Toggles readiness
   */
  public setPlayerReady(playerId: string, isReady: boolean): { success: boolean; allReady: boolean } {
    const player = this.state.players[playerId];
    if (!player) return { success: false, allReady: false };

    player.isReady = isReady;

    const playersList = Object.values(this.state.players).filter((p) => p.isConnected);
    const alphaPlayers = playersList.filter((p) => p.team === 'ALPHA');
    const bravoPlayers = playersList.filter((p) => p.team === 'BRAVO');

    // Check if match can start
    const allReady =
      playersList.length >= 2 &&
      alphaPlayers.length > 0 &&
      bravoPlayers.length > 0 &&
      playersList.every((p) => p.isReady);

    this.broadcastState();

    if (allReady && this.state.matchState === 'LOBBY') {
      this.startCountdown();
    } else if (!allReady && this.state.matchState === 'STARTING') {
      this.cancelCountdown();
    }

    return { success: true, allReady };
  }

  /**
   * Starts pre-match countdown
   */
  public startCountdown(): void {
    if (this.state.matchState !== 'LOBBY') return;
    this.state.matchState = 'STARTING';
    this.state.countdownSeconds = SERVER_CONFIG.LOBBY_COUNTDOWN_SECONDS;

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'match:starting', {
      countdownSeconds: this.state.countdownSeconds,
    });

    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.state.countdownSeconds -= 1;
      this.onBroadcastEvent(this.state.code, 'countdown:tick', {
        seconds: this.state.countdownSeconds,
      });

      if (this.state.countdownSeconds <= 0) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.startMatch();
      }
    }, 1000);
  }

  /**
   * Cancels starting countdown
   */
  public cancelCountdown(): void {
    if (this.state.matchState !== 'STARTING') return;
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.state.matchState = 'LOBBY';
    this.state.countdownSeconds = SERVER_CONFIG.LOBBY_COUNTDOWN_SECONDS;
    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'match:cancelled', { reason: 'Player unreadied' });
  }

  /**
   * Starts the 3v3 match
   */
  public startMatch(): void {
    this.state.matchState = 'IN_PROGRESS';
    this.state.scores = { ALPHA: 0, BRAVO: 0 };
    this.state.timeRemainingSeconds = this.state.matchDurationSeconds;
    this.state.winnerTeam = null;
    this.state.killFeed = [];

    // Respawn all players at team spawns with full health & shields
    let alphaIndex = 0;
    let bravoIndex = 0;

    for (const player of Object.values(this.state.players)) {
      player.health = 100;
      player.armor = 50;
      player.isAlive = true;
      player.ammo = WEAPON_REGISTRY[player.selectedWeapon].magazineSize;
      player.isReloading = false;

      if (player.team === 'ALPHA') {
        player.position = { ...SERVER_CONFIG.SPAWNS.ALPHA[alphaIndex % 3] };
        player.rotationY = 0;
        alphaIndex++;
      } else {
        player.position = { ...SERVER_CONFIG.SPAWNS.BRAVO[bravoIndex % 3] };
        player.rotationY = Math.PI;
        bravoIndex++;
      }
    }

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'match:started', {
      timeRemaining: this.state.timeRemainingSeconds,
      scores: this.state.scores,
    });

    // Start 20Hz Tick Broadcast
    this.startTickLoop();

    // Start 1Hz Match Timer
    this.startMatchTimer();
  }

  /**
   * Ticks match duration
   */
  private startMatchTimer(): void {
    if (this.matchTimerInterval) clearInterval(this.matchTimerInterval);

    this.matchTimerInterval = setInterval(() => {
      if (this.state.matchState !== 'IN_PROGRESS') return;

      this.state.timeRemainingSeconds -= 1;

      if (this.state.timeRemainingSeconds <= 0) {
        this.endMatch('Time Expired');
      }
    }, 1000);
  }

  /**
   * Starts server authoritative tick loop (20Hz)
   */
  private startTickLoop(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);

    this.tickInterval = setInterval(() => {
      if (this.state.matchState !== 'IN_PROGRESS') return;

      this.currentTick++;
      const now = Date.now();

      // Check reloads for all players
      for (const player of Object.values(this.state.players)) {
        if (player.isReloading) {
          CombatSystem.finishReloadIfReady(player, now);
        }
      }

      // Build compact tick payload
      const payload: ServerTickPayload = {
        tickNumber: this.currentTick,
        serverTimestamp: now,
        players: Object.values(this.state.players).map((p) => ({
          id: p.id,
          position: p.position,
          velocity: p.velocity,
          rotationY: p.rotationY,
          pitch: p.pitch,
          health: p.health,
          armor: p.armor,
          isAlive: p.isAlive,
          lastSequence: p.lastSequence,
        })),
      };

      this.onBroadcastTick(this.state.code, payload);
    }, SERVER_CONFIG.TICK_INTERVAL_MS);
  }

  /**
   * Authoritative player movement handler
   */
  public handlePlayerMovement(playerId: string, payload: ClientMovementPayload): boolean {
    const player = this.state.players[playerId];
    if (!player || !player.isAlive || this.state.matchState !== 'IN_PROGRESS') {
      return false;
    }

    const validation = MovementValidator.validateMovement(
      player,
      payload.position,
      payload.velocity,
      payload.clientTime,
      payload.sequence
    );

    if (validation.valid) {
      player.position = validation.correctedPosition;
      player.velocity = payload.velocity;
      player.rotationY = payload.rotationY;
      player.pitch = payload.pitch;
      player.lastSequence = payload.sequence;
      player.lastUpdateTimestamp = Date.now();
      return true;
    } else {
      // Snapped to corrected position
      player.position = validation.correctedPosition;
      return false;
    }
  }

  /**
   * Authoritative shooting handler
   */
  public handlePlayerShoot(playerId: string, payload: ClientShootPayload): { success: boolean; reason?: string } {
    if (this.state.matchState !== 'IN_PROGRESS') {
      return { success: false, reason: 'Match not in progress' };
    }

    const shooter = this.state.players[playerId];
    if (!shooter || !shooter.isAlive) {
      return { success: false, reason: 'Shooter is not active' };
    }

    const now = Date.now();
    const canFire = CombatSystem.canFire(shooter, payload.weapon, now);
    if (!canFire.allowed) {
      return { success: false, reason: canFire.reason };
    }

    // Deduct ammo & update shoot timestamp
    shooter.ammo -= 1;
    shooter.lastShotTime = now;

    // Broadcast shot fired (for tracer and sound effects on all clients)
    this.onBroadcastEvent(this.state.code, 'combat:shot_fired', {
      shooterId: shooter.id,
      weapon: payload.weapon,
      origin: payload.origin,
      direction: payload.direction,
      ammoRemaining: shooter.ammo,
    });

    // If client designated a hit target, authoritatively test it
    if (payload.targetPlayerId) {
      const victim = this.state.players[payload.targetPlayerId];
      if (victim && victim.isAlive) {
        const hitResult = CombatSystem.processHit(
          shooter,
          victim,
          payload.weapon,
          payload.origin,
          payload.direction
        );

        if (hitResult.hit && hitResult.damage) {
          this.onBroadcastEvent(this.state.code, 'combat:hit', {
            shooterId: shooter.id,
            victimId: victim.id,
            damage: hitResult.damage,
            isHeadshot: hitResult.isHeadshot,
            victimHealth: victim.health,
            victimArmor: victim.armor,
          });

          if (hitResult.isElimination) {
            this.handleElimination(shooter, victim, payload.weapon, !!hitResult.isHeadshot);
          }
        }
      }
    }

    return { success: true };
  }

  /**
   * Processes player elimination & updates score
   */
  private handleElimination(
    killer: PlayerState,
    victim: PlayerState,
    weapon: WeaponType,
    isHeadshot: boolean
  ): void {
    // Add to score
    this.state.scores[killer.team] += 1;

    // Add kill feed entry
    const entry: KillFeedEntry = {
      id: `kill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      killerId: killer.id,
      killerName: killer.name,
      killerTeam: killer.team,
      victimId: victim.id,
      victimName: victim.name,
      victimTeam: victim.team,
      weapon,
      isHeadshot,
    };

    this.state.killFeed.unshift(entry);
    if (this.state.killFeed.length > 20) {
      this.state.killFeed.pop();
    }

    this.onBroadcastEvent(this.state.code, 'combat:elimination', {
      entry,
      scores: this.state.scores,
    });

    // Check win condition
    if (this.state.scores[killer.team] >= this.state.scoreToWin) {
      this.endMatch(`Team ${killer.team} reached ${this.state.scoreToWin} eliminations!`);
      return;
    }

    // Schedule respawn after delay
    setTimeout(() => {
      this.respawnPlayer(victim.id);
    }, SERVER_CONFIG.RESPAWN_DELAY_SECONDS * 1000);
  }

  /**
   * Respawns eliminated player
   */
  public respawnPlayer(playerId: string): void {
    const player = this.state.players[playerId];
    if (!player || player.isAlive || this.state.matchState !== 'IN_PROGRESS') return;

    player.health = 100;
    player.armor = 50;
    player.isAlive = true;
    player.ammo = WEAPON_REGISTRY[player.selectedWeapon].magazineSize;
    player.isReloading = false;

    // Spawn at designated team spawn
    const teamSpawns = SERVER_CONFIG.SPAWNS[player.team];
    const randomSpawn = teamSpawns[Math.floor(Math.random() * teamSpawns.length)];
    player.position = { ...randomSpawn };
    player.rotationY = player.team === 'ALPHA' ? 0 : Math.PI;

    this.onBroadcastEvent(this.state.code, 'player:respawned', {
      player,
    });
  }

  /**
   * Ends match and determines winner
   */
  public endMatch(reason: string): void {
    if (this.state.matchState === 'ENDED') return;
    this.state.matchState = 'ENDED';

    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.matchTimerInterval) clearInterval(this.matchTimerInterval);
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    if (this.state.scores.ALPHA > this.state.scores.BRAVO) {
      this.state.winnerTeam = 'ALPHA';
    } else if (this.state.scores.BRAVO > this.state.scores.ALPHA) {
      this.state.winnerTeam = 'BRAVO';
    } else {
      this.state.winnerTeam = 'DRAW';
    }

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'match:ended', {
      winnerTeam: this.state.winnerTeam,
      scores: this.state.scores,
      reason,
      killFeed: this.state.killFeed,
    });
  }

  /**
   * Handles player disconnect (marks disconnected, sets grace period)
   */
  public handleDisconnect(playerId: string): void {
    const player = this.state.players[playerId];
    if (!player) return;

    player.isConnected = false;
    player.disconnectedAt = Date.now();

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'player:disconnected', {
      playerId,
      name: player.name,
      gracePeriodMs: SERVER_CONFIG.RECONNECT_GRACE_PERIOD_MS,
    });

    // Schedule cleanup after grace period if not reconnected
    setTimeout(() => {
      if (player && !player.isConnected) {
        this.removePlayer(playerId);
      }
    }, SERVER_CONFIG.RECONNECT_GRACE_PERIOD_MS);
  }

  /**
   * Removes player permanently
   */
  public removePlayer(playerId: string): void {
    const player = this.state.players[playerId];
    if (!player) return;

    const wasHost = player.isHost;
    delete this.state.players[playerId];

    const remainingPlayers = Object.values(this.state.players);
    if (remainingPlayers.length === 0) {
      this.cleanup();
      this.onRoomEmpty(this.state.code);
      return;
    }

    // Transfer host privilege if needed
    if (wasHost && remainingPlayers.length > 0) {
      const nextHost = remainingPlayers.find((p) => p.isConnected) || remainingPlayers[0];
      nextHost.isHost = true;
      this.state.hostId = nextHost.id;
      this.onBroadcastEvent(this.state.code, 'room:host_transferred', { newHostId: nextHost.id });
    }

    this.broadcastState();
    this.onBroadcastEvent(this.state.code, 'player:left', { playerId, roomCode: this.state.code });
  }

  /**
   * Broadcasts complete room state
   */
  public broadcastState(): void {
    this.onBroadcastState(this.state.code, this.state);
  }

  /**
   * Full teardown of intervals
   */
  public cleanup(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.matchTimerInterval) clearInterval(this.matchTimerInterval);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }
}
