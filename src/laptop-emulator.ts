// Laptop mode (?emulate=1): installs Meta's IWER WebXR emulator so the full
// session can be played on a computer with the keyboard tilting an emulated
// right hand. This is NOT a headset test: tracking, jitter and performance
// here say nothing about a real Quest. Only loaded when ?emulate is present.

const PARAMS = new URLSearchParams(location.search);
export const EMULATE = PARAMS.has('emulate');

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
  device.fovy = 0.75;
  const remote = (device as unknown as { remote: Remote }).remote;
  (window as unknown as { __palmfulEmu: Remote }).__palmfulEmu = remote;

  let pitch = 0;
  let roll = 0;
  let fist = false;
  let hidden = false;
  let started = false;

  const call = (m: string, p?: Record<string, unknown>) =>
    remote.dispatch(m, p).catch((e: unknown) => console.warn('[laptop]', m, e));

  const applyHand = async () => {
    if (!started) return;
    const o = handDirections(pitch, roll);
    await call('set_transform', {
      device: 'hand-right',
      anchor: 'wrist',
      position: WRIST,
      orientation: { fingers: o.fingers, palm: o.palm },
    });
    status.textContent = `pitch ${pitch}°  roll ${roll}°${fist ? '  FIST' : ''}${hidden ? '  HAND HIDDEN' : ''}`;
  };

  // ---- overlay UI ----
  document.body.style.background =
    'radial-gradient(ellipse at 50% 70%, #6b5a4e 0%, #3a302b 55%, #1d1816 100%)';
  const panel = document.createElement('div');
  panel.id = 'laptop-panel';
  panel.style.cssText =
    'position:fixed;left:16px;top:16px;z-index:10;' +
    'font:13px/1.45 system-ui,sans-serif;color:#fff4e0;background:rgba(20,16,28,.85);' +
    'padding:10px 14px;border-radius:12px;max-width:min(300px,calc(100vw - 32px));text-align:left';
  panel.innerHTML =
    '<b>Laptop emulator</b>: not a headset test.<br>' +
    '<button id="laptop-start" style="margin:8px 0;padding:8px 18px;font:inherit;font-weight:600;border-radius:8px;border:0;background:#ffb35c;color:#221;cursor:pointer">Start</button><br>' +
    '<span><b>Space</b> raise hand, palm up (again: level it)<br><b>↑ ↓</b> tip fingertips down / up<br><b>← →</b> roll toward pinky / index<br><b>F</b> fist &nbsp; <b>H</b> lower hand</span><br>' +
    '<code id="laptop-status" style="opacity:.8"></code>';
  document.body.appendChild(panel);
  const status = panel.querySelector('#laptop-status') as HTMLElement;
  const startBtn = panel.querySelector('#laptop-start') as HTMLButtonElement;

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
    await call('look_at', { device: 'headset', target: { x: 0.05, y: 1.14, z: -0.38 } });
    started = true;
    startBtn.style.display = 'none';
    await applyHand();
  });

  window.addEventListener('keydown', async (e) => {
    if (!started) return;
    let handled = true;
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
        await call('set_hand_pose', { device: 'hand-right', poseId: fist ? 'fist' : 'flat' });
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
