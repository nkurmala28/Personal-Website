(() => {
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], W=window.__watch;
if(!W){document.body.classList.add('watch-failed');return;}
const C=window.CONTENT||{},names={moon:'Projects',sec:'Writing',date:'Film'},units={moon:'project',sec:'article',date:'frame'},keys=Object.keys(names),body=document.body;
const focus=$('#focus'),tabs=$('#focus .stops');
focus.insertBefore(tabs,$('#f-kicker'));
$$('[data-stop]').forEach(b=>{const k=b.dataset.stop;b.innerHTML='<span>'+names[k]+'</span><small>Open</small>';b.setAttribute('aria-label','Open '+names[k]);});
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>W.jumpTo(+b.dataset.go)));
$$('[data-interest]').forEach(b=>b.addEventListener('click',()=>$('.hot[data-int="'+b.dataset.interest+'"]').click()));
const picker=$('#dial-picker');
$$('[data-way]').forEach(b=>b.addEventListener('click',()=>{picker.open=false;picker.querySelector('summary').focus();}));
document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picker.open){picker.open=false;picker.querySelector('summary').focus();}});
$$('[data-preview]').forEach(b=>{
const pin=$('.work-pin[data-k="'+b.dataset.preview+'"]');
b.addEventListener('mouseenter',()=>pin.classList.add('previewed'));b.addEventListener('mouseleave',()=>pin.classList.remove('previewed'));
b.addEventListener('focus',()=>pin.classList.add('previewed'));b.addEventListener('blur',()=>pin.classList.remove('previewed'));
});
const rail=$('#s-rail');
if(rail){
rail.setAttribute('aria-label','Experience, recent to earlier. Choose a strap to view its story.');
$$('#s-rail button').forEach(b=>{
const y=b.querySelector('.ry');if(y?.textContent.includes('['))y.textContent='';
b.insertAdjacentHTML('beforeend','<span class="worn-label" aria-hidden="true">On the watch</span>');
b.addEventListener('click',()=>{last='';});
});
}
// Replace the dense spec sheet with direct contact information after renderer setup.
const contact=$('.panel[data-ch="7"]');contact.innerHTML='<div class="part">04 / Contact</div><h2>Good things start<br>with a conversation.</h2><p>Strategy, data, software, or a particularly good watch. I would love to hear what you are working on.</p><div class="contact-links"><a class="email-link" href="mailto:'+C.contact.email+'">Say hello <span>↗</span></a><a href="'+C.contact.linkedin+'" target="_blank" rel="noopener">LinkedIn ↗</a></div><p class="contact-email">'+C.contact.email+'</p><div class="contact-foot"><span>'+C.fullSet.role+' · '+C.fullSet.employer+'</span><span>San Francisco</span></div><div class="contact-skills">Python · PySpark · SQL · Databricks · Azure OpenAI</div>';
if(C.contact.resume){const a=document.createElement('a');a.href=C.contact.resume;a.textContent='Resume ↗';a.target='_blank';a.rel='noopener';contact.querySelector('.contact-links').appendChild(a);}
const seen=new Set();let last='',settled='',at=0,raf;
$('#collection-next').addEventListener('click',()=>{const k=$('#collection-next').dataset.next;if(k==='about')W.jumpTo(6);else W.openFocus(k);});
function paint(t){
const position=W.cur();
const activeStop=$('#focus [data-stop].cur');
const s={cur:position.cur,focus:body.classList.contains('focused') ? activeStop?.dataset.stop || null : null};
const ch=Math.round(s.cur),focused=!!s.focus,zoomed=body.classList.contains('zoomed');
if(s.focus!==settled){settled=s.focus;at=t;}
if(s.focus&&Math.abs(s.cur-ch)<.035&&t-at>600)seen.add(s.focus);
const selected=$('[data-rail][aria-pressed="true"]')?.dataset.rail||'consulting';
const key=[ch,s.focus,zoomed,selected,[...seen].join(',')].join('|');
if(key!==last){
last=key;body.dataset.chapter=ch;$('#scroll-cue').hidden=ch!==0;
$$('#editorial-nav [data-go]').forEach(b=>{const n=+b.dataset.go,active=n===ch||(n===2&&ch>=2&&ch<=5);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});

$$('[data-rail]').forEach(b=>{const k=b.dataset.rail,j=C.jobs[k];b.setAttribute('aria-label',[j.chip,j.years,k===selected?'On the watch':'Choose this strap'].filter(Boolean).join(', '));});
keys.forEach(k=>{const b=$('[data-stop="'+k+'"]');b.setAttribute('aria-pressed',String(k===s.focus));b.querySelector('small').textContent=k===s.focus?'Current':seen.has(k)?'Opened ✓':'Open';});
if(focused){
const unit=units[s.focus];$('#f-kicker').textContent=names[s.focus];$('#f-prev').textContent='← Previous';$('#f-prev').setAttribute('aria-label','Previous '+unit);$('#f-next').textContent='Next '+unit+' →';$('#f-next').setAttribute('aria-label','Next '+unit);
const next=keys.find(k=>k!==s.focus&&!seen.has(k));$('#collection-next').dataset.next=next||'about';$('#collection-next').textContent=next?'Also inside: '+names[next]+' →':'A little about me →';
}
$('.provenance').hidden=zoomed;$('.interest-choices').hidden=zoomed;
}
$('.panel').forEach(p=>{p.inert=!p.classList.contains('live');});
focus.inert=!focused;
if($('#s-years').textContent.includes('['))$('#s-years').textContent='';
const empty=!$('#int-list').textContent.trim();$('#int-l').hidden=empty;$('#int-list').hidden=empty;
raf=requestAnimationFrame(paint);
}
raf=requestAnimationFrame(paint);
addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
})();