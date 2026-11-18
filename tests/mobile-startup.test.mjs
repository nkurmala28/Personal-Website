import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
const initialization = source.slice(source.indexOf('let pillowReady = false;'),
  source.indexOf('/* the lid is two leaves'));

test('normal mobile startup skips cushion work and can initialize it later exactly once',()=>{
  const calls=[];
  const state={
    mobileViewport:{matches:true},intro:{on:false},mPillow:{},
    makePillowTextures(){calls.push('textures');return {tc:'color',tn:'normal'};},
    preparePillowCase(){calls.push('case');},
    preparePillowShape(){calls.push('shape');},
    buildPillowMesh(){calls.push('mesh');}
  };
  vm.createContext(state);
  vm.runInContext(initialization,state);
  assert.deepEqual(calls,[]);
  vm.runInContext('ensurePillow(); ensurePillow();',state);
  assert.deepEqual(calls,['textures','case','shape','mesh']);
  assert.equal(state.mPillow.map,'color');
  assert.equal(state.mPillow.normalMap,'normal');
  assert.equal(state.mPillow.needsUpdate,true);
});

test('desktop and explicit intro previews retain the full cushion at startup',()=>{
  for(const [mobile, intro] of [[false,false],[true,true]]){
    let builds=0;
    const state={mobileViewport:{matches:mobile},intro:{on:intro},mPillow:{},
      makePillowTextures:()=>({tc:'color',tn:'normal'}),
      preparePillowCase(){},preparePillowShape(){},buildPillowMesh(){builds++;}};
    vm.createContext(state); vm.runInContext(initialization,state);
    assert.equal(builds,1);
  }
});

test('Film thumbnails do not download until the Projects hub requests them',()=>{
  const gallery=html.match(/<span class="wth wfilm"[^>]*>(.*?)<\/span>/)[1];
  assert.equal((gallery.match(/data-src=/g)||[]).length,3);
  assert.equal(/\ssrc=/.test(gallery),false);
  assert.match(source,/if \(act === CD\) document.querySelectorAll\('\.wfilm img\[data-src\]'\)/);
});
