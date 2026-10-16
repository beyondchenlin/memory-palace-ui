const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=process.env.QA_OUTPUT || path.join(__dirname,'screenshots/original');
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
 try{
   const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
   const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>requests.push(request.url()));
   page.on('console',message=>{if(message.type()==='error'||message.type()==='warning') console.log(message.text());});
   await page.addInitScript(()=>{
     window.originalQA={longTasks:[]};
     new PerformanceObserver(list=>{for(const entry of list.getEntries()) if(window.originalQA.longTasks.length<100) window.originalQA.longTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});
     const mark=()=>{
       if(window.LT_SHELL && !window.originalQA.ui)window.originalQA.ui=performance.now();
       if(window.LT_MESH){window.originalQA.mesh=performance.now();return;}
       requestAnimationFrame(mark);
     };requestAnimationFrame(mark);
   });
   await page.goto(process.env.QA_URL || 'http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
   await page.locator('#shell-model-btn').click();
   assert(await page.locator('#shell-model-panel').isVisible());
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.LT_MESH,null,{timeout:60000});
   const profiles=await page.evaluate(()=>window.LT_DEVICES.models);
   assert.equal(requests.filter(url=>url.includes('.glb')).length,1,'First load must download exactly one model');
   assert(!requests.some(url=>/qa-generated|react-dom|react-three|react-3d-mockups/.test(url)),'Authoring runtime must not ship to the page');
   await page.locator('#shell-color-btn').click();
   await page.locator('.shell-swatch[data-shell="starlight"]').click();
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>window.LT_MESH.getState().color==='#f5f0e8');
   await page.evaluate(()=>window.LT_SHELL.setOrbit(-8,28));
   await page.waitForFunction(()=>window.LT_MESH.getState().viewY===28);
   await page.screenshot({path:path.join(output,'original-iphone-front.png')});
   await page.locator('[data-goto="lesson"]').first().click();
   assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
   await page.locator('.tab[data-screen="home"]').click();
   await page.evaluate(()=>window.LT_SHELL.setOrbit(-12,158));
   await page.waitForFunction(()=>window.LT_MESH.getState().viewY===158);
   await page.screenshot({path:path.join(output,'original-iphone-back.png')});
   await page.evaluate(()=>window.LT_SHELL.resetOrbit());
   await page.waitForFunction(()=>window.LT_MESH.getState().viewY===0);
   const initial=await page.evaluate(()=>({marks:window.originalQA,pipeline:performance.getEntriesByType('mark').filter(entry=>entry.name.startsWith('lt-')).map(entry=>({name:entry.name,time:entry.startTime})),state:window.LT_MESH.getState(),resources:performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/assets/devices/')||entry.name.includes('/vendor/')).map(entry=>({name:entry.name.split('/').pop(),bytes:entry.decodedBodySize,duration:entry.duration}))}));
   assert.equal(initial.state.source,'area-is/react-3d-mockups@0.2.0');
   assert.equal(initial.state.cachedModels,1);
   const switches=[];
   if(!process.env.QA_FIRST_MODEL_ONLY){
     for(const profile of profiles.slice(1)){
       const before=requests.filter(url=>url.includes('.glb')).length;
       const start=Date.now();
       await page.locator('#shell-model-btn').click();
       await page.locator(`.shell-model[data-model="${profile.id}"]`).click();
       await page.waitForFunction(id=>window.LT_MESH.getState().model===id,profile.id,{timeout:60000});
       await page.keyboard.press('Escape');
       assert.equal(requests.filter(url=>url.includes('.glb')).length,before+1);
       switches.push({id:profile.id,firstSwitchMs:Date.now()-start});
       await page.evaluate(()=>window.LT_SHELL.setOrbit(-12,158));
       await page.waitForFunction(()=>window.LT_MESH.getState().viewY===158);
       await page.screenshot({path:path.join(output,profile.id+'-back.png')});
       await page.evaluate(()=>window.LT_SHELL.resetOrbit());
       await page.waitForFunction(()=>window.LT_MESH.getState().viewY===0);
     }
     const downloads=requests.filter(url=>url.includes('.glb')).length;
     for(let i=0;i<12;i++){
       const id=profiles[i%profiles.length].id;
       await page.evaluate(id=>window.LT_SHELL.applyModel(id),id);
       await page.waitForFunction(id=>window.LT_MESH.getState().model===id,id);
     }
     assert.equal(requests.filter(url=>url.includes('.glb')).length,downloads,'Cached switches must not request the model again');
     assert.equal(await page.evaluate(()=>window.LT_MESH.getState().cachedModels),profiles.length);
   }
   await page.waitForFunction(()=>!window.LT_MESH.getState().pending);
   const frames=await page.evaluate(()=>window.LT_MESH.getState().renderCount);
   await page.waitForTimeout(500);
   assert.equal(await page.evaluate(()=>window.LT_MESH.getState().renderCount),frames,'Resting device must not redraw');
   assert.deepEqual(errors,[]);
   const rotation=await page.evaluate(()=>new Promise(resolve=>{
     const samples=[];let previous=performance.now(),i=0;
     function frame(now){
       if(i>0)samples.push(now-previous);
       previous=now;
       window.LT_SHELL.setOrbit(-6,Math.sin(i/20)*32);
       if(++i<120)requestAnimationFrame(frame);
       else {
         window.LT_SHELL.resetOrbit();
         const sorted=samples.slice().sort((a,b)=>a-b);
         const gl=document.querySelector('canvas.device-webgl').getContext('webgl2');
         const ext=gl.getExtension('WEBGL_debug_renderer_info');
         resolve({averageFrameMs:samples.reduce((a,b)=>a+b)/samples.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'});
       }
     }requestAnimationFrame(frame);
   }));
   fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({initial,switches,rotation,requests:requests.filter(url=>url.includes('.glb')),errors,final:await page.evaluate(()=>window.LT_MESH.getState())},null,2));
   console.log(JSON.stringify({uiMs:initial.marks.ui,readyMs:initial.marks.mesh,firstModel:initial.state,models:profiles.length,switches,rotation,errors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
