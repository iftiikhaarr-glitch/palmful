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

**Known weaknesses:** (0) Not yet seen on a Quest: whether the Quest Browser shows its own Enter prompt from `offerSession` alongside our button. (1) Passthrough purpose: the stage is the hand, not the room. Real-table planting is a *later* feature: it does not answer the deciding question. (2) The core risk (tracking on a tilted palm) cannot be checked without a headset. (3) Gaze interactions that judging mentions are Unity/Unreal ISDK only.

**Scope:** one complete, reliable session (seed, guide, three blooms, done/restart).

**Cut (excluded features):** multiplayer, AI, accounts, procedural ecosystem, creatures leaving the hand, voice.

## What works now (2 Nov 2026, late)

- Repo: https://github.com/iftiikhaarr-glitch/palmful · Live: https://iftiikhaarr-glitch.github.io/palmful/ (laptop: `?emulate=1`).
- CI on every push: clean install, typecheck, 11 unit tests, production build, a full laptop-mode session in headless Chromium, a no-WebXR landing check, then deploy.
- **First minute, mostly wordless:**
  - A seed floats in front of you ("Hold out your hand / palm up").
  - It flies to whichever hand is offered palm-up and hatches into Mote.
  - When Mote sits idle, a golden light trail runs from it to the glowing target fingertip, and Mote faces along it.
  - During play, text appears only for "Turn your palm up" (clinging), "Bring your hand back" (tracking lost), or "Tip your hand" after about 8 s with no tilt.
- **Completion:** "All three in bloom", three petal-coloured dots, and "make a fist to play again", placed above and beyond the hand. An automated screen-space check finds 0 of 18 hand/Mote/flower points under the panel in the emulated view. A fist replays from the hatch.
- **2D landing page:** an "Enter AR" button (fallback for browsers without `offerSession`), or, without WebXR AR, a note to open on Quest plus a link to the laptop demo.
- Tracking loss, pause, debug metrics and laptop mode are unchanged from before.

## Catch-mode experiment (3 Nov 2026), `?catch=1`

**The game:** a glowing seed waits in front of you. When you offer an open, palm-up hand, it pulses for 1 s, then drifts down at 6 cm/s. A ring at palm height, the size of the catch area, shows where it will land, and turns green when your palm is in place. The seed lands in an open, palm-up hand whose centre is within 7.5 cm horizontally. A gentle cup (`cupAmount` ≥ 0.42) held for 0.2 s then catches it, and a flower grows (middle, index, ring). A miss gives a red burst and a low sound, and the seed comes back from the other side with progress kept. Hand loss pauses the seed. Tipping the palm past about 72° spills a resting seed. Three catches complete the session; a fist replays.

**Guards against false catches:**
- The seed must land in an open palm first.
- The cup must be held 0.2 s after landing.
- Relaxed hands measure below the threshold (synthetic hand: about 0.29; emulator relaxed pose: 0.06; emulator cup: 0.66).

**Verified:** 16 catch unit tests, including six deliberate code breaks that each made tests fail. A 21-check end-to-end catch session runs on the production build. Bloom mode still passes its own tests.

**Not verified:** cup values and catch feel on real hands. See `QUEST_TEST_GUIDE.md` Part B and the decision table there.

**Found and fixed while building:**
- The first seed was placed using the head pose of the first frame, before it had settled. The waiting seed now follows your view until a palm is offered.
- The completion panel could cover curled fingers. It now sits just above the highest hand or flower point in view, in both modes.

## Not verified (needs a headset): see `docs/DEVICE_TEST.md`

## Open issues

- External CDN loads: IWSDK fetches hand-visual models from cdn.jsdelivr.net (fine online; in a blocked network the hand is tracked without a visual).
- IWSDK hand visuals in AR on a real Quest: unknown whether a virtual hand is drawn over the real one.
- Finger occlusion not implemented.
- Onboarding is a text hint; no hatch moment yet.
- Emulator screenshot via the CLI crashes the managed browser in this container; Playwright `page.screenshot` (test/capture.mjs) works.

## Next task

Get one Quest 3/3S session by **Sun 8 Nov** using `docs/QUEST_TEST_GUIDE.md`.

## Proposed replay challenge (not built; waiting for approval)

**"Gentle hands":** each session counts how often Mote bumps the palm edge or has to cling. Finishing three blooms with zero bumps grows a fourth, golden flower on the thumb; your best (fewest bumps, then fastest) is remembered on the device.
- *Value:* a reason to replay that rewards slow, smooth movement. That is the movement hand tracking handles best, so it doesn't push players toward fast moves that cause tracking errors. Mostly reuses existing data (`edgeHits` and the cling state are already tracked), and it speaks to the "Best Reason to Come Back" award.
- *Cost:* about half a day. Bump counter, thumb finger path (a new finger in the simulation plus a test), a "best" line on the completion panel, and saving the best to the device.
- *Risk:* on a real Quest, tracking jitter could register as bumps and feel unfair. That threshold needs device data first, so build it only after the Quest test passes.

## Alternative if there is no convincing device evidence by 8 Nov: "Leaf"

Same creature, same tilt-and-bloom loop, but Mote rides a small **leaf you hold between thumb and index finger** instead of your bare palm. The leaf is a rigid virtual object attached at the pinch/grasp point and oriented by the wrist, so Mote never has to look registered to skin. That registration is the unproven part. Pinch and wrist pose are the coarsest, most robust hand signals, and they are what Meta VR Glasses rely on. Fingertip targets become flowers on the leaf's edge. In emulator footage the leaf is drawn, so the video shows the whole interaction clearly; Palmful on a bare palm cannot be shown that way. Cost: about one day, since the simulation only needs a different surface frame (leaf plane instead of palm frame). Trade-off: less magical than "it lives on my skin", more legible and reliable.

## Demo-video fallback (if no headset footage)

Emulator footage with `?skeleton=1` (joint dots stand in for the hand), clearly
captioned as emulator footage, plus an honest line in the description. This is
allowed by the rules but is much weaker than real passthrough footage.
