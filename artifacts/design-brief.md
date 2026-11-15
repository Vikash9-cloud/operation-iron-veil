# OPERATION IRON VEIL

## Design brief

**Player promise.** Lead a five-person strike cell through the storm-sheltered Vesper Foundry, where every sightline, reload and credit spend matters before the opposing wardens can seal the relay.

**Target feeling.** Controlled pressure, readable industrial space, sharp weapon response and a satisfying post-round decision. The game should feel authored and tactile without borrowing any commercial game's map, faction names, weapon names, art or interface.

**Primary verb.** Move, stop, acquire a sightline and fire accurately. Shooting while moving widens spread; crouching and settling the weapon tighten it. Head hits deal more damage than torso or limb hits.

**Secondary verbs.** Reload, crouch, jump, sprint between cover, switch weapon, buy gear, deploy a smoke canister, plant or disarm the relay charge, check the tactical board and call a pause.

**Repeated loop.** During a short buy interval, choose a weapon and one utility item. During the round, move through one of three lanes, clear corners, trade fire, listen for activity and contest the relay pad. Survive, plant or disarm to earn credits, then adjust the next buy.

**Match arc.** First to four round wins, side swap after round three, short 12-second buy windows and 55-second live rounds. The player joins the SABLE team with four allied operators against five IRON bots; after the swap, the same 5v5 rosters reverse attack and defense roles. A round ends by elimination, a live relay detonation/defuse or the attacker timer expiring.

**Core loop contract.** The player clears routes and controls the relay pad to secure a round while five opposing operators take angles and answer sound; the timer, limited health and ammunition create risk. A win grants credits and score, while a loss preserves a smaller allowance and reveals the cause. The next buy changes the player's options, and a 1-second recap lets the next round begin quickly.

**Encounter plan.** Vesper Foundry is a compact three-lane refinery with the south canal entrance, north slag hall, a central relay pad, the east condenser run and the west furnace gallery. A low service conduit creates a crouch/jump route; the raised chain gantry gives a risky long sightline; drums, tanks, cooling cabinets and concrete shields create named cover. Waypoints and cover slots support route choice, site holds, rotations, retreats and line-of-sight checks. The relay pad is visible from two lanes but cannot be safely held from spawn.

**Bots.** Each bot has a role, route goal, preferred range, reaction delay, aim error, health, magazine and state. Route nodes form a connected navigation graph. Line of sight is checked through wall and cover blockers; firing and thrown utility create sound events that nearby bots can investigate. Attackers escort or take the objective, defenders anchor or rotate, and all bots reposition when a teammate falls. Allies avoid blocking the player and expose concise intent cues on the tactical HUD.

**Weapons and economy.** Original arsenal: Furnace-7 carbine, Pike-9 sidearm, Needleline marksman rifle and Breaker-12 scatter gun. Each weapon has authored rate, recoil, spread, reload, magazine, reserve and damage. A smoke canister is purchasable and has a visible, time-limited cover volume. Players earn credits for round outcomes and eliminations; the buy panel shows exact cost and remaining funds.

**Art direction.** Vesper Foundry is a late-shift metals plant under a cold rain canopy: graphite ceramic, oxidized copper, soot-black steel, chalk marks and work-light amber, with SABLE cyan and IRON vermilion as team signals. Procedural canvas textures supply metal grain, concrete mottling, serial stencils and hazard paint. Shape and animation back up every team color. Layered gantries, pipes, tanks, cable trays, glassed control booths and lit furnace throats establish scale. Contact lights and a restrained fog layer add depth without hiding combat silhouettes.

**HUD states.** Briefing/start, live HUD, buy panel, tactical scoreboard, pause/settings, round recap, death/spectator and match results. The HUD keeps health and ammo at the lower edges, score and timer at the top, objective location and team intent near the minimap, with short kill and interaction feedback outside the center sightline.

**Sound matrix.** Procedural offline Web Audio: low refinery room tone; varied carbine/sidearm/marksman/scatter reports; distant and near footsteps; reload, hit, head-hit, plant, defuse, smoke and round-end cues; restrained menu and buy clicks. All audio unlocks on the first user gesture and has independent master/SFX/ambience controls. No external audio files or network service are required at runtime.

**Technical contract.** Static ES modules, Three.js 0.187.0 from the official kit, one import map, no runtime network requests, no build step. A fixed 60 Hz simulation owns state and collision; rendering interpolates it. Custom XZ capsule-vs-AABB movement keeps collision independent from detailed geometry. Seeded randomness controls bots, spread and effects. Reusable geometry/materials and pooled short-lived VFX bound draw calls and allocations.

**Non-goals.** Network multiplayer, copied commercial maps or terminology, external runtime assets, realistic gore, unreadable bloom/fog, randomized unfair bot hits, hidden debug controls, and a title-screen-only deliverable.

## Acceptance targets

- A complete 5v5 round can start, be played with real keyboard and mouse, end by elimination or relay objective, award credits and start again.
- WASD, mouse look, sprint, crouch, jump, fire, aim, reload, weapon switch, smoke, interact, scoreboard, pause and buy all produce visible state changes.
- Bots navigate routes, see through open lanes only, react to nearby sound, use cover and fire/reload with readable limits.
- Obstacles block movement and shots; head, body and limb hits resolve differently.
- The web page works offline in Chrome/WebGL2 and has no console or failed-request errors.
- The official output gate passes: game directory under file/byte limits, exact vendored Three.js files, local module/media references, 3-4 genuine screenshots and dossier generated by the unchanged vendor helper.
- Real input playthroughs cover movement, firing, reload, objective, round change, buy/economy, pause and retry. Renderer diagnostics and a current-run evidence manifest are saved.
