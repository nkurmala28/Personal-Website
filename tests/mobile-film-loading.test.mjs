import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('function photoTex(n)'), source.indexOf('const photoMat ='));
function fixture(mobile) {
  const canvases = [], images = [], files = Array.from({length:12}, (_,i) => ({file:`frame-${i}.jpg`}));
  const sandbox = {mobileViewport:{matches:mobile}, DATA:{date:{items:files}},
    cnv(size) { const c = {width:size,height:size,getContext(){return {fillRect(){},drawImage(){}};}}; canvases.push(c); return c; },
    cTex(c) {return {image:c,userData:{}};},
    Image:class { constructor(){images.push(this);} naturalWidth=1200;naturalHeight=800; }
  };
  vm.createContext(sandbox); vm.runInContext(block + '\nthis.load = loadPhotos; this.frames = photos;', sandbox);
  return {sandbox,canvases,images};
}
test('mobile film keeps twelve one-pixel placeholders and loads only the requested neighbours', () => {
  const {sandbox:s,canvases,images} = fixture(true);
  assert.equal(canvases.reduce((n,c)=>n+c.width*c.height,0),12);
  assert.equal(images.length,0);
  s.load(0); assert.deepEqual(images.map(i=>i.src),['photos/frame-0.jpg','photos/frame-1.jpg','photos/frame-11.jpg']);
  s.load(0); assert.equal(images.length,3);
  s.load(1); assert.equal(images.length,4); assert.equal(images[3].src,'photos/frame-2.jpg');
  images[0].onload(); assert.equal(canvases[0].width,1024); assert.equal(canvases[1].width,1); assert.equal(s.frames[0].needsUpdate,true);
});
test('desktop keeps its existing eager placeholders and one-shot prefetch', () => {
  const {sandbox:s,canvases,images} = fixture(false);
  assert.ok(canvases.every(c=>c.width===1024)); s.load(); assert.equal(images.length,12); s.load(5); assert.equal(images.length,12);
});
test('failed film downloads can retry without duplicate requests during loading', () => {
  const {sandbox:s,images} = fixture(true); s.load(0); images[0].onerror(); s.load(0); assert.equal(images.length,4); assert.equal(images[3].src,'photos/frame-0.jpg');
});
