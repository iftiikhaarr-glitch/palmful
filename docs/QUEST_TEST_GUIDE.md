# Palmful: Quest 3 / 3S test (about 10 minutes, 3 of them playing)

Thank you for testing. Palmful is a tiny creature ("Mote") that lives on your
open hand. We need to know one thing: **does Mote visibly stay on a real palm
while the hand moves naturally?** No account or install is needed.

## 1. Set up (about 5 minutes)

1. Headset: **Quest 3 or Quest 3S**, charged, normal indoor light.
2. Turn on hand tracking: **Settings → Movement tracking → Hand and body
   tracking → Hand tracking: on**. Put both controllers **down, out of reach**.
3. Sit down.
4. Open the **Browser** and enter exactly:

   **`https://iftiikhaarr-glitch.github.io/palmful/?debug=1`**

5. Pinch **Enter AR**. If the browser asks to allow hand tracking or
   spatial data, choose **Allow**.
6. Start recording: look at your palm and pinch the **Meta icon** that appears
   to open the menu, then **Camera** → **Record video**. (Menu names can differ
   slightly between headset software versions.) Recording must be on before you play.

## 2. Play (3 minutes; do not explain the game to yourself first)

| Time | Do this |
|---|---|
| 0:00–0:30 | Hold your **right hand out, palm up**, about 30 cm in front of your chest. A seed falls into it and hatches. Then keep the hand **completely still for 20 s**. |
| 0:30–1:30 | Play: tip your hand slowly so Mote slides to the glowing fingertip. Try for all three blooms. Move naturally, as you would if nobody were measuring. |
| 1:30–2:00 | Cup your hand a little, roll it sideways, turn it palm-down for 3 s, then palm-up again. |
| 2:00–2:30 | Hide your hand behind your back for 5 s, then bring it back. Press the Meta button once, then return to the app. |
| 2:30–3:00 | Hold palm up and still again for 20 s, then stop recording. |

The small panel above your hand shows the debug readings.

## 3. Send back

1. **The video** (Meta Horizon phone app → Gallery, or the headset's Files → Videos). Uncut,
   about 3 minutes.
2. **Two photos of the debug panel**: one at about 0:30 (after the first
   still hold) and one at the end. Take them with **Meta button → Camera →
   Take photo**. If photos are awkward, read the numbers aloud in the video.
3. **These answers** (one line each):
   - Headset: Quest 3 or 3S? Lighting: bright, normal or dim?
   - Did Mote look like it was **sitting on your skin**? (yes / mostly / no)
   - Did you understand what to do without being told? What confused you?
   - Anything that felt uncomfortable (arm tired, eyes, nausea)?

The debug panel lines:

```
fps 72  tracked 98%  palm-up 95%
jitter 1.2 mm  losses 1  longest 300 ms
play  palm  calm  blooms 1  1st bloom 24.0 s
```

## 4. Pass / fail (decided before any results; do not change afterwards)

| Check | Pass | Marginal | Fail | Where it comes from |
|---|---|---|---|---|
| **Palm tracking** | `tracked` ≥ 95 % | 90–94 % | < 90 % | panel at end |
| **Attachment, still** | `jitter` ≤ 2 mm during a still hold | 2–3 mm | > 3 mm | panel at 0:30 and end (only read it during still holds; it rises when you move on purpose) |
| **Attachment, moving** (the deciding check) | In the video, Mote and its shadow stay on the skin during slow tilts; any gap or lag is smaller than a fingertip width and recovers within a moment | brief slips during fast moves only | Mote visibly floats off, lags behind or swims around the palm during normal slow tilts | video, 0:30–1:30 |
| **Frame rate** | `fps` ≥ 72 | 60–71 (meets the competition minimum of 60) | < 60 | panel |
| **Recovery** | after hiding the hand, Mote waits and resumes in place; Meta button pause resumes cleanly | | Mote jumps to the wrong place, disappears for good, or the page needs a reload | video, 2:00–2:30 |

**Decision:**

- **Palmful continues** if tracking and both attachment checks pass (marginal is acceptable once).
- **Palmful is abandoned for "Leaf"** (Mote rides a leaf held in a pinch) if palm tracking or the moving-attachment check fails.
- **Low frame rate** means simplify, not abandon.
- **Confusion** means fix the first minute, not abandon.

Nothing here has been measured on a Quest yet. All results so far come from an emulator.
