// Laptop mode (?emulate=1): installs Meta's IWER WebXR emulator so the full
// session can be played on a computer with the keyboard tilting an emulated
// right hand. This is NOT a headset test: tracking, jitter and performance
// here say nothing about a real Quest. Only loaded when ?emulate is present.

const PARAMS = new URLSearchParams(location.search);
export const EMULATE = PARAMS.has('emulate');
const CATCH = PARAMS.has('catch');
const TWO = CATCH && PARAMS.get('hands') === '2';
const MOVE = 0.02; // metres per key press in catch mode
/** Same key as palmful-system.ts: the laptop-only hand display size. */
const HAND_SIZE_KEY = 'palmful.laptopHandSize';
const SEEDS = ['gold', 'blue', 'pink'] as const;

type Remote = { dispatch(method: string, params?: Record<string, unknown>): Promise<unknown> };

const WRIST = { x: 0.04, y: 1.16, z: -0.3 };
const STEP = 5; // degrees per key press

/** Rotate the palm-up hand: roll (index side down) then pitch (fingertips down). */
function handDirections(pitchDeg: number, rollDeg: number) {
  const r = (rollDeg * Math.PI) / 180;
  const t = (pitchDeg * Math.PI) / 180;
  // right hand palm up: fingers -Z, palm +Y, index side +X
  const f = [0, 0, -1];
  const p = [0, 1, 0];
  const s = [1, 0, 0];
  const p1 = s.map((v, i) => Math.sin(r) * v + Math.cos(r) * p[i]);
  const f2 = f.map((v, i) => Math.cos(t) * v - Math.sin(t) * p1[i]);
  const p2 = f.map((v, i) => Math.sin(t) * v + Math.cos(t) * p1[i]);
  return { fingers: f2, palm: p2 };
}

export async function installLaptopEmulator(): Promise<void> {
  const { XRDevice, metaQuest3 } = await import('iwer');
  const device = new XRDevice(metaQuest3);
  device.installRuntime({ forceInstall: true });
  device.primaryInputMode = 'hand';
  // A laptop screen is small: narrow the emulated vertical FOV (~43°) so the
  // hand fills the view. A real Quest 3 view is much wider.
  // Catch mode needs the falling seed and the hand in one view: a bit wider.
  device.fovy = CATCH ? 0.95 : 0.75;
  // Fit to the window: the game reports the screen box (-1..1) of its key
  // objects. The camera tilts to centre that box vertically, then zooms just
  // enough to keep it inside a margin: zoom out before anything is clipped,
  // back in when there is room. Works for any window shape.
  const FOVY_MIN = CATCH ? 0.75 : 0.65;
  const FOVY_MAX = 1.9;
  let fovy = device.fovy;
  let pitch0: number | null = null; // camera pitch (degrees), set after Start
  let fitting = false;
  window.addEventListener('palmful-fit', async (e) => {
    // __palmfulFitPaused: test aid for angled screenshots (camera left where it is put)
    if (!started || pitch0 === null || fitting || (window as unknown as { __palmfulFitPaused?: boolean }).__palmfulFitPaused) return;
    fitting = true;
    try {
      const { x0, x1, y0, y1 } = (e as CustomEvent<{ x0: number; x1: number; y0: number; y1: number }>).detail;
      const cy = (y0 + y1) / 2;
      if (Math.abs(cy) > 0.06) {
        // tilt toward the content centre (damped); +y on screen = look up
        pitch0 += cy * ((fovy * 180) / Math.PI / 2) * 0.6;
        pitch0 = Math.max(-70, Math.min(10, pitch0));
        await call('set_transform', { device: 'headset', orientation: { pitch: pitch0, yaw: 0, roll: 0 } });
      }
      const reach = Math.max(Math.abs(x0), Math.abs(x1), (y1 - y0) / 2 + Math.abs(cy) * 0.4);
      let next = fovy;
      if (reach > 0.86) next = fovy * Math.min(1.12, 1.02 + (reach - 0.86) * 0.8);
      else if (reach < 0.6) next = fovy * 0.985;
      next = Math.min(FOVY_MAX, Math.max(FOVY_MIN, next));
      if (Math.abs(next - fovy) > 1e-4) {
        fovy = next;
        device.fovy = fovy;
      }
      (window as unknown as { __palmfulFovy?: number }).__palmfulFovy = fovy;
    } finally {
      fitting = false;
    }
  });
  const remote = (device as unknown as { remote: Remote }).remote;
  (window as unknown as { __palmfulEmu: Remote }).__palmfulEmu = remote;

  let pitch = 0;
  let roll = 0;
  let fist = false;
  let hidden = false;
  let started = false;
  let cupped = false;
  const off = { x: 0, y: 0, z: 0 }; // catch mode: hand offset from its start
  // Two-hand mode: the keyboard controls one hand at a time (L switches);
  // each hand keeps its own position, cup and visibility.
  let ctrl: 'right' | 'left' = 'right';
  type HandKeys = { off: { x: number; y: number; z: number }; cupped: boolean; hidden: boolean; fist: boolean; roll: number };
  const saved: Record<'right' | 'left', HandKeys> = {
    right: { off: { x: 0, y: 0, z: 0 }, cupped: false, hidden: true, fist: false, roll: 0 },
    left: { off: { x: 0, y: 0, z: 0 }, cupped: false, hidden: true, fist: false, roll: 0 },
  };
  const LEFT_SHIFT = -0.15; // the left hand starts 15 cm to the left of the right hand

  const call = (m: string, p?: Record<string, unknown>) =>
    remote.dispatch(m, p).catch((e: unknown) => console.warn('[laptop]', m, e));
  /** Change hand pose with a short eased blend (IWER's pose fade), so open,
   *  cup and fist flow into each other. The game reads the same blended
   *  joints it draws, so what you see is what the catch logic sees. */
  const POSE_FADE_S = 0.22;
  const pose = (side: 'left' | 'right', poseId: string) =>
    call('set_hand_pose', { device: `hand-${side}`, poseId, duration: POSE_FADE_S, easing: 'minimum-jerk' });

  const applyHand = async () => {
    if (!started) return;
    const o = handDirections(pitch, roll);
    const baseX = WRIST.x + (ctrl === 'left' ? LEFT_SHIFT : 0);
    await call('set_transform', {
      device: `hand-${ctrl}`,
      anchor: 'wrist',
      position: { x: baseX + off.x, y: WRIST.y + off.y, z: WRIST.z + off.z },
      orientation: { fingers: o.fingers, palm: o.palm },
    });
    const where = CATCH
      ? `x ${(off.x * 100).toFixed(0)} cm  fwd ${(-off.z * 100).toFixed(0)} cm  up ${(off.y * 100).toFixed(0)} cm${cupped ? '  CUPPED' : ''}${roll ? '  TILTED' : ''}`
      : `pitch ${pitch}°  roll ${roll}°`;
    status.textContent = `${TWO ? `${ctrl.toUpperCase()} hand: ` : ''}${where}${fist ? '  FIST' : ''}${hidden ? '  HAND HIDDEN (Space to raise)' : ''}`;
  };

  // ---- overlay UI ----
  document.body.style.background =
    'radial-gradient(ellipse at 50% 70%, #6b5a4e 0%, #3a302b 55%, #1d1816 100%)';
  const panel = document.createElement('div');
  panel.id = 'laptop-panel';
  panel.style.cssText =
    // bottom-left: clear of the seed lanes, progress display and hand
    'position:fixed;left:12px;bottom:12px;z-index:2147483647;' + // above the emulator's full-screen view
    'font:12px/1.4 system-ui,sans-serif;color:#fff4e0;background:rgba(20,16,28,.88);' +
    'padding:8px 12px;border-radius:12px;max-width:min(260px,calc(100vw - 24px));text-align:left;' +
    // never taller than the window: scroll inside instead of being clipped
    'max-height:calc(100vh - 24px);overflow-y:auto;box-sizing:border-box';
  panel.innerHTML =
    '<b>Laptop emulator</b>: not a headset test. <button id="laptop-help" style="font:inherit;padding:0 6px;margin-left:4px;border-radius:6px;border:1px solid #6f6779;background:transparent;color:#fff4e0;cursor:pointer">Hide help</button><br>' +
    '<button id="laptop-start" style="margin:8px 0;padding:8px 18px;font:inherit;font-weight:600;border-radius:8px;border:0;background:#ffb35c;color:#221;cursor:pointer">Start</button><br>' +
    '<div id="laptop-help-body">' +
    (CATCH
      ? '<b>Catch mode</b>: catch the falling seed.<br>' +
        (TWO ? '<b>Two hands</b>: <b>L</b> switches which hand the keys control.<br>' : '') +
        '<span><b>Space</b> raise hand, palm up (again: back to start)<br><b>← →</b> move hand left / right<br><b>↑ ↓</b> move hand forward / back<br><b>W S</b> move hand up / down<br><b>C</b> cup / open the hand<br><b>1 2 3</b> test: pick gold / blue / pink seed<br><b>T</b> tip palm sideways (spill) &nbsp; <b>F</b> fist &nbsp; <b>H</b> lower hand<br>' +
        'Move under the seed (ring turns green), let it land, then press <b>C</b>.</span><br>'
      : '<span><b>Space</b> raise hand, palm up (again: level it)<br><b>↑ ↓</b> tip fingertips down / up<br><b>← →</b> roll toward pinky / index<br><b>F</b> fist &nbsp; <b>H</b> lower hand</span><br>') +
    '<b>?</b> hide / show this help<br></div>' +
    '<div style="margin:6px 0 2px">Hand display: ' +
    ['S', 'M', 'L']
      .map((z) => `<button data-size="${z}" class="laptop-size" style="font:inherit;font-weight:600;padding:2px 10px;margin-left:4px;border-radius:6px;border:1px solid #ffb35c;cursor:pointer">${z === 'S' ? 'Small' : z === 'M' ? 'Medium' : 'Large'}</button>`)
      .join('') +
    '</div>' +
    '<code id="laptop-status" style="opacity:.8"></code>';
  document.body.appendChild(panel);
  const status = panel.querySelector('#laptop-status') as HTMLElement;
  const startBtn = panel.querySelector('#laptop-start') as HTMLButtonElement;
  const helpBody = panel.querySelector('#laptop-help-body') as HTMLElement;
  const helpBtn = panel.querySelector('#laptop-help') as HTMLButtonElement;
  const toggleHelp = () => {
    const hide = helpBody.style.display !== 'none';
    helpBody.style.display = hide ? 'none' : '';
    helpBtn.textContent = hide ? 'Show help' : 'Hide help';
    helpBtn.blur();
  };
  helpBtn.addEventListener('click', toggleHelp);
  // Smaller windows start with the help collapsed so it never covers the play area
  // (Show help, or ?, brings it back).
  if (window.innerHeight < 720 || window.innerWidth < 900) toggleHelp();
  window.addEventListener('keydown', (e) => {
    if (e.key === '?') toggleHelp();
  });

  // Hand display size (laptop only): thicker dots and bones, same positions.
  let size = 'M';
  try {
    const v = localStorage.getItem(HAND_SIZE_KEY);
    if (v === 'S' || v === 'M' || v === 'L') size = v;
  } catch {
    /* storage unavailable: use the default */
  }
  const sizeButtons = [...panel.querySelectorAll<HTMLButtonElement>('.laptop-size')];
  const showSize = () =>
    sizeButtons.forEach((b) => {
      const on = b.dataset.size === size;
      b.style.background = on ? '#ffb35c' : 'transparent';
      b.style.color = on ? '#221' : '#fff4e0';
      b.setAttribute('aria-pressed', String(on));
    });
  showSize();
  sizeButtons.forEach((b) =>
    b.addEventListener('click', () => {
      size = b.dataset.size!;
      try {
        localStorage.setItem(HAND_SIZE_KEY, size);
      } catch {
        /* not saved; still applies for this visit */
      }
      window.dispatchEvent(new CustomEvent('palmful-handsize', { detail: size }));
      showSize();
      b.blur(); // keep keyboard control on the game
    }),
  );

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Starting…';
    // IWSDK offers the session; the emulator accepts it.
    for (let i = 0; i < 40 && !started; i++) {
      const r = (await call('accept_session')) as { success?: boolean } | undefined;
      if (r && r.success !== false) started = true;
      else await new Promise((res) => setTimeout(res, 250));
    }
    await call('set_input_mode', { mode: 'hand' });
    // Start with no hand raised, like putting on a headset: the seed waits.
    await call('set_connected', { device: 'hand-left', connected: false });
    await call('set_connected', { device: 'hand-right', connected: false });
    hidden = true;
    await call('set_hand_pose', { device: 'hand-right', poseId: 'flat' });
    await call('set_transform', { device: 'headset', position: { x: 0.04, y: 1.42, z: -0.05 } });
    await call('look_at', { device: 'headset', target: CATCH ? { x: 0.04, y: 1.27, z: -0.4 } : { x: 0.05, y: 1.14, z: -0.38 } });
    started = true;
    const head = (await call('get_transform', { device: 'headset' })) as { euler?: { pitch: number } } | undefined;
    pitch0 = head?.euler?.pitch ?? -25;
    startBtn.style.display = 'none';
    await applyHand();
    status.textContent = 'HAND HIDDEN (Space to raise)';
  });

  window.addEventListener('keydown', async (e) => {
    if (!started) return;
    let handled = true;
    if (CATCH) {
      switch (e.key) {
        case 'ArrowLeft':
          off.x -= MOVE;
          break;
        case 'ArrowRight':
          off.x += MOVE;
          break;
        case 'ArrowUp':
          off.z -= MOVE;
          break;
        case 'ArrowDown':
          off.z += MOVE;
          break;
        case 'w':
        case 'W':
          off.y += MOVE;
          break;
        case 's':
        case 'S':
          off.y -= MOVE;
          break;
        case 'c':
        case 'C':
          cupped = !cupped;
          fist = false;
          await pose(ctrl, cupped ? 'cup' : 'flat');
          break;
        case 't':
        case 'T':
          roll = roll ? 0 : 85;
          break;
        case '1':
        case '2':
        case '3': {
          // testing aid: choose which (uncaught) seed falls next
          const kind = SEEDS[Number(e.key) - 1];
          const sel = (window as unknown as { __palmfulSelectSeed?: (k: string) => boolean }).__palmfulSelectSeed;
          const okSel = sel ? sel(kind) : false;
          status.textContent = okSel ? `${kind} seed selected` : `${kind}: already caught or busy`;
          e.preventDefault();
          return;
        }
        case ' ':
          off.x = off.y = off.z = 0;
          roll = 0;
          if (hidden) {
            hidden = false;
            await call('set_connected', { device: `hand-${ctrl}`, connected: true });
            if (ctrl === 'left') await call('set_hand_pose', { device: 'hand-left', poseId: cupped ? 'cup' : 'flat' });
          }
          break;
        case 'f':
        case 'F':
          fist = !fist;
          cupped = false;
          await pose(ctrl, fist ? 'fist' : 'flat');
          break;
        case 'h':
        case 'H':
          hidden = !hidden;
          await call('set_connected', { device: `hand-${ctrl}`, connected: !hidden });
          break;
        case 'l':
        case 'L':
          if (!TWO) {
            handled = false;
            break;
          }
          saved[ctrl] = { off: { ...off }, cupped, hidden, fist, roll };
          ctrl = ctrl === 'right' ? 'left' : 'right';
          ({ cupped, hidden, fist, roll } = saved[ctrl]);
          Object.assign(off, saved[ctrl].off);
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        await applyHand();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowUp':
        pitch = Math.min(80, pitch + STEP);
        break;
      case 'ArrowDown':
        pitch = Math.max(-60, pitch - STEP);
        break;
      case 'ArrowRight':
        roll = Math.min(180, roll + STEP);
        break;
      case 'ArrowLeft':
        roll = Math.max(-180, roll - STEP);
        break;
      case ' ':
        pitch = 0;
        roll = 0;
        if (hidden) {
          hidden = false;
          await call('set_connected', { device: 'hand-right', connected: true });
        }
        break;
      case 'f':
      case 'F':
        fist = !fist;
        await pose('right', fist ? 'fist' : 'flat');
        break;
      case 'h':
      case 'H':
        hidden = !hidden;
        await call('set_connected', { device: 'hand-right', connected: !hidden });
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      await applyHand();
    }
  });
}
