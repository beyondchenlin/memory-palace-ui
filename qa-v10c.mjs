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
const PORT = 8912;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = normalize(join(root, p));
  if (!fp.startsWith(root) || !existsSync(fp) || statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, {
    'Content-Type': mime[extname(fp)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(PORT, r));

const outDir = join(root, 'screenshots', 'v10c');
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
  if (m.type() === 'error' || /palace|chassis|fit|UV/i.test(t)) logs.push(`[${m.type()}] ${t}`);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, {
  waitUntil: 'domcontentloaded', timeout: 45000,
});
await page.waitForFunction(
  () => document.body.classList.contains('has-texture-screen') || document.body.classList.contains('gltf-chassis-failed'),
  { timeout: 30000 }
).catch(() => {});
await sleep(2800);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(600);

const boot = await page.evaluate(() => {
  const orient = window.LT_MESH?.debugOrient?.();
  const fit = getComputedStyle(document.getElementById('demo-stage')).getPropertyValue('--shell-fit').trim();
  const floatAnim = getComputedStyle(document.querySelector('.device-float') || document.body).animationName;
  return {
    loadMs: window.LT_MESH?.getLoadMs?.(),
    facing: window.LT_MESH?.isFacingCamera?.(),
    overlay: window.LT_MESH?.getOverlayMode?.(),
    phoneRot: orient?.phoneRot,
    size: orient?.size,
    center: orient?.center,
    fit,
    floatAnim,
  };
});
ok('boot', boot.loadMs > 0, JSON.stringify(boot));
ok('shell-fit-1', boot.fit === '1' || boot.fit === '1.000', `fit=${boot.fit}`);
ok('no-float-anim', !boot.floatAnim || boot.floatAnim === 'none', `anim=${boot.floatAnim}`);

await page.screenshot({ path: join(outDir, 'front.png') });

/* Measure phone AABB proxy via projection at front */
const frontProj = await page.evaluate(() => window.LT_MESH?.getProjection?.()?.aabb || null);
ok('front-large', frontProj && frontProj.height > 480, JSON.stringify(frontProj));
ok('front-high', frontProj && frontProj.top < 280, `top=${frontProj?.top}`);

/* Orbit 30 — must UV-glue (overlay off) + chassis */
await page.evaluate(() => {
  if (window.LT_MESH?.setDragging) window.LT_MESH.setDragging(true);
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(0, 32, true);
  else window.LT_MESH?.setRotation(0, 32);
});
await sleep(500);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(400);
const tilt = await page.evaluate(() => ({
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: window.LT_MESH?.getOverlayMode?.(),
  proj: window.LT_MESH?.getProjection?.()?.aabb || null,
}));
ok('tilt-uv-mode', tilt.facing === false && tilt.overlay === false, JSON.stringify(tilt));
await page.screenshot({ path: join(outDir, 'tilt-30.png') });

/* After drag reset — still high+large */
await page.evaluate(() => {
  if (window.LT_MESH?.setDragging) window.LT_MESH.setDragging(false);
  if (window.LT_SHELL?.resetOrbit) window.LT_SHELL.resetOrbit();
  else window.LT_MESH?.setRotation(0, 0);
});
await sleep(700);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(400);
const after = await page.evaluate(() => window.LT_MESH?.getProjection?.()?.aabb || null);
ok('after-still-large', after && after.height > 480, JSON.stringify(after));
ok('after-still-high', after && after.top < 280, `top=${after?.top}`);
const deltaH = frontProj && after ? Math.abs(frontProj.height - after.height) : 999;
const deltaTop = frontProj && after ? Math.abs(frontProj.top - after.top) : 999;
ok('no-drift', deltaH < 40 && deltaTop < 40, `dH=${deltaH.toFixed(1)} dTop=${deltaTop.toFixed(1)}`);
await page.screenshot({ path: join(outDir, 'after-drag.png') });

writeFileSync(join(outDir, 'qa-v10c.json'), JSON.stringify({ results, logs, boot, tilt, frontProj, after }, null, 2));
console.log('LOGS\n' + logs.filter(l => /chassis|hid|UV|fit|mesh/i.test(l)).join('\n'));
await browser.close();
server.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
