const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/mobile-status');
const url=process.env.QA_URL || 'http://127.0.0.1:8877/';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try {
   const results=[];
   for(const viewport of [{width:390,height:844},{width:844,height:390}]){
     const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:3});
     try{
       const page=await context.newPage();const requests=[],errors=[];
       page.on('request',request=>requests.push(request.url()));page.on('pageerror',e=>errors.push(e.message));
       await page.goto(url,{waitUntil:'domcontentloaded'});
       await page.waitForFunction(()=>window.LT_STATUS);
       assert(await page.locator('body').evaluate(el=>el.classList.contains('is-real-phone')));
       assert(!(await page.locator('#device-status').isVisible()));
       assert.equal(await page.evaluate(()=>window.LT_STATUS.getState().timers),0);
       assert(!requests.some(request=>/three\.module|device-live-mesh|\.glb|original-studio/.test(request)));
       assert.equal(await page.locator('#device-unit').getAttribute('tabindex'),'-1');
       await page.locator('[data-goto="lesson"]').first().click();
       assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
       await page.screenshot({path:path.join(output,viewport.width===390?'portrait.png':'landscape.png')});
       assert.deepEqual(errors,[]);results.push({viewport,no3D:true,noSimulatedStatus:true,errors});
     }finally{await context.close();}
   }
   const context=await browser.newContext({viewport:{width:1024,height:768},isMobile:true,hasTouch:true});
   try{
     const page=await context.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});
     await page.waitForFunction(()=>window.LT_MESH&&window.LT_STATUS);
     assert(!(await page.evaluate(()=>window.LT_SHELL.isRealPhone())));
     assert(await page.locator('#device-status').isVisible());
     // A tablet keyboard narrows the viewport height, not the physical screen.
     await page.evaluate(()=>{Object.defineProperty(window.screen,'width',{configurable:true,value:1024});Object.defineProperty(window.screen,'height',{configurable:true,value:768});});
     await page.setViewportSize({width:1024,height:400});
     assert(!(await page.evaluate(()=>window.LT_SHELL.isRealPhone())));
     results.push({tablet:true,keyboardDoesNotBecomePhone:true});
   }finally{await context.close();}
   fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(results,null,2));
   console.log('PASS: touch-phone portrait/landscape hides simulation and skips 3D, native course clicks; tablet/keyboard retains frame.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
