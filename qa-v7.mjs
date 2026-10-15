import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json',
  '.glb':'model/gltf-binary', '.wasm':'application/wasm',
};
const PORT = 8897;
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

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,950'],
  defaultViewport: { width: 1400, height: 950 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSERR', m.text()); });

const results = [];
const ok = (name, pass, detail='') => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#device-unit');
await sleep(4000); // allow GLB load

ok('has-gltf-chassis class', await page.evaluate(() => document.body.classList.contains('has-gltf-chassis')));
ok('WebGL canvas present', await page.$('.device-webgl') != null);
ok('No DIY slabs in DOM', await page.$$eval('.device-slab', els => els.length) === 0);
ok('LT_MESH exposed', await page.evaluate(() => !!(window.LT_MESH && window.LT_MESH.setRotation)));
ok('GLB chassis id set', await page.evaluate(() => !!(window.LT_MESH && window.LT_MESH.setModelUiId)));

const credit = await page.$eval('#device-credit', el => el.textContent);
ok('CC BY credit visible', /CC BY|MajdyModels|Sketcher|Sketchfab/i.test(credit), credit.slice(0,80));

// Idle sway should stay small (not flip to back)
await page.evaluate(() => window.LT_SHELL.showScreensaver());
await sleep(1200);
const idleFacing = await page.evaluate(() => {
  const r = window.LT_SHELL.getRotation();
  return { ...r, back: window.LT_SHELL.isFlipped() };
});
ok('Idle does not face full back', !idleFacing.back && Math.abs(idleFacing.y) < 25, JSON.stringify(idleFacing));

// Gentle unlock via slight move
await page.mouse.move(200, 200);
await page.mouse.move(230, 210, { steps: 4 });
await sleep(600);
const afterUnlock = await page.evaluate(() => document.getElementById('phone-screensaver')?.hidden);
ok('Slight move unlocks screensaver', afterUnlock === true);

// Drag to back intentionally
await page.evaluate(() => window.LT_SHELL.hideScreensaver());
const outer = await page.evaluate(() => {
  const unit = document.getElementById('device-unit').getBoundingClientRect();
  return { x: unit.right + 50, y: (unit.top + unit.bottom) / 2 };
});
await page.mouse.move(outer.x, outer.y);
await page.mouse.down();
await page.mouse.move(outer.x + 260, outer.y, { steps: 24 });
await page.mouse.up();
await sleep(200);
const back = await page.evaluate(() => ({ flipped: window.LT_SHELL.isFlipped(), rot: window.LT_SHELL.getRotation() }));
ok('User drag can reveal back', back.flipped || Math.abs(back.rot.y) > 90, JSON.stringify(back));

// Lang nowrap
ok('Lang switch nowrap', await page.evaluate(() => {
  const el = document.querySelector('.lang-switch');
  const st = getComputedStyle(el);
  return st.flexWrap === 'nowrap' || st.whiteSpace === 'nowrap';
}));

// Pet no glow bubble
ok('Pet glow bubble hidden', await page.evaluate(() => {
  const b = document.querySelector('.stage-pet-bubble');
  if (!b) return true;
  return getComputedStyle(b).display === 'none';
}));

// Typing strip present & large
ok('Typing strip present', await page.$('.typing-strip') != null);

const failed = results.filter(r => !r.pass);
console.log('\nSUMMARY', results.filter(r=>r.pass).length + '/' + results.length);
await browser.close();
server.close();
process.exit(failed.length ? 1 : 0);
