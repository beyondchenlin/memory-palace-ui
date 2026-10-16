const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/status');
const url=process.env.QA_URL || 'http://127.0.0.1:8877/';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try {
   const page=await browser.newPage({viewport:{width:1440,height:1100},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Isolate minute/scenario scheduling from WebGL and unrelated app animation.
   await page.route('**/device-live-mesh.js*',route=>route.abort());
   await page.clock.install({time:new Date('2026-10-16T15:59:50Z')});
   await page.addInitScript(()=>{Math.random=()=>.5;});
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.LT_STATUS);
   const initial=await page.evaluate(()=>window.LT_STATUS.getState());
   assert.equal(initial.clock,'23:59');assert.equal(initial.timers,1);
   assert(await page.locator('#device-status').isVisible());
   await page.clock.runFor(10100);
   assert.equal(await page.locator('.status-clock').innerText(),'0:00','Local midnight must update');
   const normal=await page.evaluate(()=>window.LT_STATUS.getState());
   await page.evaluate(()=>Math.random=()=>.25);
   await page.clock.runFor(20000);
   const signal=await page.evaluate(()=>window.LT_STATUS.getState());
   assert(Math.abs(signal.signal-normal.signal)<=1 && Math.abs(signal.wifi-normal.wifi)<=1);
   assert(signal.signal!==normal.signal || signal.wifi!==normal.wifi);
   await page.evaluate(()=>Math.random=()=>.5);
   const toCharge=await page.evaluate(()=>window.LT_STATUS.getState().nextEventAt-Date.now());
   await page.clock.runFor(Math.ceil(toCharge+20));
   const charging=await page.evaluate(()=>window.LT_STATUS.getState());
   assert(charging.charging && charging.phase==='charging');
   const chargeLevel=charging.level;
   await page.clock.runFor(60000);
   assert((await page.evaluate(()=>window.LT_STATUS.getState())).level>chargeLevel);
   const toFlight=await page.evaluate(()=>window.LT_STATUS.getState().nextEventAt-Date.now());
   await page.clock.runFor(Math.ceil(toFlight+20));
   const flight=await page.evaluate(()=>window.LT_STATUS.getState());
   assert(flight.airplane && flight.signal===0 && flight.wifi===0);
   assert(!(await page.locator('.status-wifi').isVisible()));
   assert(!(await page.locator('.status-cellular').isVisible()));
   assert(await page.locator('.status-plane').isVisible());
   assert.equal(await page.locator('#device-status').evaluate(el=>el.getAnimations({subtree:true}).length),0);
   await page.screenshot({path:path.join(output,'airplane.png')});
   await page.clock.runFor(12000);
   assert(!(await page.evaluate(()=>window.LT_STATUS.getState())).airplane);
   assert(await page.locator('.status-wifi').isVisible());
   for(const locale of ['en','zh','ja','es','ko']){
     await page.locator(`[data-locale="${locale}"]`).click();
     const label=await page.locator('#device-status').getAttribute('aria-label');
     assert(label && !/undefined|NaN/.test(label));
   }
   assert.equal(await page.locator('#device-status').getAttribute('aria-live'),'off');
   await page.setViewportSize({width:390,height:844});
   await page.waitForFunction(()=>!window.LT_STATUS.getState().active);
   const mobile=await page.evaluate(()=>window.LT_STATUS.getState());
   assert.equal(mobile.timers,0);assert(!(await page.locator('#device-status').isVisible()));
   await page.clock.runFor(180000);
   assert.equal((await page.evaluate(()=>window.LT_STATUS.getState())).updates,mobile.updates);
   await page.setViewportSize({width:1440,height:1100});
   await page.waitForFunction(()=>window.LT_STATUS.getState().active);
   assert.equal(await page.locator('.phone-status').count(),1);
   assert.equal(await page.locator('.status-clock').innerText(),await page.evaluate(()=>new Date().getHours()+':'+String(new Date().getMinutes()).padStart(2,'0')));
   // Explicit visibility simulation tests the same event path without stealing focus.
   await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
   assert.equal((await page.evaluate(()=>window.LT_STATUS.getState())).timers,0);
   await page.clock.runFor(120000);
   await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
   assert((await page.evaluate(()=>window.LT_STATUS.getState())).active);
   await page.screenshot({path:path.join(output,'connected.png')});
   await page.close();
   const otherZone=await browser.newPage({viewport:{width:1280,height:1000},timezoneId:'America/New_York'});
   await otherZone.route('**/device-live-mesh.js*',route=>route.abort());
   await otherZone.clock.install({time:new Date('2026-10-16T15:59:50Z')});
   await otherZone.goto(url,{waitUntil:'domcontentloaded'});
   await otherZone.waitForFunction(()=>window.LT_STATUS);
   assert.equal(await otherZone.locator('.status-clock').innerText(),'11:59');
   const statusMarkup=await otherZone.locator('#device-status').evaluate(el=>el.outerHTML);
   await otherZone.close();
   // Six virtual hours of the real module, isolated from unrelated pet/rAF work.
   const longRun=await browser.newPage({viewport:{width:1440,height:1100}});
   await longRun.clock.install({time:new Date('2026-10-16T00:00:00Z')});
   await longRun.setContent(statusMarkup);
   await longRun.evaluate(()=>{
     Math.random=()=>.5;
     window.statusLongStats={min:82,max:82,maxStep:0,last:82,changes:0};
     new MutationObserver(()=>{
       const value=Number(document.querySelector('.status-battery-value').textContent),s=window.statusLongStats;
       s.min=Math.min(s.min,value);s.max=Math.max(s.max,value);s.maxStep=Math.max(s.maxStep,Math.abs(value-s.last));s.last=value;s.changes++;
     }).observe(document.querySelector('.status-battery-value'),{childList:true,subtree:true});
   });
   await longRun.addScriptTag({content:fs.readFileSync(path.join(__dirname,'js/device-status.js'),'utf8')});
   await longRun.clock.runFor(6*3600000);
   const endurance=await longRun.evaluate(()=>({stats:window.statusLongStats,state:window.LT_STATUS.getState()}));
   assert(endurance.stats.min>=18 && endurance.stats.max<=96 && endurance.stats.maxStep<=1);
   assert(endurance.stats.changes>100);assert.equal(endurance.state.timers,1);
   await longRun.emulateMedia({reducedMotion:'reduce'});
   await longRun.addStyleTag({content:fs.readFileSync(path.join(__dirname,'css/device-status.css'),'utf8')});
   for(let i=0;i<5 && !(await longRun.evaluate(()=>window.LT_STATUS.getState().charging));i++){
     const next=await longRun.evaluate(()=>window.LT_STATUS.getState().nextEventAt-Date.now());
     await longRun.clock.runFor(Math.ceil(next+20));
   }
   assert(await longRun.evaluate(()=>window.LT_STATUS.getState().charging));
   assert.equal(await longRun.locator('.status-battery-fill').evaluate(el=>getComputedStyle(el).fill),'rgb(41, 169, 86)','Charging wins over red low-battery fill');
   assert.deepEqual(errors,[]);
   const result={localMidnight:true,timeZones:['Asia/Shanghai','America/New_York'],initial,normal,signal,charging,flight,mobile,endurance,chargingIncreases:true,airplaneRestores:true,reducedMotion:true,locales:5,visibility:'simulated visibilitychange event',errors};
   fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
   console.log('PASS: real local clock, midnight/time zones, radio steps, charge/discharge, flight/recovery, 5 locales, reduced motion, desktop/mobile timers and visibility.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
