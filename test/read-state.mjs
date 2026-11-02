// Run with: npx @iwsdk/cli browser run test/read-state.mjs
// Returns the prototype's live state + metrics from the managed emulator page.
export default async function run({ page, frame }) {
  const target = frame ?? page;
  return target.evaluate(() => {
    const p = window.__palmful;
    if (!p) return { ready: false, href: location.href };
    return { ready: true, tracked: p.tracked, state: { ...p.state }, metrics: { ...p.metrics } };
  });
}
