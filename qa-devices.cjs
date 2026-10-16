const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.QA_OUTPUT || path.join(__dirname, 'screenshots', 'devices');
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.LT_MESH && window.LT_PETS);
    const profiles = await page.evaluate(()=>window.LT_DEVICES.models);
    assert.equal(profiles.length,4);
    await page.locator('#shell-color-btn').click();
    await page.locator('.shell-swatch[data-shell="starlight"]').click();
    await page.keyboard.press('Escape');
    const results=[];
    for (const profile of profiles) {
      await page.locator('#shell-model-btn').click();
      await page.locator(`.shell-model[data-model="${profile.id}"]`).click();
      await page.waitForFunction(id=>window.LT_MESH.getState().model===id,profile.id);
      assert((await page.locator('#shell-name').innerText()).includes(profile.dimensions));
      await page.keyboard.press('Escape');
      const box=await page.locator('#device-unit').boundingBox();
      const dimensions=await page.locator('.device-screen').evaluate(el=>({w:el.clientWidth,h:el.clientHeight,r:getComputedStyle(el).borderRadius}));
      assert(Math.abs(dimensions.h/dimensions.w-profile.aspect)<.003);
      assert(Math.abs(box.width/box.height-profile.mm.width/profile.mm.height)<.0001, JSON.stringify({box, mm:profile.mm}));
      const state=await page.evaluate(()=>window.LT_MESH.getState());
      assert.deepEqual(state.dimensions,profile.mm);
      assert.equal(state.source,'area-is/react-3d-mockups@0.2.0');
      await page.screenshot({path:path.join(output,profile.id+'-front.png')});
      await page.locator('#shell-model-btn').click();
      await page.locator('#shell-flip').click();
      await page.waitForFunction(()=>window.LT_MESH.getState().viewY===180);
      assert(await page.locator('.device-screen').evaluate(el=>el.inert && getComputedStyle(el).visibility==='hidden'));
      await page.keyboard.press('Escape');
      await page.screenshot({path:path.join(output,profile.id+'-back.png')});
      await page.locator('#shell-model-btn').click();
      await page.locator('#shell-reset').click();
      await page.waitForFunction(()=>window.LT_MESH.getState().viewY===0);
      assert(await page.locator('.device-screen').evaluate(el=>!el.inert && getComputedStyle(el).visibility==='visible'));
      await page.keyboard.press('Escape');
      await page.locator('[data-goto="lesson"]').first().click();
      assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
      await page.locator('.tab[data-screen="home"]').click();
      results.push({id:profile.id,mm:profile.mm,width:box.width,height:box.height,cssScreen:dimensions,source:state.source,pxPerMm:box.width/profile.mm.width});
    }
    const scale=results[0].pxPerMm;
    assert(results.every(result=>Math.abs(result.pxPerMm-scale)<.001),JSON.stringify({message:'Switching must preserve a shared physical scale within CSS subpixel rounding',results}));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.LT_MESH?.getState().model==='galaxy-s26');
    // Reproduce the user's older i18n cache alongside the new palette/controller.
    const stale = await browser.newPage({viewport:{width:1440,height:1100}});
    stale.on('pageerror',e=>errors.push(e.message));
    await stale.route('**/js/i18n.js*',async route=>{
      const response=await route.fetch();
      const body=(await response.text()).replace(/,\s*"pure-black": \{ mood: "[^"]*", hint: "[^"]*" \}/g,'');
      await route.fulfill({response,body});
    });
    await stale.goto(process.env.QA_URL || 'http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
    await stale.waitForFunction(()=>window.LT_SHELL && window.LT_MESH);
    await stale.locator('#shell-model-btn').click();
    assert(await stale.locator('#shell-model-panel').isVisible());
    await stale.locator('#shell-color-btn').click();
    assert(await stale.locator('#shell-color-panel').isVisible());
    assert.equal(await stale.locator('.shell-swatch').count(),11);
    await stale.close();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'devices.json'),JSON.stringify({results,errors},null,2));
    console.log('PASS: 4 physical dimensions, shared scale, screen aspect ratios, distinct camera modules, front/back, live lesson clicks and reload.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
