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

## What worked on 2 Nov 2026 (historical; see the sections below for current state)

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

## Catch-mode experiment v1 (3 Nov 2026), superseded by catch v2 below

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

## Laptop-view visibility (3 Nov 2026)

- `?emulate` now draws a dark room (backdrop sphere and floor) inside the rendered XR view. The emulator otherwise composites AR over white. Without `?emulate` no backdrop exists, which a test checks, so Quest passthrough is never covered.
- Hand joints are bright, with bone lines. The landing ring is thicker and untonemapped: amber while the seed falls, green when the palm is in place or on a catch (it bursts outward), red on a miss (it shrinks and sinks).
- The miss cue now plays at the ring, where the player is looking; it used to play out of view. Cues hold full strength for most of their 1.5 s.
- **Measured:** background luminance 0.004. Contrast against it: hand joints 13.9:1, Mote 10.5:1, bloom seed about 5.5:1, catch seed 18.7:1, ring 7.8:1. The catch and miss frames contain the right cue colour and none of the other.

## Catch v2 (3 Nov 2026, branch `catch-v2`)

- **Rollback point:** branch `rollback/catch-v1` at `bee7966`. That is bloom, catch v1 and the dark laptop view. (Tags cannot be pushed from the cloud session.)
- **Seeds:** gold sphere, blue diamond and pink triangle. They come in a fixed order, each in its own fixed lane (left, right, centre), and fall straight down at 6 cm/s. A miss returns the same seed and keeps earlier catches; a fist restart resets all counts.
- **Progress display:** "Gold 0/1 · Blue 0/1 · Pink 0/1", 10 cm above the lanes and slightly below eye level, with the current seed outlined. It becomes the 3/3 completion card.
- **Catch area:** 0.9 × measured palm width (`CATCH_TOLERANCE`), clamped to 5.5–9.5 cm. The ring is drawn at exactly that radius.
- **Laptop only:**
  - Keys 1/2/3 select an uncaught seed.
  - Small/Medium/Large changes hand drawing thickness only, saved in localStorage. Joint, seed and ring screen positions are identical across sizes (0.00 px shift, tested).
  - The help panel sits bottom-left, above the emulator view so it is clickable, and can be hidden.
- **Tests:** 18 catch unit tests. The catch session test runs 38 checks: every colour, keys 1/2/3, a miss with progress kept, tracking loss, cue pixels, completion layout, fist reset, hand sizes and the saved setting.

## Optional two-hand catch (3 Nov 2026, branch `two-hands`, `?catch=1&hands=2`)

- Pure rules in `src/palm/two-hand.ts`:
  - The hand nearest the falling seed is engaged; switching to the other hand needs it to be 3 cm nearer.
  - A resting seed belongs to its holder; if the holder is lost, the seed pauses indefinitely.
  - A falling seed pauses when its engaged hand is lost and is released only after 3 s.
  - With one hand tracked, play is identical to one-hand.
- Each hand has its own joints, filters, palm frame and catch area. Flowers remember the hand that caught them.
- **Laptop:** L switches which hand the keys control.
- **Tests:** 7 unit tests; breaking any one of four rules made a test fail. The two-hand session test runs 17 checks.
- Gated behind `&hands=2` and in its own pull request, so it can be dropped without touching one-hand play.

## Review of PR #2 for Quest readiness (3 Nov 2026, branch `review-fixes`)

- **Baseline on PR #2 (`33d9f42`):** clean install, typecheck, 36 unit tests and the build all pass. Browser checks: bloom 15, catch 38, two-hand 17, landing 3, contrast 10, all passing.
- **Fixed:**
  1. **Accidental replay after 3/3.** In the synthetic hand, a firm catching cup (50° per joint) sits 1 mm from the fist threshold (fingertip reach 0.121 m vs 0.12 m), so holding a squeeze could wipe the result. The replay now arms only after *that hand* opens. In two-hand mode an open other hand does not arm it; the first version of this fix allowed that, and the two-hand browser test caught it.
  2. **Per-frame allocation in two-hand mode.** `chooseHand` and its inputs no longer allocate every frame, which matters for frame rate on the headset. Behaviour is unchanged: the same 7 tests pass and the same 4 deliberate breaks fail.
  3. **Debug `palmCenter`** now follows the active hand in two-hand mode.
  4. **Docs:** stale pointers (README and record pointed to `DEVICE_TEST.md`), superseded catch-v1 facts marked, the laptop replay instructions corrected, and the Quest guide given an accidental-replay check and the hand-outline check.

## Laptop hand readability (3 Nov 2026, branch `hand-silhouette`, on top of `review-fixes`)

- **Laptop only (`?emulate`):**
  - A soft translucent hand silhouette: palm polygon plus finger and thumb capsules, `src/hand-silhouette.ts`. It is drawn as a depth pre-pass followed by one colour pass, so overlaps don't brighten.
  - Joints are small, faint dots; bones are hidden. `&debug=1` or `?skeleton=1` shows the full bright skeleton.
  - Small/Medium/Large now scales the silhouette's thickness too. Positions are unchanged.
  - Panels render above the silhouette.
  - Pinky and thumb joints are read only in laptop mode, for drawing. The headset reads the same joints as before.
- **No clipping:** the game reports the screen box of its key objects (progress display, hint, seed, ring, hand, flowers) about 4 times a second. The laptop camera tilts to centre it and zooms just enough to keep it inside the window. The help panel never exceeds the window height and starts collapsed below 720 px tall or 900 px wide.
- **Checked:** `test/layout-sizes.mjs` covers 5 window sizes (1920×1080, 1366×768, 1024×640, 820×1100, 700×560) × both modes × opening, a catch or bloom, and completion.
- **Cost:** the silhouette is one mesh rebuilt each frame (2 draw calls per hand). Headless swiftshader went from about 9.6 to 13.3 fps after merging the parts. This is not a Quest number.
- **Test aid:** `__palmful.holdCue(true)` (laptop only) freezes the game at the next catch/miss cue so the ~3 s headless screenshot can see the 1.5 s cue. Players never trigger it.
- **Quest:** unchanged. The real hand and IWSDK's outline are what a player sees; alignment and readability there still need the headset.

## Laptop 3D hand (3 Nov 2026, on top of `hand-silhouette`)

- **Laptop only (`?emulate`); the Quest path is untouched** (the hand model, see-through cue copies and pose blending are all behind `?emulate`).
- `src/hand-silhouette.ts` now builds a procedural 3D hand from the same filtered joints the game uses, every frame. No new asset, no new dependency, no licence question: it is code in this repo.
  - Each finger and the thumb is one smooth tapered tube (Catmull-Rom through its joints) with a rounded tip; the palm is a closed, rounded pillow from wrist to knuckles with a shallow hollow on the palm side; the wrist is an oval tube that narrows and fades out over 5 cm.
  - Finger and thumb roots are capped and start inside the palm, so no seams or dark holes. The palm's skin sits about 1 cm out from the joints, where the game rests the seed (`center + normal × 0.8 cm`), so a resting seed sits on the visible palm.
  - Shading: soft view-relative key light, a muted warm grey-rose skin (#b9a6a8) that reads on the dark room without outshining seeds, and a restrained cool edge light. No glow, no texture.
  - One opaque mesh, one draw call per hand, ordinary depth test. About 1.4k vertices; normals are computed in place without per-frame allocation.
- **Real-browser defect found in review (fixed):** in a real desktop browser the palm was black, the fingertips looked detached and the wrist floated as a separate cuff. Cause: IWSDK draws its own hand visual over every tracked hand, a white outline plus an invisible depth-writing "occluder" hand (meant for passthrough). It loads from the WebXR input-profiles CDN, which the sandboxed test runs could not reach, so headless screenshots never showed it. In real browsers the occluder hid the laptop hand wherever it sat behind it. This was also the cause of the black palm in the PR #4 silhouette.
  - Fix (laptop only): the system hides IWSDK's hand visual every frame in `?emulate` (IWSDK re-shows it in its input update, which runs first). `&iwsdkhand=1` keeps it, for comparison. Quest is unchanged: the outline and occluder still draw over real hands there.
  - Hardening: the laptop hand is now opaque, one pass (no depth pre-pass, no reliance on two shader programs giving identical depth). The wrist and forearm are the palm's own surface carried on past the wrist (no separate tube); the forearm end fades out with a fine screen-door dither toward the floor colour.
  - `test/hand-poses.mjs` with `PROFILES_DIR=<unpacked @webxr-input-profiles/assets>/dist/profiles` serves those CDN files locally, so the run loads IWSDK's hand like a real browser and checks that it is hidden. Headless SwiftShader does not draw IWSDK's skinned hand even when loaded, so the visual proof of this fix is a real-browser check.
- **Help panel:** the page no longer scrolls in laptop mode (arrow keys and Space are cancelled before any async work; html/body overflow hidden), and the panel follows the visible area if the browser is pinch-zoomed. The pose test now checks the panel is fully inside the window, with desktop-style scrollbars on.
- **Joint dots** are hidden in normal laptop play. `&debug=1` / `?skeleton=1` shows the full skeleton through a faint (30 %) hand.
- **See-through cues:** where the hand covers the landing ring, a seed or a flower (for example a flower inside a fist), a faint copy is drawn on top (reversed depth test), so cues never vanish.
- **Pose blending:** the laptop keys now use IWER's `set_hand_pose` with `duration: 0.22` (minimum-jerk). The game reads the blended joints, so drawing and catch logic stay in step.
- **Hand size:** Small/Medium/Large are now 0.86 / 1 / 1.16 × thickness (were 0.8 / 1 / 1.25) so Large does not bury a resting seed. Positions are unchanged.
- **Test aids (laptop only):** `__palmful.freeze(true/false)` pauses the game while the hand still moves; `window.__palmfulFitPaused` stops the auto camera fit for angled screenshots. Players never trigger them.
- **Checked:** `test/hand-poses.mjs` captures open, receive, cup-with-seed and fist from the front and at an angle, and checks the palm is lit and the resting seed is over the game's palm centre.

## Not verified (needs a headset): see `docs/QUEST_TEST_GUIDE.md`

## Open issues

- External CDN loads: IWSDK fetches hand-visual models from cdn.jsdelivr.net (fine online; in a blocked network the hand is tracked without a visual).
- IWSDK hand visuals: confirmed from the IWSDK 1.1.0-rc.2 source (`xr-input` `AnimatedHand`, always enabled). On a headset it draws a white outline over each tracked hand, plus an invisible depth-writing hand mesh that hides virtual objects behind the fingers. The model loads from cdn.jsdelivr.net. Whether the outline lines up with the real hand is a Quest test item.
- Finger occlusion not implemented.
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

Emulator footage (the shaded laptop 3D hand stands in for the hand; `?skeleton=1` adds bright joints), clearly
captioned as emulator footage, plus an honest line in the description. This is
allowed by the rules but is much weaker than real passthrough footage.
