const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/milestone-review');
const url=process.env.QA_URL || 'http://127.0.0.1:8877/';
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
  const results=[],errors=[];
  async function test(name,run,setup){
    const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
    page.on('pageerror',error=>errors.push(error.message));
    try{
      if(setup) await setup(page);
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.LT_MESH&&window.LT_PETS);
      await run(page);results.push({name,passed:true});
    }catch(error){
      results.push({name,passed:false,error:error.message});
      await page.screenshot({path:path.join(output,name+'.png')});
    }finally{await page.close();}
  }
  try{
    await test('orbit-pointer-capture',async page=>{
      await page.evaluate(()=>document.addEventListener('pointerdown',event=>{
        window.orbitPointer={id:event.pointerId,target:event.target};
      },{once:true}));
      await page.mouse.move(100,780);await page.mouse.down();
      assert(await page.evaluate(()=>document.body.classList.contains('is-shell-orbiting')));
      assert(await page.evaluate(()=>window.orbitPointer.target.hasPointerCapture(window.orbitPointer.id)),
        'The element starting orbit must capture the pointer');
      await page.mouse.move(-20,760);await page.mouse.up();
      assert(!(await page.evaluate(()=>document.body.classList.contains('is-shell-orbiting'))));
      await page.locator('#shell-model-btn').click();
      assert(await page.locator('#shell-model-panel').isVisible());
    });
    await test('pet-screen-expanded-state',async page=>{
      for(const screen of ['palace','settle','lesson','home']){
        await page.locator('.tab[data-screen="'+screen+'"]').click();
        await page.locator('#stage-pet').click();
        const target=screen==='lesson'?'lesson':'home';
        await page.locator('#finish-popover-'+target).waitFor({state:'visible'});
        assert.equal(await page.locator('#finish-chip-'+target).getAttribute('aria-expanded'),'true');
        assert.equal(await page.locator('#mascot-'+target).getAttribute('aria-expanded'),'true');
        await page.locator('#finish-chip-'+target).click();
      }
    });
    await test('pet-cancel-next-click',async page=>{
      const pet=page.locator('#stage-pet'),box=await pet.boundingBox();
      await page.mouse.move(box.x+32,box.y+32);await page.mouse.down();
      await page.mouse.move(120,500,{steps:8});
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await page.mouse.up();
      await pet.click();
      assert(await page.locator('#finish-popover-home').isVisible(),
        'The first intentional click after a canceled drag must open the tone picker');
    });
    await test('pet-cancel-keyboard',async page=>{
      const pet=page.locator('#stage-pet'),box=await pet.boundingBox();
      await page.mouse.move(box.x+32,box.y+32);await page.mouse.down();
      await page.mouse.move(120,500,{steps:8});
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await page.mouse.up();await pet.focus();await page.keyboard.press('Enter');
      assert(await page.locator('#finish-popover-home').isVisible(),
        'Keyboard activation must work immediately after a canceled drag');
    });
    await test('orbit-secondary-and-hidden',async page=>{
      await page.mouse.move(100,780);await page.mouse.down();
      await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointerdown',{
        bubbles:true,pointerId:9,isPrimary:false,button:0,buttons:1,clientX:100,clientY:780,
      })));
      await page.mouse.move(150,760);await page.mouse.up();
      assert(!(await page.evaluate(()=>document.body.classList.contains('is-shell-orbiting'))));
      await page.mouse.move(100,780);await page.mouse.down();await page.mouse.move(140,760);
      await page.evaluate(()=>{
        Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert(!(await page.evaluate(()=>document.body.classList.contains('is-shell-orbiting'))));
      await page.mouse.up();
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    });
    await test('navigation-selection-semantics',async page=>{
      for(const locale of ['en','zh','ja','es','ko']){
        await page.locator('[data-locale="'+locale+'"]').click();
        assert.equal(await page.locator('.lang-switch [aria-pressed="true"]').count(),1);
        assert.equal(await page.locator('.lang-switch [aria-pressed="true"]').getAttribute('data-locale'),locale);
      }
      for(const screen of ['lesson','palace','settle','home']){
        await page.locator('.screen-tabs [data-screen="'+screen+'"]').click();
        assert.equal(await page.locator('.screen-tabs [aria-current="page"]').getAttribute('data-screen'),screen);
        assert(await page.locator('#screen-'+screen).isVisible());
      }
      assert.equal(await page.locator('.screen-tabs[role="tablist"]').count(),0);
    });
    await test('storage-unavailable',async page=>{
      await page.locator('#shell-color-btn').click();
      await page.locator('.shell-swatch[data-shell="pure-black"]').click();await page.keyboard.press('Escape');
      await page.waitForFunction(()=>window.LT_MESH.getState().finish==='pure-black');
      await page.locator('[data-locale="zh"]').click();
      assert((await page.locator('html').getAttribute('lang')).startsWith('zh'));
      await page.locator('.tab[data-screen="lesson"]').click();assert(await page.locator('#screen-lesson').isVisible());
    },page=>page.addInitScript(()=>Object.defineProperty(window,'localStorage',{
      configurable:true,get(){throw new DOMException('Storage unavailable','SecurityError');},
    })));
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({results,errors},null,2));
    console.log(JSON.stringify({results,errors}));
    assert(results.every(result=>result.passed));assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
