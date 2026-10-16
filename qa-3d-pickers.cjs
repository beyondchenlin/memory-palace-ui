const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.PICKER_QA_OUTPUT || path.join(__dirname, 'screenshots', '3d-pickers');
const baseURL = process.env.PICKER_QA_URL || 'http://127.0.0.1:8877/';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const proxyUrl = baseURL.startsWith('https:') && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY);
  const proxy = proxyUrl ? new URL(proxyUrl) : null;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined,
    proxy: proxy ? { server: proxy.origin, username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password), bypass: '127.0.0.1,localhost' } : undefined,
    args: ['--disable-http2', ...(process.env.QA_RESOLVE_VERCEL && !proxy ? ['--host-resolver-rules=MAP *.vercel.app 76.76.21.21'] : [])], headless: true });
  const results = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.LT_SHELL && window.LT_PETS && window.LT_MESH);
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 4000))]));
    const phoneBefore = await page.locator('.device-rig').boundingBox();
    const notesBefore = await page.locator('.notes').boundingBox();
    const motion = await page.evaluate(() => new Promise(resolve => {
      const samples = [];
      const start = performance.now();
      document.getElementById('shell-model-btn').click();
      function frame() {
        const dock = document.getElementById('shell-picker-dock').getBoundingClientRect();
        const phone = document.getElementById('device-unit').getBoundingClientRect();
        const panel = document.getElementById('shell-model-panel').getBoundingClientRect();
        const liveScreen = document.querySelector('.device-screen').getBoundingClientRect();
        samples.push({ height: dock.height, gap: phone.top - Math.min(dock.bottom, panel.bottom), screenOffset: liveScreen.top - phone.top });
        if (performance.now() - start < 430) requestAnimationFrame(() => setTimeout(frame, 0));
        else resolve(samples);
      }
      requestAnimationFrame(frame);
    }));
    assert(motion.some(sample => sample.height > 5 && sample.height < 120));
    assert(motion.every(sample => sample.gap >= 0));
    assert(motion.every(sample => Math.abs(sample.screenOffset - motion[0].screenOffset) < 1), JSON.stringify(motion));
    assert.equal(await page.locator('#shell-models svg.picker-phone').count(), 4);
    assert.equal(await page.locator('#shell-models [role="radio"]').count(), 4);
    const phoneOpen = await page.locator('.device-rig').boundingBox();
    const notesOpen = await page.locator('.notes').boundingBox();
    assert(phoneOpen.y - phoneBefore.y > 100);
    assert(Math.abs((notesOpen.y - notesBefore.y) - (phoneOpen.y - phoneBefore.y)) < 1);
    assert.equal(phoneOpen.x, phoneBefore.x);
    const strip = await page.locator('#shell-model-panel').boundingBox();
    const header = await page.locator('.stage-bar').boundingBox();
    assert.equal(strip.width, header.width);
    assert(Math.abs(strip.x - header.x) < 1);
    assert(strip.height < 135);
    const modelRows = await page.locator('#shell-models .shell-model').evaluateAll(items => items.map(el => el.getBoundingClientRect().top));
    assert(modelRows.every(y => Math.abs(y - modelRows[0]) < 1));
    await page.screenshot({ path: path.join(output, 'models.png') });
    await page.locator('[data-model="hole"].shell-model').click();
    await page.waitForFunction(() => window.LT_MESH.getState().model === 'hole');
    assert.equal(await page.locator('#device-unit').getAttribute('data-model'), 'hole');
    assert.equal(await page.locator('#shell-model-panel').getAttribute('class'), 'shell-dd-panel is-open');
    assert.equal(await page.locator('#shell-mini').getAttribute('data-model'), 'hole');
    await page.locator('#shell-color-btn').click();
    await page.waitForTimeout(350);
    assert(await page.locator('#shell-model-panel').evaluate(el => el.hidden));
    const colorGrid = await page.locator('#shell-swatches').evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, columns: getComputedStyle(el).gridTemplateColumns.split(' ').length }));
    assert.equal(colorGrid.client, colorGrid.scroll);
    assert.equal(colorGrid.columns, 10);
    for (const id of ['cobalt', 'pearl', 'amethyst']) {
      await page.locator('.shell-swatch[data-shell="' + id + '"]').click();
      await page.waitForFunction(finish => window.LT_MESH.getState().finish === finish, id);
      assert.equal(await page.locator('#device-unit').getAttribute('data-shell'), id);
      assert.equal(await page.locator('.shell-swatch[aria-checked="true"]').getAttribute('data-shell'), id);
    }
    assert.equal(await page.locator('html').getAttribute('data-finish'), 'violet-night');
    await page.waitForTimeout(280);
    await page.screenshot({ path: path.join(output, 'colors.png') });
    await page.locator('.shell-swatch[aria-checked="true"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('.shell-swatch[aria-checked="true"]').getAttribute('data-shell'), 'graphite');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(340);
    assert(await page.locator('#shell-color-panel').evaluate(el => el.hidden));
    assert.equal(await page.locator('#shell-picker-dock').evaluate(el => el.getBoundingClientRect().height), 0);
    const phoneReturned = await page.locator('.device-rig').boundingBox();
    assert(Math.abs(phoneReturned.y - phoneBefore.y) <= 1.5, JSON.stringify({ phoneBefore, phoneReturned }));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'shell-color-btn');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.shell), 'graphite');
    await page.keyboard.press('End');
    assert.equal(await page.locator('.shell-swatch[aria-checked="true"]').getAttribute('data-shell'), 'sand');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(180);
    for (const width of [768, 600, 541, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const kind of ['model', 'color']) {
        await page.locator('#shell-' + kind + '-btn').click();
        await page.waitForTimeout(280);
        const panel = page.locator('#shell-' + kind + '-panel');
        const rect = await panel.boundingBox();
        assert(rect.x >= 0 && rect.x + rect.width <= width, JSON.stringify({ width, kind, rect }));
        assert(rect.height < 150);
        assert(await panel.evaluate(el => el.scrollWidth === el.clientWidth));
        if (width === 541) {
          await panel.locator('[aria-checked="true"]').focus();
          await page.keyboard.press('End');
          await page.waitForTimeout(450);
          assert(await panel.locator('[role="radiogroup"]').evaluate(el => el.scrollLeft > 0));
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(160);
      }
    }
    results.push('Full-width single-row strips, animated phone/notes movement down and back, no phone overlap throughout opening, narrow-screen horizontal scroll, keyboard selection and Escape focus return');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('[data-locale="zh"]').click();
    await page.locator('#shell-model-btn').click();
    assert.equal(await page.locator('#shell-model-title').innerText(), '设备外壳');
    assert.equal(await page.locator('.shell-model[data-model="hole"] .shell-model-copy > span').innerText(), '居中挖孔屏');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(160);
    // Stop the existing floating phone while measuring its internal controls.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#finish-chip-home').click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(output, 'tone-pets.png') });
    const centers = await page.locator('#finish-grid-home .finish-swatch').evaluateAll(items => items.map(el => {
      const circle = el.querySelector('.sw').getBoundingClientRect();
      const pet = el.querySelector('.swatch-pet').getBoundingClientRect();
      return { insideCircle: el.querySelector('.swatch-pet').parentElement === el.querySelector('.sw'), dx: Math.abs(pet.x + pet.width / 2 - circle.x - circle.width / 2), dy: Math.abs(pet.y + pet.height / 2 - circle.y - circle.height / 2) };
    }));
    assert.equal(centers.length, 10);
    assert(centers.every(item => item.insideCircle && item.dx < 1 && item.dy < 1));
    await page.locator('#finish-grid-home [data-finish="sierra-blue"]').click();
    assert.equal(await page.locator('#device-unit').getAttribute('data-shell'), 'glacier');
    await page.locator('[data-goto="lesson"]').first().click();
    await page.locator('#finish-chip-lesson').click();
    assert.equal(await page.locator('#finish-grid-lesson .sw > .swatch-pet').count(), 10);
    results.push('Chinese localization, all ten pets centered, home/lesson pickers and reverse tone-to-shell linkage');
    await page.locator('[data-screen="home"].tab').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#shell-model-btn').click();
    assert.equal(await page.locator('#shell-model-panel').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) document.getElementById(i % 2 ? 'shell-color-btn' : 'shell-model-btn').click();
    });
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.shell-dd-panel.is-open').count(), 1);
    assert.equal(await page.locator('#shell-color-panel').evaluate(el => el.hidden), false);
    await page.locator('.brand').click();
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.shell-dd-panel:not([hidden])').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.shell-compact').isVisible(), false);
    assert.equal(await page.locator('.device-island').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    results.push('Reduced motion, rapid open/switch/close, outside dismissal, real-phone full screen, zero JavaScript errors');
    console.log(JSON.stringify({ baseURL, results, petCenters: centers }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

