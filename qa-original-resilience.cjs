const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/original-resilience');
const url=process.env.QA_URL || 'http://127.0.0.1:8877/';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try{
   const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const cdp=await page.context().newCDPSession(page);
   await cdp.send('Network.enable');
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:500000,uploadThroughput:125000});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.addInitScript(()=>{
     window.resilienceQA={};
     const mark=()=>{
       if(window.LT_SHELL&&!window.resilienceQA.ui)window.resilienceQA.ui=performance.now();
       if(window.LT_MESH){window.resilienceQA.ready=performance.now();return;}
       requestAnimationFrame(mark);
     };requestAnimationFrame(mark);
   });
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#shell-model-btn').click();
   assert(await page.locator('#shell-model-panel').isVisible());
   await page.keyboard.press('Escape');
   await page.locator('[data-goto="lesson"]').first().click();
   assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
   await page.locator('.tab[data-screen="home"]').click();
   await page.waitForFunction(()=>window.LT_MESH,null,{timeout:90000});
   const weak=await page.evaluate(()=>({timing:window.resilienceQA,state:window.LT_MESH.getState(),pipeline:performance.getEntriesByType('mark').map(entry=>({name:entry.name,time:entry.startTime}))}));
   await page.screenshot({path:path.join(output,'weak-network-ready.png')});
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});

   let fail=true;
   await page.route('**/galaxy-s26-ultra.*.glb',route=>fail?route.abort('failed'):route.continue());
   await page.locator('#shell-model-btn').click();
   await page.locator('.shell-model[data-model="galaxy-s26-ultra"]').click();
   await page.waitForFunction(()=>document.querySelector('.device-load-status')?.hidden===false);
   assert.equal(await page.locator('#device-unit').getAttribute('data-model'),'iphone-18-pro-max');
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().model),'iphone-18-pro-max');
   assert(!(await page.locator('#device-unit').getAttribute('aria-busy')));
   fail=false;
   await page.locator('.shell-model[data-model="galaxy-s26-ultra"]').click();
   await page.waitForFunction(()=>window.LT_MESH.getState().model==='galaxy-s26-ultra');
   assert(await page.locator('.device-load-status').evaluate(el=>el.hidden));

   // Hold one download, choose another phone, then release the stale result.
   let release;
   const gate=new Promise(resolve=>release=resolve);
   await page.route('**/iphone-18-pro.*.glb',async route=>{await gate;await route.continue();});
   await page.locator('.shell-model[data-model="iphone-18-pro"]').click();
   await page.waitForFunction(()=>window.LT_MESH.getState().pendingModels===1);
   await page.locator('.shell-model[data-model="galaxy-s26"]').click();
   await page.waitForFunction(()=>window.LT_MESH.getState().model==='galaxy-s26');
   release();
   await page.waitForFunction(()=>window.LT_MESH.getState().pendingModels===0);
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().model),'galaxy-s26');
   await page.keyboard.press('Escape');
   const stable=await page.evaluate(()=>window.LT_MESH.getState());
   for(let i=0;i<16;i++){
     const id=['iphone-18-pro-max','galaxy-s26-ultra','iphone-18-pro','galaxy-s26'][i%4];
     await page.evaluate(id=>window.LT_SHELL.applyModel(id),id);
     await page.waitForFunction(id=>{const s=window.LT_MESH.getState();return s.model===id&&!s.pending&&!s.dirty;},id);
   }
   const after=await page.evaluate(()=>window.LT_MESH.getState());
   assert.equal(after.cachedModels,4);
   // The held model was not uploaded until selected; all four become resident once.
   assert(after.geometries<150);assert(after.textures<10);
   for(let i=0;i<8;i++){
     const id=['iphone-18-pro-max','galaxy-s26-ultra','iphone-18-pro','galaxy-s26'][i%4];
     await page.evaluate(id=>window.LT_SHELL.applyModel(id),id);
     await page.waitForFunction(id=>{const s=window.LT_MESH.getState();return s.model===id&&!s.pending&&!s.dirty;},id);
   }
   const repeat=await page.evaluate(()=>window.LT_MESH.getState());
   assert.equal(repeat.geometries,after.geometries,'Cached switches must not grow GPU geometry');
   assert.equal(repeat.textures,after.textures,'Cached switches must not grow GPU textures');
   await page.locator('[data-goto="lesson"]').first().click();
   assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
   await page.close();

   const fallback=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
   fallback.on('pageerror',error=>errors.push(error.message));
   await fallback.route('**/*.glb',route=>route.abort('failed'));
   await fallback.goto(url,{waitUntil:'domcontentloaded'});
   await fallback.waitForFunction(()=>window.LT_SHELL && !document.querySelector('#device-webgl-mount') && performance.getEntriesByName('lt-webgl-context-ready').length>0);
   assert(!(await fallback.evaluate(()=>document.body.classList.contains('has-live-3d'))));
   await fallback.locator('[data-goto="lesson"]').first().click();
   assert(await fallback.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
   assert.deepEqual(errors,[]);
   const result={conditions:{downloadMbps:4,latencyMs:100,cpuSlowdown:4,compression:'Local server sends uncompressed JavaScript; GPU unchanged'},weak,failedSwitchRecovery:true,retry:true,staleResponseIgnored:true,stable,after,repeat,initialFailureFallback:true,errors};
   fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
   console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
