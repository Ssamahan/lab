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
U.copy = async (text)=>{
  try{ await navigator.clipboard.writeText(text); return true; }
  catch(e){ try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; }catch(e2){ return false; } }
};
U.print = (html)=>{
  const f=document.createElement('iframe');
  f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(f);
  const w=f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} setTimeout(()=>f.remove(),1200); },260);
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
U.avatar = (name,cls,photo)=>{
  if(photo) return '<span class="avatar '+(cls||'')+'"><img src="'+U.esc(photo)+'" alt=""></span>';
  const c=AV[U.hash(name)%AV.length];
  return '<span class="avatar '+(cls||'')+'" style="background:linear-gradient(140deg,'+c+',color-mix(in srgb,'+c+' 65%,#5F4A1C))" title="'+U.esc(name||'')+'">'+U.esc(U.initials(name))+'</span>';
};
})();
