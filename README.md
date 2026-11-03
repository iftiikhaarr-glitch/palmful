# Palmful

A tiny creature lives on your open hand. Tip your palm to guide it; rest it on
the glowing fingertip and that fingertip blooms. Hands only, seated, built for
Meta Quest with the Immersive Web SDK (WebXR), for the Meta VR Start Developer
Competition 2026 (Gaming track, New Experience).

**Status: feasibility prototype.** One complete session (three blooms, fist to
restart) is verified by unit tests and an automated end-to-end run in emulated
WebXR. **Nothing has been tested on a headset yet.** See
`docs/DEVICE_TEST.md` for what is and isn't verified and the criteria for
abandoning the concept.

## Try it on a laptop (no headset)

Two versions. Both run in Chrome or Edge with an emulated hand. Click
**Start**, then use the keys shown in the panel.

### Bloom (default): https://iftiikhaarr-glitch.github.io/palmful/?emulate=1

| Key | Does |
|---|---|
| Space | raise your hand palm up (press again later to level it) |
| ↑ / ↓ | tip the fingertips down / up (5° per press) |
| ← / → | roll toward the pinky / index side |
| F | toggle a fist (after three blooms, a fist replays) |
| H | lower / raise the hand (simulates tracking loss) |

One full session: Space → the seed lands and hatches; when Mote sits still a
golden trail shows the way. ↑ ×7 → middle fingertip blooms. Space, ↓ ×6 →
back to the palm. Space, → ×6, then ↑ ×7, ← ×4 → index blooms. Space, ↓ ×6,
Space, ← ×6, then ↑ ×7, → ×4 → ring blooms. F, then F again → hatches again.

### Catch (experiment): https://iftiikhaarr-glitch.github.io/palmful/?emulate=1&catch=1

| Key | Does |
|---|---|
| Space | raise your hand palm up (press again later: back to the start position) |
| ← / → | move the hand left / right (2 cm per press; hold to repeat) |
| ↑ / ↓ | move the hand forward / back |
| W / S | move the hand up / down |
| C | cup / open the hand |
| T | tip the palm sideways (spills a resting seed) |
| F | toggle a fist (after three catches, a fist replays) |
| H | lower / raise the hand (simulates tracking loss) |

One full session: Space → the seed glows, then drifts down. Hold ← or → (and
↑/↓ if needed) until the ring under the seed turns green; the seed lands in
the open palm. Press C → "Caught 1 of 3", a flower grows; press C again to
open. Repeat for the next seeds, which come from the other side. Three catches →
"All three caught". If you miss, the seed comes back. F, then F again to
open → a new seed.

Add `&debug=1` to either for the metrics panel. Laptop mode uses Meta's IWER
emulator and draws a dark room into the emulated view (only with `?emulate`;
the real Quest AR view is never covered), with dots and lines in place of a hand. It shows that the game logic works; it does
**not** show tracking quality, cup detection on real hands, or Quest performance.

## Test on a Quest 3 / 3S

Follow [`docs/QUEST_TEST_GUIDE.md`](docs/QUEST_TEST_GUIDE.md): both versions, 3 minutes
each, what to send back, pass/fail criteria, and which version to keep.

## Develop

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm test          # simulation unit tests (Node, no browser)
npm run build     # production build in dist/
npx vite preview --port 4173 &   # serves dist/ at https://localhost:4173
npm run e2e -- https://localhost:4173/ .   # plays a full bloom session headlessly
node test/catch-e2e.mjs https://localhost:4173/ .   # plays a full catch session
node test/landing-e2e.mjs https://localhost:4173/ .   # 2D landing; backdrop only with ?emulate
node test/contrast-check.mjs https://localhost:4173/ .   # laptop view: object contrast >= 3:1
npm run dev       # IWSDK dev server + emulator in a managed browser
```


## Layout

```
src/palm/math.ts           allocation-free vector helpers
src/palm/hand-frame.ts     WebXR joints -> palm frame + finger paths, One-Euro filter
src/palm/creature-sim.ts   friction sliding, finger walking, bloom (pure, tested)
src/palm/catch-sim.ts      catch mode: falling seed, landing, cup, miss (pure, tested)
src/palmful-system.ts      IWSDK system: reads joints, renders, metrics, restart
src/laptop-emulator.ts     ?emulate=1 laptop mode (IWER + keyboard hand)
src/landing.ts             2D page: Enter AR button, or where to play
test/                      unit tests + emulator drive scripts
docs/PROJECT_RECORD.md     decisions, verified facts, open issues, next task
docs/DEVICE_TEST.md        headset protocol and pre-registered decision rules
```

## Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push
to `main` (one-time: repo Settings → Pages → Source: GitHub Actions).

All visuals and sound are procedural; there are no third-party assets.
