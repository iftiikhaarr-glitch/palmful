// Captures the emulator view to the scratch path in env PALMFUL_SHOT.
export default async function run({ page }) {
  const path = process.env.PALMFUL_SHOT || 'shot.png';
  await page.screenshot({ path, timeout: 30000 });
  return { path };
}
