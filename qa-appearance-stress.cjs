const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/appearance-stress');
const url=process.env.QA_URL || 'http://127.0.0.1:8877/';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try {
   const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:2});
   const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>requests.push(request.url()));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.LT_MESH && !window.LT_MESH.getState().pending);
   assert.equal(requests.filter(request=>request.endsWith('.glb')).length,1);
   const initial=await page.evaluate(()=>window.LT_MESH.getState());
   assert.equal(initial.pixelRatio,1.5);
   // Explicit controlled 35 ms main-thread contention, not a low-end GPU claim.
   const adaptive=await page.evaluate(()=>new Promise(resolve=>{
     let i=0;
     const frame=()=>{
       window.LT_SHELL.setOrbit(-4,Math.sin(++i/9)*40);
       const until=performance.now()+35;while(performance.now()<until){}
       if(i<55)requestAnimationFrame(frame);
       else {window.LT_SHELL.resetOrbit();resolve(window.LT_MESH.getState());}
     };requestAnimationFrame(frame);
   }));
   assert(adaptive.pixelRatio<1.5 && adaptive.pixelRatio>=1,JSON.stringify(adaptive));
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   await page.locator('#device-unit').focus();
   await page.keyboard.press('ArrowRight');
   assert.equal(await page.evaluate(()=>window.LT_SHELL.getOrbit().rotY),8);
   await page.keyboard.press('Home');
   assert.equal(await page.evaluate(()=>window.LT_SHELL.getOrbit().rotY),0);
   await page.locator('#finish-chip-home').click();
   await page.locator('#finish-popover-home .follow-tone-input').focus();
   await page.keyboard.press('ArrowRight');
   assert.equal(await page.evaluate(()=>window.LT_SHELL.getOrbit().rotY),0,'Native control arrows must not orbit the frame');
   await page.locator('#finish-chip-home').click();
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.mouse.move(100,780);await page.mouse.down();await page.mouse.move(190,800,{steps:10});
   assert(await page.locator('body').evaluate(el=>el.classList.contains('is-shell-orbiting')));
   await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
   await page.mouse.up();
   assert(!(await page.locator('body').evaluate(el=>el.classList.contains('is-shell-orbiting'))));
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>window.LT_SHELL.resetOrbit());
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   await page.mouse.move(100,780);await page.mouse.down();await page.mouse.move(150,800,{steps:5});
   await page.setViewportSize({width:390,height:844});await page.mouse.up();
   await page.waitForFunction(()=>!window.LT_MESH);
   assert(!(await page.locator('body').evaluate(el=>el.classList.contains('is-shell-orbiting'))));
   assert(!(await page.locator('#device-status').isVisible()));
   await page.setViewportSize({width:1440,height:1100});
   await page.waitForFunction(()=>window.LT_MESH&&!window.LT_MESH.getState().pending);
   assert.equal(await page.locator('canvas.device-webgl').count(),1);
   // Move the entire device out of view without altering its content or geometry.
   const spacer=await page.addStyleTag({content:'body { padding-bottom: 1800px !important; }'});
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForFunction(()=>!window.LT_MESH.getState().inView);
   const beforeOffscreen=await page.evaluate(()=>window.LT_MESH.getState().renderCount);
   await page.evaluate(()=>window.LT_SHELL.setOrbit(-7,32));
   await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().renderCount),beforeOffscreen);
   await page.evaluate(()=>scrollTo(0,0));
   await page.waitForFunction(()=>window.LT_MESH.getState().inView&&!window.LT_MESH.getState().pending);
   const projection=await page.evaluate(()=>window.LT_MESH.getProjection());
   const screen=await page.locator('.device-screen').boundingBox();
   assert(Math.abs(projection.aabb.top-screen.y)<.2);
   await spacer.evaluate(el=>el.remove());
   await page.evaluate(()=>window.LT_SHELL.resetOrbit());
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   // Exercise a simulated visibility event without changing the user's tabs.
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   const hiddenFrames=await page.evaluate(()=>window.LT_MESH.getState().renderCount);
   await page.evaluate(()=>window.LT_SHELL.setOrbit(-4,24));
   await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().renderCount),hiddenFrames);
   assert.equal(await page.evaluate(()=>window.LT_STATUS.getState().timers),0);
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   assert.equal(await page.evaluate(()=>window.LT_STATUS.getState().timers),1);
   await page.evaluate(()=>window.LT_SHELL.resetOrbit());
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   // Minute and simulated radio updates must not wake the idle renderer.
   await page.clock.install();
   // Reschedule timers after installing the test clock; pre-existing native
   // timers are intentionally outside Playwright's virtual clock ownership.
   await page.evaluate(()=>{
     Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));
     delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   });
   await page.clock.runFor(50);
   const statusFrames=await page.evaluate(()=>window.LT_MESH.getState().renderCount);
   const statusUpdates=await page.evaluate(()=>window.LT_STATUS.getState().updates);
   await page.clock.runFor(75000);
   assert((await page.evaluate(()=>window.LT_STATUS.getState().updates))>statusUpdates);
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().renderCount),statusFrames);
   await page.screenshot({path:path.join(output,'desktop-status.png')});
   await page.close();

   // Cancel a real pending fetch while crossing the mobile boundary.
   const cancel=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
   cancel.on('pageerror',e=>errors.push(e.message));
   await cancel.goto(url,{waitUntil:'domcontentloaded'});
   await cancel.waitForFunction(()=>window.LT_MESH);
   let release;const gate=new Promise(resolve=>release=resolve);
   await cancel.route('**/galaxy-s26-ultra.*.glb',async route=>{await gate;await route.continue().catch(()=>{});});
   await cancel.locator('#shell-model-btn').click();
   await cancel.locator('.shell-model[data-model="galaxy-s26-ultra"]').click();
   await cancel.waitForFunction(()=>window.LT_MESH.getState().pendingModels===1);
   await cancel.evaluate(()=>window.retiredMesh=window.LT_MESH);
   await cancel.setViewportSize({width:390,height:844});
   await cancel.waitForFunction(()=>!window.LT_MESH);
   release();
   await cancel.waitForFunction(()=>window.retiredMesh.getState().cachedModels===0);
   assert.equal(await cancel.locator('canvas.device-webgl').count(),0);
   assert.equal(await cancel.locator('.device-screen').count(),1);
   assert(!(await cancel.locator('#device-status').isVisible()));
   assert(!(await cancel.locator('#device-unit').getAttribute('aria-busy')));
   await cancel.locator('[data-goto="lesson"]').first().click();
   assert(await cancel.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
   await cancel.setViewportSize({width:1440,height:1100});
   await cancel.waitForFunction(()=>window.LT_MESH);
   assert.equal(await cancel.locator('canvas.device-webgl').count(),1);
   assert.equal(await cancel.locator('.phone-status').count(),1);
   const retired=await cancel.evaluate(()=>window.retiredMesh.getState());
   assert.deepEqual(errors,[]);
   fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({initial,adaptive,offscreenPaused:true,hiddenPaused:'visibility event simulated',statusDoesNotRedraw:true,pointerCancel:true,dragResize:true,pendingDownloadCanceled:true,retired,errors},null,2));
   console.log('PASS: high-DPR adaptation, pointer cancellation/mobile drag reset, offscreen/hidden pause, status without GPU redraw, pending download disposal and single-canvas resize recovery.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
