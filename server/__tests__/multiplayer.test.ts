import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../Room';
import { MovementValidator } from '../MovementValidator';
import { CombatSystem } from '../CombatSystem';
import { SERVER_CONFIG, WEAPON_REGISTRY } from '../config';
import { PlayerState, ClientMovementPayload } from '../types';

function createMockRoom(code = 'TEST-01', hostName = 'AlphaLeader') {
  const hostId = 'host_1';
  const sessionToken = 'tok_host_1';
  return new Room(
    code,
    'Test Arena',
    { id: hostId, socketId: 'sock_host_1', name: hostName, sessionToken },
    {
      onBroadcastTick: () => {},
      onBroadcastState: () => {},
      onBroadcastEvent: () => {},
      onRoomEmpty: () => {},
    }
  );
}

test('1. Room Initialization and 3v3 Limits', () => {
  const room = createMockRoom('AVE-101');
  assert.equal(room.state.code, 'AVE-101');
  assert.equal(room.state.matchState, 'LOBBY');
  assert.equal(room.state.maxPlayers, 6);
  assert.equal(room.state.teamLimit, 3);

  // Host should be player 1 on ALPHA
  const players = Object.values(room.state.players);
  assert.equal(players.length, 1);
  assert.equal(players[0].team, 'ALPHA');
  assert.equal(players[0].isHost, true);

  // Add 5 more players (total 6: 3 Alpha, 3 Bravo)
  for (let i = 2; i <= 6; i++) {
    const res = room.addPlayer(`p_${i}`, `sock_${i}`, `Player ${i}`, `tok_${i}`);
    assert.equal(res.success, true, `Player ${i} should be successfully added`);
  }

  assert.equal(Object.keys(room.state.players).length, 6);

  // 7th player must be rejected because 3v3 max capacity is 6
  const overflowRes = room.addPlayer('p_7', 'sock_7', 'Player 7', 'tok_7');
  assert.equal(overflowRes.success, false);
  assert.match(overflowRes.error || '', /full/i);
});

test('2. Team Assignment and Team Switching (Max 3 per Team)', () => {
  const room = createMockRoom('AVE-202');

  // Add 2 more players to ALPHA (now 3 on Alpha)
  room.addPlayer('p_2', 'sock_2', 'Player 2', 'tok_2', false, 'ALPHA');
  room.addPlayer('p_3', 'sock_3', 'Player 3', 'tok_3', false, 'ALPHA');

  const alphaCount = Object.values(room.state.players).filter((p) => p.team === 'ALPHA').length;
  assert.equal(alphaCount, 3);

  // 4th player attempting to join ALPHA must fail or auto-balance
  const fourthAlpha = room.addPlayer('p_4', 'sock_4', 'Player 4', 'tok_4', false, 'ALPHA');
  assert.equal(fourthAlpha.success, true);
  // Should auto-assign to BRAVO because ALPHA is full
  assert.equal(fourthAlpha.player?.team, 'BRAVO');

  // Switching team to an already full team should be blocked
  const switchRes = room.changeTeam('p_4', 'ALPHA');
  assert.equal(switchRes.success, false);
  assert.match(switchRes.error || '', /full/i);

  // Now switch p_3 to BRAVO (leaves ALPHA with 2, BRAVO with 2)
  const validSwitch = room.changeTeam('p_3', 'BRAVO');
  assert.equal(validSwitch.success, true);
  assert.equal(room.state.players['p_3'].team, 'BRAVO');
});

test('3. Lobby Readiness and Match Countdown', () => {
  const room = createMockRoom('AVE-303');
  // Add 1 opponent on BRAVO
  room.addPlayer('p_2', 'sock_2', 'Bravo1', 'tok_2', false, 'BRAVO');

  assert.equal(room.state.players['host_1'].isReady, true);
  assert.equal(room.state.players['p_2'].isReady, false);

  // When p_2 readies up, all are ready and countdown begins
  const readyRes = room.setPlayerReady('p_2', true);
  assert.equal(readyRes.success, true);
  assert.equal(readyRes.allReady, true);
  assert.equal(room.state.matchState, 'STARTING');

  // If a player unreadies during countdown, countdown cancels back to LOBBY
  const unreadyRes = room.setPlayerReady('p_2', false);
  assert.equal(unreadyRes.allReady, false);
  assert.equal(room.state.matchState, 'LOBBY');

  room.cleanup();
});

test('4. Movement Authoritative Validation and Anti-Speedhack', () => {
  const room = createMockRoom('AVE-404');
  const player = room.state.players['host_1'];
  player.position = { x: 0, y: 1, z: 0 };
  player.lastUpdateTimestamp = Date.now() - 100; // 100ms ago

  // A. Normal reasonable movement (e.g. 0.8 units in 100ms -> 8 units/sec, under 14 units/sec max)
  const validMove: ClientMovementPayload = {
    position: { x: 0.8, y: 1, z: 0 },
    velocity: { x: 8, y: 0, z: 0 },
    rotationY: 0,
    pitch: 0,
    sequence: 1,
    clientTime: Date.now(),
  };

  const validation = MovementValidator.validateMovement(
    player,
    validMove.position,
    validMove.velocity,
    validMove.clientTime,
    validMove.sequence
  );
  assert.equal(validation.valid, true);

  // B. Speedhack detection (moved 50 units in 100ms)
  const speedhackMove = {
    position: { x: 30, y: 1, z: 0 },
    velocity: { x: 300, y: 0, z: 0 },
    rotationY: 0,
    pitch: 0,
    sequence: 2,
    clientTime: Date.now(),
  };

  const speedValidation = MovementValidator.validateMovement(
    player,
    speedhackMove.position,
    speedhackMove.velocity,
    speedhackMove.clientTime,
    speedhackMove.sequence
  );
  assert.equal(speedValidation.valid, false);
  assert.match(speedValidation.reason || '', /teleport|speed/i);

  // C. Boundary clamping (player coordinate outside avenue bounds)
  const outOfBoundsPos = { x: 999, y: 1, z: -999 };
  const clamped = MovementValidator.clampToArena(outOfBoundsPos);
  assert.equal(clamped.x, SERVER_CONFIG.ARENA.MAX_X);
  assert.equal(clamped.z, SERVER_CONFIG.ARENA.MIN_Z);
});

test('5. Combat Validation: Fire Rate, Ammo, Damage and Elimination', () => {
  const room = createMockRoom('AVE-505');
  room.addPlayer('victim_1', 'sock_v1', 'TargetBravo', 'tok_v1', false, 'BRAVO');

  const shooter = room.state.players['host_1'];
  const victim = room.state.players['victim_1'];

  // Position shooter and victim facing each other 15 meters apart
  shooter.position = { x: 0, y: 1, z: 0 };
  victim.position = { x: 0, y: 1, z: 15 };

  assert.equal(shooter.ammo, WEAPON_REGISTRY.rifle.magazineSize);
  assert.equal(victim.health, 100);
  assert.equal(victim.armor, 50);

  // A. Fire Rate validation
  const canFire1 = CombatSystem.canFire(shooter, 'rifle', Date.now());
  assert.equal(canFire1.allowed, true);

  // Fire a shot
  shooter.lastShotTime = Date.now();
  shooter.ammo -= 1;

  // Immediate subsequent shot (e.g. 10ms later) should be rejected because rifle fire rate is 110ms
  const canFireTooFast = CombatSystem.canFire(shooter, 'rifle', Date.now() + 10);
  assert.equal(canFireTooFast.allowed, false);
  assert.match(canFireTooFast.reason || '', /fire rate/i);

  // B. Process hit towards victim
  const hitResult = CombatSystem.processHit(
    shooter,
    victim,
    'rifle',
    { x: 0, y: 1.5, z: 0 },
    { x: 0, y: 0, z: 1 } // looking directly down +Z at victim
  );

  assert.equal(hitResult.hit, true);
  assert.ok(hitResult.damage && hitResult.damage > 0);
  // Armor absorbs 50%
  assert.ok(victim.armor < 50);
  assert.ok(victim.health < 100);

  // C. Elimination: reduce victim health to low and deal lethal blow
  victim.armor = 0;
  victim.health = 10;
  const lethalHit = CombatSystem.processHit(
    shooter,
    victim,
    'sniper',
    { x: 0, y: 1.5, z: 0 },
    { x: 0, y: 0, z: 1 }
  );

  assert.equal(lethalHit.hit, true);
  assert.equal(lethalHit.isElimination, true);
  assert.equal(victim.isAlive, false);
  assert.equal(victim.health, 0);
  assert.equal(shooter.eliminations, 1);
});

test('6. Reconnection and Session Token Handling', () => {
  const room = createMockRoom('AVE-606');
  const host = room.state.players['host_1'];
  assert.equal(host.isConnected, true);

  // Simulate socket disconnect
  room.handleDisconnect('host_1');
  assert.equal(host.isConnected, false);
  assert.ok(host.disconnectedAt !== null);

  // Reconnect with persistent sessionToken on a brand new socketId
  const reconnectRes = room.handleReconnect('tok_host_1', 'sock_host_new_99');
  assert.equal(reconnectRes.success, true);
  assert.equal(reconnectRes.player?.isConnected, true);
  assert.equal(reconnectRes.player?.socketId, 'sock_host_new_99');
  assert.equal(host.disconnectedAt, null);
});
