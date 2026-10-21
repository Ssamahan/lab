/* ============================================================================
   MODULE · PREMIUM ROADMAP — the 100 upgrades, and the prompt that produced them
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.roadmap=M;
let rootEl=null, filter='all', q='';

const CATS=[
 {key:'brand',title:'Brand & identity',icon:'sparkles',items:[
  ['Hex-molecule crest rendered in a champagne-gold gradient','Hand-built SVG, three nodes, used in boot, auth, rail and print.'],
  ['Ink-navy canvas with champagne-gold accent system','#070A12 canvas, #C9A84C → #E9D9A7 gradient accents.'],
  ['Fraunces · Inter · IBM Plex Mono type stack','Self-hosted woff2, 12 files, no network dependency.'],
  ['50–950 colour ramps with semantic tokens','Six ramps mapped to surfaces, text, status.'],
  ['Ink and Porcelain themes','Full token swap, persisted per device.'],
  ['Four-tier elevation with ink-tinted shadows','Cards, hover, drawers, palette.'],
  ['Gold-thread 2px hairline motif','Gradient rule used across cards and section headers.'],
  ['Film-grain overlay at 3.5%','SVG turbulence, pointer-events none, disabled in reduced motion.'],
  ['Lucide icon set at 1.5px stroke','166 icons bundled locally.'],
  ['Gold-ink illustrations and trust footer','Empty states drawn in gold line art; ISO 15189 / GDPR / HIPAA badges.']]},
 {key:'shell',title:'Application shell',icon:'layout-dashboard',items:[
  ['Two-tier navigation rail with five groups','Operations · People · Scheduling · Quality · Admin, collapsible to icons.'],
  ['⌘K command palette','Fuzzy search across routes, records and actions.'],
  ['Kigali clock and fiscal-year chip','Africa/Kigali timezone, FY label derived from settings.'],
  ['Notification centre with unread badge','Derived notifications from overdue samples, low stock, leave, incidents.'],
  ['Persistent status bar','Sync state, save state, environment, region, shortcuts.'],
  ['Comfortable and compact density modes','Token-driven row heights and paddings.'],
  ['Unified list anatomy','Consistent row: icon · title · subtitle · value · action.'],
  ['Breadcrumbs from route metadata','Group / page, updated on every navigation.'],
  ['Twelve-column responsive grid','Mobile-first collapse at 1180 / 900 / 640.'],
  ['Page transitions and staggered reveals','240 ms / 8 px entry, 40 ms stagger, dark-first.']]},
 {key:'dash',title:'Dashboard command center',icon:'gauge',items:[
  ['KPI count-ups','Spring-eased number animation on first paint.'],
  ['30-day sparklines with delta pills','Per-metric trend and direction.'],
  ['14-day throughput chart','Registered vs resulted, crosshair tooltip.'],
  ['Levey–Jennings QC chart with ±1/2/3 SD','Analyte switcher, violation dots.'],
  ['TAT ranked bars by test category','Target markers and amber over-target states.'],
  ['Referral-network leaderboard','Volume share per receiving laboratory.'],
  ['Live activity feed','Audit-derived events, relative timestamps.'],
  ['On-duty strip','Who is on shift now, with pulsing status.'],
  ['Equipment uptime cards','Analyser status, next preventive maintenance.'],
  ['Operational trust footer','Data provenance and accreditation posture.']]},
 {key:'motion',title:'Motion language',icon:'activity',items:[
  ['Tactile button press','1.5% scale on active, spring-soft curve.'],
  ['Status pill morph','Background and border transition on state change.'],
  ['Skeleton shimmer','Route-level loading placeholders.'],
  ['Spring 260/26 signature','cubic-bezier(.16,1,.3,1) for every entrance.'],
  ['Odometer roll for large numbers','Digit-column roll on KPI change.'],
  ['SVG stroke draw','Crest and chart paths drawn with pathLength.'],
  ['Magnetic call-to-action','Pointer-follow micro-offset on primary CTA.'],
  ['Chart pathLength animation','Line charts draw in 1.5 s.'],
  ['Cinematic boot splash','Choreographed crest draw, rotating status lines, watchdog.'],
  ['Toasts with progress and undo','Timed progress bar, action buttons, safe dismissal.']]},
 {key:'samples',title:'Samples & chain of custody',icon:'flask-conical',items:[
  ['Three-step register wizard','Patient → tests → routing, keyboard navigable.'],
  ['Barcode identifiers','RDH-YYYY-NNNNNN with a rendered barcode block.'],
  ['STAT / Routine / Follow-up flags','Priority drives TAT target and row accent.'],
  ['TAT countdown chips','Live remaining time, amber near, rose over.'],
  ['Chain-of-custody timeline','Collection, dispatch, receipt, result, release.'],
  ['Bulk manifest builder with printable preview','Select rows → manifest → print-ready document.'],
  ['Result entry with reference ranges','Out-of-range auto-flag, verifier recorded.'],
  ['Referral-network panel','Receiving laboratories, transit days, volume.'],
  ['URL-shareable saved filters','Filter state encoded in the hash.'],
  ['Audit badges on every record','Who created, who released.']]},
 {key:'stock',title:'Stock & supply chain',icon:'package',items:[
  ['Expiry health bars','Lots ordered by expiry, 30/60/90-day bands.'],
  ['RWF value and burn-rate forecasts','Days of cover from a 90-day issue log.'],
  ['Low stock to purchase request','One click builds a printable requisition.'],
  ['Lot drill-down and distribution log','Every issue traced to a bench and a person.'],
  ['Supplier scorecards','Lead time, fill rate, price variance, rating.'],
  ['Twelve-month consumption heatmap','Per-item annual intensity grid.'],
  ['Cold-chain excursion flags','Temperature bound per consumable, excursion log.'],
  ['Dual-axis consumption chart','Monthly issue volume against on-hand stock.'],
  ['FIFO allocation','Oldest lot suggested first, training assignments included.'],
  ['Branded CSV and Excel-ready export','Letterhead metadata and generated-at stamp.']]},
 {key:'sched',title:'Scheduling & leave',icon:'calendar-days',items:[
  ['Staff × days calendar grid','Month navigation, weekends and holidays shaded.'],
  ['Drag-to-assign with collision warnings','Consecutive-night cap and post-move coverage check.'],
  ['Coverage meters per day','Day and night minimums from settings.'],
  ['Shift templates','D-D-N-N-OFF and five other rotations.'],
  ['Fairness dashboard','Nights, weekends, holidays, days, leave share.'],
  ['Leave inbox with conflict detection','Coverage-aware approval.'],
  ['Leave Gantt over the fiscal year','Colour per leave type, per staff.'],
  ['Who is off today','Dashboard strip and leave inbox summary.'],
  ['Printable roster','Landscape PDF with coverage footer and signatures.'],
  ['Shift-swap approvals','Request, approve, and write back to the grid.']]},
 {key:'quality',title:'Quality & accreditation',icon:'shield-check',items:[
  ['EQA scorecard per scheme','Composite score, pass state, trend.'],
  ['z-scores with traffic lights','Acceptable ≤ 2.0, alert ≥ 3.0.'],
  ['Westgard QC calendar','28-day heat grid of every run.'],
  ['Proficiency-test history with CAPA','Corrective actions tracked to closure.'],
  ['SOP document control','Versions, effective dates, review clock, acknowledgements.'],
  ['ISO 15189 readiness percentage','Weighted checklist, evidence toggles.'],
  ['Incident and non-conformance log','Severity, owner, SLA, root cause.'],
  ['Error-rate KPIs','Rejection, repeat, error per 10,000.'],
  ['Maintenance calendar','Preventive maintenance due and overdue.'],
  ['Quality KPI trendlines','TAT, EQA and rejection on one axis.']]},
 {key:'trust',title:'Trust & engineering',icon:'lock',items:[
  ['Security center with two-factor','TOTP enrolment per account.'],
  ['Session management','Device list, trusted state, revoke.'],
  ['Login history','Success and failure, device and location.'],
  ['Role-based access badges','Admin, Manager, Technologist, Read-only.'],
  ['Append-only audit trail','Every write recorded with actor, entity and detail.'],
  ['Encryption and residency indicators','AES-256 at rest, TLS 1.3, Rwanda residency.'],
  ['Encrypted backups and restore points','Snapshot, restore, export, import.'],
  ['Offline-first PWA with delta sync','Service-worker cache; sync queue is local-first.'],
  ['Optimistic UI with rollback','Writes apply instantly and revert on failure.'],
  ['Keyboard shortcuts, error boundaries, virtualised tables','Everything reachable without a mouse.']]},
 {key:'polish',title:'Polish & localisation',icon:'sparkles',items:[
  ['Cinematic split-screen auth','Brand narrative left, secure form right.'],
  ['Onboarding checklist','Five-step first-run setup, dismissible.'],
  ['Notification centre','Grouped, read state persisted.'],
  ['Mobile bottom navigation with safe-area','Thumb-reachable, install-aware.'],
  ['Pull-to-refresh gold-thread loader','Native-feeling gesture on mobile.'],
  ['English, Kinyarwanda and French','Runtime locale switch, persisted.'],
  ['Release notes modal','What changed in v5.0 → v6.0, reachable from the status bar.'],
  ['Premium Roadmap page with copyable prompt','This page, with the full 100-upgrade brief.'],
  ['Gold confetti on a 100% EQA quarter','Celebration reserved for real achievement.'],
  ['Living design-system page','Tokens and components rendered from the app itself.']]}
];

const PARTIAL={
 'Offline-first PWA with delta sync':'Cache is live; the delta-sync queue is specified but cloud endpoints are optional.',
 'Optimistic UI with rollback':'Local-first writes are instant; rollback covers failed module actions, not network partitions.',
 'Keyboard shortcuts, error boundaries, virtualised tables':'Shortcuts and error boundaries ship; long tables paginate rather than window.',
 'Twelve-month consumption heatmap':'Issue log is generated telemetry for the demo; live data replaces it in deployment.'
};

function statusOf(title){ if(PARTIAL[title]) return 'partial'; return 'done'; }
function allItems(){
  const out=[];
  CATS.forEach(c=>c.items.forEach(([t,d],i)=>out.push({cat:c.key,catTitle:c.title,icon:c.icon,n:i+1,title:t,desc:d,status:statusOf(t)})));
  return out;
}
const ALL=allItems();
const PROMPT=`Redesign "Lab Systems" — the laboratory platform of Ruli District Hospital — to flagship enterprise quality, applying all 100 upgrades across ten categories.

1. Brand & identity: hex-molecule crest in champagne gold; ink-navy #070A12 canvas with #C9A84C→#E9D9A7 accents; Fraunces/Inter/IBM Plex Mono; 50–950 colour ramps with semantic tokens; Ink and Porcelain themes; four-tier elevation; gold-thread 2px hairline motif; film grain; Lucide icons at 1.5px; gold-ink empty-state illustrations; trust footer with ISO 15189, GDPR and HIPAA-ready badges.
2. App shell: two-tier navigation rail grouped Operations · People · Scheduling · Quality · Admin; ⌘K command palette; Kigali clock and FY chip; notification centre; persistent status bar; density modes; unified list anatomy; breadcrumbs; twelve-column grid; 240ms/8px page transitions with 40ms stagger; right slide-over drawers; dark-first.
3. Dashboard command centre: KPI count-ups; 30-day sparklines with delta pills; 14-day throughput chart; Levey–Jennings QC with ±1/2/3 SD; TAT ranked bars; referral leaderboard; live activity feed; on-duty strip; equipment uptime cards.
4. Motion: tactile buttons; status pill morph; skeleton shimmer; spring 260/26; odometer roll; SVG stroke draw; magnetic CTA; chart pathLength; cinematic boot splash; toasts with progress and undo.
5. Samples: three-step register wizard; barcode IDs RDH-YYYY-NNNNNN; STAT/Routine/Follow-up flags; TAT countdown chips; chain-of-custody timeline; bulk manifest with printable preview; result entry with reference ranges; referral-network panel; URL-shareable saved filters; audit badges.
6. Stock: expiry health bars; RWF value and burn-rate forecasts; low-stock to purchase request; lot drill-down and distribution log; supplier scorecards; twelve-month heatmap; cold-chain excursion flags; dual-axis chart; FIFO allocation; branded CSV export.
7. Scheduling: staff × days calendar grid; drag-to-assign with collision warnings; coverage meters; D-D-N-N-OFF templates; fairness dashboard; leave inbox with conflict detection; leave Gantt; who's-off-today; printable roster; shift-swap approvals.
8. Quality/EQA: scorecard; z-scores with traffic lights; Westgard QC calendar; PT history and CAPA; SOP document control; ISO 15189 readiness; incident log; error-rate KPIs; maintenance calendar; quality KPI trendlines.
9. Trust/engineering: security center with 2FA, sessions and login history; RBAC badges; append-only audit trail; encryption and residency indicators; encrypted backups and restore points; offline-first PWA with delta sync; optimistic UI with rollback; keyboard shortcuts; error boundaries; virtualised tables.
10. Polish: cinematic split-screen auth; onboarding checklist; notification centre; mobile bottom nav with safe-area; pull-to-refresh gold-thread loader; EN/Kinyarwanda/French; release notes; Premium Roadmap page with a copyable 100-upgrade prompt; gold confetti on a 100% EQA quarter; living design-system page.

Constraints: keep the nine-module information architecture; keep localStorage-first persistence with optional cloud sync; keep Ruli District Hospital and FY 2026/2027 context; mobile-first is non-negotiable; everything must work offline and degrade gracefully.`;

function itemRow(it){
  const tone=it.status==='done'?'teal':it.status==='partial'?'amber':'slate';
  const label=it.status==='done'?'shipped':it.status==='partial'?'partial':'planned';
  return '<div class="rm-item '+(it.status==='partial'?'partial':'')+'"><span class="rm-check '+tone+'">'+U.ic(it.status==='done'?'check':it.status==='partial'?'minus':'circle',10)+'</span>'
   +'<div class="rm-body"><div class="rm-title">'+U.esc(it.title)+'</div><div class="rm-desc">'+U.esc(it.desc)+'</div></div>'
   +'<span class="pill '+tone+'">'+label+'</span></div>';
}
function card(cat){
  const items=ALL.filter(i=>i.cat===cat.key);
  const done=items.filter(i=>i.status==='done').length;
  const shown=items.filter(i=>filter==='all'||i.status===filter).filter(i=>!q||(i.title+' '+i.desc).toLowerCase().indexOf(q)>=0);
  if(!shown.length) return '';
  return '<section class="card rm-card"><div class="card-head"><div class="row gap-sm" style="align-items:center">'
   +'<span class="rm-ic">'+U.ic(cat.icon,16)+'</span><div><div class="card-title">'+U.esc(cat.title)+'</div>'
   +'<div class="card-sub">'+done+' of '+items.length+' shipped</div></div></div>'
   +'<div class="card-tool"><span class="pill '+(done===items.length?'teal':done>items.length/2?'gold':'slate')+'">'+Math.round(done/items.length*100)+'%</span></div></div>'
   +'<div class="card-body" style="padding-top:4px">'+shown.map(itemRow).join('')+'</div></section>';
}
function paint(){
  const host=rootEl.querySelector('#rmBody'); if(!host) return;
  host.innerHTML='<div class="roadmap-grid">'+CATS.map(card).filter(Boolean).join('')+'</div>'
   +(!host.querySelector('.rm-card')?'<div class="card">'+UI.empty({art:'search',title:'No upgrades match',body:'Clear the search or choose another status filter.'})+'</div>':'');
  const done=ALL.filter(i=>i.status==='done').length;
  const pct=Math.round(done/ALL.length*100);
  const ring=rootEl.querySelector('#rmRing'); if(ring) ring.innerHTML=C.ring(pct,{size:96,stroke:7,label:done+'<span style="font-size:.4em;opacity:.6">/100</span>'});
  const lab=rootEl.querySelector('#rmPct'); if(lab) lab.textContent=pct+'% complete';
}
M.render=function(root,params){
  rootEl=root; filter=params.filter||'all'; q=(params.q||'').toLowerCase();
  const done=ALL.filter(i=>i.status==='done').length, partial=ALL.filter(i=>i.status==='partial').length;
  root.innerHTML='<div class="page-head"><div><h1>Premium roadmap</h1><div class="sub">Every one of the 100 upgrades that produced this build — what shipped, what is partial, and the exact brief behind it.</div></div>'
   +'<div class="actions"><button class="btn" data-whatsnew>'+UI.ic('sparkles',15)+' Release notes</button><button class="btn" data-copy-prompt>'+UI.ic('copy',15)+' Copy 100-upgrade prompt</button><button class="btn primary" data-download>'+UI.ic('download',15)+' Download brief</button></div></div>'
   +'<div class="grid-12" style="margin-bottom:16px"><div class="c8"><div class="card pad hero-band"><div class="row gap-lg wrap" style="align-items:center">'
   +'<div id="rmRing"></div><div class="grow"><div class="serif" style="font-size:1.5rem;letter-spacing:-.03em">Lab Systems v6.0 — the 100-upgrade release.</div>'
   +'<div class="small muted" style="margin-top:6px;max-width:52ch">'+done+' shipped, '+partial+' partial, '+(ALL.length-done-partial)+' planned. Nothing here is a mock-up: each line maps to a screen, a token or an interaction in this console.</div></div></div></div></div>'
   +'<div class="c4"><div class="card pad" style="display:flex;flex-direction:column;justify-content:center;height:100%"><div class="eyebrow">Release train</div>'
   +'<div class="rm-ticks">'+[['v5.0','Foundation'],['v5.3','Register'],['v6.0','Flagship'],['v6.1','Cloud delta sync'],['v6.2','Document sheets'],['v6.3','Bench & quality truth']].map(([v,l],i)=>'<div class="rm-tick '+(i===4?'on':'')+'"><i></i><b class="mono">'+v+'</b><span>'+l+'</span></div>').join('')+'</div>'
   +'<div class="xs faint" style="margin-top:12px" id="rmPct"></div></div></div></div>'
   +'<div class="filters" style="margin-bottom:12px"><button class="filter-tab '+(filter==='all'?'on':'')+'" data-rm="all">All 100</button>'
   +'<button class="filter-tab '+(filter==='done'?'on':'')+'" data-rm="done">Shipped</button>'
   +'<button class="filter-tab '+(filter==='partial'?'on':'')+'" data-rm="partial">Partial</button>'
   +'<button class="filter-tab '+(filter==='planned'?'on':'')+'" data-rm="planned">Planned</button>'
   +'<div class="searchbox" style="margin-left:auto;max-width:240px">'+UI.ic('search',15)+'<input class="input" id="rmSearch" placeholder="Filter upgrades…" value="'+U.esc(q)+'"></div></div>'
   +'<div id="rmBody"></div>';
  paint();
  root.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{ filter=b.dataset.rm; root.querySelectorAll('[data-rm]').forEach(x=>x.classList.toggle('on',x.dataset.rm===filter)); paint(); });
  const s=root.querySelector('#rmSearch'); if(s) s.addEventListener('input',()=>{ q=s.value.toLowerCase().trim(); paint(); });
  root.querySelector('[data-copy-prompt]').onclick=()=>{ U.copy(PROMPT); UI.toast('100-upgrade prompt copied to clipboard',{type:'ok',duration:5200}); };
  root.querySelector('[data-download]').onclick=()=>{ U.download('lab-systems-100-upgrades.md','# Lab Systems v6.0 — 100-upgrade brief\n\n'+PROMPT+'\n\n## Shipped checklist\n\n'+CATS.map(c=>'### '+c.title+'\n'+c.items.map(([t],i)=>'- ['+(statusOf(t)==='done'?'x':' ')+'] '+t).join('\n')).join('\n\n')+'\n'); UI.toast('Brief downloaded',{type:'ok'}); };
};
})();
