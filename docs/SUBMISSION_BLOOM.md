# Palmful: Bloom-only Devpost entry (final review draft; not submitted)

Revised 5 Nov 2026. **Bloom is the submission mode.** Catch stays in the build
behind `?catch=1` but is not part of this entry. Nothing has been entered on
Devpost, and no video has been recorded or uploaded.

Deadline: **18 Nov 2026, 12:00 PM PT = 19 Nov 2026, 00:00 Dubai.** Aim to
submit by 17 Nov.

## 1. Form fields

| Field | Entry |
|---|---|
| Title | **Palmful** |
| Tagline (136 of 140 characters) | A tiny creature lives on your open hand. Tilt your palm to guide it to the glowing flower on a fingertip and watch it bloom. Hands only. |
| Track | **Gaming** |
| Division | **New Experience** (the repository starts on 2 Nov 2026) |
| Build URL | **https://iftiikhaarr-glitch.github.io/palmful/** (Bloom is the default: open it in the Quest Browser and pinch *Enter AR*) |
| Source code (if asked) | https://github.com/iftiikhaarr-glitch/palmful |
| Demo video | *Your upload* (section 3) |
| Target launch date | *Your decision* (section 5) |
| Description, including the hand interactions | Section 2 |

## 2. Description (under 500 words; paste as one piece)

**Inspiration.** Holding something small and alive in an open hand, like a
ladybird or a firefly, is a quiet, focused moment. Hand tracking makes your
hand both the controller and the stage, so Palmful exists only on your palm.

**What it is.** A short, seated, hands-only game for Meta Quest in
passthrough. A seed waits in front of you. Hold out an open hand, palm up, and
it flies onto your palm and hatches into Mote, a tiny round creature. Your
palm becomes a small landscape: tilt it and Mote slides. One fingertip carries
a glowing flower in the colour it will bloom, and when Mote sits still a golden
trail shows the way. Rest Mote on that fingertip and the finger blooms. Three
blooms, on the middle, index and ring fingers, complete the garden. No menus,
buttons, controllers or fail states.

**Hand interactions.**
- **Open palm, facing up:** receive the seed.
- **Gentle tilt toward the flowered fingertip:** Mote slides to it. Small
  wobbles don't move Mote; only a deliberate tilt does.
- **Hold Mote on the fingertip for a moment:** it blooms.
- **After three blooms, close your hand into a fist for about a second:** the
  garden resets and Mote hatches again.
- **Hand out of view:** Mote waits, frozen and dimmed, where it was. If that
  hand returns, it carries on. If the hand stays away for three seconds while
  your other hand is held palm up, Mote moves to that hand and starts again from
  the palm, keeping its blooms.
- **Palm turned down:** Mote clings on, and the game asks you to turn your palm
  up.

On the first session, a guide shows one step at a time with a small animated
hand.

**Why passthrough.** The stage is your real hand. Mote sits on your own palm
and the flowers grow from your own fingertips. It does not use the room; the
hand is the point.

**How we built it.** Meta's Immersive Web SDK (WebXR) with three.js, in
TypeScript, hosted on GitHub Pages: it opens from a link in the Quest Browser
with nothing to install. The game rules are unit-tested and kept separate from
rendering. Every visual and sound is generated in code. Each change runs
complete play sessions in Meta's IWER emulator before it deploys.

**Testing status.** Palmful was developed and tested mostly in Meta's IWER
emulator. In one Quest recording of an **earlier build**, Bloom ran at
**90 fps**; the seed landed on the tester's palm and hatched, and Mote rode on
their hand. The **current build**, which adds the in-game guide, has **not yet
been verified on a Quest**. A complete three-bloom session on real hands has
**not been verified** either.

**What's next.** A replay challenge for smooth movement, more creatures, a
second game (Catch) once its cup gesture is calibrated on real hands, and Meta
VR Glasses support.

**Built with:** IWSDK (WebXR), three.js, TypeScript, Vite, IWER, Playwright,
GitHub Actions, GitHub Pages. *Your decision:* add "Claude Code (AI coding
assistant)" if you want to disclose it.

## 3. Demo video: about 2 minutes, laptop emulator

**Setup**
- **Address:** Chrome or Edge, window 1920×1080, at
  **https://iftiikhaarr-glitch.github.io/palmful/?emulate=1**.
- **What to capture:** the window content only. No tabs, bookmarks, desktop,
  notifications or other people.
- **Disclosure:** a caption that stays visible **for the whole video**, added
  as a text overlay in your recorder or editor (white on a dark band,
  bottom-right): **"Laptop emulator; hand simulated with keyboard"**. The game
  itself is not changed.
- **Help panel:** after clicking **Start**, press **?** once to collapse it.
  Its first line, "Laptop emulator: not a headset test", stays visible, which
  is fine.
- **Key rhythm:** press keys at an even pace, about 3 presses a second, and
  pause where the table says *wait*. Rehearse once without recording.
- **Takes:** record one continuous take from step 2 to step 7, then add the
  title and end cards. Don't speed footage up.

**Exact recording sequence**

| Step | Time | Do | Expect |
|---|---|---|---|
| 1 | 0:00–0:06 | Title card (added in editing) | "Palmful: a tiny creature that lives on your hand" |
| 2 | 0:06–0:14 | Load the page, click **Start**, press **?** | The seed floats in front. Guide: "Hold out your hand". |
| 3 | 0:14–0:26 | **Space** (the hand rises palm up). *Wait* about 4 s. | The seed lands and hatches into Mote. Guide: "Tilt gently toward the flower". A pink flower is on the middle fingertip, with a golden trail to it. |
| 4 | 0:26–0:40 | **↑** ×7. *Wait* about 2 s. | Mote slides up the middle finger; it **blooms pink**. Guide: "1 of 3 in bloom". |
| 5 | 0:40–1:05 | **Space**, **↓** ×6, *wait* until Mote is back on the palm (about 2 s); **Space**, **→** ×6, *wait* about 2 s (Mote rolls toward the index side); **↑** ×7, **←** ×4, *wait* about 2 s | A blue flower marker on the index fingertip; Mote slides there and it **blooms blue**. |
| 6 | 1:05–1:32 | **Space**, **↓** ×6, *wait* about 2 s; **Space**, **←** ×6, *wait* about 2 s (Mote rolls toward the pinky side); **↑** ×7, **→** ×4, *wait* about 2 s | A violet marker on the ring fingertip; it **blooms violet**. Card: "All three in bloom", with three dots and "make a fist to play again". |
| 7 | 1:32–1:46 | **Space**, then **F** (fist), *wait* about 2 s; then **F** (open hand) | The flowers clear and Mote hatches again on the palm. |
| 8 | 1:46–1:56 | End card (added in editing) | "Play on Meta Quest 3/3S: iftiikhaarr-glitch.github.io/palmful · Hands only · Built with IWSDK (WebXR)" |

**If a bloom doesn't happen:** after the keys and the wait in step 4, 5 or 6,
press **Space** to level the hand and repeat that step's keys. Cut the retry
out in editing.

**Before uploading, check:**
- the video is under 3:00;
- the caption is in every frame;
- the video description says once that it shows the laptop emulator, with a
  keyboard-simulated hand, not a headset.

**Produced on 5 Nov (not stored in this repository):**
- `palmful-demo-emulator.mp4`: 1:31, 1920×1080, 30 fps, with a silent audio
  track. It's real emulator gameplay recorded at 1280×720 (about 19 fps in the
  cloud's software renderer), upscaled, with the caption on every frame.
- Three gallery PNGs.
- A zip with the raw frames and the scripts used to rebuild it, which was sent
  to the owner. Recording again on a laptop with a GPU gives smoother footage.

## 4. Gallery screenshots (current build, laptop emulator)

Take each one at 1920×1080 with the help panel collapsed, and label it
"Laptop emulator" in the image or its caption.
1. **Guide and target:** just after step 3. Mote on the palm, the golden trail,
   the pink flower marker on the middle fingertip, and the card "Tilt gently
   toward the flower".
2. **Mid-garden:** after step 4, once the card has gone. The pink bloom on the
   middle finger and the blue marker waiting on the index fingertip.
3. **Complete:** at the end of step 6. Three fanned flowers (pink, blue,
   violet) and the "All three in bloom" card.

## 5. Decisions only you can make

1. **Membership:** confirm that you are a Meta VR Start member with Developer
   Access before you submit. This is required by the deadline.
2. **Target launch date.** Suggested: **15 January 2027.** That leaves time
   after judging (about 11 Dec) to verify the current build on a Quest and fix
   what real hands show. If the form means "available now", the web build is
   already live.
3. **AI disclosure:** whether to list Claude Code under "Built with".
4. **Remaining form fields:** whether the live form needs anything this draft
   doesn't cover (for example gallery images, a thumbnail, or team and country
   details). If so, fill them in yourself.
5. **Submit:** when to submit, ideally by 17 Nov. After submitting, don't push
   to `main`, and keep Pages up until winners are announced.

Not verified for this entry: the current build on a Quest (frame rate,
readability of the guide and flower marker), and a complete three-bloom session
on real hands.
