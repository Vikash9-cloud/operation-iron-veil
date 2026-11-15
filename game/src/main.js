import * as THREE from 'three';
import { makeRandom, clamp, WEAPONS } from './config.js';
import { createFoundry } from './map.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createSimulation } from './simulation.js';

const FIXED_STEP = 1 / 60;
const rng = makeRandom(117);
const captureMode = new URLSearchParams(window.location.search).get('shot');
const gameRoot = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', 'Vesper Foundry first person field view');
gameRoot.appendChild(renderer.domElement);

const gl = renderer.getContext();
if (!(gl instanceof WebGL2RenderingContext)) document.body.classList.add('webgl2-unavailable');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111a1b);
scene.fog = new THREE.FogExp2(0x182122, 0.0065);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.045, 130);
camera.rotation.order = 'YXZ';
scene.add(camera);

function buildViewModel() {
  const root = new THREE.Group();
  const graphite = new THREE.MeshStandardMaterial({ color: 0x273231, roughness: 0.42, metalness: 0.72 });
  const polymer = new THREE.MeshStandardMaterial({ color: 0x141b1c, roughness: 0.72, metalness: 0.18 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x92754b, roughness: 0.4, metalness: 0.78 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x39413c, roughness: 0.94, metalness: 0.04 });
  const emissive = new THREE.MeshStandardMaterial({ color: 0x4a3420, emissive: 0xf0a74b, emissiveIntensity: 0.45, roughness: 0.44, metalness: 0.46 });
  function part(geometry, material, x, y, z, parent = root) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  part(new THREE.BoxGeometry(0.16, 0.17, 0.56), graphite, 0, 0, -0.31);
  part(new THREE.BoxGeometry(0.11, 0.14, 0.3), polymer, 0, -0.02, 0.09);
  part(new THREE.BoxGeometry(0.055, 0.055, 0.52), brass, 0, 0.045, -0.66);
  part(new THREE.BoxGeometry(0.065, 0.18, 0.13), polymer, 0, -0.17, -0.24);
  part(new THREE.BoxGeometry(0.09, 0.035, 0.2), emissive, 0, 0.115, -0.31);
  part(new THREE.BoxGeometry(0.04, 0.08, 0.18), polymer, 0, 0.135, -0.27);
  part(new THREE.BoxGeometry(0.04, 0.025, 0.1), brass, 0, 0.182, -0.27);
  part(new THREE.BoxGeometry(0.08, 0.08, 0.06), polymer, 0.058, 0.01, -0.1);
  part(new THREE.CylinderGeometry(0.018, 0.018, 0.19, 8), brass, 0, 0, -0.99).rotation.x = Math.PI / 2;
  const leftArm = part(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), glove, -0.22, -0.19, -0.15); leftArm.rotation.z = -0.3;
  const rightArm = part(new THREE.CapsuleGeometry(0.08, 0.36, 4, 8), glove, 0.18, -0.16, 0.12); rightArm.rotation.z = -0.16;
  root.position.set(0.32, -0.285, -0.44);
  camera.add(root);
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffd58c, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
  flash.position.set(0.015, 0.02, -1.09); flash.visible = false; root.add(flash);
  const light = new THREE.PointLight(0xffbd72, 0, 5, 2); light.position.copy(flash.position); root.add(light);
  return { root, flash, light };
}

const viewModel = buildViewModel();
const map = createFoundry(scene, rng);
const hud = createHud();
const audio = createAudio();
const effects = createEffects(scene);
let simulation;
const input = { keys: new Set(), firing: false, semiPending: false, aiming: false, use: false, jump: false, reload: false };
let accumulator = 0;
let previousFrame = performance.now();
let frames = 0;
let fpsElapsed = 0;
let reloadStartedAt = 0;
let lastShot = 0;
let gameErrors = [];
let captureHold = false;

simulation = createSimulation({
  scene, map, hud, audio, effects,
  onDeploy(active) {
    if (!active && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  },
});

function syncCamera() {
  const p = simulation.state.player;
  if (!p) return;
  camera.position.set(p.position.x, p.position.y + (p.eye ?? 1.61), p.position.z);
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
}

function requestLock() {
  if (simulation.state.phase !== 'live') return;
  audio.unlock();
  renderer.domElement.requestPointerLock?.();
}

function onPointerLock() {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked) {
    simulation.setPaused(false);
    hud.hideScreens();
  } else if (simulation.state.phase === 'live' && simulation.state.roundTime > 0.15) {
    simulation.setPaused(true);
    hud.showPause();
  }
}

document.addEventListener('pointerlockchange', onPointerLock);
renderer.domElement.addEventListener('click', () => {
  if (simulation.state.phase === 'live' && document.pointerLockElement !== renderer.domElement && !simulation.paused) requestLock();
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== renderer.domElement || !simulation.state.player) return;
  const p = simulation.state.player;
  p.yaw -= event.movementX * 0.0021;
  p.pitch = clamp(p.pitch - event.movementY * 0.0021, -1.45, 1.45);
});
window.addEventListener('mousedown', (event) => {
  if (event.button === 2) { input.aiming = true; if (simulation.state.player) simulation.state.player.aiming = true; }
  if (event.button !== 0) return;
  if (simulation.state.phase === 'live' && document.pointerLockElement !== renderer.domElement && !simulation.paused) { requestLock(); return; }
  if (document.pointerLockElement === renderer.domElement && simulation.state.phase === 'live') {
    input.firing = true; input.semiPending = true;
  }
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 0) input.firing = false;
  if (event.button === 2) input.aiming = false;
});

function keyDown(event) {
  const code = event.code;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) event.preventDefault();
  input.keys.add(code);
  if (code === 'Tab' && !event.repeat && simulation.state.phase !== 'start') hud.scoreboard(simulation.state);
  if (event.repeat) return;
  if (code === 'Escape' && simulation.state.phase === 'live' && document.pointerLockElement !== renderer.domElement) { simulation.setPaused(true); hud.showPause(); }
  if (code === 'KeyB' && simulation.state.phase === 'buy') { hud.showBuy(simulation.state.player.credits, simulation.state.phaseTime); audio.play('ui'); }
  if (simulation.state.phase === 'live') {
    if (code === 'KeyR') simulation.reload();
    else if (code === 'KeyG') simulation.throwSmoke();
    else if (code === 'KeyF') input.use = true;
    else if (code === 'Digit1') simulation.switchWeapon(1);
    else if (code === 'Digit2') simulation.switchWeapon(2);
    else if (code === 'Digit3') simulation.switchWeapon(3);
    else if (code === 'Digit4') simulation.switchWeapon(4);
  }
}
function keyUp(event) {
  input.keys.delete(event.code);
  if (event.code === 'KeyF') input.use = false;
  if (event.code === 'Tab') hud.closeScoreboard();
}
window.addEventListener('keydown', keyDown);
window.addEventListener('keyup', keyUp);
window.addEventListener('blur', () => { input.keys.clear(); input.firing = false; input.aiming = false; input.use = false; });

hud.bind({
  deploy() { audio.unlock(); simulation.start(); },
  ready() { audio.unlock(); if (simulation.ready()) requestLock(); },
  next() { simulation.next(); },
  restart() { audio.unlock(); if (document.pointerLockElement) document.exitPointerLock(); simulation.setPaused(false); simulation.restart(); },
  resume() { simulation.setPaused(false); requestLock(); },
  buy(id) { simulation.buy(id); },
  mute() { audio.unlock(); return audio.toggle(); },
  volume(value) { audio.setVolume(value); },
});

function animateWeapon(dt, time) {
  const p = simulation.state.player;
  if (!p) return;
  const isReloading = p.weapon.reloadLeft > 0;
  const bob = p.moving ? Math.sin(time * (input.keys.has('ShiftLeft') ? 11 : 8)) * 0.012 : 0;
  const targetX = p.aiming ? 0.12 : p.crouching ? 0.34 : 0.32;
  const targetY = p.aiming ? -0.22 : p.crouching ? -0.36 : -0.285;
  const targetZ = p.aiming ? -0.57 : -0.44;
  const weaponScale = p.weapon.id === 'pike9' ? 0.76 : p.weapon.id === 'breaker12' ? 1.12 : p.weapon.id === 'needleline' ? 1.2 : 1;
  viewModel.root.scale.setScalar(weaponScale);
  viewModel.root.position.x += (targetX + (p.weapon.id === 'pike9' ? 0.025 : 0) - viewModel.root.position.x) * Math.min(1, dt * 12);
  viewModel.root.position.y += (targetY + bob - viewModel.root.position.y) * Math.min(1, dt * 12);
  viewModel.root.position.z += (targetZ + (p.weapon.id === 'pike9' ? 0.13 : p.weapon.id === 'needleline' ? -0.1 : 0) - viewModel.root.position.z) * Math.min(1, dt * 12);
  if (isReloading && reloadStartedAt === 0) reloadStartedAt = time;
  if (!isReloading) reloadStartedAt = 0;
  const reloadT = isReloading ? clamp((time - reloadStartedAt) / Math.max(0.1, WEAPONS[p.weapon.id].reload), 0, 1) : 0;
  const kick = p.weapon.recoil * 3.1;
  viewModel.root.rotation.x += ((isReloading ? Math.sin(reloadT * Math.PI) * 0.55 : -kick) - viewModel.root.rotation.x) * Math.min(1, dt * 18);
  viewModel.root.rotation.z += ((isReloading ? -0.28 : 0) - viewModel.root.rotation.z) * Math.min(1, dt * 10);
  camera.fov += ((p.aiming ? (p.weapon.id === 'needleline' ? 52 : 61) : 74) - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
  viewModel.flash.visible = time - lastShot < 0.055;
  viewModel.light.intensity = viewModel.flash.visible ? 12 : 0;
  viewModel.flash.rotation.z = time * 43;
  viewModel.root.visible = p.alive;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previousFrame) / 1000, 0.06);
  previousFrame = now;
  let steps = 0;
  if (!captureHold) {
    accumulator += dt;
    while (accumulator >= FIXED_STEP && steps < 5) {
      input.jump = input.keys.has('Space');
      simulation.step(FIXED_STEP, input);
      accumulator -= FIXED_STEP; steps += 1;
      syncCamera();
      const p = simulation.state.player;
      const def = p ? WEAPONS[p.weapon.id] : null;
      if (input.firing && p?.alive && simulation.state.phase === 'live' && document.pointerLockElement === renderer.domElement && (def?.auto || input.semiPending)) {
        if (simulation.shootPlayer(camera)) { lastShot = now / 1000; input.semiPending = false; }
      }
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
  }
  syncCamera();
  animateWeapon(dt, now / 1000);
  renderer.render(scene, camera);
  frames += 1; fpsElapsed += dt;
  if (fpsElapsed > 1) {
    const info = renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      fps: Math.round(frames / fpsElapsed), calls: info.render.calls, triangles: info.render.triangles,
      geometries: info.memory.geometries, textures: info.memory.textures,
      webgl2: gl instanceof WebGL2RenderingContext,
      game: simulation.diagnostic(),
    };
    frames = 0; fpsElapsed = 0;
  }
}

window.addEventListener('error', (event) => { gameErrors.push(String(event.message || 'runtime error')); gameErrors = gameErrors.slice(-20); });
window.addEventListener('unhandledrejection', (event) => { gameErrors.push(String(event.reason?.message || event.reason || 'promise rejection')); gameErrors = gameErrors.slice(-20); });
window.__THREE_GAME_ERRORS__ = gameErrors;

function prepareCapture() {
  if (!captureMode || captureMode === 'start') { captureHold = captureMode === 'start'; return; }
  simulation.start();
  if (captureMode === 'buy') { captureHold = true; hud.update(simulation.state); return; }
  simulation.ready();
  if (captureMode === 'play') {
    simulation.state.player.position.set(0, 0, 20);
    simulation.state.player.yaw = 0.02;
    simulation.state.player.pitch = 0.015;
    for (let i = 0; i < 132; i += 1) simulation.step(FIXED_STEP, input);
  } else if (captureMode === 'end') {
    for (let i = 0; i < 4800 && simulation.state.phase !== 'end'; i += 1) simulation.step(FIXED_STEP, input);
  }
  captureHold = true;
  hud.update(simulation.state);
  syncCamera();
  window.__shotReady = true;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
prepareCapture();
requestAnimationFrame(frame);
