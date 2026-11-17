import {readFile,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {displayText} from '../src/presentation.mjs';
const require=createRequire(new URL('../src/package.json',import.meta.url));
const {build}=require('esbuild');
const root=new URL('../',import.meta.url);
const output=await build({entryPoints:[new URL('../src/main.js',import.meta.url).pathname],bundle:true,minify:true,format:'iife',write:false});
const code=output.outputFiles[0].text;
const bundle='bundle.'+createHash('sha256').update(code).digest('hex').slice(0,8)+'.js';
let html=await readFile(new URL('index.html',root),'utf8');
const old=html.match(/<script src="\.\/(bundle\.[^"]+\.js)"><\/script>/);
if(!old)throw Error('Expected one watch bundle');
await writeFile(new URL(bundle,root),code);
html=html.replace(old[1],bundle);await writeFile(new URL('index.html',root),html);
if(old[1]!==bundle)await rm(new URL(old[1],root),{force:true});
const context={window:{}};vm.runInNewContext(await readFile(new URL('content.js',root),'utf8'),context);const C=context.window.CONTENT;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,title)=>url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(title)} ↗</a>`:'';
const cards=(items)=>items.map(x=>`<article><h3>${esc(x.title)}</h3><p>${esc(displayText(x.text,'Details coming soon.'))}</p>${link(x.link,x.linkText||'View')}</article>`).join('');
const plain=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(C.name)} · Portfolio</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:#10161d;color:#ecebe5;font:16px/1.7 system-ui,sans-serif}main{max-width:980px;margin:auto;padding:65px 28px}header{padding:30px 0 50px}h1,h2,h3{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(45px,7vw,75px);margin:15px 0}h2{font-size:38px}h3{font-size:25px;margin:0 0 12px}p{color:#b6c0c9;max-width:42em}a{color:#dcb872;text-underline-offset:5px}nav{display:flex;gap:20px;flex-wrap:wrap;font-size:13px}section{padding:25px 0;border-top:1px solid #ffffff24;margin-bottom:30px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{border-top:1px solid #ffffff24;padding:20px 0}.meta{font:12px/1.6 ui-monospace,monospace;color:#dcb872}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.photos figure{margin:0}.photos img{width:100%;height:230px;object-fit:cover}.photos figcaption{font-size:12px;color:#b6c0c9}footer{border-top:1px solid #ffffff24;padding-top:25px}details summary{cursor:pointer}details{margin-top:20px;font-size:13px}@media(max-width:600px){.grid{grid-template-columns:1fr;gap:8px}.photos{grid-template-columns:1fr 1fr}.photos img{height:200px}main{padding:30px 22px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><main><header><span class="meta">Strategy · Data · Software</span><h1>${esc(C.name)}</h1><p>An economic consultant who builds tools and used to write about watches.</p><nav><a href="#experience">Experience</a><a href="#projects">Projects</a><a href="#writing">Writing</a><a href="#film">Film</a><a href="#about">About</a><a href="#contact">Contact</a></nav><p><a href="./index.html#nointro">Try the interactive watch ↗</a></p></header>
<section id="experience"><h2>Experience</h2><div class="grid">${C.jobOrder.map(k=>{const j=C.jobs[k];return `<article><h3>${esc(j.title)}</h3><div class="meta">${esc([displayText(j.place),displayText(j.years)].filter(Boolean).join(' · '))}</div><p>${esc(displayText(j.text,'More about this chapter soon.'))}</p>${link(j.link,j.linkText)}</article>`}).join('')}</div></section>
<section id="projects"><h2>Projects</h2><div class="grid">${cards(C.projects)}</div></section><section id="writing"><h2>Writing</h2><p>${esc(C.articlesNote)}</p><div class="grid">${cards(C.articles)}</div></section>
<section id="film"><h2>Film</h2><div class="photos">${C.film.map(f=>`<figure><img src="./photos/${esc(f.file)}" alt="${esc(f.title)}" loading="lazy"><figcaption>${esc(f.title)} · ${esc(displayText(f.caption,'35mm film.'))}</figcaption></figure>`).join('')}</div></section>
<section id="about"><h2>What makes me tick</h2><p>Singapore → UCLA → San Francisco</p><div class="grid">${cards(Object.values(C.interests).map(interest=>({...interest,text:interest.text.replace(' Take the pan by the handle and give it a shake.','')})))}</div></section><footer id="contact"><h2>Let's talk.</h2><p>${link('mailto:'+C.contact.email,'Email Nikhil')} · ${link(C.contact.linkedin,'LinkedIn')}</p><p>${C.contact.resume?link(C.contact.resume,'Resume (PDF)'):'Resume on request'}</p></footer></main></body></html>`;
await writeFile(new URL('content-view.html',root),plain);
console.log('Built '+bundle+' and content-view.html');
