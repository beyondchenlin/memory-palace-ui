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
const PORT = 8916;
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

const outDir = join(root, 'screenshots', 'v10f');
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
const ok = (n, p, d = '') => { results.push({ name: n, pass: !!p, detail: d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ' — ' + d : ''}`); };

function measurePhone(page) {
  return page.evaluate(() => {
    const unit = document.getElementById('device-unit');
    const stage = document.getElementById('demo-stage');
    const screen = document.querySelector('.device-screen');
    const u = unit?.getBoundingClientRect();
    const s = screen?.getBoundingClientRect();
    const proj = window.LT_MESH?.getProjection?.()?.aabb || null;
    return {
      pending: document.body.classList.contains('is-gltf-pending'),
      ready: document.body.classList.contains('has-gltf-ready'),
      classes: [...document.body.classList].filter(c => /gltf|texture|glued|phone|real/.test(c)),
      fit: stage ? getComputedStyle(stage).getPropertyValue('--shell-fit').trim() : '',
      mode: stage?.dataset?.mode || '',
      topChrome: unit?.dataset?.topChrome || stage?.dataset?.topChrome || '',
      unit: u ? { l: +u.left.toFixed(1), t: +u.top.toFixed(1), w: +u.width.toFixed(1), h: +u.height.toFixed(1) } : null,
      screen: s ? { l: +s.left.toFixed(1), t: +s.top.toFixed(1), w: +s.width.toFixed(1), h: +s.height.toFixed(1), pe: getComputedStyle(screen).pointerEvents, overlay: screen.classList.contains('is-overlay-screen') } : null,
      proj: proj ? { t: +proj.top.toFixed(1), h: +proj.height.toFixed(1), w: +proj.width.toFixed(1) } : null,
      overlayMode: window.LT_MESH?.getOverlayMode?.() ?? null,
      homeActive: !!document.querySelector('#screen-home.is-active'),
      lessonActive: !!document.querySelector('#screen-lesson.is-active'),
    };
  });
}

async function overlayDiff(pathA, pathB, outPath) {
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
      const dr = Math.abs(a.data[ai] - b.data[bi]);
      const dg = Math.abs(a.data[ai + 1] - b.data[bi + 1]);
      const db = Math.abs(a.data[ai + 2] - b.data[bi + 2]);
      const d = (dr + dg + db) / 3;
      if (d > 28) { diff++; out.data[i] = 255; out.data[i+1] = 40; out.data[i+2] = 40; out.data[i+3] = 220; }
      else {
        out.data[i] = Math.round((a.data[ai] + b.data[bi]) / 2);
        out.data[i+1] = Math.round((a.data[ai+1] + b.data[bi+1]) / 2);
        out.data[i+2] = Math.round((a.data[ai+2] + b.data[bi+2]) / 2);
        out.data[i+3] = 255;
      }
    }
  }
  writeFileSync(outPath, PNG.sync.write(out));
  return { diffPx: diff, pct: +(100 * diff / (w * h)).toFixed(3) };
}

/* ===== 1) Position jump: pending vs ready ===== */
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || /palace|framed|UV|chassis/i.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push('ERR ' + e.message));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });

/* Capture ASAP while pending */
let pending = null;
for (let i = 0; i < 40; i++) {
  pending = await measurePhone(page);
  if (pending.pending && pending.unit) break;
  await sleep(50);
}
await page.screenshot({ path: join(outDir, '01-pending.png') });
writeFileSync(join(outDir, '01-pending.json'), JSON.stringify(pending, null, 2));

await page.waitForFunction(
  () => document.body.classList.contains('has-gltf-ready') || document.body.classList.contains('gltf-chassis-failed'),
  { timeout: 45000 }
).catch(() => {});
await sleep(1200);
await page.evaluate(async () => { if (window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(400);

const ready = await measurePhone(page);
await page.screenshot({ path: join(outDir, '02-ready.png') });
writeFileSync(join(outDir, '02-ready.json'), JSON.stringify(ready, null, 2));

let jump = { dTop: 999, dH: 999, dW: 999 };
if (pending?.unit && ready?.unit) {
  jump = {
    dTop: Math.abs(pending.unit.t - ready.unit.t),
    dH: Math.abs(pending.unit.h - ready.unit.h),
    dW: Math.abs(pending.unit.w - ready.unit.w),
    pendingFit: pending.fit,
    readyFit: ready.fit,
  };
}
ok('no-unit-jump', jump.dTop < 24 && jump.dH < 40 && jump.dW < 40, JSON.stringify(jump));

try {
  const od = await overlayDiff(join(outDir, '01-pending.png'), join(outDir, '02-ready.png'), join(outDir, '03-overlay-diff.png'));
  ok('overlay-diff-recorded', true, JSON.stringify(od));
  writeFileSync(join(outDir, '03-overlay-diff.json'), JSON.stringify(od, null, 2));
} catch (e) {
  ok('overlay-diff-recorded', false, String(e.message || e));
}

ok('overlay-on-ready', ready.overlayMode === true && ready.screen?.overlay === true, JSON.stringify({ overlayMode: ready.overlayMode, screen: ready.screen }));
ok('fit-locked', !!ready.fit && ready.fit !== '1', `fit=${ready.fit}`);

/* ===== 2) Click matrix ===== */
async function clickInside(sel, label) {
  const info = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return { ok: false, reason: 'missing ' + selector };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      ok: true,
      cx, cy,
      rect: { l: r.left, t: r.top, w: r.width, h: r.height },
      under: top ? (top.className + '|' + top.tagName + '|' + (top.textContent || '').slice(0, 40)) : null,
      contains: !!(top && (el === top || el.contains(top))),
    };
  }, sel);
  if (!info.ok) return { pass: false, ...info, label };
  await page.mouse.click(info.cx, info.cy);
  await sleep(350);
  return { pass: true, ...info, label };
}

/* Start lesson */
const startHit = await clickInside('button.cta-primary[data-goto="lesson"]', 'start');
await sleep(400);
const afterStart = await measurePhone(page);
const startPass = afterStart.lessonActive === true;
ok('click-start-lesson', startPass, JSON.stringify({ startHit, lessonActive: afterStart.lessonActive, homeActive: afterStart.homeActive }));
await page.screenshot({ path: join(outDir, '04-after-start.png') });

/* Clip chip if on lesson */
let clipPass = false;
const clipInfo = await page.evaluate(() => {
  const chip = document.querySelector('.clip-chip, [data-clip], .contrast-tile');
  if (!chip) return null;
  const r = chip.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, cls: chip.className, text: (chip.textContent || '').slice(0, 30) };
});
if (clipInfo) {
  await page.mouse.click(clipInfo.cx, clipInfo.cy);
  await sleep(300);
  clipPass = true;
}
ok('click-clip', !!clipInfo, JSON.stringify(clipInfo));

/* Tone / finish chip or mascot inside phone */
const toneInfo = await page.evaluate(() => {
  const el = document.querySelector('#finish-chip-home, #finish-chip-lesson, #mascot-home, #mascot-lesson, .finish-chip, .mascot-btn');
  if (!el) return null;
  /* ensure home for tone chip if needed */
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { hidden: true, id: el.id };
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, id: el.id || el.className };
});
let tonePass = false;
if (toneInfo && !toneInfo.hidden) {
  await page.mouse.click(toneInfo.cx, toneInfo.cy);
  await sleep(300);
  tonePass = await page.evaluate(() => !!document.querySelector('.finish-popover.is-open'));
}
ok('click-tone', tonePass, JSON.stringify(toneInfo));
await page.screenshot({ path: join(outDir, '05-tone.png') });

/* Lang — outside phone chrome */
const langInfo = await page.evaluate(() => {
  const btn = document.querySelector('.lang-switch button[data-locale="zh"]');
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
let langPass = false;
if (langInfo) {
  await page.mouse.click(langInfo.cx, langInfo.cy);
  await sleep(300);
  langPass = await page.evaluate(() => document.documentElement.lang?.startsWith('zh'));
}
ok('click-lang', langPass, JSON.stringify(langInfo));
await page.screenshot({ path: join(outDir, '06-lang.png') });

writeFileSync(join(outDir, '04-click-matrix.json'), JSON.stringify({ startHit, clipInfo, toneInfo, langInfo, afterStart }, null, 2));

/* ===== 3) Mobile breakpoints ===== */
async function checkViewport(name, w, h, query, expect) {
  const p = await browser.newPage();
  await p.setViewport({ width: w, height: h, isMobile: !!expect.mobileUA, deviceScaleFactor: 1 });
  if (expect.mobileUA) {
    await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  }
  await p.goto(`http://127.0.0.1:${PORT}/${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(expect.waitReady ? 3500 : 1500);
  if (expect.waitReady) {
    await p.waitForFunction(
      () => document.body.classList.contains('has-gltf-ready') || document.body.classList.contains('is-real-phone') || document.body.classList.contains('gltf-chassis-failed'),
      { timeout: 30000 }
    ).catch(() => {});
    await sleep(600);
  }
  const m = await p.evaluate(() => {
    const unit = document.getElementById('device-unit');
    const stage = document.getElementById('demo-stage');
    const island = document.querySelector('.device-island');
    const islandDisp = island ? getComputedStyle(island).display : 'none';
    return {
      realPhone: document.body.classList.contains('is-real-phone'),
      mode: stage?.dataset?.mode,
      topChrome: unit?.dataset?.topChrome || stage?.dataset?.topChrome,
      hasGltf: document.body.classList.contains('has-gltf-ready'),
      islandDisplay: islandDisp,
      unitW: unit?.getBoundingClientRect().width || 0,
    };
  });
  await p.screenshot({ path: join(outDir, `bp-${name}.png`) });
  await p.close();
  const shelledOk = expect.shelled ? (m.mode === 'shelled' && !m.realPhone) : (m.mode === 'unshelled' && m.realPhone);
  const islandOk = expect.island === undefined ? true : (expect.island ? m.islandDisplay !== 'none' : (m.islandDisplay === 'none' || m.realPhone));
  ok(`bp-${name}`, shelledOk && islandOk, JSON.stringify({ ...m, expect }));
  return m;
}

await checkViewport('desktop', 1400, 950, '?forceShell=1', { shelled: true, waitReady: true, island: true });
await checkViewport('pad-portrait', 768, 1024, '', { shelled: true, waitReady: true });
await checkViewport('pad-landscape', 1024, 768, '', { shelled: true, waitReady: true });
await checkViewport('phone-narrow', 390, 844, '', { shelled: false, waitReady: false, mobileUA: true, island: false });
await checkViewport('forcePhone', 1400, 950, '?forcePhone=1', { shelled: false, waitReady: false, island: false });
await checkViewport('forceShell-narrow', 390, 844, '?forceShell=1', { shelled: true, waitReady: true });

/* Android hole — no island */
const pHole = await browser.newPage();
await pHole.setViewport({ width: 1400, height: 950 });
await pHole.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded' });
await pHole.waitForFunction(() => window.LT_SHELL, { timeout: 20000 }).catch(() => {});
await sleep(2000);
await pHole.evaluate(() => {
  try { localStorage.setItem('lt-palace-shell-model', 'hole'); } catch (_) {}
});
await pHole.reload({ waitUntil: 'domcontentloaded' });
await sleep(2500);
const hole = await pHole.evaluate(() => {
  const unit = document.getElementById('device-unit');
  const island = document.querySelector('.device-island');
  return {
    model: unit?.dataset?.model,
    topChrome: unit?.dataset?.topChrome,
    islandDisplay: island ? getComputedStyle(island).display : 'none',
    holeDisplay: (() => { const h = document.querySelector('.device-hole'); return h ? getComputedStyle(h).display : 'none'; })(),
  };
});
/* After GLTF ready CSS chrome is hidden — check dataset instead */
ok('android-no-island', hole.topChrome === 'hole' || hole.topChrome === 'none' || hole.model === 'hole', JSON.stringify(hole));
await pHole.screenshot({ path: join(outDir, 'bp-android-hole.png') });
await pHole.close();

writeFileSync(join(outDir, 'qa-v10f.json'), JSON.stringify({ results, jump, pending, ready, logs: logs.slice(-40) }, null, 2));
console.log('\n=== SUMMARY ===');
console.log(`PASS ${results.filter(r => r.pass).length}/${results.length}`);
results.filter(r => !r.pass).forEach(r => console.log('FAIL', r.name, r.detail));

await browser.close();
server.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
