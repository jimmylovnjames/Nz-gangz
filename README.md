# AOTEAROA: UNDERWORLD, Run 15 (photo-scanned surfaces and sky)

Open `index.html` in a modern browser with internet access (Three.js loads from jsDelivr). On the phone: extract the ZIP and open `index.html`. For best results on a computer, serve the folder with `python -m http.server 8000` and visit `http://localhost:8000`.

Desktop: WASD or arrow keys to move, mouse to look (click to lock), click or HIT to attack, Shift to sprint, E to talk, Escape to pause. Phone: touch the lower-left circle and slide to walk, swipe the right side to look, TAP TALK/HIT, HOLD RUN. Tap the radar to collapse it. Saves stay in the device's browser storage; PAUSE has EXPORT/IMPORT SAVE FILE for moving between phones.

This is a playable *fictional district* vertical slice, not a geographically accurate map. All crews, characters and events are invented. Run 12 replaced the real gang names used in earlier runs with fictional crews; old saves are converted automatically.

## Story: Chapter Zero (Runs 13–14)

1. **Friday night at Manu's.** You start on your cousin's couch playing *Kiwi Knuckle Kings 2 Turbo Edition*, a budget console fighter, best of three against him on an old CRT. Fight pad on phone: ◀ ▶ BLOCK SPECIAL KICK PUNCH. Desktop: A/D or arrows, J punch, K kick, L block, I or Space special. SKIP jumps to the end of the match.
2. **The debt.** Mid-match Manu brings up Darren, who owes him $400 and has been dodging him. After the match you can offer to go collect it.
3. **Darren.** He hangs out somewhere different depending on your hometown (outside a main-street shop, the park or the car park). Go soft (take $200, rest by Friday) or go hard (demand all $400, he squares up, knock him down).
4. **Back to Manu** at his house in the suburbs for your cut. Impressed, he brings up his mate Shorty (his weed man), who's always moaning that half the town owes him, and offers to pass on your number.
5. **Shorty texts you.** A phone button appears (top right) with MESSAGES and JOBS; texts buzz in with a toast. Every house has a street address now (NZ tree and bird street names), so Shorty sends his.
6. **Three jobs for Shorty**, in any order:
   - **Kev** at the panel shop, $600: tells you to get off his lot, so it's a scrap (he's tougher and hits harder than Darren).
   - **Mikey**, $300: bolts as soon as you get close. He sprints in bursts then blows out, so use RUN to catch him. If he gets away he comes back to his spot.
   - **Uncle Pita**, $150: a koro buying weed for his back with the grandkids' uniform money. Take it, or let him keep it and cover it yourself (if you can't, Shorty takes it out of your cut).
7. **Back to Shorty** for a quarter of what you brought in. He reacts to how you handled Pita, then tells you the crews at the square want to see you (the faction chapter from Run 11 continues from there).

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
