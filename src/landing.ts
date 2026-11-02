// The flat 2D page shown before (and between) XR sessions.
// IWSDK offers the session through navigator.xr.offerSession, which some
// browsers do not implement; this adds a plain "Enter AR" button as a
// fallback, and explains where to open the page when WebXR AR is missing.

import type { World } from '@iwsdk/core';

const STYLE =
  'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:5;' +
  'background:radial-gradient(ellipse at 50% 60%,#4a3d35 0%,#1d1816 70%);color:#fff4e0;' +
  'font:16px/1.5 system-ui,sans-serif;text-align:center;padding:16px';

export async function mountLanding(world: World): Promise<void> {
  const el = document.createElement('div');
  el.id = 'landing';
  el.style.cssText = STYLE;
  document.body.appendChild(el);

  let arSupported = false;
  try {
    arSupported = (await navigator.xr?.isSessionSupported('immersive-ar')) ?? false;
  } catch {
    arSupported = false;
  }

  const laptopUrl = `${location.pathname}?emulate=1`;
  if (arSupported) {
    el.innerHTML =
      '<div style="max-width:420px">' +
      '<div style="font-size:40px;font-weight:700;margin-bottom:4px">Palmful</div>' +
      '<div style="opacity:.85;margin-bottom:20px">A tiny creature that lives on your hand.<br>Put your controllers down. Hands only.</div>' +
      '<button id="enter-ar" style="font:inherit;font-size:22px;font-weight:600;padding:14px 36px;border:0;border-radius:14px;background:#ffb35c;color:#221;cursor:pointer">Enter AR</button>' +
      '</div>';
    el.querySelector('#enter-ar')!.addEventListener('click', () => world.launchXR());
  } else {
    el.innerHTML =
      '<div style="max-width:440px">' +
      '<div style="font-size:40px;font-weight:700;margin-bottom:4px">Palmful</div>' +
      '<div style="opacity:.85;margin-bottom:16px">A tiny creature that lives on your hand.<br>Open this page in the <b>Meta Quest 3 / 3S Browser</b> to play.</div>' +
      `<a id="laptop-link" href="${laptopUrl}" style="color:#ffb35c;font-weight:600">Try the laptop demo (emulated hand) &rarr;</a>` +
      '</div>';
  }

  // Hide while immersive; show again when the session ends.
  const sync = () => {
    el.style.display = world.session ? 'none' : 'flex';
  };
  sync();
  setInterval(sync, 500);
}
