# Palmful

A tiny creature lives on your open hand. Tip your palm to guide it; rest it on
the glowing fingertip and that fingertip blooms. Hands only, seated, built for
Meta Quest with the Immersive Web SDK (WebXR), for the Meta VR Start Developer
Competition 2026 (Gaming track, New Experience).

**Status: 48-hour feasibility prototype.** Logic is verified in the IWSDK
emulator and by unit tests. **Nothing has been tested on a headset yet.** See
`docs/DEVICE_TEST.md` for what is and isn't verified and the criteria for
abandoning the concept.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm test          # simulation unit tests (Node, no browser)
npm run dev       # dev server + IWSDK emulator in a managed browser
npm run build     # production build in dist/
```

In the emulator: press **Enter AR**, switch input to **hands** in the emulator
panel, raise the right hand palm up, then tilt it.

URL flags: `?debug=1` shows fps, tracking %, jitter and losses above the palm.
`?skeleton=1` draws hand joints as dots (the emulator does not draw hands in AR).

On a Quest: open the deployed URL in the Quest Browser, tap **Enter AR**, and
put the controllers down.

## Layout

```
src/palm/math.ts           allocation-free vector helpers
src/palm/hand-frame.ts     WebXR joints -> palm frame + finger paths, One-Euro filter
src/palm/creature-sim.ts   friction sliding, finger walking, bloom (pure, tested)
src/palmful-system.ts      IWSDK system: reads joints, renders, metrics
test/                      unit tests + emulator drive scripts
docs/PROJECT_RECORD.md     decisions, verified facts, open issues, next task
docs/DEVICE_TEST.md        headset protocol and pre-registered decision rules
```

## Deploy

`.github/workflows/pages.yml` builds and publishes to GitHub Pages on every push
to `main` (one-time: repo Settings → Pages → Source: GitHub Actions).

All visuals and sound are procedural; there are no third-party assets.
