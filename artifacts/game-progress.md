# Game progress

## Intent and constraints

Build OPERATION IRON VEIL for make.fun `threejs-fps-02` as an original, offline, static Three.js tactical FPS. Use the verified @zynq connection and already paired keypair. Do not create a wallet or submit to make.fun before the user reviews final deliverables and approves.

Official constraints: Node 22 main.ts writes `/output/game`, `/output/screenshots`, and deterministic `dossier.json`; use Three.js 0.187.0 and the unchanged `vendor/makefun-threejs.ts`; 3-4 real browser screenshots; static modules only with no runtime network; signed entries must include genuine transcripts. Current session began after the competition opened.

## Decisions

- Player is one of five SABLE attackers, with four ally bots versus five IRON defender bots; sides swap after round three.
- One custom relay plant/defuse objective, three named lanes, short economy rounds, buy menu, original weapons and procedural audio.
- Procedural geometry, canvas textures and Web Audio keep runtime offline and avoid external asset services.
- Use a fixed-step 60 Hz state update, custom capsule/AABB collision and deterministic seeded random.

## Phase checkpoints

- Official instructions and kit: complete; all 28 files match the kit manifest hashes.
- Authentication: complete before this phase; existing API key resolves to @zynq and its local keypair is already an agent wallet on that account. User approved development under that connection.
- Design brief and encounter contract: complete.
- Playable core: in progress; authored refinery geometry, collision proxies, procedural materials, first-person movement, recoil/spread weapons, 5v5 roster, route graph, sound investigation, objective loop, buy economy, smoke and round transitions are implemented.
- Graphics and UI: in progress; original field briefing, HUD, map/radar, armory, pause, scoreboard and result screens are wired. The compact layout and bot lethality were revised from a live browser pass.
- Gameplay, bot and browser QA: in progress; the first live run confirmed the game renders and the round loop resolves, but an AFK player lost the first round. No claim is made yet for the full input, objective or performance matrix.
- Genuine screenshots, dossier and official pre-submit check: pending.
- Repository and transcript bundle: pending.
- make.fun submission: explicitly held for user review and approval.

## Current defects and next actions

Continue tuning from real browser play. Specifically verify that the buy controls remain clickable during the countdown, bots use the approaches and do not instantly delete a stationary player, the operator can move/fire/reload/smoke/plant/defuse, and a round can start again. Replace starter screenshots with genuine browser captures, check the source and asset caps, bundle only genuine session records, and run the official local pre-submit check. The make.fun submission remains held for final user approval.
