import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test('closed mobile board sleeps while strap flights continue when busy', () => {
  const calls = [];
  const ctx = {
    jump: null, intro: { on: false }, swapT: -1, railDressAt: -1,
    rl: { el: {}, vis: 1, desk: true, t: 42 }, strapDrawer: { dialog: { open: false } },
    railG: { visible: true, updateMatrixWorld: () => calls.push('matrix') },
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)),
    railLayout: () => calls.push('layout'), railFlights: () => calls.push('flights'), natoTick: () => calls.push('nato')
  };
  vm.createContext(ctx); vm.runInContext(section('function railTick(', 'const tintC ='), ctx);
  vm.runInContext('railTick(.016, 1, 1, 0, true, 100, 100)', ctx);
  assert.equal(ctx.railG.visible, false); assert.equal(ctx.rl.vis, 0);
  assert.equal(ctx.rl.desk, false); assert.equal(ctx.rl.t, 42); assert.deepEqual(calls, []);
  ctx.swapT = 1.2;
  vm.runInContext('railTick(.016, 1, 1, 0, true, 100, 100)', ctx);
  assert.deepEqual(calls, ['layout', 'matrix', 'flights', 'nato']);
  assert.equal(ctx.rl.t, 42);
});

test('mobile layout measurements are cached until content, size, or chapter changes', () => {
  let reads = 0;
  const panels = Array.from({ length: 3 }, (_, i) => ({
    get offsetTop() { reads++; return 300 + i * 30; },
    dataset: { ch: String(i) }, classList: { toggle() {}, remove() {} },
    scrollHeight: 200, clientHeight: 200, scrollTop: 0, style: { opacity: '1' }
  }));
  const ctx = {
    panels, fEl: panels[2], topEl: { offsetHeight: 48 }, N: 3, H: 800,
    workBack: { offsetTop: 56, offsetHeight: 40 },
    sheetOf: k => panels[k], focus: null, jump: null, snap: false,
    mobL: { t: [-1, -1, -1], n: 0, top: 48, pt: -1, more: false },
    moreEl: { classList: { toggle() {} } },
    clamp: (x, a, b) => Math.max(a, Math.min(b, x)), lerp: (a, b, t) => a + (b - a) * t
  };
  vm.createContext(ctx); vm.runInContext(section('function mobMeasure()', 'const mobileLayoutObserver'), ctx);
  vm.runInContext('for (let i=0;i<20;i++) mobLayout({pe:1},1)', ctx);
  assert.equal(reads, 3);
  assert.equal(ctx.mobL.workTop, 102);
  vm.runInContext('mobLayout({pe:2},1)', ctx); assert.equal(reads, 6);
  ctx.mobL.n = 0; vm.runInContext('mobLayout({pe:2},1)', ctx); assert.equal(reads, 9);
});

test('hidden mobile board retains finite offscreen flight anchors and returns onscreen when opened', () => {
  const ctx = {
    W: 390, H: 844, RB: { top: 13, drop: 171 },
    stage: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    strapDrawer: { dialog: { open: false } },
    rl: {
      el: { getBoundingClientRect: () => ({ left: 32, top: 180, width: 358, height: 340 }) },
      cw: -1, ch: 0,
      btns: Array.from({length: 5}, () => ({})),
      slots: Array.from({length: 5}, () => ({h: {position: {x: 0}}}))
    },
    railG: { position: { set(x,y,z) { this.x=x; this.y=y; this.z=z; } }, scale: { setScalar() {} } },
    rFurn() {}, clamp: (x,a,b) => Math.max(a,Math.min(b,x))
  };
  vm.createContext(ctx); vm.runInContext(section('function railLayout(', '/* phones: the sheet is opaque'), ctx);
  vm.runInContext('railLayout(100, 200, 0)', ctx);
  assert.ok(ctx.railG.position.x > 50);
  assert.ok(ctx.rl.s > 0 && Number.isFinite(ctx.rl.s));
  assert.ok(ctx.rl.slots.every(slot => Number.isFinite(slot.h.position.x)));
  ctx.strapDrawer.dialog.open = true;
  vm.runInContext('railLayout(100, 200, 0)', ctx);
  assert.ok(ctx.railG.position.x > -50 && ctx.railG.position.x < 50);
  assert.ok(Number.isFinite(ctx.railG.position.y));
});
