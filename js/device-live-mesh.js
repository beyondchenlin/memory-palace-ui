import * as THREE from 'three';
import {GLTFLoader,MeshoptDecoder} from '../vendor/device-runtime/loader.js?v=20261016-appearance1';
import {railColor} from '../vendor/device-runtime/finish.js?v=20261016-appearance1';

const FINISHES = new Map(window.LT_PALACE.FINISH_IDS.map(({id,swatch})=>[id,swatch]));
const DEFAULT_FINISH = window.LT_PALACE.FINISH_IDS[0].swatch;
let lightingPromise;
export function loadStudioLighting(){
  if(!lightingPromise) lightingPromise=(async()=>{
    const meta=window.LT_DEVICES.lighting;
    const response=await fetch(new URL('../assets/devices/'+meta.file,import.meta.url));
    if(!response.ok) throw Error('Studio lighting '+response.status);
    const decompressed=response.body.pipeThrough(new DecompressionStream('gzip'));
    const buffer=await new Response(decompressed).arrayBuffer();
    if(buffer.byteLength!==meta.width*meta.height*8) throw Error('Invalid lighting atlas');
    return {...meta,pixels:new Uint16Array(buffer)};
  })().catch(error=>{lightingPromise=null;throw error;});
  return lightingPromise;
}
function screenMatrix(points,width,height){
  const [a,b,c,d]=points;
  const dx1=b.x-c.x,dx2=d.x-c.x,dy1=b.y-c.y,dy2=d.y-c.y;
  const dx3=a.x-b.x+c.x-d.x,dy3=a.y-b.y+c.y-d.y;
  const determinant=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/determinant,h=(dx1*dy3-dx3*dy1)/determinant;
  return 'matrix3d('+[
    (b.x-a.x+g*b.x)/width,(b.y-a.y+g*b.y)/width,0,g/width,
    (d.x-a.x+h*d.x)/height,(d.y-a.y+h*d.y)/height,0,h/height,
    0,0,1,0,a.x,a.y,0,1,
  ].join(',')+')';
}
export function createDeviceMesh({mount,screenEl,unit,rig,lightingImage,initialModel}){
  performance.mark('lt-webgl-context-start');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  performance.mark('lt-webgl-context-ready');
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0,0);
  renderer.domElement.className='device-webgl';
  renderer.domElement.style.filter='drop-shadow(0 24px 24px #00000055)';
  mount.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const environment=new THREE.DataTexture(lightingImage.pixels,lightingImage.width,lightingImage.height,THREE.RGBAFormat,THREE.HalfFloatType);
  environment.mapping=THREE.CubeUVReflectionMapping;
  environment.minFilter=environment.magFilter=THREE.LinearFilter;
  environment.generateMipmaps=false;environment.needsUpdate=true;
  scene.environment=environment;
  // Upstream studio's direct lights; the HDR atlas preserves its Lightformers.
  scene.add(new THREE.AmbientLight('white',.4));
  const key=new THREE.DirectionalLight('white',.6);
  key.position.set(1200,1600,1200);scene.add(key);
  // Physical details are separated by fractions of a millimeter. A near plane
  // sized to this scene keeps those surfaces from fighting in the depth buffer.
  const camera=new THREE.PerspectiveCamera(30,1,100,5000);
  camera.position.set(0,0,2400);
  const root=new THREE.Group();root.rotation.order='XYZ';scene.add(root);
  const screenLayer=document.createElement('div');
  screenLayer.className='device-screen-layer';rig.appendChild(screenLayer);
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const downloads=new AbortController();
  const cache=new Map(),pendingLoads=new Map();
  const color=new THREE.Color(DEFAULT_FINISH),targetColor=color.clone();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let current,requestedId,modelId,finishId,modelVersion=0,currentLoad;
  let disposed=false,active=false,preparing=true,raf=0,dirty=true,lastTime=0,inView=true;
  let slowFrames=0,lastLayout,forceDraw=true;
  let targetX=0,targetY=0,viewX=0,viewY=0,renderCount=0,lastWidth=0,lastHeight=0;
  let projection,projectionOrigin;
  function releaseAsset(asset){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    asset.object.traverse(node=>{
      if(node.geometry) geometries.add(node.geometry);
      for(const material of [].concat(node.material||[])){
        materials.add(material);
        for(const value of Object.values(material)) if(value?.isTexture) textures.add(value);
      }
    });
    geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());textures.forEach(value=>value.dispose());
  }
  function tint(asset,finish){
    if(asset.lastTint?.equals(finish)) return;
    (asset.lastTint ||= new THREE.Color()).copy(finish);
    const rail=new THREE.Color(railColor('#'+finish.getHexString()));
    for(const material of asset.tinted){
      const spec=material.userData.ltTint;
      material.color.copy(spec.rail?rail:finish);
      material.color.r*=spec.multiplier[0];material.color.g*=spec.multiplier[1];material.color.b*=spec.multiplier[2];
    }
  }
  async function loadModel(profile){
    if(cache.has(profile.id)) return cache.get(profile.id);
    if(pendingLoads.has(profile.id)) return pendingLoads.get(profile.id);
    const promise=(async()=>{
      performance.mark('lt-model-start:'+profile.id);
      let bytes;
      if(initialModel?.id===profile.id){
        bytes=await initialModel.bytes;
        initialModel=null;
      }else{
        const response=await fetch(profile.asset,{signal:downloads.signal});
        if(!response.ok) throw Error('Handset '+response.status);
        bytes=await response.arrayBuffer();
      }
      if(disposed) throw Error('Renderer disposed during download');
      const gltf=await loader.parseAsync(bytes,new URL('.',new URL(profile.asset,location.href)).href);
      performance.mark('lt-model-decoded:'+profile.id);
      const object=gltf.scene;
      object.scale.set(profile.width/profile.sourceBody.width,profile.height/profile.sourceBody.height,profile.depth/profile.sourceBody.depth);
      object.position.z=-profile.depth/2;
      const materials=new Set(),tinted=[];
      object.traverse(node=>{
        if(!node.isMesh) return;
        node.frustumCulled=false;
        for(const material of [].concat(node.material)){
          if(materials.has(material)) continue;
          materials.add(material);
          const render=material.userData.ltRender;
          if(render){
            if(render.envMapIntensity!==undefined) material.envMapIntensity=render.envMapIntensity;
            material.blending=render.blending;material.depthWrite=render.depthWrite;material.side=render.side;
          }
          if(material.userData.ltTint) tinted.push(material);
          material.needsUpdate=true;
        }
      });
      const asset={object,profile,materials,tinted};
      tint(asset,color);
      if(disposed){releaseAsset(asset);throw Error('Renderer disposed during model load');}
      cache.set(profile.id,asset);
      // Cache only this bounded handset catalog; no speculative model requests.
      return asset;
    })().finally(()=>pendingLoads.delete(profile.id));
    pendingLoads.set(profile.id,promise);
    return promise;
  }
  function configureScreen(profile){
    screenEl.dataset.model=profile.id;screenEl.dataset.topChrome=profile.topChrome;
    screenEl.style.setProperty('--live-screen-width',profile.uiWidth+'px');
    screenEl.style.setProperty('--live-screen-height',profile.uiHeight+'px');
    screenEl.style.setProperty('--live-screen-radius',profile.sourceDisplay.radius/profile.sourceDisplay.width*profile.uiWidth+'px');
    const pxPerMm=profile.uiWidth/(profile.displayWidth/window.LT_DEVICES.scale);
    screenEl.style.setProperty('--live-cutout-width',profile.cutout.width*pxPerMm+'px');
    screenEl.style.setProperty('--live-cutout-height',profile.cutout.height*pxPerMm+'px');
    screenEl.style.setProperty('--live-cutout-top',(profile.cutout.offset-profile.cutout.height/2)*pxPerMm+'px');
  }
  function setModelUiId(id){
    const profile=window.LT_DEVICES.get(id);
    if(requestedId===profile.id) return currentLoad || Promise.resolve();
    requestedId=profile.id;
    const version=++modelVersion;
    rig.classList.add('is-model-loading');unit.setAttribute('aria-busy','true');
    currentLoad=(async()=>{
      try{
        const asset=await loadModel(profile);
        if(disposed || version!==modelVersion) return;
        tint(asset,color);
        if(!asset.compiled){
          await renderer.compileAsync(asset.object,camera,scene);
          asset.compiled=true;
        }
        performance.mark('lt-model-compiled:'+profile.id);
        if(disposed || version!==modelVersion) return;
        root.clear();root.add(asset.object);current=asset;modelId=profile.id;
        forceDraw=true;
        configureScreen(profile);
        invalidate();
      }catch(error){
        if(!disposed && version===modelVersion){
          requestedId=null;
          screenEl.dispatchEvent(new CustomEvent('lt-model-load-error',{bubbles:true,detail:{id:profile.id,message:error.message}}));
          throw error;
        }
      }finally{
        if(version===modelVersion){rig.classList.remove('is-model-loading');unit.removeAttribute('aria-busy');}
      }
    })();
    return currentLoad;
  }
  function setFinish(id){
    if(finishId===id) return;
    finishId=id;targetColor.set(FINISHES.get(id)||DEFAULT_FINISH);invalidate();
  }
  function setRotation(x,y){
    const nextX=THREE.MathUtils.clamp(Number(x)||0,-68,68),nextY=THREE.MathUtils.clamp(Number(y)||0,-260,260);
    if(nextX===targetX&&nextY===targetY) return;
    targetX=nextX;targetY=nextY;invalidate();
  }
  function layout(){
    if(!current) return;
    const model=current.profile,rect=mount.getBoundingClientRect(),box=unit.getBoundingClientRect();
    const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
    const centerX=box.left+box.width/2-rect.left,centerY=box.top+box.height/2-rect.top;
    const signature=[...[w,h,box.width,centerX,centerY].map(value=>Math.round(value*100)/100),viewX,viewY,modelId,renderer.getPixelRatio()];
    if(lastLayout && signature.every((value,index)=>value===lastLayout[index])) return false;
    lastLayout=signature;
    if(w!==lastWidth||h!==lastHeight){renderer.setSize(w,h,false);lastWidth=w;lastHeight=h;}
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(h/(2*camera.position.z)));camera.aspect=w/h;
    camera.setViewOffset(w,h,w/2-centerX,h/2-centerY,w,h);camera.updateProjectionMatrix();
    root.scale.setScalar(box.width/model.width);root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const sw=model.displayWidth,sh=model.displayHeight;
    const points=[[-sw/2,sh/2],[sw/2,sh/2],[sw/2,-sh/2],[-sw/2,-sh/2]].map(([x,y])=>{
      const p=new THREE.Vector3(x,y,model.displayZ).applyMatrix4(root.matrixWorld).project(camera);
      return {x:(p.x+1)*w/2+rect.left+scrollX,y:(1-p.y)*h/2+rect.top+scrollY};
    });
    projection={tl:points[0],tr:points[1],br:points[2],bl:points[3]};
    const rigRect=rig.getBoundingClientRect();projectionOrigin={x:rigRect.left+scrollX,y:rigRect.top+scrollY};
    const origin=screenLayer.getBoundingClientRect();
    if(active){
      const rearFacing=Math.cos(THREE.MathUtils.degToRad(viewY))<=.06;
      screenEl.style.visibility=rearFacing?'hidden':'';screenEl.inert=rearFacing;
      if(!rearFacing) screenEl.style.transform=screenMatrix(points.map(p=>({x:p.x-scrollX-origin.left,y:p.y-scrollY-origin.top})),model.uiWidth,model.uiHeight);
    }
    return true;
  }
  function render(time){
    raf=0;if(disposed||document.hidden||!inView||!active||!current) return;
    const dt=lastTime?Math.min((time-lastTime)/1000,.05):1/60;lastTime=time;
    const damping=reduced.matches?1:1-Math.exp(-(document.body.classList.contains('is-shell-orbiting')?34:22)*dt);
    viewX+=(targetX-viewX)*damping;viewY+=(targetY-viewY)*damping;
    const moving=Math.abs(viewX-targetX)+Math.abs(viewY-targetY)>.015;
    if(!moving){viewX=targetX;viewY=targetY;}
    color.lerp(targetColor,reduced.matches?1:1-Math.exp(-20*dt));
    const colorMoving=(color.r-targetColor.r)**2+(color.g-targetColor.g)**2+(color.b-targetColor.b)**2>.000004;
    if(!colorMoving) color.copy(targetColor);
    const colorChanged=!current.lastTint?.equals(color);
    tint(current,color);
    // Adapt only after sustained slow animation frames; HTML stays native/sharp.
    slowFrames=(moving||colorMoving) && dt>.026 ? slowFrames+1 : Math.max(0,slowFrames-1);
    if(slowFrames>=12 && renderer.getPixelRatio()>1){
      renderer.setPixelRatio(Math.max(1,renderer.getPixelRatio()-.25));
      slowFrames=0;forceDraw=true;
    }
    root.rotation.x=THREE.MathUtils.degToRad(-viewX);root.rotation.y=THREE.MathUtils.degToRad(viewY);
    const layoutChanged=layout();
    if(forceDraw||colorChanged||layoutChanged){renderer.render(scene,camera);renderCount++;forceDraw=false;}
    dirty=false;
    if(moving||colorMoving) raf=requestAnimationFrame(render);
  }
  function invalidate(){
    dirty=true;
    if(!disposed&&!preparing&&active&&inView&&!raf&&!document.hidden){lastTime=0;raf=requestAnimationFrame(render);}
  }
  function pause(){cancelAnimationFrame(raf);raf=0;lastTime=0;slowFrames=0;}
  function visibility(){if(document.hidden) pause();else invalidate();}
  const observer=new ResizeObserver(invalidate);
  const intersection=new IntersectionObserver(entries=>{
    inView=entries[0].isIntersecting;
    if(inView) invalidate();else pause();
  });
  intersection.observe(rig);
  observer.observe(rig);observer.observe(unit);observer.observe(document.querySelector('.stage'));
  document.fonts?.ready.then(invalidate);
  window.addEventListener('resize',invalidate);window.addEventListener('scroll',invalidate,{passive:true});document.addEventListener('visibilitychange',visibility);
  renderer.domElement.addEventListener('webglcontextlost',event=>{if(!disposed){event.preventDefault();screenEl.dispatchEvent(new CustomEvent('lt-3d-context-lost',{bubbles:true}));}});
  setModelUiId(unit.dataset.model);setFinish(unit.dataset.shell);
  const ready=(async()=>{
    let load;
    do{load=currentLoad;await load;}while(load!==currentLoad);
    preparing=false;
  })();
  let released=false;
  function release(){
    if(released) return;released=true;
    cache.forEach(releaseAsset);cache.clear();root.clear();environment.dispose();renderer.dispose();renderer.forceContextLoss();
  }
  return {
    ready,
    activate(){if(disposed)return;active=true;color.copy(targetColor);tint(current,color);screenLayer.appendChild(screenEl);screenEl.classList.add('is-live-3d-screen');lastLayout=null;render(performance.now());},
    setModelUiId,setFinish,setRotation,resize:invalidate,
    getProjection(){
      if(!projection)return null;
      const rect=rig.getBoundingClientRect(),dx=rect.left+scrollX-projectionOrigin.x,dy=rect.top+scrollY-projectionOrigin.y,result={};
      for(const key of ['tl','tr','br','bl']) result[key]={x:projection[key].x+dx,y:projection[key].y+dy};
      const xs=Object.values(result).map(p=>p.x),ys=Object.values(result).map(p=>p.y);
      result.aabb={left:Math.min(...xs)-scrollX,top:Math.min(...ys)-scrollY,width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
      return result;
    },
    getOverlayMode:()=>true,
    getState:()=>({model:modelId,requestedModel:requestedId,source:window.LT_DEVICES.source,dimensions:current?.profile.mm,finish:finishId,color:'#'+color.getHexString(),targetColor:'#'+targetColor.getHexString(),viewX,viewY,targetX,targetY,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,cachedModels:cache.size,pendingModels:pendingLoads.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,renderCount,pending:!!raf,dirty,inView,pixelRatio:renderer.getPixelRatio()}),
    dispose(){
      if(disposed)return;disposed=true;modelVersion++;pause();observer.disconnect();intersection.disconnect();
      downloads.abort();initialModel?.abort();
      rig.classList.remove('is-model-loading');unit.removeAttribute('aria-busy');
      window.removeEventListener('resize',invalidate);window.removeEventListener('scroll',invalidate);document.removeEventListener('visibilitychange',visibility);
      mount.remove();screenLayer.remove();
      Promise.allSettled([ready,...pendingLoads.values()]).then(release);
    },
  };
}
