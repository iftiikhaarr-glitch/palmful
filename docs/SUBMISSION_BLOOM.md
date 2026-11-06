# Palmful: final Devpost submission package (Bloom) — draft, not submitted

Updated 6 Nov 2026 from `main` at `e535c31`. **Bloom is the submitted
experience**, at https://iftiikhaarr-glitch.github.io/palmful/ (the default
mode). Catch stays in the build behind `?catch=1` and is not part of this entry.
Nothing has been submitted, and no media has been uploaded.

**Eligibility (as you reported; both confirmed):**
- **Meta VR Start:** membership approved on 6 Nov 2026.
- **Meta VR developer account:** verified.
- **Membership email:** you corrected the draft's membership email field
  yourself; your Devpost login stays as it is. Check that the field matches
  the address on your Start approval email.

Keep the approval email and a screenshot of the verified developer account, in
case the organisers ask for proof.

---

## 1. Requirements (official rules and overview page, read 6 Nov 2026)

| Requirement | What the rules say | Palmful |
|---|---|---|
| Deadline | 18 Nov 2026, 12:00 PM PST; no changes after the entry period | Submit by about 17 Nov |
| Eligibility | Age 18+ and not in an excluded territory; active Meta account with **Developer Access** by submission; submitter is a **Start member** by submission | Developer Access and Start membership confirmed; age and residency are yours to confirm |
| Build (IWSDK / WebXR) | "A link will be required for judges to access and test your application" (GitHub Pages or another host); free; available until the winner announcement (about 11 Dec) | Live link (below) |
| Video | "less than three (3) minutes", footage "as viewed on a Meta Quest device or via XR Simulator or another equivalent emulator", **public on YouTube or Vimeo**, link in the form; show real gameplay, no AI-generated video | 1:31 emulator video, labelled |
| Form | Submission name; tagline (140 characters); track; division; text description (inspiration, how you built it, future plans; suggested 500 words or less); hand interactions and what excites you about the future of VR (optional); **target launch date, if not already published**; name, email and role for each team member, if applicable | Section 2 |
| Track / division | Gaming; New Experience (conceived and built after 24 Sep 2026; no pre-existing codebase) | Gaming; New Experience (repository started 2 Nov 2026) |
| Content | Hands-first end to end; English; no identifiable people other than entrants; no corporate logos, brand names or slogans; original work and properly licensed third-party code | Hands only; no third-party art or audio |
| Judging | Stage 2 includes "performant on Meta Quest hardware (min 60 fps)" and high-quality text, images and video | **Current build not tested on a Quest** |

Sources: https://start-developer-competition-26.devpost.com/rules and the
overview page https://start-developer-competition-26.devpost.com/.

**Not read:** the logged-in draft form itself (this session can't sign in to
Devpost), so field labels, character limits and any extra questions are
unconfirmed.

---

## 2. Copy-and-paste answers for each field

**Submission name**
```
Palmful
```

**Tagline** (136 of 140 characters)
```
A tiny creature lives on your open hand. Tilt your palm to guide it to the glowing flower on a fingertip and watch it bloom. Hands only.
```

**Track:** Gaming  **Division:** New Experience

**Project link / Try it out** (the build judges open)
```
https://iftiikhaarr-glitch.github.io/palmful/
```
**Source code** (if there's a field): `https://github.com/iftiikhaarr-glitch/palmful`

**Text description** (paste as one piece; 451 words including the launch date
line once you fill it in)
```
Inspiration
Holding something small and alive in an open hand, like a ladybird or a firefly, is a quiet, focused moment. Hand tracking makes your hand both the controller and the stage, so Palmful exists only on your palm.

What it is
A short, seated, hands-only game for Meta Quest in passthrough. A seed waits in front of you. Hold out an open hand, palm up, and it flies onto your palm and hatches into Mote, a tiny round creature. Your palm becomes a small landscape: tilt it and Mote slides. One fingertip carries a glowing flower in the colour it will bloom, and a golden trail shows the way. Rest Mote on that fingertip and the finger blooms. Three blooms, on the middle, index and ring fingers, complete the garden; a fist plays again. On the first session, a guide shows one step at a time. No menus, buttons, controllers or fail states; a session takes a few minutes.

Why passthrough
The stage is your real hand. Mote sits on your own palm and the flowers grow from your own fingertips. It does not use the room; the hand is the point.

How we built it
Meta's Immersive Web SDK (WebXR) with three.js, in TypeScript, hosted on GitHub Pages, so it opens from a link in the Quest Browser with nothing to install. The game rules are unit-tested and kept separate from rendering. Mote ignores small tracking wobbles and only moves on a deliberate tilt, and hand loss pauses it in place instead of failing the player. Palmful's own visuals and sounds are all generated in code. Each change runs complete play sessions in Meta's IWER emulator before it deploys.

How to try it
On Quest 3 or 3S, open https://iftiikhaarr-glitch.github.io/palmful/ in the Quest Browser, pinch Enter AR, put the controllers down and hold out an open hand, palm up. Without a headset, add ?emulate=1 for a keyboard-driven laptop emulator.

Testing status
Palmful was developed and tested mostly in Meta's IWER emulator; the demo video is laptop-emulator footage with the hand simulated by keyboard. One Quest recording of an earlier build showed 90 fps on its debug panel, the seed landing and hatching on a tester's palm, and one finger blooming; that is not evidence for the current build. The current build, which adds the in-game guide, has not yet been verified on a Quest, and neither has a complete three-bloom session on real hands.

What's next
Verifying the current build on Quest 3 and 3S with first-time players, a replay challenge for smooth movement, more creatures, a second game (Catch) once its cup gesture is calibrated on real hands, and Meta VR Glasses support.

Target launch date: [YOUR DATE]
```

**Hand interactions and the future of VR** (optional field)
```
Palmful is played with one bare hand, seated, and never needs a controller (Enter AR is a pinch on the page's button).
- Open palm, facing up: the seed comes to your hand and hatches.
- Gentle tilt toward the fingertip with the glowing flower: Mote slides there. Small wobbles don't move Mote; only a deliberate tilt does.
- Hold Mote on that fingertip for a moment: the finger blooms. Three blooms complete the garden.
- After three blooms, a fist held for about a second plays again.
- Hand out of view: Mote waits, frozen and dimmed, and carries on when the hand returns. After three seconds it can move to your other hand if that one is held palm up, keeping its blooms.
- Palm turned down: Mote clings on and the game asks you to turn your palm up.
The game reads the WebXR hand joints for a palm frame (centre, normal, finger paths), filters them, and runs a small physics model with static friction so tracking noise doesn't push Mote around.
What excites us about VR: when your own hand becomes the place where something happens, the experience can only exist in passthrough with hand tracking. That makes small, calm, personal moments possible that no flat screen can give.
```

**Target launch date** (its own field; *your decision*)

Palmful is **not** published on the Meta VR Store, so this field applies. The
playable web build is already live and free. Pick the date you're aiming for
and enter it in both the field and the last line of the description, for
example a date after real-hand testing on Quest. I haven't chosen one.

**Team members:** if you're entering solo, leave this empty or list yourself
as you prefer. Otherwise add each member's name, email and role.

**Built with** (tags, if the form has them)
```
IWSDK, WebXR, three.js, TypeScript, Vite, IWER, Playwright, GitHub Actions, GitHub Pages
```
*Your decision:* add "Claude Code" if you want to disclose AI-assisted
development.

**Video link:** your public YouTube or Vimeo URL (section 3).

---

## 3. Media (files are not stored in this repository)

**Video:** use the smoother Windows recording if you've made it and
`check.mjs` rated it GOOD. Otherwise use the fallback
`palmful-demo-emulator.mp4`:
- **Length:** 1:31, under the 3-minute limit; 1920×1080, 30 fps, silent audio.
- **Content:** real laptop-emulator gameplay of the current build. The seed
  lands, Mote moves, pink, blue and violet blooms, "All three in bloom", then
  the fist restart. All five events are confirmed by the recording's event log.
- **Caption:** "Laptop emulator; hand simulated with keyboard" is on every frame,
  title and end cards included.
- **Known weakness:** visibly choppy (about 18 fps capture without a GPU).

**Upload text** (YouTube or Vimeo):
- **Title:** `Palmful – Bloom demo (laptop emulator)`
- **Description:** "Palmful is a hands-only game for Meta Quest in passthrough: a
  tiny creature lives on your open hand, and tilting your palm guides it to a
  flower on a fingertip, which blooms. This video is laptop-emulator footage
  (Meta's IWER WebXR emulator) with the hand simulated by keyboard; it is not
  headset footage. Play on Quest 3/3S in the Quest Browser:
  https://iftiikhaarr-glitch.github.io/palmful/"
- **Visibility:** **Public**.

**Gallery images:** each is labelled and carries the emulator caption, in two
sets:
- **16:9 (1920×1080):** `palmful-gallery-1-first-target.png`,
  `palmful-gallery-2-first-bloom.png`, `palmful-gallery-3-all-three-blooms.png`.
- **3:2 (1500×1000):** the same three as `-3x2` files. Devpost commonly
  recommends 3:2 for gallery images and thumbnails; check the form's own hint.

**Thumbnail:** `palmful-thumbnail-3x2.png` (1500×1000): the "Palmful" title over
the all-three-blooms frame, with the emulator caption.

**Smoother video:** `palmful-media-project.zip`, with Windows steps in its
`README-media.txt`.

---

## 4. Remaining before you press "Submit project"

1. **Video:** choose the smooth recording or the 1:31 fallback, upload it as
   **public** with the text above, and check it plays while signed out. Paste
   the link into the form.
2. **Target launch date:** choose it, then enter it in the field and in the
   description's last line.
3. **Paste and upload:** paste the section 2 texts, and upload the gallery
   images and thumbnail.
4. **Personal and eligibility questions:** confirm age and residency, accept
   the rules and terms, and check the membership email field matches your
   Start approval.
5. **Preview:** in Devpost's preview, check that the video plays, the link
   opens, the track is Gaming, the division is New Experience, and the text
   shows unchanged.
6. **Submit** by about 17 Nov. After that, don't push to `main`, and keep
   Pages up until about 11 Dec.

---

## 5. Readiness report (6 Nov 2026)

| Item | State |
|---|---|
| Public build URL | **Live** at https://iftiikhaarr-glitch.github.io/palmful/. Deployed by Pages run #16 from `main` `e535c31`. On 6 Nov the live URL itself passed the full Bloom session in the laptop emulator (24 checks: seed, three blooms, completion, fist restart, hand loss) and the 2D landing check |
| Start membership / developer account | Confirmed (as you reported) |
| Track, division, name, tagline, description, hand interactions | Ready (section 2) |
| Target launch date | **Open: your decision** (required, because Palmful isn't on the Meta VR Store) |
| Video | Fallback ready and verified (1:31, labelled, all three blooms and restart); **not uploaded** |
| Gallery and thumbnail | Ready |
| Membership email field | Corrected by you; not visible to this session |
| Devpost draft fields, preview, playback | **Not checked by this session** (no Devpost or video-account access) |
| Current build on a Quest | **Not verified** (judging expects at least 60 fps on Quest hardware) |
