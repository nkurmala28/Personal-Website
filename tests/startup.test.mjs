import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../src/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const script=await readFile(new URL('../startup.js',import.meta.url),'utf8');

test('startup ignores an optional photo failure and recovers from a required script failure',async()=>{
 const dom=new JSDOM('<div id="stage"><div id="load"><div class="msg"></div><a href="content-view.html">Read portfolio</a></div><div id="copy">Content</div><img><script src="watch.js"></script></div>',{runScripts:'outside-only'});
 const w=dom.window;w.setTimeout=()=>0;
 await new Promise(resolve=>w.addEventListener('DOMContentLoaded',resolve,{once:true}));
 w.eval(script);
 w.document.querySelector('img').dispatchEvent(new w.Event('error'));
 assert.equal(w.document.body.classList.contains('startup-failed'),false);
 w.document.querySelector('script').dispatchEvent(new w.Event('error'));
 assert.equal(w.document.body.classList.contains('startup-failed'),true);
 assert.ok(w.document.querySelector('.msg').textContent.includes('3D watch'));
 assert.equal(w.document.querySelector('#copy').hasAttribute('inert'),false);
 w.document.body.classList.add('ready');
 assert.equal(w.document.querySelector('#copy').hasAttribute('inert'),false);
 dom.window.close();
});
