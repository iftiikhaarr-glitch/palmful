# Palmful

A tiny creature lives on your open hand. Tip your palm to guide it; rest it on
the glowing fingertip and that fingertip blooms. Hands only, seated, built for
Meta Quest with the Immersive Web SDK (WebXR), for the Meta VR Start Developer
Competition 2026 (Gaming track, New Experience).

**Status: prototype, emulator-tested only.** Bloom (default), catch
(`?catch=1`) and optional two-hand catch (`?catch=1&hands=2`) each pass unit
tests and full-session runs in emulated WebXR. **Nothing has been tested on a
headset yet.** [`docs/QUEST_TEST_GUIDE.md`](docs/QUEST_TEST_GUIDE.md) lists what
still needs a Quest 3/3S and the pass/fail criteria.

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

Catch one gold (circle), one blue (diamond) and one pink (triangle) seed. The
progress display reads "Gold 0/1 · Blue 0/1 · Pink 0/1"; the seed you're on is
outlined. Each colour always falls in the same lane (gold left, blue right,
pink centre).

| Key | Does |
|---|---|
| Space | raise your hand palm up (press again later: back to the start position) |
| ← / → | move the hand left / right (2 cm per press; hold to repeat) |
| ↑ / ↓ | move the hand forward / back |
| W / S | move the hand up / down |
| C | cup / open the hand |
| 1 / 2 / 3 | testing aid: choose the gold / blue / pink seed (uncaught ones only) |
| T | tip the palm sideways (spills a resting seed) |
| F | toggle a fist (after 3/3, a fist restarts and resets every count) |
| H | lower / raise the hand (simulates tracking loss; status shows HAND HIDDEN) |
| ? | hide / show the help panel |

Use the **Hand display: Small / Medium / Large** buttons in the panel to change
how thick the emulated hand is drawn. The choice is saved in this browser. It
changes only the drawing, never the joint positions, so the hand stays aligned
with the ring and the seed.

One full session: Space → the gold seed glows, then drifts down. Hold ← (and
↑/↓ if needed) until the ring under it turns green. When it lands in the open
palm, press C → "Gold 1/1", a gold flower grows; press C again to open. Blue
comes down on the right, pink in the centre. 3/3 → "All three caught". If you
miss, the same seed comes back and your earlier catches stay. To play again,
press C to open your hand, then F (a fist) → everything resets; F again opens it.
A fist straight from the catching cup does nothing: the hand must open first,
so the last catch can't restart the game by accident.

### Optional two-hand catch: https://iftiikhaarr-glitch.github.io/palmful/?emulate=1&catch=1&hands=2

Same game, and still fully playable with one hand. When both hands are tracked,
either open, palm-up hand may catch. The keys above move one hand at a time; **L**
switches between the right and left hand (Space raises the hand you're
controlling). A seed resting in a palm stays with that hand. If that hand is
lost, the seed waits for it. A falling seed pauses when the hand under it is
lost, and goes to the other hand only after 3 s. Each flower stays on the hand
that caught it. Two-hand play is only on with `&hands=2`.

**How the laptop view looks.** The emulated hand appears as a soft, shaded 3D
hand (palm, thumb, fingers and a wrist that fades out), built every frame from
the emulated joints, so it is exactly where the game thinks your hand is. Open,
cup and fist blend into each other over about 0.2 s. Joint dots are hidden; add
`&debug=1` for the metrics panel and the full bright skeleton (joints and bones)
seen through a faint hand. The landing ring, a seed and the flowers stay faintly
visible where the hand covers them.
The camera tilts and zooms on its own to keep the progress display, seeds,
ring and hand inside the window at any window size. In smaller windows the
help panel starts collapsed (**Show help** or **?**). All of this exists only
with `?emulate`: on a headset you see your own hand and no backdrop.

Laptop mode uses Meta's IWER emulator and draws a dark room into the emulated
view (only with `?emulate`; the real Quest AR view is never covered).
It shows that the game logic works. **Emulator results do not show real-hand
tracking, cup detection on real hands, comfort, or Quest frame rate.**

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
node test/twohand-e2e.mjs https://localhost:4173/ .   # two-hand catch session
node test/landing-e2e.mjs https://localhost:4173/ .   # 2D landing; backdrop only with ?emulate
node test/contrast-check.mjs https://localhost:4173/ .   # laptop view: object contrast >= 3:1
node test/layout-sizes.mjs https://localhost:4173/ .   # 5 window sizes x both modes: nothing clipped
npm run dev       # IWSDK dev server + emulator in a managed browser
```


## Layout

```
src/palm/math.ts           allocation-free vector helpers
src/palm/hand-frame.ts     WebXR joints -> palm frame + finger paths, One-Euro filter
src/palm/creature-sim.ts   friction sliding, finger walking, bloom (pure, tested)
src/palm/catch-sim.ts      catch mode: three seeds, landing, cup, miss (pure, tested)
src/palm/two-hand.ts       optional two-hand rules: which hand catches (pure, tested)
src/palmful-system.ts      IWSDK system: reads joints, renders, metrics, restart
src/laptop-emulator.ts     ?emulate=1 laptop mode (IWER + keyboard hand, view fitting)
src/hand-silhouette.ts     laptop-only procedural 3D hand (and the see-through cue copies)
src/landing.ts             2D page: Enter AR button, or where to play
test/                      unit tests + emulator drive scripts
docs/PROJECT_RECORD.md     decisions, verified facts, open issues, next task
docs/DEVICE_TEST.md        headset protocol and pre-registered decision rules
```

## Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push
to `main` (one-time: repo Settings → Pages → Source: GitHub Actions).

All visuals and sound are procedural; there are no third-party assets.
