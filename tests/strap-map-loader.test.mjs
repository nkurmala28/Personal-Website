import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStrapMapLoader} from '../src/strap-map-loader.mjs';
const vec=()=>({value:[],set(...v){this.value=v;}});
const description={image:'one',repeat:[-1,1],offset:[1,0],center:[0,0],rotation:0,flipY:true,wrapS:1000,wrapT:1000,colorSpace:'',anisotropy:8,minFilter:1008,magFilter:1006,generateMipmaps:true};
const metadata={images:{one:{src:'one.webp'}},straps:{consulting:{front:[{normalMap:description,normalScale:[.2,.3]},{map:{...description,colorSpace:'srgb'}}],back:[{normalMap:description},{normalMap:description}]}}};
const texture=()=>({clone(){return {repeat:vec(),offset:vec(),center:vec()};}});
const material=()=>({normalScale:vec()});
test('baked maps deduplicate source images and preserve mirrored UV and data colorspace',async()=>{
 let downloads=0,manifests=0;
 const loader=createStrapMapLoader({}, {baseUrl:'https://example.com/textures/',fetch:async()=>{manifests++;return {ok:true,json:async()=>metadata};},loadTexture:async()=>{downloads++;return texture();}});
 await Promise.all([loader.prepare('consulting'),loader.prepare('consulting')]);
 assert.equal(downloads,1);assert.equal(manifests,1);
 const strap={mats:[material(),material()],backs:[material(),material()]};assert.equal(loader.apply('consulting',strap),true);
 assert.deepEqual(strap.mats[0].normalMap.repeat.value,[-1,1]);assert.deepEqual(strap.mats[0].normalMap.offset.value,[1,0]);
 assert.deepEqual(strap.mats[0].normalScale.value,[.2,.3]);assert.equal(strap.mats[0].normalMap.colorSpace,'');assert.equal(strap.mats[1].map.colorSpace,'srgb');assert.equal(strap.dressed,true);
 assert.equal(loader.apply('missing',strap),false);
});
test('a failed texture request can retry without falling back to per-pixel baking',async()=>{
 let downloads=0;
 const loader=createStrapMapLoader({}, {baseUrl:'https://example.com/',fetch:async()=>({ok:true,json:async()=>metadata}),loadTexture:async()=>{downloads++;if(downloads===1)throw Error('offline');return texture();}});
 await assert.rejects(loader.prepare('consulting'),/offline/);
 await loader.prepare('consulting');assert.equal(loader.isPrepared('consulting'),true);assert.equal(downloads,2);
});
test('an untextured strap does not request images',async()=>{
 let downloads=0;
 const loader=createStrapMapLoader({}, {baseUrl:'https://example.com/',fetch:async()=>({ok:true,json:async()=>metadata}),loadTexture:async()=>{downloads++;return texture();}});
 assert.equal(await loader.prepare('engineering'),false);assert.equal(downloads,0);
});

 test('a stalled network request has a bounded wait and can be retried',async()=>{
  let calls=0;
  const loader=createStrapMapLoader({}, {baseUrl:'https://example.com/',timeoutMs:5,fetch:async()=>({ok:true,json:async()=>metadata}),loadTexture:()=>{calls++;return calls===1?new Promise(()=>{}):Promise.resolve(texture());}});
  await assert.rejects(loader.prepare('consulting'),/too long/);await loader.prepare('consulting');assert.equal(calls,2);
 });
