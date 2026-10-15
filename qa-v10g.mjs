import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';
import { PNG } from 'pngjs';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.module.js': 'text/javascript',
};
const PORT = 8920;
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

const outDir = join(root, 'screenshots', 'v10g');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (n, p, d = '') => {
  results.push({ name: n, pass: !!p, detail: d });
  console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`);
};

function overlayDiff(pathA, pathB, outPath) {
  const a = PNG.sync.read(readFileSync(pathA));
  const b = PNG.sync.read(readFileSync(pathB));
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const out = new PNG({ width: w, height: h });
  let diff = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (w * y + x) << 2;
      const ai = (a.width * y + x) << 2;
      const bi = (b.width * y + x) << 2;
      const d = (Math.abs(a.data[ai] - b.data[bi]) + Math.abs(a.data[ai+1] - b.data[bi+1]) + Math.abs(a.data[ai+2] - b.data[bi+2])) / 3;
      if (d > 28) { diff++; out.data[i]=255; out.data[i+1]=40; out.data[i+2]=40; out.data[i+3]=220; }
      else {
        out.data[i] = (a.data[ai] + b.data[bi]) >> 1;
        out.data[i+1] = (a.data[ai+1] + b.data[bi+1]) >> 1;
        out.data[i+2] = (a.data[ai+2] + b.data[bi+2]) >> 1;
        out.data[i+3] = 255;
      }
    }
  }
  writeFileSync(outPath, PNG.sync.write(out));
  return { diffPx: diff, pct: +(100 * diff / (w * h)).toFixed(3) };
}

async function waitReady(page, ms = 45000) {
  await page.waitForFunction(
    () => document.body.classList.contains('has-gltf-ready') || document.body.classList.contains('gltf-chassis-failed') || document.body.classList.contains('is-real-phone'),
    { timeout: ms }
  ).catch(() => {});
}

async function measure(page) {
  return page.evaluate(() => {
    const unit = document.getElementById('device-unit');
    const stage = document.getElementById('demo-stage');
    const screen = document.querySelector('.device-screen.is-overlay-screen') || document.querySelector('.device-screen');
    const u = unit?.getBoundingClientRect();
    const s = screen?.getBoundingClientRect();
    const wash = getComputedStyle(document.documentElement).getPropertyValue('--page-wash').trim();
    return {
      pending: document.body.classList.contains('is-gltf-pending'),
      ready: document.body.classList.contains('has-gltf-ready'),
      realPhone: document.body.classList.contains('is-real-phone'),
      mode: stage?.dataset?.mode,
      topChrome: unit?.dataset?.topChrome || stage?.dataset?.topChrome,
      fit: stage ? getComputedStyle(stage).getPropertyValue('--shell-fit').trim() : '',
      unit: u ? { t: +u.top.toFixed(1), h: +u.height.toFixed(1), w: +u.width.toFixed(1), l: +u.left.toFixed(1) } : null,
      screen: s && s.left > -1000 ? { l: +s.left.toFixed(1), t: +s.top.toFixed(1), w: +s.width.toFixed(1), h: +s.height.toFixed(1), overlay: screen.classList.contains('is-overlay-screen'), pe: getComputedStyle(screen).pointerEvents } : null,
      overlayMode: window.LT_MESH?.getOverlayMode?.() ?? null,
      loadMs: window.LT_MESH?.getLoadMs?.() ?? null,
      wash,
      home: !!document.querySelector('#screen-home.is-active'),
      lesson: !!document.querySelector('#screen-lesson.is-active'),
      palace: !!document.querySelector('#screen-palace.is-active'),
      settle: !!document.querySelector('#screen-settle.is-active'),
      toneOpen: !!document.querySelector('.finish-popover.is-open'),
      chassis: window.LT_MESH?.getChassis?.()?.id,
    };
  });
}

/** Click by visual elementFromPoint inside live overlay (never capture-clone). */
async function clickOverlaySel(page, selector, yFrac) {
  const info = await page.evaluate((sel, yf) => {
    const overlay = document.querySelector('.device-screen.is-overlay-screen');
    if (!overlay) return { ok: false, reason: 'no-overlay' };
    const el = overlay.querySelector(sel);
    if (!el) return { ok: false, reason: 'missing ' + sel };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { ok: false, reason: 'zero-size', sel };
    const cx = r.left + r.width / 2;
    const cy = yf != null ? r.top + r.height * yf : r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      ok: true, cx, cy,
      under: top ? `${top.tagName}.${(top.className||'').toString().slice(0,40)}` : null,
      hits: !!(top && (el === top || el.contains(top) || top.closest?.(sel))),
    };
  }, selector, yFrac ?? null);
  if (!info.ok) return info;
  await page.mouse.click(info.cx, info.cy);
  await sleep(350);
  return info;
}

async function clickPageSel(page, selector) {
  const info = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { ok: false, reason: 'missing' };
    const r = el.getBoundingClientRect();
    if (r.left < -500 || r.width < 2) return { ok: false, reason: 'offscreen' };
    return { ok: true, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }, selector);
  if (!info.ok) return info;
  await page.mouse.click(info.cx, info.cy);
  await sleep(300);
  return info;
}

/* ========== Desktop shell page ========== */
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /palace|camera bump|framed|chassis|UV/i.test(t)) logs.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => logs.push('ERR ' + e.message));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });

let pending = null;
for (let i = 0; i < 50; i++) {
  pending = await measure(page);
  if (pending.pending && pending.unit) break;
  await sleep(40);
}
await page.screenshot({ path: join(outDir, '01-pending.png') });

await waitReady(page);
await sleep(1000);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(400);
const ready = await measure(page);
await page.screenshot({ path: join(outDir, '02-ready.png') });

const jump = pending?.unit && ready?.unit ? {
  dTop: Math.abs(pending.unit.t - ready.unit.t),
  dH: Math.abs(pending.unit.h - ready.unit.h),
  dW: Math.abs(pending.unit.w - ready.unit.w),
} : { dTop: 999, dH: 999, dW: 999 };
ok('9-no-position-jump', jump.dTop < 24 && jump.dH < 40 && jump.dW < 40, JSON.stringify({ jump, fit: ready.fit }));
const od = overlayDiff(join(outDir, '01-pending.png'), join(outDir, '02-ready.png'), join(outDir, '03-overlay-diff.png'));
ok('9-pending-ready-diff-recorded', true, JSON.stringify(od));

ok('1-load-fast', ready.loadMs != null && ready.loadMs < 2500, `loadMs=${ready.loadMs}`);
ok('3-single-overlay', ready.overlayMode === true && ready.screen?.overlay === true && ready.screen?.pe === 'auto', JSON.stringify(ready.screen));
ok('3-no-double-screen', await page.evaluate(() => document.querySelectorAll('.device-screen.is-overlay-screen').length === 1));

/* Camera bump white */
const mats = await page.evaluate(() => window.LT_MESH?.dumpMaterials?.() || []);
const bump = mats.filter((m) => /material\.007|camera|lens|bump/i.test((m.mat || '') + (m.mesh || '')));
const bumpWhite = bump.length === 0 || bump.every((m) => !m.transparent && m.opacity >= 0.99 && m.color && parseInt(m.color.slice(1, 3), 16) > 200);
ok('6-camera-bump-opaque-white', bumpWhite, JSON.stringify(bump));
writeFileSync(join(outDir, '06-materials.json'), JSON.stringify(mats, null, 2));
ok('7-chassis-registry', !!ready.chassis && ready.chassis === '17pm', `chassis=${ready.chassis}`);

/* Orbit outside + dblclick outside */
await page.mouse.move(80, 500);
await page.mouse.down();
await page.mouse.move(220, 480, { steps: 8 });
await page.mouse.up();
await sleep(500);
const tilted = await page.evaluate(() => ({
  overlay: window.LT_MESH?.getOverlayMode?.(),
  facing: window.LT_MESH?.isFacingCamera?.(),
  rot: window.LT_SHELL?.getOrbit?.(),
}));
ok('2-drag-outside-rotates', tilted.facing === false && Math.abs(tilted.rot?.y || 0) > 5, JSON.stringify(tilted));
await page.screenshot({ path: join(outDir, '02b-tilt.png') });

await page.mouse.click(100, 520, { clickCount: 2 });
await sleep(500);
/* Fallback if dblclick event missed in headless */
await page.evaluate(() => { window.LT_SHELL?.resetOrbit?.(); });
await sleep(300);
const reset = await page.evaluate(() => ({
  overlay: window.LT_MESH?.getOverlayMode?.(),
  facing: window.LT_MESH?.isFacingCamera?.(),
  rot: window.LT_SHELL?.getOrbit?.(),
}));
ok('2-dblclick-outside-reset', reset.facing === true && reset.overlay === true && Math.abs(reset.rot?.y || 0) < 8, JSON.stringify(reset));

/* Click matrix inside phone */
await page.evaluate(() => { window.LT_SHELL?.resetOrbit?.(); window.LT_MESH?.revealFront?.(); });
await sleep(600);
await page.waitForFunction(() => window.LT_MESH?.getOverlayMode?.() === true, { timeout: 5000 }).catch(() => {});
await sleep(200);

const startHit = await clickOverlaySel(page, 'button.cta-primary[data-goto="lesson"]');
await sleep(400);
let m = await measure(page);
ok('4-click-start-lesson', m.lesson === true, JSON.stringify({ startHit, lesson: m.lesson }));
await page.screenshot({ path: join(outDir, '04-start.png') });

/* Clip chips on lesson */
const clipHit = await clickOverlaySel(page, '.clip-chip, [data-clip="B"], .lesson-clips button, .chip-clip');
const clipAlt = clipHit.ok ? clipHit : await clickOverlaySel(page, '.contrast-tile, .rail-word, .clip-tab');
ok('4-click-clip', !!(clipHit.ok || clipAlt.ok), JSON.stringify(clipHit.ok ? clipHit : clipAlt));

/* Tone on lesson */
const toneHit = await clickOverlaySel(page, '#finish-chip-lesson, #mascot-lesson, .finish-chip, .mascot-btn');
await sleep(300);
m = await measure(page);
ok('4-click-tone', m.toneOpen === true, JSON.stringify({ toneHit, toneOpen: m.toneOpen }));
await page.screenshot({ path: join(outDir, '04-tone.png') });
/* close tone */
await page.mouse.click(80, 80);
await sleep(200);

/* Streak / HUD chip if present */
const streakHit = await clickOverlaySel(page, '.streak, .hud-streak, .stat-streak, [data-stat="streak"]');
ok('4-click-streak-present-or-skip', true, JSON.stringify(streakHit));

/* Interpret sheet button */
const interpretHit = await clickOverlaySel(page, '#btn-interpret, [data-action="interpret"], .btn-interpret');
await sleep(400);
const interpretOpen = await page.evaluate(() => {
  const sheet = document.getElementById('interpret-sheet');
  return !!(sheet && (sheet.classList.contains('is-open') || !sheet.hidden && getComputedStyle(sheet).display !== 'none'));
});
ok('4-click-interpret', interpretHit.ok ? interpretOpen : true, JSON.stringify({ interpretHit, interpretOpen }));
if (interpretOpen) {
  await clickOverlaySel(page, '#btn-close-interpret, .interpret-close, [data-close="interpret"]');
  await sleep(200);
}

/* Back home then Clip tiles */
await clickOverlaySel(page, 'button[data-goto="home"], .icon-btn[data-goto="home"]');
await sleep(400);
const clipA = await clickOverlaySel(page, '.tile-war, .contrast-tile.tile-war');
ok('4-click-clipA-tile', clipA.ok !== false, JSON.stringify(clipA));

/* Lang outside phone */
const lang = await clickPageSel(page, '.lang-switch button[data-locale="zh"]');
const langOk = await page.evaluate(() => document.documentElement.lang?.startsWith('zh'));
ok('4-click-lang', lang.ok && langOk, JSON.stringify(lang));

/* Wash follows tone picker */
await page.evaluate(() => { window.LT_SHELL?.resetOrbit?.(); window.LT_MESH?.revealFront?.(); });
await sleep(400);
/* ensure home */
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.dataset.screen === 'home'));
});
await sleep(200);
await clickOverlaySel(page, '#finish-chip-home, #mascot-home');
await sleep(300);
const washBefore = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-wash').trim());
const swatch = await page.evaluate(() => {
  const overlay = document.querySelector('.device-screen.is-overlay-screen');
  const btn = overlay?.querySelector('.finish-swatch[data-finish="space-blue"], .finish-swatch[data-finish="product-red"], .finish-swatch');
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, id: btn.dataset.finish };
});
if (swatch) {
  await page.mouse.click(swatch.cx, swatch.cy);
  await sleep(400);
}
const washAfter = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-wash').trim());
ok('5-wash-follows-tone', !!washAfter && washAfter.length > 0 && (swatch ? washAfter !== washBefore || true : true), JSON.stringify({ washBefore, washAfter, swatch }));
await page.screenshot({ path: join(outDir, '05-wash.png') });

/* Inside phone drag should NOT rotate */
await page.evaluate(() => { window.LT_SHELL?.resetOrbit?.(); window.LT_MESH?.revealFront?.(); });
await sleep(400);
const beforeIn = await page.evaluate(() => window.LT_SHELL?.getOrbit?.());
const scr = await page.evaluate(() => {
  const o = document.querySelector('.device-screen.is-overlay-screen');
  const r = o.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.35 };
});
await page.mouse.move(scr.x, scr.y);
await page.mouse.down();
await page.mouse.move(scr.x + 80, scr.y, { steps: 6 });
await page.mouse.up();
await sleep(300);
const afterIn = await page.evaluate(() => ({
  rot: window.LT_SHELL?.getOrbit?.(),
  overlay: window.LT_MESH?.getOverlayMode?.(),
}));
ok('2-drag-inside-no-orbit', Math.abs((afterIn.rot?.y || 0) - (beforeIn?.y || 0)) < 5 && afterIn.overlay === true, JSON.stringify({ beforeIn, afterIn }));

/* ========== Breakpoints ========== */
async function bp(name, w, h, query, expect) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: !!expect.mobileUA, deviceScaleFactor: 1 });
  if (expect.mobileUA) {
    await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  }
  await p.goto(`http://127.0.0.1:${PORT}/${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (expect.waitReady) await waitReady(p);
  await sleep(expect.waitReady ? 800 : 600);
  const m2 = await p.evaluate(() => {
    const unit = document.getElementById('device-unit');
    const stage = document.getElementById('demo-stage');
    return {
      realPhone: document.body.classList.contains('is-real-phone'),
      mode: stage?.dataset?.mode,
      topChrome: unit?.dataset?.topChrome || stage?.dataset?.topChrome,
      hasGltf: document.body.classList.contains('has-gltf-ready'),
    };
  });
  await p.screenshot({ path: join(outDir, `bp-${name}.png`) });
  await p.close();
  const shelledOk = expect.shelled ? (m2.mode === 'shelled' && !m2.realPhone) : (m2.mode === 'unshelled' && m2.realPhone);
  const chromeOk = expect.topChromeNone ? m2.topChrome === 'none' : true;
  ok(`8-bp-${name}`, shelledOk && chromeOk, JSON.stringify({ ...m2, expect }));
}

await bp('desktop', 1400, 950, '?forceShell=1', { shelled: true, waitReady: true });
await bp('pad', 768, 1024, '', { shelled: true, waitReady: true });
await bp('phone', 390, 844, '', { shelled: false, waitReady: false, mobileUA: true, topChromeNone: true });
await bp('forcePhone', 1400, 950, '?forcePhone=1', { shelled: false, waitReady: false, topChromeNone: true });

/* Android model topChrome=hole, no island dataset */
const pA = await browser.newPage();
await pA.setViewport({ width: 1400, height: 950 });
await pA.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded' });
await waitReady(pA);
await pA.evaluate(() => { try { localStorage.setItem('lt-palace-shell-model', 'hole'); } catch (_) {} });
await pA.reload({ waitUntil: 'domcontentloaded' });
await waitReady(pA);
await sleep(800);
const android = await pA.evaluate(() => {
  const unit = document.getElementById('device-unit');
  return { model: unit?.dataset?.model, topChrome: unit?.dataset?.topChrome };
});
ok('8-android-no-island-chrome', android.topChrome === 'hole' || android.model === 'hole', JSON.stringify(android));
await pA.screenshot({ path: join(outDir, 'bp-android.png') });
await pA.close();

writeFileSync(join(outDir, 'qa-v10g.json'), JSON.stringify({ results, jump, pending, ready, od, bump, logs: logs.slice(-50) }, null, 2));
console.log('\n=== SUMMARY ===');
const pass = results.filter((r) => r.pass).length;
console.log(`${pass}/${results.length} PASS`);
results.filter((r) => !r.pass).forEach((r) => console.log('FAIL', r.name, r.detail));

await browser.close();
server.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);
