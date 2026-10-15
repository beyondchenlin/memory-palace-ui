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
const PORT = 8911;
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

const outDir = join(root, 'screenshots', 'v10b');
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
page.on('pageerror', (e) => logs.push('ERR ' + e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /palace/i.test(t)) logs.push(`[${m.type()}] ${t}`);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

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
await sleep(2500);
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
});
await sleep(700);

const meshState = await page.evaluate(() => {
  const mesh = window.LT_MESH;
  if (!mesh) return { err: 'no LT_MESH' };
  /* Walk three scene via debug — expose mesh visibility by patching briefly */
  const scene = mesh.__scene || null;
  /* Use canvas + orientation; also check console-side via evaluating phone group */
  return {
    loadMs: mesh.getLoadMs?.(),
    facing: mesh.isFacingCamera?.(),
    overlay: mesh.getOverlayMode?.(),
    orient: mesh.debugOrient?.(),
  };
});

/* Inject visibility audit into live scene */
const vis = await page.evaluate(() => {
  const g = window.LT_MESH;
  if (!g) return null;
  /* Access via renderer scene — createDeviceMesh doesn't expose phone; scan WebGL objects via hack */
  const canvas = document.querySelector('canvas.device-webgl');
  if (!canvas) return { err: 'no canvas' };
  /* Re-read last console infos from window if we stash them */
  return {
    bodyClasses: document.body.className,
    credit: document.getElementById('device-credit')?.textContent || '',
  };
});

ok('boot-ok', !!meshState && meshState.loadMs != null, JSON.stringify(meshState));
ok('chassis-ready', meshState.loadMs > 0 && meshState.loadMs < 8000, `loadMs=${meshState.loadMs}`);

await page.screenshot({ path: join(outDir, 'front.png'), fullPage: false });

/* Force tilt 30 Y — overlay off, chassis side must show */
await page.evaluate(() => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(0, 32, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(0, 32);
});
await sleep(500);
await page.evaluate(async () => {
  if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow();
});
await sleep(400);
const tilt30 = await page.evaluate(() => ({
  facing: window.LT_MESH?.isFacingCamera?.(),
  overlay: window.LT_MESH?.getOverlayMode?.(),
}));
ok('tilt30-overlay-off', tilt30.facing === false && tilt30.overlay === false, JSON.stringify(tilt30));
await page.screenshot({ path: join(outDir, 'tilt-30.png'), fullPage: false });

/* Tilt 45 with slight X for thickness */
await page.evaluate(() => {
  if (window.LT_SHELL?.setOrbit) window.LT_SHELL.setOrbit(12, 45, true);
  else if (window.LT_MESH) window.LT_MESH.setRotation(12, 45);
});
await sleep(500);
await page.screenshot({ path: join(outDir, 'tilt-45.png'), fullPage: false });

/* Sample canvas pixels near screen edge at tilt to detect non-white chassis */
const edgeSample = await page.evaluate(() => {
  const c = document.querySelector('canvas.device-webgl');
  if (!c) return null;
  /* Read from WebGL is hard; instead sample the full page screenshot via a temp canvas of the viewport is done outside */
  return { w: c.width, h: c.height };
});

writeFileSync(join(outDir, 'qa-v10b.json'), JSON.stringify({ results, logs, meshState, tilt30, vis, edgeSample }, null, 2));
console.log('SHOTS', outDir);
console.log('LOGS\n' + logs.filter(l => /chassis|hid|UV|mesh|glass|black/i.test(l)).join('\n'));

await browser.close();
server.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
