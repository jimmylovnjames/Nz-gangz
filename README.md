# AOTEAROA: UNDERWORLD, Run 18 (cops, better cars, pedestrians, Chapter One)

Open `index.html` in a modern browser with internet access (Three.js loads from jsDelivr). On the phone: extract the ZIP and open `index.html`. For best results on a computer, serve the folder with `python -m http.server 8000` and visit `http://localhost:8000`.

Desktop: WASD or arrow keys to move, mouse to look (click to lock), click or HIT to punch, hold Q or right mouse to block, Shift (hold) to sprint, E to talk / shop / get in or out of a car, Space handbrake, Escape to pause. Phone: touch the lower-left circle and slide to walk, swipe the right side to look, tap TALK/HIT, hold BLOCK, tap RUN to toggle running (it lights up, and switches off when you stop). Tap the radar to collapse it. Saves stay in the device's browser storage; PAUSE has EXPORT/IMPORT SAVE FILE for moving between phones.

The streets are real; the crews, characters and events are invented. Run 12 replaced the real gang names used in earlier runs with fictional crews; old saves are converted automatically.

## Run 18: cops, cars, people, Chapter One

- **Heat and the cops.** Laying out a random, hitting someone with your car, ramming a patrol car or brawling in public raises your **HEAT** (stars on the HUD). NZ Police patrol cars (white with blue and yellow Battenburg checks, flashing lights, siren) come after you on the real streets and cut straight at you when they're close. Stay alongside one for a couple of seconds and you're **busted**: a night in the cells at Manurewa Police Station (its real spot on Great South Road) and a 30% fine. Break away and stay out of sight and the heat drops about a star every 9 seconds.
- **Better cars.** Six Japanese-import-style body types instead of four boxes: hatch (Corolla/Swift), sedan, wagon (Legacy/Caldina), double-cab ute (Hilux, with a tonneau cover), people mover (Odyssey/Estima) and a Hiace van. They have glass greenhouses with painted roofs and pillars, wheel arches with liners, alloys, mirrors, bumpers, grilles, lamps and NZ plates. Parked cars are a typical Manurewa mix; you can drive any of them.
- **People on the footpaths.** Passers-by walk the real streets on the footpath side: two young women, an aunty, an older Pākehā fella and a young guy (new MakeHuman CC0 bodies), plus a crew lad. They scatter when a fight starts or the sirens get close, go down if you hit them, and get back up and clear off.
- **Chapter One** (after the crew chapter). Tipene, the crew's fixer, texts you:
  1. **The run**: grab a car, pick up Manu (he rides in the passenger seat), meet Rawiri at the Southmall car park, and bring the parcel back to Tipene at Clendon skate park. Bring the cops with you and he sends you away to lose them.
  2. **Aunty Lani**: the woman who runs Clendon Dairy says a rival crew's boys keep raiding the shop and giving her mokos lip. Find them at the skate park: talk them down (needs 160+ rep) or take on all three.
  3. **Manu gets jumped**: he texts from Manurewa station. Fight off the two who did it, pick him up, and drive him home.
  Chapter One lines (Tipene, Rawiri, Aunty Lani, the rival crew, Manu) are in VOICE_SCRIPT.md, 134 lines in all. It's a draft; rewrite any of it.

## Run 17: things to do

- **Drive any parked car.** Walk up to one and TALK (E). Joystick or W/S for throttle and brake/reverse, left/right to steer, Space for the handbrake, HIT honks, TALK gets you out (on the right, NZ-style). Chase camera; drag the right side to look around. Kerbs bump the car, fences, walls, poles and parked cars stop it. Whatever car you leave stays where you parked it.
- **Traffic** drives the real streets on the left at 40–50 km/h, slows at intersections, queues behind other cars and stops (and toots) if you're in the way. If you stand in the road it can still clip you.
- **Shops do something.** The real dairies, takeaways, fish and chip shops, bakeries, supermarkets, pharmacies, barbers and the gym on the map: walk up and TALK.
  - Food heals (pie, fish 'n' chips, hot chips…); energy drinks and coffee give you a full-sprint boost (⚡ on the HUD).
  - The barber gets you a bit of rep; the supermarket's big shop for the whānau heals fully and earns rep.
  - The gym raises your **punch power** (3 levels, $30/$60/$120), which is saved.
- **Fighting has timing now.** Opponents wind up each punch before it lands, so you can step back or **BLOCK** (phone button, or hold Q / right mouse) to take 85% less (it costs energy). Punches have a short cooldown; every third hit in a combo is a **heavy** that knocks them back further. Health slowly comes back to 60 after a few seconds out of a fight; above that you need food. Getting knocked out costs 10% of your cash ("rolled while you were out").
- **Shorty keeps the work coming.** After his chapter he texts a new job every few minutes: a name, an amount and a real street. Some pay when you ask; some want to scrap (or pay if you lean on them). He flicks you 25% when it's sorted. It shows in JOBS, on the HUD line and as an orange dot on the radar.

## Run 16: the real South Auckland

The district is now **Manurewa and Clendon Park**, built from OpenStreetMap and LINZ data at 1:1 scale (about 3.4 km × 1.8 km, from the Clendon roundabout to Southmall and the station):
- **Every street in the right place with its real name** (Weymouth Road, Roscommon Road, Great South Road, Palmers Road, Barneys Farm Road…). The HUD shows the street and suburb you're on; the radar is the real street map. Street-name blades are Manukau-style white on green.
- **Every house on its real footprint** (about 7,900 LINZ building outlines): brick-and-tile, weatherboard and block houses with hip or gable roofs (longrun iron or concrete tile), garages and sheds. Sections are split between neighbours with paling, corrugated-iron and block fences, low front fences or hedges, concrete driveways and letterboxes at the boundary, wheelie bins out on the berm.
- **Streets built the NZ way**: kerb and dish channel, grass berms, concrete footpaths, cul-de-sac heads, roundabouts, dashed white centre lines, zebra crossings with belisha beacons, real bus stops, signalised junctions, mapped power poles and lines, streetlights.
- **Landmarks**: Southmall on its real outline with the glazed court roof and the 1911 Norfolk pine (with its cross) at the entrance; the Great South Road shops under verandahs; Manurewa station platforms on the electrified line; the war memorial; Clendon Shopping Centre and its big boxes; Te Matariki Clendon library; **Clendon skate park** with quarter pipes, a fun box, a ledge and a rail; netball and basketball hoops, rugby posts on the fields.
- **Context**: real streets and buildings continue past the playable area, the Hunua Ranges sit to the south-east and the Pahurehure Inlet to the west. The air is clearer (less haze), as it is in NZ.

Story places moved onto the map: Manu lives in Clendon a few streets from the skate park; Darren hangs round the Clendon shops, the dairy, the skate park, the fish and chip shop or Te Matariki (depends on your hometown); Shorty and Uncle Pita live over in Manurewa; Kev's panel shop is off Weymouth Road; Mikey hangs round Southmall, the Norfolk pine, the station or the Great South Road shops; the crews gather at Clendon skate park.

What is not real yet: the ground is flat (no terrain heights), house colours, cladding, roof types, windows and fences are generated (the data only has outlines), backyards are guessed, and the skate park layout is a typical council park, not surveyed. Chain stores use stand-in names with their real colours (PAK'N'PAY, THE STOREHOUSE, SUPA LIQUOR…) to stay clear of trademarks; local shops keep descriptive names like CLENDON DAIRY.

**Realistic people.** The cast and the crews are now full human models built from MakeHuman's CC0 assets: real body shapes (Manu, Shorty and Kev are big Polynesian builds, Uncle Pita is a koro, Mikey is a skinny kid), photographic skin, fitted clothes (Kev in overalls, Darren in a jacket, Manu in a black tee), sneakers and boots, hair, eyebrows and eyes. They use the same animation as before. They stream in after load (about 8 MB, cached); the old stand-in bodies show until then, and on LOW.

Map data © OpenStreetMap contributors (ODbL), building outlines from LINZ (CC BY 4.0); the extract in `src/engine/05-mapdata.js` is ODbL. Rebuild it with `node tools/osm-build.mjs <overpass.json>`; rebuild the people with `python3 tools/people-build.py <makehuman data> <system assets> assets/people`.

## Story: Chapter Zero (Runs 13–14)

1. **Friday night at Manu's.** You start on your cousin's couch playing *Kiwi Knuckle Kings 2 Turbo Edition*, a budget console fighter, best of three against him on an old CRT. Fight pad on phone: ◀ ▶ BLOCK SPECIAL KICK PUNCH. Desktop: A/D or arrows, J punch, K kick, L block, I or Space special. SKIP jumps to the end of the match.
2. **The debt.** Mid-match Manu brings up Darren, who owes him $400 and has been dodging him. After the match you can offer to go collect it.
3. **Darren.** He hangs out somewhere different depending on your hometown (outside a main-street shop, the park or the car park). Go soft (take $200, rest by Friday) or go hard (demand all $400, he squares up, knock him down).
4. **Back to Manu** at his house in the suburbs for your cut. Impressed, he brings up his mate Shorty (his weed man), who's always moaning that half the town owes him, and offers to pass on your number.
5. **Shorty texts you.** A phone button appears (top right) with MESSAGES and JOBS; texts buzz in with a toast. Shorty sends the street he lives on.
6. **Three jobs for Shorty**, in any order:
   - **Kev** at the panel shop, $600: tells you to get off his lot, so it's a scrap (he's tougher and hits harder than Darren).
   - **Mikey**, $300: bolts as soon as you get close. He sprints in bursts then blows out, so use RUN to catch him. If he gets away he comes back to his spot.
   - **Uncle Pita**, $150: a koro buying weed for his back with the grandkids' uniform money. Take it, or let him keep it and cover it yourself (if you can't, Shorty takes it out of your cut).
7. **Back to Shorty** for a quarter of what you brought in. He reacts to how you handled Pita, then tells you the crews down at Clendon skate park want to see you (the faction chapter from Run 11 continues from there).

Dialogue appears as subtitles with the speaker's name; tap the box to skip ahead. Every line has a voice slot: see **VOICE_SCRIPT.md** for all 100 lines with their ids. Put recordings in `voice/` next to `index.html` and list them in `voice/manifest.js` (`window.AU_VOICE = { pro_01: 'pro_01.m4a', ... }`). Lines without a recording stay as subtitles.

Saves from Run 11 that were partway through the old hometown errand continue as the Darren job.

## Run 15: photographic surfaces and sky

Roads, footpaths, kerbs, the town square, brick, plaster, weatherboard, corrugated iron, lawns, gravel, roller doors, fences and bark now use photo-scanned CC0 textures from Poly Haven (1K colour, normal and roughness/AO). Golden hour and overcast use real HDRI sky photos for the background, the lighting, reflections, the sun direction and the haze colour. Night keeps the generated sky. Credits and the full list are in `assets/README.md`.

They download once (about 14 MB) after the district is playable, from jsDelivr when the game is opened as a file, or from `assets/` when served over http. With no connection, or on the LOW setting, the game keeps its generated textures and sky.

## Run 12: what changed

Rendering
- Physically based materials for every surface, generated on the GPU at load (no image downloads): hot-mix asphalt, chip-seal, broom-finished concrete with slab joints and gum spots, clay pavers, brick, painted plaster, weatherboard, corrugated iron (painted and rusty galvanised), tilt-slab concrete, grass, gravel, timber. Each has colour, normal and roughness/AO maps.
- Sky with moving clouds, baked into image-based lighting; low golden-hour sun with soft shadows that follow the player; height fog that glows toward the sun.
- HDR post-processing: ambient occlusion, bloom, filmic tone mapping, colour grading, vignette, film grain, MSAA or FXAA.
- Wet streets: puddles that reflect the sky, darker damp surfaces, rain ripples, GPU rain.
- Windows show furnished rooms behind the glass (interior mapping) that shift as you move; shops are lit; some flats have lights on, more at night.
- Three looks: GOLDEN HOUR, OVERCAST, NIGHT (streetlights light the area around you). Weather: DRY, DRIZZLE, RAIN.

District (same road grid and mission coordinates as before)
- Town square with brick pavers, memorial, benches, planters and heritage lamps.
- Main-street shops with verandahs, shop signs and recessed shopfronts; apartment and office blocks; weatherboard houses with corrugated-iron hip and gable roofs, porches, picket/paling/block fences, letterboxes and driveways; tilt-slab warehouses with roller doors and containers; a park with a touch-rugby field and playground; paddocks and shelterbelts on the outskirts; hills on the horizon.
- Kerb and channel, footpaths and grass berms, NZ road markings (keep-left limit lines, broken yellow no-stopping lines, zebra crossings with orange-disc posts), power poles with sagging wires, streetlights, cabbage trees and street trees that sway, parked cars facing the right way for left-hand traffic.

Characters
- Rigged procedural people instead of capsules: faces, clothes, patch vests in faction colours, beanies. They walk, idle, cross their arms, watch you, put their guard up, punch, flinch and get knocked down.
- First-person fists that jab left/right, with camera shake and a red edge flash when you are hit.
- Mission items are a holdall bag and a taped parcel with a light beam.

Bugs fixed (these are why the 3D game "stayed still" in Runs 10–11)
- Movement was `NaN` for any key not yet pressed (`Number(undefined)`), so the player never moved, on phone or desktop.
- Run 11's `Math.absjoy.x` crashed every frame once the game started, which stopped rendering (the picture froze while the coordinates changed).
- The joystick was drawn over the menu and blocked NEW GAME on phones.
- Walking forward after turning went in a mirrored direction; the waypoint arrow and radar rotated the wrong way.
- Run 11 saves still load. If an old save puts you inside a new building, you are moved to the nearest open spot.

## Graphics settings and performance

PAUSE → GRAPHICS: LOW / MEDIUM / HIGH / ULTRA. It auto-detects the phone: Snapdragon 8 Gen 2/3 (OnePlus 12), Apple A16+ and similar get HIGH. Resolution adjusts itself to hold the frame rate as the phone warms up. PAUSE → SHOW FPS displays frames per second, render scale, draw calls and triangles. Please report those numbers. Texture detail for LOW applies after a reload.

Honest status: this build has only been verified in headless Chromium with a *software* GPU, which is correct but very slow. It has not yet run on a real phone GPU, so frame rate on the OnePlus 12 is unknown until you try it. If HIGH stutters, try MEDIUM.

## Development

The playable `index.html` is generated. Edit the sources in `src/` and rebuild:

```
node tools/build.mjs          # src/shell.html + src/engine/*.js -> index.html
node tests/smoke.cjs          # headless Chromium: prologue + mini-game, Darren job, crew chapter, saves, touch controls
node tools/voice-script.mjs    # regenerate VOICE_SCRIPT.md after editing lines in src/engine/58-story.js
```

The game must stay a single HTML file because browsers block module scripts from `file://` pages. If Three.js cannot load, the native WebGL exploration mode (no missions) starts after about twelve seconds.

## Earlier runs

- Run 4: PAUSE → EXPORT SAVE FILE / IMPORT SAVE FILE (JSON). Only import saves you trust; importing replaces the existing save.
- Run 5: sprint with Shift / hold RUN; energy regenerates and is saved.
- Run 6: native WebGL offline exploration mode if Three.js cannot load.
- Run 8: floating thumb-zone joystick, swipe-to-look, weather.
- Run 10–11: joystick diagnostics (`R12` label, input values and THREE/OFFLINE X/Z coordinates under the joystick).
