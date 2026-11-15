import * as THREE from 'three';

function makeTexture(rng, base, accent, style) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  if (style === 'concrete') {
    for (let i = 0; i < 1700; i += 1) {
      const v = 70 + Math.floor(rng() * 90);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 2},${0.05 + rng() * 0.18})`;
      const w = 1 + rng() * 10;
      ctx.fillRect(rng() * 512, rng() * 512, w, 1 + rng() * 4);
    }
    ctx.strokeStyle = 'rgba(20,29,29,.45)';
    ctx.lineWidth = 3;
    for (let y = 96; y < 512; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
  } else if (style === 'steel') {
    for (let y = 0; y < 512; y += 32) {
      const shade = 24 + Math.floor(rng() * 23);
      ctx.fillStyle = `rgba(${shade + 14},${shade + 20},${shade + 18},.68)`;
      ctx.fillRect(0, y, 512, 3 + rng() * 3);
    }
    ctx.strokeStyle = 'rgba(5,10,11,.55)';
    ctx.lineWidth = 2;
    for (let x = 22; x < 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let i = 0; i < 70; i += 1) {
      ctx.fillStyle = `rgba(170,111,62,${0.04 + rng() * 0.12})`;
      ctx.fillRect(rng() * 512, rng() * 512, 8 + rng() * 70, 2 + rng() * 7);
    }
  } else if (style === 'grate') {
    ctx.fillStyle = '#273235'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(142,158,149,.4)'; ctx.lineWidth = 4;
    for (let x = 0; x < 512; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    for (let y = 0; y < 512; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  } else {
    ctx.fillStyle = accent;
    for (let x = -120; x < 640; x += 72) {
      ctx.beginPath(); ctx.moveTo(x, 512); ctx.lineTo(x + 36, 512); ctx.lineTo(x + 156, 0); ctx.lineTo(x + 120, 0); ctx.closePath(); ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeSignTexture(title, subtitle, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 220;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#142022'; ctx.fillRect(0, 0, 512, 220);
  ctx.strokeStyle = '#65746e'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 492, 200);
  ctx.fillStyle = color; ctx.fillRect(20, 22, 8, 174);
  ctx.fillStyle = '#e3e8df'; ctx.font = '700 46px system-ui'; ctx.fillText(title, 50, 91);
  ctx.fillStyle = '#9caaa3'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText(subtitle, 52, 138);
  ctx.fillStyle = color; ctx.fillRect(52, 160, 126, 3);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFoundry(scene, rng) {
  const colliders = [];
  const solids = [];
  const mat = {
    floor: new THREE.MeshStandardMaterial({ map: makeTexture(rng, '#38403d', '#d3aa5e', 'concrete'), color: 0xaeb8b0, roughness: 0.91, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ map: makeTexture(rng, '#303b3b', '#a77143', 'steel'), color: 0xb9c2b9, roughness: 0.56, metalness: 0.62 }),
    concrete: new THREE.MeshStandardMaterial({ map: makeTexture(rng, '#56605a', '#d3aa5e', 'concrete'), color: 0xa1a69b, roughness: 0.96, metalness: 0.04 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x202a2b, roughness: 0.82, metalness: 0.27 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x72563f, roughness: 0.62, metalness: 0.68 }),
    hazard: new THREE.MeshStandardMaterial({ map: makeTexture(rng, '#b98a3f', '#202729', 'hazard'), color: 0xf0d08a, roughness: 0.72, metalness: 0.18 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x31504e, roughness: 0.2, metalness: 0.34, transparent: true, opacity: 0.48, depthWrite: false }),
    ember: new THREE.MeshStandardMaterial({ color: 0x3b211b, emissive: 0xd65b31, emissiveIntensity: 1.6, roughness: 0.68 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x102625, emissive: 0x55b9aa, emissiveIntensity: 1.15, roughness: 0.5 }),
    red: new THREE.MeshStandardMaterial({ color: 0x321b19, emissive: 0xd55842, emissiveIntensity: 1.05, roughness: 0.5 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x151a1a, roughness: 0.8, metalness: 0.1 }),
    floorMark: new THREE.MeshStandardMaterial({ color: 0xc78c43, roughness: 0.9, metalness: 0.12 }),
    white: new THREE.MeshStandardMaterial({ color: 0xc2cec5, roughness: 0.6, metalness: 0.38 })
  };

  scene.background = new THREE.Color(0x111a1b);
  scene.fog = new THREE.FogExp2(0x182122, 0.0065);
  scene.add(new THREE.HemisphereLight(0xb2c4bd, 0x29302a, 1.9));
  const key = new THREE.DirectionalLight(0xf3cf96, 2.3);
  key.position.set(-18, 27, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -38; key.shadow.camera.right = 38;
  key.shadow.camera.top = 38; key.shadow.camera.bottom = -38;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x83a7a5, 0.85);
  fill.intensity = 1.5;
  fill.position.set(20, 15, -24);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(68, 68), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.floor = true;
  scene.add(floor);

  function box(name, x, y, z, w, h, d, material, solid = true, bevel = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = h > 0.7;
    mesh.receiveShadow = true;
    mesh.userData.blocksShots = solid;
    scene.add(mesh);
    if (solid) colliders.push({ id: name, minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    if (bevel > 0) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, bevel, d + 0.06), mat.white);
      trim.position.set(x, y + h / 2 - bevel / 2, z);
      trim.castShadow = false;
      trim.receiveShadow = true;
      scene.add(trim);
    }
    if (solid) solids.push(mesh);
    return mesh;
  }

  function cylinder(name, x, y, z, radius, height, material, solid = true, sides = 12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.blocksShots = solid;
    scene.add(mesh);
    if (solid) colliders.push({ id: name, minX: x - radius, maxX: x + radius, minY: y - height / 2, maxY: y + height / 2, minZ: z - radius, maxZ: z + radius });
    if (solid) solids.push(mesh);
    return mesh;
  }

  function pipe(x1, y1, z1, x2, y2, z2, radius, material) {
    const a = new THREE.Vector3(x1, y1, z1);
    const b = new THREE.Vector3(x2, y2, z2);
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 10), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function mark(x, z, w, d, material = mat.floorMark) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), material);
    m.position.set(x, 0.015, z);
    m.receiveShadow = true;
    scene.add(m);
  }

  function hazardPanel(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.026, d), mat.hazard);
    m.position.set(x, 0.03, z);
    scene.add(m);
  }

  function sign(x, y, z, title, subtitle, color, rotationY = 0) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.48, 0.16), mat.dark);
    frame.position.set(x, y, z);
    frame.rotation.y = rotationY;
    frame.castShadow = true;
    scene.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 1.25), new THREE.MeshBasicMaterial({ map: makeSignTexture(title, subtitle, color), side: THREE.DoubleSide }));
    board.position.set(x, y, z);
    board.rotation.y = rotationY;
    board.position.add(new THREE.Vector3(Math.sin(rotationY) * 0.09, 0, Math.cos(rotationY) * 0.09));
    scene.add(board);
  }

  // Outer plant walls and pressure doors.
  box('north-retaining-wall', 0, 4.2, -31.2, 62, 8.4, 1.5, mat.dark);
  box('south-retaining-wall', 0, 4.2, 31.2, 62, 8.4, 1.5, mat.dark);
  box('west-retaining-wall', -31.2, 4.2, 0, 1.5, 8.4, 62, mat.dark);
  box('east-retaining-wall', 31.2, 4.2, 0, 1.5, 8.4, 62, mat.dark);
  for (let x = -28; x <= 28; x += 7) {
    box(`north-wall-pier-${x}`, x, 4.6, -30.25, 0.42, 9.2, 0.44, mat.steel);
    box(`south-wall-pier-${x}`, x, 4.6, 30.25, 0.42, 9.2, 0.44, mat.steel);
  }
  for (let z = -28; z <= 28; z += 7) {
    box(`west-wall-pier-${z}`, -30.25, 4.6, z, 0.44, 9.2, 0.42, mat.steel);
    box(`east-wall-pier-${z}`, 30.25, 4.6, z, 0.44, 9.2, 0.42, mat.steel);
  }

  // The open canal and slag approaches define the attack and defense sides.
  box('south-spawn-control-booth', -23, 2.15, 24, 9, 4.3, 1.2, mat.steel);
  box('south-spawn-control-glass', -23, 2.65, 23.33, 7, 2.15, 0.12, mat.glass, false);
  box('north-spawn-control-booth', 22, 2.15, -24, 10, 4.3, 1.2, mat.steel);
  box('north-spawn-control-glass', 22, 2.65, -23.33, 7, 2.15, 0.12, mat.glass, false);
  box('south-cover-west', -13, 1.0, 24, 5.8, 2.0, 1.1, mat.concrete, true, 0.12);
  box('south-cover-east', 13, 1.0, 24, 5.8, 2.0, 1.1, mat.concrete, true, 0.12);
  box('north-cover-west', -13, 1.0, -24, 5.8, 2.0, 1.1, mat.concrete, true, 0.12);
  box('north-cover-east', 13, 1.0, -24, 5.8, 2.0, 1.1, mat.concrete, true, 0.12);

  // Furnace gallery: western route with staggered steel shields and a hot core.
  box('west-shield-1', -12.6, 1.25, 11, 4.4, 2.5, 2.3, mat.concrete, true, 0.1);
  box('west-shield-2', -21.1, 1.35, 4.4, 3.6, 2.7, 2.2, mat.steel, true, 0.1);
  box('west-shield-3', -13.9, 1.18, -4.8, 4.1, 2.36, 2.1, mat.concrete, true, 0.1);
  box('west-shield-4', -22.5, 1.0, -14.4, 3.2, 2.0, 2.4, mat.steel, true, 0.1);
  cylinder('furnace-throat', -23, 6.2, -8.5, 4.4, 12.4, mat.dark, true, 16);
  cylinder('furnace-rim', -23, 12.55, -8.5, 4.8, 0.48, mat.copper, false, 16);
  cylinder('furnace-light', -23, 6.1, -8.5, 3.15, 8.8, mat.ember, false, 16);
  for (let i = 0; i < 5; i += 1) {
    const a = i * Math.PI * 0.4;
    const x = -23 + Math.cos(a) * 5.15;
    const z = -8.5 + Math.sin(a) * 5.15;
    pipe(x, 0.3, z, x, 10.4, z, 0.22, mat.copper);
  }
  box('west-overhead-runway', -21, 5.5, 8, 10, 0.34, 13, mat.steel, false);
  for (let z = 3; z <= 13; z += 5) {
    box(`west-runway-leg-${z}`, -24.7, 2.7, z, 0.28, 5.4, 0.28, mat.steel, true);
    box(`west-runway-leg-b-${z}`, -17.3, 2.7, z, 0.28, 5.4, 0.28, mat.steel, true);
  }

  // East condenser route: vertical vessels, pipe rack and short hard-cover turns.
  box('east-shield-1', 12.8, 1.2, 11.2, 4.2, 2.4, 2.2, mat.steel, true, 0.1);
  box('east-shield-2', 21.3, 1.28, 4.0, 3.6, 2.56, 2.4, mat.concrete, true, 0.1);
  box('east-shield-3', 13.8, 1.0, -5.5, 4.4, 2.0, 2.2, mat.steel, true, 0.1);
  box('east-shield-4', 22.1, 1.25, -14.0, 3.4, 2.5, 2.3, mat.concrete, true, 0.1);
  for (let i = 0; i < 3; i += 1) {
    const x = 22 + i * 3.1;
    cylinder(`condenser-vessel-${i}`, x, 5.1, 9.0, 1.1, 10.2, mat.steel, true, 12);
    cylinder(`condenser-neck-${i}`, x, 10.45, 9.0, 0.42, 0.6, mat.copper, false, 12);
    box(`condenser-foot-${i}`, x, 0.32, 9.0, 2.4, 0.64, 2.4, mat.dark, true);
  }
  for (let z = -14; z <= 18; z += 8) {
    pipe(20, 8.5, z, 30, 8.5, z, 0.24, mat.copper);
    pipe(20, 6.8, z, 30, 6.8, z, 0.12, mat.steel);
  }
  box('east-piperack-crossbar-1', 25, 8.8, 2, 10, 0.34, 0.38, mat.steel, false);
  box('east-piperack-crossbar-2', 25, 8.8, 14, 10, 0.34, 0.38, mat.steel, false);

  // Central line has broken sightlines around a service conduit and the relay pad.
  box('central-service-spine-west', -5.2, 1.1, -2.0, 1.0, 2.2, 17, mat.steel, true, 0.12);
  box('central-service-spine-east', 5.2, 1.1, 2.4, 1.0, 2.2, 17, mat.steel, true, 0.12);
  box('central-low-shield-west', -1.8, 0.62, 9.4, 2.8, 1.24, 1.5, mat.concrete, true, 0.08);
  box('central-low-shield-east', 2.0, 0.62, -9.6, 2.7, 1.24, 1.5, mat.concrete, true, 0.08);
  box('relay-console-base', 0, 0.38, -0.6, 2.4, 0.76, 1.4, mat.dark, true);
  box('relay-console-top', 0, 0.82, -0.6, 1.6, 0.14, 1.05, mat.copper, false);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.09, 48), new THREE.MeshStandardMaterial({ color: 0x33433e, roughness: 0.82, metalness: 0.22 }));
  pad.position.set(0, 0.05, 0);
  pad.receiveShadow = true;
  scene.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.075, 8, 64), mat.hazard);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.13;
  scene.add(ring);
  for (let i = 0; i < 8; i += 1) {
    const a = i * Math.PI / 4;
    const x = Math.cos(a) * 2.7;
    const z = Math.sin(a) * 2.7;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.45), i % 2 ? mat.cyan : mat.ember);
    light.position.set(x, 0.19, z);
    light.rotation.y = -a;
    scene.add(light);
  }

  // Low service trench creates an alternate crouch-and-vault line.
  box('service-trench-west-wall', -8.3, 0.58, 14, 0.55, 1.16, 11.4, mat.steel, true);
  box('service-trench-east-wall', 8.3, 0.58, 14, 0.55, 1.16, 11.4, mat.steel, true);
  box('service-trench-floor', 0, -0.58, 14, 16.5, 0.16, 10.8, mat.dark, false);
  for (let x = -7.2; x <= 7.2; x += 3.6) {
    box(`trench-grate-${x}`, x, 1.0, 14, 0.22, 0.1, 10.7, mat.white, false);
  }
  box('trench-entry-west-lip', -8.8, 0.5, 8.2, 0.8, 1.0, 2.2, mat.concrete, true);
  box('trench-entry-east-lip', 8.8, 0.5, 19.8, 0.8, 1.0, 2.2, mat.concrete, true);

  // Roof frame, catwalks and suspended service lines make the hall read at scale.
  for (let z = -27; z <= 27; z += 9) {
    pipe(-29.4, 14.0, z, 29.4, 14.0, z, 0.22, mat.steel);
    box(`roof-truss-left-${z}`, -24, 13.4, z, 0.22, 1.2, 0.32, mat.copper, false);
    box(`roof-truss-right-${z}`, 24, 13.4, z, 0.22, 1.2, 0.32, mat.copper, false);
  }
  box('north-catwalk-deck', 0, 5.6, -18.3, 24, 0.28, 2.0, mat.steel, false);
  for (let x = -11; x <= 11; x += 5.5) {
    box(`north-catwalk-post-${x}`, x, 2.8, -18.3, 0.24, 5.6, 0.24, mat.steel, true);
  }
  for (let z = -23; z <= -13; z += 5) {
    pipe(-11.5, 6.4, z, 11.5, 6.4, z, 0.08, mat.copper);
  }
  pipe(-29, 10.6, -25, 29, 10.6, -25, 0.27, mat.copper);
  pipe(-29, 9.8, 25, 29, 9.8, 25, 0.22, mat.copper);

  // Local visual language: hazard marks, route lines, station signs and work lamps.
  hazardPanel(-16, 20, 8.0, 0.64);
  hazardPanel(16, 20, 8.0, 0.64);
  mark(-17, -3, 0.15, 40, mat.floorMark);
  mark(17, -3, 0.15, 40, mat.floorMark);
  mark(0, -5, 0.12, 28, mat.white);
  mark(-3.8, 0, 0.18, 7.1, mat.floorMark);
  mark(3.8, 0, 0.18, 7.1, mat.floorMark);
  sign(-18, 6.0, 29.95, 'CANAL ENTRY', 'SABLE / SOUTH ACCESS', 0x67c4bd, Math.PI);
  sign(18, 6.0, -29.95, 'SLAG HALL', 'IRON / NORTH WATCH', 0xdc7059, 0);
  sign(0, 5.1, -6.8, 'RELAY CORE', 'ARM / DENY / 22 SEC', 0xf0b35a, 0);
  sign(-27.0, 6.4, -10, 'FURNACE 03', 'HOT LINE / KEEP CLEAR', 0xdc7059, Math.PI / 2);
  sign(28.9, 6.0, 12, 'CONDENSER', 'PRESSURE LOOP / E-4', 0x67c4bd, -Math.PI / 2);

  for (let i = 0; i < 8; i += 1) {
    const x = -24 + i * 6.8;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.42), i % 2 ? mat.cyan : mat.hazard);
    lamp.position.set(x, 12.4, 0.5 + (i % 2 ? 7.2 : -7.2));
    scene.add(lamp);
    if (i === 1 || i === 4 || i === 6) {
      const light = new THREE.PointLight(i % 2 ? 0x7fc9bd : 0xf0b35a, 65, 13, 2);
      light.position.copy(lamp.position).add(new THREE.Vector3(0, -1.1, 0));
      scene.add(light);
    }
  }
  for (let i = 0; i < 8; i += 1) {
    const x = -25 + i * 7.1;
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.32), i % 2 ? mat.red : mat.cyan);
    beacon.position.set(x, 3.3, i % 2 ? 29.6 : -29.6);
    scene.add(beacon);
  }

  const navNodes = [
    { id: 's0', x: -7, z: 26, links: ['s1', 'w1', 'c1'] }, { id: 's1', x: 0, z: 26, links: ['s0', 's2', 'c1'] }, { id: 's2', x: 7, z: 26, links: ['s1', 'e1', 'c1'] },
    { id: 'w1', x: -18, z: 18, cover: true, links: ['s0', 'w2', 'c2'] }, { id: 'w2', x: -20, z: 9, cover: true, links: ['w1', 'w3'] }, { id: 'w3', x: -17, z: 1, cover: true, links: ['w2', 'w4', 'c3'] }, { id: 'w4', x: -12, z: -9, cover: true, links: ['w3', 'w5'] }, { id: 'w5', x: -16, z: -18, cover: true, links: ['w4', 'n0'] },
    { id: 'c1', x: 0, z: 18, links: ['s0', 's1', 's2', 'c2'] }, { id: 'c2', x: 0, z: 10, cover: true, links: ['c1', 'c3', 'w1', 'e1'] }, { id: 'c3', x: 0, z: 4, cover: true, links: ['c2', 'site', 'w3', 'e3'] },
    { id: 'e1', x: 18, z: 18, cover: true, links: ['s2', 'e2', 'c2'] }, { id: 'e2', x: 20, z: 9, cover: true, links: ['e1', 'e3'] }, { id: 'e3', x: 17, z: 1, cover: true, links: ['e2', 'e4', 'c3'] }, { id: 'e4', x: 12, z: -9, cover: true, links: ['e3', 'e5'] }, { id: 'e5', x: 16, z: -18, cover: true, links: ['e4', 'n2'] },
    { id: 'site', x: 0, z: -0.8, cover: true, site: true, links: ['c3', 'w3', 'e3', 'd1'] },
    { id: 'd1', x: 0, z: -10, cover: true, links: ['site', 'd2', 'w4', 'e4'] }, { id: 'd2', x: 0, z: -19, links: ['d1', 'n0', 'n1', 'n2'] },
    { id: 'n0', x: -8, z: -26, links: ['w5', 'd2', 'n1'] }, { id: 'n1', x: 0, z: -26, links: ['d2', 'n0', 'n2'] }, { id: 'n2', x: 8, z: -26, links: ['e5', 'd2', 'n1'] }
  ];

  const sitePosition = new THREE.Vector3(0, 0, 0);
  const spawnSable = [new THREE.Vector3(-7, 0, 26), new THREE.Vector3(-2.5, 0, 27), new THREE.Vector3(2.5, 0, 27), new THREE.Vector3(7, 0, 26), new THREE.Vector3(0, 0, 29)];
  const spawnIron = [new THREE.Vector3(-7, 0, -26), new THREE.Vector3(-2.5, 0, -27), new THREE.Vector3(2.5, 0, -27), new THREE.Vector3(7, 0, -26), new THREE.Vector3(0, 0, -29)];

  return { colliders, solids, navNodes, sitePosition, siteRadius: 3.35, spawnSable, spawnIron, materials: mat };
}
