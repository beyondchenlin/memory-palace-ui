const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.QA_OUTPUT || path.join(__dirname, 'screenshots', '3d-local-preview');
const base = process.env.QA_URL || 'http://127.0.0.1:8877/';
const phase = process.env.QA_PHASE || 'before';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || undefined});
  try {
    const runs=[];
    for(let i=0;i<2;i++) {
      const context = await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2});
      const page = await context.newPage();
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(() => {
        window.previewMarks={longTasks:[]};
        new PerformanceObserver(list=>list.getEntries().forEach(entry=>window.previewMarks.longTasks.push(Math.round(entry.duration)))).observe({type:'longtask',buffered:true});
        const watch=()=>{
          if(window.LT_SHELL && !window.previewMarks.ui) window.previewMarks.ui=performance.now();
          if(window.LT_MESH) {window.previewMarks.ready=performance.now();return;}
          requestAnimationFrame(watch);
        }; requestAnimationFrame(watch);
      });
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.LT_MESH && window.previewMarks.ready);
      await page.waitForTimeout(300);
      await page.evaluate(()=>window.LT_SHELL.setOrbit(-8,38));
      await page.waitForTimeout(600);
      const stats=await page.evaluate(()=>({marks:window.previewMarks,state:window.LT_MESH.getState(),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/js/')||e.name.includes('/vendor/')).map(e=>({name:e.name.split('/').pop(),bytes:e.decodedBodySize})),screen:document.querySelector('.device-screen').getBoundingClientRect().toJSON()}));
      runs.push(stats);
      if(i===0) {
        if(phase==='after') {
          await page.mouse.move(20,400);
          const breathing = await page.evaluate(()=>new Promise(resolve=>{
            const samples=[],start=performance.now(),initialFrames=window.LT_MESH.getState().renderCount;
            function sample(){
              const rig=document.getElementById('device-rig').getBoundingClientRect();
              const screen=document.querySelector('.device-screen').getBoundingClientRect();
              samples.push({y:rig.top,offset:screen.top-rig.top});
              if(performance.now()-start<5600)setTimeout(sample,75);
              else resolve({samples,frames:window.LT_MESH.getState().renderCount-initialFrames});
            } sample();
          }));
          const heightRange=Math.max(...breathing.samples.map(p=>p.y))-Math.min(...breathing.samples.map(p=>p.y));
          const offsetRange=Math.max(...breathing.samples.map(p=>p.offset))-Math.min(...breathing.samples.map(p=>p.offset));
          assert(heightRange>5 && heightRange<6.2,JSON.stringify({heightRange,css:await page.locator('#device-rig').evaluate(el=>({animation:getComputedStyle(el).animationName,state:getComputedStyle(el).animationPlayState,stage:el.parentElement.className,focus:el.matches(':focus-within'),hover:el.matches(':hover')}))}));
          assert(offsetRange<0.1,'Screen must breathe together with the body');
          assert(breathing.frames<4,'CSS breathing must not continuously redraw WebGL');
          stats.breathing={heightRange,offsetRange,extraGpuFrames:breathing.frames};
        }
        await page.evaluate(()=>window.LT_SHELL.applyShell('starlight'));
        await page.waitForTimeout(400);
        await page.screenshot({path:path.join(output, phase+'-silver.png')});
        if(phase==='after') {
          for(const finish of ['space-blue','violet-night']) {
            await page.evaluate(id=>window.LT_SHELL.applyShell(id),finish);
            await page.waitForTimeout(400);
            await page.screenshot({path:path.join(output,'after-'+finish+'.png')});
          }
          for(const finish of await page.evaluate(()=>window.LT_PALACE.FINISH_IDS.map(({id})=>id))) {
            await page.evaluate(id=>window.LT_SHELL.applyShell(id),finish);
            await page.waitForFunction(id=>window.LT_MESH.getState().finish===id,finish);
          }
          await page.evaluate(()=>window.LT_PALACE.applyFinish('sierra-blue'));
          await page.waitForFunction(()=>window.LT_MESH.getState().finish==='sierra-blue');
          const button = await page.locator('#screen-home [data-goto="lesson"]').boundingBox();
          await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
          assert.equal(await page.locator('#device-rig').evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
          await page.locator('#screen-home [data-goto="lesson"]').click();
          assert(await page.locator('#screen-lesson').evaluate(el=>el.classList.contains('is-active')));
          const resting = await page.locator('#device-rig').boundingBox();
          await page.waitForTimeout(300);
          assert(Math.abs((await page.locator('#device-rig').boundingBox()).y-resting.y)<0.1);
          await page.emulateMedia({reducedMotion:'reduce'});
          assert.equal(await page.locator('#device-rig').evaluate(el=>getComputedStyle(el).animationName),'none');
        }
      }
      assert.deepEqual(errors,[]);
      await context.close();
    }
    fs.writeFileSync(path.join(output,phase+'-metrics.json'),JSON.stringify(runs,null,2));
    console.log(JSON.stringify({phase,runs},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
