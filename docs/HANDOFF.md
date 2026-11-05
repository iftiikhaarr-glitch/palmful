# Handoff: in-game coach and Catch landing feedback are live (5 Nov 2026)

## Where the work is

- **PR #12 merged into `main` as `5a147a1`, and Pages run #13 deployed it
  successfully.** The PR is the in-game coach, the flower target marker and the
  fanned flowers: https://github.com/iftiikhaarr-glitch/palmful/pull/12. It was
  merged at the owner's request after their laptop review of the Catch steps.
  The run passed every check (typecheck, unit tests, build, the
  bloom/catch/two-hand/landing sessions, contrast, and coach layout at
  1280×800 and 700×560) before deploying:
  https://github.com/iftiikhaarr-glitch/palmful/actions/runs/41978952075
- **PR #14 merged into `main` as `2d5d0ac`, and Pages run #15 deployed it
  successfully:** https://github.com/iftiikhaarr-glitch/palmful/pull/14,
  https://github.com/iftiikhaarr-glitch/palmful/actions/runs/42010788917
  - **Ring:** the Catch landing ring now turns green only when the selected
    hand can actually receive the seed (tracked, palm up, cup reading below
    0.42, under the seed). It uses the game's own landing check, so the two
    cannot disagree.
  - **Threshold:** the cup threshold is still **0.42**. Catch tolerance and
    every Catch rule are unchanged.
  - **`&debug=1`:** a line shows the selected hand and why the seed can or
    cannot land, for example `RIGHT hand  LAND: cup too high (0.45 >= 0.42)`.
- **Live now** (nothing is awaiting merge):
  - Bloom: https://iftiikhaarr-glitch.github.io/palmful/
  - Catch: https://iftiikhaarr-glitch.github.io/palmful/?catch=1
- **Handoff updates:** docs-only PR #13
  (https://github.com/iftiikhaarr-glitch/palmful/pull/13).
- **Devpost:** unchanged.
- **Aaron's recordings:** received 5 Nov and reviewed privately. They are
  **not** in this repository and must not be used publicly. Both were recorded
  on the build *before* the coach. What they showed:
  - Bloom worked: `fps 90`, palm-up 97 %.
  - Catch got 0 catches and 3 misses. His visibly open hand read
    `cup 0.42–0.46`, so landings were refused while the ring showed green; PR
    #14 fixes the ring.
  - Whether the threshold should change waits for his optional `cup`
    screenshots (flat, relaxed and gently cupped hand).
- **Branches to keep:**
  - `hold/catch-opening-settled-check` (stricter contrast test; never merge as is);
  - `draft/submission` (Devpost draft, `docs/SUBMISSION_DRAFT.md`);
  - `rollback/live-before-laptop-hand`, `rollback/catch-v1`;
  - the `preview-*` branches.

## Links

- **For a first-time Quest tester** (no debug panel; Quest Browser):
  - Catch first: https://iftiikhaarr-glitch.github.io/palmful/?catch=1
  - Then Bloom: https://iftiikhaarr-glitch.github.io/palmful/
  - The facilitator follows Part 0 of
    [`QUEST_QUICK_CHECKLIST.md`](QUEST_QUICK_CHECKLIST.md) (silent; one-line
    intro only).
- **Measured Quest test** (debug numbers): the `&debug=1` links in Parts A and
  B of the checklist.
- **Laptop emulator** (live):
  - https://iftiikhaarr-glitch.github.io/palmful/?emulate=1
  - https://iftiikhaarr-glitch.github.io/palmful/?emulate=1&catch=1
- **Screenshots** (`evidence/`):
  - `laptop-coach-steps.jpg`
  - `laptop-bloom-fist-coach-before-after.jpg`
  - `laptop-bloom-target-vs-mote.jpg`
  - `laptop-flowers-fan-before-after.jpg`

## What changed (onboarding only)

- **The coach:** one action at a time, a step strip, plain words and an
  animated hand pictogram (`src/coach.ts`).
- **Bloom:** Hold out your hand → Tilt gently toward the flower → 1 of 3 in
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

## Fixed after the owner's laptop review (5 Nov 2026; all merged in PR #12)

- **Bloom, fist before the end:** the coach kept saying "Tilt gently toward the
  light" with "Open palm" ticked while the hand was a fist. Now any closed hand
  (the game's own fist or cup measure, thresholds unchanged) before the end
  shows step 1 again, *Open your hand*, unticked. `laptop-e2e` checks F → *Open
  your hand* → F → *Tilt gently toward the light*.
- **Target fingertip vs Mote (changed at the user's request):** while Mote
  slid it turned pale yellow, almost the colour of the cream target light. The
  target is now a small flat five-petal flower, about 1.1 cm across. It faces
  the viewer and turns slowly, on a soft dark backing, in the colour of the
  flower that finger will grow: pink for the middle finger, then blue for the
  index, then violet for the ring finger. It sits at the same point as before
  (4 mm above the target fingertip), with the same pulse. Mote stays a round,
  warm ball. Display only: no rule, threshold or target order changed.
  - `laptop-e2e` checks the colour and finger: pink on the middle fingertip,
    then blue on the index, each within 4.5 mm of its fingertip.
  - `contrast-check` now also samples the target marker.
  - Before and after: `evidence/laptop-bloom-target-vs-mote.jpg`.
  - The coach's tilt pictogram and words follow ("Tilt gently toward the
    flower").

- **Completed flowers overlapped (user's laptop review of Catch):** the three
  blooms on neighbouring fingertips sat on top of each other. Each stem now
  leans about 24° sideways from its own fingertip along the palm's
  pinky-to-index axis (index outward, ring outward, middle straight). The stems
  differ a little in height (middle 16 mm, index 12 mm, ring 11 mm). Roots stay
  on their fingertips; there is no new animation and no gameplay change.
  - Open hand: clearly apart. Fist: apart as well.
  - Cupped hand: pink and gold still partly overlap, because the view runs
    along the curled fingers.
  - Evidence: `evidence/laptop-flowers-fan-before-after.jpg`.

## Test results on the merged code (`de9b10b`, 5 Nov 2026; local production build, headless Chromium)

| Test | Result |
|---|---|
| typecheck, unit tests | pass, 36/36 |
| `laptop-e2e` (full bloom session, coach sequence, fist → *Open your hand*, flower marker pink → blue) | 24 OK |
| `catch-e2e` (full catch session; coach order under > land > cup frame by frame) | 49 OK |
| `twohand-e2e`, `landing-e2e` | 19 OK, 3 OK |
| `layout-sizes` (5 sizes × both modes) | 120 OK |
| `coach-layout` (every coach step, 5 sizes, clear of seed/ring/Mote/hand/progress) | 71 OK |
| `contrast-check` | pass; bloom seed worst 5.5:1; target marker 12.4–14.6:1 against the dark background |
| `hand-poses` at 1897×869 | pass |
| CI on `main` after the merge (Pages run #13) | all steps pass, deployed |

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

## Steps for any further recordings

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
4. Fix only the blocking items on a fresh branch from `main` (PR #12 is
   merged; open a new PR). Rerun the suite above. If the owner wants to try
   the fix before merging, build a laptop preview with
   `npx vite build --base ./ --outDir <scratch>` and push it to
   `preview-coach`, served at
   `https://raw.githack.com/iftiikhaarr-glitch/palmful/<commit>/index.html`.
5. Request a focused headset retest on the live links once the fix is merged:
   - **Part 0** with a new first-time player: Catch first
     (https://iftiikhaarr-glitch.github.io/palmful/?catch=1), then Bloom
     (https://iftiikhaarr-glitch.github.io/palmful/), with the facilitator
     silent.
   - Then only the Part A/B rows that failed or were inconclusive.
6. Report to the user before merging. Merge only with their approval. Then
   check that the Pages deployment passed, and update `SUBMISSION_DRAFT.md`
   (on `draft/submission`) with what was actually measured.
