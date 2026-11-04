# AOTEAROA: UNDERWORLD: project handoff for Claude

Read this first in any new session. It is the full context needed to keep working without the old chat.

## Who and what
- The owner (jimmylovnjames) is an expert builder who directs via chat, often from a **OnePlus 12 phone** (24 GB RAM, Adreno 750). They grew up in South Auckland and want the game to feel authentic to NZ hood life. They do the voice work themselves.
- Working style they asked for:
  - Terse, senior-level answers. Infer the plan, state it in one line, execute.
  - Don't ask permission for reversible things. Disagree when they're wrong.
  - Be honest about what's unverified (a software renderer can't judge game feel or phone performance).
  - Surface risks in one line each.
  - "Always try before saying something's impossible."
- The game is a single-file Three.js (r169) phone game: a first/third-person open-world crime story set in **real Manurewa + Clendon Park, South Auckland** (OpenStreetMap data, 1:1).
  - All crews, characters and events are fictional; real gang names were removed in Run 12.
  - Chain stores use stand-in names (PAK'N'PAY, THE STOREHOUSE…); place names are real.
  - No real house numbers are tied to characters.
- **Branch:** `ccr-e2a07ab1-xlsvi1` (push with `git push -u origin ccr-e2a07ab1-xlsvi1`).
  - Don't open PRs unless asked.
  - Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` plus the session line the harness gives you.
  - No model IDs in commits.
- Deliverable each run: `AOTEAROA_UNDERWORLD_RunNN_PHONE.zip` containing `index.html README.txt VOICE_SCRIPT.md voice/`, sent to the user with a couple of screenshots. Assets stream from jsDelivr: `https://cdn.jsdelivr.net/gh/jimmylovnjames/Nz-gangz@ccr-e2a07ab1-xlsvi1/assets/`, so **push before shipping the zip**.

## Build, run, test
- `node tools/build.mjs`: concatenates `src/engine/*.js` (sorted) into one inline module inside `src/shell.html` and writes `index.html`.
  - Module scripts can't load from `file://`, hence the single file.
  - Always rebuild after editing `src/`.
- `node tests/smoke.cjs`: Playwright with headless SwiftShader at `?gfx=low`. **74 checks**, the whole story end to end plus every mechanic; takes ~15 min.
  - Run it alone: a second SwiftShader page (e.g. a MEDIUM screenshot run) halves the frame rate and the Mikey chase times out.
  - Strikes resolve a few frames after the tap, so fight loops use the `strike(page)` helper (tap, wait until `fight().busy` is false).
  - Run it in the background and wait on the log.
  - Must be 100% before shipping.
- Quick syntax check: extract the module from `index.html` and run `node --check`. See git history for the one-liner.
- URL params: `?gfx=low|medium|high|ultra`, `?assets=off|cdn`, `?people=off`.
- Debug hooks:
  - `window.__auGame`: state, teleport, face, look, talk, hit, fight (move/busy/combo/pop/windups/blocks), block, targets, drive, carTo, startHustle, heat/addHeat/clearHeat, c1, view, feel, jumpTest, nearFence, grabbed, weapon, pickups, carHealth, peds, police…
  - Pose lab: `__auGame.lab([{ look, x, z, ry, vx, vz, ph, clip, u, mode, react, rt, down, weapon }])` spawns frozen figures (gait phase `ph`, clip time `u`, fall time `down`); `__auGame.fpLab({ name, u, block, hold })` freezes the first-person fists. `lab([])` / `fpLab(null)` clears.
  - `window.__auStory`: advance, choose, skip, phone, minigame.
  - `window.__auDebug`: scene, camera, city, updateCull, THREE.
  - `window.__auStats`: fps, draw calls, triangles.
- Realistic people load on any GPU not detected as weak/software, whatever the graphics setting (Run 21c: LOW used to swap in the blocky stand-ins and the user read that as the people looking funny again). SwiftShader is detected LOW, so tests at `?gfx=low` still use stand-ins; screenshot at MEDIUM to see the real bodies. At MEDIUM click `#start` with `page.evaluate(() => document.getElementById('start').click())`: a Playwright click times out on the slow frames.
- Screenshot scripts live in the session scratchpad (gone next session). Write a small Playwright script:
  1. Serve the repo.
  2. Click `#start`.
  3. Play through the prologue with `__auStory` advance/skip/choose (choice 1, then 0).
  4. Teleport and screenshot.
  - Use `timeout: 180000` on screenshots: SwiftShader frames take ~1 s.

## Engine layout (`src/engine/`, ~5.9k lines)
| file | what |
|---|---|
| 00-core | THREE imports, global shader uniforms `G`, height fog, QUALITY tiers, settings, PostPipeline (HDR, SSAO, bloom, AgX/ACES, FXAA) |
| 05-mapdata | **generated** OSM map data (`MAPDATA`, base64 int16 dm). Don't hand-edit |
| 10-sky | time presets (golden/overcast/night), HDRI sky via PhotoAssets, sun, shadows |
| 20-texforge / 25-photo / 30-materials | GPU-generated PBR textures; CC0 Poly Haven photo textures/HDRIs streamed over them; MaterialLib + MAT_DEFS |
| 40-geometry | GeoBuilder (typed buffers, chunked batches by cull class base/detail/far), distance culling (`CULL_DIST`, `updateCull`), CollisionGrid (boxes, circles, segments, OBBs, polygons, each with a `top` height; `collides(x,z,r,feet)`, `first()`), ground grid (`groundHeight`, `isCarriageway`) |
| 50-city | builds the real district from MAPDATA: ground layers, kerbs, markings, buildings (houses with hip/gable roofs, shops with verandahs, Southmall, big boxes…), fences, furniture, platforms/rails, skate park, far context ring, story `places`, `houses`, weapon spots |
| 53-props | instanced props (lamps, poles, letterboxes, bus stops, signals, goalposts, hoops), trees, **parametric cars** (6 types + police livery, `city.carKit`), wires, regional hills |
| 54-characters | Human rig (18 bones) with procedural animation: two-bone IK (`ik2`, `aimQuat`) for legs and arms; a foot-planted gait driven by the root's real motion (walk/jog/sprint cadence, stance, lift, pelvis/chest counter-rotation, turn lean); bladed boxing guard; strike clips (`CLIPS`: jab, cross, hook, upper, hay, swing, knee, parry, throw; hand keys relative to the shoulder, Catmull-Rom); directional hit reactions; dodge duck; knockdown `fallPose` + `getUp`; seated, air, climbing. Stand-in bodies, `PEOPLE` loader for the realistic MakeHuman bodies, `Fists` first-person arms (real forearms from `people/fparms.bin`, clips in `FCLIPS`/`FGUARD`), weapons (`WEAPON_DEF`, `weaponMesh`) |
| 55-weather | rain |
| 56-minigame / 57-lounge / 58-story | prologue: Kiwi Knuckle Kings console fighter on Manu's couch; dialogue system + VoiceBank; `SCRIPT` (all voiced lines with ids), `TEXTS` (phone), CAST |
| 59-phone | phone UI (messages, JOBS) |
| 60-game | `createGame()`: everything gameplay. The player is `eye` (Object3D); the render `camera` follows it in `syncCamera` (first person, or third-person boom with `playerBody`). Story stages, missions, fighting (hostiles, fightDirector token + telegraph bar colours, brawlerMove, meleeAI with `EATK` attacks and `STYLES` per fighter, enemy blocking, `PMOVES` player strikes resolved on the impact frame by `moveFrame`/`strike`, 4-hit `COMBO`, parry, counters, guard break, soft `lockOn`, `pop` callouts, applyHit/koTarget, grab/throw, finishers, weapons), movement (momentum, dodge, jump/vault/climb), driving frame, shops, hustles, heat/police/peds, Chapter One, saves (`MAP_VERSION`), HUD, banners, beacon, minimap |
| 61-drive | PlayerCars (enter any parked car, weighted drift handling, damage, smoke, engine audio), Traffic (road graph from map vertices, drive on the left) |
| 62-shops | 110 real shops from map signs: food heals, energy drinks, barber/supermarket rep, gym punch power |
| 63-street | Heat (stars), Police (Battenburg cars chasing on the road graph, bust = Manurewa Police Station + 30% fine), Pedestrians (spatial-grid spawns, scatter, knockdown) |
| 64-sfx | synthesised WebAudio SFX and ambience (birds, crickets, traffic) |
| 99-boot | boot sequence, settings panel, frame loop, adaptive DPR |

Story stages (in order): `prologue, debt-find, debt-fight, debt-return, shorty-wait, shorty-meet, shorty-jobs, shorty-return, recruit, faction-choice, mission-courier/brawl, mission-return, complete, c1-call, c1-car, c1-pickup, c1-deliver, c1-dairy, c1-rivals, c1-wait, c1-manu, c1-home, c1-done`. After `recruit`, Shorty texts repeatable hustles.

## Asset pipelines (source data is NOT in the repo; re-download if you need to rebuild)
- **Map**: `cd tools && npm i`, then `node tools/osm-build.mjs <overpass.json>` writes `src/engine/05-mapdata.js` (ODbL; keep the "© OpenStreetMap contributors · LINZ" credit).
  - Get the extract from the Overpass mirror that works through the proxy: POST `data=` to `https://maps.mail.ru/osm/tools/overpass/api/interpreter`.
  - Query: `[out:json][timeout:180];(way(-37.042,174.858,-37.014,174.906);rel["type"="multipolygon"](-37.042,174.858,-37.014,174.906);node(-37.042,174.858,-37.014,174.906)[~"."~"."];);out body;>;out skel qt;`
  - overpass-api.de resets connections. Nominatim works for lookups.
  - Crop and origin are at the top of osm-build.mjs.
- **People**: `python3 tools/people-build.py <makehuman/data> <system assets dir> assets/people`. `PEOPLE_ONLY=name1,name2` rebuilds a subset; `fparms` builds the first-person arms.
  - Inputs (all CC0):
    - MakeHuman repo `makehuman/data`: blobless sparse clone of `https://github.com/makehumancommunity/makehuman.git` with `targets/macrodetails/*`, `rigs/*`, `3dobjs/*`, `eyes/*`.
    - System assets zip: `https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip` (280 MB; extract only the skins, clothes, hair, eyebrows and eyes named in the CAST dict).
  - The script strips the MakeHuman logo from the tees (`delogo`).
  - `curl_fingers` bakes a loose fist into every body (the game rig has no finger bones) and a tight one into `fparms`. The palm normal must rotate with each joint; recomputing it from world down gives a claw.
  - `MESH_ONLY=1` rewrites just the `.bin` meshes (no texture churn). `PEOPLE_ONLY=fparms` builds only the first-person arms.
  - Looks: manu, shorty, darren, kev, mikey, pita, crewA-C, pedF1-3, pedM1-2, player.
- **Textures/HDRIs**: Poly Haven CC0 (`https://api.polyhaven.com/files/<id>`); mapping in `25-photo.js` `PHOTO`. Credits in `assets/README.md`.
- **Voice**: `node tools/voice-script.mjs` regenerates `VOICE_SCRIPT.md` (134 lines) from SCRIPT. Recordings go in `voice/` and are listed in `voice/manifest.js` (`window.AU_VOICE = { id: 'file.m4a' }`).

## State at handoff (Run 21)
Done:
- Real map.
- Realistic people.
- Driving and traffic.
- Shops.
- Hustles.
- Heat and police.
- Pedestrians.
- Chapter One.
- Feel pass:
  - momentum movement and dodge;
  - brawler AI with health bars;
  - hit-stop, aim assist and slow-mo;
  - third person;
  - objective beacon, banners and retries;
  - rep titles and sound.
- Run 20:
  - jump, vault and climb;
  - grab and throw;
  - finishers;
  - bats and pipes;
  - real first-person arms;
  - weighted car handling with drift and damage.
- Run 21:
  - IK animation for everyone: planted feet, real stride/cadence, guard stance, boxing strikes, hit reactions, crumpling knockdowns and get-ups, dodge duck;
  - loose fists baked into all bodies, a fixed tight fist for first person;
  - fights: damage on the impact frame, jab-cross-hook-uppercut string with input buffering, soft lock-on, enemy jab/cross/hook/haymaker mix with telegraphs (bar orange, white for a haymaker), enemies cover up (bar blue; the uppercut breaks it, grabs beat it), parry (BLOCK tapped within 0.26 s of their impact), counter-hits on wind-ups, whiffs stagger them; Darren quick, Kev heavy.

Unverified (ask the user): feel and tuning (parry window 0.26 s, enemy block chance 0.25-0.4, combo damage 0.6/0.9/1.15/1.6, lock-on strength, gait cadence/stride, aim assist, dodge, enemy aggression, walk speed 4.4, drift amount, climb triggering, grab and bat strength) and phone performance (the IK adds per-character CPU; ~20-40 animated people). A busy view at MEDIUM is ~1.5–2.7M tris and ~350–450 draw calls. Each tuning knob is a single constant in 60-game.js / 61-drive.js.

Known rough edges:
- Hands are one bone: fists are baked, so open-hand gestures aren't possible.
- Punch contact is approximate (no hand-to-head collision); reach is generous for phones.
- Cars are parametric shapes, not models.
- Faint traces of the MakeHuman print on some tees.
- The ground is flat (no terrain heights).
- House cladding and colours are generated.
- The skate park layout is generic.

## Next steps the user has discussed
- Their call on the order:
  - Chapter Two (the rival crew retaliates).
  - Proper car models.
  - The next real area, joined to the map: Ōtara, Māngere, West Auckland, Porirua, then regional towns. They want "several areas joined", one at a time, accurate to the real places.
- Possible gameplay additions: police on foot, more mission types, terrain heights.
- They may send voice recordings or rewrite dialogue. Wire recordings via `voice/manifest.js`.
