import { PlayerState, WeaponType, Vector3, HitResult } from './types';
import { WEAPON_REGISTRY } from './config';
import { MovementValidator } from './MovementValidator';

export class CombatSystem {
  /**
   * Validates if player can fire weapon (cooldown, ammo, reloading status)
   */
  public static canFire(
    shooter: PlayerState,
    weaponType: WeaponType,
    now: number = Date.now()
  ): { allowed: boolean; reason?: string } {
    if (!shooter.isAlive) {
      return { allowed: false, reason: 'Player is eliminated' };
    }

    const weapon = WEAPON_REGISTRY[weaponType];
    if (!weapon) {
      return { allowed: false, reason: 'Invalid weapon type' };
    }

    if (shooter.isReloading) {
      if (now - shooter.reloadStartTime < weapon.reloadTimeMs) {
        return { allowed: false, reason: 'Weapon is currently reloading' };
      }
      // Reload finished
      shooter.isReloading = false;
      shooter.ammo = weapon.magazineSize;
    }

    if (shooter.ammo <= 0) {
      return { allowed: false, reason: 'Out of ammo. Reload required.' };
    }

    const timeSinceLastShot = now - shooter.lastShotTime;
    // Allow small 15ms buffer for client packet timing jitter
    if (timeSinceLastShot < weapon.fireRateMs - 15) {
      return {
        allowed: false,
        reason: `Fire rate exceeded (${timeSinceLastShot}ms < ${weapon.fireRateMs}ms)`,
      };
    }

    return { allowed: true };
  }

  /**
   * Processes reload initiation
   */
  public static startReload(
    player: PlayerState,
    now: number = Date.now()
  ): { success: boolean; reloadTimeMs: number; reason?: string } {
    if (!player.isAlive) {
      return { success: false, reloadTimeMs: 0, reason: 'Player is eliminated' };
    }

    const weapon = WEAPON_REGISTRY[player.selectedWeapon];
    if (!weapon) {
      return { success: false, reloadTimeMs: 0, reason: 'Invalid weapon' };
    }

    if (player.ammo >= weapon.magazineSize) {
      return { success: false, reloadTimeMs: 0, reason: 'Magazine already full' };
    }

    if (player.isReloading) {
      return { success: false, reloadTimeMs: 0, reason: 'Already reloading' };
    }

    player.isReloading = true;
    player.reloadStartTime = now;

    return {
      success: true,
      reloadTimeMs: weapon.reloadTimeMs,
    };
  }

  /**
   * Completes a reload if time elapsed
   */
  public static finishReloadIfReady(
    player: PlayerState,
    now: number = Date.now()
  ): boolean {
    if (!player.isReloading) return false;
    const weapon = WEAPON_REGISTRY[player.selectedWeapon];
    if (!weapon) return false;

    if (now - player.reloadStartTime >= weapon.reloadTimeMs) {
      player.isReloading = false;
      player.ammo = weapon.magazineSize;
      return true;
    }
    return false;
  }

  /**
   * Authoritatively evaluates hit confirmation and computes damage & elimination
   */
  public static processHit(
    shooter: PlayerState,
    victim: PlayerState,
    weaponType: WeaponType,
    origin: Vector3,
    direction: Vector3
  ): HitResult {
    const weapon = WEAPON_REGISTRY[weaponType];
    if (!weapon) {
      return { hit: false, reason: 'Unknown weapon' };
    }

    // 1. Alive check
    if (!shooter.isAlive || !victim.isAlive) {
      return { hit: false, reason: 'Shooter or victim is already eliminated' };
    }

    // 2. Friendly fire rule: in 3v3 Alpha vs Bravo, team shooting does zero damage
    if (shooter.team === victim.team) {
      return { hit: false, reason: 'Friendly fire disabled' };
    }

    // 3. Distance check
    const dist = MovementValidator.distance(shooter.position, victim.position);
    if (dist > weapon.maxRange) {
      return {
        hit: false,
        reason: `Target beyond max range (${dist.toFixed(1)}m > ${weapon.maxRange}m)`,
      };
    }

    // 4. Directional alignment / angular tolerance check
    // Vector from origin to victim
    const toVictim = {
      x: victim.position.x - origin.x,
      y: (victim.position.y + 1.0) - origin.y, // center of mass
      z: victim.position.z - origin.z,
    };
    const toVictimDist = Math.hypot(toVictim.x, toVictim.y, toVictim.z);

    if (toVictimDist > 0.001) {
      // Normalize toVictim
      const normVictim = {
        x: toVictim.x / toVictimDist,
        y: toVictim.y / toVictimDist,
        z: toVictim.z / toVictimDist,
      };

      // Normalize direction
      const dirLength = Math.hypot(direction.x, direction.y, direction.z);
      const normDir = {
        x: direction.x / (dirLength || 1),
        y: direction.y / (dirLength || 1),
        z: direction.z / (dirLength || 1),
      };

      // Dot product: cos(angle)
      const dot = normVictim.x * normDir.x + normVictim.y * normDir.y + normVictim.z * normDir.z;
      
      // Allow cone angle depending on weapon spread + generous hitbox margin (0.75 dot ~ 41 degrees)
      const minDot = Math.max(0.65, 0.95 - weapon.spreadAngle * 3.5);
      if (dot < minDot && toVictimDist > 4) {
        return {
          hit: false,
          reason: `Shot missed victim hitbox (alignment: ${dot.toFixed(2)} < ${minDot.toFixed(2)})`,
        };
      }
    }

    // 5. Headshot detection (head is roughly y + 1.4 to y + 2.0)
    // Ray elevation check
    const expectedHitY = origin.y + direction.y * toVictimDist;
    const isHeadshot = expectedHitY >= (victim.position.y + 1.4);

    // 6. Calculate Damage
    let baseDamage = weapon.damage;
    if (isHeadshot) {
      baseDamage *= weapon.headshotMultiplier;
    }

    // Slight random variance (+/- 5%) for realistic ballistic dispersion
    const finalDamage = Math.round(baseDamage * (0.95 + Math.random() * 0.1));

    // 7. Apply to Armor first (50% absorption) then Health
    let damageRemaining = finalDamage;
    if (victim.armor > 0) {
      const absorbedByArmor = Math.min(victim.armor, Math.round(damageRemaining * 0.5));
      victim.armor -= absorbedByArmor;
      damageRemaining -= absorbedByArmor;
    }

    victim.health = Math.max(0, victim.health - damageRemaining);
    shooter.damageDealt += finalDamage;

    const isElimination = victim.health <= 0;
    if (isElimination) {
      victim.isAlive = false;
      victim.deaths += 1;
      shooter.eliminations += 1;
    }

    return {
      hit: true,
      targetId: victim.id,
      damage: finalDamage,
      isHeadshot,
      isElimination,
    };
  }
}
