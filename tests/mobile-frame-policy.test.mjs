import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMobileFramePolicy} from '../src/mobile-frame-policy.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function runFrames(policy, from, to, state) {
  let count = 0;
  for (let i = Math.ceil(from * 60 / 1000); i <= Math.floor(to * 60 / 1000); i++) {
    if (policy.shouldFrame(i * 1000 / 60, state)) count++;
  }
  return count;
}

test('settled mobile front pages update once a second instead of at display refresh rate', () => {
  const policy = createMobileFramePolicy();
  const state = {mobile:true, signature:'home:390:844:0'};
  runFrames(policy, 0, 1200, state);
  const frames = runFrames(policy, 1217, 11200, state);
  assert.ok(frames >= 9 && frames <= 11, `rendered ${frames} idle frames over ten seconds`);
});

test('rear movement remains animated at thirty frames per second and games retain sixty', () => {
  const policy = createMobileFramePolicy();
  const back = {mobile:true, signature:'about', live:true};
  runFrames(policy,0,1200,back);
  const frames = runFrames(policy,1217,11200,back);
  assert.ok(frames >= 295 && frames <= 305, `rendered ${frames} rear-movement frames`);
  const game = {...back, signature:'soccer', interactive:true};
  const gameFrames = runFrames(policy,11217,12200,game);
  assert.ok(gameFrames >= 58 && gameFrames <= 60);
});

test('a new page or resize wakes immediately and gives transitions time to settle', () => {
  const policy = createMobileFramePolicy();
  const home = {mobile:true, signature:'home:390'};
  runFrames(policy,0,2000,home);
  assert.equal(policy.shouldFrame(2001,{...home,signature:'experience:390'}),true);
  assert.equal(policy.shouldFrame(2002,{...home,signature:'experience:844'}),true);
  assert.equal(policy.shouldFrame(2018.7,{...home,signature:'experience:844'}),true);
});

test('an asset or DOM wake resumes idle updates without cancelling a longer wake', () => {
  const policy = createMobileFramePolicy();
  const state = {mobile:true,signature:'home'};
  runFrames(policy,0,2000,state);
  policy.wake(2010,1500);
  policy.wake(2020,10);
  assert.equal(policy.shouldFrame(2033.4,state),true);
  assert.equal(policy.shouldFrame(3400,state),true);
  assert.equal(policy.shouldFrame(3416.7,state),true);
});

test('desktop remains uncapped, hidden pages pause, and first mobile paint is never skipped', () => {
  const policy = createMobileFramePolicy();
  for (let now = 0; now < 10; now++) assert.equal(policy.shouldFrame(now,{mobile:false}),true);
  assert.equal(policy.shouldFrame(20,{mobile:true,hidden:true,first:true}),false);
  assert.equal(policy.shouldFrame(21,{mobile:true,first:true}),true);
  assert.equal(policy.shouldFrame(22,{mobile:true,first:true}),true);
});

test('invalid scheduling rates fail before they can stall the render loop', () => {
  for (const options of [{idleHz:0},{liveHz:NaN},{interactionHz:-1},{settleMs:-1}]) assert.throws(()=>createMobileFramePolicy(options),RangeError);
});

// Exercise the actual frame entry point: gating must happen before layout, scene
// simulation and draw work, while the browser still receives its next callback.
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const frameStart = source.indexOf('async function frame(now) {');
const frameGate = source.slice(frameStart, source.indexOf('  pace(', frameStart)) + "updated++; return 'updated'; }";
function sceneContext(overrides = {}) {
  const context = {
    document:{hidden:false}, last:0, queued:0, updated:0,
    mobileViewport:{matches:true}, mobileFrames:createMobileFramePolicy(),
    first:false, mobileChapter:0, scrollY:0, innerWidth:390, innerHeight:844,
    focus:null, zoomK:null, strapNow:'consulting', way:'silver', muted:true,
    cur:0, CD:2, CB:6, cz:0, intro:{on:false}, jump:null, down:null,
    swapT:-1, armDrag:null, PAN:{tgt:null}, slide:null, PIT:{mode:'ready'}, QR:[],
    tx:0, ty:0, dragX:0, dragY:0, hy:0, heroYaw:0, hp:0, heroPitch:0,
    watchBootFailed:()=>{}, ...overrides,
  };
  context.requestAnimationFrame = () => { context.queued++; };
  runInNewContext(frameGate, context);
  return context;
}
test('actual mobile frame entry skips all scene work at rest and wakes for a chapter', async () => {
  const scene = sceneContext();
  await scene.frame(0); await scene.frame(1000);
  assert.equal(await scene.frame(1001),undefined);
  assert.equal(scene.updated,2);
  assert.equal(scene.queued,1);
  assert.equal(scene.last,0,'skipped callbacks must not reset simulation time');
  scene.mobileChapter = scene.cur = 1;
  assert.equal(await scene.frame(1002),'updated');
});
test('actual frame entry preserves rear movement and interactive soccer rates', async () => {
  const scene = sceneContext({cur:6,mobileChapter:6});
  await scene.frame(0); await scene.frame(1200);
  assert.equal(await scene.frame(1217),undefined);
  assert.equal(await scene.frame(1233.4),'updated');
  scene.zoomK='soccer'; scene.PIT.mode='fly';
  await scene.frame(1300);
  assert.equal(await scene.frame(1316.7),'updated');
  // A hidden game does not force the unrelated front pages to keep animating.
  scene.zoomK=null; scene.cur=scene.mobileChapter=0;
  await scene.frame(1400); await scene.frame(2500);
  assert.equal(await scene.frame(2516.7),undefined);
});
test('actual desktop frame entry keeps the existing loop unrestricted', async () => {
  const scene = sceneContext({mobileViewport:{matches:false}});
  for (let now=0;now<5;now++) assert.equal(await scene.frame(now),'updated');
  assert.equal(scene.queued,0);
});
test('phone audio starts muted with an accurate button and enables only on request', () => {
  const initial = source.match(/let actx = null, muted = [^;]+;/)[0];
  const audioStart = source.indexOf('function audioOn()');
  const audioOn = source.slice(audioStart, source.indexOf('function ping(',audioStart));
  const controlStart = source.indexOf("const sndBtn = $('snd')");
  const controls = source.slice(controlStart,source.indexOf('await bootYield(',controlStart));
  for (const phone of [true,false]) {
    const button={dataset:{},setAttribute(k,v){this[k]=String(v);}}, slider={value:50};
    let contexts=0;
    const context={mobileViewport:{matches:phone},$:(id)=>id==='snd'?button:slider,
      window:{AudioContext:function(){contexts++;this.createGain=()=>({gain:{},connect(){}});}}};
    runInNewContext(initial+audioOn+controls,context);
    assert.equal(contexts,0,'initializing controls must not initialize audio');
    if(phone) {
      assert.equal(+slider.value,0);
      assert.equal(button['aria-label'],'Sound off');
      assert.equal(button['aria-pressed'],'false');
      button.onclick();
      assert.equal(contexts,1);
      assert.equal(+slider.value,50);
      assert.equal(button['aria-pressed'],'true');
    } else assert.equal(+slider.value,50);
  }
});

test('native reading scrolls do not restart the watch loop, but canvas and controls wake it', () => {
  const start=source.indexOf('const mobileFrames = createMobileFramePolicy()');
  const end=source.indexOf('const bakedStraps =',start);
  const listeners=new Map(), canvas={}, sheet={}; let wakes=0;
  const listen=(name,handler)=>listeners.set(name,handler);
  runInNewContext(source.slice(start,end),{
    createMobileFramePolicy:()=>({wake(){wakes++;}}),
    mobileViewport:{matches:true,addEventListener:listen}, canvas,
    performance:{now:()=>100},addEventListener:listen,
    document:{addEventListener:listen},
  });
  assert.equal(listeners.has('scroll'),false);
  listeners.get('pointerdown')({type:'pointerdown',target:sheet});
  listeners.get('touchmove')({type:'touchmove',target:sheet});
  assert.equal(wakes,0);
  listeners.get('pointerdown')({type:'pointerdown',target:canvas});
  listeners.get('click')({type:'click',target:sheet});
  listeners.get('watch-surface-ready')({type:'watch-surface-ready'});
  assert.equal(wakes,3);
});
