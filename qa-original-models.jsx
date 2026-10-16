// Offline only. Render the upstream components unchanged, then export their
// actual meshes/PBR materials; no React code is shipped to the learning page.
import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas, useThree} from '@react-three/fiber';
import {IPhone, Galaxy} from 'react-3d-mockups';
import {IPHONE_VARIANTS, GALAXY_VARIANTS, railColor, STUDIO_LIGHTFORMERS} from 'react-3d-mockups/core';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

const BASE = '#a89f91';
const distance = (a,b) => (a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2;
let stage;
function Device({kind, variant, color}) {
  const scene = useThree(state => state.scene);
  const gl = useThree(state => state.gl);
  const ref = useRef();
  useEffect(() => {
    const timer = setTimeout(() => { stage = {group:ref.current,scene,gl}; }, 100);
    return () => clearTimeout(timer);
  }, [kind, variant, color]);
  const Component = kind === 'iphone' ? IPhone : Galaxy;
  return <group ref={ref}><Component variant={variant} color={color} statusBar={false}/></group>;
}
function App() {
  const [config,setConfig] = useState(null);
  window.configureOriginal = next => { stage = null; setConfig(next); };
  return <Canvas frameloop="demand" gl={{antialias:true,preserveDrawingBuffer:true}}>
    {config && <Device {...config}/>}
  </Canvas>;
}
createRoot(document.getElementById('authoring')).render(<App/>);

async function configured(config) {
  while (!window.configureOriginal) await new Promise(resolve=>setTimeout(resolve,10));
  window.configureOriginal(config);
  while (!stage) await new Promise(resolve=>setTimeout(resolve,10));
  const materials = [];
  stage.group.traverse(node => {
    if (node.isMesh) for (const material of [].concat(node.material)) if (!materials.includes(material)) materials.push(material);
  });
  return materials;
}
window.exportOriginal = async ({kind,variant}) => {
  const materials = await configured({kind,variant,color:BASE});
  const baseline = materials.map(material=>({uuid:material.uuid,color:material.color?.clone()}));
  await configured({kind,variant,color:'#58cc02'});
  const changed = new Set(materials.filter((material,index)=>material.color && distance(material.color,baseline[index].color)>1e-8).map(material=>material.uuid));
  await configured({kind,variant,color:BASE});
  const sourceBase = new THREE.Color(BASE), sourceRail = new THREE.Color(railColor(BASE));
  let index=0;
  stage.group.traverse(node => {
    if (!node.isMesh) return;
    // HTML-bridge occluders are omitted from this offline scene by the bundler.
    node.name = `upstream-mesh-${index++}`;
    node.frustumCulled = false;
    for (const material of [].concat(node.material)) {
      material.name ||= `upstream-material-${materials.indexOf(material)}`;
      material.userData.ltRender = {envMapIntensity:material.envMapIntensity,blending:material.blending,depthWrite:material.depthWrite,side:material.side};
      if (changed.has(material.uuid)) {
        const reference = distance(material.color,sourceRail)<1e-8 ? sourceRail : sourceBase;
        material.userData.ltTint = {rail:reference===sourceRail,multiplier:material.color.toArray().map((v,i)=>v/reference.toArray()[i])};
      }
    }
  });
  stage.group.updateMatrixWorld(true);
  const spec = kind==='iphone' ? IPHONE_VARIANTS[variant] : GALAXY_VARIANTS[variant];
  stage.group.userData = {source:'area-is/react-3d-mockups@0.2.0',kind,variant,spec};
  const buffer = await new GLTFExporter().parseAsync(stage.group,{binary:true,onlyVisible:true,trs:true});
  const bytes=new Uint8Array(buffer);
  let binary='';
  for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return {data:btoa(binary),spec,meshes:index,materials:materials.length,tinted:changed.size};
};
window.originalStudio = STUDIO_LIGHTFORMERS;
window.railColor = railColor;
window.bakeOriginalStudio = async () => {
  while(!stage) await new Promise(resolve=>setTimeout(resolve,10));
  const scene = new THREE.Scene();
  for(const light of STUDIO_LIGHTFORMERS) {
    const geometry = light.form==='circle' ? new THREE.RingGeometry(0,.5,64) : new THREE.PlaneGeometry(1,1);
    const material = new THREE.MeshBasicMaterial({color:new THREE.Color('white').multiplyScalar(light.intensity),toneMapped:false,side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geometry,material);
    mesh.position.fromArray(light.position);
    mesh.scale.fromArray(light.scale);
    mesh.lookAt(0,0,0);
    scene.add(mesh);
  }
  const pmrem = new THREE.PMREMGenerator(stage.gl);
  const target = pmrem.fromScene(scene,0,.1,100,{size:256});
  const pixels = new Uint16Array(target.width*target.height*4);
  stage.gl.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
  const bytes = new Uint8Array(pixels.buffer);
  let binary='';
  for(let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  const result = {width:target.width,height:target.height,data:btoa(binary)};
  target.dispose();pmrem.dispose();
  scene.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
  return result;
};
