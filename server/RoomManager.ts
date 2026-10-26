import { Server, Socket } from 'socket.io';
import { Room } from './Room';
import { RoomState, ServerTickPayload } from './types';
import { SERVER_CONFIG } from './config';

export class RoomManager {
  private io: Server;
  private rooms: Map<string, Room> = new Map();
  // Maps socket.id to { roomCode, playerId }
  private socketMap: Map<string, { roomCode: string; playerId: string }> = new Map();
  // Maps sessionToken to { roomCode, playerId } for reconnection
  private sessionMap: Map<string, { roomCode: string; playerId: string }> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Generates a unique 6-character clean room code like AVE-729
   */
  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    let attempts = 0;

    do {
      const partA = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const partB = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      code = `${partA}-${partB}`;
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);

    return code;
  }

  /**
   * Creates a new private 3v3 room
   */
  public createRoom(
    hostPlayer: { id: string; socketId: string; name: string; sessionToken: string },
    roomName?: string
  ): { success: boolean; room?: Room; error?: string } {
    if (this.rooms.size >= SERVER_CONFIG.MAX_ROOMS) {
      return { success: false, error: 'Maximum server room limit reached. Please try later.' };
    }

    const code = this.generateRoomCode();
    const finalRoomName = roomName?.trim().slice(0, 30) || `Avenue 3v3 #${code.slice(0, 3)}`;

    const room = new Room(code, finalRoomName, hostPlayer, {
      onBroadcastTick: (roomCode: string, payload: ServerTickPayload) => {
        this.io.to(roomCode).emit('server:tick', payload);
      },
      onBroadcastState: (roomCode: string, state: RoomState) => {
        this.io.to(roomCode).emit('room:state', state);
      },
      onBroadcastEvent: (roomCode: string, event: string, data: any) => {
        this.io.to(roomCode).emit(event, data);
      },
      onRoomEmpty: (roomCode: string) => {
        this.destroyRoom(roomCode);
      },
    });

    this.rooms.set(code, room);
    this.socketMap.set(hostPlayer.socketId, { roomCode: code, playerId: hostPlayer.id });
    this.sessionMap.set(hostPlayer.sessionToken, { roomCode: code, playerId: hostPlayer.id });

    return { success: true, room };
  }

  /**
   * Finds a room by code (case insensitive, strips dashes)
   */
  public getRoom(code: string): Room | undefined {
    const cleanCode = code.trim().toUpperCase();
    if (this.rooms.has(cleanCode)) return this.rooms.get(cleanCode);

    // Also match without hyphens
    for (const [key, room] of this.rooms.entries()) {
      if (key.replace('-', '') === cleanCode.replace('-', '')) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Links a socket and session to a room
   */
  public registerPlayerSocket(socketId: string, sessionToken: string, roomCode: string, playerId: string): void {
    this.socketMap.set(socketId, { roomCode, playerId });
    this.sessionMap.set(sessionToken, { roomCode, playerId });
  }

  /**
   * Retrieves player and room info by socketId
   */
  public getPlayerBySocket(socketId: string): { room: Room; playerId: string } | undefined {
    const mapping = this.socketMap.get(socketId);
    if (!mapping) return undefined;

    const room = this.rooms.get(mapping.roomCode);
    if (!room) return undefined;

    return { room, playerId: mapping.playerId };
  }

  /**
   * Retrieves player and room info by sessionToken for reconnection
   */
  public getPlayerBySession(sessionToken: string): { room: Room; playerId: string } | undefined {
    const mapping = this.sessionMap.get(sessionToken);
    if (!mapping) return undefined;

    const room = this.rooms.get(mapping.roomCode);
    if (!room) return undefined;

    return { room, playerId: mapping.playerId };
  }

  /**
   * Handles socket disconnect
   */
  public handleSocketDisconnect(socketId: string): void {
    const mapping = this.socketMap.get(socketId);
    if (!mapping) return;

    this.socketMap.delete(socketId);
    const room = this.rooms.get(mapping.roomCode);
    if (room) {
      room.handleDisconnect(mapping.playerId);
    }
  }

  /**
   * Destroys room and removes all sessions
   */
  public destroyRoom(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;

    room.cleanup();
    this.rooms.delete(code);

    // Remove socket and session mappings
    for (const [socketId, mapping] of this.socketMap.entries()) {
      if (mapping.roomCode === code) {
        this.socketMap.delete(socketId);
      }
    }
    for (const [sessionToken, mapping] of this.sessionMap.entries()) {
      if (mapping.roomCode === code) {
        this.sessionMap.delete(sessionToken);
      }
    }
  }

  /**
   * Gets list of active rooms for dashboard / matchmaking preview
   */
  public getRoomSummaries(): Array<{
    code: string;
    name: string;
    matchState: string;
    playerCount: number;
    maxPlayers: number;
    alphaCount: number;
    bravoCount: number;
    timeRemaining: number;
    scores: { ALPHA: number; BRAVO: number };
  }> {
    const list: Array<any> = [];
    for (const [code, room] of this.rooms.entries()) {
      const players = Object.values(room.state.players).filter((p) => p.isConnected);
      const alphaCount = players.filter((p) => p.team === 'ALPHA').length;
      const bravoCount = players.filter((p) => p.team === 'BRAVO').length;

      list.push({
        code,
        name: room.state.name,
        matchState: room.state.matchState,
        playerCount: players.length,
        maxPlayers: room.state.maxPlayers,
        alphaCount,
        bravoCount,
        timeRemaining: room.state.timeRemainingSeconds,
        scores: room.state.scores,
      });
    }
    return list;
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }
}
