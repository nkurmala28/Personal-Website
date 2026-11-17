// Runs the real renderer/controller initialization with real THREE geometry and
// Canvas2D textures. Only GPU rendering and layout measurements are stubbed.
// This catches missing DOM dependencies without claiming a 3D visual test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../src/package.json',import.meta.url));
const {JSDOM,VirtualConsole}=require('jsdom');
const {createCanvas}=require('@napi-rs/canvas');
const {build}=require('esbuild');
const threePath=new URL('../src/node_modules/three/build/three.module.js',import.meta.url).pathname;
const built=await build({entryPoints:[new URL('../src/main.js',import.meta.url).pathname],bundle:true,write:false,format:'iife',plugins:[{name:'gpu-test-double',setup(b){b.onResolve({filter:/^three$/},()=>({path:'three-test',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export * from ${JSON.stringify(threePath)}; import {Texture} from ${JSON.stringify(threePath)}; export class PMREMGenerator { fromScene(){return {texture:new Texture()};} dispose(){} } export class WebGLRenderer { constructor(){this.shadowMap={};this.autoClear=true;} setPixelRatio(v){this.pr=v;} getPixelRatio(){return this.pr||1;} setSize(){} render(){} compile(){} initTexture(){} setScissorTest(){} setScissor(){} clear(){} }`,resolveDir:new URL('../src',import.meta.url).pathname}));}}]});
const raw=await readFile(new URL('../index.html',import.meta.url),'utf8');
const content=await readFile(new URL('../content.js',import.meta.url),'utf8');
function setup(url,{width=1440,height=900,projectMedia=false}={}){
 const dom=new JSDOM(raw,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()});
 const w=dom.window,errors=[],frames=[];
 Object.defineProperty(w,'innerWidth',{value:width});Object.defineProperty(w,'innerHeight',{value:height});
 w.HTMLMediaElement.prototype.pause=function(){this.dataset.paused='true';};
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 w.scrollTo=(a,b)=>{w.scrollY=typeof a==='object'?a.top:b||0;};
 w.requestAnimationFrame=f=>{frames.push(f);return frames.length;};w.cancelAnimationFrame=()=>{};
 w.HTMLElement.prototype.getAnimations=()=>[];
 w.HTMLElement.prototype.animate=()=>({cancel(){},pause(){},finished:{then(fn){fn();return {catch(){}};}}});
 w.HTMLElement.prototype.scrollBy=function(options){this.scrollTop+=options.top||0;};
 w.requestIdleCallback=()=>0;
 w.setTimeout=()=>0;
 w.addEventListener('error',e=>errors.push(e.error||e.message));
 const canvases=new WeakMap();
 w.HTMLCanvasElement.prototype.getContext=function(kind){
  if(kind!=='2d')return null;
  let c=canvases.get(this);if(!c||c.width!==this.width||c.height!==this.height){c=createCanvas(this.width||300,this.height||150);canvases.set(this,c);}
  const context=c.getContext('2d');
  return new Proxy(context,{get(target,key){
    const value=Reflect.get(target,key,target);
    if(key==='drawImage'||key==='createPattern')return (image,...args)=>value.call(target,canvases.get(image)||image,...args);
    return typeof value==='function'?value.bind(target):value;
  },set(target,key,value){target[key]=value;return true;}});
 };
 Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{get(){return this.id==='stage'?width:Math.min(500,width-40);}});
 Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{get(){return this.id==='stage'?height:320;}});
 Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{get(){return this.classList.contains('rail3d')?340:22;}});
 Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',{get(){return this.dataset.rail?90:500;}});
 Object.defineProperty(w.HTMLElement.prototype,'offsetLeft',{get(){return this.dataset.rail?['consulting','engineering','quant','banking','writing'].indexOf(this.dataset.rail)*90:0;}});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:this.id==='stage'?width:Math.min(500,width-40),height:this.id==='stage'?height:320,right:500,bottom:320};};
 w.eval(content);
 if(projectMedia){w.CONTENT.projects[0].video='photos/test-preview.mp4';w.CONTENT.projects[1].image='photos/test-preview.jpg';}
 for(const script of raw.matchAll(/<script>([\s\S]*?)<\/script>/g))w.eval(script[1]);
 w.eval(built.outputFiles[0].text);
 let now=100;const tick=(n=45)=>{for(let i=0;i<n;i++){const queue=frames.splice(0);now+=50;queue.forEach(f=>f(now));}if(errors.length)throw errors[0];};
 tick();
 return {dom,w,tick,errors};
}
test('full app initializes and preserves header, roles, work routing and contact bindings',{timeout:120000},()=>{
 const {dom,w,tick}=setup('https://test.invalid/#nointro'),d=w.document,W=w.__watch;
 assert.ok(W?.work);assert.ok(d.getElementById('snd'));assert.ok(d.getElementById('vol'));
 assert.equal(d.querySelectorAll('#rail button').length,5);
 for(const k of ['silver','orge','sky','ecru','snow']){d.querySelector('[data-way="'+k+'"]').click();assert.equal(d.querySelector('[data-way="'+k+'"]').getAttribute('aria-pressed'),'true');}
 const before=d.getElementById('snd').getAttribute('aria-pressed');d.getElementById('snd').click();assert.notEqual(d.getElementById('snd').getAttribute('aria-pressed'),before);
 W.jumpTo(1);tick();
 for(const k of ['consulting','engineering','quant','banking','writing']){W.pickStrap(k);tick();assert.equal(d.getElementById('s-title').textContent,w.CONTENT.jobs[k].title);assert.ok(d.getElementById('s-selection').textContent.includes(w.CONTENT.jobs[k].chip));assert.equal(d.querySelector('[data-rail="'+k+'"]').getAttribute('aria-controls'),'s-detail');assert.ok(!d.getElementById('s-body').textContent.includes('['));assert.ok(!d.getElementById('s-years').textContent.includes('['));}
 for(const k of ['moon','sec','date']){W.openFocus(k);tick();assert.equal(W.work().focus,k);assert.equal(d.querySelector('[data-stop="'+k+'"]').getAttribute('aria-pressed'),'true');assert.equal(d.getElementById('work-stage').hidden,false);assert.ok(!/Opened|Current|Open$/.test(d.querySelector('.stops').textContent));d.getElementById('f-next').click();tick();W.jumpTo(2);tick();assert.equal(W.work().focus,null);}
 W.jumpTo(6);tick();
 for(const k of ['soccer','cooking','snow','music']){d.querySelector('[data-interest="'+k+'"]').click();tick();assert.ok(!d.getElementById('int-list').textContent.includes('['));d.getElementById('int-back').click();tick();}
 W.jumpTo(7);tick();assert.equal(d.getElementById('contact-email').getAttribute('href'),'mailto:'+w.CONTENT.contact.email);
 dom.window.close();
});
test('intro has a one-click open and an immediate skip',{timeout:120000},()=>{
 const {dom,w,tick}=setup('https://test.invalid/#intro');
 assert.equal(w.__watch.introState().need,1);
 const skip=w.document.getElementById('intro-skip');
 skip.focus();
 const key=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});skip.dispatchEvent(key);
 assert.equal(key.defaultPrevented,false);assert.equal(w.__watch.introState().open,false);
 skip.click();tick();
 assert.equal(w.__watch.introState().on,false);
 assert.equal(w.document.body.classList.contains('intro'),false);
 dom.window.close();
});


test('work previews switch real media, pause videos, and close with the collection',{timeout:120000},()=>{
 const {dom,w,tick}=setup('https://test.invalid/#nointro',{projectMedia:true}),d=w.document,W=w.__watch;
 W.openFocus('moon');tick();
 const video=d.querySelector('#f-media video');assert.ok(video);assert.equal(video.autoplay,false);
 const seek=new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});video.dispatchEvent(seek);assert.equal(seek.defaultPrevented,false);
 d.querySelector('.work-reading').scrollTop=180;W.stepFocus(1);tick();assert.equal(d.querySelector('.work-reading').scrollTop,0);assert.equal(video.dataset.paused,'true');assert.ok(d.querySelector('#f-media img').src.endsWith('test-preview.jpg'));
 W.stepFocus(1);tick();assert.equal(d.getElementById('f-media').hidden,true);
 d.querySelector('.work-reading').scrollTop=100;W.openFocus('date');tick();assert.equal(d.querySelector('.work-reading').scrollTop,0);
 for(let i=0;i<w.CONTENT.film.length;i++){
  const image=d.querySelector('#f-media img');assert.ok(image.src.endsWith(w.CONTENT.film[i].file));assert.equal(image.alt,w.CONTENT.film[i].title);
  assert.equal(d.getElementById('preview-count').textContent,String(i+1).padStart(2,'0')+' / 07');
  W.stepFocus(1);tick();
 }
 W.openFocus('sec');tick();assert.equal(d.getElementById('f-media').hidden,true);
 W.jumpTo(2);tick();assert.equal(d.getElementById('work-stage').hidden,true);
 assert.ok(W.pose().every(Number.isFinite));dom.window.close();
});
test('narrow-screen controller keeps previews and navigation usable',{timeout:120000},()=>{
 const {dom,w,tick}=setup('https://test.invalid/#nointro',{width:375,height:667}),d=w.document,W=w.__watch;
 W.openFocus('date');tick();assert.equal(d.querySelectorAll('#rail button').length,5);
 assert.equal(d.getElementById('work-stage').hidden,false);
 assert.ok(parseFloat(d.getElementById('work-stage').style.getPropertyValue('--preview-height'))>0);
 const reading=d.querySelector('.work-reading');Object.defineProperty(reading,'scrollHeight',{value:900});tick(5);
 assert.equal(d.getElementById('more').classList.contains('on'),true);d.getElementById('more').click();
 assert.ok(reading.scrollTop>0);assert.equal(d.getElementById('focus').scrollTop,0);
 assert.ok(W.pose().every(Number.isFinite));
 W.jumpTo(1);tick();d.querySelector('[data-rail="writing"]').click();tick();
 assert.ok(d.getElementById('s-selection').textContent.includes('Journalism'));
 dom.window.close();
});
