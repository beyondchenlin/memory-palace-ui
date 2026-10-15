import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';

const root = '/workspace/english-tool-deploys/memory-palace-ui';
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.module.js':'text/javascript' };
const PORT = 8917;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p==='/') p='/index.html';
  const fp = normalize(join(root,p));
  if (!fp.startsWith(root)||!existsSync(fp)||statSync(fp).isDirectory()){res.writeHead(404);res.end('no');return;}
  res.writeHead(200,{'Content-Type':mime[extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(readFileSync(fp));
});
await new Promise(r=>server.listen(PORT,r));
const outDir = join(root,'screenshots','v10f'); mkdirSync(outDir,{recursive:true});
const browser = await puppeteer.launch({ headless:true, executablePath:'/usr/bin/google-chrome',
  args:['--no-sandbox','--disable-setuid-sandbox','--window-size=1400,950','--ignore-gpu-blocklist','--enable-webgl','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'],
  defaultViewport:{width:1400,height:950}});
const page = await browser.newPage();
const sleep = ms => new Promise(r=>setTimeout(r,ms));
await page.goto(`http://127.0.0.1:${PORT}/?forceShell=1`,{waitUntil:'domcontentloaded',timeout:45000});
await page.waitForFunction(()=>document.body.classList.contains('has-gltf-ready'),{timeout:45000});
await sleep(1500);
await page.evaluate(async()=>{ if(window.LT_MESH?.captureNow) await window.LT_MESH.captureNow(); });
await sleep(500);

const diag = await page.evaluate(() => {
  const screens = [...document.querySelectorAll('.device-screen, .device-screen-capture-clone')].map(el => {
    const r = el.getBoundingClientRect();
    return { cls: el.className, tag: el.tagName, l:r.left, t:r.top, w:r.width, h:r.height, pe: getComputedStyle(el).pointerEvents, opacity: getComputedStyle(el).opacity, parent: el.parentElement?.className };
  });
  const overlay = document.querySelector('.device-screen.is-overlay-screen');
  const or = overlay?.getBoundingClientRect();
  let hit = null;
  if (or) {
    const cx = or.left + or.width/2;
    const cy = or.top + or.height * 0.78; // approx CTA zone
    const top = document.elementFromPoint(cx, cy);
    hit = { cx, cy, tag: top?.tagName, cls: top?.className, text: (top?.textContent||'').slice(0,50), closestBtn: top?.closest?.('button')?.className || null, closestGoto: top?.closest?.('[data-goto]')?.dataset?.goto || null };
  }
  const btns = [...document.querySelectorAll('button.cta-primary')].map(b => {
    const r = b.getBoundingClientRect();
    return { l:r.left, t:r.top, w:r.width, h:r.height, inOverlay: !!(overlay && overlay.contains(b)) };
  });
  return {
    overlayMode: window.LT_MESH?.getOverlayMode?.(),
    facing: window.LT_MESH?.isFacingCamera?.(),
    screens, hit, btns,
    home: !!document.querySelector('#screen-home.is-active'),
    lesson: !!document.querySelector('#screen-lesson.is-active'),
  };
});
writeFileSync(join(outDir,'click-diag.json'), JSON.stringify(diag,null,2));
console.log(JSON.stringify(diag,null,2));

if (diag.hit?.cx) {
  await page.mouse.click(diag.hit.cx, diag.hit.cy);
  await sleep(500);
  const after = await page.evaluate(()=>({
    home: !!document.querySelector('#screen-home.is-active'),
    lesson: !!document.querySelector('#screen-lesson.is-active'),
    overlayMode: window.LT_MESH?.getOverlayMode?.(),
  }));
  console.log('AFTER CLICK', after);
  await page.screenshot({path: join(outDir,'diag-after-click.png')});
}

await browser.close(); server.close();
