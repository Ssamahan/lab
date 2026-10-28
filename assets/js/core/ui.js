/* ============================================================================
   LAB SYSTEMS · UI KIT — toasts, drawers, modals, tables, illustrations
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU;
const UI={}; window.LS=window.LS||{}; LS.ui=UI;
const layers=[];

/* ——— Primitives ————————————————————————————— */
UI.ic=U.ic;
UI.pill=(label,tone,icon)=>'<span class="pill '+(tone||'slate')+'">'+(icon?U.ic(icon,11):'')+U.esc(label)+'</span>';
UI.chip=(label,cls,icon)=>'<span class="chip '+(cls||'')+'">'+(icon?U.ic(icon,12):'')+U.esc(label)+'</span>';
UI.eyebrow=t=>'<div class="eyebrow">'+U.esc(t)+'</div>';
UI.avatar=U.avatar;
UI.roleBadge=r=>{ const k=/admin/i.test(r)?'admin':/manager/i.test(r)?'manager':/reviewer/i.test(r)?'reviewer':/read|viewer/i.test(r)?'viewer':'tech'; return '<span class="role-badge '+k+'">'+U.esc(r||'—')+'</span>'; };
UI.card=(o)=>{
  const c=o||{};
  return '<section class="card '+(c.cls||'')+'" '+(c.id?'id="'+c.id+'"':'')+'>'
   + (c.title? '<div class="card-head"><div><div class="card-title">'+(c.icon?U.ic(c.icon,14,'ic'):'')+U.esc(c.title)+'</div>'+(c.sub?'<div class="card-sub">'+c.sub+'</div>':'')+'</div>'+(c.tools?'<div class="card-tool">'+c.tools+'</div>':'')+'</div>' :'')
   + '<div class="card-body" '+(c.pad?'style="padding:'+c.pad+'"':'')+'>'+(c.body||'')+'</div>'
   + (c.foot?'<div class="card-foot">'+c.foot+'</div>':'')
   +'</section>';
};
UI.stat=(o)=>'<div class="card kpi hover '+(o.cls||'')+'">'
  +'<div class="kpi-top"><div class="kpi-label">'+U.esc(o.label)+'</div>'+(o.icon?'<div class="kpi-ic">'+U.ic(o.icon,14)+'</div>':'')+'</div>'
  +'<div class="kpi-value"><span data-count="'+(o.value||0)+'" data-dec="'+(o.dec||0)+'">'+(o.formatted||'0')+'</span>'+(o.unit?'<span class="unit">'+U.esc(o.unit)+'</span>':'')+'</div>'
  +'<div class="kpi-foot"><div>'+(o.delta!=null?'<span class="delta '+(o.delta<0?'down':o.delta===0?'flat':'')+'">'+U.ic(o.delta<0?'arrow-down':o.delta===0?'arrow-right':'arrow-up',10)+(o.delta>0?'+':'')+o.delta+'%</span>':'')+(o.note?'<div class="xs faint" style="margin-top:4px">'+U.esc(o.note)+'</div>':'')+'</div>'+(o.spark?'<div style="width:88px">'+o.spark+'</div>':'')+'</div>'
  +'</div>';
UI.meter=(pct,tone,target)=>'<div class="meter '+(tone||'')+'"><i style="width:'+U.clamp(pct,0,100)+'%"></i>'+(target!=null?'<span class="target" style="left:'+U.clamp(target,0,100)+'%"></span>':'')+'</div>';
UI.empty=(o)=>{
  o=o||{};
  return '<div class="empty">'+UI.illus(o.art||'generic')
   +'<h3>'+U.esc(o.title||'Nothing here yet')+'</h3>'
   +'<p>'+U.esc(o.body||'Records will appear here as the laboratory registers activity.')+'</p>'
   + (o.action||'')+'</div>';
};
UI.illus=(name)=>{
  const gold='var(--gold)';
  const art={
    generic:'<svg viewBox="0 0 220 140" fill="none"><circle cx="110" cy="70" r="46" stroke="'+gold+'" stroke-opacity=".28"/><circle cx="110" cy="70" r="30" stroke="'+gold+'" stroke-opacity=".45" stroke-dasharray="3 4"/><path d="M110 40v60M80 70h60" stroke="'+gold+'" stroke-opacity=".35"/><circle cx="110" cy="70" r="5" fill="'+gold+'" fill-opacity=".6"/><path d="M64 112h92" stroke="'+gold+'" stroke-opacity=".25"/><circle cx="48" cy="36" r="3" fill="'+gold+'" fill-opacity=".5"/><circle cx="176" cy="100" r="4" stroke="'+gold+'" stroke-opacity=".5"/></svg>',
    samples:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><path d="M40 112h140" stroke-opacity=".35"/><path d="M78 36v46l-13 22a6 6 0 005 9h40a6 6 0 005-9l-13-22V36" stroke-opacity=".6"/><path d="M72 36h32" stroke-opacity=".8"/><path d="M78 88h30" stroke-opacity=".35"/><path d="M140 50v36l-9 15a5 5 0 004 8h24a5 5 0 004-8l-9-15V50" stroke-opacity=".4"/><path d="M136 50h22" stroke-opacity=".55"/><circle cx="93" cy="80" r="2" fill="'+gold+'" fill-opacity=".7" stroke="none"/><circle cx="148" cy="84" r="1.6" fill="'+gold+'" fill-opacity=".5" stroke="none"/><path d="M56 62h8M52 70h12" stroke-opacity=".3"/><path d="M168 34l6 6M174 34l-6 6" stroke-opacity=".4"/></svg>',
    boxes:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><path d="M36 112h148M44 112V52h132v60" stroke-opacity=".35"/><path d="M44 72h132M44 92h132" stroke-opacity=".25"/><rect x="56" y="56" width="34" height="14" rx="2" stroke-opacity=".55"/><rect x="100" y="56" width="26" height="14" rx="2" stroke-opacity=".4"/><rect x="136" y="58" width="30" height="12" rx="2" stroke-opacity=".3"/><rect x="62" y="78" width="26" height="12" rx="2" stroke-opacity=".4"/><rect x="98" y="76" width="36" height="14" rx="2" stroke-opacity=".55"/><path d="M68 56v-8M168 96v-10" stroke-opacity=".3"/><circle cx="176" cy="46" r="9" stroke-opacity=".3"/><path d="M176 41v10M171 46h10" stroke-opacity=".4"/></svg>',
    calendar:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><rect x="58" y="34" width="104" height="78" rx="7" stroke-opacity=".5"/><path d="M58 54h104M84 28v12M136 28v12" stroke-opacity=".55"/><path d="M76 70h10M98 70h10M120 70h10M142 70h8M76 86h10M98 86h10M120 86h10" stroke-opacity=".3"/><circle cx="146" cy="92" r="13" stroke-opacity=".6"/><path d="M141 92l4 4 7-8" stroke-opacity=".8"/><path d="M40 100c8-6 14-6 22 0" stroke-opacity=".2"/></svg>',
    award:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><circle cx="110" cy="62" r="30" stroke-opacity=".55"/><circle cx="110" cy="62" r="20" stroke-dasharray="2 4" stroke-opacity=".4"/><path d="M110 48l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" stroke-opacity=".75"/><path d="M92 86l-8 26 26-11 26 11-8-26" stroke-opacity=".4"/><path d="M54 46l6-6M166 46l-6-6M60 96l8 4M160 96l-8 4" stroke-opacity=".25"/></svg>',
    search:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><circle cx="100" cy="64" r="26" stroke-opacity=".55"/><path d="M119 83l19 19" stroke-opacity=".7"/><path d="M86 60h28M86 68h18" stroke-opacity=".3"/><rect x="130" y="38" width="34" height="42" rx="3" stroke-opacity=".2"/><path d="M138 50h18M138 58h12" stroke-opacity=".15"/><path d="M46 108h128" stroke-opacity=".18"/></svg>',
    lock:'<svg viewBox="0 0 220 140" fill="none" stroke="'+gold+'"><path d="M110 30l32 12v26c0 22-14 36-32 44-18-8-32-22-32-44V42z" stroke-opacity=".55"/><rect x="96" y="62" width="28" height="22" rx="3" stroke-opacity=".6"/><path d="M102 62v-6a8 8 0 0116 0v6" stroke-opacity=".5"/><circle cx="110" cy="72" r="3" stroke-opacity=".7"/><path d="M110 75v5" stroke-opacity=".6"/><path d="M64 46l-8-6M156 46l8-6" stroke-opacity=".2"/></svg>'
  };
  return '<div class="illus">'+(art[name]||art.generic)+'</div>';
};
UI.skel=(n,type)=>{
  if(type==='kpi'){ let h=''; for(let i=0;i<(n||4);i++) h+='<div class="card" style="padding:18px"><div class="skeleton sk-line" style="width:40%"></div><div class="skeleton" style="height:30px;width:55%;margin:14px 0 10px"></div><div class="skeleton sk-line" style="width:70%"></div></div>'; return h; }
  if(type==='table'){ let h='<div class="card" style="padding:14px"><div class="skeleton sk-line" style="width:26%;margin-bottom:14px"></div>'; for(let i=0;i<(n||8);i++) h+='<div class="skeleton" style="height:36px;margin-bottom:6px"></div>'; return h+'</div>'; }
  let h=''; for(let i=0;i<(n||3);i++) h+='<div class="skeleton sk-card" style="margin-bottom:12px"></div>'; return h;
};

/* ——— Toasts ————————————————————————————————— */
UI.toast=function(msg,opts){
  opts=typeof opts==='string'?{type:opts}:(opts||{});
  const root=document.getElementById('toasts')||document.body;
  const tone=opts.type||'info';
  const icon = tone==='ok'?'check-circle':tone==='err'?'circle-x':tone==='warn'?'alert-triangle':'info';
  const el=U.el('<div class="toast '+tone+'" role="status"><div class="tic">'+U.ic(icon,14)+'</div><div class="grow"><div class="tmsg">'+U.esc(msg)+'</div>'
    +(opts.actions?'<div class="tactions">'+opts.actions.map((a,i)=>'<button data-ta="'+i+'">'+U.esc(a.label)+'</button>').join('')+'</div>':'')
    +'</div><button class="icon-btn" data-tx style="width:22px;height:22px" aria-label="Dismiss">'+U.ic('x',13)+'</button>'
    +(opts.progress!==false?'<div class="tprogress"><i></i></div>':'')+'</div>');
  root.appendChild(el);
  const close=()=>{ el.classList.add('out'); setTimeout(()=>el.remove(),240); };
  el.querySelector('[data-tx]').onclick=close;
  (opts.actions||[]).forEach((a,i)=>{ const b=el.querySelector('[data-ta="'+i+'"]'); if(b) b.onclick=()=>{ try{a.onClick&&a.onClick();}finally{ close(); } }; });
  if(opts.duration!==0) setTimeout(close,opts.duration||4600);
  return {close};
};

/* ——— Layered surfaces (drawer / modal) ————————————— */
/* Scroll lock is reference-counted and also mirrored on <html> so a layer that
   is torn down by a route change can never leave the page frozen. */
let lockCount=0;
function lockScroll(){ lockCount++; document.body.classList.add('scroll-lock'); document.documentElement.classList.add('scroll-lock'); }
function unlockScroll(){ lockCount=Math.max(0,lockCount-1); if(!lockCount){ document.body.classList.remove('scroll-lock'); document.documentElement.classList.remove('scroll-lock'); } }
UI.unlockScroll=function(){ lockCount=0; document.body.classList.remove('scroll-lock'); document.documentElement.classList.remove('scroll-lock'); };
function pushLayer(fn){ layers.push(fn); document.body.style.overflow='hidden'; lockScroll(); }
function popLayer(){ const fn=layers.pop(); if(fn) fn(); unlockScroll(); if(!layers.length) document.body.style.overflow=''; }
UI.closeTop=()=>{ if(layers.length) popLayer(); };
/* Every [data-close] closes the top layer — the X, footer buttons and any button
   rendered later into a modal or drawer. Bound per surface (below) *and*
   delegated here, so a footer button works even inside a nested surface. */
function bindClose(scope){
  scope.querySelectorAll('[data-close]').forEach(b=>{
    if(b.__closeBound) return; b.__closeBound=true;
    b.addEventListener('click',e=>{
      if(e.target.closest('a[href]')) return;
      e.preventDefault(); e.stopPropagation();
      if(layers.length) popLayer();
    },true);
  });
}
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest?e.target.closest('[data-close]'):null;
  if(!b||!layers.length) return;
  if(b.__closeBound) return;               // already handled by the surface
  e.preventDefault(); e.stopPropagation();
  popLayer();
},true);
UI.closeAll=()=>{ while(layers.length){ const fn=layers.pop(); if(fn) fn(); } UI.unlockScroll(); document.body.style.overflow=''; };
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && layers.length){ e.preventDefault(); popLayer(); } });
/* A layer must never survive a navigation or a bfcache restore. */
window.addEventListener('pagehide',()=>UI.unlockScroll());

function focusables(root){ return Array.from(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x=>x.offsetParent!==null); }
function trap(root){
  root.addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const f=focusables(root); if(!f.length) return;
    const first=f[0], last=f[f.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });
  setTimeout(()=>{ const f=focusables(root); if(f[0]) f[0].focus(); },60);
}
UI.drawer=function(o){
  const host=document.getElementById('layer');
  const scrim=U.el('<div class="scrim"></div>');
  const panel=U.el('<aside class="drawer '+(o.wide?'wide':'')+'" role="dialog" aria-modal="true">'
    +'<div class="drawer-head"><div class="grow">'+(o.eyebrow?'<div class="eyebrow" style="margin-bottom:5px">'+U.esc(o.eyebrow)+'</div>':'')
    +'<h2>'+U.esc(o.title||'')+'</h2>'+(o.sub?'<div class="card-sub" style="margin-top:4px">'+o.sub+'</div>':'')+'</div>'
    +'<button class="icon-btn" data-close aria-label="Close">'+U.ic('x',17)+'</button></div>'
    +'<div class="drawer-body">'+(o.body||'')+'</div>'
    +(o.foot?'<div class="drawer-foot">'+o.foot+'</div>':'')+'</aside>');
  host.appendChild(scrim); host.appendChild(panel);
  const close=()=>{ panel.style.animation='none'; panel.style.transform='translateX(24px)'; panel.style.opacity='0'; panel.style.transition='all .18s ease'; scrim.style.opacity='0'; scrim.style.transition='opacity .18s'; setTimeout(()=>{ scrim.remove(); panel.remove(); }, 180); };
  scrim.onclick=()=>popLayer();
  pushLayer(()=>{ close(); });
  bindClose(panel);
  trap(panel);
  if(o.onMount) setTimeout(()=>{ bindClose(panel); o.onMount(panel,close); },0);
  return {panel, close:()=>popLayer()};
};
UI.modal=function(o){
  const host=document.getElementById('layer');
  const wrap=U.el('<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" style="'+(o.width?'width:'+o.width:'')+'">'
   +(o.eyebrow?'<div class="eyebrow" style="margin-bottom:6px">'+U.esc(o.eyebrow)+'</div>':'')
   +(o.title?'<h2>'+U.esc(o.title)+'</h2>':'')
   +(o.sub?'<div class="modal-sub">'+o.sub+'</div>':'')
   +(o.body||'')
   +(o.foot!==false?'<div class="modal-foot">'+(o.foot||'<button class="btn" data-close>Close</button>')+'</div>':'')
   +'</div></div>');
  host.appendChild(wrap);
  const close=()=>{ wrap.style.opacity='0'; wrap.style.transition='opacity .16s'; setTimeout(()=>wrap.remove(),160); };
  wrap.addEventListener('mousedown',e=>{ if(e.target===wrap) popLayer(); });
  pushLayer(close);
  bindClose(wrap);
  trap(wrap);
  if(o.onMount) setTimeout(()=>{ bindClose(wrap); o.onMount(wrap,close); },0);
  return {el:wrap, close:()=>popLayer()};
};
UI.confirm=function(o){
  return new Promise(res=>{
    const m=UI.modal({title:o.title||'Confirm',sub:o.body||'',foot:''
      +'<button class="btn" data-close>'+U.esc(o.cancel||'Cancel')+'</button>'
      +'<button class="btn '+(o.danger?'danger':'primary')+'" data-yes>'+U.esc(o.confirm||'Continue')+'</button>',
      onMount:(el,close)=>{ el.querySelector('[data-yes]').onclick=()=>{ close(); res(true); }; el.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>res(false))); }});
  });
};

/* ——— Tables ————————————————————————————————— */
UI.th=(cols)=>'<thead><tr>'+cols.map(c=>'<th '+(c.sort?'data-sort="'+c.k+'" class="sortable '+(c.cls||'')+'" ':'')+(c.width?'style="width:'+c.width+'"':'')+'>'
  +'<span class="sort">'+U.esc(c.label)+(c.sort?U.ic('chevron-down',10):'')+'</span></th>').join('')+'</tr></thead>';
UI.table=(o)=>{
  const cols=o.cols||[];
  return '<div class="card table-card">'
   +(o.toolbar?'<div class="toolbar">'+o.toolbar+'</div>':'')
   +(o.bulk?'<div id="'+(o.id||'dt')+'-bulk"></div>':'')
   +'<div class="dt-scroll"><table class="dt" id="'+(o.id||'dt')+'">'+UI.th(cols)+'<tbody>'+(o.rows||'')+'</tbody></table>'
   +(o.rows?'':'<div style="padding:8px">'+UI.empty(o.empty||{})+'</div>')+'</div>'
   +(o.foot?'<div class="card-foot">'+o.foot+'</div>':'')
   +'</div>';
};
UI.audit=(a)=>'<span class="audit-mark" data-tip="'+U.esc('Created by '+a.by+' · '+U.fmtDate(a.date))+'">'+U.ic('history',9)+U.esc(U.givenName(a.by))+'</span>';

/* ——— Number animation for rendered pages ——————— */
UI.animateCounts=(root)=>{
  U.$$('[data-count]',root||document).forEach(el=>{
    if(el.dataset.counted) return; el.dataset.counted='1';
    const to=parseFloat(el.dataset.count)||0, dec=parseInt(el.dataset.dec||'0',10);
    U.spring(0,to,{duration:820,onUpdate:v=>{ el.textContent = dec? v.toFixed(dec) : U.fmtNum(Math.round(v)); }});
  });
};
/* Reveal on scroll */
UI.observeReveals=(root)=>{
  const items=U.$$('.reveal:not(.in)',root||document);
  if(!('IntersectionObserver' in window)){ items.forEach(i=>i.classList.add('in')); return; }
  const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); },{threshold:.12});
  items.forEach(i=>io.observe(i));
};

/* ——— Confetti (gold, celebratory) ————————————— */
UI.confetti=function(opts){
  opts=opts||{};
  if(U.reduced() || !window.requestAnimationFrame) return;
  let cv=document.getElementById('confetti');
  if(!cv){ cv=document.createElement('canvas'); cv.id='confetti'; document.body.appendChild(cv); }
  const ctx=cv.getContext&&cv.getContext('2d'); if(!ctx){ cv.remove(); return; }
  const dpr=Math.min(2,window.devicePixelRatio||1);
  cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; ctx.scale(dpr,dpr);
  const colors=['#C9A84C','#E9D9A7','#D4B76A','#B18F38','#F6EFDA'];
  const n=opts.count||90; const parts=[];
  for(let i=0;i<n;i++) parts.push({x:innerWidth/2+(Math.random()-.5)*innerWidth*.36, y:innerHeight*.36, vx:(Math.random()-.5)*7, vy:-Math.random()*8-2, g:.16+Math.random()*.08, r:2+Math.random()*4, a:Math.random()*Math.PI, va:(Math.random()-.5)*.3, c:colors[i%colors.length], life:1});
  const t0=performance.now();
  (function frame(t){
    const dt=(t-(frame.lt||t))/16.67; frame.lt=t;
    ctx.clearRect(0,0,innerWidth,innerHeight);
    parts.forEach(p=>{ p.vy+=p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.a+=p.va*dt; p.life-=.006*dt;
      ctx.save(); ctx.globalAlpha=Math.max(0,p.life); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6); ctx.restore(); });
    if(t-t0<2600) requestAnimationFrame(frame); else { ctx.clearRect(0,0,innerWidth,innerHeight); cv.remove(); }
  })(t0);
};

/* ——— Print manifest / roster helpers ————————— */
UI.barcode=(code,opts)=>{
  opts=opts||{};
  const hash=U.hash(code); let bars='';
  for(let i=0;i<46;i++){
    const bit=(hash>>(i%30))&1; const w=(i%7===0)?1:(i%3===0?3:2);
    bars+='<i style="width:'+w+'px;height:'+(bit?100:70)+'%" class="'+(w===1?'thin':'')+'"></i>';
    if(i%9===0) bars+='<i class="gap"></i>';
  }
  /* The label is optional: on a manifest the ID already sits in its own column, so the
     barcode is printed as bars only. */
  return '<div><div class="barcode">'+bars+'</div>'+(opts.label===false?'':'<div class="barcode-lbl">'+U.esc(code)+'</div>')+'</div>';
};
/* Barcodes that survive printing, drawn exactly like the console's own: a pale strip,
   bars two pixels wide (one for every seventh), a little air between them, and the short
   bars at seven tenths of the full height, all sitting on the same baseline. They are SVG
   rects — ink, not background — so a browser that drops background graphics still prints
   the code. */
UI.barcodeSVG=(code,opts)=>{
  opts=opts||{};
  const h=opts.height||34, gap=1.5, ink='#0A0E17';
  const hash=U.hash(code); let x=0; const parts=[];
  for(let i=0;i<46;i++){
    const bit=(hash>>(i%30))&1;
    const w=(i%7===0)?1:2;
    const bh=bit?h:Math.round(h*0.7*10)/10;
    parts.push('<rect x="'+x+'" y="'+(Math.round((h-bh)*10)/10)+'" width="'+w+'" height="'+bh+'" fill="'+ink+'"/>');
    x+=w+gap;
    if(i%9===0) x+=2+gap;
  }
  const W=Math.round(x);
  return '<span style="display:inline-block;padding:5px 8px;background:#FBFAF6;border-radius:4px;line-height:0">'
    +'<svg class="barcode-svg" role="img" aria-label="'+U.esc(code)+'" width="'+W+'" height="'+h
    +'" viewBox="0 0 '+W+' '+h+'" fill="'+ink+'" style="display:block">'+parts.join('')+'</svg></span>';
};
/* Clipboard with a fallback for browsers that refuse the async API (or run it from a
   context that is not user-initiated). Returns true only when the text really landed. */
UI.copy=async function(text){
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); return true; }
  }catch(e){ /* fall through to the textarea trick */ }
  try{
    const a=document.createElement('textarea');
    a.value=text; a.setAttribute('readonly',''); a.style.position='fixed'; a.style.opacity='0';
    document.body.appendChild(a); a.select();
    const ok=document.execCommand&&document.execCommand('copy');
    a.remove();
    return !!ok;
  }catch(e){ return false; }
};
UI.spinner=(size)=>'<span style="display:inline-block;width:'+(size||14)+'px;height:'+(size||14)+'px;border:1.5px solid var(--border-strong);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite"></span>';
})();
