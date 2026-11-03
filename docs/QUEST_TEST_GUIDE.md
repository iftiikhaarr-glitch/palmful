# Palmful: Quest 3 / 3S test (about 15 minutes, 6 of them playing; +2 for optional Part C)

Thank you for testing. Palmful is a small, hands-only experience. There are
two versions, and this test decides which one we keep:

- **A. Bloom** (default): a tiny creature, Mote, lives on your open palm; you tip
  your hand to slide it to a glowing fingertip, which blooms.
- **B. Catch**: a glowing seed drifts down; you move your open, palm-up hand
  under it, let it land, then gently cup your hand to catch it.

No account or install is needed. Nothing has been measured on a Quest yet; all
results so far come from an emulator on a laptop.

## 1. Set up (about 5 minutes)

1. Headset: **Quest 3 or Quest 3S**, charged, normal indoor light.
2. Turn on hand tracking: **Settings → Movement tracking → Hand and body
   tracking → Hand tracking: on**. Put both controllers **down, out of reach**.
3. Sit down.
4. Start recording before each part: look at your palm and pinch the **Meta
   icon** that appears, then **Camera → Record video**. (Menu names can differ
   slightly between headset software versions.)
5. To leave a part, press the Meta button and close the browser tab, then
   open the next address.

## 2. Part A: Bloom (3 minutes)

Open the **Browser** and enter exactly:
**`https://iftiikhaarr-glitch.github.io/palmful/?debug=1`**
Pinch **Enter AR**. If asked to allow hand tracking or spatial data, choose **Allow**.

| Time | Do this |
|---|---|
| 0:00–0:30 | Hold your **right hand out, palm up**, about 30 cm in front of your chest. A seed falls into it and hatches. Keep the hand **completely still for 20 s**. |
| 0:30–1:30 | Tip your hand slowly so Mote slides to the glowing fingertip. Try for all three blooms. Move naturally. |
| 1:30–2:00 | Cup your hand a little, roll it sideways, turn it palm-down for 3 s, then palm-up again. |
| 2:00–2:30 | Hide your hand behind your back for 5 s, then bring it back. Press the Meta button once, then return. |
| 2:30–3:00 | Hold palm up and still for 20 s. Stop recording. |

## 3. Part B: Catch (3 minutes)

Open: **`https://iftiikhaarr-glitch.github.io/palmful/?catch=1&debug=1`**
Pinch **Enter AR**. Three seeds, one at a time: **gold circle** (left lane),
**blue diamond** (right lane), **pink triangle** (centre lane). The display
above the lanes shows "Gold 0/1 · Blue 0/1 · Pink 0/1"; catch one of each.

| Time | Do this |
|---|---|
| 0:00–0:20 | **Cup calibration** (read the `cup` number on the debug panel): hold your hand palm up **flat** for 5 s, then **relaxed** (natural, slightly curled) for 5 s, then **gently cupped** (as if holding water) for 5 s. Say each number aloud. |
| 0:20–1:40 | Play: a seed glows, then drifts straight down. Move your **open** palm under it (the ring turns green), let it land, then **gently cup**. Say "attempt" each time you deliberately go for one. |
| 1:40–2:10 | **False-catch check**: when the next seed lands in your open palm, keep the hand open and still for 5 s (it must *not* be caught). Then cup to catch it. |
| 2:10–2:40 | **Miss and loss check**: let one seed fall past without moving (the same colour must come back; earlier catches stay). Then, while a seed is falling, hide your hand for 3 s and bring it back (the seed should pause). |
| 2:40–3:00 | At 3/3, keep the catching hand cupped (or squeeze it) for 3 s: the game must **not** restart. Then open your hand and make a fist: it restarts (all counts back to 0/1). Stop recording. |

**The hand outline.** On a headset, IWSDK (the framework) draws a thin white
outline over each tracked hand. It also draws an invisible copy of the hand
that hides virtual objects behind your fingers. Note whether the outline sits
on your real hand or visibly off it; that affects how "in your palm" the seed
and Mote look.

**Catch area.** The ring is the catch area. Its radius is 0.9 × your measured
palm width (index-to-pinky knuckle), between 5.5 and 9.5 cm. It is sized from
your real hand, so it lines up with your palm. Nothing in the headset enlarges or
shifts the drawn hand. (The laptop's Small / Medium / Large setting only changes
how thick the emulated hand is drawn and does not exist on the Quest.)

## 3b. Part C (optional): two-hand catch (2 minutes)

Only if Parts A and B went smoothly. Open
**`https://iftiikhaarr-glitch.github.io/palmful/?catch=1&hands=2&debug=1`**,
pinch **Enter AR**, and hold both hands out, palm up.

| Time | Do this |
|---|---|
| 0:00–1:00 | Catch the gold seed (left lane) with your **left** hand and the blue seed (right lane) with your **right** hand. Stay seated; no wide arm moves. |
| 1:00–1:30 | When a seed rests in one palm, hide **that** hand behind your back for 3 s while the other hand stays in view. The seed must wait for its hand, not jump to the other one. |
| 1:30–2:00 | Finish the third seed with either hand. Check each flower stayed on the hand that caught it. |

Fail if a seed ever jumps between hands, a catch happens on the wrong hand,
or the two hands confuse tracking (hands swapped, flicker). Two-hand play stays
optional either way; one-hand play is never affected.

## 4. Send back

1. **Both videos**, uncut (Meta Horizon phone app → Gallery, or the headset's
   Files → Videos).
2. **A photo of the debug panel at the end of each part** (Meta button →
   Camera → Take photo), or read the numbers aloud in the video.
3. **One line each:**
   - Quest 3 or 3S? Lighting: bright, normal or dim?
   - Bloom: did Mote look like it was **sitting on your skin**? (yes / mostly / no)
   - Catch: did moving and cupping **register naturally**? Any catch you did
     not mean to make? Any miss that felt unfair? Could you tell the three
     seeds apart and read the progress display without effort?
   - Which one would you rather play again, and why?
   - Anything uncomfortable (arm tired, eyes, nausea)?

Debug panel, Bloom: `fps 72  tracked 98%  palm-up 95%` / `jitter 1.2 mm …` /
`play  palm  calm  blooms 1 …`. Catch: same first two lines, then
`falling  caught 1  missed 0  spilled 0  cup 0.03`.

**Emulator results do not show real-hand tracking, comfort, or Quest frame
rate.** Everything so far has been checked only in an emulator; this test is
the first real-hand evidence.

## 5. Pass / fail (decided before any results; do not change afterwards)

**Both parts**

| Check | Pass | Marginal | Fail |
|---|---|---|---|
| Frame rate (`fps`) | ≥ 72 | 60–71 (the competition minimum is 60) | < 60 |
| Hand tracked (`tracked`) | ≥ 95 % | 90–94 % | < 90 % |
| Recovery after hiding the hand | resumes in place | | jumps, vanishes, or needs a reload |

**Part A: Bloom.** This part decides whether Mote visibly stays on a real palm.

| Check | Pass | Marginal | Fail |
|---|---|---|---|
| Attachment while still (`jitter`, read only during still holds) | ≤ 2 mm | 2–3 mm | > 3 mm |
| Attachment while moving (video, 0:30–1:30) | Mote and its shadow stay on the skin; any gap or lag is smaller than a fingertip and recovers at once | brief slips on fast moves only | visibly floats off, lags or swims during slow tilts |

**Part B: Catch.** This part decides whether moving and cupping register naturally.

| Check | Pass | Marginal | Fail |
|---|---|---|---|
| False catches (a catch the tester did not intend, including the 5 s open-hand hold) | 0 | | any |
| Deliberate attempts that end in a catch | ≥ 80 % | 60–79 % | < 60 % |
| Cup separation (calibration numbers) | flat and relaxed < 0.30, gentle cup > 0.50 | relaxed 0.30–0.42 | relaxed ≥ 0.42 (relaxed hands would catch) or gentle cup < 0.42 (cups would not register) |
| Tracking loss mid-fall | seed pauses, then can still be caught | | seed is lost or counted as a miss |
| Readability | tester names the current seed and the progress at a glance | needs a second look | confuses colours or misreads progress |
| No accidental replay | holding the catching cup or a squeeze after 3/3 never restarts | | the result is wiped without an open-then-fist |

## 6. Which version to keep

Decide from the evidence above, in this order:

| Bloom result | Catch result | Keep |
|---|---|---|
| Pass | Fail | **Bloom** |
| Fail | Pass | **Catch**. It needs only a coarse palm position and a cup, not a creature that looks glued to the skin. |
| Pass | Pass | The one the tester would rather play again. If there's no preference, **Bloom**: it is the more original idea, while catching falling objects is a familiar VR mechanic. |
| Fail | Fail | Neither. Switch to **Leaf** (Mote rides a leaf held in a pinch). |

Part C (two hands) never decides the mode. If it passes, two-hand play can
stay available as an option in the kept Catch mode. If it fails, it is simply
left off (`&hands=2` is never shown to players).

A cup-separation result in the Catch "Marginal" or "Fail" column with clean
play otherwise means we change `CUP_ON`, the cup threshold (now 0.42), using the
recorded numbers, and retest. It is not a reason to drop Catch by itself. Low
frame rate means simplify, not abandon. Confusion in the first minute means fix
the onboarding, not the mechanic.
