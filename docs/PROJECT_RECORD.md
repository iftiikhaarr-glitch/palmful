# Palmful: project record

Keep this file current; it is how work continues across sessions.

## Competition facts (from the official rules and judging text the entrant supplied, 2 Nov 2026)

- Entry period ends **18 Nov 2026, 12:00 PM PT** = **19 Nov 2026, 00:00 Dubai** (Devpost page shows "Nov 19, 2026 @ 12:00am GMT+4").
- Eligibility: 18+, not resident of excluded territories; active Meta account with **Developer Access**; **Meta VR Start Program membership by the time of submission**.
- Division: **New Experience**: conceived and built on or after 24 Sep 2026 (this repo starts 2 Nov 2026).
- Hard requirement: fully usable with hands end-to-end; no controller ever needed.
- IWSDK (WebXR) entries submit **a link** (GitHub Pages or other host). It must stay available until winners are announced (~11 Dec).
- Video: under 3 minutes, public on YouTube or Vimeo; footage "as viewed on a Meta Quest device or via XR Simulator or another equivalent emulator". Show real gameplay; don't lean on AI-generated video.
- Form: name, tagline (140 chars), track, division, description (~500 words: inspiration, how built, future plans), hand-interaction notes (optional), target launch date.
- Judging: Stage 1 pass/fail viability; Stage 2 four equal criteria: Innovation & Creativity, Experience Design, Technical Implementation (min **60 fps** on Quest hardware), Polish & Presentation.
- Passthrough must be purposeful: the real room should change the experience. Entries using it are judged on scene understanding and holding up in untested rooms.
- No changes after the deadline. No logos/brands, no identifiable people other than the entrant.
- **Not yet seen:** the FAQ page (the claim that judging devices are Quest 3/3S is unverified).

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2 Nov | Concept: **Palmful**, a creature that lives on your palm; tilt to guide it; resting on the glowing fingertip makes it bloom | Hands-first by construction, seated, short sessions; aimed at Boldest Original Concept (an experience "that would fall apart on any other platform") |
| 2 Nov | Track: **Gaming** (casual/puzzle) | Fits "games designed for hands-first … seated" |
| 2 Nov | Stack: **IWSDK 1.1.0-rc.2** (what `npm create @iwsdk@latest` installs today), TypeScript, Vite | Entrant is a web developer with no headset; IWSDK has a scriptable emulator; judges get a URL, with no APK or release channel; deploys to GitHub Pages |
| 2 Nov | AR (passthrough) mode | The real hand must be visible; that is the point |
| 2 Nov | Static friction in the simulation | Doubles as the game feel ("sits until you tip it") and as a dead-zone against tracking jitter |
| 2 Nov | Mote stays on its hand during tracking loss; switches hands only after 3 s and only to a palm-up hand | Emulator found the first version teleporting Mote to the idle hand |

**Known weaknesses:** (1) Passthrough purpose: the stage is the hand, not the room. Judges ask that the room matter. Candidate fix after the device gate: finished blooms get planted on your real table, a persistent garden for a reason to come back. (2) The core risk (tracking on a tilted palm) cannot be checked without a headset. (3) Gaze interactions that judging mentions are Unity/Unreal ISDK only.

**Cut (excluded features):** multiplayer, AI, accounts, procedural ecosystem, creatures leaving the hand, voice.

## What works now (2 Nov 2026)

- `src/palm/`: pure simulation (palm frame from WebXR joints, One-Euro filtering, friction sliding, finger paths, bloom). 8 unit tests pass (`npm test`).
- `src/palmful-system.ts`: reads joints from WebXR, renders Mote (procedural), contact shadow, fingertip beacon, flowers that stay on bloomed fingertips, synthesized chime, hint panel, pause on system UI, tracking-loss handling, metrics on `?debug=1`, joint dots on `?skeleton=1`.
- Emulator evidence: `docs/evidence/` (logs + crop). Typecheck and production build pass.

## Not verified (needs a headset): see `docs/DEVICE_TEST.md`

## Open issues

- Not yet on GitHub / not deployed (needs the entrant to create the repo).
- IWSDK hand visuals in AR on a real Quest: unknown whether a virtual hand is drawn over the real one.
- Finger occlusion not implemented.
- Onboarding is a text hint; no hatch moment yet; no restart gesture yet.
- Emulator screenshot via the CLI crashes the managed browser in this container; Playwright `page.screenshot` (test/capture.mjs) works.

## Next task

Push to GitHub, deploy Pages, get one headset session (`docs/DEVICE_TEST.md`).

## Demo-video fallback (if no headset footage)

Emulator footage with `?skeleton=1` (joint dots stand in for the hand), clearly
captioned as emulator footage, plus an honest line in the description. This is
allowed by the rules but is much weaker than real passthrough footage.
