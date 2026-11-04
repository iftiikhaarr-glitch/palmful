# Palmful: Quest 3 / 3S quick checklist

About **13 minutes** (3 setup, 3 Bloom, 6 Catch, 1 to send results), plus 2
optional minutes for two-hand play.

This is a short version of [`QUEST_TEST_GUIDE.md`](QUEST_TEST_GUIDE.md).
**If the two documents ever differ, the detailed guide is the source of truth.**

Nothing has been measured on a Quest yet. All results so far come from a
laptop emulator, which cannot show real-hand tracking, comfort or Quest frame
rate. On the headset you see your real hand with a thin white outline; the
shaded 3D hand from the laptop view does not exist there.

## Setup (3 min)

- Quest 3 or 3S, charged, normal indoor light. Sit down.
- Hand tracking on (Settings → Movement tracking → Hand tracking). Put both
  controllers down, out of reach.
- Record a video of each part: look at your palm, pinch the Meta icon, then
  Camera → Record video.
- To change part, press the Meta button, close the browser tab and open the
  next address.

## Part A: Bloom (3 min)

Open **https://iftiikhaarr-glitch.github.io/palmful/?debug=1** and pinch
**Enter AR**. Allow hand tracking if asked.

- [ ] Right palm up and still for 20 s. Read `jitter` aloud during the hold.
- [ ] Tip your hand slowly so Mote slides to each glowing fingertip. Try for all
      three blooms.
- [ ] Hide your hand for 5 s, then bring it back. Mote should resume in place.
- [ ] Palm up and still for 20 s again. Read `fps`, `tracked` and `jitter` aloud.
      Stop recording.

## Part B: One-hand catch (6 min)

Open **https://iftiikhaarr-glitch.github.io/palmful/?catch=1&debug=1** and
pinch **Enter AR**.

- [ ] **Cup calibration.** Read the `cup` number aloud for 5 s each with your
      hand flat, relaxed (naturally curled) and gently cupped.
- [ ] **Play.** A seed glows, then drifts down. Move your open palm under it
      (the ring turns green), let it land, then gently cup. Say **"attempt"**
      each time you deliberately go for one.
- [ ] **False-catch check.** When a seed lands, keep your hand open and still
      for 5 s. It must **not** be caught. Then cup to catch it.
- [ ] **Miss check.** Let one seed fall past. The same colour should come back,
      and earlier catches should stay.
- [ ] **Loss check.** While a seed is falling, hide your hand for 3 s, then bring
      it back. The seed should pause.
- [ ] **No accidental replay.** At 3/3, hold the catching cup for 3 s; the game
      must **not** restart. Then open your hand and make a fist; it restarts at
      0/1.
- [ ] **Keep playing until you have made at least 10 deliberate attempts.**
      A round has only three seeds, so restart with open hand → fist as often as
      needed. Stop recording.

## Part C: Two-hand catch (optional, 2 min)

Only if Parts A and B went smoothly. Open
**https://iftiikhaarr-glitch.github.io/palmful/?catch=1&hands=2&debug=1**.
Catch with either hand. A seed resting in one palm must never jump to the
other hand. This part never decides which mode to keep.

## What to send back

1. Both videos, uncut, and a photo of the debug panel at the end of each part
   (Meta button → Camera → Take photo).
2. Quest 3 or 3S, and the lighting (bright, normal or dim).
3. The numbers:
   - `fps`, `tracked` %, and still-hold `jitter`
   - the three `cup` values (flat, relaxed, gently cupped)
   - deliberate attempts made, and how many ended in a catch
   - any catch you did not intend
4. One line each:
   - Bloom: did Mote look like it was sitting on your skin (yes, mostly or no)?
   - Catch: did moving and cupping feel natural? Any miss that felt unfair?
   - Which one would you rather play again, and why?
   - Anything uncomfortable (arm, eyes, nausea)?

## Results

Catch success = catches ÷ deliberate attempts. Only calculate it after **at
least 10** attempts; with fewer, Catch is **inconclusive — retest**.

| Check | Pass | Inconclusive — retest | Fail |
|---|---|---|---|
| Both: frame rate (`fps`) | ≥ 72 | 60–71 | < 60 |
| Both: hand tracked | ≥ 95 % | 90–94 % | < 90 % |
| Both: after hiding the hand | resumes in place | — | jumps, vanishes or needs a reload |
| Bloom: still-hold `jitter` | ≤ 2 mm | 2–3 mm | > 3 mm |
| Bloom: Mote while moving (video) | stays on the skin | brief slips on fast moves only | floats, lags or swims on slow tilts |
| Catch: unintended catches | 0 | — | any |
| Catch: attempts that end in a catch (≥ 10 attempts) | ≥ 80 % | 60–79 % | < 60 % |
| Catch: cup values | all three readings pass | worst reading inconclusive | any reading fails |
| Catch: hand hidden mid-fall | seed pauses, then can still be caught | — | seed is lost or counted as a miss |
| Catch: after 3/3 | holding the cup never restarts | — | restarts without open hand → fist |

**Cup calibration readings.** The game catches when the `cup` number reaches
0.42. An open hand (flat or relaxed) must stay clearly below that, and a gentle
cup clearly above it. Each reading falls in exactly one column; the cup row
above takes the worst of the three.

| Reading | Pass | Inconclusive — retest | Fail |
|---|---|---|---|
| Flat | below 0.30 | 0.30 or more, below 0.42 | 0.42 or more (an open hand would catch) |
| Relaxed | below 0.30 | 0.30 or more, below 0.42 | 0.42 or more (a resting hand would catch) |
| Gently cupped | above 0.50 | 0.42 to 0.50 | below 0.42 (a cup would not register) |

How each mode is rated:

- **Fail:** any check in the Fail column.
- **Inconclusive:** no Fail, but at least one check in the middle column.
  Retest that part once on the same headset and note the lighting. If it is
  still in between, decide with the detailed guide.
- **Pass:** every check passes.

## Which mode to keep

| Bloom | Catch | Keep |
|---|---|---|
| Pass | Fail | **Bloom** |
| Fail | Pass | **Catch** |
| Pass | Pass | The one the tester would rather play again. No preference: **Bloom**. |
| Inconclusive in either | | Retest that mode before choosing. |
| Fail | Fail | Neither as it stands. **Leaf** is a possible fallback (Mote rides a leaf held in a pinch). It is not built yet: it would need its own build and its own Quest test before it could be chosen. |

Some results point to a fix instead of a mode choice:

- Cup values off but play otherwise clean: tune the cup threshold (now 0.42)
  and retest.
- Low frame rate: simplify the scene.
- Confusion in the first minute: fix the onboarding.

Two-hand play stays optional whatever the result.
