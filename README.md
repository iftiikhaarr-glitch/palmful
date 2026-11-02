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

Open **https://iftiikhaarr-glitch.github.io/palmful/?emulate=1** in Chrome or
Edge and click **Start**. A seed floats, waiting for a palm.

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
Space, ← ×6, then ↑ ×7, → ×4 → ring blooms: "All three in bloom". F, then F
again → hatches again.

Add `&debug=1` for the metrics panel. Laptop mode uses Meta's IWER emulator with
a narrowed field of view and dots in place of a hand. It shows that the game
logic works; it does **not** show tracking quality or Quest performance.

## Test on a Quest 3 / 3S

Follow [`docs/QUEST_TEST_GUIDE.md`](docs/QUEST_TEST_GUIDE.md) (3 minutes of play,
with what to send back and pass/fail criteria).

## Develop

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm test          # simulation unit tests (Node, no browser)
npm run build     # production build in dist/
npx vite preview --port 4173 &   # serves dist/ at https://localhost:4173
npm run e2e -- https://localhost:4173/ .   # plays a full session headlessly
node test/landing-e2e.mjs https://localhost:4173/ .   # 2D landing without WebXR
npm run dev       # IWSDK dev server + emulator in a managed browser
```


## Layout

```
src/palm/math.ts           allocation-free vector helpers
src/palm/hand-frame.ts     WebXR joints -> palm frame + finger paths, One-Euro filter
src/palm/creature-sim.ts   friction sliding, finger walking, bloom (pure, tested)
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
