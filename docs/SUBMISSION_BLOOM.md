# Palmful: final Devpost submission package (Bloom) — not submitted

Prepared 5 Nov 2026 from `main` at `e535c31`. **Bloom is the submitted mode**
(the default at the build URL). Catch stays in the build behind `?catch=1` and
is not part of this entry. Nothing has been entered on Devpost or uploaded.

**Status you reported (5 Nov):**
- **Meta VR Start:** the application is **submitted, approval pending**.
- **Developer Access:** **not yet verified**.

Neither is active, and nothing here should claim otherwise.

---

## 1. Requirements

**Sources:**
- **[R]** the official rules and judging text you supplied on 2 Nov, recorded
  in `docs/PROJECT_RECORD.md`;
- **[S]** web-search excerpts of the official 2026 rules page on 5 Nov;
- **[?]** not verified. This cloud session can't open devpost.com,
  developers.meta.com or the live site (network policy), so the live Devpost
  form was **not** read.

| Requirement | Detail | Source |
|---|---|---|
| Deadline | 18 Nov 2026, 12:00 PM PT (= 19 Nov 00:00 Dubai). No changes after the deadline. | R, S |
| Eligibility | Only members of the Meta VR Start program; you must be a member **by the time you submit**. A Meta developer account is required; organisers may ask for proof of eligibility. | S |
| Developer Access | An active Meta account with Developer Access. | R (exact wording [?]) |
| Division | New Experience: conceived and built on or after 24 Sep 2026 (this repository starts on 2 Nov 2026). | R |
| Hands-only | Fully usable with hands end to end, with no controller ever needed. | R, S |
| WebXR/IWSDK entries | Submit **a link** to the hosted build. It must stay available until winners are announced (about 11 Dec). | R ([?] for the exact form field) |
| Video | **Under 3 minutes**, **public on YouTube or Vimeo**, link in the form. Footage "as viewed on a Meta Quest device or via XR Simulator or another equivalent emulator". Show real gameplay; don't lean on AI-generated video. | R; S confirms public YouTube/Vimeo ([?] for the length in the 2026 text) |
| Content | No logos or brands. No identifiable people other than the entrant. | R |
| Form fields | Name, tagline (140 characters), track, division, description (about 500 words: inspiration, how it was built, future plans), hand-interaction notes (optional), target launch date. | R ([?] for live limits and extra fields such as images, "Built with", team, country) |
| Judging | Stage 1: viability, pass/fail. Stage 2: Innovation & Creativity, Experience Design, Technical Implementation (minimum **60 fps** on Quest hardware), Polish & Presentation. Judges use Quest 3 or 3S. | R |
| Tools | No unreleased Meta tools or SDKs. IWSDK 1.1.0-rc.2 is public on npm. | S |

**To check yourself on the live form:** every field's exact limit, any
required images or thumbnail, and how WebXR builds are linked.

---

## 2. Copy-and-paste answers

**Project name**
```
Palmful
```

**Tagline** (136 of 140 characters)
```
A tiny creature lives on your open hand. Tilt your palm to guide it to the glowing flower on a fingertip and watch it bloom. Hands only.
```

**Track:** Gaming  **Division:** New Experience

**Build / try-it-out URL**
```
https://iftiikhaarr-glitch.github.io/palmful/
```
**Source code** (if asked): `https://github.com/iftiikhaarr-glitch/palmful`

**Description** (486 words; paste as one piece)
```
Inspiration
Holding something small and alive in an open hand, like a ladybird or a firefly, is a quiet, focused moment. Hand tracking makes your hand both the controller and the stage, so Palmful exists only on your palm.

What it is
A short, seated, hands-only game for Meta Quest in passthrough. A seed waits in front of you. Hold out an open hand, palm up, and it flies onto your palm and hatches into Mote, a tiny round creature. Your palm becomes a small landscape: tilt it and Mote slides. One fingertip carries a glowing flower in the colour it will bloom, and when Mote sits still a golden trail shows the way. Rest Mote on that fingertip and the finger blooms. Three blooms, on the middle, index and ring fingers, complete the garden. No menus, buttons, controllers or fail states.

Hand interactions
- Open palm, facing up: receive the seed.
- Gentle tilt toward the flowered fingertip: Mote slides to it. Small wobbles don't move Mote; only a deliberate tilt does.
- Hold Mote on the fingertip for a moment: it blooms.
- After three blooms, close your hand into a fist for about a second: the garden resets and Mote hatches again.
- Hand out of view: Mote waits, frozen and dimmed, where it was, and carries on when the hand returns. If it stays away for three seconds while your other hand is palm up, Mote moves to that hand, keeping its blooms.
- Palm turned down: Mote clings on, and the game asks you to turn your palm up.
On the first session, a guide shows one step at a time with a small animated hand.

Why passthrough
The stage is your real hand. Mote sits on your own palm and the flowers grow from your own fingertips. It does not use the room; the hand is the point.

How we built it
Meta's Immersive Web SDK (WebXR) with three.js, in TypeScript, hosted on GitHub Pages: it opens from a link in the Quest Browser with nothing to install. The game rules are unit-tested and kept separate from rendering. Palmful's own visuals and sounds are all generated in code. Each change runs complete play sessions in Meta's IWER emulator before it deploys.

Testing status
Palmful was developed and tested mostly in Meta's IWER emulator. In one Quest recording of an earlier build, Bloom ran at 90 fps, the seed landed on the tester's palm and hatched, Mote rode on their hand, and one finger bloomed. The current build, which adds the in-game guide, has not yet been verified on a Quest, and neither has a complete three-bloom session on real hands. The demo video is laptop-emulator footage, with the hand simulated by keyboard.

What's next
A replay challenge for smooth movement, more creatures, a second game (Catch) once its cup gesture is calibrated on real hands, and Meta VR Glasses support.
```

**Hand-interaction notes** (optional field)
```
Hands only, seated. Open palm up to receive the seed. Tilt gently toward the fingertip with the glowing flower; Mote slides there and that finger blooms after a short rest. After three blooms, make a fist for about a second to play again. Hiding the hand pauses Mote in place; turning the palm down makes Mote cling and the game asks you to turn it up. Enter AR with a pinch on the page's button; no controller is ever needed.
```

**Built with** (tags, if the form has them)
```
IWSDK, WebXR, three.js, TypeScript, Vite, IWER, Playwright, GitHub Actions, GitHub Pages
```
*Your decision:* add "Claude Code (AI coding assistant)" if you want to
disclose AI-assisted development.

**Video URL:** *your public YouTube or Vimeo link* (section 3).
**Target launch date:** *your decision.* Suggested: 15 January 2027, which
leaves time after judging to verify the current build on a Quest. Alternatively
use today's date, if the form means "already live".
**Gallery:** the three PNGs in section 3. Caption each one "Laptop emulator;
hand simulated with keyboard".

---

## 3. Media (not stored in this repository)

- **`palmful-demo-emulator.mp4`:** 1:31, 1920×1080, 30 fps, silent audio.
  - Real laptop-emulator gameplay of the current build: the seed lands, Mote
    moves, pink, blue and violet blooms, "All three in bloom", then the fist
    restart.
  - The caption "Laptop emulator; hand simulated with keyboard" is on every
    frame, including the title and end cards. The end card reads "Made for Meta
    Quest 3 / 3S", not "verified on".
  - **Choppy:** recorded at about 18 fps in the cloud without a GPU. Use it only
    as a fallback.
- **Gallery** (1920×1080, labelled and captioned):
  - `palmful-gallery-1-first-target.png`
  - `palmful-gallery-2-first-bloom.png`
  - `palmful-gallery-3-all-three-blooms.png`
- **`palmful-media-project.zip`:** the scripts that record and edit a smoother
  replacement on a Windows laptop (Node, Git and FFmpeg only); steps in its
  `README-media.txt`.
  - Tested in the cloud: a fresh recording, then `node build.mjs`, produced an
    89.5 s 1080p MP4.
  - Not tested here: the visible-window GPU mode and Windows itself.
- **Manual key sequence** (for a by-hand OBS fallback; press keys about 3 a
  second):
  - **Start:** **Start**, **?**, then **Space**; wait for the hatch.
  - **First bloom:** **↑**×7.
  - **Second bloom:** **Space**, **↓**×6, wait; **Space**, **→**×6, wait;
    **↑**×7, **←**×4.
  - **Third bloom:** **Space**, **↓**×6, wait; **Space**, **←**×6, wait;
    **↑**×7, **→**×4.
  - **Replay:** **Space**, **F**, wait about 2 s, then **F** again.

---

## 4. Only you can do these

1. **Start approval:** check that Meta VR Start has approved your membership.
   **You can't submit before it is approved.**
2. **Developer Access:** verify it on your Meta developer account.
3. **Video:** record the smoother replacement (zip) or approve the 1:31 cloud
   version. Watch it once; the caption must be in every frame.
4. **Upload:** put the video on YouTube or Vimeo as **public**, check it plays
   while signed out, and paste the link.
5. **Personal and eligibility fields:** name, country, age and residency
   confirmations, and team.
6. **Decide:** the target launch date and whether to list Claude Code.
7. **Final check, then submit** by about 17 Nov:
   - the build URL opens on a laptop;
   - the repository is public.

   After submitting, don't push to `main`, and keep Pages up until winners are
   announced.

---

## 5. Readiness report

| Item | State |
|---|---|
| Build live at the URL (Bloom default) | Ready. Last deploy: Pages run #15 from `2d5d0ac`, all checks passed. `main` since has docs-only changes. |
| Hands-only, New Experience, Gaming | Ready |
| Text for every known field | Ready (section 2); live-form limits [?] |
| Gallery images | Ready (3 PNGs) |
| Video | Fallback ready (choppy); smoother replacement needs your laptop |
| Start membership | **Pending (blocker until approved)** |
| Developer Access | **Not yet verified** |
| Current build on a Quest (60 fps, guide readability, three blooms) | **Not verified.** Only an earlier build ran on a Quest, at 90 fps in one recording. |
