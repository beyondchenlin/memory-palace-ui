const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.QA_OUTPUT || path.join(__dirname, 'screenshots', 'palette');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1240 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:8877/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.LT_MESH && window.LT_PETS);
    const palette = await page.evaluate(() => window.LT_PALACE.FINISH_IDS);
    async function comparePalettes() {
      const choices = await page.evaluate(() => {
        const tone = [...document.querySelectorAll('#finish-grid-home .finish-swatch')];
        return [...document.querySelectorAll('.shell-swatch')].map((button, index) => ({
          id: button.dataset.shell,
          toneId: tone[index].dataset.finish,
          name: button.querySelector('.shell-swatch-name').textContent,
          toneName: tone[index].lastElementChild.textContent,
          color: getComputedStyle(button.querySelector('.shell-swatch-orb')).backgroundColor,
          toneColor: getComputedStyle(tone[index].querySelector('.sw')).backgroundColor,
          pet: button.querySelector('.swatch-pet').dataset.pet,
          tonePet: tone[index].querySelector('.swatch-pet').dataset.pet,
          vector: !!button.querySelector('.pet-art'),
        }));
      });
      assert.equal(choices.length, 11);
      assert.deepEqual(choices.map(choice => choice.id), palette.map(choice => choice.id));
      for (const choice of choices) {
        assert.equal(choice.id, choice.toneId);
        assert.equal(choice.name, choice.toneName);
        assert.equal(choice.color, choice.toneColor);
        assert.equal(choice.pet, choice.tonePet);
      }
      return choices;
    }
    const choices = await comparePalettes();
    const pets={duolingo:'frog','violet-night':'octopus','space-gold':'chick','space-blue':'dolphin','product-red':'crab','sierra-blue':'whale',purple:'butterfly',midnight:'raccoon',starlight:'bunny','natural-titanium':'hedgehog','pure-black':'panda'};
    for(const choice of choices){
      assert.equal(choice.pet,pets[choice.id]);
      assert.equal(choice.vector,['violet-night','purple','product-red'].includes(choice.id));
    }
    await page.locator('#shell-color-btn').click();
    await page.locator('.shell-swatch[data-shell="pure-black"]').click();
    await page.waitForFunction(() => window.LT_MESH.getState().color === '#101114');
    for (const { id, swatch } of palette) {
      await page.locator(`.shell-swatch[data-shell="${id}"]`).click();
      await page.waitForFunction(({ id, swatch }) => {
        const state = window.LT_MESH.getState();
        return state.finish === id && state.color === swatch && state.targetColor === swatch;
      }, { id, swatch });
      assert.equal(await page.locator('html').getAttribute('data-finish'), id);
      assert.equal(await page.locator('#finish-grid-home .is-on').getAttribute('data-finish'), id);
      assert.equal(await page.locator('#shell-color-name').innerText(), choices.find(choice => choice.id === id).name);
      assert.equal(await page.locator('.stage-pet-emoji').getAttribute('data-pet'),pets[id]);
      assert.equal(await page.locator('#mascot-home .mascot-pet-glyph').getAttribute('data-pet'),pets[id]);
    }
    await page.keyboard.press('Escape');
    for (const { id } of palette) {
      await page.locator('#finish-chip-home').click();
      await page.locator(`#finish-grid-home [data-finish="${id}"]`).click();
      await page.waitForFunction(id => window.LT_MESH.getState().finish === id, id);
      assert.equal(await page.locator('.shell-swatch[aria-checked="true"]').getAttribute('data-shell'), id);
    }
    // Preserve the selected tone across reload; legacy shell IDs must not replace it.
    await page.evaluate(() => {
      window.LT_PALACE.applyFinish('purple');
      localStorage.setItem('lt-palace-shell', 'amethyst');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.LT_MESH?.getState().finish === 'purple');
    await comparePalettes();
    for (const lang of ['zh', 'ja', 'es', 'ko', 'en']) {
      await page.locator(`.lang-switch [data-locale="${lang}"]`).click();
      await comparePalettes();
    }
    await page.locator('#shell-color-btn').click();
    await page.locator('.shell-swatch[data-shell="pure-black"]').click();
    await page.waitForFunction(() => window.LT_MESH.getState().color === '#101114');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(output, 'unified-shell-colors.png') });
    await page.keyboard.press('Escape');
    await page.locator('#finish-chip-home').click();
    await page.waitForFunction(() => {
      const popover = document.getElementById('finish-popover-home');
      return popover.classList.contains('is-open') && Number(getComputedStyle(popover).opacity) === 1;
    });
    await page.screenshot({ path: path.join(output, 'matching-tone-colors.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ choices, checked: ['11 exact colors, names, pets and order including black', 'all colors in both directions', '3D actual and target material colors', 'five locales', 'reload with legacy storage'], errors }, null, 2));
    console.log('PASS: all 11 colors including black, names, pets, order, bidirectional selection, 3D materials, five locales and reload.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
