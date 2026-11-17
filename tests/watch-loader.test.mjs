import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="watch-loader">([\s\S]*?)<\/script>/)[1];

function fixture(reduced = false) {
  const events = {}, tasks = [], classes = new Set(); let reloads = 0;
  const node = () => ({ hidden: false, textContent: '', dataset: {}, style: { setProperty() {} }, setAttribute(k,v) { this[k] = v; }, addEventListener(k,v) { this[k] = v; } });
  const loader = node(), message = node(), retry = node(); retry.hidden = true;
  loader.dataset.state = 'loading'; loader['aria-busy'] = 'true'; message.textContent = 'Winding up…';
  loader.querySelector = selector => selector === '.msg' ? message : node();
  const nodes = { load: loader, 'load-retry': retry, 'ld-ticks': node(), 'ld-h': node(), 'ld-m': node() };
  const ctx = {
    document: { getElementById: id => nodes[id], body: { classList: { add: k => classes.add(k) } }, addEventListener() {} },
    window: {}, Date, Math, location: { reload() { reloads++; } },
    matchMedia: () => ({matches: reduced}), setTimeout: (fn, delay) => tasks.push({fn, delay}),
    addEventListener: (name, fn) => { events[name] = fn; }
  };
  vm.createContext(ctx); vm.runInContext(script, ctx);
  return { boot: ctx.window.__watchBoot, loader, message, retry, tasks, classes, events, reloads: () => reloads };
}

test('loader has no estimated completion timer and stays active until a real ready signal', () => {
  const f = fixture();
  assert.equal(f.tasks.length, 0);
  f.boot.stage('Setting the dial…');
  assert.equal(f.message.textContent, 'Setting the dial…');
  assert.equal(f.loader.dataset.state, 'loading'); assert.equal(f.classes.has('ready'), false);
  f.boot.ready();
  assert.equal(f.classes.has('ready'), true); assert.equal(f.loader['aria-busy'], 'false');
  assert.equal(f.loader.dataset.state, 'complete');
  assert.equal(f.tasks[0].delay, 260); // only the visual exit, not a forced loading duration
  f.tasks[0].fn(); assert.equal(f.loader.hidden, true);
});

test('script failure offers retry instead of falsely completing', () => {
  const f = fixture();
  f.events.error({ target: { tagName: 'SCRIPT', src: '/bundle.20261117-loading.js' } });
  assert.equal(f.loader.dataset.state, 'error'); assert.equal(f.retry.hidden, false);
  assert.match(f.message.textContent, /couldn’t load/);
  f.boot.ready(); assert.equal(f.classes.has('ready'), false);
  f.retry.click(); assert.equal(f.reloads(), 1);
});

test('reduced motion and duplicate completion do not add a loading hold', () => {
  const f = fixture(true); f.boot.ready(); f.boot.ready(); f.boot.fail();
  assert.equal(f.tasks.length, 1); assert.equal(f.tasks[0].delay, 0);
  assert.equal(f.loader.dataset.state, 'complete'); assert.equal(f.retry.hidden, true);
});
