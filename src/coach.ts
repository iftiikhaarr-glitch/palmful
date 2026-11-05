// In-game coach: the few words the game shows, plus a small animated
// pictogram for the one action the player should do next. Pure canvas
// drawing; no IWSDK, DOM or game imports, so it can be read on its own.

/** Which animation the pictogram plays. */
export type CoachIcon =
  | 'raise' // a hand rises palm up under a waiting seed
  | 'palmUp' // the back of a hand turns over to show the palm
  | 'tilt' // top view: palm tips, a dot slides to the glowing fingertip
  | 'under' // side view: open palm slides under the seed; ring turns green
  | 'land' // side view: open palm stays still while the seed drops onto it
  | 'cup' // side view: fingers curl gently around the resting seed
  | 'open' // side view: fingers open out flat
  | 'fist' // side view: open hand closes into a fist
  | 'back' // a hand comes back into view
  | 'none';

/** 'now' = do it now (green), 'wait' = hold still (blue), 'warn' = undo something (amber). */
export type CoachTone = 'go' | 'wait' | 'now' | 'warn' | 'done';

export interface CoachMsg {
  /** Stable id; a change of id redraws the card and flashes its border. */
  id: string;
  title: string;
  sub: string;
  icon: CoachIcon;
  tone: CoachTone;
  /** Numbered step strip: labels and the current index (steps before it are ticked). */
  steps?: { labels: readonly string[]; at: number };
  /** Coloured dots under the title (progress or result), e.g. petal colours. */
  dots?: { colors: readonly string[]; filled: number };
  /** Colour of the seed in the pictogram. */
  seed?: string;
}

const TONE: Record<CoachTone, string> = {
  go: '#ffd27a',
  wait: '#9fd0ff',
  now: '#7cf29a',
  warn: '#ffb36b',
  done: '#fff4e0',
};

export const COACH_W = 1024;
export const COACH_H = 360;
/** Left square reserved for the pictogram (drawn on its own small canvas). */
export const ICON_BOX = 330;
export const ICON_PX = 256;

/** The card behind the words: background, step strip, title, sub, dots. */
export function drawCoachCard(
  c: CanvasRenderingContext2D,
  m: CoachMsg,
  flash: number,
  fit: (c: CanvasRenderingContext2D, text: string, maxW: number, weight: string, size: number, min: number) => void,
): void {
  const W = COACH_W, H = COACH_H;
  c.clearRect(0, 0, W, H);
  c.fillStyle = 'rgba(16,13,24,0.88)';
  c.beginPath();
  c.roundRect(8, 8, W - 16, H - 16, 48);
  c.fill();
  // tone stripe + border; a step change flashes the border brighter
  const tone = TONE[m.tone];
  c.lineWidth = 6 + flash * 10;
  c.strokeStyle = tone;
  c.globalAlpha = 0.55 + flash * 0.45;
  c.beginPath();
  c.roundRect(11, 11, W - 22, H - 22, 46);
  c.stroke();
  c.globalAlpha = 1;
  if (m.icon !== 'none') {
    // soft well behind the pictogram
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.beginPath();
    c.roundRect(30, 30, ICON_BOX - 30, H - 60, 32);
    c.fill();
  }
  const x0 = m.icon !== 'none' ? ICON_BOX + 24 : 60;
  const tw = W - x0 - 44;
  const cx = x0 + tw / 2;
  let y = 0;
  if (m.steps) {
    const n = m.steps.labels.length;
    const gap = 14;
    const pw = (tw - gap * (n - 1)) / n;
    m.steps.labels.forEach((label, i) => {
      const px = x0 + i * (pw + gap);
      const cur = i === m.steps!.at;
      const doneStep = i < m.steps!.at;
      c.fillStyle = cur ? tone : doneStep ? 'rgba(124,242,154,0.22)' : 'rgba(255,255,255,0.08)';
      c.beginPath();
      c.roundRect(px, 30, pw, 66, 33);
      c.fill();
      c.fillStyle = cur ? '#1a1424' : doneStep ? '#b9f5c8' : '#a99fb4';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const text = `${doneStep ? '✓' : String(i + 1)}  ${label}`;
      fit(c, text, pw - 24, cur ? '700' : '600', 44, 28);
      c.fillText(text, px + pw / 2, 64);
    });
    y = 104;
  }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = m.tone === 'now' ? TONE.now : '#fff4e0';
  const titleY = y + (m.steps ? 70 : m.sub || m.dots ? 105 : 175);
  fit(c, m.title, tw, '700', m.steps ? 64 : 68, 40);
  c.fillText(m.title, cx, titleY);
  let subY = titleY + (m.steps ? 66 : 80);
  if (m.dots) {
    const { colors, filled } = m.dots;
    colors.forEach((col, i) => {
      const dx = cx + (i - (colors.length - 1) / 2) * 62;
      c.beginPath();
      c.arc(dx, titleY + 64, 18, 0, Math.PI * 2);
      if (i < filled) {
        c.fillStyle = col;
        c.fill();
      } else {
        c.lineWidth = 4;
        c.strokeStyle = col;
        c.stroke();
      }
    });
    subY = titleY + 128;
  }
  if (m.sub) {
    c.fillStyle = '#d8cbb8';
    fit(c, m.sub, tw, '400', 46, 32);
    c.fillText(m.sub, cx, Math.min(subY, H - 46));
  }
}

const SKIN = '#efe3d6';
const SKIN_EDGE = '#b9a6a8';

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

/** Side view of a hand: wrist at left, palm up, fingers to the right. curl 0 flat, ~0.55 cup, 1 fist. */
function sideHand(c: CanvasRenderingContext2D, x: number, y: number, curl: number, s = 1): void {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // forearm + palm
  c.strokeStyle = SKIN_EDGE;
  c.lineWidth = 40;
  c.beginPath();
  c.moveTo(-120, 18);
  c.lineTo(10, 6);
  c.stroke();
  c.strokeStyle = SKIN;
  c.lineWidth = 32;
  c.stroke();
  // thumb, slightly raised near the palm's root (in front of the palm)
  // fingers: two segments from the palm's end, curling upward/back
  const a1 = -curl * 1.25; // first segment angle (radians, up = negative)
  const a2 = a1 - curl * 1.55;
  const l1 = 42, l2 = 36;
  const kx = 20, ky = 4;
  const mx = kx + Math.cos(a1) * l1, my = ky + Math.sin(a1) * l1;
  const tx = mx + Math.cos(a2) * l2, ty = my + Math.sin(a2) * l2;
  for (const [w, col] of [[30, SKIN_EDGE], [22, SKIN]] as const) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(kx - 10, ky);
    c.lineTo(mx, my);
    c.lineTo(tx, ty);
    c.stroke();
  }
  const th = -0.5 - curl * 0.6;
  for (const [w, col] of [[22, SKIN_EDGE], [15, SKIN]] as const) {
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(-40, 0);
    c.lineTo(-40 + Math.cos(th) * 36, Math.sin(th) * 36 - 6);
    c.stroke();
  }
  c.restore();
}

function seed(c: CanvasRenderingContext2D, x: number, y: number, color: string, r = 15, glow = 0.35): void {
  c.fillStyle = color;
  c.globalAlpha = glow;
  c.beginPath();
  c.arc(x, y, r * 1.9, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function ring(c: CanvasRenderingContext2D, x: number, y: number, color: string, w = 70): void {
  c.strokeStyle = color;
  c.lineWidth = 7;
  c.beginPath();
  c.ellipse(x, y, w, 13, 0, 0, Math.PI * 2);
  c.stroke();
}

function arrow(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 7;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1 - Math.cos(a) * 12, y1 - Math.sin(a) * 12);
  c.stroke();
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x1 - Math.cos(a - 0.5) * 24, y1 - Math.sin(a - 0.5) * 24);
  c.lineTo(x1 - Math.cos(a + 0.5) * 24, y1 - Math.sin(a + 0.5) * 24);
  c.closePath();
  c.fill();
}

/** Top view of an open right hand, fingers pointing up the canvas. */
function topHand(c: CanvasRenderingContext2D, x: number, y: number, tilt: number, glowFinger: number): void {
  c.save();
  c.translate(x, y);
  c.scale(1, 1 - tilt * 0.22); // tipping the fingertips down foreshortens the hand
  c.fillStyle = SKIN;
  c.strokeStyle = SKIN_EDGE;
  c.lineWidth = 5;
  c.beginPath();
  c.roundRect(-52, -20, 104, 92, 30);
  c.fill();
  c.stroke();
  const fingers = [-39, -13, 13, 39];
  const len = [58, 74, 68, 50];
  fingers.forEach((fx, i) => {
    c.beginPath();
    c.roundRect(fx - 11, -20 - len[i], 22, len[i] + 10, 11);
    c.fill();
    c.stroke();
    if (i === glowFinger) {
      c.fillStyle = '#fff6c2';
      c.globalAlpha = 0.45 + 0.35 * Math.sin(performance.now() / 160);
      c.beginPath();
      c.arc(fx, -12 - len[i], 20, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      c.fillStyle = SKIN;
    }
  });
  c.beginPath(); // thumb
  c.roundRect(-84, 4, 40, 22, 11);
  c.fill();
  c.stroke();
  c.restore();
}

/** Draw the pictogram for `icon` at animation time `t` (seconds) on a ICON_PX square canvas. */
export function drawCoachIcon(c: CanvasRenderingContext2D, icon: CoachIcon, t: number, seedColor = '#ffd27a'): void {
  const S = ICON_PX;
  c.clearRect(0, 0, S, S);
  const green = '#7cf29a';
  const amber = '#ffc061';
  switch (icon) {
    case 'raise': {
      const k = ease((t % 2.4) / 1.4);
      seed(c, 150, 62 + Math.sin(t * 3) * 3, seedColor);
      sideHand(c, 140, 222 - k * 60, 0, 1);
      arrow(c, 228, 210, 228, 150, amber);
      break;
    }
    case 'palmUp': {
      // the back of the hand (darker) turns over to the palm (with a dot)
      const k = ease((t % 2.2) / 1.2);
      const sy = Math.cos(k * Math.PI); // 1 back, -1 palm
      c.save();
      c.translate(128, 138);
      c.scale(1, Math.max(0.08, Math.abs(sy)));
      c.fillStyle = sy > 0 ? '#9c8b8e' : SKIN;
      c.beginPath();
      c.roundRect(-70, -40, 140, 80, 34);
      c.fill();
      if (sy < 0) seed(c, 0, 0, seedColor, 12);
      c.restore();
      c.strokeStyle = amber;
      c.lineWidth = 7;
      c.beginPath();
      c.arc(128, 138, 104, -2.5, -0.65);
      c.stroke();
      arrow(c, 200, 70, 216, 80, amber);
      break;
    }
    case 'tilt': {
      // top view: the dot slides toward the glowing middle fingertip as the hand tips
      const p = (t % 3) / 2.2;
      const k = ease(p);
      topHand(c, 128, 160, k, 1);
      const yy = 175 - k * (175 - 78) * 0.78;
      seed(c, 128 - 13 * k, yy, '#c8f7ff', 11, 0.3);
      arrow(c, 128, 238, 128, 200, amber);
      break;
    }
    case 'under': {
      // side view: the open hand slides in under the seed; the ring turns green
      const p = (t % 2.8) / 1.6;
      const k = ease(p);
      const hx = 30 + k * 98;
      const ok = p >= 1;
      c.setLineDash([6, 10]);
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(150, 72);
      c.lineTo(150, 186);
      c.stroke();
      c.setLineDash([]);
      seed(c, 150, 56, seedColor);
      ring(c, 150, 190, ok ? green : amber, 54);
      sideHand(c, hx, 192, 0, 0.95);
      if (!ok) arrow(c, hx + 40, 238, hx + 90, 238, amber);
      break;
    }
    case 'land': {
      // the seed drops onto a still, open palm
      const p = (t % 2.6) / 1.7;
      const k = Math.min(1, p);
      seed(c, 150, 56 + k * 120, seedColor);
      sideHand(c, 128, 196, 0, 0.95);
      if (p < 1) ring(c, 150, 190, green, 54);
      // "hold still" bars
      c.fillStyle = '#9fd0ff';
      c.fillRect(30, 40, 12, 40);
      c.fillRect(52, 40, 12, 40);
      break;
    }
    case 'cup': {
      const p = (t % 2.4) / 1.2;
      const k = ease(p);
      sideHand(c, 120, 186, k * 0.55, 1);
      seed(c, 152, 166, seedColor, 15, 0.35 + 0.3 * k);
      if (p >= 1) {
        c.strokeStyle = green;
        c.lineWidth = 9;
        c.beginPath();
        c.moveTo(196, 70);
        c.lineTo(214, 90);
        c.lineTo(244, 52);
        c.stroke();
      }
      break;
    }
    case 'open': {
      const k = ease((t % 2.2) / 1.2);
      sideHand(c, 120, 186, 0.55 * (1 - k), 1);
      arrow(c, 200, 120, 236, 120, amber);
      break;
    }
    case 'fist': {
      const p = (t % 2.6) / 1.4;
      const k = ease(p);
      sideHand(c, 120, 180, k, 1);
      if (p >= 1) {
        c.strokeStyle = green;
        c.lineWidth = 8;
        c.beginPath();
        c.arc(128, 120, 96, -Math.PI * 0.95, -Math.PI * 0.05);
        c.stroke();
        arrow(c, 214, 96, 222, 118, green);
      }
      break;
    }
    case 'back': {
      const k = ease((t % 2.2) / 1.2);
      sideHand(c, 128, 262 - k * 80, 0, 1);
      arrow(c, 128, 110, 128, 60, amber);
      break;
    }
    default:
      break;
  }
}
