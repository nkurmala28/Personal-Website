import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function fixture(){
 const pending={},fitted=[],nodes={};
 const chips=['consulting','quant','writing'].map(key=>({dataset:{strap:key},setAttribute(){},removeAttribute(){}}));
 const context={mobileViewport:{matches:true},upGone:false,STRAPS:Object.fromEntries(chips.map(c=>[c.dataset.strap,{maps(){},name:c.dataset.strap}])),chips,
  bakedStraps:{isPrepared:()=>false,prepare:key=>new Promise((resolve,reject)=>pending[key]={resolve,reject})},setStrap:key=>fitted.push(key),RAIL:false,rl:{},
  ROLES:Object.fromEntries(chips.map(c=>[c.dataset.strap,[c.dataset.strap,'description','','','place']])),RJ:{years:{}},$:id=>nodes[id]||=( {} ),console:{warn(){}}};
 vm.createContext(context);const start=source.indexOf('let strapRequest =');
 vm.runInContext(source.slice(start,source.indexOf('/* the plate\'s change:',start)),context);
 return {context,pending,fitted};
}
test('rapid strap taps cannot let an older texture download replace the latest choice',async()=>{
 const f=fixture();const first=f.context.pickStrap('quant'),last=f.context.pickStrap('writing');
 f.pending.writing.resolve(true);await last;f.pending.quant.resolve(true);await first;
 assert.deepEqual(f.fitted,['writing']);
});
test('a failed strap download keeps the current strap and a later tap can retry',async()=>{
 const f=fixture();const first=f.context.pickStrap('quant');f.pending.quant.reject(Error('offline'));await first;assert.deepEqual(f.fitted,[]);
 const retry=f.context.pickStrap('quant');f.pending.quant.resolve(true);await retry;assert.deepEqual(f.fitted,['quant']);
});
