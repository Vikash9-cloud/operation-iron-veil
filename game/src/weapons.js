import * as THREE from 'three';
import { MATCH, WEAPONS, clamp } from './config.js';

export function makeWeaponState(id = 'furnace7') {
  const def = WEAPONS[id] ?? WEAPONS.furnace7;
  return { id: def.id, magazine: def.magSize, reserve: def.reserveMax, nextShot: 0, reloadLeft: 0, recoil: 0, reloadStage: 0, aiming: false };
}

export function weaponDefinition(state) { return WEAPONS[state.id] ?? WEAPONS.furnace7; }

export function spreadDirection(base, spread, rng, out = new THREE.Vector3()) {
  const tangent = new THREE.Vector3(0, 1, 0);
  if (Math.abs(base.dot(tangent)) > 0.92) tangent.set(1, 0, 0);
  const right = new THREE.Vector3().crossVectors(base, tangent).normalize();
  const up = new THREE.Vector3().crossVectors(right, base).normalize();
  const radius = Math.sqrt(rng()) * spread;
  const angle = rng() * Math.PI * 2;
  out.copy(base).addScaledVector(right, Math.cos(angle) * radius).addScaledVector(up, Math.sin(angle) * radius);
  return out.normalize();
}

export function weaponSpread(def, weapon, moving, crouching, aiming) {
  let spread = def.spread + weapon.recoil;
  if (moving) spread += def.moveSpread;
  if (crouching) spread *= 0.72;
  if (aiming && def.scoped) spread *= 0.42;
  else if (aiming) spread *= 0.7;
  return clamp(spread, 0.0018, 0.12);
}

export function beginReload(weapon, onSound) {
  const def = weaponDefinition(weapon);
  if (weapon.reloadLeft > 0 || weapon.magazine >= def.magSize || weapon.reserve <= 0) return false;
  weapon.reloadLeft = def.reload;
  weapon.reloadStage = 0;
  onSound?.('reload');
  return true;
}

export function updateWeapon(weapon, dt, onInsert) {
  const def = weaponDefinition(weapon);
  weapon.recoil = Math.max(0, weapon.recoil - dt * 0.06);
  if (weapon.reloadLeft <= 0) return;
  weapon.reloadLeft -= dt;
  const progress = 1 - Math.max(0, weapon.reloadLeft) / def.reload;
  if (progress > 0.56 && weapon.reloadStage === 0) {
    const amount = Math.min(def.magSize - weapon.magazine, weapon.reserve);
    weapon.magazine += amount;
    weapon.reserve -= amount;
    weapon.reloadStage = 1;
    onInsert?.();
  }
  if (weapon.reloadLeft <= 0) weapon.reloadLeft = 0;
}

export function fireAllowed(weapon, time) {
  const def = weaponDefinition(weapon);
  if (weapon.reloadLeft > 0 || weapon.magazine <= 0 || time < weapon.nextShot) return false;
  weapon.nextShot = time + def.fireDelay;
  weapon.magazine -= 1;
  weapon.recoil = Math.min(0.055, weapon.recoil + def.recoil);
  return true;
}

export function playerEye(position, crouching) {
  return new THREE.Vector3(position.x, position.y + (crouching ? 1.12 : 1.62), position.z);
}

export function shouldHitHead(hitPoint, actor) {
  return hitPoint.y > actor.group.position.y + 1.48;
}

export function weaponRange(state) { return weaponDefinition(state).range || MATCH.fireDistance; }
