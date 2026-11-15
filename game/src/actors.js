import * as THREE from 'three';
import { TEAM, WEAPONS } from './config.js';
import { makeWeaponState } from './weapons.js';

const shared = new Map();

function materials(teamId) {
  if (shared.has(teamId)) return shared.get(teamId);
  const team = teamId === 'sable' ? TEAM.SABLE : TEAM.IRON;
  const set = {
    fabric: new THREE.MeshStandardMaterial({ color: teamId === 'sable' ? 0x354a47 : 0x4b3834, roughness: 0.84 }),
    armor: new THREE.MeshStandardMaterial({ color: teamId === 'sable' ? 0x536763 : 0x69524a, roughness: 0.58, metalness: 0.32 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x252f30, roughness: 0.44, metalness: 0.58 }),
    trim: new THREE.MeshStandardMaterial({ color: team.color, emissive: team.color, emissiveIntensity: 0.18, roughness: 0.42, metalness: 0.35 }),
    visor: new THREE.MeshStandardMaterial({ color: team.color, emissive: team.color, emissiveIntensity: 0.75, roughness: 0.18, metalness: 0.72 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x111719, roughness: 0.7, metalness: 0.4 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa48757, roughness: 0.42, metalness: 0.8 }),
  };
  shared.set(teamId, set);
  return set;
}

export function makeActorState(data) {
  return {
    ...data,
    position: data.position.clone(),
    velocity: new THREE.Vector3(),
    yaw: data.yaw || 0,
    pitch: 0,
    health: 100,
    armor: data.player ? 50 : 35,
    eye: data.player ? 1.61 : 1.54,
    onGround: true,
    jumpLatch: false,
    alive: true,
    kills: 0,
    deaths: 0,
    credits: data.player ? 800 : 800,
    weapon: makeWeaponState('furnace7'),
    smoke: data.player ? 1 : 0,
    crouching: false,
    aiming: false,
    moving: false,
    walkPhase: data.index * 0.63,
    action: 'idle',
    actionTime: 0,
    nextShot: 0,
    lastSeen: -99,
    lastNoise: -99,
    target: null,
    path: [],
    pathIndex: 0,
    routeId: null,
    decisionAt: 0,
    strafeSign: data.index % 2 ? 1 : -1,
    strafeUntil: 0,
    reloading: 0,
    plantProgress: 0,
    defuseProgress: 0,
  };
}

function addPart(group, geometry, material, x, y, z, scale, part = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (part) mesh.userData.part = part;
  group.add(mesh);
  return mesh;
}

export function createActorVisual(scene, actor) {
  const m = materials(actor.team);
  const root = new THREE.Group();
  root.name = actor.callSign;
  const geometry = {
    torso: new THREE.BoxGeometry(0.54, 0.67, 0.34),
    pelvis: new THREE.BoxGeometry(0.48, 0.23, 0.32),
    limb: new THREE.CapsuleGeometry(0.105, 0.47, 4, 8),
    upper: new THREE.CapsuleGeometry(0.13, 0.26, 4, 8),
    helmet: new THREE.SphereGeometry(0.205, 14, 10),
    head: new THREE.SphereGeometry(0.16, 14, 10),
    pack: new THREE.BoxGeometry(0.34, 0.42, 0.19),
    rifle: new THREE.BoxGeometry(0.09, 0.1, 0.72),
    barrel: new THREE.CylinderGeometry(0.025, 0.025, 0.32, 8),
    joint: new THREE.SphereGeometry(0.12, 10, 8),
    shoe: new THREE.BoxGeometry(0.2, 0.11, 0.31),
  };
  const torso = addPart(root, geometry.torso, m.armor, 0, 1.18, 0, null, 'torso');
  addPart(root, geometry.pelvis, m.fabric, 0, 0.78, 0);
  addPart(root, geometry.pack, m.plate, 0, 1.25, 0.245);
  const head = addPart(root, geometry.head, m.fabric, 0, 1.66, 0, null, 'head');
  addPart(root, geometry.helmet, m.plate, 0, 1.72, -0.012);
  addPart(root, new THREE.BoxGeometry(0.25, 0.075, 0.055), m.visor, 0, 1.67, -0.168);
  addPart(root, new THREE.BoxGeometry(0.42, 0.19, 0.04), m.trim, 0, 1.34, -0.188);
  addPart(root, new THREE.BoxGeometry(0.075, 0.11, 0.045), m.dark, -0.13, 1.34, -0.215);
  addPart(root, new THREE.BoxGeometry(0.075, 0.11, 0.045), m.dark, 0.13, 1.34, -0.215);
  const leftArm = addPart(root, geometry.upper, m.fabric, -0.39, 1.24, -0.015, null, 'limb');
  const rightArm = addPart(root, geometry.upper, m.fabric, 0.39, 1.24, -0.06, null, 'limb');
  const leftLeg = addPart(root, geometry.limb, m.fabric, -0.16, 0.43, 0.01, null, 'limb');
  const rightLeg = addPart(root, geometry.limb, m.fabric, 0.16, 0.43, 0.01, null, 'limb');
  addPart(root, geometry.shoe, m.dark, -0.16, 0.13, -0.06);
  addPart(root, geometry.shoe, m.dark, 0.16, 0.13, -0.06);
  const gun = new THREE.Group();
  const receiver = addPart(gun, geometry.rifle, m.plate, 0, 0, -0.3);
  receiver.rotation.x = 0.03;
  addPart(gun, geometry.barrel, m.brass, 0, 0, -0.77).rotation.x = Math.PI / 2;
  addPart(gun, new THREE.BoxGeometry(0.08, 0.2, 0.1), m.dark, 0, -0.13, -0.23);
  addPart(gun, new THREE.BoxGeometry(0.045, 0.075, 0.24), m.dark, 0, -0.105, -0.37);
  addPart(gun, new THREE.BoxGeometry(0.07, 0.035, 0.14), m.trim, 0, 0.065, -0.26);
  gun.position.set(0.38, 1.31, -0.18);
  root.add(gun);
  scene.add(root);
  actor.group = root;
  actor.hitMeshes = [torso, head, leftArm, rightArm, leftLeg, rightLeg];
  actor.parts = { torso, head, leftArm, rightArm, leftLeg, rightLeg, gun };
  actor.geometries = geometry;
  actor.rig = { leftLeg, rightLeg, leftArm, rightArm, gun };
  syncActor(actor, 0);
  return root;
}

export function syncActor(actor, dt) {
  if (!actor.group) return;
  actor.group.position.copy(actor.position);
  actor.group.rotation.y = actor.yaw;
  actor.group.visible = actor.alive;
  actor.parts.head.visible = actor.alive;
  actor.moving = Math.hypot(actor.velocity.x, actor.velocity.z) > 0.12;
  if (actor.moving && actor.alive) actor.walkPhase += dt * Math.min(13, 5 + actor.velocity.length() * 0.5);
  const gait = actor.moving && actor.alive ? Math.sin(actor.walkPhase) * 0.46 : 0;
  actor.rig.leftLeg.rotation.x = gait;
  actor.rig.rightLeg.rotation.x = -gait;
  actor.rig.leftArm.rotation.x = -gait * 0.42;
  actor.rig.rightArm.rotation.x = -0.45 + (actor.action === 'fire' ? -0.14 : 0) + (actor.action === 'reload' ? 0.35 : 0);
  actor.rig.gun.rotation.x = actor.aiming ? -0.04 : 0;
  actor.group.position.y = actor.crouching ? -0.38 : 0;
  if (!actor.alive) {
    actor.group.rotation.z = Math.PI * 0.46;
    actor.group.position.y = 0.22;
  } else actor.group.rotation.z = 0;
}

export function chooseWeapon(actor, id) {
  if (!WEAPONS[id]) return false;
  actor.weapon = makeWeaponState(id);
  actor.weapon.reserve = Math.min(actor.weapon.reserve, WEAPONS[id].reserveMax);
  return true;
}
