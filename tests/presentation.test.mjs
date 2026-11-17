import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {displayText,collectionSuggestion,compositionAt} from '../src/presentation.mjs';

test('authoring placeholders never become employer, date, or caption copy',()=>{
 assert.equal(displayText('[EMPLOYER, CITY]'),'');
 assert.equal(displayText('[years]'),'');
 assert.equal(displayText('[WHERE AND WHEN]. 35mm film.'),'35mm film.');
 assert.equal(displayText('[ONE LINE ON WHAT YOU BUILT]','Details coming soon.'),'Details coming soon.');
 assert.equal(displayText('Analysis Group, San Francisco'),'Analysis Group, San Francisco');
});
test('recommendation works for any entry collection and stops when all were opened',()=>{
 for(const order of [['moon','sec','date'],['sec','moon','date'],['date','moon','sec']]){
  const seen=new Set([order[0]]);
  assert.equal(collectionSuggestion(order,order[0],seen),order[1]);
  seen.add(order[1]);assert.equal(collectionSuggestion(order,order[1],seen),order[2]);
  seen.add(order[2]);assert.equal(collectionSuggestion(order,order[2],seen),null);
 }
});
test('generated content view includes actual content and no authoring placeholders',async()=>{
 const context={window:{}};vm.runInNewContext(await readFile(new URL('../content.js',import.meta.url),'utf8'),context);
 const html=await readFile(new URL('../content-view.html',import.meta.url),'utf8');
 for(const project of context.window.CONTENT.projects)assert.ok(html.includes(project.title));
 assert.ok(html.includes('mailto:'+context.window.CONTENT.contact.email));
 assert.equal((html.match(/<figure>/g)||[]).length,7);
 assert.ok(!/\[(?:years|EMPLOYER|WHERE|ONE LINE|Artist|Mountain)/.test(html));
});


test('chapter compositions interpolate continuously and keep all camera values finite',()=>{
 for(let chapter=-1;chapter<9;chapter+=0.05){const c=compositionAt(chapter);assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.scale));assert.ok(c.scale>0.7&&c.scale<1.1);}
 assert.ok(compositionAt(1).x<compositionAt(0).x);assert.ok(compositionAt(1).scale<compositionAt(0).scale);
 for(let i=1;i<7;i++){const a=compositionAt(i-0.0001),b=compositionAt(i+0.0001);assert.ok(Math.abs(a.x-b.x)<0.001);assert.ok(Math.abs(a.scale-b.scale)<0.001);}
});
