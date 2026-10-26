import { Vector3, PlayerState } from './types';
import { SERVER_CONFIG } from './config';

export class MovementValidator {
  /**
   * Calculates euclidean distance between two 3D positions
   */
  public static distance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Calculates 2D horizontal distance (ignoring vertical jumping/gravity)
   */
  public static horizontalDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Clamps a coordinate within the authoritative Avenue map boundaries
   */
  public static clampToArena(pos: Vector3): Vector3 {
    const { ARENA } = SERVER_CONFIG;
    return {
      x: Math.max(ARENA.MIN_X, Math.min(ARENA.MAX_X, pos.x)),
      y: Math.max(ARENA.MIN_Y, Math.min(ARENA.MAX_Y, pos.y)),
      z: Math.max(ARENA.MIN_Z, Math.min(ARENA.MAX_Z, pos.z)),
    };
  }

  /**
   * Authoritative validation of reported movement from client.
   * Prevents speed-hacks, teleportation, out of bounds, and invalid numbers.
   */
  public static validateMovement(
    player: PlayerState,
    newPos: Vector3,
    newVelocity: Vector3,
    clientTime: number,
    sequence: number
  ): { valid: boolean; correctedPosition: Vector3; reason?: string } {
    // 1. Sanitize NaN or Infinite values
    if (
      !Number.isFinite(newPos.x) ||
      !Number.isFinite(newPos.y) ||
      !Number.isFinite(newPos.z)
    ) {
      return {
        valid: false,
        correctedPosition: player.position,
        reason: 'Invalid coordinate numbers',
      };
    }

    // 2. Reject out of order or duplicate older sequence packets
    if (sequence <= player.lastSequence && player.lastSequence > 0) {
      // Out of order packet, safe to drop
      return {
        valid: false,
        correctedPosition: player.position,
        reason: 'Out-of-order sequence packet',
      };
    }

    const now = Date.now();
    const timeDeltaSeconds = Math.max(0.01, (now - player.lastUpdateTimestamp) / 1000);

    // 3. Clamping boundary checks
    const clampedPos = this.clampToArena(newPos);

    // 4. Check for sudden teleportation
    const distTraveled = this.distance(player.position, clampedPos);
    if (distTraveled > SERVER_CONFIG.MOVEMENT.TELEPORT_THRESHOLD) {
      // Teleport detected! Snap player back to last authoritative position
      return {
        valid: false,
        correctedPosition: player.position,
        reason: `Teleportation detected (${distTraveled.toFixed(2)} units)`,
      };
    }

    // 5. Speed hack check with tolerance multiplier for network jitter
    const horizontalDist = this.horizontalDistance(player.position, clampedPos);
    const maxAllowedDist =
      SERVER_CONFIG.MOVEMENT.MAX_SPEED_UNITS_PER_SEC *
      SERVER_CONFIG.MOVEMENT.SPEED_TOLERANCE_MULTIPLIER *
      timeDeltaSeconds;

    // Give minimum buffer for very small time intervals
    const bufferDist = 1.5;

    if (horizontalDist > maxAllowedDist + bufferDist) {
      // Exceeded speed limit
      return {
        valid: false,
        correctedPosition: player.position,
        reason: `Speed limit exceeded (${horizontalDist.toFixed(2)}m in ${timeDeltaSeconds.toFixed(2)}s)`,
      };
    }

    return {
      valid: true,
      correctedPosition: clampedPos,
    };
  }
}
