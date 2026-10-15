import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json' };
const PORT = 8899;

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
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,950'],
  defaultViewport: { width: 1400, height: 950 },
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
});
await sleep(200);

// Structure
ok('Thick 3D slabs present', await page.$$eval('.device-slab', els => els.length) >= 9);
ok('Side walls present', await page.$$eval('.device-wall', els => els.length) >= 4);
ok('Back face has camera', await page.$('.device-face-back .device-cam') != null);
ok('Top has SVG frames', await page.$$eval('.shell-model-svg', els => els.length) >= 4);
ok('Colors in TOP rail', await page.$('.shell-rail-top #shell-swatches') != null);
ok('Bottom is typing strip (no swatches)', await page.evaluate(() => {
  const bottom = document.querySelector('.shell-rail-bottom');
  return !!bottom?.querySelector('.typing-strip') && !bottom?.querySelector('#shell-swatches');
}));
ok('No demo lab copy', await page.evaluate(() => !document.body.innerText.includes('视觉决策预览')));

// Outer drag rotates
const before = await page.evaluate(() => getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-y').trim());
const outer = await page.evaluate(() => {
  const rig = document.getElementById('device-rig').getBoundingClientRect();
  const unit = document.getElementById('device-unit').getBoundingClientRect();
  return { x: Math.min(rig.right - 20, unit.right + 40), y: (rig.top + rig.bottom) / 2 };
});
await page.mouse.move(outer.x, outer.y);
await page.mouse.down();
await page.mouse.move(outer.x + 120, outer.y - 30, { steps: 12 });
await page.mouse.up();
await sleep(150);
const after = await page.evaluate(() => ({
  y: getComputedStyle(document.getElementById('device-unit')).getPropertyValue('--shell-tilt-y').trim(),
  rot: window.LT_SHELL.getRotation(),
}));
ok('Outer drag rotates phone', Math.abs(after.rot.y) > 5 || after.y !== before, `y=${after.y} rot=${JSON.stringify(after.rot)}`);

// Double-click outside resets
await page.mouse.click(outer.x, outer.y, { clickCount: 2, delay: 60 });
await sleep(450);
const reset = await page.evaluate(() => window.LT_SHELL.getRotation());
ok('Outer dblclick resets to flat', Math.abs(reset.x) < 0.5 && Math.abs(reset.y) < 0.5, JSON.stringify(reset));

// Color links SVG + shell + page wash
await page.click('.shell-swatch[data-shell="cobalt"]');
await sleep(120);
const linked = await page.evaluate(() => {
  const unit = document.getElementById('device-unit');
  const wash = getComputedStyle(document.documentElement).getPropertyValue('--page-wash').trim();
  const modelColor = getComputedStyle(document.querySelector('.shell-model')).color;
  return {
    shell: unit.dataset.shell,
    wash,
    hasWash: !!wash,
    svgColored: modelColor.length > 0,
  };
});
ok('Color sets shell finish', linked.shell === 'cobalt', linked.shell);
ok('Page wash tint set', linked.hasWash && linked.wash.length > 0, linked.wash);

// Mascot animal centered
const mascot = await page.evaluate(() => {
  const btn = document.querySelector('.mascot-btn');
  const pet = btn?.querySelector('.mascot-pet');
  if (!btn || !pet) return { ok: false };
  const br = btn.getBoundingClientRect();
  const pr = pet.getBoundingClientRect();
  const cx = Math.abs((pr.left + pr.right) / 2 - (br.left + br.right) / 2);
  const cy = Math.abs((pr.top + pr.bottom) / 2 - (br.top + br.bottom) / 2);
  return { ok: true, cx, cy, hasClass: btn.classList.contains('has-centered-pet'), text: pet.textContent };
});
ok('Mascot animal centered in circle', mascot.ok && mascot.hasClass && mascot.cx < 8 && mascot.cy < 8, JSON.stringify(mascot));

// Stage pet near bottom-right, no roam timer
const pet = await page.evaluate(() => {
  const el = document.getElementById('stage-pet');
  if (!el || el.hidden) return { ok: false };
  const st = getComputedStyle(el);
  return { ok: true, left: el.style.left, top: el.style.top, pos: st.position };
});
ok('Stage pet present (absolute, parked)', pet.ok && pet.pos === 'absolute', JSON.stringify(pet));

// Screensaver logo + shake path
await page.evaluate(() => window.LT_SHELL.showScreensaver());
await sleep(200);
ok('Screensaver shows logo', await page.evaluate(() => {
  const ss = document.getElementById('phone-screensaver');
  return ss && !ss.hidden && !!ss.querySelector('.ss-logo');
}));
ok('Showcase orbit class/anim', await page.evaluate(() => document.getElementById('device-unit').classList.contains('is-orbiting')));
// Simulate shake
await page.mouse.move(200, 200);
for (let i = 0; i < 10; i++) {
  await page.mouse.move(200 + (i % 2 ? 80 : -80), 200 + (i % 2 ? 40 : -40));
}
await sleep(200);
ok('Shake unlocks (no PIN)', await page.evaluate(() => document.getElementById('phone-screensaver').hidden));

// forcePhone unshelled
await page.goto(`http://127.0.0.1:${PORT}/?forcePhone=1`, { waitUntil: 'networkidle0' });
await sleep(200);
ok('forcePhone unshelled', await page.evaluate(() => document.body.classList.contains('is-real-phone')));
ok('forcePhone hides shell rails', await page.evaluate(() => {
  const rail = document.querySelector('.shell-rail-top');
  return !rail || getComputedStyle(rail).display === 'none';
}));
ok('forcePhone no stage pet', await page.evaluate(() => {
  const el = document.getElementById('stage-pet');
  return !el || el.hidden || getComputedStyle(el).display === 'none';
}));

const failed = results.filter(r => !r.pass);
console.log('\n==== SUMMARY', results.filter(r=>r.pass).length + '/' + results.length, 'PASS ====');
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
