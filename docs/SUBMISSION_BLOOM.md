# Palmful: Bloom-only Devpost entry (draft for the owner's review; not submitted)

Prepared 5 Nov 2026 from `docs/SUBMISSION_DRAFT.md` (branch `draft/submission`).
**Bloom is the provisional submission mode.** Catch stays in the build behind
`?catch=1` but is not part of this entry. Nothing here has been entered on
Devpost, and no video has been recorded or published.

Deadline: **18 Nov 2026, 12:00 PM PT = 19 Nov 2026, 00:00 Dubai.** Aim to
submit by 17 Nov.

---

## 1. Form fields

| Field | Entry |
|---|---|
| Project name / title | **Palmful** |
| Tagline (137 of 140 characters) | A tiny creature lives on your open hand. Tip your palm to guide it to a glowing fingertip and watch it bloom. Hands only, no controllers. |
| Track | **Gaming** |
| Division | **New Experience** (the repository starts on 2 Nov 2026) |
| Build URL (what judges open) | **https://iftiikhaarr-glitch.github.io/palmful/** (Bloom is the default; open it in the Quest Browser and pinch *Enter AR*) |
| Source code (if asked) | https://github.com/iftiikhaarr-glitch/palmful |
| Demo video URL | *Needs your input:* public YouTube or Vimeo link, under 3 minutes (script in section 3) |
| Target launch date | *Needs your input* |
| Description | Section 2 below (about 500 words) |
| Hand-interaction notes (optional field) | Section 2, "Hand interactions" |

---

## 2. Description (paste as one piece; about 500 words)

**Inspiration**

Holding something small and alive in your open hand, like a ladybird or a
firefly, is a quiet, focused moment. Hand tracking lets the hand be both the
controller and the whole stage, so we built a game that only exists on your
palm.

**What it is**

Palmful is a short, seated, hands-only game for Meta Quest in passthrough.
- **The seed:** a glowing seed waits in front of you. Hold out an open hand,
  palm up, and it floats down onto your palm and hatches into Mote, a tiny
  round creature.
- **Tilting:** your palm becomes a small landscape. Tip your hand gently and
  Mote slides across it.
- **Blooming:** one fingertip carries a small flower in the colour it will
  bloom, and a golden trail shows the way. Rest Mote on that fingertip and the
  finger blooms.
- **Ending and replay:** three blooms (middle, index and ring finger) complete
  the garden. Make a fist to play again.

A session takes a few minutes. There are no menus, buttons or controllers, and
no fail state that ends the run.

**Hand interactions**
- **Open palm, facing up:** receive the seed.
- **Gentle tilt toward the flowered fingertip:** Mote slides toward it.
- **Hold the tilt:** Mote rests on the fingertip and it blooms.
- **Fist, held briefly, after three blooms:** play again.
- **Hand hidden:** Mote waits in place, dimmed, and carries on when the hand
  returns. After a few seconds it can move to your other hand if you hold that
  one palm up.
- **Palm turned down:** Mote clings on, and the game asks you to turn your palm
  up.

On your first session, an in-game guide shows one step at a time with a short
animated hand. It sits away from the seed and your hand, and each card
disappears once that step is done.

**How we built it**

Palmful uses Meta's Immersive Web SDK (IWSDK, WebXR) and the three.js it
includes, written in TypeScript with Vite. It is hosted on GitHub Pages, so
judges open a link in the Quest Browser with nothing to install.
- **Game rules:** pure, unit-tested TypeScript, kept separate from rendering.
- **Designed for tracking:** Mote stays put until the tilt is clearly
  deliberate, which absorbs small tracking shakes, and hand loss pauses
  instead of failing the player.
- **Assets:** every visual and sound is generated in code, with no third-party
  assets.
- **Testing:** every change runs unit tests and complete play sessions in Meta's
  IWER emulator in CI before it deploys.

**Why passthrough**

The stage is your real hand. Passthrough lets Mote sit on your own palm and
the flowers grow from your own fingertips. Palmful does not use the room
around you; the hand is the whole point.

**Testing status (honest)**

Palmful was developed and tested mostly in Meta's IWER emulator, with automated
full sessions. In one Quest recording of an **earlier build**, Bloom ran at
**90 fps**; the seed landed on the tester's palm and hatched, and Mote rode on
their hand. The **current build**, which adds the in-game guide, has **not yet
been verified on a Quest**. A complete three-bloom session on real hands has
**not been verified** either.

**What's next**

A "gentle hands" replay challenge that rewards smooth movement; more creatures
and seed types; a second game, Catch, once its cup gesture is calibrated on
real hands; and a version for Meta VR Glasses built on pinch and wrist pose.

**Built with:** IWSDK (WebXR), three.js, TypeScript, Vite, IWER, Playwright,
GitHub Actions, GitHub Pages. *Your decision:* add "Claude Code (AI coding
assistant)" if you want to disclose AI-assisted development; that is the
transparent choice.

---

## 3. Demo video script (current build, under 3 minutes)

**What to record**
- **Laptop emulator only:** there is no headset footage you can use. The tester's
  recordings are private, came from an older build and must not be published.
- **Address:** Chrome or Edge at
  https://iftiikhaarr-glitch.github.io/palmful/?emulate=1, window size
  1920×1080. Record **the browser window content only**: no tabs, bookmarks,
  desktop or notifications.
- **Caption:** keep this one caption on screen for the **whole** video. Add it
  in your editor or as a recording-software text overlay, bottom-right, white
  on a dark band: **"Laptop emulator; hand simulated with keyboard"**. The game
  itself is unchanged.
- **Help panel:** press **?** once after *Start* to collapse it. It still shows
  "Laptop emulator: not a headset test", which is fine to keep.
- **Rehearse first:** do the key sequence once off camera. Keep one take per
  shot, and cut between shots rather than speeding up hand motion.

| # | Time | Shot | What you do | What viewers see |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Title card | Edit-in text card | "Palmful: a tiny creature that lives on your hand". Caption visible. |
| 2 | 0:10–0:22 | Opening | Load `?emulate=1`, click **Start**, press **?** | The seed floats in front; guide card 1: "Hold out your hand / open, palm up, under the seed". |
| 3 | 0:22–0:40 | Seed lands, Mote hatches | **Space** (hand rises palm up) | The seed drifts onto the palm and hatches; the card switches to "Tilt gently toward the flower"; a golden trail leads to the pink flower on the middle fingertip. |
| 4 | 0:40–1:05 | First bloom | **↑** seven times, one press about every half second | Mote slides up the middle finger and the middle fingertip blooms pink; the card shows "1 of 3 in bloom", then disappears. |
| 5 | 1:05–1:40 | Second bloom (index) | **Space**, **↓**×6 (Mote back on the palm); **Space**, **→**×6; then **↑**×7, **←**×4 | The trail and a blue flower marker on the index fingertip; Mote slides there and it blooms blue. |
| 6 | 1:40–2:15 | Third bloom (ring) | **Space**, **↓**×6; **Space**, **←**×6; then **↑**×7, **→**×4 | A violet marker on the ring finger; Mote slides there and it blooms; "All three in bloom" with three coloured dots. |
| 7 | 2:15–2:30 | Replay | **F** (fist), hold about 1 s, then **F** again (open) | The flowers reset and the seed hatches again: replay with a gesture, no menu. |
| 8 | 2:30–2:45 | End card | Edit-in text card | "Play on Meta Quest 3/3S: iftiikhaarr-glitch.github.io/palmful · Hands only · Built with IWSDK (WebXR)". Caption still visible. |

**Optional inserts** (only if there's time under 3:00):
- **Hand hidden:** after shot 4, press **H** to hide the hand for 2 s, then
  **H** again. Mote waits, dimmed, then carries on.
- **Fist mid-game:** after shot 3, press **F** once, then **F** again. The
  guide says "Open your hand", then returns to the tilt card.

**Avoid in the video:**
- the inspection camera keys (**[ ] - = R**), `&debug=1`, Catch mode and the
  hand-size buttons;
- any other person;
- browser or desktop branding;
- AI-generated footage;
- claiming headset performance.

**Before uploading, check:**
- it's under 3:00;
- the caption is on screen in every frame;
- the description repeats once that the video shows the laptop emulator.

Then upload it publicly to YouTube or Vimeo and open the link while signed out
to confirm it plays.

---

## 4. Still needs your input

1. **Meta VR Start membership and Developer Access.** Confirm on Meta's
   developer site; this is required by the deadline. I cannot check it.
2. **Target launch date** for the form.
3. **Demo video:** record it with the script above, upload it publicly, and
   paste the link.
4. **AI disclosure:** whether to list Claude Code under "Built with".
5. **Anything else the form asks for:** re-read the live Devpost rules and form
   for required fields this draft doesn't cover. Examples are gallery images or
   a thumbnail (use labelled emulator screenshots), team members, country and
   eligibility answers, and confirmation that WebXR entries submit a link.
6. **Final check before you submit:**
   - `main` is green;
   - the build URL opens on a laptop;
   - the repository is public.

   Then don't push to `main` after submitting, and keep Pages up until winners
   are announced (about 11 Dec).

Not verified for this entry: the current build on a Quest (frame rate,
readability of the guide and the flower marker), and a complete three-bloom
session on real hands.
