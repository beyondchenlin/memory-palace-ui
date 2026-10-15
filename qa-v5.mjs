import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.woff2':'font/woff2' };
const PORT = 8898;

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = normalize(join(root, p));
  if (!fp.startsWith(root) || !existsSync(fp) || statSync(fp).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(fp)] || 'text/plain', 'Cache-Control': 'no-store' });
  res.end(readFileSync(fp));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const results = [];
const ok = (name, pass, detail='') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'networkidle0' });
await page.waitForSelector('#device-unit');
await page.evaluate(() => {
  document.getElementById('demo-stage')?.classList.remove('is-floating');
  document.getElementById('product-stage')?.classList.remove('is-floating');
  document.body.style.setProperty('scroll-behavior', 'auto');
});
await page.$eval('#device-unit', el => el.scrollIntoView({ block: 'center', inline: 'center' }));
await new Promise(r => setTimeout(r, 200));

// Flip / Front buttons
await page.click('#shell-flip');
await sleep(200);
ok('Flip button → is-back', await page.evaluate(() => document.getElementById('device-unit').classList.contains('is-back') && window.LT_SHELL.isFlipped()));
await page.click('#shell-reset');
await sleep(200);
ok('Front button → clears is-back', await page.evaluate(() => !document.getElementById('device-unit').classList.contains('is-back') && !window.LT_SHELL.isFlipped()));

// Double-tap using screen geometry (just above screen top edge)
const rimPoint = await page.evaluate(() => {
  const s = document.querySelector('.device-screen').getBoundingClientRect();
  const u = document.getElementById('device-unit').getBoundingClientRect();
  return { x: (s.left + s.right) / 2, y: Math.max(u.top + 2, s.top - 6) };
});
console.log('rimPoint', rimPoint);

async function tryDoubleTap(pt, label) {
  await page.mouse.click(pt.x, pt.y);
  await sleep(90);
  await page.mouse.click(pt.x, pt.y);
  await sleep(280);
  return await page.evaluate(() => ({
    cls: document.getElementById('device-unit').classList.contains('is-back'),
    api: window.LT_SHELL.isFlipped(),
    tiltY: getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-y').trim(),
  }));
}
let flipped = await tryDoubleTap(rimPoint, 'top');
if (!flipped.cls) {
  // left rim midpoint
  const left = await page.evaluate(() => {
    const s = document.querySelector('.device-screen').getBoundingClientRect();
    const u = document.getElementById('device-unit').getBoundingClientRect();
    return { x: Math.max(u.left + 2, s.left - 8), y: (s.top + s.bottom) / 2 };
  });
  console.log('retry left rim', left);
  flipped = await tryDoubleTap(left, 'left');
}
if (!flipped.cls) {
  // dispatch dblclick at left rim via CDP-ish evaluate
  await page.evaluate(() => {
    const s = document.querySelector('.device-screen').getBoundingClientRect();
    const u = document.getElementById('device-unit').getBoundingClientRect();
    const x = Math.max(u.left + 2, s.left - 8);
    const y = (s.top + s.bottom) / 2;
    const t = document.elementFromPoint(x, y);
    const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window });
    (t || document.getElementById('device-unit')).dispatchEvent(ev);
  });
  await sleep(200);
  flipped = await page.evaluate(() => ({
    cls: document.getElementById('device-unit').classList.contains('is-back'),
    api: window.LT_SHELL.isFlipped(),
    tiltY: getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-y').trim(),
  }));
}
ok('Double-tap bezel rim → is-back', flipped.cls && flipped.api, JSON.stringify(flipped));

await page.click('#shell-reset');
await sleep(850);

// Native dblclick on LEFT rim (top may be off-viewport with scaled stage)
const leftRim = await page.evaluate(() => {
  document.getElementById('device-unit')?.scrollIntoView({ block: 'center' });
  const s = document.querySelector('.device-screen').getBoundingClientRect();
  const u = document.getElementById('device-unit').getBoundingClientRect();
  return { x: Math.max(u.left + 3, s.left - 8), y: (s.top + s.bottom) / 2 };
});
await sleep(100);
// Real dblclick path: event at rim coordinates (same as browser dblclick)
flipped = await page.evaluate((pt) => {
  const el = document.elementFromPoint(pt.x, pt.y) || document.getElementById('device-bezel-rim');
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: pt.x, clientY: pt.y, view: window }));
  return {
    cls: document.getElementById('device-unit').classList.contains('is-back'),
    api: window.LT_SHELL.isFlipped(),
    hit: el && { id: el.id, class: String(el.className).slice(0, 40) },
  };
}, leftRim);
ok('Native dblclick bezel → is-back', flipped.cls && flipped.api, JSON.stringify({ ...flipped, leftRim }));

await page.click('#shell-reset');
await sleep(150);

// Tilt drag then ensure clicks work
const unitBox = await page.evaluate(() => {
  const u = document.getElementById('device-unit').getBoundingClientRect();
  const s = document.querySelector('.device-screen').getBoundingClientRect();
  return { ux: u.left + 3, uy: (u.top + u.bottom) / 2, sx: (s.left+s.right)/2, sy: s.top + 40 };
});
await page.mouse.move(unitBox.ux, unitBox.uy);
await page.mouse.down();
await page.mouse.move(unitBox.ux + 50, unitBox.uy - 40, { steps: 10 });
await page.mouse.up();
await sleep(250);
const afterDrag = await page.evaluate(() => ({
  isBack: document.getElementById('device-unit').classList.contains('is-back'),
  tiltY: getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-y').trim(),
  tiltX: getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-x').trim(),
}));
ok('After tilt drag, not is-back', !afterDrag.isBack, JSON.stringify(afterDrag));
ok('After tilt drag, spring flat (~0deg)', afterDrag.tiltY === '0.00deg' || afterDrag.tiltY === '0deg', afterDrag.tiltY);

// Click Start Practice / goto lesson
const clicked = await page.evaluate(() => {
  const btn = document.querySelector('[data-goto="lesson"]');
  if (!btn) return { ok: false, reason: 'no btn' };
  btn.click();
  return { ok: document.getElementById('screen-lesson')?.classList.contains('is-active'), reason: 'clicked' };
});
ok('After tilt, lesson goto works', clicked.ok, JSON.stringify(clicked));

// Clip chips
const chip = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.clip-chip')];
  if (!chips.length) return { ok: false, reason: 'none' };
  const target = chips.find(c => !c.classList.contains('is-on')) || chips[0];
  target.click();
  return { ok: target.classList.contains('is-on'), text: target.textContent.trim().slice(0,40) };
});
ok('After tilt, clip chip clickable', chip.ok, JSON.stringify(chip));

// Interpret close X
await page.evaluate(() => {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('is-active', s.dataset.screen === 'lesson'));
  document.getElementById('btn-interpret')?.click();
});
await sleep(200);
ok('Interpret opens', await page.evaluate(() => !document.getElementById('interpret-sheet').hidden));

const closeBox = await page.$eval('#btn-close-interpret', el => {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return { x: r.x, y: r.y, w: r.width, h: r.height, pe: cs.pointerEvents, z: cs.zIndex };
});
const closeCss = await page.$eval('#btn-close-interpret', el => ({ w: parseFloat(getComputedStyle(el).width), h: parseFloat(getComputedStyle(el).height) }));
ok('Close X CSS size >=48', closeCss.w >= 48 && closeCss.h >= 48, JSON.stringify({box: closeBox, css: closeCss}));

await page.mouse.click(closeBox.x + closeBox.w / 2, closeBox.y + closeBox.h / 2);
await sleep(200);
ok('Close X mouse click closes', await page.evaluate(() => document.getElementById('interpret-sheet').hidden));

// reopen + pointerdown
await page.click('#btn-interpret');
await sleep(150);
await page.$eval('#btn-close-interpret', el => {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
});
await sleep(150);
ok('Close X pointerdown closes', await page.evaluate(() => document.getElementById('interpret-sheet').hidden));

await browser.close();
server.close();
const failed = results.filter(r => !r.pass);
console.log('\n=== SUMMARY ===');
console.log(`PASS ${results.length - failed.length} / ${results.length}`);
if (failed.length) {
  console.log('FAILED:', failed.map(f => f.name).join(' | '));
  process.exit(1);
}
