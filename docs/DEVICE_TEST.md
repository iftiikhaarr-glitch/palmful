# Palmful device test protocol (Quest 3 / 3S)

> **Testers: use [`QUEST_TEST_GUIDE.md`](QUEST_TEST_GUIDE.md)**, the short
> 3-minute version with the final pass/fail table. This file keeps the original
> pre-registered criteria (2 Nov 2026) for the record. The guide is stricter on
> tracking (pass ≥ 95 %, fail < 90 %) and adds a frame-rate and recovery check.

Criteria written on 2 Nov 2026, **before** any headset result exists. Do not
edit thresholds after seeing results; record them as they are.

## What the emulator has and has not proven

| Verified in the IWSDK emulator (IWER, Chromium, no GPU) | Needs a real Quest 3 / 3S |
|---|---|
| Project typechecks, builds, and loads with hand tracking requested | Hand-tracking quality on a tilted, palm-up hand |
| Palm axis convention (palm-up detected on 49/51 frames) | Whether Mote looks *attached* to real skin in passthrough |
| Tilt 35° → Mote slides onto the middle finger → bloom → target moves to index | Visible shake (jitter) of Mote after filtering |
| Hand disconnect → Mote freezes and dims in place; reconnect → resumes on the same finger | Real tracking-loss frequency and recovery feel |
| Tip toward wrist → back onto palm; palm down → clings, no movement | Frame rate (rules: min 60 fps on Quest hardware) |
| Simulation unit tests (8): flat palm with 2 mm jitter does not drift, cupped fingers block, left hand works | Whether IWSDK draws a virtual hand over the real one in AR, and if that helps or hurts |
| | Finger occlusion (curled fingers should hide Mote) |
| | Whether a first-time person understands "tip your hand" without help |
| | Comfort of holding a palm up for 5–10 minutes seated |

Emulator frame rates (1–30 fps) are software rendering in a container and say
**nothing** about headset performance.

## Setup (10 minutes)

1. On the Quest, open the Browser and go to the deployed URL with
   `?debug=1` appended (example: `https://<user>.github.io/palmful/?debug=1`).
2. Tap **Enter AR**. Put controllers down; hand tracking must be on
   (Settings → Movement tracking → Hand tracking).
   Live URL: https://iftiikhaarr-glitch.github.io/palmful/?debug=1
3. Sit. Hold your right hand palm up about 30 cm in front of your chest.
4. Start the Quest's own recording (Meta button → Camera → Record video).
   This footage is also usable for the demo video.

The debug panel above your palm shows: fps, tracked %, palm-up %, jitter (mm),
losses, longest loss, place/mood/blooms, time to first bloom.

## Trials (record every number in the table below)

- **T1 Hold still (60 s):** palm up, flat, still. Note jitter and tracked %. (Jitter includes deliberate motion, so it is only meaningful here.)
- **T2 Tilt play (60 s):** tilt slowly 0–45° in all directions; get one bloom.
- **T3 Cup and roll (60 s):** cup the hand, roll it sideways, turn palm down and back up.
- **T4 Interrupt:** press the Meta button for 5 s, return. Then hide the hand behind your back for 5 s, bring it back.
- **T5 Fresh person (if anyone is available):** give them the headset already in AR. Say only "there's a creature on your hand". Time to first bloom. No hints.

| Trial | fps | tracked % | jitter mm | losses | longest loss ms | first bloom s | notes |
|---|---|---|---|---|---|---|---|
| T1 | | | | | | | |
| T2 | | | | | | | |
| T3 | | | | | | | |
| T4 | | | | | | | |
| T5 | | | | | | | |

**The deciding question:** does Mote visibly stay on a real palm during
natural movement? The recording from T2 is the primary evidence; the numbers
support it.

## Decision rules (pre-registered)

**Abandon Palmful** (switch concept) if either core-feasibility check fails
on Quest 3/3S, in normal indoor light, after one tuning attempt:

1. **Tracking:** tracked % below **90 %** in T1 or T2 (palm up, tilts ≤ 45°).
2. **Attachment:** jitter above **3 mm RMS** in T1, *or* the creature visibly
   floats off / lags behind the real hand by more than about a fingertip's
   width during T2, so that it does not read as "sitting on my hand".

**Simplify, don't abandon**, if:

- fps below 72 but at least 60 → cut effects, lower geometry, retest.
- fps below 60 even with the creature only → the web stack is the problem,
  not the idea; profile for one day before deciding.
- T5 person cannot bloom within 60 s → redesign onboarding (one day), not the concept.
- Curling fingers do not occlude Mote → try IWSDK depth occlusion; if
  unavailable, design around it (Mote stays on the palm side, fingers stay open).
- Cupping or palm-down loses tracking often → remove those moments from
  the design; keep tilt-only.

**Time gate:** if no headset session has happened by **Sun 8 Nov, 23:59
Dubai**, Palmful is not abandoned, but scope freezes to what the emulator has
proven, and the demo-video plan switches to the fallback in
`PROJECT_RECORD.md`. An emulator-only video cannot show a real hand, which
weakens the core pitch; that is the main cost of the no-headset route.
