import { MATCH, clamp } from './config.js';

export function canOccupy(position, radius, height, colliders) {
  if (position.x - radius < MATCH.mapMin || position.x + radius > MATCH.mapMax || position.z - radius < MATCH.mapMin || position.z + radius > MATCH.mapMax) return false;
  const foot = position.y;
  const head = foot + height;
  for (const c of colliders) {
    if (head <= c.minY || foot >= c.maxY) continue;
    const nx = clamp(position.x, c.minX, c.maxX);
    const nz = clamp(position.z, c.minZ, c.maxZ);
    const dx = position.x - nx;
    const dz = position.z - nz;
    if (dx * dx + dz * dz < radius * radius) return false;
  }
  return true;
}

export function moveCircle(position, velocity, dt, radius, height, colliders) {
  const result = { x: false, z: false };
  const nextX = { x: position.x + velocity.x * dt, y: position.y, z: position.z };
  if (canOccupy(nextX, radius, height, colliders)) position.x = nextX.x;
  else result.x = true;
  const nextZ = { x: position.x, y: position.y, z: position.z + velocity.z * dt };
  if (canOccupy(nextZ, radius, height, colliders)) position.z = nextZ.z;
  else result.z = true;
  if (result.x) velocity.x = 0;
  if (result.z) velocity.z = 0;
  position.x = clamp(position.x, MATCH.mapMin + radius, MATCH.mapMax - radius);
  position.z = clamp(position.z, MATCH.mapMin + radius, MATCH.mapMax - radius);
  return result;
}

function segmentHitsBox(a, b, box) {
  let lo = 0;
  let hi = 1;
  const axes = [
    [a.x, b.x - a.x, box.minX, box.maxX],
    [a.y, b.y - a.y, box.minY, box.maxY],
    [a.z, b.z - a.z, box.minZ, box.maxZ]
  ];
  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-7) {
      if (origin < min || origin > max) return false;
      continue;
    }
    let t0 = (min - origin) / delta;
    let t1 = (max - origin) / delta;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0);
    hi = Math.min(hi, t1);
    if (lo > hi) return false;
  }
  return hi > 0.025 && lo < 0.98;
}

export function isLineClear(from, to, colliders) {
  for (const c of colliders) if (segmentHitsBox(from, to, c)) return false;
  return true;
}

export function nearestNode(position, nodes, predicate = null) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of nodes) {
    if (predicate && !predicate(node)) continue;
    const d = (node.x - position.x) ** 2 + (node.z - position.z) ** 2;
    if (d < bestDistance) { bestDistance = d; best = node; }
  }
  return best;
}

export function findPath(nodes, startId, targetId) {
  const start = nodes.find(n => n.id === startId);
  const target = nodes.find(n => n.id === targetId);
  if (!start || !target) return [];
  const costs = new Map([[startId, 0]]);
  const previous = new Map();
  const open = new Set(nodes.map(n => n.id));
  while (open.size) {
    let current = null;
    let cost = Infinity;
    for (const id of open) {
      const value = costs.get(id) ?? Infinity;
      if (value < cost) { current = id; cost = value; }
    }
    if (current === null || !Number.isFinite(cost)) break;
    if (current === targetId) break;
    open.delete(current);
    const node = nodes.find(n => n.id === current);
    for (const neighborId of node.links) {
      if (!open.has(neighborId)) continue;
      const neighbor = nodes.find(n => n.id === neighborId);
      if (!neighbor) continue;
      const next = cost + Math.hypot(neighbor.x - node.x, neighbor.z - node.z) * (neighbor.risk ? 1.25 : 1);
      if (next < (costs.get(neighborId) ?? Infinity)) {
        costs.set(neighborId, next);
        previous.set(neighborId, current);
      }
    }
  }
  if (startId !== targetId && !previous.has(targetId)) return [];
  const path = [targetId];
  while (path[0] !== startId) {
    const parent = previous.get(path[0]);
    if (!parent) return [];
    path.unshift(parent);
  }
  return path.map(id => nodes.find(n => n.id === id));
}
