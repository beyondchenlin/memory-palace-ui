const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.QA_OUTPUT || path.join(__dirname, 'screenshots', 'live-3d');
const base = process.env.QA_URL || 'http://127.0.0.1:8877/';
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true,
    args: process.env.QA_RESOLVE_VERCEL ? ['--host-resolver-rules=MAP *.vercel.app 76.76.21.21'] : [] });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    const errors = [], failures = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) failures.push(r.url()); });
    page.on('request', r => requests.push(r.url()));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.LT_MESH && window.LT_PETS);
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 4000))]));
    await page.waitForTimeout(350);
    if (!process.env.QA_RESILIENCE_ONLY) {
    assert.equal(await page.locator('#phone').count(), 1);
    assert.equal(await page.locator('.phone-status').count(), 1);
    assert.equal(await page.locator('.device-screen-capture-host').count(), 0);
    assert(!requests.some(url => /\.glb|html-to-image/.test(url)));
    const originalContent = await page.locator('#phone').innerHTML();
    const front = await page.locator('.device-screen').boundingBox();
    await page.locator('#shell-model-btn').click();
    const open = await page.locator('.device-screen').boundingBox();
    assert(Math.abs(open.y - front.y) <= 1.5, 'Reference overlay drawer must not move the phone: ' + JSON.stringify({front, open, state: await page.evaluate(() => window.LT_MESH.getState())}));
    assert.equal(await page.locator('#shell-models .shell-model').count(), 4);
    await page.locator('#shell-model-btn').click();
    results.push('One live screen; no duplicate status bar, screenshot clone, model or texture download; reference overlay drawers');

    for (const model of ['island', 'notch', 'hole', 'clean']) {
      await page.locator('#shell-model-btn').click();
      await page.locator('.shell-model[data-model="' + model + '"]').click();
      await page.waitForFunction(m => window.LT_MESH.getState().model === m, model);
      assert.equal(await page.locator('.device-screen').getAttribute('data-model'), model);
      assert.equal(await page.locator('#phone').innerHTML(), originalContent);
    }
    assert.equal(await page.locator('.shell-swatch').count(), 10);
    for (const finish of ['cobalt', 'amethyst', 'pearl', 'sterling']) {
      await page.locator('#shell-color-btn').click();
      await page.locator('.shell-swatch[data-shell="' + finish + '"]').click();
      await page.waitForFunction(id => window.LT_MESH.getState().finish === id, finish);
      assert.equal(await page.locator('#device-unit').getAttribute('data-shell'), finish);
    }
    results.push('All four actual 3D silhouettes and ten reference color choices; shell, tone, background and pet stay linked');
    await page.evaluate(() => window.LT_SHELL.setOrbit(-8, 32));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'after-3d-angle.png') });
    const projection = await page.evaluate(() => window.LT_MESH.getProjection());
    const tilted = await page.locator('.device-screen').boundingBox();
    assert(Math.abs(tilted.x - projection.aabb.left) < 0.1);
    assert(Math.abs(tilted.y - projection.aabb.top) < 0.1);
    assert(Math.abs(tilted.width - projection.aabb.width) < 0.1);
    assert.equal(await page.locator('.device-screen').evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
    await page.locator('[data-goto="lesson"]').first().click();
    assert(await page.locator('#screen-lesson').evaluate(el => el.classList.contains('is-active')));
    await page.locator('#btn-interpret').click();
    assert(await page.locator('#interpret-sheet').isVisible());
    await page.locator('#btn-close-interpret').click();
    assert(await page.locator('#interpret-sheet').isHidden());
    await page.locator('#btn-check').click();
    assert(await page.locator('#interpret-sheet').isVisible());
    await page.locator('#btn-sheet-next').click();
    assert(await page.locator('#screen-settle').evaluate(el => el.classList.contains('is-active')));
    await page.locator('.tab[data-screen="palace"]').click();
    assert(await page.locator('#screen-palace').evaluate(el => el.classList.contains('is-active')));
    await page.locator('.tab[data-screen="home"]').click();
    await page.locator('[data-locale="zh"]').click();
    assert((await page.locator('html').getAttribute('lang')).startsWith('zh'));
    results.push('Tilted screen tracks the exact projected quad; lesson, interpretation open/close, check, settle, palace and locale work by actual clicks');

    await page.evaluate(() => window.LT_SHELL.setOrbit(999, -999));
    await page.waitForTimeout(700);
    const orbit = await page.evaluate(() => window.LT_SHELL.getOrbit());
    assert.equal(orbit.rotY, -80); assert.equal(orbit.rotX, 68);
    await page.evaluate(() => window.LT_SHELL.resetOrbit());
    await page.waitForTimeout(700);
    await page.mouse.move(210, 650); await page.mouse.down();
    await page.mouse.move(310, 670, { steps: 15 }); await page.mouse.up();
    await page.waitForTimeout(400);
    assert(Math.abs((await page.evaluate(() => window.LT_SHELL.getOrbit())).rotY) > 10);
    await page.mouse.dblclick(210, 650);
    await page.waitForTimeout(700);
    assert.equal((await page.evaluate(() => window.LT_SHELL.getOrbit())).rotY, 0);
    await page.screenshot({ path: path.join(output, 'after-front.png') });
    assert.equal((await page.evaluate(() => window.LT_MESH.getState())).pending, false, 'Idle renderer should stop');
    results.push('Real pointer drag, double-click reset, yaw/pitch limits and demand rendering at rest');

    for (const width of [768, 541, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(400);
      if (width <= 540) {
        assert.equal(await page.locator('canvas.device-webgl').count(), 0);
        assert(await page.locator('body').evaluate(el => el.classList.contains('is-real-phone')));
        assert.equal(await page.locator('.device-screen').evaluate(el => el.parentElement.className), 'device-bezel');
        if (await page.locator('#screen-lesson').evaluate(el => el.classList.contains('is-active'))) {
          await page.locator('#screen-lesson [data-goto="home"]').click();
        }
        await page.locator('#screen-home [data-goto="lesson"]').click();
        assert(await page.locator('#screen-lesson').evaluate(el => el.classList.contains('is-active')));
        if (width === 390) await page.screenshot({ path: path.join(output, 'after-mobile.png') });
      } else {
        await page.waitForFunction(() => !!window.LT_MESH);
        assert.equal(await page.locator('canvas.device-webgl').count(), 1);
        const box = await page.locator('.device-screen').boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width, JSON.stringify({ width, box }));
      }
    }
    await page.locator('.tab[data-screen="home"]').click();
    await page.evaluate(() => { window.LT_SHELL.applyShell('sterling'); window.LT_SHELL.setOrbit(-6, 36); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(output, 'after-3d-angle-zh.png') });
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(200);
    const scrollProjection = await page.evaluate(() => window.LT_MESH.getProjection());
    const scrollBox = await page.locator('.device-screen').boundingBox();
    assert(Math.abs(scrollProjection.aabb.top - scrollBox.y) < 0.15);
    results.push('Tablet, 541 px boundary, phone full-screen with no WebGL, resize back to desktop and scroll alignment');
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileRequests = [];
    mobile.on('request', request => mobileRequests.push(request.url()));
    await mobile.goto(base, { waitUntil: 'domcontentloaded' });
    await mobile.waitForFunction(() => window.LT_SHELL && document.body.classList.contains('is-real-phone'));
    assert(!mobileRequests.some(url => /three\.module|device-live-mesh|\.glb/.test(url)));
    await mobile.close();
    const fallback = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await fallback.emulateMedia({ reducedMotion: 'reduce' });
    await fallback.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return type.startsWith('webgl') ? null : getContext.call(this, type, ...args);
      };
    });
    await fallback.goto(base, { waitUntil: 'domcontentloaded' });
    await fallback.waitForFunction(() => window.LT_SHELL && window.LT_PETS);
    await fallback.waitForTimeout(500);
    assert.equal(await fallback.locator('canvas.device-webgl').count(), 0);
    await fallback.locator('#screen-home [data-goto="lesson"]').click();
    assert(await fallback.locator('#screen-lesson').evaluate(el => el.classList.contains('is-active')));
    await fallback.close();
    await page.evaluate(() => document.querySelector('canvas.device-webgl').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(() => !window.LT_MESH);
    assert.equal(await page.locator('canvas.device-webgl').count(), 0);
    assert.equal(await page.locator('.device-screen').evaluate(el => el.parentElement.className), 'device-bezel');
    results.push('Cold mobile load skips the entire 3D runtime; unavailable WebGL and lost context both fall back to the working reference shell');

    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    const summary = { base, results, errors, failures };
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

