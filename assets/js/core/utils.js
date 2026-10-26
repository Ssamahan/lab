/* ============================================================================
   LAB SYSTEMS · CORE UTILITIES
   ========================================================================== */
(function(){
'use strict';
const U = {};
window.LSU = U;

U.$ = (s,r)=> (r||document).querySelector(s);
U.$$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
U.esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
U.uid = (p)=> (p||'id')+Math.random().toString(36).slice(2,7)+Date.now().toString(36).slice(-3);
U.clamp = (n,a,b)=> Math.max(a,Math.min(b,n));
U.lerp = (a,b,t)=> a+(b-a)*t;

/* Icons — Lucide 24px grid, 1.5px stroke, sizes 16/20/24 */
U.ic = function(name,size,cls){
  const paths = (window.LS_ICONS||{})[name] || '';
  const s = size||16;
  return '<svg class="ic '+(cls||'')+'" viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
};

/* ——— Dates (local, Africa/Kigali) ————————————————————— */
const pad=n=>String(n).padStart(2,'0');
U.isoLocal = d=> d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
U.todayISO = ()=> U.isoLocal(new Date());
U.nowISO = ()=> new Date().toISOString();
U.parseISO = iso=> new Date((iso||U.todayISO())+'T12:00:00');
U.addDays = (iso,n)=>{ const d=U.parseISO(iso); d.setDate(d.getDate()+n); return U.isoLocal(d); };
U.dow = iso=> (U.parseISO(iso).getDay()+6)%7; // 0 = Monday
U.daysBetween = (a,b)=> Math.round((U.parseISO(b)-U.parseISO(a))/86400000);
U.monthKey = iso=> (iso||U.todayISO()).slice(0,7);
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const M3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
U.MONTHS=MONTHS; U.M3=M3;
const DOWL=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
U.DOWL=DOWL; U.DOW1=['M','T','W','T','F','S','S'];
U.monthLabel = k=>{ const [y,m]=String(k).split('-'); return (MONTHS[+m-1]||'')+' '+y; };
U.fmtDate = iso=>{ if(!iso) return '—'; const d=U.parseISO(String(iso).slice(0,10)); if(isNaN(d)) return String(iso); return d.getDate()+' '+M3[d.getMonth()]+' '+d.getFullYear(); };
U.fmtDateShort = iso=>{ if(!iso) return '—'; const d=U.parseISO(String(iso).slice(0,10)); return d.getDate()+' '+M3[d.getMonth()]; };
U.fmtDT = iso=>{ if(!iso) return '—'; const d=new Date(iso); if(isNaN(d)) return String(iso); return d.getDate()+' '+M3[d.getMonth()]+' · '+pad(d.getHours())+':'+pad(d.getMinutes()); };
U.fmtTime = (d,opts)=> new Date(d||Date.now()).toLocaleTimeString('en-GB',Object.assign({hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Africa/Kigali'},opts||{}));
U.fmtDateLong = (d)=> new Date(d||Date.now()).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Kigali'});
U.relTime = iso=>{
  if(!iso) return '—';
  const d=new Date(iso), diff=(Date.now()-d.getTime())/1000;
  if(isNaN(d)) return '—';
  if(diff<60) return 'just now';
  if(diff<3600) return Math.floor(diff/60)+'m ago';
  if(diff<86400) return Math.floor(diff/3600)+'h ago';
  if(diff<86400*7) return Math.floor(diff/86400)+'d ago';
  return U.fmtDate(U.isoLocal(d));
};
U.fyInfo = (iso, startMonth=6)=>{
  const d=U.parseISO(iso||U.todayISO()); let y=d.getFullYear();
  if(d.getMonth()<startMonth) y--;
  return { label:y+'/'+(y+1), start:y+'-07-01', end:(y+1)+'-06-30', year:y };
};
U.fyLabel = ()=> U.fyInfo().label;
U.monthRange = (key)=>{ const [y,m]=String(key).split('-').map(Number); const days=new Date(y,m,0).getDate(); const out=[]; for(let i=1;i<=days;i++) out.push(y+'-'+pad(m)+'-'+pad(i)); return out; };

/* ——— Numbers ————————————————————————————————— */
U.fmtNum = n=> Number(n||0).toLocaleString('en-US');
U.fmtNumCompact = n=> { const v=Number(n||0); if(Math.abs(v)>=1e6) return (v/1e6).toFixed(v%1e6?1:0)+'M'; if(Math.abs(v)>=1e4) return (v/1e3).toFixed(0)+'k'; return U.fmtNum(v); };
U.fmtRWF = n=> Number(n||0).toLocaleString('en-US')+' RWF';
U.fmtRWFcompact = n=> { const v=Number(n||0); if(Math.abs(v)>=1e6) return 'RWF '+(v/1e6).toFixed(1)+'M'; if(Math.abs(v)>=1e4) return 'RWF '+(v/1e3).toFixed(0)+'k'; return 'RWF '+U.fmtNum(v); };
U.pct = (n,d=0)=> (Number(n)||0).toFixed(d)+'%';
U.avg = a=> a.length? a.reduce((x,y)=>x+y,0)/a.length : 0;
U.sum = (a,f)=> a.reduce((x,y)=> x + (f?f(y):y||0), 0);
U.groupBy = (arr,f)=> arr.reduce((m,x)=>{ const k=f(x); (m[k]=m[k]||[]).push(x); return m; },{});
U.sortBy = (arr,f,dir)=> arr.slice().sort((a,b)=>{ const A=f(a),B=f(b); return (A>B?1:A<B?-1:0)*(dir==='desc'?-1:1); });
U.uniq = arr=> Array.from(new Set(arr));
U.money = n=> Math.round(n||0);

/* Deterministic pseudo-random (stable demo telemetry) */
U.hash = str=>{ let h=2166136261; for(let i=0;i<String(str).length;i++){ h^=String(str).charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
U.rng = seed=>{ let a=U.hash(seed)||1; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };

/* ——— DOM ————————————————————————————————— */
U.el = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; };
U.on = (target,evt,sel,fn)=>{
  if(typeof sel==='function'){ target.addEventListener(evt,sel); return; }
  target.addEventListener(evt,e=>{ const m=e.target.closest(sel); if(m && target.contains(m)) fn(e,m); });
};
U.delegate = U.on;
U.debounce=(fn,ms)=>{ let t; return function(){ const a=arguments,c=this; clearTimeout(t); t=setTimeout(()=>fn.apply(c,a),ms||200); }; };
U.throttle=(fn,ms)=>{ let last=0,t; return function(){ const now=Date.now(),a=arguments,c=this; if(now-last>=ms){ last=now; fn.apply(c,a); } else { clearTimeout(t); t=setTimeout(()=>{ last=Date.now(); fn.apply(c,a); },ms-(now-last)); } }; };
U.reduced = ()=> window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ——— Motion: spring count-up —————————————————————— */
U.spring = function(from,to,opts){
  const o=Object.assign({stiffness:260,damping:26,onUpdate:()=>{},onDone:()=>{},duration:900},opts||{});
  if(U.reduced()){ o.onUpdate(to); o.onDone(); return ()=>{}; }
  const start=performance.now(); let raf=0; let cancelled=false;
  const step=(now)=>{
    if(cancelled) return;
    const t=Math.min(1,(now-start)/o.duration);
    // critically-ish damped spring approximation
    const p=1-Math.exp(-t*7.2)*(Math.cos(t*9.4)*0.62+0.38);
    const v=from+(to-from)*U.clamp(p,0,1);
    o.onUpdate(v);
    if(t<1) raf=requestAnimationFrame(step); else { o.onUpdate(to); o.onDone(); }
  };
  raf=requestAnimationFrame(step);
  return ()=>{ cancelled=true; cancelAnimationFrame(raf); };
};
U.countUp = (elm,to,opts)=>{
  if(!elm) return;
  to=Number(to)||0;
  const dec=(String(to).split('.')[1]||'').length;
  const fmt=n=> dec? n.toFixed(dec) : U.fmtNum(Math.round(n));
  return U.spring(0,to,Object.assign({},opts,{onUpdate:v=>{ elm.textContent=fmt(v); }}));
};
U.odo = (elm,value)=>{ if(elm) elm.textContent=U.fmtNum(value); };

/* ——— Files ————————————————————————————————— */
U.download = (name,content,mime)=>{
  const blob = content instanceof Blob ? content : new Blob([content],{type:mime||'text/plain;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },400);
};
U.toCSV = rows=> rows.map(r=> r.map(c=>{ const s=String(c==null?'':c); return /[",\n]/.test(s)? '"'+s.replace(/"/g,'""')+'"' : s; }).join(',')).join('\r\n');
U.exportCSV = (name,rows,meta)=>{
  const head = meta ? [ ['Lab Systems — Ruli District Hospital Laboratory'], [meta.title||''], ['Generated', new Date().toLocaleString('en-GB',{timeZone:'Africa/Kigali'}), 'by '+(meta.actor||'—')], [] ] : [];
  const csv='\uFEFF'+U.toCSV(head.concat(rows));
  U.download(name.endsWith('.csv')?name:name+'.csv',csv,'text/csv;charset=utf-8');
};
/* ——— Chart export ————————————————————————————————
   The charts are inline SVG drawn with CSS variables, which mean nothing in a
   downloaded file. This clones the node, resolves every var() against the live
   document, paints the card background and hands back a standalone SVG. The PNG
   path renders that SVG at 3× so the result is print-sharp rather than a
   screenshot of a 300-pixel column. */
function resolvePaint(value){
  if(!value || value.indexOf('var(')<0) return value;
  const el=document.documentElement;
  let out=String(value);
  /* Tokens point at other tokens (`--pos: var(--teal-700)`), so resolve until the
     string is a real paint — a downloaded file has no cascade to fall back on. */
  for(let pass=0; pass<6 && out.indexOf('var(')>=0; pass++){
    out=out.replace(/var\((--[a-z0-9-]+)(?:,\s*([^)]+))?\)/gi,(m,name,fallback)=>{
      let v='';
      try{ v=getComputedStyle(el).getPropertyValue(name).trim(); }catch(e){}
      return v||(fallback?fallback.trim():'currentColor');
    });
  }
  return out;
}
/* ——— HTML chart → SVG ————————————————————————————————
   Charts drawn with divs (bars, heat tiles, index columns, meters) have no <svg>
   to clone. This walks the rendered box and repaints it as rectangles and text,
   using the computed colours, so a screenshot-quality SVG can always be produced
   without any third-party rasteriser. */
U.htmlChartSVG = (host,opts)=>{
  opts=opts||{};
  if(!host||!host.getBoundingClientRect||!host.ownerDocument) return null;
  const box=host.getBoundingClientRect?host.getBoundingClientRect():null;
  const W=Math.round((box&&box.width)||host.offsetWidth||0);
  const H=Math.round((box&&box.height)||host.offsetHeight||0);
  if(W<8||H<8) return null;                      /* not laid out — nothing to trace */
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('xmlns',NS);
  svg.setAttribute('viewBox','0 0 '+W+' '+H);
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  const bg=document.createElementNS(NS,'rect');
  bg.setAttribute('x',0); bg.setAttribute('y',0); bg.setAttribute('width',W); bg.setAttribute('height',H);
  bg.setAttribute('fill','#ffffff');
  svg.appendChild(bg);
  const origin={x:box.left+window.scrollX, y:box.top+window.scrollY};
  const firstColor=str=>{
    if(!str) return null;
    const m=str.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i);
    return m?m[0]:null;
  };
  const opaque=c=>c&&!/rgba\([^)]*,\s*0\s*\)/.test(c);
  const paint=(el)=>{
    const cs=window.getComputedStyle(el);
    if(!cs||cs.display==='none') return;
    /* an element that is fully transparent (a reveal animation still running, a
       fading parent) must not be traced — but an empty opacity string means "1",
       and +'' is 0, which used to drop the whole chart on the floor */
    if(cs.opacity!==''&&cs.opacity!=null&&+cs.opacity===0) return;
    const r=el.getBoundingClientRect();
    if(r.width<0.5||r.height<0.5) return;
    const x=r.left-origin.x, y=r.top-origin.y;
    let fill=opaque(cs.backgroundColor)?cs.backgroundColor:null;
    if(!fill && cs.backgroundImage && cs.backgroundImage!=='none') fill=firstColor(cs.backgroundImage);
    if(fill && opaque(fill)){
      const rect=document.createElementNS(NS,'rect');
      rect.setAttribute('x',x.toFixed(1)); rect.setAttribute('y',y.toFixed(1));
      rect.setAttribute('width',r.width.toFixed(1)); rect.setAttribute('height',r.height.toFixed(1));
      const rad=parseFloat(cs.borderTopLeftRadius||'0')||0;
      if(rad) rect.setAttribute('rx',Math.min(rad,r.width/2,r.height/2).toFixed(1));
      rect.setAttribute('fill',fill);
      if(cs.opacity&&+cs.opacity<1) rect.setAttribute('opacity',cs.opacity);
      svg.appendChild(rect);
    }
    /* text: only leaves, so nothing is written twice */
    const kids=[...el.childNodes].filter(n=>n.nodeType===1);
    /* A label is often split across inline spans (96 + "%"); treat an element whose
       children carry no paint of their own as a single piece of text. */
    const inlineOnly=kids.every(k=>['SPAN','SMALL','B','I','EM','STRONG'].indexOf(k.tagName)>=0
      && (getComputedStyle(k).backgroundColor||'rgba(0, 0, 0, 0)').indexOf('rgba(0, 0, 0, 0)')===0);
    const ownText=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
    const fullText=(ownText&&inlineOnly)?(el.textContent||'').replace(/\s+/g,' ').trim():ownText;
    if(fullText && (inlineOnly||!kids.length)){
      const t=document.createElementNS(NS,'text');
      let fs=parseFloat(cs.fontSize||'11')||11; if(fs<8) fs=11;
      t.setAttribute('x',(x+2).toFixed(1));
      t.setAttribute('y',(y+r.height/2+fs*0.35).toFixed(1));
      t.setAttribute('font-family','system-ui, sans-serif');
      t.setAttribute('font-size',fs.toFixed(1));
      let inkCol=resolvePaint(opaque(cs.color)?cs.color:'#333333');
      if(paleOnWhite(inkCol)) inkCol=INK.ink;
      t.setAttribute('fill',inkCol);
      t.setAttribute('text-anchor',/center/.test(cs.textAlign)?'middle':'start');
      if(/center/.test(cs.textAlign)) t.setAttribute('x',(x+r.width/2).toFixed(1));
      t.textContent=fullText.slice(0,120);
      svg.appendChild(t);
    }
    kids.forEach(paint);
  };
  [...host.children].forEach(paint);
  const title=(opts.name||'').toString();
  if(title){
    const t=document.createElementNS(NS,'text');
    t.setAttribute('x',10); t.setAttribute('y',H-6);
    t.setAttribute('font-family','system-ui, sans-serif'); t.setAttribute('font-size','9');
    t.setAttribute('fill','#8A93A5');
    t.textContent='Lab Systems · Ruli DH · '+title;
    svg.appendChild(t);
  }
  return {svg:new XMLSerializer().serializeToString(svg), width:W, height:H, name:title||'chart'};
};
/* ——— Exports that look like the screen —————————————————————
   The first attempt traced the rendered boxes; in a real browser that produces a
   ghost of the chart (unresolved CSS variables, sub-pixel text, absolutely
   positioned fills). These renderers draw from the numbers instead, so an exported
   chart is always a clean, legible image with concrete colours. */
const INK={ink:'#1B1F27', muted:'#5A6472', faint:'#8A93A5', line:'#D8D3C6', head:'#F4F1E8', zebra:'#FAF8F2', white:'#FFFFFF'};
/* Every exported sheet is white paper, in either theme. Reading the theme's text
   colour would paint Ink-mode text (near-white) onto that white paper and produce a
   blank-looking file — so the export palette is fixed, not inherited. */
U.ink=()=>INK;
/* Is this paint too pale to read on white? Used to keep traced charts legible when
   the app is in the dark theme. */
function paleOnWhite(col){
  if(!col) return false;
  const m=String(col).trim();
  let r,g,b,a=1;
  if(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(m)){
    let h=m.slice(1); if(h.length===3) h=h.split('').map(c=>c+c).join('');
    r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16);
  } else {
    const mm=/rgba?\(([^)]+)\)/.exec(m); if(!mm) return false;
    const p=mm[1].split(',').map(x=>parseFloat(x));
    r=p[0]; g=p[1]; b=p[2]; if(p.length>3) a=p[3];
  }
  if(a===0) return true;
  /* Fade the colour onto white before judging it: an 8 % ink wash would otherwise
     look "dark" and be kept, while a 95 % white text is invisible. */
  const mix=v=>Math.round(v*a+255*(1-a));
  return (0.299*mix(r)+0.587*mix(g)+0.114*mix(b))>190;
}
const BAND_HEX={g2:'#17A97B',g1:'#3FA57E',r1:'#E29AA2',r2:'#A3212E',teal:'#3FB3A6',amber:'#D9A13B',rose:'#E26D6D',slate:'#8C93A3',gold:'#C9A84C',blue:'#7595C8'};
const hexOf=t=>BAND_HEX[t]||BAND_HEX.slate;
function esc2(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function wrapLabel(text,max){
  const words=String(text||'').split(/\s+/); const out=[]; let cur='';
  words.forEach(w=>{ if((cur+' '+w).trim().length<=max) cur=(cur+' '+w).trim(); else { if(cur) out.push(cur); cur=w; } });
  if(cur) out.push(cur);
  return out.slice(0,2);
}
/* A column chart: the quarterly index strip, drawn from its own numbers. */
function columnsSVG(m,opts){
  const P=U.ink();
  const items=(m.items||[]).filter(x=>x&&x.pct!=null);
  const n=items.length||1;
  const colW=Math.max(72,Math.min(132,Math.floor(1180/n)));
  const W=Math.max(760,n*colW+120), H=m.floorLabel?420:400;
  /* The value label sits 14px above the tallest column, so the plot starts below
     the subtitle with room for it — a 100 % column must not print over the title. */
  const top=m.floorLabel?104:92, base=H-88, plot=base-top;
  const max=m.max||100;
  let out='';
  out+='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="'+P.white+'"/>';
  if(m.title) out+='<text x="26" y="34" font-family="Georgia,serif" font-size="19" fill="'+P.ink+'">'+esc2(m.title)+'</text>';
  if(m.subtitle) out+='<text x="26" y="54" font-family="system-ui,sans-serif" font-size="12" fill="'+P.faint+'">'+esc2(m.subtitle)+'</text>';
  out+='<line x1="60" y1="'+base+'" x2="'+(W-40)+'" y2="'+base+'" stroke="'+P.line+'" stroke-width="1"/>';
  [0,25,50,75,100].forEach(v=>{
    const y=base-(v/max)*plot;
    out+='<line x1="60" y1="'+y.toFixed(1)+'" x2="'+(W-40)+'" y2="'+y.toFixed(1)+'" stroke="'+P.line+'" stroke-width="0.6" stroke-dasharray="'+(v?'3 5':'0')+'"/>';
    out+='<text x="52" y="'+(y+4).toFixed(1)+'" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="'+P.faint+'">'+v+'%</text>';
  });
  if(m.floor!=null){
    const y=base-(m.floor/max)*plot;
    out+='<line x1="60" y1="'+y.toFixed(1)+'" x2="'+(W-40)+'" y2="'+y.toFixed(1)+'" stroke="'+BAND_HEX.teal+'" stroke-width="1.2" stroke-dasharray="6 4" opacity=".8"/>';
  }
  /* The band key sits under the subtitle, not on the line, where a tall column
     would run into it. */
  if(m.floorLabel) out+='<text x="26" y="74" font-family="system-ui,sans-serif" font-size="11" fill="'+BAND_HEX.teal+'">'+esc2(m.floorLabel)+'</text>';
  items.forEach((it,i)=>{
    const cx=60+colW*(i+.5)+ (W-100-n*colW)/2;
    const h=Math.max(4,(Math.min(max,it.pct)/max)*plot);
    const w=Math.min(56,colW-24);
    const x=cx-w/2, y=base-h;
    const col=hexOf(it.band);
    out+='<rect x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+w.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="5" fill="'+col+'" fill-opacity="0.92"/>';
    out+='<text x="'+cx.toFixed(1)+'" y="'+(y-10).toFixed(1)+'" text-anchor="middle" font-family="ui-monospace,monospace" font-size="15" font-weight="600" fill="'+col+'">'+esc2(it.pct)+'%</text>';
    const lines=wrapLabel(it.name,Math.max(8,Math.floor(colW/6.6)));
    lines.forEach((ln,k)=>{
      out+='<text x="'+cx.toFixed(1)+'" y="'+(base+22+k*15).toFixed(1)+'" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11.5" fill="'+P.ink+'">'+esc2(ln)+'</text>';
    });
    if(it.rank!=null) out+='<text x="'+cx.toFixed(1)+'" y="'+(base+22+(lines.length)*15+2).toFixed(1)+'" text-anchor="middle" font-family="ui-monospace,monospace" font-size="10" fill="'+P.faint+'">#'+esc2(it.rank)+(it.move?'  '+esc2(it.move):'')+'</text>';
  });
  return {svg:out, width:W, height:H};
}
/* A table as an image: header row, zebra body, real cell colours where the screen
   shows them (the domain heatmap tiles). */
U.tableSVG=(table,opts)=>{
  opts=opts||{};
  if(!table) return null;
  const P=U.ink();
  /* A cell's words may be split across a value and a unit ("Quality" + "20%"), so
     the pieces are joined with a space rather than run together. A band colour may
     live on a child pill rather than on the cell, so the class is read too — that is
     what makes the exported heatmap look like the one on screen. */
  const cellText=td=>{
    let t='';
    [...td.childNodes].forEach(n=>{
      if(n.nodeType===3) t+=' '+n.textContent;
      else if(n.nodeType===1) t+=' '+n.textContent;
    });
    return (t||td.textContent||'').replace(/\s+/g,' ').trim();
  };
  const bandOfEl=el=>{
    const cls=(el.className&&typeof el.className==='string'?el.className:'')+' '+((el.getAttribute&&el.getAttribute('class'))||'');
    const hit=cls.split(/\s+/).find(k=>BAND_HEX[k]);
    return hit?BAND_HEX[hit]:'';
  };
  /* A trailing action cell (an Edit button) is part of the interface, not the data. */
  const actionOnly=td=>{
    if(td.querySelector('button')&&!td.querySelector('table')){
      const clone=td.cloneNode(true);
      clone.querySelectorAll('button,svg').forEach(n=>n.remove());
      if(!(clone.textContent||'').trim()) return true;
    }
    return false;
  };
  const rows=U.$$('tr',table).map(tr=>U.$$('th,td',tr).filter(td=>!actionOnly(td)).map(td=>{
    let bg='';
    try{ const cs=getComputedStyle(td); bg=cs.backgroundColor||''; if(/rgba?\([^)]*,\s*0\s*\)/.test(bg)||bg==='transparent') bg=''; }catch(e){}
    let tint=bandOfEl(td);
    if(!bg){
      const kid=td.querySelector&&td.querySelector('.pill,.tile,.heat-cell,.heat-tile,.cell-band,[class*="g1"],[class*="g2"],[class*="r1"],[class*="r2"]');
      if(kid) tint=tint||bandOfEl(kid);
      if(kid){
        /* The heat tiles carry their colour as CSS custom properties (--tone, --a)
           plus a class-driven background; neither survives an export, so the wash is
           rebuilt from those two numbers. */
        const style=(kid.getAttribute('style')||'');
        const tone=(style.match(/--tone\s*:\s*([\d.,\s]+)/)||[])[1];
        const alpha=(style.match(/--a\s*:\s*([\d.]+)/)||[])[1];
        if(tone){
          const a=Math.min(0.4,Math.max(0.05,alpha?parseFloat(alpha):0.2));
          bg='rgba('+tone.trim()+','+a.toFixed(2)+')';
        } else {
          try{ const cs=getComputedStyle(kid); if(cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)') bg=cs.backgroundColor; }catch(e){}
        }
      }
    }
    return {t:cellText(td), head:td.tagName==='TH', bg, tint, span:+(td.getAttribute('colspan')||1)};
  })).filter(r=>r.length);
  if(!rows.length) return null;
  const cols=Math.max.apply(null,rows.map(r=>r.reduce((a,c)=>a+c.span,0)));
  const avail=1180;
  const colW=Math.max(78,Math.floor(avail/cols));
  const W=Math.max(720,cols*colW+48);
  const rowH=30, headH=36;
  const bodyRows=rows.slice(1,41);
  const H=64+headH+bodyRows.length*rowH+(rows.length>41?26:0)+40;
  let out='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="'+P.white+'"/>';
  if(opts.name) out+='<text x="24" y="34" font-family="Georgia,serif" font-size="18" fill="'+P.ink+'">'+esc2(opts.name)+'</text>';
  if(opts.sub) out+='<text x="24" y="54" font-family="system-ui,sans-serif" font-size="11.5" fill="'+P.faint+'">'+esc2(opts.sub)+'</text>';
  let y=64, ci=0;
  const head=rows[0];
  out+='<rect x="24" y="'+y+'" width="'+(W-48)+'" height="'+headH+'" fill="'+P.head+'"/>';
  ci=0;
  head.forEach(c=>{
    const x=24+ci*colW;
    out+='<text x="'+(x+10)+'" y="'+(y+23)+'" font-family="system-ui,sans-serif" font-size="10" font-weight="600" letter-spacing="0.4" fill="'+P.muted+'">'+esc2(c.t.toUpperCase()).slice(0,60)+'</text>';
    ci+=c.span||1;
  });
  y+=headH;
  bodyRows.forEach((r,ri)=>{
    if(ri%2) out+='<rect x="24" y="'+y+'" width="'+(W-48)+'" height="'+rowH+'" fill="'+P.zebra+'"/>';
    let x=24;
    r.forEach(c=>{
      const w=colW*(c.span||1);
      if(c.bg) out+='<rect x="'+(x+3)+'" y="'+(y+4)+'" width="'+(w-6)+'" height="'+(rowH-8)+'" rx="4" fill="'+esc2(resolvePaint(c.bg))+'"/>';
      const fill=c.tint?c.tint:P.ink;
      const weight=c.tint?' font-weight="600"':'';
      const isNum=/^[\d.,]+%?$/.test(c.t);
      const tx=isNum&&!c.tint?'<text x="'+(x+10)+'" y="'+(y+rowH/2+4)+'" font-family="ui-monospace,monospace" font-size="11" fill="'+fill+'"'+weight+'>'
        :'<text x="'+(x+10)+'" y="'+(y+rowH/2+4)+'" font-family="system-ui,sans-serif" font-size="11" fill="'+fill+'"'+weight+'>';
      out+=tx+esc2(c.t.slice(0,Math.floor(w/6.2)))+'</text>';
      x+=w;
    });
    out+='<line x1="24" y1="'+(y+rowH)+'" x2="'+(W-24)+'" y2="'+(y+rowH)+'" stroke="'+P.line+'" stroke-width="0.6"/>';
    y+=rowH;
  });
  if(rows.length>41) out+='<text x="24" y="'+(y+16)+'" font-family="system-ui,sans-serif" font-size="11" fill="'+P.faint+'">+ '+(rows.length-41)+' more rows — export CSV for the full table</text>';
  return {svg:out, width:W, height:H};
};
U.chartFromModel=(m,opts)=>{
  if(!m||!m.type) return null;
  if(m.type==='columns') return columnsSVG(m,opts);
  return null;
};
/* One root for every generated chart: xmlns, explicit size, white paper and the
   same footer the on-screen exports carry. */
U.wrapSVG=(inner,W,H,footer)=>{
  const H2=H;
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 '+W+' '+H2+'" width="'+W+'" height="'+H2+'">'
    +inner
    +(footer?'<text x="24" y="'+(H2-14)+'" font-family="system-ui,sans-serif" font-size="10" fill="#8A93A5">'+String(footer).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</text>':'')
    +'</svg>';
};
/* A card with nothing drawn (an empty quarter, a centre with no visits) still has
   something to say. Export its words on paper instead of an empty sheet. */
U.textSVG = (host,opts)=>{
  opts=opts||{};
  const card=host.closest&&host.closest('.card');
  const title=(card&&card.querySelector('.card-title')?card.querySelector('.card-title').textContent.trim():'')||opts.name||'Note';
  const lines=[];
  [...(host.children||[])].forEach(n=>{
    const t=(n.textContent||'').replace(/\s+/g,' ').trim();
    if(t) lines.push(t);
  });
  if(!lines.length){ const t=(host.textContent||'').replace(/\s+/g,' ').trim(); if(t) lines.push(t); }
  const W=760, wrapped=[];
  lines.forEach(l=>{ wrapLabel(l,64).forEach(w=>wrapped.push(w)); });
  const H=Math.max(140,110+Math.min(wrapped.length,14)*20);
  let out='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  out+='<text x="26" y="38" font-family="Georgia,serif" font-size="18" fill="#1B1F27">'+esc2(title)+'</text>';
  wrapped.slice(0,14).forEach((l,i)=>{
    out+='<text x="26" y="'+(76+i*20)+'" font-family="system-ui,sans-serif" font-size="12.5" fill="#3A4250">'+esc2(l)+'</text>';
  });
  return {svg:U.wrapSVG(out,W,H,'Lab Systems · Ruli DH · '+title), width:W, height:H, name:title};
};
/* A ring gauge is two circles plus a label in a sibling span. A clone would lose
   the label and the rotation maths, so the ring is redrawn from its own value. */
U.ringSVG = (host,opts)=>{
  opts=opts||{};
  const valEl=host.querySelector('.val');
  const raw=valEl?valEl.textContent.replace(/\s+/g,'').trim():'';
  const pct=parseFloat(raw.replace('%',''));
  if(!isFinite(pct)) return null;
  const arcs=[...host.querySelectorAll('circle')];
  const paint=arcs.length?arcs[arcs.length-1].getAttribute('stroke'):null;
  const lv=pct>=95?BAND_HEX.g2:pct>=85?BAND_HEX.gold:pct>=70?BAND_HEX.amber:BAND_HEX.r2;
  const color=(paint&&resolvePaint(paint))||lv;
  const W=460, H=340, cx=W/2, cy=196, r=86, sw=15, c=2*Math.PI*r;
  let out='<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#FFFFFF"/>';
  const card=host.closest&&host.closest('.card');
  const title=(card&&card.querySelector('.card-title')?card.querySelector('.card-title').textContent.trim():'')||opts.name||'';
  if(title) out+='<text x="26" y="34" font-family="Georgia,serif" font-size="18" fill="#1B1F27">'+esc2(title)+'</text>';
  out+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#E8EBF0" stroke-width="'+sw+'"/>';
  out+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+sw+'" stroke-linecap="round" '
    +'stroke-dasharray="'+(((pct>100?100:pct)/100)*c).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
  out+='<text x="'+cx+'" y="'+(cy+16)+'" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#090E1A">'+esc2(raw||pct+'%')+'</text>';
  /* The explanation belongs under the title, wrapped to the sheet — centred on the
     ring it would run off both edges. */
  const sub=(card&&card.querySelector('.card-sub')?card.querySelector('.card-sub').textContent.replace(/\s+/g,' ').trim():'');
  if(sub) wrapLabel(sub,Math.floor((W-52)/5.9)).slice(0,2).forEach((ln,k)=>{
    out+='<text x="26" y="'+(56+k*14)+'" font-family="system-ui,sans-serif" font-size="10.5" fill="#8A93A5">'+esc2(ln)+'</text>';
  });
  const name=title||opts.name||'gauge';
  return {svg:U.wrapSVG(out,W,H,'Lab Systems · Ruli DH · '+name), width:W, height:H, name:name};
};
U.chartSVG = (host,opts)=>{
  opts=opts||{};
  if(!host) return null;
  /* 1. A chart that knows its own numbers is drawn from them — exact, legible,
        and independent of how the browser happened to lay the card out. */
  const rawModel=host.getAttribute&&host.getAttribute('data-chart-model');
  if(rawModel){
    try{
      const m=JSON.parse(decodeURIComponent(rawModel));
      const built=U.chartFromModel(m,opts);
      if(built) return {svg:U.wrapSVG(built.svg,built.width,built.height,'Lab Systems · Ruli DH · '+(opts.name||m.title||'chart')),
        width:built.width, height:built.height, name:opts.name||m.title||'chart'};
    }catch(e){}
  }
  /* 2. A table is exported as a table — real header, real rows, real cell colours
        — rather than as a ghost of its scroll box. */
  /* A table is a table even if a cell holds an icon <svg>; the earlier `svg`
     test made those cards fall through to the tracer and lose their columns. */
  const isTable=(host.tagName||'').toLowerCase()==='table';
  const tbl=isTable?host:(host.querySelector&&host.querySelector('table'));
  if(tbl && (isTable || !(host.querySelector&&host.querySelector('svg')))){
    const built=U.tableSVG(tbl,{name:opts.name||'',sub:opts.sub||''});
    if(built) return {svg:U.wrapSVG(built.svg,built.width,built.height,'Lab Systems · Ruli DH · '+(opts.name||'table')),
      width:built.width, height:built.height, name:opts.name||'table'};
  }
  /* HTML bar charts have no <svg>; rebuild the same numbers as vector art so an
     export never silently returns nothing. */
  const barHost=(host.__chartCfg&&host.__chartCfg.type==='bars')?host:(host.querySelector&&host.querySelector('[data-bar]')?host:null);
  if(!(host.tagName||'').toLowerCase().match(/svg/) && !host.querySelector('svg')){
    const card=host.closest&&host.closest('.card');
    const title=card&&card.querySelector('.card-title')?card.querySelector('.card-title').textContent.trim():'';
    /* A ranked bar set is rebuilt from its own numbers — cleaner than tracing the DOM. */
    const cfg=barHost&&barHost.__chartCfg;
    if(cfg && window.LS && LS.charts && LS.charts.barSVG){
      const built=LS.charts.barSVG(cfg.items,{title:opts.name||title||''});
      if(built) return {svg:built.svg, width:built.width, height:built.height, name:(opts.name||title||'chart')};
    }
    /* Everything else drawn in HTML — heat strips, index columns, capacity bars,
       ring gauges, allocation tiles — is traced into real SVG elements, so both
       the SVG and the PNG download come out as vector art of exactly what the
       screen shows. */
    const traced=U.htmlChartSVG(host,{name:opts.name||title||'chart'});
    const drawn=traced?((traced.svg.match(/<(rect|line|path|circle|text|polyline|polygon)\b/g)||[]).length):0;
    if(!traced || drawn<5) return U.textSVG(host,{name:opts.name||title});
    return traced;
  }
  const svg=(host.tagName||'').toLowerCase()==='svg'?host:host.querySelector('svg');
  if(!svg) return null;
  if(host.closest&&host.closest('.score-ring')){ const ring=U.ringSVG(host.closest('.score-ring'),opts); if(ring) return ring; }
  const clone=svg.cloneNode(true);
  /* Interaction furniture is not part of the picture: the invisible hit rect (which
     CSS paints dark in some themes), the crosshair and the hover dots. */
  [clone].concat([...clone.querySelectorAll('*')]).forEach(n=>{
    const id=n.getAttribute&&n.getAttribute('id')||'';
    const cls=n.getAttribute&&n.getAttribute('class')||'';
    if(/-hit$|-dots$|-tip$|-cross$/.test(id) || /crosshair|chart-tip/.test(cls)){ if(n.parentNode) n.parentNode.removeChild(n); }
  });
  const box=svg.getBoundingClientRect?svg.getBoundingClientRect():{width:0,height:0};
  const vb=(svg.getAttribute('viewBox')||'0 0 760 240').split(/\s+/).map(Number);
  const W=vb[2]||box.width||760, H=vb[3]||box.height||240;
  clone.removeAttribute('preserveAspectRatio');   /* the serializer declares xmlns itself */
  clone.setAttribute('width',W); clone.setAttribute('height',H);
  /* The on-screen chart is painted by CSS classes (`.chart-svg text{fill:…}`,
     `.grid{stroke:…}`). A cloned SVG carries no stylesheet, so every node's
     computed paint is inlined here — otherwise the export is a set of invisible
     lines on white. */
  const liveNodes=[svg].concat([...svg.querySelectorAll('*')]);
  const cloneNodes=[clone].concat([...clone.querySelectorAll('*')]);
  const PAINT=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','font-size','font-family','font-weight','letter-spacing','text-anchor'];
  liveNodes.forEach((ln,i)=>{
    const cn=cloneNodes[i]; if(!cn||!cn.setAttribute) return;
    let cs=null; try{ cs=getComputedStyle(ln); }catch(e){ return; }
    if(!cs) return;
    const decl=[];
    PAINT.forEach(prop=>{
      let v=cs.getPropertyValue(prop); if(v==null||v==='') return;
      v=String(v).trim(); if(!v||v==='normal'||v==='auto') return;
      if(prop==='opacity'&&v==='1') return;
      decl.push(prop+':'+resolvePaint(v));
    });
    if(decl.length) cn.setAttribute('style',decl.join(';'));
  });
  /* Gradients and strokes often sit in presentation attributes (`stop-color`), not
     in style — resolve those too, and replace currentColor with the real ink. */
  cloneNodes.forEach((cn,i)=>{
    const ln=liveNodes[i]; if(!cn.getAttribute) return;
    ['fill','stroke','stop-color','flood-color','color'].forEach(a=>{
      const v=cn.getAttribute(a); if(!v) return;
      let rv=resolvePaint(v);
      if(rv&&rv.toLowerCase()==='currentcolor'){
        try{ rv=getComputedStyle(ln).color||'#111'; }catch(e){ rv='#111'; }
      }
      cn.setAttribute(a,rv);
    });
    const st=cn.getAttribute('style');
    if(st) cn.setAttribute('style',resolvePaint(st));
  });
  clone.querySelectorAll('[style]').forEach(n=>{ n.setAttribute('style',resolvePaint(n.getAttribute('style'))); });
  [clone].concat([...clone.querySelectorAll('*')]).forEach(n=>{
    ['fill','stroke','stop-color','color'].forEach(attr=>{
      if(n.hasAttribute&&n.hasAttribute(attr)){ const v=resolvePaint(n.getAttribute(attr)); if(v) n.setAttribute(attr,v); }
    });
  });
  if(host.classList&&host.classList.contains('score-ring')){
    const ring=U.ringSVG(host,opts); if(ring) return ring;
  }
  /* An <svg> that exists but holds nothing plotted (an empty quarter) would export
     as a white page with a caption — say what the card says instead. */
  const drawn=(clone.outerHTML.match(/<(rect|line|path|circle|text|polyline|polygon)\b/g)||[]).length;
  if(drawn<3){ const note=U.textSVG(host,{name:opts.name}); if(note) return note; }
  /* A line chart animates itself in with pathLength="1" + a 1-unit dash; a still
     image must show the finished line, not its first pixel — so this runs after the
     computed paint has been inlined, otherwise the style is overwritten. */
  clone.querySelectorAll('.path-line,[style*="drawIn"]').forEach(n=>{
    n.removeAttribute('pathLength');
    const sw=(String(n.getAttribute('style')||'').match(/stroke-width:([^;]+)/)||[])[1]||'1.8';
    n.setAttribute('style','fill:none;stroke-dasharray:none;stroke-dashoffset:0;stroke-width:'+sw.trim()+';stroke-linecap:round;stroke-linejoin:round');
  });
  const card=(host.closest&&host.closest('.card'))||null;
  const bg='#ffffff';
  const title=card&&card.querySelector('.card-title')?card.querySelector('.card-title').textContent.trim():'';
  const footer='Lab Systems · Ruli DH'+(title?' · '+title:'');
  /* The key to the lines lives beside the chart, in HTML, so a clone of the plot
     alone would export six coloured lines with nothing to name them. Carry the
     legend across as real text. */
  const legendHost=(host.parentElement&&host.parentElement.querySelector('.legend'))||(card&&card.querySelector('.legend'));
  const legend=[];
  if(legendHost){
    [...legendHost.querySelectorAll('.lg')].forEach(lg=>{
      const sw=lg.querySelector('.sw,.cal-dot,i');
      const label=(lg.textContent||'').replace(/\s+/g,' ').trim();
      if(!label) return;
      let col='#8C93A3';
      if(sw){
        const inline=(sw.getAttribute('style')||'').match(/background(?:-color)?\s*:\s*([^;]+)/);
        try{
          const cs=getComputedStyle(sw);
          const live=(cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent')?cs.backgroundColor:'';
          col=resolvePaint(live||(inline?inline[1].trim():'')||cs.borderColor||'#8C93A3');
        }catch(e){ col=resolvePaint(inline?inline[1].trim():'#8C93A3'); }
      }
      legend.push({label:label,col:col});
    });
  }
  /* The card puts its title above the plot; a downloaded picture that starts at the
     axis labels is anonymous, so the title and its one-line explanation come with it. */
  const sub=(card&&card.querySelector('.card-sub')?card.querySelector('.card-sub').textContent.replace(/\s+/g,' ').trim():'');
  const headH=title?44:6;
  const legendH=legend.length?26:0;
  const totalH=H+34+legendH+headH;
  const outWrap=document.createElementNS('http://www.w3.org/2000/svg','svg');
  outWrap.setAttribute('viewBox','0 0 '+W+' '+totalH);
  outWrap.setAttribute('width',W); outWrap.setAttribute('height',totalH);
  const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
  rect.setAttribute('x',0); rect.setAttribute('y',0); rect.setAttribute('width',W); rect.setAttribute('height',totalH);
  rect.setAttribute('fill',resolvePaint(bg)||'#fff');
  outWrap.appendChild(rect);
  if(title){
    const t1=document.createElementNS('http://www.w3.org/2000/svg','text');
    t1.setAttribute('x',12); t1.setAttribute('y',26);
    t1.setAttribute('font-family','Georgia, serif'); t1.setAttribute('font-size',17);
    t1.setAttribute('fill',INK.ink);
    t1.textContent=title;
    outWrap.appendChild(t1);
    if(sub){
      const t2=document.createElementNS('http://www.w3.org/2000/svg','text');
      t2.setAttribute('x',12); t2.setAttribute('y',41);
      t2.setAttribute('font-family','system-ui, sans-serif'); t2.setAttribute('font-size',10.5);
      t2.setAttribute('fill',INK.faint);
      t2.textContent=sub.slice(0,120);
      outWrap.appendChild(t2);
    }
  }
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  g.setAttribute('transform','translate(0,'+(headH)+')');
  while(clone.firstChild) g.appendChild(clone.firstChild);
  outWrap.appendChild(g);
  if(legend.length){
    const ink=INK.ink;
    let x=12;
    legend.forEach(it=>{
      /* Swatch and label share one baseline; the label sits to the right of a 9px
         square, and the row never runs off the sheet. */
      const ty=headH+H+22;
      const sw=document.createElementNS('http://www.w3.org/2000/svg','rect');
      sw.setAttribute('x',x); sw.setAttribute('y',ty-8);
      sw.setAttribute('width',9); sw.setAttribute('height',9); sw.setAttribute('rx',2);
      sw.setAttribute('fill',it.col);
      outWrap.appendChild(sw);
      const tx=document.createElementNS('http://www.w3.org/2000/svg','text');
      tx.setAttribute('x',x+14); tx.setAttribute('y',ty);
      tx.setAttribute('font-family','system-ui, sans-serif'); tx.setAttribute('font-size',10.5);
      tx.setAttribute('fill',resolvePaint(ink));
      tx.textContent=it.label;
      outWrap.appendChild(tx);
      x+=22+Math.min(240,it.label.length*6.9);
    });
  }
  const foot=document.createElementNS('http://www.w3.org/2000/svg','text');
  foot.setAttribute('x',12); foot.setAttribute('y',totalH-10);
  foot.setAttribute('font-family','system-ui, sans-serif'); foot.setAttribute('font-size',10);
  foot.setAttribute('fill',INK.faint);
  foot.textContent=footer;
  outWrap.appendChild(foot);
  return {svg:new XMLSerializer().serializeToString(outWrap), width:W, height:totalH, name:(opts.name||title||'chart')};
};
U.exportChartSVG = (host,opts)=>{
  const d=U.chartSVG(host,opts); if(!d){ U.toast&&U.toast('Nothing to export here',{type:'warn'}); return false; }
  const safe=(d.name||'chart').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  U.download(safe+'-'+U.todayISO()+'.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+d.svg,'image/svg+xml;charset=utf-8');
  return true;
};
U.exportChartPNG = (host,opts)=>{
  const d=U.chartSVG(host,opts); if(!d) return Promise.resolve(false);
  /* If this browser cannot rasterise the SVG (a locked-down canvas), fall back to
     the vector file rather than telling the user the card cannot be saved. */
  const svgFallback=()=>{
    const safe=(d.name||'chart').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    U.download(safe+'-'+U.todayISO()+'.svg','<?xml version="1.0" encoding="UTF-8"?>\n'+d.svg,'image/svg+xml;charset=utf-8');
    return true;
  };
  const scale=(opts&&opts.scale)||3;
  const safe=(d.name||'chart').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  return new Promise(resolve=>{
    const img=new Image();
    const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(d.svg);
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(d.width*scale); canvas.height=Math.round(d.height*scale);
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob=>{ if(blob) U.download(safe+'-'+U.todayISO()+'.png',blob,'image/png'); resolve(blob?true:svgFallback()); },'image/png');
      }catch(e){ resolve(svgFallback()); }
    };
    img.onerror=()=>resolve(svgFallback());
    img.src=url;
  });
};
/* ——— Patient identity ————————————————————————————
   This register identifies a sample by its ID, never by a person's name. The name
   field exists in the record shape, and it is always the single word below: nothing
   is displayed, exported, printed or pushed with a patient name in it. `U.ptName`
   takes the stored value so callers need no branch — it answers with the mask. */
U.CONFIDENTIAL='Confidential';
/* Anyone signed in reads a recorded name — the whole laboratory staff. The mask is
   for the public visitor only: the read-only session opened from the landing, which has
   no account behind it. */
U.canSeeNames=function(){
  try{
    if(!(window.LS&&LS.auth&&LS.auth.user)) return false;
    if(LS.auth.isVisitor&&LS.auth.isVisitor()) return false;
    return !LS.auth.user.visitor;
  }catch(e){ return false; }
};
U.ptName=function(rec){
  if(rec && U.canSeeNames() && rec.patientName && rec.patientName!==U.CONFIDENTIAL) return rec.patientName;
  return U.CONFIDENTIAL;
};
/* Whole years between a date of birth and a reference date. */
U.ageFromDob=function(dob,at){
  if(!dob) return '';
  const b=String(dob).slice(0,10); if(b.length<10) return '';
  const ref=String(at||U.todayISO()).slice(0,10);
  const y=new Date(b+'T12:00:00'), t=new Date(ref+'T12:00:00');
  if(isNaN(y)||isNaN(t)||t<y) return '';
  let a=t.getFullYear()-y.getFullYear();
  const m=t.getMonth()-y.getMonth();
  if(m<0||(m===0&&t.getDate()<y.getDate())) a--;
  return a;
};

U.copy = async (text)=>{
  try{ await navigator.clipboard.writeText(text); return true; }
  catch(e){ try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; }catch(e2){ return false; } }
};
U.print = (html)=>{
  /* A window of its own is what every desktop and Android browser prints correctly. A blocked
     popup (or a browser that refuses it) falls back to the hidden frame. */
  let win=null;
  try{ win=window.open('','_blank'); }catch(e){ win=null; }
  if(win && win.document){
    try{
      win.document.open(); win.document.write(html); win.document.close();
      setTimeout(()=>{ try{ win.focus(); win.print(); }catch(e){} },300);
      return true;
    }catch(e){ try{ win.close(); }catch(_){} }
  }
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const w=f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} setTimeout(()=>f.remove(),1200); },260);
  return true;
};
U.letterhead = (opts)=>{
  const s=LS.store.settings();
  return '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0B1C3D;padding-bottom:8px;margin-bottom:12px">'
   +'<div><div style="font-family:Georgia,serif;font-size:15px;font-weight:600;color:#0B1C3D">'+(s.hospital||'Ruli District Hospital')+'</div>'
   +'<div style="font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#666">'+(s.dept||'Laboratory Department')+' · Republic of Rwanda</div></div>'
   +'<div style="text-align:right;font-size:8.5px;color:#666;line-height:1.5">'+(s.phone||'')+'<br>'+(s.email||'')+'<br>Generated '+new Date().toLocaleString('en-GB',{timeZone:'Africa/Kigali'})+'</div></div>';
};
U.printDoc = (title,body,opts)=>{
  const css='@page{size:A4 '+(opts&&opts.landscape?'landscape':'portrait')+';margin:12mm}'
   +'body{font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#111;margin:0;font-size:10.5px;line-height:1.45}'
   +'table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;font-size:9px}'
   +'th{background:#F4F1E8;color:#0B1C3D;font-weight:600}h1{font-size:13px;margin:0 0 2px;color:#0B1C3D}'
   +'.sig{display:flex;gap:24px;margin-top:26px}.sig div{flex:1;border-top:1px solid #999;padding-top:4px;font-size:8.5px;color:#555}'
   +'.meta{display:flex;gap:18px;font-size:8.5px;color:#555;margin-top:4px}'
   +'.foot{margin-top:16px;font-size:7.5px;color:#999;border-top:1px solid #eee;padding-top:5px}';
  U.print('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+U.esc(title)+'</title><style>'+css+'</style></head><body>'
    + U.letterhead() + '<h1>'+U.esc(title)+'</h1>'
    + (opts&&opts.meta?'<div class="meta">'+opts.meta+'</div>':'')
    + body
    + (opts&&opts.signatures!==false ? '<div class="sig"><div>Prepared by · Laboratory Manager</div><div>Verified by · Clinical Director</div><div>Approved by · HR Officer</div></div>' : '')
    + '<div class="foot">Lab Systems v6.0 · Ruli District Hospital Laboratory · ISO 15189-aligned document control · This document is uncontrolled when printed.</div>'
    + '</body></html>');
};

/* ——— Storage helpers ————————————————————————— */
U.store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ console.warn('storage set failed',k,e.message); return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
U.session = {
  get(k,d){ try{ const v=sessionStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ sessionStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  del(k){ try{ sessionStorage.removeItem(k); }catch(e){} }
};

/* ——— Colour utilities ————————————————————— */
U.hexA = (hex,a)=>{
  const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
};
U.statusTone = (s)=>{
  const m={Positive:'rose',Negative:'teal',Pending:'amber',Done:'teal',Rejected:'rose',Received:'blue',Dispatched:'blue',Registered:'slate',Resulted:'teal',Collected:'slate','In transit':'amber'};
  return m[s]||'slate';
};
U.initials = name=> String(name||'?').replace(/[^A-Za-z\s]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const AV=['#D4B76A','#8FB3D9','#7FC7B6','#D9A0A8','#B3A0D9','#C7B888','#8FC7A0','#D9BFA0'];
/* A staff portrait, wherever one has been uploaded. Kept on the staff record and
   read by name so the same face appears on cards, lists, rosters and prints. */
U.staffPhoto = name=>{
  if(!name) return '';
  try{ const st=(LS.store&&LS.store.db&&LS.store.db().staff)||[]; const p=st.find(x=>x&&x.name===name); return (p&&p.photo)||''; }catch(e){ return ''; }
};
U.avatar = (name,cls,photo)=>{
  photo=photo||U.staffPhoto(name);
  if(photo) return '<span class="avatar '+(cls||'')+'"><img src="'+U.esc(photo)+'" alt="'+U.esc(name||'')+'"></span>';
  const c=AV[U.hash(name)%AV.length];
  return '<span class="avatar '+(cls||'')+'" style="background:linear-gradient(140deg,'+c+',color-mix(in srgb,'+c+' 65%,#5F4A1C))" title="'+U.esc(name||'')+'">'+U.esc(U.initials(name))+'</span>';
};
})();
