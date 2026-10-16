// Offline authoring step: bake the procedural environment once instead of on every visit.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined});
 try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded'});
  const png=await page.evaluate(async ()=>{
   const THREE=await import('/vendor/three/three.module.js');
   const {studioEnvironment:make}=await import('/qa-studio-lighting.mjs');
   const renderer=new THREE.WebGLRenderer();
   const env=make(renderer),w=env.width,h=env.height;
   const pixels=new Uint16Array(w*h*4);
   renderer.readRenderTargetPixels(env,0,0,w,h,pixels);
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d');const image=ctx.createImageData(w,h);
   let lit=0;
   for(let i=0;i<pixels.length;i++){
    if(i%4===3){image.data[i]=255;continue;}
    const linear=Math.max(0,Math.min(1,THREE.DataUtils.fromHalfFloat(pixels[i])));
    const srgb=linear<=0.0031308?linear*12.92:1.055*Math.pow(linear,1/2.4)-0.055;
    image.data[i]=Math.round(srgb*255);if(linear>0.05)lit++;
   }
   if(lit<1000)throw Error('Lighting readback failed');
   ctx.putImageData(image,0,0);const result=canvas.toDataURL('image/png');
   env.dispose();renderer.dispose();renderer.forceContextLoss();return result;
  });
  const destination=path.join(__dirname,'assets/lighting/studio-softboxes.png');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,Buffer.from(png.split(',')[1],'base64'));
  console.log({destination,bytes:fs.statSync(destination).size});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
