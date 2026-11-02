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
- FAQ (checked by the entrant on 2 Nov 2026): **judges use Quest 3 or 3S**; owning a headset is **not required** to enter.

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2 Nov | Concept: **Palmful**, a creature that lives on your palm; tilt to guide it; resting on the glowing fingertip makes it bloom | Hands-first by construction, seated, short sessions; aimed at Boldest Original Concept (an experience "that would fall apart on any other platform") |
| 2 Nov | Track: **Gaming** (casual/puzzle) | Fits "games designed for hands-first … seated" |
| 2 Nov | Stack: **IWSDK 1.1.0-rc.2** (what `npm create @iwsdk@latest` installs today), TypeScript, Vite | Entrant is a web developer with no headset; IWSDK has a scriptable emulator; judges get a URL, with no APK or release channel; deploys to GitHub Pages |
| 2 Nov | AR (passthrough) mode | The real hand must be visible; that is the point |
| 2 Nov | Static friction in the simulation | Doubles as the game feel ("sits until you tip it") and as a dead-zone against tracking jitter |
| 2 Nov | Mote stays on its hand during tracking loss; switches hands only after 3 s and only to a palm-up hand | Emulator found the first version teleporting Mote to the idle hand |

**Deciding question:** does Mote visibly stay on a real palm during natural movement on Quest 3/3S? Everything else waits on that answer.

**Known weaknesses:** (1) Passthrough purpose: the stage is the hand, not the room. Real-table planting is a *later* feature: it does not answer the deciding question. (2) The core risk (tracking on a tilted palm) cannot be checked without a headset. (3) Gaze interactions that judging mentions are Unity/Unreal ISDK only.

**Scope:** one complete, reliable session (seed, guide, three blooms, done/restart).

**Cut (excluded features):** multiplayer, AI, accounts, procedural ecosystem, creatures leaving the hand, voice.

## What works now (2 Nov 2026, evening)

- Repo: https://github.com/iftiikhaarr-glitch/palmful · Live: https://iftiikhaarr-glitch.github.io/palmful/ (laptop: add `?emulate=1`).
- CI on every push: clean install, typecheck, 10 unit tests, production build, an end-to-end full session in headless Chromium, then deploy to Pages.
- One complete session: guide Mote to three fingertips (middle → index → ring), each blooms and keeps its flower; then "In bloom! Make a fist to start again"; a fist held 0.8 s restarts. Blooms are capped at three.
- Tracking loss: Mote freezes and dims where it is, then resumes; it switches hands only after 3 s and only to a palm-up hand.
- Laptop mode `?emulate=1`: IWER emulator, keyboard tilts an emulated right hand, joint dots instead of a hand, narrowed FOV.
- `?debug=1` metrics: fps, tracked %, palm-up %, jitter, losses, longest loss, first bloom time. The jitter figure is a high-pass of Mote's position, so it includes deliberate motion. Read it only during the hold-still trial.

## Not verified (needs a headset): see `docs/DEVICE_TEST.md`

## Open issues

- External CDN loads: IWSDK fetches hand-visual models from cdn.jsdelivr.net (fine online; in a blocked network the hand is tracked without a visual).
- IWSDK hand visuals in AR on a real Quest: unknown whether a virtual hand is drawn over the real one.
- Finger occlusion not implemented.
- Onboarding is a text hint; no hatch moment yet.
- Emulator screenshot via the CLI crashes the managed browser in this container; Playwright `page.screenshot` (test/capture.mjs) works.

## Next task

Get one Quest 3/3S session by **Sun 8 Nov** (`docs/DEVICE_TEST.md`): anyone with a Quest can open the live URL with `?debug=1` and record with the headset's built-in recorder.

## Alternative if there is no convincing device evidence by 8 Nov: "Leaf"

Same creature, same tilt-and-bloom loop, but Mote rides a small **leaf you hold between thumb and index finger** instead of your bare palm. The leaf is a rigid virtual object attached at the pinch/grasp point and oriented by the wrist, so Mote never has to look registered to skin. That registration is the unproven part. Pinch and wrist pose are the coarsest, most robust hand signals, and they are what Meta VR Glasses rely on. Fingertip targets become flowers on the leaf's edge. In emulator footage the leaf is drawn, so the video shows the whole interaction clearly; Palmful on a bare palm cannot be shown that way. Cost: about one day, since the simulation only needs a different surface frame (leaf plane instead of palm frame). Trade-off: less magical than "it lives on my skin", more legible and reliable.

## Demo-video fallback (if no headset footage)

Emulator footage with `?skeleton=1` (joint dots stand in for the hand), clearly
captioned as emulator footage, plus an honest line in the description. This is
allowed by the rules but is much weaker than real passthrough footage.
