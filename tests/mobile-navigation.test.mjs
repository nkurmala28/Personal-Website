import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
// Execute the application functions themselves, with browser scrolling recorded
// separately from the reader's native scroll position.
function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const open = source.indexOf('{', start);
  let depth = 1, end = open + 1;
  for (; depth && end < source.length; end++) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
  }
  assert.equal(depth, 0);
  return source.slice(start, end);
}

function fixture() {
  const classes = new Set(['snap']);
  const sheets = Array.from({ length: 8 }, () => ({ scrollTop: 90 }));
  const scrolls = [];
  const state = {
    PITCH: 900, pitchW: 1200, mobileChapter: 0, navigationReady: true,
    innerWidth: 390, innerHeight: 844, scrollY: 4500,
    SNAP: true, mobileViewport: { matches: true }, track: { style: {} },
    marks: Array.from({ length: 8 }, () => ({ style: {} })), N: 8,
    cur: 5, jump: null, caught: [], sPrev: 0, lockOff: false,
    STOP: ['moon', 'sec', 'date'], WORK0: ['moon', 'sec', 'date'],
    focus: null, CD: 2, reduce: true, SLAST: 4, workHold: null,
    stopOf: c => c <= 2 ? c : c < 6 ? 2 : c - 6 + 3,
    document: { documentElement: { classList: {
      contains: name => classes.has(name),
      toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
    } } },
    syncSectionLabels() {}, stopsPaint() {},
    sheetOf: i => sheets[i],
    stopKey: c => c >= 3 && c <= 5 ? state.STOP[c - 3] : null,
    stopCh: key => 3 + state.STOP.indexOf(key),
    total: () => state.PITCH * (state.N - 1),
    window: { scrollTo(...args) {
      const top = typeof args[0] === 'object' ? args[0].top : args[1];
      scrolls.push(top); state.scrollY = top;
    } }, Math
  };
  vm.createContext(state);
  vm.runInContext(['pitchSet', 'jumpTo', 'closeFocus', 'workOrder', 'brakeCheck']
    .map(functionSource).join('\n'), state);
  return { state, classes, sheets, scrolls };
}

test('entering phone mode preserves the selected section and removes document snapping', () => {
  const { state: s, classes, scrolls } = fixture();
  s.pitchSet();
  assert.equal(s.mobileChapter, 5); assert.equal(s.cur, 5);
  assert.equal(classes.has('mobile-tabs'), true);
  assert.equal(classes.has('snap'), false);
  assert.equal(s.track.style.height, '100dvh');
  assert.deepEqual(scrolls, [0]);
});

test('phone section selection resets its reader without scrolling the document or waiting for a jump', () => {
  const { state: s, sheets, scrolls } = fixture();
  let callback = 0;
  s.jumpTo(3, () => callback++);
  assert.equal(s.cur, 3); assert.equal(s.mobileChapter, 3);
  assert.equal(s.jump, null); assert.equal(sheets[3].scrollTop, 0);
  assert.equal(sheets[6].scrollTop, 90);
  assert.equal(callback, 1); assert.deepEqual(scrolls, []);
});

test('resizing across phone and desktop widths preserves the section in both directions', () => {
  const { state: s, classes } = fixture();
  s.pitchSet(); s.jumpTo(3);
  s.innerWidth = 844; s.innerHeight = 390; s.mobileViewport.matches = false;
  s.pitchSet();
  assert.equal(classes.has('snap'), true);
  // a piece of work has no scroll stop of its own: the page waits on the Work stop while it is open
  assert.equal(s.scrollY, 2 * s.PITCH); assert.equal(s.cur, 3); assert.equal(s.workHold, 3);
  s.innerWidth = 390; s.innerHeight = 844; s.mobileViewport.matches = true;
  s.pitchSet();
  assert.equal(s.cur, 3); assert.equal(s.mobileChapter, 3);
  assert.equal(s.scrollY, 0); assert.equal(classes.has('snap'), false);
});

test('phone browser toolbar height changes do not reset the reader or section', () => {
  const { state: s, sheets, scrolls } = fixture();
  s.pitchSet(); s.jumpTo(6); sheets[6].scrollTop = 180;
  scrolls.length = 0; s.innerHeight = 760; s.pitchSet();
  assert.equal(s.mobileChapter, 6); assert.equal(sheets[6].scrollTop, 180);
  assert.deepEqual(scrolls, []);
});

test('entering phone mode restores stable Work order without changing the selected category', () => {
  const { state: s } = fixture();
  s.STOP.splice(0, 3, 'date', 'moon', 'sec'); s.cur = 3;
  s.pitchSet();
  assert.deepEqual(Array.from(s.STOP), ['moon', 'sec', 'date']);
  assert.equal(s.cur, 5); assert.equal(s.mobileChapter, 5);
});

test('closing Work detail returns to the Work hub on phone without document scrolling', () => {
  const { state: s, scrolls } = fixture();
  s.focus = 'date'; s.cur = 5; s.closeFocus();
  assert.equal(s.mobileChapter, 2); assert.equal(s.cur, 2);
  assert.deepEqual(scrolls, []);
  s.focus = null; s.cur = 6; s.closeFocus(); assert.equal(s.cur, 6);
});

test('phone reading bypasses desktop scroll detents entirely', () => {
  const { state: s, scrolls } = fixture();
  // Desktop-only dependencies are deliberately absent. A phone must return first.
  assert.doesNotThrow(() => s.brakeCheck()); assert.deepEqual(scrolls, []);
});

test('phone section changes animate from the current pose without scrolling the document', () => {
  const {state:s, sheets, scrolls} = fixture();
  s.reduce = false;
  s.cur = 1;
  s.K = Array.from({length:8}, (_,i)=>({ry:i===6?180:0,sy:i>=2?16:0}));
  s.BG = Array.from({length:8},()=>[13,17,23]);
  s.lastPose = {ry:0,sy:0};
  s.zNow = {fe:0,c:[0,0],s:1,r:1,k:null};
  s.zsnap = ()=>({fe:0,c:[0,0],s:1,r:1,k:null});
  s.jumpTo(2);
  assert.equal(s.mobileChapter,2);
  assert.equal(s.jump.duration,.65);
  assert.equal(s.jump.from,s.lastPose);
  assert.equal(s.jump.to.sy,16);
  assert.equal(sheets[2].scrollTop,0);
  assert.deepEqual(scrolls,[]);
  // A new destination replaces an in-progress transition from the last rendered pose.
  s.lastPose = {ry:40,sy:8};
  s.jumpTo(6);
  assert.equal(s.mobileChapter,6);
  assert.equal(s.jump.from.ry,40);
  assert.equal(s.jump.to.ry,180);
  assert.deepEqual(scrolls,[]);
});
