/* Runs before the existing watch bundle so its selectors bind to real controls. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const body = document.body;
  body.dataset.prototype = 'true';
  body.dataset.layout = new URLSearchParams(location.search).get('layout') === 'editorial' ? 'editorial' : 'map';
  window.__prototypeCenter = 0;
  const home = $('.panel[data-ch="0"]');
  home.insertAdjacentHTML('afterbegin', '<div class="part proto-eyebrow">Strategy · Data · Software</div>');
  home.insertAdjacentHTML('beforeend', '<h2 class="proto-position">High velocity generalist.</h2><p class="proto-intro">I work in economic consulting and build tools on the side. Before that, I wrote about watches.</p><p class="proto-aside">This one holds a few things about me.</p><button class="proto-primary" data-proto-jump="1">Take a look inside <span aria-hidden="true">↗</span></button><span class="proto-footnote">Start with experience. Explore at your own pace.</span>');
  const exp = $('.panel[data-ch="1"]');
  exp.querySelector('h2').textContent = 'A few different hats.';
  exp.querySelector('p').innerHTML = 'Five roles. Choose a strap to see the story behind it.';
  $('#s-title').insertAdjacentHTML('afterend','<p id="proto-role-meta" class="proto-meta"></p>');
  $('#s-name').classList.add('proto-material');
  $('.panel[data-ch="2"]').innerHTML = '<div class="part">Selected work</div><h2>Three ways in.</h2><p class="proto-hub-intro">Things I build. Stories I write.<br>Moments I keep.</p>';
  $('#hots').insertAdjacentHTML('afterbegin', '<button class="hot proto-hot" data-ch="2" data-k="moon" data-open="moon" aria-label="Open projects"><span>Projects</span></button><button class="hot proto-hot" data-ch="2" data-k="sec" data-open="sec" aria-label="Open writing"><span>Writing</span></button><button class="hot proto-hot" data-ch="2" data-k="date" data-open="date" aria-label="Open film"><span>Film</span></button>');
  $('#stage').insertAdjacentHTML('beforeend', '<svg id="proto-leaders" aria-hidden="true"><path data-leader="moon"/><path data-leader="sec"/><path data-leader="date"/></svg><div id="proto-work" aria-label="Choose a collection"><button class="proto-callout" data-open="moon" data-collection="moon"><span class="proto-card-top"><span>01 / Projects</span><span data-open-state="moon">Open ↗</span></span><strong>Built out of curiosity.</strong><span class="proto-card-copy">Notch, local agents, and other experiments.</span><span class="proto-card-meta" id="proto-project-count"></span></button><button class="proto-callout" data-open="sec" data-collection="sec"><span class="proto-card-top"><span>02 / Writing</span><span data-open-state="sec">Open ↗</span></span><strong>The watch obsession,<br>in print.</strong><span class="proto-card-copy">Bylined stories for Wrist Review.</span><span class="proto-card-meta">Panerai · Ulysse Nardin · Piaget</span></button><button class="proto-callout proto-film" data-open="date" data-collection="date"><span class="proto-card-top"><span>03 / Film</span><span data-open-state="date">Open ↗</span></span><span class="proto-film-row"><img src="./photos/01.jpg" alt="Husky crossing, photographed on film" width="64" height="78"><span><strong>Worth slowing<br>down for.</strong><span class="proto-card-meta" id="proto-film-count"></span></span></span></button></div><nav id="proto-nav" aria-label="Portfolio"><button data-proto-jump="0">Start</button><button data-proto-jump="1">Experience</button><button data-proto-jump="2">Work</button><button data-proto-jump="6">About</button><button data-proto-jump="7">Contact</button></nav>');
  const about = $('.panel[data-ch="6"]');
  about.querySelector('.part').textContent = 'About';
  $('#int-hint').textContent = 'Pick a part of the movement. There is more going on back here.';
  about.querySelector('.signlab').hidden = true;
  about.querySelector('.rows.sign').hidden = true;
  $('#int-hint').insertAdjacentHTML('beforebegin', '<p class="proto-provenance">Singapore <span>→</span> UCLA <span>→</span> San Francisco</p><div class="proto-interests" role="group" aria-label="Interests"><button data-proto-interest="soccer">Football</button><button data-proto-interest="cooking">Cooking</button><button data-proto-interest="snow">Snowboarding</button><button data-proto-interest="music">Music</button></div>');
  $('#focus').insertAdjacentHTML('afterbegin','<button id="proto-all-work" class="proto-text-btn" data-proto-jump="2">← All work</button>');
  $('#focus').insertAdjacentHTML('beforeend','<button id="proto-onward" class="proto-onward"></button>');
  $('.ways > .small').textContent = 'Dial finish';
  $('.ways').setAttribute('aria-label','Dial finish');
  // Only preview copy is cleaned; content.js remains unchanged.
  const c = window.CONTENT || {};
  Object.values(c.interests || {}).forEach(x => { x.list = (x.list || []).filter(t => !/\[[^\]]*\]/.test(t)); if(!x.list.length) x.listTitle = ''; });
  (c.film || []).forEach(x => { if(/\[/.test(x.caption || '')) x.caption = '35mm film.'; });
  (c.projects || []).forEach(x => { if(/\[/.test(x.text || '')) x.text = 'Project details coming soon.'; });
  Object.values(c.jobs || {}).forEach(x => { if(/\[/.test(x.text || '')) x.text = 'More about this chapter coming soon.'; });
  $('#proto-project-count').textContent = (c.projects || []).length + ' projects';
  $('#proto-film-count').textContent = (c.film || []).length + ' frames · 35mm';
  // Keyboard-accessible layout comparison lives outside the portfolio's navigation.
  $('#stage').insertAdjacentHTML('beforeend','<details id="proto-review"><summary>Design study</summary><div><span>Compare layouts</span><button data-proto-layout="editorial">A · Editorial</button><button data-proto-layout="map">B · Watch map</button><a href="./index.html#nointro">Original ↗</a></div></details>');
})();