import { BUY_LABELS, BUY_COST, WEAPONS, formatClock } from './config.js';

const BUY_IDS = ['furnace7', 'pike9', 'breaker12', 'needleline', 'armor', 'smoke'];

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const screens = { title: $('screen-title'), buy: $('screen-buy'), pause: $('screen-pause'), end: $('screen-end'), board: $('screen-scoreboard') };
  const buyList = $('buy-list');
  const feed = $('feed');
  const map = $('minimap');
  const ctx = map.getContext('2d');
  let handlers = {};
  let toastTimer = 0;
  let bannerTimer = 0;
  let feedItems = [];
  let lastState = null;
  let renderedBuyCredits = null;
  function show(name) { for (const [key, node] of Object.entries(screens)) node.hidden = key !== name; }
  function hideScreens() { for (const node of Object.values(screens)) node.hidden = true; }
  function toast(text, duration = 1800) {
    $('toast').textContent = text;
    $('toast').classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('on'), duration);
  }
  function event(text, head = false) {
    feedItems.unshift({ text, head, time: performance.now() + 5200 });
    feedItems = feedItems.slice(0, 5);
    feed.replaceChildren(...feedItems.map((entry) => { const row = document.createElement('div'); row.className = 'feed-item' + (entry.head ? ' head' : ''); row.textContent = entry.text; return row; }));
  }
  function banner(title, copy, duration = 2100) {
    $('banner-title').textContent = title;
    $('banner-copy').textContent = copy;
    $('banner').classList.add('on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => $('banner').classList.remove('on'), duration);
  }
  function setBuy(credits, seconds) {
    $('buy-credits').textContent = String(credits);
    $('buy-clock').textContent = String(Math.max(0, Math.ceil(seconds))).padStart(2, '0');
    if (renderedBuyCredits === credits) return;
    renderedBuyCredits = credits;
    buyList.replaceChildren(...BUY_IDS.map((id) => {
      const name = BUY_LABELS[id]; const cost = BUY_COST[id];
      const button = document.createElement('button'); button.type = 'button'; button.className = 'buy-item'; button.dataset.item = id; button.disabled = credits < cost;
      const title = document.createElement('span'); title.className = 'buy-name'; title.textContent = name;
      const price = document.createElement('span'); price.className = 'buy-cost'; price.textContent = cost === 0 ? 'FREE' : '¤ ' + cost;
      const detail = document.createElement('span'); detail.className = 'buy-detail';
      if (WEAPONS[id]) { const w = WEAPONS[id]; detail.textContent = w.magSize + ' rounds / ' + w.damage + ' base damage / ' + w.type.toUpperCase(); }
      else detail.textContent = id === 'armor' ? 'Ceramic trauma plate / 650 credits' : 'Sightline denial / one canister';
      button.append(title, price, detail); button.addEventListener('click', () => handlers.buy?.(id)); return button;
    }));
  }
  function drawMap(state) {
    const w = map.width; const h = map.height; const pad = 18; const span = 64;
    const point = (x, z) => [pad + (x + 32) / span * (w - pad * 2), pad + (z + 32) / span * (h - pad * 2)];
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#11191a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(171,190,181,.16)'; ctx.lineWidth = 3; ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.strokeStyle = 'rgba(191,164,112,.28)'; ctx.lineWidth = 9; ctx.lineCap = 'square';
    const routes = [[[-7, 27], [-18, 18], [-20, 9], [-17, 1], [-12, -9], [-16, -18], [-8, -26]], [[0, 27], [0, 18], [0, 10], [0, 4], [0, 0], [0, -10], [0, -19], [0, -26]], [[7, 27], [18, 18], [20, 9], [17, 1], [12, -9], [16, -18], [8, -26]]];
    for (const route of routes) { ctx.beginPath(); route.forEach((p, i) => { const [x, y] = point(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); }
    const [sx, sy] = point(0, 0); ctx.strokeStyle = 'rgba(240,179,90,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
    for (const actor of state.actors) {
      if (!actor.alive || actor.player) continue;
      if (actor.team !== state.player.team && !actor.spotted) continue;
      const [x, y] = point(actor.position.x, actor.position.z); ctx.fillStyle = actor.team === state.player.team ? '#67c4bd' : '#dc7059'; ctx.beginPath(); ctx.arc(x, y, actor.team === state.player.team ? 6 : 5, 0, Math.PI * 2); ctx.fill();
    }
    const [px, py] = point(state.player.position.x, state.player.position.z); ctx.save(); ctx.translate(px, py); ctx.rotate(state.player.yaw); ctx.fillStyle = '#f0b35a'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6.5, 7); ctx.lineTo(0, 4); ctx.lineTo(-6.5, 7); ctx.closePath(); ctx.fill(); ctx.restore();
    if (state.objective.planted) { ctx.fillStyle = '#ffce78'; ctx.beginPath(); ctx.arc(sx, sy, 5 + Math.sin(state.time * 8) * 2, 0, Math.PI * 2); ctx.fill(); }
  }
  function setScoreboard(state) {
    $('board-sable').textContent = String(state.score.sable); $('board-iron').textContent = String(state.score.iron);
    $('board-body').replaceChildren(...state.actors.map((actor) => {
      const row = document.createElement('tr'); row.className = actor.team + '-row' + (actor.player ? ' self-row' : '');
      const values = [actor.callSign + (actor.player ? ' / YOU' : ''), actor.role.toUpperCase(), String(actor.kills), actor.alive ? 'ACTIVE' : 'DOWN', String(actor.credits)];
      for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); } return row;
    }));
  }

  $('deploy-button').addEventListener('click', () => handlers.deploy?.());
  $('brief-audio').addEventListener('click', (event) => { const muted = handlers.mute?.(); event.currentTarget.textContent = muted ? 'Sound off' : 'Sound on'; });
  $('buy-ready').addEventListener('click', () => handlers.ready?.());
  $('buy-close').addEventListener('click', () => handlers.ready?.());
  $('resume-button').addEventListener('click', () => handlers.resume?.());
  $('restart-button').addEventListener('click', () => handlers.restart?.());
  $('end-restart').addEventListener('click', () => handlers.restart?.());
  $('next-round').addEventListener('click', () => handlers.next?.());
  $('mute-button').addEventListener('click', (event) => { const muted = handlers.mute?.(); event.currentTarget.textContent = muted ? 'Sound on' : 'Mute sound'; });
  $('sound-level').addEventListener('input', (event) => handlers.volume?.(Number(event.target.value) / 100));

  return {
    bind(value) { handlers = value; }, show, hideScreens,
    showStart() { show('title'); },
    showBuy(credits, seconds) { setBuy(credits, seconds); show('buy'); },
    updateBuy(credits, seconds) { setBuy(credits, seconds); },
    showPause() { show('pause'); },
    showEnd(state) {
      $('end-heading').textContent = state.matchOver ? (state.winner === state.player.team ? 'Operation secured' : 'Operation lost') : (state.winner === state.player.team ? 'Sector secured' : 'Sector lost');
      $('end-copy').textContent = state.endReason + ' ' + (state.matchOver ? 'The operation is complete.' : 'Prepare the next deployment.');
      $('end-score').textContent = state.score.sable + ' / ' + state.score.iron;
      $('end-earned').textContent = '+' + state.lastEarned;
      $('next-round').hidden = state.matchOver; $('next-round').textContent = 'Prepare next round'; show('end');
    },
    update(state) {
      lastState = state;
      $('round-label').textContent = String(state.round).padStart(2, '0') + ' / 07';
      $('score-sable').textContent = String(state.score.sable); $('score-iron').textContent = String(state.score.iron);
      $('clock-value').textContent = state.phase === 'buy' ? 'BUY ' + formatClock(state.phaseTime) : state.objective.planted ? formatClock(state.objective.timer) : formatClock(state.phaseTime);
      $('side-label').textContent = state.player.team.toUpperCase();
      const attacking = state.player.team === state.attackTeam;
      $('mission-kicker').textContent = state.objective.planted ? 'RELAY TIMER' : attacking ? 'PRIMARY TASK' : 'DEFENSE TASK';
      $('mission-title').textContent = state.objective.planted ? 'Disarm the relay' : attacking ? 'Secure the relay' : 'Hold the foundry';
      $('mission-copy').textContent = state.objective.planted ? (attacking ? 'Device live / defend the relay pad and stop the signal.' : 'Device live / reach the relay and disarm it.') : attacking ? 'Move through the foundry and arm the signal charge.' : 'Deny the plant. If it is armed, reach the relay and disarm it.';
      $('health-number').textContent = String(Math.max(0, Math.ceil(state.player.health))); $('health-fill').style.width = Math.max(0, state.player.health) + '%';
      $('armor-value').textContent = String(Math.max(0, Math.ceil(state.player.armor))); $('credits-value').textContent = String(state.player.credits);
      const weapon = WEAPONS[state.player.weapon.id]; $('weapon-name').textContent = weapon.name;
      $('ammo-mag').textContent = String(state.player.weapon.magazine); $('ammo-reserve').textContent = '/ ' + String(state.player.weapon.reserve);
      $('utility-line').textContent = 'SMOKE ' + state.player.smoke + '  /  ' + (state.player.smoke ? 'READY' : 'EMPTY');
      $('weapon-panel').classList.toggle('empty', state.player.weapon.magazine === 0); $('status-panel').classList.toggle('hurt', state.player.health < 40);
      $('team-strip').replaceChildren(...state.actors.filter((actor) => actor.team === state.player.team).map((actor) => {
        const row = document.createElement('div'); row.className = 'roster-row' + (actor.player ? ' self' : '') + (!actor.alive ? ' down' : '');
        const name = document.createElement('span'); name.textContent = actor.callSign + (actor.player ? ' / YOU' : '');
        const status = document.createElement('b'); status.textContent = actor.alive ? String(Math.max(0, Math.ceil(actor.health))) : 'DOWN'; row.append(name, status); return row;
      }));
      $('interaction').textContent = state.interaction || ''; $('interaction').classList.toggle('on', Boolean(state.interaction));
      $('reticle').classList.toggle('aiming', state.player.aiming); $('reticle').classList.toggle('crouched', state.player.crouching);
      drawMap(state); if (!screens.board.hidden) setScoreboard(state);
      const now = performance.now(); feedItems = feedItems.filter((entry) => entry.time > now);
      if (feedItems.length < feed.children.length) feed.replaceChildren(...feedItems.map((entry) => { const row = document.createElement('div'); row.className = 'feed-item' + (entry.head ? ' head' : ''); row.textContent = entry.text; return row; }));
    },
    damage() { const vignette = $('damage-vignette'); vignette.style.opacity = '0.85'; setTimeout(() => vignette.style.opacity = '0', 210); },
    toast, event, banner,
    hitmarker(head = false) { const mark = $('hitmarker'); mark.classList.add('on'); mark.classList.toggle('head', head); clearTimeout(mark._timer); mark._timer = setTimeout(() => mark.classList.remove('on', 'head'), 95); },
    scoreboard(state) { setScoreboard(state); show('board'); },
    closeScoreboard() { if (!screens.board.hidden) hideScreens(); },
    get currentState() { return lastState; },
  };
}
