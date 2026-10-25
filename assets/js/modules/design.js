/* ============================================================================
   MODULE · DESIGN SYSTEM — the living specimen sheet
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.design=M;
let rootEl=null;

const PALETTE=[
  ['Ink',[['950','#05070D'],['900','#070A12'],['800','#0B101C'],['700','#121A2B'],['600','#1B2438'],['500','#2A3448']]],
  ['Gold',[['600','#B18F38'],['500','#C9A84C'],['400','#D4B76A'],['300','#E9D9A7'],['200','#F4EAD0'],['100','#FAF5E7']]],
  ['Teal',[['700','#1F8F7C'],['500','#129A80'],['400','#3FD3B6'],['300','#8FE6D6']]],
  ['Amber',[['600','#B4721B'],['500','#E7AE4B'],['400','#F2C776']]],
  ['Rose',[['600','#A93A47'],['500','#E3727C'],['400','#F09EA4']]],
  ['Blue',[['600','#3F5F96'],['500','#7595C8'],['400','#A9C0E4']]]
];
function swatch(name,tone,hex){
  return '<button class="sw-cell" data-hex="'+hex+'" data-tip="Copy '+hex+'"><span class="sw-chip" style="background:'+hex+'"></span><span class="sw-name">'+name+' '+tone+'</span><span class="sw-hex mono">'+hex+'</span></button>';
}
function brand(){
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'Crest',sub:'Hex-molecule mark · gold gradient stroke on ink',icon:'sparkles',body:
    '<div class="ds-crest-row">'
    +'<div class="ds-crest ink"><svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="dsg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8C6E29"/><stop offset="45%" stop-color="#E9D9A7"/><stop offset="100%" stop-color="#C9A84C"/></linearGradient></defs>'
    +'<path d="M24 3.4 41.2 13v21.8L24 44.6 6.8 34.8V13z" stroke="url(#dsg1)" stroke-width="1.3"/><path d="M24 9.4 35.7 16v14.9L24 37.6 12.3 30.9V16z" stroke="url(#dsg1)" stroke-width=".8" stroke-opacity=".5"/>'
    +'<path d="M24 16.4v7.2M24 23.6l-6.4 3.9M24 23.6l6.4 3.9" stroke="url(#dsg1)" stroke-width="1.1" stroke-linecap="round"/><circle cx="24" cy="15.6" r="2.4" stroke="url(#dsg1)" stroke-width="1.1"/><circle cx="16.6" cy="28.4" r="2.1" stroke="url(#dsg1)" stroke-width="1.1"/><circle cx="31.4" cy="28.4" r="2.1" stroke="url(#dsg1)" stroke-width="1.1"/><circle cx="24" cy="23.6" r="1.5" fill="url(#dsg1)"/></svg></div>'
    +'<div class="ds-crest light"><svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="dsg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8C6E29"/><stop offset="45%" stop-color="#B18F38"/><stop offset="100%" stop-color="#C9A84C"/></linearGradient></defs>'
    +'<path d="M24 3.4 41.2 13v21.8L24 44.6 6.8 34.8V13z" stroke="url(#dsg2)" stroke-width="1.3"/><path d="M24 16.4v7.2M24 23.6l-6.4 3.9M24 23.6l6.4 3.9" stroke="url(#dsg2)" stroke-width="1.1"/><circle cx="24" cy="15.6" r="2.4" stroke="url(#dsg2)" stroke-width="1.1"/><circle cx="16.6" cy="28.4" r="2.1" stroke="url(#dsg2)" stroke-width="1.1"/><circle cx="31.4" cy="28.4" r="2.1" stroke="url(#dsg2)" stroke-width="1.1"/></svg></div>'
    +'<div class="ds-rule"><span>Gold thread — 2px hairline, 12% → 42% → 4% opacity</span><div class="thread" style="margin-top:8px"></div></div></div>'
    +'<div class="split-3" style="margin-top:14px">'+[['Wordmark','Fraunces 500 · -0.03em tracking'],['Tagline','Inter 12.5px · muted'],['Monospace','IBM Plex Mono · identifiers, KPI deltas']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11px">'+v+'</span></div>').join('')+'</div>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Elevation',sub:'Four tiers, ink-tinted, never pure black',icon:'layers',body:
     '<div class="ds-elev">'+[1,2,3,4].map(n=>'<div class="ds-elev-tile" style="box-shadow:var(--shadow-'+n+')"><span class="mono xs">--shadow-'+n+'</span></div>').join('')+'</div>'
     +'<div class="hint" style="margin-top:10px">1 resting card · 2 hover/raised · 3 drawer · 4 command palette &amp; modal.</div>'})+'</div></div>';
}
function colour(){
  return UI.card({title:'Colour',sub:'50–950 ramps · semantic roles · Ink and Porcelain themes',icon:'palette',body:
    '<div class="ds-ramps">'+PALETTE.map(([name,tones])=>'<div class="ds-ramp"><div class="eyebrow">'+name+'</div><div class="ds-ramp-row">'+tones.map(([t,h])=>swatch(name,t,h)).join('')+'</div></div>').join('')+'</div>'
    +'<div class="thread" style="margin:16px 0"></div>'
    +'<div class="row wrap gap-sm">'+[['--bg','Canvas','var(--bg)'],['--surface','Card','var(--surface)'],['--surface-inset','Inset','var(--surface-inset)'],['--text','Body','var(--text)'],['--text-muted','Muted','var(--text-muted)'],['--pos','Positive','var(--pos)'],['--warn','Warning','var(--warn)'],['--crit','Critical','var(--crit)'],['--info','Info','var(--info)']].map(([v,l,c])=>'<div class="ds-sem"><span class="sw-chip" style="background:'+c+'"></span><div><div class="small">'+l+'</div><div class="mono xs faint">'+v+'</div></div></div>').join('')+'</div>'
    +'<div class="hint" style="margin-top:14px">Copy any swatch by clicking it. Contrast is checked against WCAG AA for body text in both themes; gold is reserved for accents, never small body copy on canvas.</div>'});
}
function type(){
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Typography',sub:'Fraunces display · Inter interface · IBM Plex Mono data',icon:'type',body:
    '<div class="ds-type">'
    +'<div class="ds-spec"><span class="mono xs faint">display / Fraunces 300 · clamp(2.1rem,4vw,3rem)</span><div style="font-family:var(--font-display);font-weight:300;font-size:2.6rem;letter-spacing:-.035em;line-height:1.03">Laboratory, elevated.</div></div>'
    +'<div class="ds-spec"><span class="mono xs faint">h1 / Fraunces 400 · 1.55rem</span><div style="font-family:var(--font-display);font-size:1.55rem;letter-spacing:-.028em">Command Center</div></div>'
    +'<div class="ds-spec"><span class="mono xs faint">h2 / Inter 600 · 0.95rem</span><div style="font-weight:600;font-size:.95rem">Referred samples this week</div></div>'
    +'<div class="ds-spec"><span class="mono xs faint">body / Inter 400 · 0.82rem · 1.62</span><div style="font-size:.82rem;line-height:1.62;color:var(--text-muted);max-width:56ch">Chain of custody is recorded at every hand-off — reception, dispatch, receiving laboratory, and result verification — so a result can always be traced back to the person who released it.</div></div>'
    +'<div class="ds-spec"><span class="mono xs faint">data / IBM Plex Mono 500 · 0.72rem</span><div class="mono" style="font-size:.72rem;letter-spacing:.02em">RDH-2027-012345 · 98.4% · 11:42:07</div></div>'
    +'</div>'})+'</div>'
    +'<div class="c4">'+UI.card({title:'Scale',sub:'Fluid, calibrated for mobile first',icon:'ruler',body:
      [['Display','clamp(2.1rem,4vw,3rem)','-0.035em'],['H1','1.55rem','-0.028em'],['H2','1.02rem','-0.02em'],['Card title','0.86rem','-0.01em'],['Body','0.82rem','0'],['Small','0.74rem','0.005em'],['Micro','0.64rem','0.06em']].map(([k,v,t])=>'<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="small">'+k+'</span><span class="mono xs faint">'+v+'</span></div>').join('')
      +'<div class="hint" style="margin-top:10px">Fraunces carries sentiment, Inter carries information, Plex Mono carries evidence.</div>'})+'</div></div>';
}
function space(){
  return '<div class="grid-12"><div class="c6">'+UI.card({title:'Spacing &amp; radius',sub:'4px base grid',icon:'grid',body:
    '<div class="ds-space">'+[4,8,12,16,20,24,32,40,48,64].map(v=>'<div class="ds-space-row"><span class="mono xs">'+v+'</span><span class="ds-space-bar" style="width:'+v*2+'px"></span></div>').join('')+'</div>'
    +'<div class="row gap-sm wrap" style="margin-top:14px">'+[['6px','tags'],['10px','inputs'],['14px','cards'],['20px','drawers'],['999px','pills']].map(([r,l])=>'<div class="ds-radius" style="border-radius:'+r+'"><span class="mono xs">'+r+'</span><span class="xs faint">'+l+'</span></div>').join('')+'</div>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Motion',sub:'Spring 260/26 · page 240ms / 8px · stagger 40ms',icon:'activity',body:
    '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Token</th><th>Value</th><th>Use</th></tr></thead><tbody>'
    +[['--dur-1','120ms','hover, focus'],['--dur-2','200ms','pill morph, toggle'],['--dur-3','240ms','page transition, drawers'],['--dur-4','420ms','chart draw, boot'],['--ease','cubic-bezier(.2,.8,.2,1)','default easing'],['--spring','cubic-bezier(.16,1,.3,1)','entrances'],['--spring-soft','cubic-bezier(.34,1.3,.64,1)','tactile press']].map(([a,b,c])=>'<tr><td class="mono xs">'+a+'</td><td class="mono xs">'+b+'</td><td class="small">'+c+'</td></tr>').join('')
    +'</tbody></table></div><div class="hint" style="margin-top:10px">Reduced-motion preference collapses every transform to a 1ms opacity fade.</div>'})+'</div></div>';
}
function components(){
  return UI.card({title:'Components',sub:'Every primitive in the system, in situ',icon:'layout-grid',body:
    '<div class="ds-demo"><div class="eyebrow">Buttons</div><div class="row wrap gap-sm">'
      +'<button class="btn primary">'+UI.ic('plus',14)+'Primary</button><button class="btn">Secondary</button><button class="btn ghost">Ghost</button><button class="btn danger">Danger</button><button class="btn sm">Small</button><button class="icon-btn">'+UI.ic('settings',15)+'</button>'
    +'</div></div>'
    +'<div class="ds-demo"><div class="eyebrow">Status</div><div class="row wrap gap-sm">'
      +UI.pill('On track','teal')+UI.pill('Pending','amber')+UI.pill('Overdue','rose')+UI.pill('Draft','slate')+UI.pill('ISO 15189','gold')+'<span class="chip gold">'+UI.ic('shield-check',12)+'Accreditation ready</span><span class="dot live"></span><span class="kbd">⌘</span><span class="kbd">K</span>'
    +'</div></div>'
    +'<div class="ds-demo"><div class="eyebrow">Inputs</div><div class="form-grid">'
      +'<div class="field"><label>Search</label><div class="searchbox">'+UI.ic('search',15)+'<input class="input" placeholder="RDH-2026-…"></div></div>'
      +'<div class="field"><label>Select</label><select class="select"><option>Routine</option><option>STAT</option></select></div>'
      +'<div class="field"><label>Switch</label><label class="switch"><input type="checkbox" checked><i></i></label></div>'
    +'</div></div>'
    +'<div class="ds-demo"><div class="eyebrow">Metrics</div><div class="split-3">'
      +UI.stat({label:'TAT compliance',value:94.2,dec:1,unit:'%',formatted:'0.0',delta:2.1,note:'30-day rolling',spark:C.spark([88,90,91,93,92,94],{color:'var(--pos)'})})
      +UI.stat({label:'Open samples',value:128,formatted:'0',icon:'flask-conical',delta:-4,note:'14 STAT',spark:C.spark([160,150,142,138,131,128],{color:'var(--gold)'})})
      +'<div class="card pad"><div class="eyebrow">Gauge</div><div class="row gap-sm" style="margin-top:8px">'+C.ring(82,{size:64,stroke:5})+'<div class="xs muted">ISO readiness<br>18 of 22 controls</div></div></div>'
    +'</div></div>'
    +'<div class="ds-demo"><div class="eyebrow">Table anatomy</div>'
      +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Sample</th><th>Facility</th><th>Priority</th><th class="num">TAT</th></tr></thead><tbody>'
      +'<tr><td><div class="primary-cell"><b>RDH-2027-012345</b><small>Confidential · CBC</small></div></td><td class="small">Coko HC</td><td>'+UI.pill('STAT','rose')+'</td><td class="num mono">2.1h</td></tr>'
      +'<tr><td><div class="primary-cell"><b>RDH-2027-012344</b><small>HABIMANA Jean · GeneXpert</small></div></td><td class="small">Nyange HC</td><td>'+UI.pill('Routine','slate')+'</td><td class="num mono">19h</td></tr>'
      +'</tbody></table></div></div>'
    +'<div class="ds-demo"><div class="eyebrow">Empty state</div>'+UI.empty({art:'search',title:'Nothing matches that filter',body:'Saved views are shareable by URL — copy the address bar to hand a filtered worklist to a colleague.',action:'<button class="btn sm">'+UI.ic('rotate-ccw',13)+'Clear filters</button>'})+'</div>'});
}
function icons(){
  const names=Object.keys(window.LS_ICONS||{});
  return UI.card({title:'Iconography',sub:'Lucide · 24px grid · 1.5px stroke · '+names.length+' icons bundled',icon:'shapes',body:
    '<div class="ds-icons">'+names.slice(0,120).map(n=>'<div class="ds-icon" data-tip="'+n+'">'+U.ic(n,17)+'<span>'+n+'</span></div>').join('')+'</div>'});
}
M.render=function(root){
  rootEl=root;
  root.innerHTML='<div class="page-head"><div><h1>Design system</h1><div class="sub">A living specimen sheet — tokens, type, motion and components exactly as they render elsewhere in the console.</div></div>'
   +'<div class="actions"><span class="chip gold">'+UI.ic('sparkles',12)+'v6.0 · 100 upgrades</span><a class="btn" href="#/roadmap">'+UI.ic('rocket',15)+' Roadmap</a></div></div>'
   +brand()
   +'<div class="section-head"><h2>Colour</h2><span class="more">Click to copy</span></div>'+colour()
   +'<div class="section-head"><h2>Typography</h2></div>'+type()
   +'<div class="section-head"><h2>Space &amp; motion</h2></div>'+space()
   +'<div class="section-head"><h2>Components</h2></div>'+components()
   +'<div class="section-head"><h2>Icons</h2></div>'+icons();
  root.querySelectorAll('[data-hex]').forEach(b=>b.onclick=()=>{ U.copy(b.dataset.hex); UI.toast(b.dataset.hex+' copied',{type:'ok'}); });
};
})();
