import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json',
  '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.module.js':'text/javascript',
};
const PORT = 8898;
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

const outDir = join(root, 'screenshots', 'v8');
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,950',
    '--ignore-gpu-blocklist', '--enable-webgl',
    '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
  ],
  defaultViewport: { width: 1400, height: 950 },
});
const page = await browser.newPage();
const conserr = [];
const notfound = [];
page.on('pageerror', (e) => conserr.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') conserr.push(m.text()); });
page.on('response', (r) => { if (r.status() === 404) notfound.push(r.url()); });

const results = [];
const ok = (name, pass, detail='') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(
  () => document.body.classList.contains('has-glued-screen') || document.body.classList.contains('gltf-chassis-failed'),
  { timeout: 20000 }
).catch(() => {});
await sleep(1500);

const boot = await page.evaluate(() => ({
  glued: document.body.classList.contains('has-glued-screen'),
  failed: document.body.classList.contains('gltf-chassis-failed'),
  loadMs: window.LT_MESH?.getLoadMs?.() ?? null,
  hasCss3d: !!document.querySelector('.device-css3d'),
  hasWebgl: !!document.querySelector('canvas.device-webgl'),
  screenCss3d: !!document.querySelector('.device-screen.is-css3d-screen'),
  railTop: !!document.querySelector('.shell-rail-top'),
  typing: !!document.querySelector('.typing-strip,.shell-typing-rail'),
  unitTilt: getComputedStyle(document.getElementById('device-unit')).transform,
  credit: document.getElementById('device-credit')?.textContent || '',
  shell: !!window.LT_SHELL,
}));

ok('gltf-glue-boot', boot.glued && boot.screenCss3d && boot.hasCss3d && boot.hasWebgl && !boot.failed,
  `loadMs=${boot.loadMs}`);
ok('no-top-rail', !boot.railTop);
ok('no-typing-strip', !boot.typing);
ok('no-css-unit-tilt', !boot.unitTilt || boot.unitTilt === 'none' || boot.unitTilt.startsWith('matrix(1, 0, 0, 1'));
ok('shell-api', boot.shell);

await page.screenshot({ path: join(outDir, '01-boot.png') });

const before = await page.evaluate(() => {
  const r = document.querySelector('.device-screen').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});

// Drag from stage padding (outer orbit)
const stageBox = await page.$eval('#demo-stage', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.move(stageBox.x + 36, stageBox.y + stageBox.h * 0.42);
await page.mouse.down();
await page.mouse.move(stageBox.x + 220, stageBox.y + stageBox.h * 0.42, { steps: 20 });
await page.mouse.up();
await sleep(250);

const after = await page.evaluate(() => {
  const r = document.querySelector('.device-screen').getBoundingClientRect();
  const rot = window.LT_SHELL?.getRotation?.();
  const parent = document.querySelector('.device-screen')?.parentElement?.className || '';
  return { x: r.x, y: r.y, w: r.width, h: r.height, rot, parent };
});
await page.screenshot({ path: join(outDir, '02-drag.png') });

const moved = Math.hypot(after.x - before.x, after.y - before.y) > 6 || Math.abs(after.w - before.w) > 6;
const rotated = after.rot && Math.abs(after.rot.y) > 8;
ok('orbit-moves-glued-screen', rotated && moved, `rotY=${after.rot?.y?.toFixed?.(1)} d=${Math.hypot(after.x-before.x, after.y-before.y).toFixed(1)}`);
ok('screen-still-css3d', /css3d|CSS3D/i.test(after.parent) || after.parent === '', after.parent.slice(0, 80));
// tighter check
const stillGlued = await page.evaluate(() => document.querySelector('.device-screen.is-css3d-screen') && document.body.classList.contains('has-glued-screen'));
ok('still-glued-after-drag', stillGlued);

// Hard drag further — UI must stay classed as css3d screen (same Object3D)
await page.mouse.move(stageBox.x + 36, stageBox.y + stageBox.h * 0.5);
await page.mouse.down();
await page.mouse.move(stageBox.x + 360, stageBox.y + stageBox.h * 0.35, { steps: 24 });
await page.mouse.up();
await sleep(200);
const hard = await page.evaluate(() => {
  const s = document.querySelector('.device-screen');
  const r = s.getBoundingClientRect();
  return {
    glued: document.body.classList.contains('has-glued-screen'),
    cls: s.className,
    rot: window.LT_SHELL?.getRotation?.(),
    facing: window.LT_MESH?.isFacingCamera?.(),
    w: r.width, h: r.height,
  };
});
ok('hard-drag-no-desync', hard.glued && hard.cls.includes('is-css3d-screen'), JSON.stringify(hard));
await page.screenshot({ path: join(outDir, '03-hard-drag.png') });

// dblclick reset — click far corner of stage (outside unit), fire dblclick event
await page.evaluate(() => window.LT_SHELL?.resetOrbit?.()); // ensure known state first from hard drag
await sleep(200);
// spin a bit then dblclick-reset via real event
await page.mouse.move(stageBox.x + 36, stageBox.y + stageBox.h * 0.42);
await page.mouse.down();
await page.mouse.move(stageBox.x + 160, stageBox.y + stageBox.h * 0.42, { steps: 10 });
await page.mouse.up();
await sleep(150);
await page.evaluate(() => {
  const stage = document.getElementById('demo-stage');
  const r = stage.getBoundingClientRect();
  const ev = new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 24, clientY: r.top + r.height * 0.7 });
  stage.dispatchEvent(ev);
});
await sleep(500);
const reset = await page.evaluate(() => window.LT_SHELL?.getRotation?.());
ok('dblclick-reset', reset && Math.abs(reset.x) < 1.5 && Math.abs(reset.y) < 1.5, JSON.stringify(reset));

// Start click when facing
await page.evaluate(() => window.LT_SHELL?.resetOrbit?.());
await sleep(400);
await page.evaluate(() => document.querySelector('.cta-primary[data-goto="lesson"]')?.click());
await sleep(400);
const onLesson = await page.evaluate(() => !!document.querySelector('#screen-lesson.is-active'));
ok('start-on-glass', onLesson);

const pet = await page.evaluate(() => {
  const el = document.getElementById('stage-pet');
  if (!el) return null;
  const bub = el.querySelector('.stage-pet-bubble');
  return { filter: getComputedStyle(el.querySelector('.stage-pet-emoji')).filter, bub: bub ? getComputedStyle(bub).display : null };
});
ok('pet-no-glow', pet && pet.filter === 'none' && pet.bub === 'none', JSON.stringify(pet));

const realErrs = conserr.filter((e) => !/favicon|Password field|Deprecated|net::ERR|404 \(Not Found\)/i.test(e));
ok('no-fatal-console', realErrs.length === 0, realErrs.slice(0, 2).join(' | '));
ok('no-critical-404', notfound.filter((u) => !/favicon/.test(u)).length === 0, notfound.join(', '));

await page.screenshot({ path: join(outDir, '04-final.png') });
await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== v8 QA ${results.length - failed.length}/${results.length} ===`);
writeFileSync(join(outDir, 'results.json'), JSON.stringify({ boot, results, notfound, conserr }, null, 2));
process.exit(failed.length ? 1 : 0);
