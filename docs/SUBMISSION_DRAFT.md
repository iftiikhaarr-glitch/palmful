# Palmful: submission draft (not submitted)

**Status: draft for review, 4 Nov 2026.** Nothing here has been entered on
Devpost, no video has been recorded or uploaded, and the final mode is not
chosen. Bloom and Catch are both candidates until the Quest 3/3S test decides
(see [`QUEST_TEST_GUIDE.md`](QUEST_TEST_GUIDE.md), section 6).

Deadline: **18 Nov 2026, 12:00 PM PT = 19 Nov 2026, 00:00 Dubai.** No changes
are allowed after it, and the link must keep working until winners are
announced (about 11 Dec).

---

## 1. Requirements check

Sources:
- the official rules and judging text the entrant supplied on 2 Nov
  (summarised in [`PROJECT_RECORD.md`](PROJECT_RECORD.md));
- public announcements found on 4 Nov.

The Devpost rules page and the live site could not be opened from the cloud
session that wrote this draft. **Re-read the rules page once before
submitting.**

| Requirement | State | Notes |
|---|---|---|
| Meta VR Start program membership by submission time | **Unconfirmed, possible blocker** | Only the entrant can confirm. A public forum thread reports the Start application page being unavailable, so apply or confirm early. |
| Meta account with Developer Access | **Unconfirmed** | Entrant to confirm. |
| Fully usable with hands, no controller ever | Met by design | Every action is a hand pose. Not yet confirmed on a headset. |
| New Experience division: built on or after 24 Sep 2026 | Met | The repository starts on 2 Nov 2026. |
| WebXR/IWSDK entry submitted as a link that stays up until about 11 Dec | Ready | GitHub Pages, deployed from `main` (`b952d41`, run #12, all checks passed). Keep the repository public and Pages on. The public announcement mentions an APK channel for Unity, Unreal and native apps only. **Re-check that a link is still the WebXR route.** |
| Video under 3 minutes, public on YouTube or Vimeo | **Missing** | The plan is in section 2. Emulator footage is allowed by the rules ("XR Simulator or another equivalent emulator") but must show real gameplay. |
| Form: name, tagline (140 characters), track, division, description (about 500 words: inspiration, how built, future plans), hand-interaction notes (optional), target launch date | **Drafted, not entered** | See section 3. The target launch date needs the entrant's decision. |
| Minimum 60 fps on Quest hardware (judging) | **Unverified** | Quest test item. Emulator frame rates say nothing about Quest. |
| Purposeful passthrough | Weak point | Passthrough shows the player's real hand, which is the stage. Palmful does not use the room itself. Say this plainly in the description. |
| No logos or brands; no identifiable people other than the entrant | OK so far | The app has no third-party assets. In the video, record only the page content, with no browser tabs or desktop, and show no one else. |
| Final mode chosen | **Missing** | Decided by the Quest test (section 4). |
| Which URL judges open | **Decision pending** | Bloom is the default at the root URL. If Catch wins, either submit the `?catch=1` link or make Catch the default in a small reviewed change before the deadline. |

**Possible blocker:** Start program membership. Everything else can be done in
time, but a missing membership would disqualify the entry, so it should be
confirmed first.

---

## 2. Video plan (under 3 minutes; laptop-emulator fallback)

Use this plan only if no usable Quest footage arrives. If the tester's
recording is usable (with the tester's permission, and no identifiable person
other than the entrant), real Quest footage replaces sections C–F.

**Honesty rules for emulator footage:**
- A caption stays on screen the whole time: *"Laptop emulator (Meta IWER). The
  hand is simulated with keys; this is not Quest hand tracking."*
- The narration and description say the same thing once.
- Never cut emulator footage together with headset footage as if they were one
  take.
- Don't speed up or edit hand motion so that it looks like real tracking.
- No AI-generated footage.

**Capture setup:**
- Chrome at 1920×1080 with the window content only: no tabs, bookmarks or
  desktop.
- Show the help panel only where the keys need explaining; hide it with `?`
  otherwise.
- Record each take separately, then cut.

Times are targets; the total stays under 2:50.

| # | Time | Shot | What it shows |
|---|---|---|---|
| A | 0:00–0:12 | Title card: "Palmful: a tiny creature that lives on your hand", then the caption line above | What the game is; honest labelling from the first second |
| B | 0:12–0:25 | The 2D landing page on the live site | The judges' entry point and "Enter AR" |
| C | 0:25–0:45 | **Opening**: hand lowered; the seed waits above "Hold out your hand". Press Space: the hand rises palm up | The wordless first moment |
| D | 0:45–1:35 | **One successful interaction**, chosen mode (scripts below) | The core mechanic, once, clearly |
| E | 1:35–2:10 | **Three-part progress**: the rest of the run, sped up 2× and labelled "2× speed" | All three colours or blooms filling in |
| F | 2:10–2:25 | **Completion** card | The goal is reached |
| G | 2:25–2:40 | **Restart**: open the hand, make a fist, everything resets to 0 | Replay without controllers |
| H | 2:40–2:50 | End card: live link, "Built with IWSDK (WebXR) for Meta Quest", caption repeated | Where to play |

**D/E/F/G for Catch** (`?emulate=1&catch=1`, keys from the README):
1. Space: the gold seed glows, then drifts down in the left lane.
2. Hold ← until the ring turns green. The seed lands in the open palm.
3. C (cup): "Gold 1/1", and a gold flower grows. C again opens the hand.
4. Blue falls on the right and pink in the centre: same steps.
5. At 3/3, "All three caught".
6. C (open), F (fist): every count resets to 0/1; F again opens the hand.

Optional: one deliberate miss in E, to show that the same seed returns and the
gold catch stays.

**D/E/F/G for Bloom** (`?emulate=1`):
1. Space: the seed lands and hatches into Mote. A golden trail shows the way.
2. ↑ ×7: Mote slides to the middle fingertip, and it blooms.
3. Index and ring blooms, using the README key sequence.
4. "All three in bloom", with three petal-coloured dots.
5. F, F: it hatches again.

**Takes to avoid:**
- the inspection camera (`[ ] - = R`);
- `&debug=1`;
- the hand-size buttons.

These are testing aids, not gameplay, and would distract.

**Two-hand catch:** optional. If it is shown at all, a single 5-second shot
inside E, labelled "optional two-hand mode".

---

## 3. Devpost text (draft)

**Name:** Palmful

**Tagline** (140 characters maximum; pick the one matching the final mode):
- Bloom (137): *A tiny creature lives on your open hand. Tip your palm to guide
  it to a glowing fingertip and watch it bloom. Hands only, no controllers.*
- Catch (124): *Glowing seeds drift down toward your open hand. Get under each
  one, then gently cup to catch it. Hands only, no controllers.*

**Track / division:** Gaming · New Experience.

### Short description

Palmful is a small, seated game where your own hand is the whole stage. In
passthrough on Meta Quest 3/3S, you hold out an open palm and a glowing seed
comes to it. There are no buttons, menus or controllers. Everything is done by
how you hold your hand. A session takes a few minutes and ends with three
small flowers. Making a fist starts it again.

### How it works

[Bloom] The seed hatches into Mote, a small creature that sits on your palm.
Tipping your hand makes Mote slide, as if your palm were a tiny landscape. It
sits still until the tilt is steep enough, so small tracking shakes don't move
it. Guide Mote to the glowing fingertip and that finger blooms. Three blooms
complete the session.

[Catch] Seeds fall one at a time, gold, blue and pink, each in its own lane. A
ring at palm height shows where each one will land; it turns green when your
open palm is underneath. Let the seed land, then gently cup your hand to catch
it. A progress display counts "Gold · Blue · Pink". A miss sends the same seed
back, and earlier catches are kept.

Both modes are built around what hand tracking does well:
- **Slow, deliberate poses:** open, tilt, cup, fist.
- **Hand loss is handled:** if tracking drops, the game pauses where it is and
  resumes when your hand returns.
- **No accidental actions:** a catch needs an open landing followed by a
  held cup, and replay needs an open hand followed by a fist.

**Built with:** Meta's Immersive Web SDK (IWSDK 1.1.0-rc.2, WebXR) and the
three.js it includes, TypeScript and Vite. It is hosted on GitHub Pages, so it
opens directly in the Quest Browser with nothing to install. All visuals and
sounds are generated in code, with no third-party assets. The game rules are
plain, tested TypeScript, kept apart from rendering. Every change runs unit
tests and full play sessions in Meta's IWER emulator before it deploys.

### Tools used

- IWSDK 1.1.0-rc.2 (WebXR hand tracking, AR passthrough)
- three.js (bundled with IWSDK)
- IWER (Meta's WebXR emulator), for laptop play and automated tests
- TypeScript, Vite, Node test runner
- Playwright (headless Chromium end-to-end tests)
- GitHub Actions and GitHub Pages
- Claude Code (AI coding assistant), used during development. **The entrant
  decides whether to list it**; listing it is the transparent choice.

### What makes Palmful distinctive

- **The stage is your hand.** The game has no world of its own; it happens on
  your palm, so it only works with hand tracking in passthrough. It is built
  for this platform, not ported to it.
- **Designed around tracking limits, not against them.** Slow, deliberate
  poses; a deliberate dead zone so small tracking shakes don't move anything;
  pauses during tracking loss; guards against accidental catches and restarts.
- **Calm and short.** Seated, a few minutes, no fail state that ends the
  run. It suits a first-time user of hand tracking.
- **Instant access.** A link opens in the Quest Browser; there is nothing to
  install.

### Inspiration, future plans (for the ~500-word description)

- *Inspiration:* the moment of holding something small and alive in your palm,
  like a ladybird or a firefly. Hand tracking makes the hand itself the
  controller and the scene at once.
- *Future plans:*
  - a "gentle hands" replay challenge that rewards smooth movement;
  - more creatures and seed types;
  - an optional two-hand mode (already built behind `&hands=2`);
  - Meta VR Glasses support. Pinch and wrist pose are the inputs the glasses
    rely on, which the "Leaf" variant would use.

**Honest-status line** (keep it in the description):
- *If no Quest result exists by the deadline:* "Developed and tested in Meta's
  IWER emulator; Quest 3/3S hand-tracking quality and frame rate were not
  verified on a headset at submission time."
- *If the Quest test has run:* replace that line with what was actually
  measured.

### Hand-interaction notes (optional field)

- Open palm up to start.
- [Bloom] Tilt to guide Mote.
- [Catch] Move an open palm under the falling seed, then gently cup.
- Hide the hand to pause.
- Open the hand, then make a fist, to play again.
- No pinch, no controllers, no UI buttons inside the headset.

---

## 4. What we still need from a Quest tester

| Result (from the checklist) | Decision it affects |
|---|---|
| `fps` in both modes | Technical Implementation (60 fps minimum). Below 60: simplify the scene before submitting. |
| `tracked` % and recovery after hiding the hand | Whether either mode is viable. A failure here affects both modes. |
| Bloom: still-hold `jitter` and video of Mote on the skin | Bloom pass or fail, so whether Bloom can be the final mode. |
| Catch: three `cup` readings (flat, relaxed, gently cupped) | Whether the cup threshold (0.42) needs tuning before the mode choice. |
| Catch: deliberate attempts, number of catches, any unintended catch | Catch pass or fail, so whether Catch can be the final mode. |
| Catch: hand hidden mid-fall; no restart after 3/3 | Catch pass or fail (robustness). |
| Catch opening: does the pulsing glow cover the "Hold out your hand" text or make it confusing? (looking normally, then slightly downward) | If yes, a usability fix (hint position or pulse) and a retest before the final mode choice. If no, the emulator-only 3 px gap is closed as not a headset problem. |
| Which mode the tester would rather replay, and why | The tie-break when both pass (no preference: Bloom). |
| Comfort (arm, eyes, nausea) | Session length and pose design; could block a mode. |
| Whether the white hand outline sits on the real hand | Whether the seed and Mote look "in your palm"; video framing. |
| Whether the Quest Browser shows its own Enter prompt as well as our button | Onboarding text on the landing page. |
| Quest 3 or 3S, and the lighting | Context for every number above. |
| Optional, with permission: usable screen recording | Real Quest footage replaces emulator shots in the video. |

---

## 5. Final-submission checklist

**Links**
- Live (bloom, default): https://iftiikhaarr-glitch.github.io/palmful/
- Live catch: https://iftiikhaarr-glitch.github.io/palmful/?catch=1
- Laptop demo: https://iftiikhaarr-glitch.github.io/palmful/?emulate=1 (catch:
  `?emulate=1&catch=1`)
- Repository: https://github.com/iftiikhaarr-glitch/palmful
- Tester checklist: https://github.com/iftiikhaarr-glitch/palmful/blob/main/docs/QUEST_QUICK_CHECKLIST.md
- Devpost: https://start-developer-competition-26.devpost.com/

**Remaining tasks, in order**
1. [ ] Entrant: confirm Start program membership and Developer Access.
2. [ ] Entrant: re-read the Devpost rules and confirm WebXR entries submit a
   link, plus the video length and hosting rules.
3. [ ] Find a tester; run the quick checklist on Quest 3/3S (target: Sun 8 Nov).
4. [ ] Review the results; choose Bloom or Catch with the decision table.
5. [ ] Fix only what the results require (for example the cup threshold, the
   catch-opening hint or pulse, performance), with a retest, in small reviewed
   PRs.
6. [ ] Decide the judges' URL (root URL as is, or `?catch=1`, or make Catch the
   default).
7. [ ] Record the video (section 2); check it is under 3:00, labelled honestly,
   and shows no logos or other people.
8. [ ] Upload the video publicly to YouTube or Vimeo; open it signed out to
   check it plays.
9. [ ] Fill the Devpost form from section 3, keeping only the chosen mode's
   text, and add the honest-status line.
10. [ ] Final checks:
    - `main` is green;
    - the live links open on Quest and on a laptop;
    - the repository is public;
    - the kept branches and the rollback branch are still there.
11. [ ] Submit well before 19 Nov 00:00 Dubai; don't push to `main` after
    submitting.
12. [ ] Keep Pages and the repository up until winners are announced (about
    11 Dec).
