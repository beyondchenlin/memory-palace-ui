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
const PORT = 8910;
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

const outDir = join(root, 'screenshots', 'v10');
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
const conserr = [];
page.on('pageerror', (e) => conserr.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') conserr.push(m.text());
  if (m.type() === 'info' && /palace/i.test(m.text())) conserr.push('[info] ' + m.text());
});

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
});
await page.waitForFunction(
  () =>
    document.body.classList.contains('has-texture-screen') ||
    document.body.classList.contains('gltf-chassis-failed'),
  { timeout: 30000 }
).catch(() => {});
await sleep(2800);
/* Force a fresh capture */
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
});
await sleep(800);

const boot = await page.evaluate(() => {
  const proj = window.LT_MESH?.getProjection?.();
  const orient = window.LT_MESH?.debugOrient?.();
  const screen = document.querySelector('.device-screen');
  const sr = screen ? screen.getBoundingClientRect() : null;
  const canvas = document.querySelector('canvas.device-webgl');
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  return {
    glued: document.body.classList.contains('has-glued-screen'),
    texture: document.body.classList.contains('has-texture-screen'),
    failed: document.body.classList.contains('gltf-chassis-failed'),
    loadMs: window.LT_MESH?.getLoadMs?.() ?? null,
    overlay: !!document.querySelector('.device-screen.is-overlay-screen'),
    facing: window.LT_MESH?.isFacingCamera?.(),
    projAabb: proj?.aabb || null,
    screenRect: sr ? { l: sr.left, t: sr.top, w: sr.width, h: sr.height } : null,
    canvasRect: cr ? { w: cr.width, h: cr.height } : null,
    orient,
    lastGood: orient?.lastGoodCapture || 0,
  };
});

ok('boot-texture-glue', boot.glued && boot.texture && !boot.failed, `loadMs=${boot.loadMs}`);
ok('boot-facing-overlay', boot.facing && boot.overlay, `facing=${boot.facing} overlay=${boot.overlay}`);
ok('boot-projection', !!(boot.projAabb && boot.projAabb.width > 80), JSON.stringify(boot.projAabb));
if (boot.projAabb && boot.screenRect) {
  const dw = Math.abs(boot.projAabb.width - boot.screenRect.w);
  const dh = Math.abs(boot.projAabb.height - boot.screenRect.h);
  ok('boot-overlay-matches-proj', dw < 40 && dh < 40, `dw=${dw.toFixed(1)} dh=${dh.toFixed(1)}`);
  /* Overlay should be much smaller than full canvas (not covering whole stage) */
  const frac = boot.screenRect.h / (boot.canvasRect?.h || 1);
  ok('boot-overlay-not-fullstage', frac < 0.92 && frac > 0.35, `hFrac=${frac.toFixed(3)}`);
}
ok('boot-capture-good', boot.lastGood > 0, `lastGood=${boot.lastGood}`);

await page.screenshot({ path: join(outDir, '01-front-rest.png') });

/* Tilt ~30° Y — must leave overlay, show UV texture on glass */
await page.evaluate(() => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(0, 30, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(0, 30);
});
await sleep(400);
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
});
await sleep(600);

const t30 = await page.evaluate(() => ({
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: !!document.querySelector('.device-screen.is-overlay-screen'),
  parked: getComputedStyle(document.querySelector('.device-screen')).opacity === '0' ||
    document.querySelector('.device-screen')?.getBoundingClientRect().left < -1000,
}));
ok('tilt30-showcase-uv', t30.facing === false && !t30.overlay, JSON.stringify(t30));
await page.screenshot({ path: join(outDir, '02-tilt-30y.png') });

/* Tilt ~40° Y + some X */
await page.evaluate(() => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(-12, 40, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(-12, 40);
});
await sleep(500);
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
});
await sleep(500);

const t40 = await page.evaluate(() => ({
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: !!document.querySelector('.device-screen.is-overlay-screen'),
  orient: window.LT_MESH?.debugOrient?.(),
}));
ok('tilt40-showcase-uv', t40.facing === false && !t40.overlay, JSON.stringify({ facing: t40.facing, overlay: t40.overlay }));
await page.screenshot({ path: join(outDir, '03-tilt-40yx.png') });

/* Magenta probe — proves UV mapping lands on glass */
const mag = await page.evaluate(() => window.LT_MESH?.debugPaint?.('#ff00aa'));
await page.evaluate(() => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(-10, 35, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(-10, 35);
});
await sleep(300);
ok('magenta-paint', !!(mag && mag.ok), JSON.stringify(mag));
await page.screenshot({ path: join(outDir, '04-magenta-tilt.png') });

/* Restore UI texture + front */
await page.evaluate(async () => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(0, 0, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(0, 0);
  await window.LT_MESH?.captureNow?.();
});
await sleep(800);
await page.screenshot({ path: join(outDir, '05-front-after.png') });

const pageErrs = conserr.filter(
  (e) => !/ResizeObserver|favicon|inlining remote|remote stylesheet|Failed to load resource|\[info\]/i.test(e)
);
ok('no-pageerror', pageErrs.length === 0, pageErrs.slice(0, 3).join(' | '));

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\nSUMMARY ${passed}/${results.length} PASS (${failed} fail)`);
writeFileSync(join(outDir, 'qa-v10.json'), JSON.stringify({ results, conserr: conserr.slice(0, 40) }, null, 2));

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
