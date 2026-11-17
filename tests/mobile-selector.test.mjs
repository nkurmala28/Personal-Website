import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('mobile selection fits immediately without beginning a rail flight',()=>{
 const text=source.slice(source.indexOf('function setStrap(k)'),source.indexOf('\n',source.indexOf('function setStrap(k)')));
 const context={RAIL:false,mobileViewport:{matches:true},swapT:4,strapNext:'old',showStrap:k=>context.fitted=k};
 vm.runInNewContext(text+';setStrap("writing");',context);
 assert.equal(context.fitted,'writing');assert.equal(context.swapT,-1);assert.equal(context.strapNext,null);
});
test('desktop selection still enters the existing rail swap path',()=>{
 const text=source.slice(source.indexOf('function setStrap(k)'),source.indexOf('\n',source.indexOf('function setStrap(k)')));
 const context={RAIL:true,mobileViewport:{matches:false},railSet:k=>{context.fitted=k;return true;}};
 vm.runInNewContext(text+';setStrap("engineering");',context);assert.equal(context.fitted,'engineering');
});
