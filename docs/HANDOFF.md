# Handoff: in-game coach, waiting for Aaron's Quest recordings (5 Nov 2026)

## Where the work is

- **Branch:** `claude/peaceful-fermi-fgkd3n`
- **PR (not merged, review only):** https://github.com/iftiikhaarr-glitch/palmful/pull/12
- **`main` / live site:** unchanged at `b952d41`. **Devpost:** unchanged.
- **Branches to keep:**
  - `hold/catch-opening-settled-check` (stricter contrast test; never merge as is);
  - `draft/submission` (Devpost draft, `docs/SUBMISSION_DRAFT.md`);
  - `rollback/live-before-laptop-hand`, `rollback/catch-v1`;
  - the `preview-*` branches.

## Preview links (laptop emulator)

- Built from `6318b8d`, the same game code as the PR.
- Served from branch `preview-coach`, commit `49b3d00`.
- Bloom: https://raw.githack.com/iftiikhaarr-glitch/palmful/49b3d0062ed37aac8ef117bd82934548be1bd52f/index.html?emulate=1
- Catch: https://raw.githack.com/iftiikhaarr-glitch/palmful/49b3d0062ed37aac8ef117bd82934548be1bd52f/index.html?emulate=1&catch=1
- On a Quest: the same URLs without `emulate=1`. **Not yet opened on a headset.**
- Screenshots: [`evidence/laptop-coach-steps.jpg`](evidence/laptop-coach-steps.jpg).

## What changed (onboarding only)

- **The coach:** one action at a time, a step strip, plain words and an
  animated hand pictogram (`src/coach.ts`).
- **Bloom:** Hold out your hand → Tilt gently toward the light → 1 of 3 in
  bloom → make a fist to play again.
- **Catch:**
  - Under → Land → Cup, with *Now cup gently* (green) only once the seed rests.
  - After each catch: "1 of 3 caught · next: blue, on your right".
  - At 3/3: Open your hand → Now make a fist.
- **Placement:** cards stay clear of the seed and hand. In Catch they sit above
  the progress display; in Bloom, above the waiting seed, then ahead and above
  the hand.
- **Unchanged:** game rules, thresholds (`CUP_ON` 0.42, landing, fall speed,
  lanes, restart arming), the Quest camera and both modes.

## Fixed after the user's preview review (5 Nov 2026)

- **Bloom, fist before the end:** the coach kept saying "Tilt gently toward the
  light" with "Open palm" ticked while the hand was a fist. Now any closed hand
  (the game's own fist or cup measure, thresholds unchanged) before the end
  shows step 1 again, *Open your hand*, unticked. `laptop-e2e` checks F → *Open
  your hand* → F → *Tilt gently toward the light*.
- **Target fingertip vs Mote (checked, not changed):** while Mote slides it
  turns pale yellow (`#ffd27a`), and on arrival `#fff3b0`, almost the same
  colour as the target light (`#fff6c2`). They differ mainly by size, and the
  light floats just above the fingertip. A colour change for the light is
  proposed in the PR, not made, pending the user's decision.

## Test results (5 Nov 2026, local production build, headless Chromium)

| Test | Result |
|---|---|
| typecheck, unit tests | pass, 36/36 |
| `laptop-e2e` (full bloom session + coach sequence) | 20 OK |
| `catch-e2e` (full catch session; coach order under > land > cup frame by frame) | 49 OK |
| `twohand-e2e`, `landing-e2e` | 19 OK, 3 OK |
| `layout-sizes` (5 sizes × both modes) | 120 OK |
| `coach-layout` (every coach step, 5 sizes, clear of seed/ring/Mote/hand/progress) | 71 OK |
| `contrast-check` (+3 repeats) | pass; bloom seed worst 5.5:1 |
| `hand-poses` at 1897×869, 700×560, 1280×800 two-hand | all pass |

Emulator only. Nothing here measures real-hand tracking, comfort or Quest
frame rate.

## Unresolved Quest questions

1. **Where Aaron got stuck.** Which step, how long, and what he tried first.
   This is from his recordings, which were made **before** the coach existed.
2. **Real-hand tracking.** Does the palm read as palm-up? Does Mote stay on the
   skin? Does `tracked` reach ≥ 95 %? Is recovery after the hand is hidden
   clean?
3. **Cup detection on real hands.** Flat, relaxed and gently-cupped `cup`
   values against 0.42; any accidental or missed catches.
4. **Frame rate** (`fps`, minimum 60, target 72), now including the animated
   pictogram.
5. **Coach on the headset.**
   - Are the cards readable at their size and distance?
   - Does the Catch card above the progress display stay in view while the
     player looks down at the hand?
   - Does any card or glow cover the seed, the hand or the text?
6. **Does the coach work?** A new first-time player (Part 0 of the guide) must
   finish both modes without help.

## Exact next steps when the videos arrive

1. Save them in a new, empty folder outside the repo; do not commit them. Note
   the device (Quest 3 or 3S), the lighting, the URLs used and whether
   `&debug=1` was on.
2. Review each video against `docs/QUEST_TEST_GUIDE.md` and record with
   timestamps:
   - **Where he got stuck:** the first moment he hesitated or asked, what was
     on screen, and what he did instead (for example, cupped before the seed
     landed, or never put the palm under the seed).
   - **What the footage proves:** only what is visible or read off the debug
     panel: `fps`, `tracked` %, jitter, cup values, catches and unintended
     catches, recovery after hand loss.
   - **What stays unknown:** anything not shown, or shown without `&debug=1`.
3. Separate the findings:
   - **Blocking a first-time player** (onboarding): fix in the coach only; for
     example wording, order, timing or placement.
   - **Blocking the final submission:** for example `fps` below 60, tracking
     that fails the guide, or a crash. Propose the smallest fix first. Change
     a game rule or threshold (such as `CUP_ON`) only if the recorded numbers
     show it, and only after the user agrees.
   - **Everything else:** note it; don't change it.
4. Fix only the blocking items on this branch. Rerun the suite above, update
   the preview branch, and push to PR #12.
5. Request a focused headset retest:
   - **Part 0** with a new first-time player on the preview link: Catch first,
     then Bloom, with the facilitator silent.
   - Then only the Part A/B rows that failed or were inconclusive.
6. Report to the user before merging. Merge only with their approval. Then
   check that the Pages deployment passed, and update `SUBMISSION_DRAFT.md`
   (on `draft/submission`) with what was actually measured.
