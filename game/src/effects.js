import * as THREE from 'three';

export function createEffects(scene) {
  const effects = [];
  const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffdc98, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
  const flashGeometry = new THREE.SphereGeometry(0.11, 8, 6);
  const impactMaterial = new THREE.MeshBasicMaterial({ color: 0xf2b96c, transparent: true, opacity: 0.85, depthWrite: false });
  const impactGeometry = new THREE.OctahedronGeometry(0.09, 0);

  function burst(position, color = 0xf2b96c, scale = 1) {
    const mesh = new THREE.Mesh(impactGeometry, impactMaterial.clone());
    mesh.material.color.setHex(color);
    mesh.scale.setScalar(scale);
    mesh.position.copy(position);
    scene.add(mesh);
    effects.push({ mesh, life: 0.18, max: 0.18, drift: new THREE.Vector3((Math.random() - 0.5) * 0.35, 0.25 + Math.random() * 0.4, (Math.random() - 0.5) * 0.35), type: 'impact' });
  }

  function tracer(from, to, color = 0xffcb78, life = 0.075) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.84, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    scene.add(line);
    effects.push({ mesh: line, life, max: life, type: 'tracer' });
  }

  function muzzle(position, color = 0xffce86) {
    const mesh = new THREE.Mesh(flashGeometry, flashMaterial);
    mesh.position.copy(position);
    mesh.scale.set(1, 0.7, 1.45);
    scene.add(mesh);
    effects.push({ mesh, life: 0.06, max: 0.06, type: 'flash' });
  }

  function update(dt) {
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const e = effects[i];
      e.life -= dt;
      if (e.type === 'impact') {
        e.mesh.position.addScaledVector(e.drift, dt);
        e.mesh.material.opacity = Math.max(0, e.life / e.max);
        e.mesh.rotation.x += dt * 8; e.mesh.rotation.y += dt * 11;
      } else if (e.type === 'tracer') e.mesh.material.opacity = Math.max(0, e.life / e.max) * 0.84;
      else e.mesh.scale.multiplyScalar(0.82);
      if (e.life <= 0) {
        scene.remove(e.mesh);
        e.mesh.geometry?.dispose();
        if (e.type === 'impact' || e.type === 'tracer') e.mesh.material?.dispose();
        effects.splice(i, 1);
      }
    }
  }
  return { burst, tracer, muzzle, update };
}
