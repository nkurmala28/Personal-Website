/* Supplemental UI for the isolated content prototypes. No strap geometry changes. */
(() => {
  'use strict';
  const watch = window.__watch;
  if (!watch) {
    const msg = document.createElement('p');
    msg.className = 'proto-error';
    msg.textContent = 'The watch could not start. Check that WebGL is enabled and the prototype files are served together.';
    document.body.appendChild(msg);
    return;
  }
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const body = document.body, stage = $('#stage'), work = $('#proto-work');
  const names = {moon:'Projects',sec:'Writing',date:'Film'};
  const singular = {moon:'project',sec:'article',date:'frame'};
  const categories = ['moon','sec','date'];
  let seen = new Set(), lastKey = '', lastRole = '', center = 0, lastTime = 0, raf;
  const c = window.CONTENT || {};
  const focus = $('#focus'), stops = $('#focus .stops');
  focus.insertBefore(stops, $('#f-kicker'));
  $$('#focus [data-stop]').forEach(b => {
    const k=b.dataset.stop;
    b.innerHTML = '<span>'+names[k]+'</span><small data-tab-state="'+k+'">Open</small>';
    b.setAttribute('aria-label','Open '+names[k].toLowerCase());
  });
  $$('#proto-work [data-open], .proto-hot').forEach(b => {
    b.addEventListener('click', () => { seen.add(b.dataset.open); lastKey=''; });
  });
  $$('[data-proto-jump]').forEach(b=>b.addEventListener('click',()=>{
    const n=Number(b.dataset.protoJump);
    watch.jumpTo(n);
    // Renderer resolves panel focus after its camera transition.
  }));
  $$('[data-proto-interest]').forEach(b=>b.addEventListener('click',()=>{
    $('.hot[data-int="'+b.dataset.protoInterest+'"]').click();
  }));
  $$('[data-proto-layout]').forEach(b=>b.addEventListener('click',()=>{
    body.dataset.layout=b.dataset.protoLayout;
    const u=new URL(location.href); u.searchParams.set('layout',body.dataset.layout);
    history.replaceState(null,'',u);
    $('#proto-review').open=false;
    lastKey='';
  }));
  $('#proto-onward').addEventListener('click',()=>{
    const k=$('#proto-onward').dataset.next;
    if(k==='about') watch.jumpTo(6); else { seen.add(k); watch.openFocus(k); }
  });
  const updateRole = () => {
    const b=$('[data-strap][aria-pressed="true"]');
    const k=b?.dataset.strap; if(!k || k===lastRole) return;
    lastRole=k; const j=c.jobs?.[k] || {};
    const company=k==='consulting'?'Analysis Group':k==='writing'?'Wrist Review & independent writing':'';
    const years=/\[/.test(j.years || '')?'':j.years || '';
    $('#proto-role-meta').textContent=[company,years].filter(Boolean).join(' · ');
  };
  const paths=Object.fromEntries(categories.map(k=>[k,$('[data-leader="'+k+'"]')]));
  const pins=Object.fromEntries(categories.map(k=>[k,$('.proto-hot[data-k="'+k+'"]')]));
  const cards=Object.fromEntries(categories.map(k=>[k,$('[data-collection="'+k+'"]')]));
  let settled = '', settledAt = 0;
  function frame(t) {
    const state=watch.work(), chapter=Math.round(state.cur);
    const atOverview=chapter===2 && !body.classList.contains('focused');
    const target=body.dataset.layout==='map' && atOverview && innerWidth>1100 ? 1 : 0;
    const dt=Math.min(50,t-(lastTime||t)); lastTime=t;
    center += (target-center)*(matchMedia('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt/170));
    window.__prototypeCenter=center;
    body.classList.toggle('proto-overview',atOverview);
    work.inert=!atOverview;
    work.setAttribute('aria-hidden',String(!atOverview));
    if(state.focus!==settled){settled=state.focus;settledAt=t;}
    // "Opened" is orientation feedback, never a claim that someone read the content.
    if(state.focus && Math.abs(state.cur-Math.round(state.cur))<.03 && t-settledAt>450) seen.add(state.focus);
    const key=[chapter,state.focus,[...seen].join(','),body.dataset.layout,body.classList.contains('zoomed')].join('|');
    if(key!==lastKey){
      lastKey=key; body.dataset.chapter=String(chapter);
      $$('[data-proto-jump]').forEach(b=>{
        const n=+b.dataset.protoJump, active=n===chapter || (n===2 && chapter>=2&&chapter<=5);
        if(b.closest('#proto-nav')) { if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current'); }
      });
      $$('[data-proto-layout]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.protoLayout===body.dataset.layout)));
      categories.forEach(k=>{
        $('[data-open-state="'+k+'"]').textContent=seen.has(k)?'Opened ✓':'Open ↗';
        cards[k].classList.toggle('opened',seen.has(k));
        const tab=$('[data-stop="'+k+'"]');
        tab.classList.toggle('proto-opened',seen.has(k));
        tab.setAttribute('aria-pressed',String(state.focus===k));
        $('[data-tab-state="'+k+'"]').textContent=state.focus===k?'Current':seen.has(k)?'Opened ✓':'Open';
      });
      if(state.focus){
        const item=singular[state.focus];
        $('#f-prev').textContent='← Previous';
        $('#f-prev').setAttribute('aria-label','Previous '+item);
        $('#f-next').textContent='Next '+item+' →';
        $('#f-next').setAttribute('aria-label','Next '+item);
        $('#f-kicker').textContent=names[state.focus];
        const next=categories.find(k=>k!==state.focus&&!seen.has(k));
        $('#proto-onward').dataset.next=next || 'about';
        $('#proto-onward').textContent=next?'Also inside: '+names[next]+' →':'Meet the person behind it →';
      }
      const zoomed=body.classList.contains('zoomed');
      $('.proto-provenance').hidden=zoomed;
      $('.proto-interests').hidden=zoomed;
      const empty=!$('#int-list').children.length || !$('#int-list').textContent.trim();
      $('#int-l').hidden=empty; $('#int-list').hidden=empty;
    }
    updateRole();
    if(atOverview && body.dataset.layout==='map' && innerWidth>1100){
      const r=stage.getBoundingClientRect();
      categories.forEach(k=>{
        const p=pins[k].getBoundingClientRect(),b=cards[k].getBoundingClientRect();
        const x=p.x+p.width/2-r.x,y=p.y+p.height/2-r.y;
        const left=k!=='date',x2=(left?b.right:b.left)-r.x,y2=b.y+b.height/2-r.y;
        const elbow=left?x2+28:x2-28;
        paths[k].setAttribute('d','M'+x+' '+y+' L'+elbow+' '+y2+' L'+x2+' '+y2);
      });
    }
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  addEventListener('pagehide',()=>cancelAnimationFrame(raf),{once:true});
})();