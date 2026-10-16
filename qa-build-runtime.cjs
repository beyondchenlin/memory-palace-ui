const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
async function buildRuntime(){
 const root=__dirname;
 const external={bundle:true,format:'esm',minify:true,legalComments:'eof',plugins:[{name:'shared-three',setup(build){
   build.onResolve({filter:/^three$/},()=>({path:'three',external:true}));
 }}]};
 fs.mkdirSync(path.join(root,'vendor/device-runtime'),{recursive:true});
 await esbuild.build({...external,stdin:{contents:'export {GLTFLoader} from "three/addons/loaders/GLTFLoader.js"; export {MeshoptDecoder} from "meshoptimizer/meshopt_decoder.module.js";',resolveDir:root},outfile:path.join(root,'vendor/device-runtime/loader.js')});
 await esbuild.build({...external,stdin:{contents:'export {railColor} from "react-3d-mockups/core";',resolveDir:root},outfile:path.join(root,'vendor/device-runtime/finish.js')});
 // Keep every loader dependency, but avoid shipping unrelated Three exporters,
 // helpers and primitives. One shared engine still owns all class identities.
 const exports=new Set();
 for(const file of ['loader.js','finish.js']){
   const source=fs.readFileSync(path.join(root,'vendor/device-runtime',file),'utf8');
   for(const match of source.matchAll(/import\{([^}]+)\}from["']three["']/g)){
     for(const name of match[1].split(',')) exports.add(name.trim().split(/\s+as\s+/)[0]);
   }
 }
 const adapter=fs.readFileSync(path.join(root,'js/device-live-mesh.js'),'utf8');
 for(const match of adapter.matchAll(/THREE\.([A-Za-z]\w*)/g)) exports.add(match[1]);
 await esbuild.build({stdin:{contents:'export {'+[...exports].sort().join(',')+'} from "three";',resolveDir:root},bundle:true,format:'esm',minify:true,outfile:path.join(root,'vendor/three/three.module.js'),legalComments:'eof'});
 const notice=relative=>fs.readFileSync(path.join(root,'node_modules',relative),'utf8');
 fs.copyFileSync(path.join(root,'node_modules/three/LICENSE'),path.join(root,'vendor/three/LICENSE'));
 fs.writeFileSync(path.join(root,'vendor/device-runtime/LICENSE.txt'),[
   notice('three/LICENSE'),notice('meshoptimizer/LICENSE.md'),notice('react-3d-mockups/LICENSE'),
 ].join('\n\n'));
}
module.exports=buildRuntime;
if(require.main===module) buildRuntime().catch(error=>{console.error(error);process.exitCode=1;});
