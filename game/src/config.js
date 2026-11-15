export const MATCH = Object.freeze({
  roundsToWin: 4,
  halfLength: 3,
  buySeconds: 12,
  roundSeconds: 55,
  plantedSeconds: 22,
  postSeconds: 3.4,
  plantSeconds: 3.2,
  defuseSeconds: 4.6,
  mapMin: -32,
  mapMax: 32,
  playerRadius: 0.34,
  playerHeight: 1.72,
  crouchHeight: 1.12,
  gravity: 18,
  jumpSpeed: 6.3,
  walkSpeed: 6.6,
  sprintSpeed: 8.5,
  crouchSpeed: 3.4,
  fireDistance: 72,
  objectiveRadius: 3.1,
  smokeSeconds: 8,
  smokeRadius: 5.5
});

export const TEAM = Object.freeze({
  SABLE: Object.freeze({ id: 'sable', name: 'SABLE', color: 0x67c4bd, accent: 0xb4cc7b }),
  IRON: Object.freeze({ id: 'iron', name: 'IRON', color: 0xdc7059, accent: 0xf0b35a })
});

export const WEAPONS = Object.freeze({
  furnace7: Object.freeze({
    id: 'furnace7', name: 'Furnace-7 Carbine', short: 'Furnace-7', type: 'rifle', cost: 0,
    magSize: 28, reserveMax: 84, damage: 25, head: 2.9, limb: 0.72, pellets: 1,
    fireDelay: 0.105, reload: 1.65, range: 68, spread: 0.014, moveSpread: 0.035, recoil: 0.012,
    color: 0xd0ad70, auto: true
  }),
  pike9: Object.freeze({
    id: 'pike9', name: 'Pike-9 Sidearm', short: 'Pike-9', type: 'pistol', cost: 300,
    magSize: 14, reserveMax: 56, damage: 24, head: 2.55, limb: 0.75, pellets: 1,
    fireDelay: 0.19, reload: 1.1, range: 46, spread: 0.009, moveSpread: 0.026, recoil: 0.019,
    color: 0xc6d2ca, auto: false
  }),
  needleline: Object.freeze({
    id: 'needleline', name: 'Needleline DMR', short: 'Needleline', type: 'marksman', cost: 2200,
    magSize: 10, reserveMax: 40, damage: 59, head: 2.65, limb: 0.78, pellets: 1,
    fireDelay: 0.58, reload: 1.9, range: 86, spread: 0.0035, moveSpread: 0.052, recoil: 0.034,
    color: 0x8eb3a0, auto: false, scoped: true
  }),
  breaker12: Object.freeze({
    id: 'breaker12', name: 'Breaker-12 Scattergun', short: 'Breaker-12', type: 'shotgun', cost: 1800,
    magSize: 7, reserveMax: 28, damage: 9, head: 1.65, limb: 0.72, pellets: 9,
    fireDelay: 0.76, reload: 1.82, range: 24, spread: 0.078, moveSpread: 0.06, recoil: 0.052,
    color: 0xb0844f, auto: false
  })
});

export const BUY_ORDER = Object.freeze(['pike9', 'furnace7', 'breaker12', 'needleline']);
export const BUY_LABELS = Object.freeze({
  pike9: 'Pike-9 Sidearm',
  furnace7: 'Furnace-7 Carbine',
  breaker12: 'Breaker-12 Scattergun',
  needleline: 'Needleline DMR',
  smoke: 'Smoke canister',
  armor: 'Ceramic plate'
});
export const BUY_COST = Object.freeze({ pike9: 300, furnace7: 0, breaker12: 1800, needleline: 2200, smoke: 450, armor: 650 });

export function makeRandom(seed = 1) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distanceXZ = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const formatClock = (seconds) => {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
