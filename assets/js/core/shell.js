/* ============================================================================
   LAB SYSTEMS · SHELL — navigation, routing, command palette, chrome
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU; const UI=LS.ui; const S=LS.store; const SH={}; LS.shell=SH;
const APP_VERSION='6.9.27';
window.LS.modules = window.LS.modules || {};

const ICON={
  dash:'layout-dashboard', samples:'flask-conical', stock:'package', training:'graduation-cap', revenue:'wallet',
  roster:'calendar-days', leave:'calendar-clock', eqa:'target', pbf:'award', quality:'shield-check',
  equipment:'microscope', staff:'users', security:'lock', design:'palette', roadmap:'rocket'
};
const ROUTES={
  dash:{title:'Command Center',sub:'Live laboratory operations · Ruli District Hospital',group:'Operations',icon:ICON.dash,file:'dash'},
  samples:{title:'Referred Samples',sub:'Register · chain of custody · manifest · TAT',group:'Operations',icon:ICON.samples,file:'samples'},
  stock:{title:'Stock & Supplies',sub:'Consumables · lots · expiry · forecasts',group:'Operations',icon:ICON.stock,file:'stock'},
  training:{title:'Training Roster',sub:'FIFO queue · registry · competency history',group:'People',icon:ICON.training,file:'training'},
  revenue:{title:'Training Revenue',sub:'Expenses · reimbursements · balance',group:'People',icon:ICON.revenue,file:'revenue',permission:'revenue'},
  roster:{title:'Working Plan',sub:'Shift grid · coverage · fairness',group:'Scheduling',icon:ICON.roster,file:'roster'},
  leave:{title:'Leave & Timeline',sub:'Annual & authorised leave · plans · forecast',group:'Scheduling',icon:ICON.leave,file:'leave'},
  eqa:{title:'EQA / PT Scores',sub:'Proficiency testing · z-scores · CAPA',group:'Quality',icon:ICON.eqa,file:'eqa'},
  pbf:{title:'PBF Evaluation',sub:'Health-centre performance-based financing scores',group:'Quality',icon:ICON.pbf,file:'pbf'},
  quality:{title:'Quality & Compliance',sub:'ISO 15189 readiness · SOPs · incidents · QC',group:'Quality',icon:ICON.quality,file:'quality'},
  equipment:{title:'Equipment',sub:'Uptime · preventive & curative maintenance · supplier response',group:'Quality',icon:ICON.equipment,file:'equipment'},
  staff:{title:'Staff & Settings',sub:'Registry · roles · branding · data',group:'Admin',icon:ICON.staff,file:'staff'},
  security:{title:'Security Center',sub:'Sessions · 2FA · audit trail · residency',group:'Admin',icon:ICON.security,file:'security',permission:'security'},
  design:{title:'Design System',sub:'Tokens · components · motion specification',group:'Admin',icon:ICON.design,file:'design',permission:'settings'},
  roadmap:{title:'Premium Roadmap',sub:'The 100 upgrades behind Lab Systems v6',group:'Admin',icon:ICON.roadmap,file:'roadmap',permission:'settings'}
};
const GROUPS=['Operations','People','Scheduling','Quality','Admin'];
SH.ROUTES=ROUTES;
const loaded={};

/* ——— Route parsing ——————————————————————— */
function parse(){
  const h=location.hash.replace(/^#\/?/,'');
  const [path,q]=h.split('?');
  const id=(path||'dash').split('/')[0]||'dash';
  const params={};
  (q||'').split('&').filter(Boolean).forEach(kv=>{ const [k,v]=kv.split('='); params[decodeURIComponent(k)]=decodeURIComponent(v||''); });
  return {id:ROUTES[id]?id:'dash', params};
}
SH.params=()=>parse().params;
SH.current=()=>parse().id;

/* ——— Module loading (code-split per route) ——————— */
function loadModule(id){
  const r=ROUTES[id];
  if(loaded[id]) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const sc=document.createElement('script');
    sc.src='assets/js/modules/'+r.file+'.js';
    sc.async=true;
    sc.onload=()=>{ loaded[id]=true; resolve(); };
    sc.onerror=()=>reject(new Error('Could not load module: '+id));
    document.head.appendChild(sc);
  });
}

/* ——— Render nav ————————————————————————— */
function navHTML(){
  let h='';
  GROUPS.forEach(g=>{
    const items=Object.keys(ROUTES).filter(k=>ROUTES[k].group===g && (!ROUTES[k].permission||LS.auth.can(ROUTES[k].permission)));
    if(!items.length) return;
    h+='<div class="nav-group"><div class="nav-group-label" data-i18n="nav.'+g.toLowerCase()+'">'+LS.i18n.t('nav.'+g.toLowerCase())+'</div>';
    items.forEach(k=>{
      const r=ROUTES[k];
      h+='<button class="nav-item" data-tab="'+k+'" data-tip="'+U.esc(r.title)+'" data-tip-meta="'+U.esc(LS.i18n.t('nav.'+g.toLowerCase(),g))+'">'+U.ic(r.icon,18)
       +'<span class="lbl" data-i18n="nav.'+k+'">'+LS.i18n.t('nav.'+k, r.title)+'</span>'
       +'<span class="n-count" data-count-for="'+k+'" hidden></span></button>';
    });
    h+='</div>';
  });
  return h;
}
function updateBadges(){
  try{
    const st=S.sampleStats();
    const set=(k,n)=>{ U.$$('[data-count-for="'+k+'"]').forEach(e=>{ if(n>0){ e.hidden=false; e.textContent=n>99?'99+':n; } else e.hidden=true; }); };
    set('samples', st.active);
    set('stock', S.stockOverview().filter(x=>x.low).length);
    set('leave', S.db().leaves.filter(l=>l.status==='Pending').length);
    set('quality', S.db().incidents.filter(i=>i.status!=='Closed').length);
  }catch(e){}
}
function activeNav(id){
  U.$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  U.$$('.bnav-item').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
}

/* ——— Chrome ————————————————————————————— */
SH.build=function(){
  const navEl=document.getElementById('navItems');
  if(navEl) navEl.innerHTML=navHTML();
  const bn=document.getElementById('bottomNav');
  if(bn){
    const items=[['dash','Ikibaho','layout-dashboard','Dashboard'],['samples','Ingero','flask-conical','Samples'],['roster','Gahunda','calendar-days','Plan'],['eqa','EQA','target','EQA']];
    bn.innerHTML=items.map(([k,l,ic,tt])=>'<button class="bnav-item" data-tab="'+k+'" title="'+tt+'">'+U.ic(ic,20)+'<span class="lbl">'+l+'</span></button>').join('')
      +'<button class="bnav-item" data-more="1" title="More">'+U.ic('menu',20)+'<span class="lbl">More</span></button>';
  }
  LS.auth.renderUserChip();
  paintVisitorBar();
  startClock();
  updateBadges();
  applyTheme();
  applyDensity();
  applyRoleClass();
  wireGlobal();
  updateNet();
};

/* ——— Visitor view —————————————————————————
   A visitor reads the whole register except Training Revenue, Settings and the
   Data & sync tab. The strip says so once, and offers the two ways out. */
function paintVisitorBar(){
  const bar=document.getElementById('visitorBar'); if(!bar) return;
  const on=!!(LS.auth.isVisitor&&LS.auth.isVisitor());
  bar.hidden=!on;
  if(!on) return;
  const si=document.getElementById('vbSignIn');
  if(si) si.onclick=()=>{ if(LS.landing) LS.landing.signIn(); };
  const ov=document.getElementById('vbOverview');
  if(ov) ov.onclick=()=>{ if(LS.landing) LS.landing.show(); };
  const who=document.getElementById('vbWho');
  if(who) who.textContent='Visitor · read only';
}

/* Reviewers and viewers get the record, not the essay. Long explanatory copy
   under a page title is for the people who administer the console. */
function applyRoleClass(){
  const limited=!LS.auth.can('edit');
  const app=document.querySelector('.app');
  if(app) app.classList.toggle('role-limited',limited);
  document.documentElement.classList.toggle('role-limited',limited);
}

/* ——— Rail label flyout ————————————————————————————
   While the rail is minimised the module names live in a small fixed chip that
   follows the pointer, because the nav itself scrolls and would clip them. */
let railTip=null, railTipTimer=null;
function railTipEl(){
  if(!railTip){ railTip=U.el('<div class="rail-tip" role="tooltip"></div>'); document.body.appendChild(railTip); }
  return railTip;
}
function showRailTip(item){
  if(!document.querySelector('.app.rail-mini')) return;
  const r=item.getBoundingClientRect();
  const tip=railTipEl();
  const title=item.dataset.tip||'';
  const meta=item.dataset.tipMeta||'';
  tip.innerHTML=U.esc(title)+(meta?'<small>'+U.esc(meta)+'</small>':'');
  tip.style.left=Math.round(r.right+10)+'px';
  tip.style.top=Math.round(r.top+r.height/2)+'px';
  clearTimeout(railTipTimer);
  requestAnimationFrame(()=>tip.classList.add('on'));
}
function hideRailTip(){
  if(!railTip) return;
  clearTimeout(railTipTimer);
  railTipTimer=setTimeout(()=>railTip&&railTip.classList.remove('on'),60);
}
SH._railTip={show:showRailTip,hide:hideRailTip};
function startClock(){
  const t=document.getElementById('clockTime'), d=document.getElementById('clockDate');
  const tick=()=>{
    const now=new Date();
    if(t) t.textContent=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Africa/Kigali'});
    if(d) d.textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',timeZone:'Africa/Kigali'})+' · Kigali';
    const fy=document.getElementById('fyChip'); if(fy) fy.textContent='FY '+U.fyLabel();
  };
  tick(); clearInterval(SH._clock); SH._clock=setInterval(tick,1000);
}
/* 'auto' resolves against the operating system, light unless the device actually
   asks for dark — most desktop browsers report no preference, so the console
   opens light on a PC and dark only on a phone that is set to dark. */
function resolvedTheme(){
  const s=S.settings(); const t=s.theme||'auto';
  if(t!=='auto') return t;
  try{ return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'ink':'porcelain'; }
  catch(e){ return 'porcelain'; }
}
function applyTheme(){
  const theme=resolvedTheme();
  document.documentElement.setAttribute('data-theme',theme);
  U.$$('[data-theme-label]').forEach(e=>e.textContent=theme==='ink'?'Ink':'Porcelain');
  U.$$('[data-theme-icon]').forEach(e=>e.innerHTML=U.ic(theme==='ink'?'moon':'sun',15));
  U.$$('[data-theme-label]').forEach(e=>e.textContent=(S.settings().theme==='auto'?'Auto · ':'')+(theme==='ink'?'Ink':'Porcelain'));
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=theme==='ink'?'#05070D':'#F2EFE7';
}
SH.applyTheme=applyTheme;
SH.resolvedTheme=resolvedTheme;
function applyDensity(){
  const d=S.settings().density||'comfortable';
  document.documentElement.setAttribute('data-density',d);
  U.$$('[data-density-label]').forEach(e=>e.textContent=d==='compact'?'Compact':'Comfortable');
}
SH.toggleTheme=function(){
  const cur=resolvedTheme();
  S.settings().theme = cur==='ink'?'porcelain':'ink';
  S.db().meta.themeChosen=true;
  S.save(); applyTheme(); UI.toast('Theme: '+(resolvedTheme()==='ink'?'Ink':'Porcelain'),{type:'info'});
};
SH.toggleDensity=function(){
  S.settings().density = S.settings().density==='compact'?'comfortable':'compact';
  S.save(); applyDensity(); UI.toast('Density: '+(S.settings().density==='compact'?'Compact — more rows per screen':'Comfortable'),{type:'info'});
};

/* ——— Router ——————————————————————————— */
SH.route=async function(opts){
  const {id,params}=parse();
  const r=ROUTES[id];
  const changed=SH._lastId && SH._lastId!==id;
  SH._lastId=id;
  if(changed){ try{ LS.ui.closeAll(); }catch(e){} }
  activeNav(id);
  const crumb=document.getElementById('crumbGroup'), title=document.getElementById('pageTitle');
  if(crumb) crumb.textContent=r.group;
  if(title) title.textContent=r.title;
  document.title=r.title+' · Lab Systems — Ruli District Hospital';
  const page=document.getElementById('page');
  if(!page) return;
  // permission gate
  if(r.permission && !LS.auth.can(r.permission)){
    const visitor=!!(LS.auth.isVisitor&&LS.auth.isVisitor());
    page.innerHTML='<div class="page"><div class="card pad" style="max-width:560px;margin:6vh auto">'+UI.empty({art:'lock',title:'Restricted module',
      body:visitor?'A visitor may read the whole register except Training Revenue, Settings and Data & sync. Sign in to open '+r.title+'.'
        :'Your role ('+LS.auth.user.role+') does not have access to '+r.title+'. The Lab Manager can grant access in Security Center.',
      action:visitor?'<button class="btn" data-go="dash">'+U.ic('arrow-left',15)+' Back to Command Center</button><button class="btn primary" data-visitor-signin>'+U.ic('key-round',15)+' Sign in</button>'
        :'<button class="btn" data-go="dash">'+U.ic('arrow-left',15)+' Back to Command Center</button>'})+'</div></div>';
    const g=page.querySelector('[data-go]'); if(g) g.onclick=()=>SH.go('dash');
    const vs=page.querySelector('[data-visitor-signin]'); if(vs) vs.onclick=()=>{ if(LS.landing) LS.landing.signIn(); };
    return;
  }
  // A navigation always closes any open drawer or modal. Leaving a layer open
  // used to keep the body scroll-locked, which is what made scrolling feel broken.
  try{ UI.closeAll(); }catch(e){}
  page.dataset.route=id;
  page.innerHTML='<div class="page">'+UI.skel(3,'kpi')+'<div style="height:16px"></div>'+UI.skel(1,'table')+'</div>';
  clearTimeout(SH._failTimer);
  SH._failTimer=setTimeout(()=>{ if(page.dataset.route===id && page.querySelector('.skeleton')) SH.fail(new Error('Module took longer than 25 seconds to render. The local register is intact — try reloading, or open another module.'),id,page); }, 25000);
  if(document.body.classList.contains('rail-open')) document.body.classList.remove('rail-open');
  document.querySelector('.app')?.classList.remove('rail-open');
  try{
    await loadModule(id);
    const mod=LS.modules[id];
    if(!mod||!mod.render) throw new Error('Module not registered');
    page.innerHTML='<div class="page" id="pageInner"></div>';
    const root=page.querySelector('#pageInner');
    await mod.render(root, params);
    clearTimeout(SH._failTimer);
    UI.animateCounts(root); UI.observeReveals(root);
    wireChartExports(root);
    wireCardExports(root);
    /* Charts drawn after the first paint (trends, dashboard plots, tab switches)
       still get their export buttons without the module having to ask. */
    watchCharts(root);
    // scroll restore / top
    if(!opts||!opts.keepScroll) window.scrollTo({top:0,behavior:U.reduced()?'auto':'smooth'});
  }catch(err){
    console.error('Route error',id,err);
    SH.fail(err,id,page);
  }
  updateBadges();
  try{ localStorage.setItem('labSystems.lastTab.v1',id); }catch(e){}
  if(window.innerWidth>980) document.getElementById('content')?.focus({preventScroll:true});
};
SH.go=function(id,params){
  const q=params?('?'+Object.keys(params).map(k=>k+'='+encodeURIComponent(params[k])).join('&')):'';
  const target='#/'+id+q;
  if(location.hash===target) SH.route(); else location.hash=target;
};
SH.refresh=function(){ SH.route({keepScroll:true}); };
SH.fail=function(err,id,host){
  const box=host||document.getElementById('page');
  if(!box) return;
  const diag='Lab Systems v'+APP_VERSION+'\nroute: '+id+'\nUA: '+navigator.userAgent+'\ntime: '+new Date().toISOString()+'\nerror: '+(err&&err.stack||err&&err.message||err);
  box.innerHTML='<div class="page"><div class="card pad" style="max-width:620px;margin:5vh auto">'
   +'<div class="row" style="gap:12px;margin-bottom:10px"><div class="kpi-ic" style="width:36px;height:36px;color:var(--crit);background:var(--crit-soft);border-color:var(--crit-border)">'+U.ic('alert-triangle',18)+'</div>'
   +'<div><div class="serif" style="font-size:1.2rem;color:var(--text-strong)">This panel could not render</div><div class="xs faint">Your data is safe — nothing was written.</div></div></div>'
   +'<p class="small muted" style="line-height:1.6;margin-bottom:14px">A recoverable error was caught by the module boundary. Retry the panel, or continue to the Command Center. If it repeats, copy the diagnostics for the lab systems administrator.</p>'
   +'<div class="row wrap"><button class="btn primary" data-retry>'+U.ic('refresh-cw',15)+' Retry</button>'
   +'<button class="btn" data-home>'+U.ic('layout-dashboard',15)+' Command Center</button>'
   +'<button class="btn" data-diag>'+U.ic('copy',15)+' Copy diagnostics</button></div></div></div>';
  const q=s=>box.querySelector(s);
  if(q('[data-retry]')) q('[data-retry]').onclick=()=>SH.route();
  if(q('[data-home]')) q('[data-home]').onclick=()=>SH.go('dash');
  if(q('[data-diag]')) q('[data-diag]').onclick=async()=>{ const ok=await U.copy(diag); UI.toast(ok?'Diagnostics copied to clipboard':'Copy failed',{type:ok?'ok':'err'}); };
};

/* Every chart carries a PNG / SVG export. PNG renders at 3× for sharing on a
   phone screen; SVG stays vector for print. */
function wireChartExports(root){
  /* Every card owns the download control now (see wireCardExports), so a chart
     sitting inside a card does not also get its own pair of buttons. Charts that
     live outside a card — a bare plot dropped into a page — still get them here. */
  U.$$('.chart-wrap, [data-chart], .pbf-strip, .pbf-heat, .score-ring',root).forEach(w=>{
    if(w.closest('.card')) return;
    if(w.closest('.chart-export')) return;
    if(w.querySelector('.chart-export')) return;
    if(w.classList.contains('score-ring') && w.parentElement.querySelector('.chart-export')) return;
    if(!w.querySelector('svg') && !w.__chartCfg && !w.getAttribute('data-chart')) return;
    const bar=document.createElement('div');
    bar.className='chart-export';
    const name=(w.closest('.card')&&w.closest('.card').querySelector('.card-title')?w.closest('.card').querySelector('.card-title').textContent.trim():'')||w.getAttribute('data-chart')||'chart';
    bar.innerHTML='<button type="button" data-export-png title="Download PNG (HD · 3×)">PNG</button><button type="button" data-export-svg title="Download SVG (vector)">SVG</button>';
    w.appendChild(bar);
    bar.querySelector('[data-export-png]').onclick=async(e)=>{
      e.stopPropagation();
      const ok=await U.exportChartPNG(w,{name:name});
      UI.toast(ok?'Chart saved as PNG · 3× resolution':'PNG export is not available in this browser',{type:ok?'ok':'warn'});
    };
    bar.querySelector('[data-export-svg]').onclick=(e)=>{
      e.stopPropagation();
      const ok=U.exportChartSVG(w,{name:name});
      UI.toast(ok?'Chart saved as SVG · vector':'Nothing to export here',{type:ok?'ok':'warn'});
    };
  });
}
/* Every card carries one download control, whatever it holds: a chart becomes a
   PNG or a vector SVG, a table becomes CSV (and also PNG/SVG when a chart sits
   beside it). That is what makes "every chart has a download" true by
   construction rather than by remembering to wire each one. */
const CE_CHARTS='.chart-wrap, [data-chart], .pbf-strip, .pbf-heat, .score-ring, svg.chart-svg, .chart-svg, svg.spark';
function cardHost(card){
  const chart=card.querySelector(CE_CHARTS);
  if(chart) return chart;
  const table=card.querySelector('table');
  if(table) return table;                       /* a table exports as an image too */
  return card.querySelector('.card-body')||card;
}
function cardRows(card){
  const table=card.querySelector('table');
  if(!table) return null;
  const rows=[];
  U.$$('tr',table).forEach(tr=>{
    const cells=U.$$('th,td',tr).map(td=>td.textContent.replace(/\s+/g,' ').trim());
    if(cells.length) rows.push(cells);
  });
  return rows.length?rows:null;
}
function slug(t){ return String(t||'card').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'card'; }
function closeMenus(except){
  U.$$('.ce-menu.on').forEach(m=>{ if(m!==except) m.classList.remove('on'); });
}
function wireCardExports(root){
  const scope=root||document.getElementById('page')||document;
  U.$$('.card',scope).forEach(card=>{
    /* A card that repaints its own body keeps its identity, so the presence of the
       control is the test — not a flag, which would survive the repaint and leave
       the card without buttons. */
    if(card.querySelector('.ce')) return;
    const hasChart=!!card.querySelector(CE_CHARTS);
    const rows=cardRows(card);
    if(!hasChart && !rows) return;
    const title=card.querySelector('.card-title')?card.querySelector('.card-title').textContent.trim():'';
    let tools=card.querySelector('.card-head .card-tool') || card.querySelector('.toolbar');
    if(!tools){
      const head=card.querySelector('.card-head');
      if(head){ tools=document.createElement('div'); tools.className='card-tool'; head.appendChild(tools); }
    }
    const wrap=document.createElement('div'); wrap.className='ce';
    if(!tools) wrap.classList.add('ce-float');
    const compact=!title && !tools;
    if(compact) wrap.classList.add('ce-compact');
    wrap.innerHTML='<button type="button" class="ce-btn" title="Download this card" aria-label="Download this card">'
      +U.ic('download',12)+(compact?'':'<span>Export</span>'+U.ic('chevron-down',10))+'</button>'
      +'<div class="ce-menu" role="menu">'
      /* A chart exports as an image; a table exports as an image *and* as data. */
      +'<button type="button" data-ce="png">'+U.ic('image',12)+'PNG image<span class="k">3×</span></button>'
      +'<button type="button" data-ce="svg">'+U.ic('pen-tool',12)+'SVG vector</button>'
      +(rows?'<button type="button" data-ce="csv">'+U.ic('table',12)+'CSV table<span class="k">'+Math.max(0,rows.length-1)+' rows</span></button>':'')
      +'</div>';
    if(tools) tools.appendChild(wrap); else card.appendChild(wrap);
    const btn=wrap.querySelector('.ce-btn'), menu=wrap.querySelector('.ce-menu');
    btn.onclick=e=>{
      e.stopPropagation();
      const open=menu.classList.contains('on');
      closeMenus();
      if(!open) menu.classList.add('on');
    };
    const host=cardHost(card), name=title||'card';
    const png=menu.querySelector('[data-ce="png"]');
    if(png) png.onclick=async(e)=>{ e.stopPropagation(); menu.classList.remove('on');
      const ok=await U.exportChartPNG(host,{name:name,scale:3});
      UI.toast(ok?'Saved as PNG · 3× resolution':'This card could not be rendered as an image',{type:ok?'ok':'warn'});
    };
    const svg=menu.querySelector('[data-ce="svg"]');
    if(svg) svg.onclick=(e)=>{ e.stopPropagation(); menu.classList.remove('on');
      const ok=U.exportChartSVG(host,{name:name});
      UI.toast(ok?'Saved as SVG · vector':'This card could not be exported as a vector',{type:ok?'ok':'warn'});
    };
    const csv=menu.querySelector('[data-ce="csv"]');
    if(csv) csv.onclick=(e)=>{ e.stopPropagation(); menu.classList.remove('on');
      const data=cardRows(card);
      if(!data) return UI.toast('No table in this card',{type:'warn'});
      U.exportCSV(slug(name)+'-'+U.todayISO(),data,{title:name,actor:(LS.auth.user&&LS.auth.user.name)||''});
      UI.toast('Table saved as CSV',{type:'ok'});
    };
  });
}
if(typeof document!=='undefined'){
  document.addEventListener('click',()=>closeMenus(),true);
}
let chartObserver=null, chartRaf=0;
function watchCharts(root){
  if(chartObserver) chartObserver.disconnect();
  if(typeof MutationObserver!=='function'||!root) return;
  chartObserver=new MutationObserver(()=>{
    if(chartRaf) return;
    chartRaf=requestAnimationFrame(()=>{ chartRaf=0;
      const page=document.getElementById('page')||root;
      try{ wireChartExports(page); }catch(e){}
      try{ wireCardExports(page); }catch(e){}
    });
  });
  chartObserver.observe(root,{childList:true,subtree:true});
}
SH.watchCharts=watchCharts;
SH.wireChartExports=wireChartExports;
SH.wireCardExports=wireCardExports;

/* ——— Command palette ——————————————————— */
let paletteOpen=false, paletteIdx=0, paletteItems=[];
function commandItems(){
  const items=[];
  Object.keys(ROUTES).forEach(k=>{ const r=ROUTES[k]; if(r.permission&&!LS.auth.can(r.permission)) return;
    items.push({group:'Navigate',label:r.title,meta:r.group,icon:r.icon,run:()=>SH.go(k)}); });
  items.push({group:'Actions',label:'Register a new sample',meta:'N',icon:'flask-conical',run:()=>{ SH.go('samples'); setTimeout(()=>document.dispatchEvent(new CustomEvent('ls:new-sample')),400); }});
  items.push({group:'Actions',label:'Export dashboard briefing (CSV)',meta:'',icon:'download',run:()=>LS.modules.dash&&LS.modules.dash.exportBriefing?LS.modules.dash.exportBriefing():UI.toast('Open the Command Center first',{type:'warn'})});
  items.push({group:'Actions',label:'Backup register to JSON',meta:'',icon:'database',run:()=>{ U.download('lab-systems-backup-'+U.todayISO()+'.json',S.exportJSON(),'application/json'); UI.toast('Backup downloaded',{type:'ok'}); }});
  items.push({group:'Actions',label:(S.settings().theme==='ink'?'Switch to Porcelain (light)':'Switch to Ink (dark)'),meta:'T',icon:'sun',run:SH.toggleTheme});
  items.push({group:'Actions',label:'Toggle density (Comfortable / Compact)',meta:'[',icon:'rows-3',run:SH.toggleDensity});
  items.push({group:'Actions',label:'Notification center',meta:'',icon:'bell',run:()=>openNotifs()});
  items.push({group:'Actions',label:'Keyboard shortcuts',meta:'?',icon:'keyboard',run:()=>SH.shortcuts()});
  if(LS.auth.can('settings')){
    items.push({group:'Actions',label:'Sync the shared register now',meta:'',icon:'refresh-cw',run:async()=>{
      if(!LS.sync) return;
      const res=await LS.sync.sync();
      UI.toast(res.ok?'Sync complete · '+res.action:(res.reason||'Sync did not finish'),{type:res.ok?'ok':'warn',duration:6000});
    }});
    items.push({group:'Actions',label:'What changed in v'+APP_VERSION,meta:'',icon:'sparkles',run:()=>{ UI.closeAll(); SH.releaseNotes(); }});
    items.push({group:'Actions',label:'Install Lab Systems on this device',meta:'',icon:'download',run:()=>SH.install()});
  }
  items.push({group:'Actions',label:LS.auth.isVisitor()?'Leave visitor view':'Sign out',meta:'',icon:'log-out',run:()=>SH.logout()});
  // staff
  S.db().staff.filter(s=>s.status==='active').forEach(s=>items.push({group:'People',label:s.name,meta:s.role,icon:'user',run:()=>{ SH.go('roster'); setTimeout(()=>UI.drawer({title:s.name,eyebrow:'Staff record',body:LS.modules.roster&&LS.modules.roster.staffDrawer?LS.modules.roster.staffDrawer(s):'<p class="small muted">'+U.esc(s.role)+'</p>',foot:'<button class="btn" data-close>Close</button>'}),350); }}));
  // samples (recent)
  S.db().samples.slice(-20).reverse().forEach(s=>items.push({group:'Samples',label:s.sampleId+' · '+s.patientName,meta:s.test+' · '+s.priority,icon:'flask-conical',run:()=>{ SH.go('samples',{id:s.id}); }}));
  // stock
  S.consumables().forEach(c=>items.push({group:'Inventory',label:c.name,meta:'on hand '+S.onHand(c.id)+' '+c.unit,icon:'package',run:()=>SH.go('stock',{item:c.id})}));
  return items;
}
function openPalette(){
  if(paletteOpen) return;
  paletteOpen=true;
  const all=commandItems();
  const wrap=U.el('<div class="palette-scrim"><div class="palette"><div class="palette-input">'+U.ic('search',18)+'<input id="palInput" placeholder="'+LS.i18n.t('ui.search')+'" autocomplete="off" spellcheck="false"><span class="kbd">ESC</span></div><div class="palette-list" id="palList"></div><div class="palette-foot"><span class="k"><span class="kbd">↑</span><span class="kbd">↓</span> navigate</span><span class="k"><span class="kbd">↵</span> open</span><span class="k"><span class="kbd">⌘K</span> close</span><span style="margin-left:auto">'+all.length+' commands · offline ready</span></div></div></div>');
  document.body.appendChild(wrap);
  const input=wrap.querySelector('#palInput'), list=wrap.querySelector('#palList');
  const close=()=>{ paletteOpen=false; wrap.remove(); };
  const render=(q)=>{
    q=(q||'').toLowerCase().trim();
    const filtered=all.filter(i=>!q|| (i.label+' '+i.group+' '+(i.meta||'')).toLowerCase().indexOf(q)>=0).slice(0,40);
    paletteItems=filtered; paletteIdx=0;
    const groups=U.groupBy(filtered,i=>i.group);
    if(!filtered.length){ list.innerHTML='<div class="empty" style="padding:26px">'+UI.illus('search')+'<p class="xs muted">No command or record matches “'+U.esc(q)+'”</p></div>'; return; }
    list.innerHTML=Object.keys(groups).map(g=>'<div class="palette-group">'+U.esc(g)+'</div>'+groups[g].map(i=>{
      const idx=filtered.indexOf(i);
      return '<button class="palette-item" data-pi="'+idx+'">'+U.ic(i.icon||'chevron-right',15,'pic')+'<span>'+U.esc(i.label)+'</span>'+(i.meta?'<span class="meta">'+U.esc(i.meta)+'</span>':'')+'</button>';
    }).join('')).join('');
    mark();
  };
  const mark=()=>{ U.$$('.palette-item',list).forEach(b=>b.classList.toggle('on',+b.dataset.pi===paletteIdx)); };
  const run=(i)=>{ const it=paletteItems[i]; if(!it) return; close(); setTimeout(()=>it.run(),20); };
  input.addEventListener('input',()=>render(input.value));
  input.addEventListener('keydown',e=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); paletteIdx=Math.min(paletteItems.length-1,paletteIdx+1); mark(); U.$('.palette-item.on',list)?.scrollIntoView({block:'nearest'}); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); paletteIdx=Math.max(0,paletteIdx-1); mark(); U.$('.palette-item.on',list)?.scrollIntoView({block:'nearest'}); }
    else if(e.key==='Enter'){ e.preventDefault(); run(paletteIdx); }
    else if(e.key==='Escape'){ close(); }
  });
  list.addEventListener('click',e=>{ const b=e.target.closest('[data-pi]'); if(b) run(+b.dataset.pi); });
  wrap.addEventListener('mousedown',e=>{ if(e.target===wrap) close(); });
  render('');
  setTimeout(()=>input.focus(),40);
  SH._closePalette=close;
}
function shortcutMeta(){
  return [['⌘K / Ctrl K','Open command palette'],['/','Focus search in current module'],['N','Register new sample'],['G then D','Go to Command Center'],['G then S','Go to Referred Samples'],['G then R','Go to Working Plan'],['G then Q','Go to EQA'],['T','Toggle Ink / Porcelain theme'],['[','Toggle density'],['?','This shortcuts sheet'],['Esc','Close drawer / palette']];
}
SH.releaseNotes=function(){
  const rows=[
    ['6.1','Register depth','12-month throughput, weekly service roster, editable sample/equipment records, past maintenance, EQA round entry, question-level PBF visits and custom training expenses.','current'],
    ['6.0','Flagship console','New shell, 15 modules, Ink/Porcelain themes, command palette, Kigali clock, security center, design system and this roadmap.','prev'],
    ['5.3','Register depth','Referred-sample manifest printing, stock lot drill-down, leave Gantt, PBF draft scores.','prev'],
    ['5.0','Quality layer','ISO 15189 checklist, SOP register, incident log, EQA z-scores with traffic lights.','prev'],
    ['4.0','Foundation','Offline-first register, staff roster generator, revenue tracker, PWA install.','prev']
  ];
  UI.modal({title:'What changed',sub:'Lab Systems release notes · Ruli District Hospital laboratory',width:'min(620px,100%)',
    body:'<div class="custody">'+rows.map(([v,t,d,s])=>
      '<div class="custody-item'+(s==='current'?'':' pending')+'"><span class="custody-dot"></span><div class="custody-body">'
      +'<div class="custody-title"><span class="mono" style="color:var(--gold-bright)">v'+v+'</span> · '+U.esc(t)+'</div>'
      +'<div class="custody-meta">'+U.esc(d)+'</div></div></div>').join('')+'</div>'
      +'<div class="hint" style="margin-top:12px">Every release keeps the same local register — no migration step is ever required by the user.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-release-roadmap>'+UI.ic('rocket',15)+' Open roadmap</button>',
    onMount:(el,close)=>{ const b=el.querySelector('[data-release-roadmap]'); if(b) b.onclick=()=>{ close(); setTimeout(()=>SH.go('roadmap'),180); }; }});
};
SH.shortcuts=function(){
  UI.modal({title:'Keyboard shortcuts',sub:'Built for the bench — one hand, no mouse.',width:'min(560px,100%)',
    body:'<div class="stack">'+shortcutMeta().map(([k,v])=>'<div class="row between" style="padding:7px 0;border-bottom:1px solid var(--border)"><span class="small">'+U.esc(v)+'</span><span class="row gap-sm">'+k.split(' then ').map(x=>'<span class="kbd" style="height:20px;min-width:22px">'+U.esc(x)+'</span>').join('<span class="faint xs">then</span>')+'</span></div>').join('')+'</div>',
    foot:'<button class="btn primary" data-close>Got it</button>'});
};

/* ——— Notifications ——————————————————— */
function openNotifs(){
  const items=S.notifications();
  const body='<div class="row between" style="margin-bottom:10px"><span class="xs faint">'+items.length+' live signals · grouped &amp; actionable</span><button class="btn xs" data-readall>Mark all read</button></div>'
   + (items.length?'<div>'+items.map(n=>'<div class="notif '+(n.read?'read':'')+'">'+(n.read?'<div class="nun"></div>':'<div class="nun"></div>')
      +'<div class="nb"><div class="nt">'+U.esc(n.title)+'</div><div class="nm2">'+U.esc(n.detail)+' · '+U.relTime(n.ts)+'</div>'
      +'<div style="margin-top:5px"><button class="btn xs" data-nhref="'+U.esc(n.href)+'" data-nid="'+U.esc(n.id)+'">Open '+U.ic('arrow-right',12)+'</button></div></div></div>').join('')+'</div>'
     :UI.empty({art:'award',title:'Inbox zero',body:'No outstanding operational signals. New alerts arrive here first.'}));
  const d=UI.drawer({title:'Notification center',eyebrow:'Signal desk',wide:false,body:body,foot:'<button class="btn" data-close>Close</button>'});
  d.panel.querySelector('[data-readall]')?.addEventListener('click',()=>{ S.markNotifsRead(S.notifications().map(n=>n.id)); U.$$('.notif',d.panel).forEach(x=>x.classList.add('read')); UI.toast('All notifications marked read',{type:'ok'}); });
  d.panel.addEventListener('click',e=>{ const b=e.target.closest('[data-nhref]'); if(!b) return; S.markNotifsRead([b.dataset.nid]); location.hash=b.dataset.nhref; UI.closeAll(); });
}

/* ——— User menu ——————————————— */
function openUserMenu(){
  const u=LS.auth.user;
  const adminLinks=[['security','Security Center','Sessions, 2FA & audit','security'],
                    ['staff','Staff & Settings','Branding, data & backups','staff'],
                    ['design','Design System','Tokens & motion spec','settings'],
                    ['roadmap','Premium Roadmap','The 100 upgrades','settings']]
    .filter(([r,t,sb,p])=>LS.auth.can(p));
  const body='<div class="row" style="gap:12px;padding-bottom:14px;border-bottom:1px solid var(--border)">'+U.avatar(u.name,'lg')
    +'<div class="grow"><div class="strong" style="font-size:14px">'+U.esc(u.name)+'</div><div class="xs faint">'+U.esc(u.title)+'</div><div style="margin-top:4px">'+UI.roleBadge(u.role)+'</div></div></div>'
    +'<div class="stack" style="margin-top:10px">'
    +adminLinks.map(([r,t,s])=>'<button class="choice" data-go="'+r+'" style="justify-content:space-between"><span><span class="ct">'+t+'</span><span class="cs" style="display:block">'+s+'</span></span>'+U.ic('chevron-right',14)+'</button>').join('')
    +'</div>'
    +'<div class="row between" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)"><span class="xs faint">Appearance</span>'
    +'<div class="seg"><button data-theme-toggle class="on" style="display:flex;align-items:center;gap:5px"><span data-theme-icon>'+U.ic(S.settings().theme==='ink'?'moon':'sun',13)+'</span><span data-theme-label>'+(S.settings().theme==='ink'?'Ink':'Porcelain')+'</span></button></div></div>'
    +'<div class="row between" style="margin-top:8px"><span class="xs faint">Density</span><button class="btn xs" data-density-toggle><span data-density-label>'+((S.settings().density==='compact')?'Compact':'Comfortable')+'</span></button></div>'
    +'<div class="row between" style="margin-top:8px"><span class="xs faint">Language</span><select class="select" id="langSel" style="width:auto;height:30px;font-size:11.5px">'+LS.i18n.languages.map(l=>'<option value="'+l.code+'" '+(LS.i18n.lang===l.code?'selected':'')+'>'+l.native+'</option>').join('')+'</select></div>'
    +'<div class="row between" style="margin-top:8px"><span class="xs faint">Install app</span><button class="btn xs" data-install>'+U.ic('smartphone',13)+' Install</button></div>'
    +'<div class="row between" style="margin-top:8px"><span class="xs faint">Console build</span><span class="mono xs">v'+APP_VERSION+'</span></div>'
    +'<button class="btn xs wide" style="margin-top:10px" data-overview>'+U.ic('globe',13)+' Public overview page</button>'
    +'<button class="btn xs wide" style="margin-top:10px" data-force-refresh>'+UI.ic('refresh-cw',13)+' Force update — clear cache & reload</button>'
    +'<div class="hint" style="margin-top:6px">Use this if a fix does not appear: it clears the offline cache for the app shell, keeps every record on this device, and reloads the newest build.</div>';
  const d=UI.drawer({title:'Account',eyebrow:'Signed in',body:body,foot:'<button class="btn danger" data-logout>'+U.ic('log-out',15)+(LS.auth.isVisitor()?' Leave visitor view':' Sign out')+'</button><button class="btn" data-close>Close</button>'});
  d.panel.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ UI.closeAll(); SH.go(b.dataset.go); });
  d.panel.querySelector('[data-theme-toggle]').onclick=e=>{ SH.toggleTheme(); const b=e.currentTarget; b.querySelector('[data-theme-icon]').innerHTML=U.ic(S.settings().theme==='ink'?'moon':'sun',13); b.querySelector('[data-theme-label]').textContent=S.settings().theme==='ink'?'Ink':'Porcelain'; };
  d.panel.querySelector('[data-density-toggle]').onclick=e=>{ SH.toggleDensity(); e.currentTarget.querySelector('[data-density-label]').textContent=S.settings().density==='compact'?'Compact':'Comfortable'; };
  d.panel.querySelector('#langSel').onchange=e=>{ LS.i18n.set(e.target.value); U.$$('#navItems .nav-item').forEach(b=>{ const k=b.dataset.tab; const lbl=b.querySelector('.lbl'); if(lbl) lbl.textContent=LS.i18n.t('nav.'+k,ROUTES[k].title); }); U.$$('.nav-group-label').forEach(el=>{ const g=el.dataset.i18n; if(g) el.textContent=LS.i18n.t(g); }); UI.toast('Language set to '+e.target.selectedOptions[0].text,{type:'ok'}); };
  const ov=d.panel.querySelector('[data-overview]');
  if(ov) ov.onclick=()=>{ UI.closeAll(); if(LS.landing) LS.landing.show(); };
  d.panel.querySelector('[data-install]').onclick=()=>SH.install();
  const fr=d.panel.querySelector('[data-force-refresh]');
  if(fr) fr.onclick=()=>SH.forceRefresh();
  d.panel.querySelector('[data-logout]').onclick=()=>{ UI.closeAll(); SH.logout(); };
}
/* Hard refresh: drop the app-shell cache, keep the register, reload from network. */
SH.forceRefresh=async function(){
  UI.toast('Clearing the offline cache…',{type:'info',duration:1600});
  try{
    if(window.caches){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); }
    if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister()));
    }
  }catch(e){}
  /* Reload with a cache-busting query: GitHub Pages keeps index.html in the HTTP
     cache for ten minutes, which is exactly what made a new build look missing. */
  setTimeout(()=>{
    try{ const u=new URL(location.href); u.searchParams.set('v',String(Date.now())); location.replace(u.toString()); }
    catch(e){ location.reload(); }
  },700);
};
SH.logout=async function(){
  if(LS.auth.isVisitor&&LS.auth.isVisitor()){
    LS.auth.logout();
    document.getElementById('app').hidden=true;
    if(LS.landing) LS.landing.show();
    return;
  }
  const ok=await UI.confirm({title:'Sign out of Lab Systems?',body:'Your local register stays on this device. Unsaved screen state is cleared.',confirm:'Sign out',danger:true});
  if(!ok) return;
  LS.auth.logout();
  document.getElementById('app').hidden=true;
  /* Signed out, the device returns to the public overview — not to a login wall.
     The sign-in screen opens from the crest (5 taps) or the profile (3 taps). */
  if(LS.landing) LS.landing.show();
  else { document.getElementById('auth').hidden=false; LS.auth.mount(afterAuth); }
};

/* ——— Status bar ————————————————————— */
function updateNet(){
  const online=navigator.onLine;
  /* When a shared register is configured the pill reports sync, not just the cable. */
  const live=(window.LS&&LS.sync&&LS.sync.configured&&LS.sync.configured())?LS.sync.liveLabel():null;
  U.$$('[data-net]').forEach(e=>{
    e.innerHTML = !online ? U.ic('wifi-off',12)+' <b style="color:var(--warn)">Offline — queued</b>'
      : live ? U.ic('wifi',12)+' <b>'+U.esc(live.text)+'</b>'
      : U.ic('wifi',12)+' <b>Synced</b>';
  });
  const dot=document.getElementById('sysDot'); if(dot) dot.style.color=online?'var(--pos)':'var(--warn)';
  const txt=document.getElementById('sysText'); if(txt) txt.textContent=online?'All systems operational':'Offline · local-first';
  U.$$('[data-offline-banner]').forEach(e=>e.hidden=online);
}
if(window.LS&&LS.sync&&LS.sync.onChange) LS.sync.onChange(()=>{ try{ updateNet(); }catch(e){} });
window.addEventListener('online',()=>{ updateNet(); UI.toast('Connection restored — syncing local changes',{type:'ok'}); });
window.addEventListener('offline',()=>{ updateNet(); UI.toast('Offline. Every action still saves locally and queues for sync.',{type:'warn',duration:6000}); });

/* ——— Global wiring ——————————————————— */
window.addEventListener('hashchange',()=>{ SH.route(); });
function wireGlobal(){
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-tab]');
    if(nav){ const id=nav.dataset.tab; if(ROUTES[id]) SH.go(id); if(nav.classList.contains('bnav-item')) document.querySelector('.app')?.classList.remove('rail-open'); return; }
    const go=e.target.closest('[data-go]'); if(go){ SH.go(go.dataset.go); return; }
    if(e.target.closest('[data-more]')){ openMoreSheet(); return; }
    if(e.target.closest('#hamburger')){ document.querySelector('.rail')?.scrollTop; document.querySelector('.app')?.classList.toggle('rail-open'); return; }
    if(e.target.closest('[data-rail-close]')){ document.querySelector('.app')?.classList.remove('rail-open'); return; }
    if(e.target.closest('#railToggle')){
      const app=document.querySelector('.app'); if(!app) return;
      const mini=app.classList.toggle('rail-mini');
      try{ localStorage.setItem('labSystems.navMini.v1',mini?'1':'0'); }catch(_){}
      const tg=document.getElementById('railToggle');
      if(tg){ tg.title=mini?'Expand navigation':'Collapse navigation'; tg.setAttribute('aria-label',tg.title); tg.classList.toggle('is-mini',mini); }
      hideRailTip();
      return;
    }
    if(e.target.closest('#cmdkTrigger')){ openPalette(); return; }
    if(e.target.closest('#notifBtn')){ openNotifs(); return; }
    if(e.target.closest('#userBtn')||e.target.closest('#railUser')){ openUserMenu(); return; }
    if(e.target.closest('#themeBtn')){ SH.toggleTheme(); return; }
    if(e.target.closest('#shortcutsBtn')){ SH.shortcuts(); return; }
    if(e.target.closest('[data-keyboard-help]')){ SH.shortcuts(); return; }
    if(e.target.closest('#installBtn')){ SH.install(); return; }
    if(e.target.closest('[data-whatsnew]')||e.target.closest('#whatsNew')){ UI.closeAll(); SH.releaseNotes(); return; }
    if(e.target.closest('#helpBtn')){ SH.shortcuts(); return; }
  });
  // rail collapse restore
  try{ if(localStorage.getItem('labSystems.navMini.v1')==='1'){
    document.querySelector('.app')?.classList.add('rail-mini');
    const tg=document.getElementById('railToggle');
    if(tg){ tg.title='Expand navigation'; tg.setAttribute('aria-label',tg.title); tg.classList.add('is-mini'); }
  } }catch(e){}
  // module labels while minimised
  document.addEventListener('mouseover',e=>{
    const item=e.target.closest('.nav-item');
    if(item && document.querySelector('.app.rail-mini')) showRailTip(item); else hideRailTip();
  });
  document.addEventListener('mouseout',e=>{ if(e.target.closest('.nav-item')) hideRailTip(); });
  document.addEventListener('focusin',e=>{ const item=e.target.closest('.nav-item'); if(item) showRailTip(item); else hideRailTip(); });
  document.addEventListener('focusout',e=>{ if(e.target.closest('.nav-item')) hideRailTip(); });
  document.addEventListener('click',e=>{ if(e.target.closest('.nav-item')) hideRailTip(); });
  window.addEventListener('scroll',hideRailTip,{passive:true});

  /* Immersive reading: the header steps out of the way on the way down and comes
     straight back on the way up, so the page owns the screen but navigation is
     never more than a small upward flick away. It also returns at the top. */
  let lastY=window.scrollY||0, ticking=false;
  const onScroll=()=>{
    if(ticking) return; ticking=true;
    requestAnimationFrame(()=>{
      const y=window.scrollY||0, bar=document.getElementById('topbar');
      if(bar){
        const down=y>lastY+4, up=y<lastY-4;
        if(down && y>76 && !document.body.classList.contains('palette-open')) bar.classList.add('is-hidden');
        else if(up || y<=76) bar.classList.remove('is-hidden');
      }
      lastY=y; ticking=false;
    });
  };
  window.addEventListener('scroll',onScroll,{passive:true});
  // keyboard
  let gPending=0;
  document.addEventListener('keydown',e=>{
    const tag=(e.target.tagName||'').toLowerCase();
    const typing=/input|textarea|select/.test(tag)||e.target.isContentEditable;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); paletteOpen?SH._closePalette&&SH._closePalette():openPalette(); return; }
    if(typing||e.metaKey||e.ctrlKey||e.altKey) return;
    if(e.key==='/'){ e.preventDefault(); const s=document.querySelector('.toolbar .searchbox input, #page .searchbox input'); if(s) s.focus(); else openPalette(); return; }
    if(e.key==='?'){ e.preventDefault(); SH.shortcuts(); return; }
    if(e.key==='t'||e.key==='T'){ SH.toggleTheme(); return; }
    if(e.key==='['){ SH.toggleDensity(); return; }
    if(e.key==='n'||e.key==='N'){ e.preventDefault(); if(SH.current()!=='samples'){ SH.go('samples'); setTimeout(()=>document.dispatchEvent(new CustomEvent('ls:new-sample')),600); } else document.dispatchEvent(new CustomEvent('ls:new-sample')); return; }
    if(e.key==='g'||e.key==='G'){ gPending=Date.now(); return; }
    if(gPending && Date.now()-gPending<1200){
      const map={d:'dash',s:'samples',r:'roster',q:'eqa',l:'leave',t:'stock',e:'equipment',p:'pbf',u:'staff'};
      const to=map[e.key.toLowerCase()];
      if(to){ e.preventDefault(); gPending=0; SH.go(to); }
    }
  });
  // data change refresh badge
  window.addEventListener('ls:saved',()=>{ const el=document.getElementById('saveState'); if(el){ el.textContent='Saved '+U.fmtTime(); } updateBadges(); });
  document.addEventListener('ls:changed',(e)=>{ updateBadges(); if(e.detail!=='session') SH.refresh(); });
  // pull-to-refresh (mobile)
  let startY=null, pulling=false;
  document.addEventListener('touchstart',e=>{ if(window.scrollY<=0) startY=e.touches[0].clientY; },{passive:true});
  document.addEventListener('touchmove',e=>{ if(startY==null) return; const dy=e.touches[0].clientY-startY;
    if(dy>70&&!pulling){ pulling=true; const p=document.getElementById('ptr'); if(p) p.classList.add('on'); } },{passive:true});
  document.addEventListener('touchend',()=>{ if(pulling){ const p=document.getElementById('ptr'); setTimeout(()=>p&&p.classList.remove('on'),500); setTimeout(()=>SH.refresh(),600); } startY=null; pulling=false; });
  // install prompt
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); SH._installEvent=e; });
}
SH.install=async function(){
  if(SH._installEvent){ SH._installEvent.prompt(); const r=await SH._installEvent.userChoice; if(r.outcome==='accepted'){ UI.toast('Lab Systems installed — works offline from your home screen',{type:'ok'}); } SH._installEvent=null; }
  else if(window.matchMedia('(display-mode: standalone)').matches){ UI.toast('Already running as an installed app',{type:'info'}); }
  else { UI.modal({title:'Install Lab Systems',sub:'On Android Chrome or Edge, use the browser menu → “Add to Home screen”. On iPhone Safari, tap Share → “Add to Home Screen”. Once installed the console launches full-screen and works offline.',body:'<div class="card pad" style="background:var(--surface-inset)"><div class="row gap-sm">'+U.ic('smartphone',16)+'<span class="small">Offline-first PWA · local register · optional cloud sync</span></div></div>',foot:'<button class="btn primary" data-close>Got it</button>'}); }
};
function openMoreSheet(){
  const items=Object.keys(ROUTES).filter(k=>['dash','samples','roster','eqa'].indexOf(k)<0&&(!ROUTES[k].permission||LS.auth.can(ROUTES[k].permission)));
  UI.drawer({title:'All modules',eyebrow:'Navigate',body:'<div class="stack">'+items.map(k=>'<button class="choice" data-tab="'+k+'">'+U.ic(ROUTES[k].icon,16)+'<span><span class="ct">'+ROUTES[k].title+'</span><span class="cs" style="display:block">'+ROUTES[k].sub+'</span></span></button>').join('')
    +'<div class="thread" style="margin:6px 0"></div>'
    +'<button class="choice" data-keyboard-help>'+U.ic('keyboard',16)+'<span><span class="ct">Keyboard shortcuts</span></span></button>'
    +'<button class="choice" data-install>'+U.ic('smartphone',16)+'<span><span class="ct">Install app</span></span></button></div>',
    foot:'<button class="btn" data-close>Close</button>'});
}

/* ——— Boot into shell ————————————————— */
function afterAuth(){
  document.getElementById('auth').hidden=true;
  document.getElementById('app').hidden=false;
  LS.auth.renderUserChip();
  SH.build();
  SH.route();
}
SH.afterAuth=afterAuth;
SH.openPalette=openPalette;
SH.updateNet=updateNet;
SH.updateBadges=updateBadges;
})();
