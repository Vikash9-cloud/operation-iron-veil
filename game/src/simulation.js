import * as THREE from 'three';
import { MATCH, WEAPONS, BUY_COST, makeRandom, clamp, distanceXZ } from './config.js';
import { makeActorState, createActorVisual, syncActor, chooseWeapon } from './actors.js';
import { canOccupy, moveCircle, isLineClear, nearestNode, findPath } from './physics.js';
import { makeWeaponState, weaponDefinition, weaponSpread, spreadDirection, fireAllowed, beginReload, updateWeapon, playerEye } from './weapons.js';

const BOT_NAMES = { sable: ['KITE', 'MICA', 'WREN', 'NORTH', 'LATCH'], iron: ['VOSS', 'CROW', 'TARN', 'HOLT', 'KELL'] };
const TEAM_IDS = ['sable', 'iron'];
const otherTeam = (team) => team === 'sable' ? 'iron' : 'sable';

export function createSimulation({ scene, map, hud, audio, effects, onDeploy }) {
  let random = makeRandom(117);
  const raycaster = new THREE.Raycaster();
  const scratch = new THREE.Vector3();
  const aimPoint = new THREE.Vector3();
  const noises = [];
  const smokeClouds = [];
  const persistent = new Map();
  let pause = false;
  let lastPlayerAlive = true;
  let lastUpdate = 0;
  let lastFootstep = 0;

  const state = {
    round: 1, phase: 'start', phaseTime: 0, time: 0, roundTime: 0,
    score: { sable: 0, iron: 0 }, actors: [], player: null,
    attackTeam: 'sable', objective: { planted: false, timer: 0, plantProgress: 0, defuseProgress: 0, carrier: null },
    winner: null, endReason: '', matchOver: false, lastEarned: 0, interaction: '',
    shots: 0, hits: 0, seed: 117,
  };

  function saveActor(actor) {
    persistent.set(actor.id, { credits: actor.credits, kills: actor.kills, deaths: actor.deaths, weaponId: actor.weapon.id });
  }

  function clearRoster() {
    for (const actor of state.actors) if (actor.group) scene.remove(actor.group);
    state.actors.length = 0;
  }

  function createRoster(playerTeam, keepPlayer) {
    const oldPlayer = state.player;
    if (oldPlayer) { saveActor(oldPlayer); lastPlayerAlive = oldPlayer.alive; }
    for (const actor of state.actors) saveActor(actor);
    clearRoster();
    state.player = null;
    state.attackTeam = state.round <= MATCH.halfLength ? 'sable' : 'iron';
    for (const team of TEAM_IDS) {
      const spawns = team === 'sable' ? map.spawnSable : map.spawnIron;
      const isPlayerSide = team === playerTeam;
      const botNames = BOT_NAMES[team];
      let botIndex = 0;
      for (let slot = 0; slot < 5; slot += 1) {
        const playerSlot = isPlayerSide && slot === 4;
        const name = playerSlot ? 'VEIL-01' : botNames[botIndex++];
        const id = playerSlot ? 'PLAYER' : team + '-' + name;
        const saved = persistent.get(id);
        const actor = makeActorState({ id, callSign: name, team, index: slot, role: playerSlot ? 'point' : (slot === 0 ? 'anchor' : ['entry', 'breacher', 'scout', 'support'][slot - 1]), player: playerSlot, position: spawns[slot], yaw: team === 'sable' ? 0 : Math.PI });
        actor.credits = saved?.credits ?? 800;
        actor.kills = saved?.kills ?? 0;
        actor.deaths = saved?.deaths ?? 0;
        actor.radius = 0.34;
        actor.height = 1.78;
        actor.spotted = false;
        actor.inventory = { furnace7: makeWeaponState('furnace7'), pike9: makeWeaponState('pike9') };
        actor.ownedWeapons = new Set(['furnace7', 'pike9']);
        actor.smoke = playerSlot ? 1 : 0;
        actor.armor = 50;
        actor.health = 100;
        if (playerSlot && keepPlayer && lastPlayerAlive && oldPlayer) {
          actor.credits = oldPlayer.credits;
          actor.armor = oldPlayer.armor;
          actor.smoke = oldPlayer.smoke;
          actor.inventory = oldPlayer.inventory;
          actor.ownedWeapons = oldPlayer.ownedWeapons;
          actor.weapon = oldPlayer.weapon;
          actor.weapon.id = actor.weapon.id;
        } else if (playerSlot) {
          actor.weapon = actor.inventory.furnace7;
        } else {
          const purchase = actor.credits >= 2200 && random() > 0.67 ? 'needleline' : actor.credits >= 1800 && random() > 0.53 ? 'breaker12' : 'furnace7';
          if (purchase !== 'furnace7') { actor.weapon = makeWeaponState(purchase); actor.armor = 75; }
        }
        if (!playerSlot) {
          createActorVisual(scene, actor);
          for (const mesh of actor.hitMeshes) mesh.userData.actor = actor;
        }
        actor.routeIndex = slot % 3;
        actor.pathTarget = null;
        actor.noiseTarget = null;
        actor.lastKnown = new THREE.Vector3();
        actor.inCover = false;
        actor.reloadAt = 0;
        actor.aimTime = 0;
        actor.hitCooldown = 0;
        state.actors.push(actor);
        if (playerSlot) state.player = actor;
      }
    }
    persistent.set('PLAYER', { credits: state.player.credits, kills: state.player.kills, deaths: state.player.deaths, weaponId: state.player.weapon.id });
  }

  function addNoise(position, radius, kind) {
    noises.push({ position: position.clone(), radius, kind, time: state.time });
  }

  function enemiesOf(actor) { return state.actors.filter((candidate) => candidate.team !== actor.team && candidate.alive); }
  function alliesOf(actor) { return state.actors.filter((candidate) => candidate.team === actor.team && candidate.alive); }
  function counts() {
    const alive = { sable: 0, iron: 0 };
    for (const actor of state.actors) if (actor.alive) alive[actor.team] += 1;
    return alive;
  }

  function eye(actor) {
    return new THREE.Vector3(actor.position.x, actor.position.y + (actor.player ? actor.eye : actor.crouching ? 1.1 : 1.54), actor.position.z);
  }

  function smokeBlocks(a, b) {
    const segment = new THREE.Vector3().subVectors(b, a);
    const denom = segment.lengthSq() || 1;
    for (const cloud of smokeClouds) {
      const t = clamp(new THREE.Vector3().subVectors(cloud.center, a).dot(segment) / denom, 0, 1);
      if (cloud.center.distanceTo(a.clone().addScaledVector(segment, t)) < cloud.radius) return true;
    }
    return false;
  }

  function visible(observer, target) {
    if (!target?.alive) return false;
    const from = eye(observer); const to = eye(target);
    if (from.distanceTo(to) > 54 || smokeBlocks(from, to)) return false;
    return isLineClear(from, to, map.colliders);
  }

  function damageActor(victim, amount, headshot, attacker, cause = 'rifle') {
    if (!victim.alive) return false;
    let damage = amount;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, damage * 0.56);
      victim.armor -= absorbed;
      damage -= absorbed * 0.72;
    }
    victim.health = Math.max(0, victim.health - damage);
    if (victim.player) hud.damage();
    if (victim.health > 0) return false;
    victim.alive = false;
    victim.deaths += 1;
    if (attacker) { attacker.kills += 1; attacker.credits += 300; }
    if (victim.group) syncActor(victim, 0);
    const killer = attacker ? attacker.callSign : 'ENVIRONMENT';
    hud.event(killer + '  >  ' + victim.callSign + (headshot ? ' / HEAD' : ''), headshot);
    if (!attacker?.player) audio.play('kill');
    if (victim.player) audio.play('hurt', 0.8);
    if (attacker?.player) hud.toast(headshot ? 'HEADSHOT / +300 CREDITS' : 'TARGET DOWN / +300 CREDITS');
    if (victim.player) { hud.banner('OPERATOR DOWN', cause === 'relay' ? 'Signal charge detonated.' : 'Your squad is still in the fight.', 3000); }
    return true;
  }

  function pathTo(actor, targetId) {
    const start = nearestNode(actor.position, map.navNodes);
    if (!start || actor.pathTarget === targetId) return;
    actor.pathTarget = targetId;
    actor.path = findPath(map.navNodes, start.id, targetId);
    actor.pathIndex = Math.min(1, Math.max(0, actor.path.length - 1));
  }

  function moveActor(actor, target, dt, speed = 4.1) {
    if (!target) return;
    const dx = target.x - actor.position.x; const dz = target.z - actor.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.62) { actor.velocity.x *= Math.max(0, 1 - dt * 9); actor.velocity.z *= Math.max(0, 1 - dt * 9); return; }
    const desiredX = dx / distance * speed; const desiredZ = dz / distance * speed;
    const blend = Math.min(1, dt * 8.5);
    actor.velocity.x += (desiredX - actor.velocity.x) * blend;
    actor.velocity.z += (desiredZ - actor.velocity.z) * blend;
    moveCircle(actor.position, actor.velocity, dt, actor.radius, actor.height, map.colliders);
    actor.yaw = Math.atan2(-dx, -dz);
  }

  function routeWaypoint(actor, targetId) {
    if (actor.pathTarget !== targetId || !actor.path?.length) pathTo(actor, targetId);
    if (!actor.path?.length) return map.sitePosition;
    const node = actor.path[Math.min(actor.pathIndex, actor.path.length - 1)];
    if (distanceXZ(actor.position, node) < 1.35 && actor.pathIndex < actor.path.length - 1) actor.pathIndex += 1;
    return actor.path[Math.min(actor.pathIndex, actor.path.length - 1)];
  }

  function chooseTarget(actor) {
    let nearest = null; let best = Infinity;
    for (const enemy of enemiesOf(actor)) {
      if (!visible(actor, enemy)) continue;
      const d = actor.position.distanceTo(enemy.position);
      if (d < best) { best = d; nearest = enemy; }
    }
    actor.spotted = Boolean(nearest);
    if (nearest) {
      actor.lastKnown.copy(nearest.position); actor.lastSeen = state.time; actor.target = nearest; actor.aimTime += 0.22;
      for (const ally of alliesOf(actor)) if (ally !== actor && distanceXZ(ally.position, actor.position) < 17 && !ally.target) { ally.lastKnown.copy(nearest.position); ally.lastSeen = state.time; }
      return nearest;
    }
    actor.target = null;
    const heard = noises.find((n) => state.time - n.time < 2.8 && distanceXZ(actor.position, n.position) < n.radius);
    if (heard) { actor.lastKnown.copy(heard.position); actor.lastNoise = heard.time; actor.spotted = true; }
    if (state.time - actor.lastSeen < 2.4 || state.time - actor.lastNoise < 2.1) return { position: actor.lastKnown, heard: true, alive: true };
    return null;
  }

  function botShoot(actor, target) {
    if (state.time < actor.nextShot || actor.weapon.reloadLeft > 0) return;
    if (actor.weapon.magazine <= 0) { beginReload(actor.weapon, (sound) => audio.play(sound)); actor.action = 'reload'; return; }
    const def = weaponDefinition(actor.weapon);
    const cadence = actor.role === 'scout' ? 0.78 : actor.role === 'anchor' ? 0.66 : 0.59;
    actor.nextShot = state.time + Math.max(def.fireDelay, cadence) * (0.93 + random() * 0.2);
    fireAllowed(actor.weapon, state.time);
    updateWeapon(actor.weapon, 0.001);
    const from = eye(actor);
    const point = target.position.clone(); point.y += target.player ? target.eye * 0.78 : 1.23;
    const dist = from.distanceTo(point);
    const spread = Math.max(0.008, def.spread + (actor.moving ? def.moveSpread * 0.42 : 0) + Math.min(0.022, actor.weapon.recoil));
    const error = spread * dist * (1.7 + (actor.aimTime < 1 ? 1.1 : 0));
    point.x += (random() - 0.5) * error; point.y += (random() - 0.5) * error; point.z += (random() - 0.5) * error;
    const clear = isLineClear(from, point, map.colliders) && !smokeBlocks(from, point);
    const focus = target.heard ? 0.08 : 0.13 + Math.min(0.12, actor.aimTime * 0.045);
    const distanceFactor = clamp(1 - Math.max(0, dist - 12) / 94, 0.45, 0.92);
    const coverFactor = target.player && target.player.crouching ? 0.72 : 1;
    const hit = clear && dist < def.range && random() < focus * distanceFactor * coverFactor;
    const head = hit && random() < 0.055;
    const endpoint = hit ? point : point.clone().add(new THREE.Vector3((random() - 0.5) * 1.6, (random() - 0.5) * 1.2, (random() - 0.5) * 1.6));
    effects.tracer(from, endpoint, actor.team === 'iron' ? 0xe68b6a : 0x7ed1c1, 0.065);
    addNoise(actor.position, 33, 'weapon');
    if (hit && target.position) damageActor(target, def.damage * (head ? def.head : 1), head, actor);
    actor.action = 'fire';
    audio.play('shot-soft', 0.55);
  }

  function botObjective(actor, dt) {
    const isAttacker = actor.team === state.attackTeam;
    if (state.objective.planted) {
      if (actor.team !== state.attackTeam && distanceXZ(actor.position, map.sitePosition) < 2.3 && !enemiesOf(actor).some((e) => visible(actor, e))) {
        actor.defuseProgress += dt;
        if (actor.defuseProgress >= MATCH.defuseSeconds) { finishRound(otherTeam(state.attackTeam), 'Relay disarmed by ' + actor.callSign + '.'); return true; }
      }
      if (actor.team === state.attackTeam && distanceXZ(actor.position, map.sitePosition) < 4.5) actor.crouching = true;
      return false;
    }
    if (isAttacker && actor.role === 'entry' && distanceXZ(actor.position, map.sitePosition) < MATCH.objectiveRadius && counts()[otherTeam(state.attackTeam)] > 0) {
      actor.plantProgress += dt;
      if (actor.plantProgress >= MATCH.plantSeconds + 0.9) {
        plantRelay(actor); return true;
      }
    }
    return false;
  }

  function planBot(actor, dt) {
    if (!actor.alive) return;
    actor.decisionAt -= dt;
    actor.crouching = false;
    if (actor.decisionAt <= 0) { actor.decisionAt = 0.18 + random() * 0.15; actor.target = chooseTarget(actor); }
    const target = actor.target;
    if (target?.position && target.alive && !target.heard) {
      const d = distanceXZ(actor.position, target.position);
      const dx = target.position.x - actor.position.x; const dz = target.position.z - actor.position.z;
      actor.yaw = Math.atan2(-dx, -dz);
      if (d > 10.5) moveActor(actor, target.position, dt, 3.85);
      else if (d < 6.2) { const back = new THREE.Vector3(actor.position.x - dx / (d || 1) * 3, 0, actor.position.z - dz / (d || 1) * 3); moveActor(actor, back, dt, 2.7); }
      else {
        actor.velocity.x *= Math.max(0, 1 - dt * 10); actor.velocity.z *= Math.max(0, 1 - dt * 10);
        if (state.time >= actor.strafeUntil) { actor.strafeSign *= -1; actor.strafeUntil = state.time + 0.7 + random() * 1.1; }
        const side = new THREE.Vector3(dz, 0, -dx).normalize().multiplyScalar(actor.strafeSign * 1.4);
        moveActor(actor, new THREE.Vector3(actor.position.x + side.x, 0, actor.position.z + side.z), dt, 2.1);
        actor.crouching = actor.role === 'anchor' || random() < 0.08;
      }
      actor.aiming = true;
      actor.aimTime += dt;
      if (d < weaponDefinition(actor.weapon).range) botShoot(actor, target);
      if (actor.weapon.magazine <= 2 && actor.weapon.reserve > 0 && actor.weapon.reloadLeft === 0 && d > 9) beginReload(actor.weapon, (sound) => audio.play(sound));
      return;
    }
    actor.aiming = false;
    actor.aimTime = Math.max(0, actor.aimTime - dt * 0.8);
    if (target?.position && target.heard) {
      moveActor(actor, target.position, dt, 3.55);
      return;
    }
    const isAttacker = actor.team === state.attackTeam;
    if (state.objective.planted) {
      const id = actor.team === state.attackTeam ? 'site' : 'site';
      moveActor(actor, routeWaypoint(actor, id), dt, isAttacker ? 3.4 : 3.75);
      return;
    }
    if (isAttacker) {
      const lane = ['w3', 'c3', 'e3'][actor.routeIndex];
      const laneNode = map.navNodes.find((node) => node.id === lane);
      const goal = laneNode && distanceXZ(actor.position, laneNode) < 1.8 ? 'site' : lane;
      moveActor(actor, routeWaypoint(actor, goal), dt, actor.role === 'entry' ? 4.4 : 3.95);
    } else {
      const guardIds = ['site', 'w3', 'c3', 'e3', 'd1'];
      const goal = guardIds[actor.index % guardIds.length];
      const waypoint = routeWaypoint(actor, goal);
      moveActor(actor, waypoint, dt, 3.55);
      if (distanceXZ(actor.position, waypoint) < 1.5) actor.crouching = actor.role === 'anchor';
    }
  }

  function plantRelay(actor = state.player) {
    if (state.objective.planted) return;
    state.objective.planted = true;
    state.objective.timer = MATCH.plantedSeconds;
    state.objective.carrier = actor.id;
    state.objective.plantProgress = 0;
    state.objective.defuseProgress = 0;
    if (actor) actor.credits += 300;
    hud.event(actor.callSign + ' armed the relay', true);
    hud.banner('RELAY ARMED', 'Signal detonation in ' + MATCH.plantedSeconds + ' seconds.', 3000);
    effects.burst(new THREE.Vector3(map.sitePosition.x, 0.72, map.sitePosition.z), 0xf0b35a, 2.4);
    audio.play('plant');
    addNoise(map.sitePosition, 42, 'relay');
    for (const bot of state.actors) { bot.pathTarget = null; bot.defuseProgress = 0; }
  }

  function finishRound(winner, reason) {
    if (state.phase === 'post' || state.phase === 'end' || state.matchOver) return;
    state.winner = winner;
    state.endReason = reason;
    state.score[winner] += 1;
    const payout = winner === state.player.team ? 3250 : 1800;
    state.lastEarned = payout - (winner === state.player.team && !state.player.alive ? 450 : 0);
    for (const actor of state.actors) {
      actor.credits += (actor.team === winner ? 3250 : 1800) - (actor.player && actor.team === winner && !actor.alive ? 450 : 0);
      saveActor(actor);
    }
    state.matchOver = state.score[winner] >= MATCH.roundsToWin || state.round >= 7;
    state.phase = 'post';
    state.phaseTime = MATCH.postSeconds;
    state.interaction = '';
    state.objective.plantProgress = 0;
    hud.banner(winner === state.player.team ? 'ROUND SECURED' : 'ROUND LOST', reason, MATCH.postSeconds * 1000);
    audio.play('round');
    onDeploy?.(false);
  }

  function nextRound() {
    if (!state.matchOver) state.round += 1;
    else state.round = 1;
    if (state.matchOver) {
      state.score.sable = 0; state.score.iron = 0; state.matchOver = false; state.time = 0;
      persistent.clear();
    }
    createRoster('sable', true);
    state.objective = { planted: false, timer: 0, plantProgress: 0, defuseProgress: 0, carrier: null };
    state.winner = null; state.endReason = ''; state.lastEarned = 0; state.roundTime = 0;
    state.phase = 'buy'; state.phaseTime = MATCH.buySeconds; state.interaction = '';
    for (const cloud of smokeClouds) scene.remove(cloud.mesh);
    smokeClouds.length = 0;
    hud.showBuy(state.player.credits, state.phaseTime);
    hud.banner('BUY WINDOW', state.player.team.toUpperCase() + ' / ' + (state.attackTeam === state.player.team ? 'ATTACKER' : 'DEFENDER'), 2600);
    if (state.round === 4) hud.toast('SIDES SWAPPED / SABLE now holds the foundry.', 3000);
    audio.play('round');
    onDeploy?.(true);
  }

  function restart() {
    persistent.clear(); state.round = 1; state.score = { sable: 0, iron: 0 }; state.time = 0; state.matchOver = false;
    clearRoster(); state.phase = 'start'; state.phaseTime = 0; state.player = null; state.objective = { planted: false, timer: 0, plantProgress: 0, defuseProgress: 0, carrier: null };
    for (const cloud of smokeClouds) { scene.remove(cloud.mesh); cloud.mesh.geometry.dispose(); cloud.mesh.material.dispose(); }
    smokeClouds.length = 0;
    createRoster('sable', false);
    hud.showStart();
    onDeploy?.(false);
  }

  function start() {
    if (state.phase !== 'start') return;
    audio.unlock();
    state.round = 1; state.time = 0; random = makeRandom(state.seed);
    createRoster('sable', false);
    nextRoundForInitial();
  }

  function nextRoundForInitial() {
    state.phase = 'buy'; state.phaseTime = MATCH.buySeconds; state.attackTeam = 'sable';
    state.objective = { planted: false, timer: 0, plantProgress: 0, defuseProgress: 0, carrier: null };
    hud.showBuy(state.player.credits, state.phaseTime); hud.banner('BUY WINDOW', 'SABLE ATTACK / IRON HOLD', 2400); audio.play('round'); onDeploy?.(true);
  }

  function buy(id) {
    const p = state.player;
    if (state.phase !== 'buy' || !p?.alive) return false;
    const cost = BUY_COST[id];
    if (!Number.isFinite(cost) || p.credits < cost) { hud.toast('INSUFFICIENT CREDITS'); return false; }
    if (id === 'armor') {
      if (p.armor >= 100) { hud.toast('PLATE ALREADY FULL'); return false; }
      p.armor = Math.min(100, p.armor + 50); p.credits -= cost;
    } else if (id === 'smoke') {
      if (p.smoke >= 2) { hud.toast('CARRY LIMIT REACHED'); return false; }
      p.smoke += 1; p.credits -= cost;
    } else {
      if (!p.inventory[id]) p.inventory[id] = makeWeaponState(id);
      p.ownedWeapons.add(id); p.credits -= cost; p.weapon = p.inventory[id];
    }
    audio.play('ui'); hud.toast('KIT UPDATED / ' + (id === 'armor' || id === 'smoke' ? id.toUpperCase() : weaponDefinition(p.weapon).short));
    hud.updateBuy(p.credits, state.phaseTime);
    return true;
  }

  function ready() {
    if (state.phase !== 'buy') return false;
    state.phase = 'live'; state.phaseTime = MATCH.roundSeconds; state.roundTime = 0; state.interaction = '';
    hud.hideScreens(); hud.banner('ROUND LIVE', state.attackTeam.toUpperCase() + ' attack / ' + (state.attackTeam === state.player.team ? 'secure the relay pad.' : 'deny the relay plant.'), 2200); audio.play('round'); onDeploy?.(true);
    return true;
  }

  function reloadPlayer() {
    const p = state.player; if (!p?.alive) return false;
    return beginReload(p.weapon, (sound) => audio.play(sound));
  }

  function switchWeapon(slot) {
    const ids = { 1: 'furnace7', 2: 'pike9', 3: 'breaker12', 4: 'needleline' };
    const id = ids[slot]; const p = state.player;
    if (!p?.alive || !p.ownedWeapons.has(id)) { if (id) hud.toast('WEAPON NOT IN KIT'); return false; }
    p.inventory[p.weapon.id] = p.weapon; p.weapon = p.inventory[id];
    audio.play('ui'); return true;
  }

  function throwSmoke() {
    const p = state.player;
    if (state.phase !== 'live' || !p?.alive || p.smoke <= 0) { hud.toast('NO SMOKE AVAILABLE'); return; }
    p.smoke -= 1;
    const forward = new THREE.Vector3(-Math.sin(p.yaw), Math.sin(p.pitch) * 0.7 + 0.2, -Math.cos(p.yaw)).normalize();
    const origin = eye(p).addScaledVector(forward, 0.6);
    let flight = 0.62; const velocity = forward.multiplyScalar(7.2); velocity.y += 2.2;
    const can = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x98a49b, roughness: 0.7, metalness: 0.48 }));
    can.position.copy(origin); can.castShadow = true; scene.add(can);
    smokeClouds.push({ center: origin, mesh: can, life: 99, fuse: flight, radius: 0.13, velocity });
    addNoise(p.position, 21, 'smoke'); audio.play('smoke');
    return true;
  }

  function useInteraction(dt, input) {
    const p = state.player;
    state.interaction = '';
    if (!p?.alive || state.phase !== 'live' || !input.use) { state.objective.plantProgress = Math.max(0, state.objective.plantProgress - dt * 0.8); state.objective.defuseProgress = Math.max(0, state.objective.defuseProgress - dt * 0.8); return; }
    const close = distanceXZ(p.position, map.sitePosition) < MATCH.objectiveRadius;
    if (p.team === state.attackTeam && !state.objective.planted && close) {
      state.objective.plantProgress += dt;
      state.interaction = 'HOLD F / ARM RELAY  ' + Math.floor(Math.min(1, state.objective.plantProgress / MATCH.plantSeconds) * 100) + '%';
      if (state.objective.plantProgress >= MATCH.plantSeconds) plantRelay(p);
    } else if (p.team !== state.attackTeam && state.objective.planted && close) {
      state.objective.defuseProgress += dt;
      state.interaction = 'HOLD F / DISARM  ' + Math.floor(Math.min(1, state.objective.defuseProgress / MATCH.defuseSeconds) * 100) + '%';
      if (state.objective.defuseProgress >= MATCH.defuseSeconds) finishRound(p.team, 'Relay disarmed by the operator.');
    } else if (!close && (p.team === state.attackTeam || state.objective.planted)) state.interaction = 'MOVE CLOSER TO RELAY';
  }

  function movePlayer(dt, input) {
    const p = state.player; if (!p?.alive || state.phase !== 'live') return;
    const keys = input.keys;
    const crouch = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    const height = crouch ? MATCH.crouchHeight : MATCH.playerHeight;
    if (!crouch && p.crouching && !canOccupy(p.position, MATCH.playerRadius, MATCH.playerHeight, map.colliders)) p.crouching = true;
    else p.crouching = crouch;
    p.height = p.crouching ? MATCH.crouchHeight : MATCH.playerHeight;
    const eyeTarget = p.crouching ? 1.03 : 1.61;
    p.eye = (p.eye ?? eyeTarget) + (eyeTarget - (p.eye ?? eyeTarget)) * Math.min(1, dt * 12);
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const sin = Math.sin(p.yaw); const cos = Math.cos(p.yaw);
    let wx = -sin * forward + cos * strafe; let wz = -cos * forward - sin * strafe;
    const mag = Math.hypot(wx, wz); if (mag > 0) { wx /= mag; wz /= mag; }
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = p.crouching ? MATCH.crouchSpeed : sprint ? MATCH.sprintSpeed : MATCH.walkSpeed;
    const accel = p.onGround ? 38 : 8;
    const blend = Math.min(1, accel * dt / speed);
    p.velocity.x += (wx * speed - p.velocity.x) * blend; p.velocity.z += (wz * speed - p.velocity.z) * blend;
    if (!forward && !strafe && p.onGround) { const drag = Math.max(0, 1 - dt * 9); p.velocity.x *= drag; p.velocity.z *= drag; }
    p.moving = Math.hypot(p.velocity.x, p.velocity.z) > 0.15;
    if (!input.jump) p.jumpLatch = false;
    if (input.jump && !p.jumpLatch && p.onGround) { p.velocity.y = MATCH.jumpSpeed; p.onGround = false; p.jumpLatch = true; audio.play('step', 1.4); }
    p.velocity.y = Math.max(-22, p.velocity.y - MATCH.gravity * dt);
    moveCircle(p.position, p.velocity, dt, MATCH.playerRadius, height, map.colliders);
    p.position.y += p.velocity.y * dt;
    if (p.position.y <= 0) { p.position.y = 0; p.velocity.y = 0; p.onGround = true; }
    if (p.moving && state.time > lastFootstep + (sprint ? 0.33 : p.crouching ? 0.8 : 0.52)) {
      lastFootstep = state.time; audio.play('step', sprint ? 1.5 : p.crouching ? 0.45 : 0.85);
      if (sprint) addNoise(p.position, 19, 'footsteps');
    }
    p.aiming = input.aiming;
    updateWeapon(p.weapon, dt, () => audio.play('reload'));
  }

  function shootPlayer(camera) {
    const p = state.player;
    if (!p?.alive || state.phase !== 'live') return false;
    const def = weaponDefinition(p.weapon);
    if (!fireAllowed(p.weapon, state.time)) {
      if (p.weapon.magazine === 0 && p.weapon.reserve > 0) hud.toast('EMPTY / PRESS R TO RELOAD', 900);
      return false;
    }
    state.shots += 1;
    const origin = eye(p);
    const base = camera.getWorldDirection(scratch).clone();
    const spread = weaponSpread(def, p.weapon, p.moving ? Math.hypot(p.velocity.x, p.velocity.z) : 0, p.crouching, p.aiming);
    const targetMeshes = state.actors.filter((a) => a.team !== p.team && a.alive).flatMap((a) => a.hitMeshes || []);
    scene.updateMatrixWorld(true);
    const shootables = map.solids.concat(targetMeshes);
    let end = origin.clone().addScaledVector(base, Math.min(def.range, 60));
    let confirmedHit = false; let headHit = false; let killHit = false; let bestDistance = Infinity;
    const traces = [];
    for (let pellet = 0; pellet < def.pellets; pellet += 1) {
      const direction = spreadDirection(base, spread, random);
      raycaster.set(origin, direction); raycaster.far = def.range;
      const hits = raycaster.intersectObjects(shootables, false);
      if (!hits.length) continue;
      const hit = hits[0];
      if (hit.distance < bestDistance) { bestDistance = hit.distance; end.copy(hit.point); }
      if (def.pellets === 1 || pellet % Math.max(1, Math.floor(def.pellets / 4)) === 0) traces.push(hit.point.clone());
      const actor = hit.object.userData.actor;
      if (actor && actor.team !== p.team && actor.alive) {
        const head = hit.object.userData.part === 'head';
        const limb = hit.object.userData.part === 'limb';
        const killed = damageActor(actor, def.damage * (head ? def.head : limb ? def.limb : 1), head, p);
        killHit = killHit || killed;
        state.hits += 1; confirmedHit = true; headHit ||= head;
      } else if (pellet === 0) effects.burst(hit.point, hit.object.material?.color?.getHex?.() ?? 0xf0b35a, 0.75);
    }
    if (confirmedHit) { hud.hitmarker(headHit); audio.play(killHit ? 'kill' : 'hit'); }
    const muzzleOrigin = origin.clone().add(new THREE.Vector3(0.25, -0.16, -0.56).applyQuaternion(camera.quaternion));
    if (traces.length) for (const point of traces) effects.tracer(muzzleOrigin, point, def.color, 0.07);
    else effects.tracer(muzzleOrigin, end, def.color, 0.07);
    const muzzlePoint = origin.clone().addScaledVector(base, 0.8); effects.muzzle(muzzlePoint, 0xffce86);
    p.pitch = clamp(p.pitch + def.recoil * (p.aiming ? 0.78 : 1.15), -1.45, 1.45);
    p.yaw += (random() - 0.5) * def.recoil * 0.34;
    p.inventory[p.weapon.id] = p.weapon;
    addNoise(p.position, 41, 'weapon'); audio.play('shot');
    if (!def.auto) p.semiSpent = true;
    return true;
  }

  function updateSmoke(dt) {
    for (let i = smokeClouds.length - 1; i >= 0; i -= 1) {
      const cloud = smokeClouds[i];
      if (cloud.fuse > 0) {
        cloud.fuse -= dt;
        cloud.center.addScaledVector(cloud.velocity, dt); cloud.velocity.y -= 5.8 * dt;
        cloud.center.x = clamp(cloud.center.x, -29, 29); cloud.center.z = clamp(cloud.center.z, -29, 29);
        if (cloud.center.y < 0.14) { cloud.center.y = 0.14; cloud.velocity.y *= -0.24; cloud.velocity.x *= 0.58; cloud.velocity.z *= 0.58; }
        cloud.mesh.position.copy(cloud.center);
        if (cloud.fuse <= 0) {
          cloud.life = MATCH.smokeSeconds; cloud.radius = 0.35;
          cloud.mesh.geometry.dispose(); cloud.mesh.geometry = new THREE.SphereGeometry(MATCH.smokeRadius, 18, 14);
          cloud.mesh.material = new THREE.MeshStandardMaterial({ color: 0x74807a, transparent: true, opacity: 0.27, depthWrite: false, roughness: 1 });
          cloud.mesh.position.y = MATCH.smokeRadius * 0.56; cloud.center.y = cloud.mesh.position.y;
        }
      } else {
        cloud.life -= dt; cloud.radius = MATCH.smokeRadius * Math.min(1, (MATCH.smokeSeconds - cloud.life) * 2 + 0.2);
        cloud.mesh.material.opacity = 0.27 * Math.min(1, cloud.life / 0.9);
        if (cloud.life <= 0) { scene.remove(cloud.mesh); cloud.mesh.geometry.dispose(); cloud.mesh.material.dispose(); smokeClouds.splice(i, 1); }
      }
    }
  }

  function updateObjective(dt, input) {
    if (state.objective.planted) {
      state.objective.timer -= dt;
      if (Math.ceil(state.objective.timer) % 2 === 0 && Math.floor(state.objective.timer) !== Math.floor(state.objective.timer + dt)) audio.play('beep');
      if (state.objective.timer <= 0) { finishRound(state.attackTeam, 'Relay detonated.'); return; }
      if (state.phase !== 'post') useInteraction(dt, input);
    } else {
      useInteraction(dt, input);
      if (!state.objective.planted && state.roundTime >= MATCH.roundSeconds) { finishRound(otherTeam(state.attackTeam), 'Time expired before the relay was armed.'); return; }
    }
    for (const actor of state.actors) if (!actor.player && actor.alive) botObjective(actor, dt);
  }

  function outcomeCheck() {
    if (state.phase !== 'live') return;
    const alive = counts();
    const defending = otherTeam(state.attackTeam);
    if (state.objective.planted) {
      if (alive[defending] === 0) finishRound(state.attackTeam, 'The defenders were eliminated after the relay was armed.');
      else if (alive[state.attackTeam] === 0 && state.objective.timer <= 0) finishRound(state.attackTeam, 'Relay detonated after the last attacker fell.');
    } else if (alive[state.attackTeam] === 0) finishRound(defending, 'All attackers eliminated.');
    else if (alive[defending] === 0) finishRound(state.attackTeam, 'Foundry watch eliminated.');
  }

  function step(dt, input) {
    if (pause) return;
    state.time += dt;
    updateSmoke(dt);
    for (let i = noises.length - 1; i >= 0; i -= 1) if (state.time - noises[i].time > 4) noises.splice(i, 1);
    if (state.phase === 'start') { effects.update(dt); return; }
    if (state.phase === 'buy') {
      state.phaseTime = Math.max(0, state.phaseTime - dt);
      hud.updateBuy(state.player.credits, state.phaseTime);
      if (state.phaseTime <= 0) { hud.hideScreens(); ready(); }
      hud.update(state); effects.update(dt); return;
    }
    if (state.phase === 'post') {
      state.phaseTime = Math.max(0, state.phaseTime - dt);
      for (const actor of state.actors) if (actor.group) syncActor(actor, dt);
      if (state.phaseTime <= 0) {
        state.phase = 'end';
        hud.showEnd(state);
        if (state.matchOver) { onDeploy?.(false); }
      }
      hud.update(state); effects.update(dt); return;
    }
    if (state.phase === 'end' || state.phase === 'paused') { hud.update(state); effects.update(dt); return; }
    state.phaseTime = Math.max(0, state.phaseTime - dt); state.roundTime += dt;
    movePlayer(dt, input);
    if (input.reload) reloadPlayer();
    for (const actor of state.actors) {
      if (actor.player) continue;
      planBot(actor, dt);
      if (actor.weapon.reloadLeft > 0) updateWeapon(actor.weapon, dt);
      if (actor.group) syncActor(actor, dt);
    }
    updateObjective(dt, input);
    outcomeCheck();
    if (state.time - lastUpdate > 0.085) { lastUpdate = state.time; hud.update(state); }
    effects.update(dt);
  }

  function setPaused(value) { pause = value; state.phase = value ? 'paused' : state.phase === 'paused' ? 'live' : state.phase; }

  function diagnostic() {
    const alive = counts();
    return { phase: state.phase, round: state.round, phaseTime: Number(state.phaseTime.toFixed(2)), roundTime: Number(state.roundTime.toFixed(2)), attackTeam: state.attackTeam, playerTeam: state.player?.team, playerHealth: state.player?.health, playerPosition: state.player?.position ? [Number(state.player.position.x.toFixed(2)), Number(state.player.position.y.toFixed(2)), Number(state.player.position.z.toFixed(2))] : null, score: { ...state.score }, alive, planted: state.objective.planted, relayTime: Number(state.objective.timer.toFixed(2)), shots: state.shots, hits: state.hits, bots: state.actors.filter((a) => !a.player).map((a) => ({ name: a.callSign, team: a.team, alive: a.alive, position: [Number(a.position.x.toFixed(1)), Number(a.position.z.toFixed(1))], target: a.target?.callSign || null })) };
  }

  createRoster('sable', false);
  hud.showStart();
  return { state, start, ready, next: nextRound, restart, buy, reload: reloadPlayer, switchWeapon, throwSmoke, step, shootPlayer, setPaused, diagnostic, get paused() { return pause; }, setAim(value) { if (state.player) state.player.aiming = value; } };
}
