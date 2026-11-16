/* Content and controls are prepared before the existing watch renderer binds them. */
(() => {
'use strict';
const $=s=>document.querySelector(s), body=document.body, C=window.CONTENT || {};
body.classList.add('editorial-mock');
C.jobOrder=['consulting','engineering','quant','banking','writing'];
Object.values(C.interests || {}).forEach(v=>{v.list=(v.list||[]).filter(x=>!x.includes('['));if(!v.list.length)v.listTitle='';});
(C.projects||[]).forEach(v=>{if(v.text.includes('['))v.text='More about this project soon.';});
(C.film||[]).forEach(v=>{if(v.caption.includes('['))v.caption='35mm film.';});
Object.values(C.jobs||{}).forEach(v=>{if(v.text.includes('['))v.text='More about this chapter soon.';if(v.place?.includes('['))v.place='';if(v.years?.includes('['))v.years='';});
const home=$('.panel[data-ch="0"]');
home.insertAdjacentHTML('afterbegin','<div class="part home-kicker">Strategy · Data · Software</div>');
home.insertAdjacentHTML('beforeend','<h2 class="home-position">High velocity generalist.</h2><p class="home-intro">I work in economic consulting and build tools on the side. Before that, I wrote about watches.</p><p class="home-note">This one holds a few things about me.</p><div class="home-location">Based in San Francisco</div>');
const exp=$('.panel[data-ch="1"]');
exp.querySelector('.part').textContent='01 / Experience';
exp.querySelector('h2').textContent='Experience';exp.querySelector('h2').classList.add('sr');
exp.querySelector(':scope > p').remove();
exp.insertAdjacentHTML('beforeend','<div class="hanger-caption"><span>Choose a strap. Change the story.</span><span>Recent → Earlier</span></div>');
const work=$('.panel[data-ch="2"]');
work.innerHTML='<div class="part">02 / Selected work</div><h2>A few things<br>outside the day job.</h2><p class="work-intro">Built, written, or caught on film.<br>Each lives in a different part of the dial.</p><div class="work-choices"><button data-open="moon" data-preview="moon"><span class="work-number">01</span><span class="work-copy"><strong>Projects</strong><span>Notch, local agents, and experiments.</span></span><span class="work-arrow">↗</span></button><button data-open="sec" data-preview="sec"><span class="work-number">02</span><span class="work-copy"><strong>Writing</strong><span>Watch stories for Wrist Review.</span></span><span class="work-arrow">↗</span></button><button data-open="date" data-preview="date"><span class="work-number">03</span><span class="work-copy"><strong>Film</strong><span>Seven frames. Shot on 35mm.</span></span><img class="work-thumb" src="./photos/01.jpg" alt="" width="34" height="43"><span class="work-arrow">↗</span></button></div>';
$('#hots').insertAdjacentHTML('afterbegin','<button class="hot work-pin" data-ch="2" data-k="moon" data-open="moon" aria-label="Open projects"><span>Projects</span></button><button class="hot work-pin" data-ch="2" data-k="sec" data-open="sec" aria-label="Open writing"><span>Writing</span></button><button class="hot work-pin" data-ch="2" data-k="date" data-open="date" aria-label="Open film"><span>Film</span></button>');
const about=$('.panel[data-ch="6"]');
about.querySelector(':scope > .part').textContent='03 / About';
$('#int-hint').textContent='Pick a part of the movement to get to know me.';
about.querySelector('.signlab').hidden=true;about.querySelector('.rows.sign').hidden=true;
$('#int-hint').insertAdjacentHTML('beforebegin','<p class="provenance">Singapore <span>→</span> UCLA <span>→</span> San Francisco</p><div class="interest-choices"><button data-interest="soccer"><span>01</span>Football <i>↗</i></button><button data-interest="cooking"><span>02</span>Cooking <i>↗</i></button><button data-interest="snow"><span>03</span>Snowboarding <i>↗</i></button><button data-interest="music"><span>04</span>Music <i>↗</i></button></div>');
// Put appearance options behind a native, keyboard-operable disclosure.
const ways=$('#top .ways'), sound=$('#top .sndw'), resume=$('#top .tr > a');
const tools=document.createElement('div');tools.className='header-tools';
const picker=document.createElement('details');picker.id='dial-picker';picker.innerHTML='<summary><span class="dial-dot"></span>Dial <span class="disclosure-chevron">⌄</span></summary><div class="dial-menu"><div class="menu-label">Dial finish</div></div>';
picker.querySelector('.dial-menu').appendChild(ways);
ways.querySelector('.small').hidden=true;
tools.append(picker,sound,resume);$('#top').appendChild(tools);$('#top .tr').remove();
$('#home').insertAdjacentHTML('afterend','<button id="wordmark" data-go="0" aria-label="Nikhil Kurmala, home">NK<span> / Nikhil Kurmala</span></button>');
$('#stage').insertAdjacentHTML('beforeend','<nav id="editorial-nav" aria-label="Portfolio"><button data-go="0">Start</button><button data-go="1">Experience</button><button data-go="2">Work</button><button data-go="6">About</button><button data-go="7">Contact</button></nav><button id="scroll-cue" data-go="1" aria-label="Scroll to experience"><svg viewBox="0 0 24 38" aria-hidden="true"><path d="M12 2v29M5 24l7 8 7-8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></button>');
$('#focus').insertAdjacentHTML('afterbegin','<button class="back-to-work" data-go="2">← All work</button>');
$('#focus').insertAdjacentHTML('beforeend','<button id="collection-next"></button>');
})();