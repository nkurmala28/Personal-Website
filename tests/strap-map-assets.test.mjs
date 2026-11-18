import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
const base=new URL('../textures/straps/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
test('baked strap manifest references existing mobile-sized images with lossless data colorspaces',()=>{
 for(const [name,strap] of Object.entries(manifest.straps)){
  if(name==='writing') assert.ok(strap.single);else{assert.equal(strap.front.length,2);assert.equal(strap.back.length,2);}
  const materials=[...(strap.front||[]),...(strap.back||[]),...(strap.single?[strap.single]:[])];
  for(const m of materials)for(const role of ['map','normalMap','roughnessMap','sheenColorMap'])if(m[role]){
   const image=manifest.images[m[role].image];assert.ok(image);assert.match(image.src,/^[a-f0-9]{20}\.webp$/);
   assert.ok(image.width<=(role==='map'||role==='sheenColorMap'?256:128));
   assert.equal(m[role].colorSpace,role==='normalMap'||role==='roughnessMap'?'':'srgb');
   const bytes=readFileSync(new URL(image.src,base));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');if(role==='normalMap'||role==='roughnessMap')assert.ok(bytes.includes(Buffer.from('VP8L')),'data maps must use lossless WebP');
  }
 }
});
test('only the initial selected strap has a bounded transfer budget',()=>{
 const strap=manifest.straps.consulting,paths=new Set();
 for(const m of [...strap.front,...strap.back])for(const value of Object.values(m))if(value?.image)paths.add(manifest.images[value.image].src);
 assert.ok([...paths].reduce((sum,path)=>sum+statSync(new URL(path,base)).size,0)<700_000);
});
