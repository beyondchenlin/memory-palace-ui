import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.module.js': 'text/javascript',
};
const PORT = 8913;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = normalize(join(root, p));
  if (!fp.startsWith(root) || !existsSync(fp) || statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(PORT, r));

const outDir = join(root, 'screenshots', 'v10d');
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,950',
    '--ignore-gpu-blocklist', '--enable-webgl',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
  ],
  defaultViewport: { width: 1400, height: 950 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /palace|UV|chassis|studio/i.test(t)) logs.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => logs.push('ERR ' + e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (n, p, d = '') => { results.push({ name: n, pass: !!p, detail: d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForFunction(
  () => document.body.classList.contains('has-texture-screen') || document.body.classList.contains('gltf-chassis-failed'),
  { timeout: 30000 }
).catch(() => {});
await sleep(2800);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(700);

const boot = await page.evaluate(() => ({
  loadMs: window.LT_MESH?.getLoadMs?.(),
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: window.LT_MESH?.getOverlayMode?.(),
  orient: window.LT_MESH?.debugOrient?.(),
  fit: getComputedStyle(document.getElementById('demo-stage')).getPropertyValue('--shell-fit').trim(),
  proj: window.LT_MESH?.getProjection?.()?.aabb || null,
}));
ok('boot', boot.loadMs > 0 && !logs.some(l => l.startsWith('ERR')), `loadMs=${boot.loadMs}`);
ok('fit-1', boot.fit === '1' || boot.fit === '', `fit=${boot.fit}`);
ok('front-size', boot.proj && boot.proj.height > 420 && boot.proj.height < 920, JSON.stringify(boot.proj));
ok('front-high', boot.proj && boot.proj.top < 260 && boot.proj.top > 40, `top=${boot.proj?.top}`);
await page.screenshot({ path: join(outDir, 'front.png') });

/* Magenta solid on glass to prove UV locked to mesh */
await page.evaluate(() => {
  window.LT_MESH?.setDragging?.(true);
  window.LT_SHELL?.setOrbit?.(0, 35, true);
  window.LT_MESH?.debugPaint?.('#ff00aa');
});
await sleep(500);
await page.screenshot({ path: join(outDir, 'tilt-35-magenta.png') });

/* Real UI glued at tilt */
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
  window.LT_SHELL?.setOrbit?.(8, 32, true);
});
await sleep(600);
const tilt = await page.evaluate(() => ({
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: window.LT_MESH?.getOverlayMode?.(),
}));
ok('tilt-uv-mode', tilt.facing === false && tilt.overlay === false, JSON.stringify(tilt));
await page.screenshot({ path: join(outDir, 'tilt-30.png') });

/* After drag reset — stable */
await page.evaluate(() => {
  window.LT_MESH?.setDragging?.(false);
  window.LT_SHELL?.resetOrbit?.();
});
await sleep(800);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(400);
const after = await page.evaluate(() => window.LT_MESH?.getProjection?.()?.aabb || null);
const dH = boot.proj && after ? Math.abs(boot.proj.height - after.height) : 999;
const dT = boot.proj && after ? Math.abs(boot.proj.top - after.top) : 999;
ok('after-no-drift', dH < 50 && dT < 50, `dH=${dH.toFixed(1)} dT=${dT.toFixed(1)}`);
await page.screenshot({ path: join(outDir, 'after-drag.png') });

/* Screensaver glued while tilted */
await page.evaluate(async () => {
  window.LT_SHELL?.showScreensaver?.();
  await new Promise((r) => setTimeout(r, 500));
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
  window.LT_MESH?.setDragging?.(true);
  window.LT_SHELL?.setOrbit?.(6, 28, true);
});
await sleep(800);
await page.screenshot({ path: join(outDir, 'screensaver-tilt.png') });

writeFileSync(join(outDir, 'qa-v10d.json'), JSON.stringify({ results, logs, boot, tilt, after }, null, 2));
console.log('LOGS\n' + logs.filter(l => /UV|chassis|studio|affine|hid|ERR/i.test(l)).join('\n'));
await browser.close();
server.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
