/* ============================================================================
   MODULE · WORKING PLAN — calendar grid, drag-to-assign, coverage, fairness
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store, SH=LS.sheets;
const M={}; LS.modules.roster=M;
let rootEl=null, mk=null, view='grid', drag=null, suppressClick=false, wk=null;
const CODES=[['D','Day · 08:00–17:00'],['N','Night · 17:00–08:00 next day'],['DN','Day + night'],['OFF','At home (not on shift)'],['AL','Annual leave'],['TR','Training'],['SICK','Sick leave'],['W','Wedding day']];

function plan(){ const e=S.db().workingPlans[mk||U.monthKey()]; return e&&e.primary?e.primary:null; }
function ensurePlan(){ return plan(); }
function planState(p){
  if(!p) return {label:'No plan for '+U.monthLabel(mk),tone:'rose',official:false};
  const official=p.meta&&p.meta.official;
  if(official) return {label:'Official · '+U.monthLabel(mk),tone:'gold',official:true};
  if(p.meta&&p.meta.generated) return {label:'Draft · '+U.monthLabel(mk),tone:'amber',official:false};
  return {label:'Edited plan · '+U.monthLabel(mk),tone:'teal',official:false};
}
function monthKeyOf(){ return mk||U.monthKey(); }
const codeOf=(p,si,di)=> (p&&p.staff[si]&&p.staff[si].codes[di])||'';

function coverage(p){
  const out={};
  (p?p.dates:[]).forEach((iso,di)=>{
    let day=0,night=0;
    (p.staff||[]).forEach((s,si)=>{ const c=s.codes[di]; if(c==='D'||c==='DN') day++; if(c==='N'||c==='DN') night++; });
    out[iso]={day,night};
  });
  return out;
}
function req(){ const s=S.settings(); return {day:s.coverWeekdayDay||3,night:s.coverWeekdayNight||1,wkDay:s.coverWeekendDay||2,wkNight:s.coverWeekendNight||1}; }
function required(iso){ const r=req(); return U.dow(iso)>=5?{day:r.wkDay,night:r.wkNight}:{day:r.day,night:r.night}; }

function fairness(p){
  const out={};
  (p?p.staff:[]).forEach(s=>{
    let nights=0,weekends=0,holidays=0,days=0,leave=0;
    (p.dates||[]).forEach((iso,di)=>{
      const c=s.codes[di]; const dow=U.dow(iso);
      if(c==='N'||c==='DN') nights += c==='DN'?2:1;
      if(dow>=5 && ['D','N','DN'].includes(c)) weekends++;
      if(S.holiday(iso) && ['D','N','DN'].includes(c)) holidays++;
      if(c==='D'||c==='DN') days++;
      if(c==='AL'||c==='SICK') leave++;
    });
    out[s.name]={nights,weekends,holidays,days,leave};
  });
  return out;
}

function header(){
  const p=plan();
  const st=planState(p);
  const label=U.monthLabel(mk||U.monthKey());
  return '<div class="page-head"><div><h1>Working plan</h1><div class="sub">A true calendar for the bench: staff × days, weekend shading, today marker, live coverage and a fairness ledger that survives scrutiny.</div>'
   +'<div class="row wrap gap-sm" style="margin-top:8px"><span class="pill '+st.tone+'">'+UI.ic(st.official?'lock':'file-text',11)+U.esc(st.label)+'</span>'
   +(p&&p.meta&&p.meta.label?'<span class="xs faint">'+U.esc(p.meta.label)+'</span>':'<span class="xs faint">Stored plans are never auto-generated — a month without a plan stays empty until someone creates one.</span>')+'</div></div>'
   +'<div class="actions">'
     +'<div class="seg" style="margin-right:4px"><button data-nav="-1" aria-label="Previous month">'+UI.ic('chevron-left',14)+'</button><button data-nav="0" style="font-family:var(--font-mono);font-size:11px;min-width:92px">'+U.esc(label)+'</button><button data-nav="1" aria-label="Next month">'+UI.ic('chevron-right',14)+'</button></div>'
     +'<button class="btn" data-generate>'+UI.ic('sparkles',15)+' Generate draft</button>'
     +'<button class="btn" data-patterns>'+UI.ic('layers',15)+' Patterns</button>'
     +'<button class="btn" data-print>'+UI.ic('printer',15)+' Print roster</button>'
     +'<button class="btn primary" data-sheet>'+UI.ic('file-down',15)+' Export sheet</button>'
   +'</div></div>'
   +'<div class="filters" style="margin-bottom:12px">'+[['sheet','Official sheet'],['grid','Shift grid'],['week','Weekly roster'],['services','Lab services'],['fairness','Fairness'],['swaps','Swap requests']].map(([k,l])=>'<button class="filter-tab '+(view===k?'on':'')+'" data-view="'+k+'">'+l+'</button>').join('')+'</div>';
}
function legend(){
  return '<div class="row wrap gap-sm" style="margin-bottom:10px"><span class="shift-code D">D</span><span class="xs faint">Day 08:00–17:00</span><span class="shift-code N">N</span><span class="xs faint">Night 17:00–08:00 next day</span><span class="shift-code DN">DN</span><span class="xs faint">Day + night</span><span class="shift-code AL">AL</span><span class="xs faint">Annual leave</span><span class="shift-code TR">TR</span><span class="xs faint">Training</span><span class="shift-code OFF">OFF</span><span class="xs faint">At home</span><span style="margin-left:auto" class="xs faint">Drag a shift to another day · click to edit</span></div>';
}
function gridView(){
  const p=plan();
  if(!p) return '<div class="card pad">'+UI.empty({art:'calendar',title:'No working plan for '+U.monthLabel(mk),
    body:'This month has never been generated or imported, and the console will not invent one — the plan in force is register data. Create a draft from staff patterns and approved leave, or add shifts cell by cell.',
    action:'<div class="row gap-sm" style="justify-content:center;flex-wrap:wrap"><button class="btn primary" data-empty-generate>'+UI.ic('sparkles',15)+' Generate draft</button><button class="btn" data-empty-blank>'+UI.ic('square-pen',15)+' Start a blank month</button></div>'
      +(S.planMonths().filter(k=>k!==mk).length?'<div class="row wrap gap-sm" style="justify-content:center;margin-top:14px"><span class="xs faint">Stored plans:</span>'+S.planMonths().filter(k=>k!==mk).map(k=>'<button class="btn xs" data-open-month="'+k+'">'+U.ic('calendar-days',12)+U.esc(U.monthLabel(k))+'</button>').join('')+'</div>':'')})+'</div>';
  const cov=coverage(p), rq=req();
  const head='<thead><tr><th class="staff-cell" style="z-index:4">Staff / day</th>'+p.dates.map(iso=>{
    const dow=U.dow(iso), today=iso===U.todayISO(), hol=S.holiday(iso);
    return '<th class="'+(dow>=5?'wkend':'')+'" '+(hol?'data-tip="'+U.esc(hol.name)+'"':'')+' style="'+(today?'color:var(--gold)':'')+'">'+U.DOW1[dow]+'<div style="font-family:var(--font-mono);font-size:10.5px;color:'+(today?'var(--gold)':'var(--text-muted)')+'">'+U.parseISO(iso).getDate()+'</div></th>';
  }).join('')+'</tr></thead>';
  const body=(p.staff||[]).map((s,si)=>{
    const st=S.staffByName(s.name)||{};
    return '<tr><td class="staff-cell"><div class="nm">'+U.esc(s.name)+'</div><div class="rl">'+U.esc(st.role||'')+'</div></td>'
     +p.dates.map((iso,di)=>{
        const c=s.codes[di]||''; const dow=U.dow(iso), today=iso===U.todayISO(), hol=S.holiday(iso);
        const lv=S.leaveCodeFor(s.name,iso);
        const show=lv&&!['AL','SL','CL','ML','W','TR'].includes(c)?lv:c;
        const cls=['day',dow>=5?'wkend':'',today?'today':'',hol?'holiday':'',c==='OFF'?'off':''].filter(Boolean).join(' ');
        return '<td class="'+cls+'" data-cell="'+si+'-'+di+'" data-si="'+si+'" data-di="'+di+'" '+(c?'draggable="true"':'')+(lv?' data-tip="Approved leave — the stored plan is unchanged"':'')+'><span class="shift-code '+show+'" style="pointer-events:none'+(lv?'':';')+'">'+U.esc(show||'·')+'</span>'
          +(lv?'<i style="position:absolute;inset:2px;border:1px dashed var(--gold);border-radius:4px;pointer-events:none"></i>':'')+'</td>';
     }).join('')+'</tr>';
  }).join('');
  const footer='<tfoot><tr class="cov-footer"><td class="staff-cell" style="background:var(--surface-inset);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)">Day cover</td>'
   +p.dates.map(iso=>{ const c=cov[iso], r=required(iso); return '<td class="'+(c.day<r.day?'low':'')+'" data-tip="'+c.day+' of '+r.day+' required">'+c.day+'</td>'; }).join('')+'</tr>'
   +'<tr class="cov-footer"><td class="staff-cell" style="background:var(--surface-inset);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)">Night cover</td>'
   +p.dates.map(iso=>{ const c=cov[iso], r=required(iso); return '<td class="'+(c.night<r.night?'low':'')+'" data-tip="'+c.night+' of '+r.night+' required">'+c.night+'</td>'; }).join('')+'</tr></tfoot>';
  const under=p.dates.filter(iso=>cov[iso].day<required(iso).day||cov[iso].night<required(iso).night);
  return legend()
   +'<div class="grid-12"><div class="c9"><div class="card table-card"><div class="dt-scroll" style="max-height:none"><table class="cal">'+head+'<tbody>'+body+'</tbody>'+footer+'</table></div>'
   +'<div class="card-foot"><span>'+(p.meta&&p.meta.official?'Official published plan — edits are audited':p.meta&&p.meta.generated?'Draft generated from staff patterns':'Edited plan')+' · '+p.dates.length+' days · '+(p.meta&&p.meta.label?U.esc(p.meta.label):'')+'</span><span class="pill '+(under.length?'amber':'teal')+'">'+(under.length?under.length+' days under-covered':'Coverage complete')+'</span></div></div></div>'
   +'<div class="c3"><div class="col" style="gap:14px">'
     +UI.card({title:'Coverage',sub:'Required vs assigned per day',icon:'gauge',body:function(){
        return '<div style="display:flex;flex-direction:column;gap:7px">'+p.dates.slice(0,12).map(iso=>{ const c=cov[iso], r=required(iso); const pctD=U.clamp(c.day/r.day*100,0,100), pctN=U.clamp(c.night/r.night*100,0,100);
          return '<div class="row" style="gap:8px"><span class="mono xs faint" style="width:26px">'+U.parseISO(iso).getDate()+'</span><div class="grow"><div style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+pctD+'%;background:'+(pctD<100?'var(--crit)':'var(--gold)')+';border-radius:99px"></div></div></div><span class="mono xs" style="width:26px;text-align:right">'+c.day+'</span></div>';
        }).join('')+'</div><div class="hint" style="margin-top:8px">First 12 days · day-shift coverage.</div>';
      }()})
     +UI.card({title:'Balance',sub:'Night · weekend · holiday load',icon:'scale',body:'<div id="fairMini"></div>'})
   +'</div></div></div>';
}
function fairnessView(){
  const p=plan(); if(!p) return '<div class="card pad">'+UI.empty({art:'calendar',title:'No plan to analyse',body:'Fairness is computed from a stored working plan. Create or import '+U.monthLabel(mk)+' first.',action:'<button class="btn primary" data-empty-generate>Generate draft</button>'})+'</div>';
  const f=fairness(p);
  const names=Object.keys(f);
  const maxN=Math.max.apply(null,names.map(n=>f[n].nights).concat([1]));
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'Fairness ledger',sub:'Distribution this month · a controlled, auditable record',icon:'scale',body:
    '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Staff</th><th>Nights</th><th>Weekend days</th><th>Holidays</th><th>Worked</th><th>Leave</th></tr></thead><tbody>'
    +names.map(n=>'<tr><td><div class="row gap-sm">'+U.avatar(n,'sm')+'<span class="small">'+U.esc(n)+'</span></div></td>'
      +'<td><div class="row gap-sm"><span class="mono xs" style="width:20px">'+f[n].nights+'</span><div style="width:60px">'+UI.meter(f[n].nights/maxN*100,'teal')+'</div></div></td>'
      +'<td class="num">'+f[n].weekends+'</td><td class="num">'+f[n].holidays+'</td><td class="num">'+f[n].days+'</td><td class="num">'+f[n].leave+'</td></tr>').join('')
    +'</tbody></table></div><div class="card-foot"><span>Even distribution is monitored; deviations require a documented reason.</span></div>'})+'</div>'
   +'<div class="c5"><div class="col" style="gap:14px">'+UI.card({title:'Night load',sub:'Sessions per staff member',icon:'moon',body:'<div id="fairNights"></div>'})
     +UI.card({title:'Weekend burden',sub:'Saturday + Sunday worked',icon:'calendar-days',body:'<div id="fairWeekend"></div>'})+'</div></div></div>';
}
function swapsView(){
  const db=S.db();
  db.swaps=db.swaps||[];
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'Shift swap requests',sub:'Manager approval · full audit trail',icon:'arrow-right-left',
    tools:'<button class="btn sm" data-new-swap>'+UI.ic('plus',13)+'Request swap</button>',
    body:db.swaps.length?db.swaps.map(sw=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(sw.from)+' ↔ '+U.esc(sw.to)+'</div><div class="lr-sub">'+U.fmtDate(sw.date)+' · requested by '+U.esc(sw.by)+' · '+U.relTime(sw.at)+'</div></div>'
      +(sw.status==='Approved'?'<span class="pill teal">approved</span>':sw.status==='Declined'?'<span class="pill rose">declined</span>':'<div class="row gap-sm"><button class="btn xs" data-swap-decline="'+sw.id+'">Decline</button><button class="btn xs primary" data-swap-approve="'+sw.id+'">Approve</button></div>')+'</div>').join('')
      :UI.empty({art:'calendar',title:'No swap requests',body:'Staff can request a swap from any shift cell. Requests become an audited approval item.'}),foot:'<span>Approvals notify both staff and update the live roster.</span>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Collision rules',sub:'Enforced on every drag',icon:'shield-check',body:'<div style="display:flex;flex-direction:column;gap:9px">'
     +[['No two consecutive nights beyond each staff cap','maxConsecN'],['No solo coverage — minimum staffing per shift','coverWeekdayDay'],['Approved leave blocks assignment','leave register'],['Weekend-only contracts respected','student pattern']].map(([t,s])=>'<div class="row gap-sm"><span class="pill teal">auto</span><div><div class="small">'+t+'</div><div class="xs faint">'+s+'</div></div></div>').join('')
     +'</div>'})+'</div></div>';
}

/* ——— Weekly roster: lab services × days, staff allocation ————— */
function weekStart(){ return wk||S.weekStart(U.todayISO()); }
function weekNavLabel(start){
  const end=U.addDays(start,6);
  return U.fmtDateShort(start)+' – '+U.fmtDateShort(end)+' '+U.parseISO(end).getFullYear();
}
function shiftWeek(delta){
  const d=U.parseISO(weekStart()); wk=U.isoLocal(new Date(d.getFullYear(),d.getMonth(),d.getDate()+7*delta));
  paint();
}
function allocationOf(start){ const w=S.db().unitRosters&&S.db().unitRosters[start]; return (w&&w.assignments)||{}; }

/* the sheet is authored at 3200 px wide — let it shrink to the card on phones */
function fitSVG(svg){ return svg.replace('<svg ','<svg style="max-width:100%;height:auto;display:block" ',1); }
/* The sheet is a 3200 px drawing with a few thousand nodes. It used to be built
   inside render(), so on a slow phone the module looked dead and the shell's
   watchdog reported "This panel could not render". The card is laid out first and
   the drawing is dropped in on the next frame, with a visible failure that stays
   inside the card instead of taking the panel down. */
let sheetSVG=null, sheetFailed=false;
function sheetView(){
  const p=plan();
  return '<div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('file-text',14,'ic')+'Official sheet — '+(p?((p.meta&&p.meta.period)||p.label):U.monthLabel(mk))+'</div>'
    +'<div class="card-sub">'+(p?(p.meta&&p.meta.official?'Transcribed from the signed register · edits are audited':'Working draft — publish before circulating'):'No plan stored for this month — the sheet shows the register only')+'</div></div>'
    +'<div class="card-tool row gap-sm"><button class="btn xs" data-sheet-png>'+UI.ic('image',12)+'PNG</button>'
    +'<button class="btn xs" data-sheet-pdf>'+UI.ic('file-text',12)+'PDF</button>'
    +'<button class="btn xs" data-sheet-xlsx>'+UI.ic('table-2',12)+'XLSX</button>'
    +'<button class="btn xs primary" data-sheet-print>'+UI.ic('printer',12)+'Print</button></div></div>'
    +'<div class="card-body" style="padding:10px;background:#fff"><div style="overflow:auto;border:1px solid var(--border);border-radius:8px">'
      +'<div id="sheetHost" style="min-height:220px;display:flex;align-items:center;justify-content:center;color:var(--text-faint);font-size:12px">Drawing the sheet…</div></div></div>'
    +'<div class="card-foot"><span>Same layout is used for PNG, PDF, XLSX and print — one A4 landscape page</span><span class="mono">'+(p?p.dates.length+' days · '+p.staff.length+' staff':'—')+'</span></div></div>';
}
function weekView(){
  const start=weekStart(), dates=S.weekDates(start), svcs=S.services(), alloc=allocationOf(start);
  const p=plan();
  const cellStaff=(iso,svc)=>alloc[iso]&&alloc[iso][svc]?alloc[iso][svc]:'';
  const statusOf=(iso,name)=>{ const st=S.staffByName(name); return st?S.shiftState(st,iso):null; };
  const unstaffed=dates.reduce((a,iso)=>a+svcs.filter(sv=>!cellStaff(iso,sv.name)).length,0);
  const conflicts=[];
  dates.forEach(iso=>svcs.forEach(sv=>{ const n=cellStaff(iso,sv.name); if(!n) return; const st=statusOf(iso,n);
    if(st && (st.kind==='off'||st.kind==='leave'||st.kind==='exited')) conflicts.push({iso,svc:sv.name,staff:n,state:st}); }));
  const head='<thead><tr><th class="staff-cell" style="z-index:4">Service</th>'+dates.map(iso=>{
    const dow=U.dow(iso), today=iso===U.todayISO();
    return '<th class="'+(dow>=5?'wkend':'')+'" style="'+(today?'color:var(--gold)':'')+'">'+U.DOWL[dow]+'<div style="font-family:var(--font-mono);font-size:10.5px;color:'+(today?'var(--gold)':'var(--text-muted)')+'">'+U.parseISO(iso).getDate()+'</div></th>';
  }).join('')+'</tr></thead>';
  const body=svcs.map(sv=>'<tr><td class="staff-cell"><div class="nm">'+U.esc(sv.name)+'</div><div class="rl mono">'+U.esc(sv.code)+' · min '+sv.min+'</div></td>'
    +dates.map(iso=>{
      const name=cellStaff(iso,sv.name); const st=name?statusOf(iso,name):null;
      const danger=st&&(st.kind==='off'||st.kind==='leave'||st.kind==='exited');
      return '<td class="day '+(U.dow(iso)>=5?'wkend':'')+' '+(iso===U.todayISO()?'today':'')+'" data-wcell="'+iso+'|'+U.esc(sv.name)+'" style="cursor:pointer;min-width:104px">'
        +(name?'<span class="small" style="display:block;line-height:1.25">'+U.esc(name.split(' ')[0])+' <span class="xs faint">'+U.esc(name.split(' ').slice(1).join(' '))+'</span></span>'
          +'<span class="pill '+(danger?'amber':st&&st.kind==='night'?'blue':'teal')+'" style="margin-top:3px;font-size:8.5px">'+(danger?U.esc(st.label):st&&st.kind==='night'?'night':'day')+'</span>'
          :'<span class="xs faint">—</span>')+'</td>';
    }).join('')+'</tr>').join('');
  const load={};
  dates.forEach(iso=>svcs.forEach(sv=>{ const n=cellStaff(iso,sv.name); if(n) load[n]=(load[n]||0)+1; }));
  const maxLoad=Math.max.apply(null,Object.values(load).concat([1]));
  return '<div class="row between wrap gap-sm" style="margin-bottom:10px">'
    +'<div class="seg"><button data-wknav="-1" aria-label="Previous week">'+UI.ic('chevron-left',14)+'</button><button data-wknav="0" style="font-family:var(--font-mono);font-size:11px;min-width:150px">'+U.esc(weekNavLabel(start))+'</button><button data-wknav="1" aria-label="Next week">'+UI.ic('chevron-right',14)+'</button></div>'
    +'<div class="row gap-sm"><span class="pill '+(conflicts.length?'amber':'teal')+'">'+conflicts.length+' allocation conflict'+(conflicts.length===1?'':'s')+'</span>'
    +'<span class="pill '+(unstaffed?'rose':'teal')+'">'+unstaffed+' empty slots</span>'
    +'<button class="btn sm" data-auto-week>'+UI.ic('wand-sparkles',13)+' Auto-allocate</button>'
    +'<button class="btn sm" data-print-week>'+UI.ic('printer',13)+' Print week</button>'
    +'<button class="btn sm" data-week-png>'+UI.ic('image',13)+' PNG</button>'
    +'<button class="btn sm" data-week-pdf>'+UI.ic('file-text',13)+' PDF</button>'
    +'<button class="btn sm" data-week-xlsx>'+UI.ic('table-2',13)+' XLSX</button>'
    +'<button class="btn sm primary" data-week-sheet>'+UI.ic('file-down',13)+' Sheet</button></div></div>'
    +'<div class="grid-12"><div class="c9"><div class="card table-card"><div class="dt-scroll" style="max-height:none"><table class="cal"><thead>'+head.slice(7)+'<tbody>'+body+'</tbody></table></div>'
    +'<div class="card-foot"><span>Click any cell to allocate a staff member · '+svcs.length+' services · '+(p?'shift codes from '+U.monthLabel(mk):'no working plan for this month')+'</span><span class="mono">'+dates.length+' days</span></div></div></div>'
    +'<div class="c3"><div class="col" style="gap:14px">'
      +UI.card({title:'Weekly allocation',sub:'Services covered per staff member',icon:'users',body:Object.keys(load).length?Object.keys(load).sort((a,b)=>load[b]-load[a]).map(n=>'<div style="margin-bottom:8px"><div class="row between"><span class="xs truncate">'+U.esc(n)+'</span><span class="mono xs faint">'+load[n]+'</span></div>'+UI.meter(load[n]/maxLoad*100,'teal')+'</div>').join(''):'<p class="xs faint">No allocations this week.</p>'})
      +UI.card({title:'Services in this laboratory',sub:'Derived from the service register',icon:'flask-conical',body:svcs.map(sv=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(sv.name)+'</div><div class="lr-sub">'+U.esc(sv.code)+' · min '+sv.min+' staff</div></div><span class="pill '+(svcs.length?'slate':'rose')+'">'+U.esc(sv.note||'').slice(0,18)+'</span></div>').join('')+'<div style="margin-top:8px"><button class="btn xs" data-manage-services>'+UI.ic('settings-2',12)+'Manage services</button></div>'})
    +'</div></div></div>';
}
function servicesView(){
  const svcs=S.services();
  const start=weekStart(), dates=S.weekDates(start), alloc=allocationOf(start);
  const used={}; dates.forEach(iso=>Object.keys(alloc[iso]||{}).forEach(sv=>{ used[sv]=(used[sv]||0)+1; }));
  return '<div class="grid-12"><div class="c8"><div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('flask-conical',14,'ic')+'Laboratory services</div><div class="card-sub">The service menu staff are rostered against — reception, benches, blood bank, molecular</div></div><span class="grow"></span><button class="btn sm" data-add-svc>'+UI.ic('plus',13)+'Add service</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Service</th><th>Code</th><th>Minimum staff</th><th>Note</th><th>Filled this week</th><th></th></tr></thead><tbody>'
   +svcs.map(sv=>'<tr><td><div class="primary-cell"><b>'+U.esc(sv.name)+'</b><small>'+U.esc(sv.note||'')+'</small></div></td><td class="mono xs">'+U.esc(sv.code)+'</td><td class="num">'+sv.min+'</td>'
     +'<td class="small">'+U.esc(sv.note||'—')+'</td><td class="num">'+(used[sv.name]||0)+' / 7 days</td>'
     +'<td><button class="icon-btn" style="width:26px;height:26px" data-edit-svc="'+sv.id+'">'+UI.ic('pencil',13)+'</button></td></tr>').join('')
   +'</tbody></table></div><div class="card-foot"><span>Services drive the weekly roster and the print-out</span><span class="mono">'+svcs.length+' services</span></div></div></div>'
   +'<div class="c4">'+UI.card({title:'Allocation this week',sub:weekNavLabel(start),icon:'calendar-days',body:svcs.map(sv=>{
      const n=dates.filter(iso=>alloc[iso]&&alloc[iso][sv.name]).length;
      return '<div style="margin-bottom:9px"><div class="row between"><span class="xs truncate">'+U.esc(sv.name)+'</span><span class="mono xs faint">'+n+'/7</span></div>'+UI.meter(n/7*100,n>=sv.min*1?n>=5?'teal':'amber':'rose')+'</div>';
    }).join('')+'<div style="margin-top:8px"><button class="btn xs" data-view-jump="week">'+UI.ic('arrow-right',12)+'Open weekly roster</button></div>'})+'</div></div>';
}
function serviceModal(id){
  if(!LS.auth.guard('edit')) return;
  const svcs=S.services(); const sv=id?svcs.find(x=>x.id===id):null;
  UI.modal({title:sv?'Edit laboratory service':'Add laboratory service',sub:'Services appear on the weekly roster, the allocation panel and the printed week.',width:'min(520px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Service name</label><input class="input" id="svName" value="'+U.esc(sv?sv.name:'')+'" placeholder="e.g. TB microscopy"></div>'
      +'<div class="field"><label>Code</label><input class="input mono" id="svCode" maxlength="5" value="'+U.esc(sv?sv.code:'')+'" placeholder="TBM"></div>'
      +'<div class="field"><label>Minimum staff per day</label><input class="input mono" type="number" min="1" id="svMin" value="'+(sv?sv.min:1)+'"></div>'
      +'<div class="field span2"><label>Note</label><input class="input" id="svNote" value="'+U.esc(sv?sv.note:'')+'" placeholder="Assays, equipment or responsibility"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button>'+(sv?'<button class="btn danger" data-del>'+UI.ic('trash-2',15)+'Remove</button>':'')+'<button class="btn primary" data-save>'+UI.ic('check',15)+'Save service</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#svName').value.trim();
        if(!name) return UI.toast('Service name required',{type:'warn'});
        const rec={id:sv?sv.id:U.uid('svc'),name,code:(el.querySelector('#svCode').value||'').trim().toUpperCase()||name.slice(0,3).toUpperCase(),min:Math.max(1,parseInt(el.querySelector('#svMin').value,10)||1),note:el.querySelector('#svNote').value.trim()};
        S.commit(d=>{ d.services=d.services||S.services().slice(); if(sv){ const i=d.services.findIndex(x=>x.id===sv.id); if(i>=0) d.services[i]=rec; } else d.services.push(rec); },
          {action:'roster.service.'+(sv?'edit':'add'),entity:'services',entityId:rec.id,detail:rec.name});
        close(); paint(); UI.toast('Service '+(sv?'updated':'added'),{type:'ok'});
      };
      const del=el.querySelector('[data-del]');
      if(del) del.onclick=()=>{
        S.commit(d=>{ d.services=(d.services||[]).filter(x=>x.id!==sv.id); },{action:'roster.service.remove',entity:'services',entityId:sv.id,detail:sv.name});
        close(); paint(); UI.toast('Service removed',{type:'warn'});
      };
    }});
}
function servicePicker(iso,svc){
  if(!LS.auth.guard('edit')) return;
  const start=weekStart(); const st=S.staffByName((allocationOf(start)[iso]||{})[svc]||'');
  const onDuty=S.onDuty(iso).map(d=>d.staff);
  const others=S.activeStaff().filter(s=>!onDuty.some(d=>d.id===s.id));
  const opt=(s,sel)=>'<option value="'+U.esc(s.name)+'"'+(sel&&st&&st.id===s.id?' selected':'')+'>'+U.esc(s.name)+' · '+U.esc(S.shiftState(s,iso).label)+'</option>';
  UI.modal({title:'Allocate '+svc,sub:U.fmtDate(iso)+' · '+U.DOWL[U.dow(iso)]+' · week of '+weekNavLabel(start),width:'min(520px,100%)',
    body:'<div class="field"><label>Staff member on this service</label><select class="select" id="alStaff"><option value="">— Unassigned —</option><optgroup label="On duty this day">'+onDuty.map(s=>opt(s,true)).join('')+'</optgroup><optgroup label="Off duty / leave">'+others.map(s=>opt(s,false)).join('')+'</optgroup></select></div>'
      +'<div class="hint" style="margin-top:10px">Allocating someone who is off duty or on leave is allowed but flagged in amber on the weekly roster.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Allocate</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#alStaff').value;
        S.commit(d=>{ d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
          const w=d.unitRosters[start]; w.assignments[iso]=w.assignments[iso]||{}; if(name) w.assignments[iso][svc]=name; else delete w.assignments[iso][svc]; },
          {action:'roster.allocate',entity:'unitRosters',entityId:start,detail:svc+' · '+U.fmtDate(iso)+' → '+(name||'unassigned')});
        close(); paint(); UI.toast(name?svc+' allocated to '+name:'Allocation cleared',{type:'ok'});
      };
    }});
}
/* Bench preferences: a staff member's home bench comes first, the alternative
   bench only when the bench would otherwise be empty and the monthly quota
   (e.g. two days a month in Parasitology) allows it. */
function benchPlan(){
  const out={};
  S.activeStaff().forEach(s=>{ out[s.name]={home:s.homeBench||'',alt:s.altBench||'',altMax:s.altMaxMonth==null?0:s.altMaxMonth,avoid:s.avoidBench||[]}; });
  return out;
}
function altUsedThisMonth(name, bench, monthKey){
  const db=S.db(); let n=0;
  Object.keys(db.unitRosters||{}).forEach(w=>{
    if(String(w).slice(0,7)!==monthKey) return;
    const as=db.unitRosters[w].assignments||{};
    Object.keys(as).forEach(iso=>{ if((as[iso]||{})[bench]===name) n++; });
  });
  return n;
}
function autoAllocate(){
  if(!LS.auth.guard('edit')) return;
  const start=weekStart(), dates=S.weekDates(start), svcs=S.services(), prefs=benchPlan(), mkOf=String(start).slice(0,7);
  let filled=0, skipped=0;
  S.commit(d=>{
    d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
    const w=d.unitRosters[start];
    const altTally={};
    dates.forEach(iso=>{
      const duty=S.onDuty(iso).map(x=>x.staff);
      w.assignments[iso]=w.assignments[iso]||{};
      const day=w.assignments[iso];
      const taken=Object.keys(day).map(k=>day[k]);
      svcs.forEach(sv=>{
        if(day[sv.name]) return;
        const free=duty.filter(s=>taken.indexOf(s.name)<0);
        if(!free.length) return;
        const prefsOf=s=>prefs[s.name]||{home:'',alt:'',altMax:0,avoid:[]};
        const okFor=s=>prefsOf(s).avoid.indexOf(sv.name)<0;
        // 1) home bench, 2) staff with no bench preference, 3) quota-limited alt bench
        let pick=free.find(s=>okFor(s)&&prefsOf(s).home===sv.name);
        if(!pick) pick=free.find(s=>okFor(s)&&!prefsOf(s).home&&!prefsOf(s).alt);
        if(!pick) pick=free.find(s=>{
          const p=prefsOf(s);
          if(!okFor(s)||p.alt!==sv.name) return false;
          const used=(altUsedThisMonth(s.name,sv.name,mkOf)+(altTally[s.name+'|'+sv.name]||0));
          return used<p.altMax;
        });
        if(!pick) pick=free.find(s=>prefsOf(s).home!==sv.name && okFor(s) && svcs.length>free.length);
        if(!pick){ skipped++; return; }
        const p=prefsOf(pick);
        if(p.alt===sv.name) altTally[pick.name+'|'+sv.name]=(altTally[pick.name+'|'+sv.name]||0)+1;
        day[sv.name]=pick.name; taken.push(pick.name); filled++;
      });
    });
  },{action:'roster.allocate.auto',entity:'unitRosters',entityId:start,detail:'Auto-allocation from on-duty staff and bench preferences, week of '+start});
  paint();
  UI.toast(filled+' slots allocated'+(skipped?' · '+skipped+' left open (no one free on that bench)':'')+' — bench preferences respected',{type:'ok'});
}
function printWeek(){
  SH.printSVG(SH.weeklySVG(weekData()),{title:'Weekly unit roster — week of '+U.fmtDateShort(weekStart())});
  S.audit({action:'roster.print.week',entity:'unitRosters',entityId:weekStart(),detail:'Printed weekly roster week of '+weekStart()}); S.save();
}
function paint(){ sheetSVG=null;

  const host=rootEl.querySelector('#roBody'); if(!host) return;
  host.innerHTML=view==='sheet'?sheetView():view==='grid'?gridView():view==='week'?weekView():view==='services'?servicesView():view==='fairness'?fairnessView():swapsView();
  U.$$('[data-view]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.view===view));
  wireBody();
}
function collision(p,si,fromDi,toDi){
  const s=p.staff[si]; const cap=(S.staffByName(s.name)||{}).maxConsecN||3;
  const codes=p.staff.map(st=>st.codes.slice());
  const tmp=codes[si][toDi]; codes[si][toDi]=codes[si][fromDi]; codes[si][fromDi]=tmp;
  let run=1, i=toDi-1; while(i>=0&&codes[si][i]==='N'){ run++; i--; }
  i=toDi+1; while(i<codes[si].length&&codes[si][i]==='N'){ run++; i++; }
  if(codes[si][toDi]==='N' && run>cap) return 'That would give '+s.name+' '+run+' consecutive nights (cap '+cap+').';
  const cov={};
  p.dates.forEach((iso,di)=>{ let day=0,night=0; codes.forEach(c=>{ const v=c[di]; if(v==='D'||v==='DN')day++; if(v==='N'||v==='DN')night++; }); cov[iso]={day,night}; });
  const iso=p.dates[fromDi], r=required(iso);
  if(cov[iso].day<r.day || cov[iso].night<r.night) return 'Moving this shift would leave '+U.fmtDateShort(iso)+' below minimum coverage ('+cov[iso].day+' day / '+cov[iso].night+' night).';
  return null;
}
function assign(si,di,code){
  if(!LS.auth.guard('edit')) return;
  const p=plan(); if(!p) return; const s=p.staff[si];
  S.commit(d=>{ const pl=d.workingPlans[mk].primary; pl.staff[si].codes[di]=code; pl.meta.draft=true; pl.meta.edited=U.nowISO(); },
    {action:'roster.assign',entity:'workingPlans',entityId:mk,detail:s.name+' · '+U.fmtDate(p.dates[di])+' → '+code});
  paint();
}
function shiftPicker(si,di){
  const p=plan(); if(!p) return; const s=p.staff[si]; const cur=s.codes[di];
  UI.modal({title:s.name,sub:U.fmtDateLong(U.parseISO(p.dates[di]))+' · current shift '+(cur||'—'),
    body:'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:7px">'+CODES.map(([c,l])=>'<button class="choice '+(cur===c?'on':'')+'" data-code="'+c+'"><span class="shift-code '+c+'">'+c+'</span><span class="grow"><span class="ct">'+l+'</span></span></button>').join('')+'</div>'
      +'<div class="hint" style="margin-top:12px">Assignments are validated against consecutive-night caps, leave and minimum coverage. Every change is written to the audit trail.</div>',
    foot:'<button class="btn" data-close>Close</button>',
    onMount:(el,close)=>{ el.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>{ assign(si,di,b.dataset.code); close(); UI.toast('Shift updated · coverage recalculated',{type:'ok'}); }); }});
}
function patternsModal(){
  const templates=[['D-D-D-D-D · OFF OFF','Standard 5-day'],['D-D-N-N-OFF','Two days, two nights'],['D-D-D-N-N-OFF-OFF','Three days, two nights'],['N-N-OFF-OFF','Two nights only'],['Wkend','Weekend day + night'],['AL-AL-AL-AL-AL','Leave block']];
  UI.modal({title:'Shift-pattern templates',sub:'Apply a repeating cycle to a staff member or the whole unit. Leave always wins.',width:'min(620px,100%)',
    body:'<div class="field" style="margin-bottom:12px"><label>Apply to</label><select class="select" id="patWho"><option value="__all">Entire unit</option>'+S.activeStaff().map(s=>'<option value="'+s.name+'">'+U.esc(s.name)+'</option>').join('')+'</select></div>'
      +'<div style="display:flex;flex-direction:column;gap:6px">'+templates.map(([pat,lbl],i)=>'<label class="choice"><input type="radio" name="patTpl" value="'+i+'" '+(i===0?'checked':'')+' style="accent-color:#C9A84C"><span class="grow"><span class="ct mono" style="font-size:11.5px">'+pat+'</span><span class="cs" style="display:block">'+lbl+'</span></span></label>').join('')+'</div>'
      +'<div class="hint" style="margin-top:10px">Templates only fill days that are not blocked by approved leave. Conflicts are reported before writing.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-apply>'+UI.ic('check',15)+'Apply template</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-apply]').onclick=()=>{
        if(!LS.auth.guard('edit')) return;
        const who=el.querySelector('#patWho').value; const tpl=templates[[...el.querySelectorAll('input[name=patTpl]')].findIndex(x=>x.checked)][0];
        const seq=tpl.split('-').filter(x=>!/^\s*OFF OFF$/.test(x));
        const codes=seq.length?seq:['D'];
        if(!plan()){ close(); return UI.toast('Create or import this month before applying a pattern',{type:'warn'}); }
        S.commit(d=>{
          const pl=d.workingPlans[mk].primary; if(!pl) return;
          pl.staff.forEach(s=>{ if(who!=='__all'&&s.name!==who) return;
            s.codes=s.codes.map((c,i)=>{ if(['AL','SICK','TR'].includes(c)) return c; return codes[i%codes.length]; });
          });
          pl.meta.generated=false; pl.meta.pattern=tpl;
        },{action:'roster.pattern',entity:'workingPlans',entityId:mk,detail:'Applied pattern '+tpl+' to '+(who==='__all'?'entire unit':who)});
        close(); UI.toast('Pattern applied · review coverage',{type:'ok'}); paint();
      };
    }});
}
function swapModal(){
  const p=plan(); if(!p) return UI.toast('No working plan for this month — create one first',{type:'warn'});
  UI.modal({title:'Request a shift swap',sub:'Sent to the Laboratory Manager for approval.',
    body:'<div class="form-grid"><div class="field"><label>From staff</label><select class="select" id="swFrom">'+p.staff.map(s=>'<option>'+U.esc(s.name)+'</option>').join('')+'</select></div>'
     +'<div class="field"><label>To staff</label><select class="select" id="swTo">'+p.staff.slice().reverse().map(s=>'<option>'+U.esc(s.name)+'</option>').join('')+'</select></div>'
     +'<div class="field span2"><label>Shift date</label><select class="select" id="swDate">'+p.dates.filter(d=>d>=U.todayISO()).slice(0,21).map(d=>'<option value="'+d+'">'+U.fmtDate(d)+' · '+U.DOWL[U.dow(d)]+'</option>').join('')+'</select></div>'
     +'<div class="field span2"><label>Reason</label><textarea class="textarea" id="swReason" placeholder="Clinical cover, family, training…"></textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-send>'+UI.ic('send',15)+'Submit request</button>',
    onMount:(el,close)=>{ el.querySelector('[data-send]').onclick=()=>{
      const from=el.querySelector('#swFrom').value,to=el.querySelector('#swTo').value,date=el.querySelector('#swDate').value;
      S.commit(d=>{ d.swaps=d.swaps||[]; d.swaps.unshift({id:U.uid('sw'),from,to,date,by:LS.auth.user.name,at:U.nowISO(),status:'Pending',reason:el.querySelector('#swReason').value}); },
        {action:'roster.swap.request',entity:'workingPlans',detail:from+' ↔ '+to+' · '+date});
      close(); view='swaps'; paint(); UI.toast('Swap request submitted for approval',{type:'ok'});
    }; }});
}

/* ——— Official sheet: preview and export (PNG · PDF · XLSX) ————————— */
function monthSheetPlan(){
  const p=plan();
  if(p) return p;
  // No stored plan: render the empty sheet honestly rather than inventing shifts.
  const key=mk||U.monthKey();
  return {label:U.monthLabel(key),dates:U.monthRange(key),staff:S.activeStaff().map(s=>({name:s.name,id:s.id,codes:[]})),
    meta:{period:U.monthLabel(key),date:U.todayISO(),fy:U.fyLabel(),official:false,draft:true}};
}
function monthSheetName(){
  const p=plan();
  const key=(p&&p.meta&&p.meta.period)?p.meta.period:(mk||U.monthKey());
  return 'working-plan-'+(key||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
function openMonthSheet(){
  const p=plan();
  const svg=SH.monthlySVG(monthSheetPlan());
  const filename=monthSheetName();
  UI.modal({title:'Working plan sheet — '+(p?(p.meta&&p.meta.period)||p.label:'no plan stored'),sub:'Exactly what PNG, PDF, XLSX and print produce — one A4 landscape page.',width:'min(1180px,96vw)',
    body:'<div style="border:1px solid var(--border);border-radius:10px;overflow:auto;background:#fff;max-height:60vh">'+fitSVG(svg)+'</div>'
      +(p?'':'<div class="hint" style="margin-top:8px">This month has no stored plan, so the sheet shows the staff register with empty days. Create or import a plan first if you need it signed.</div>'),
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-export-png>'+UI.ic('image',15)+' PNG</button>'
      +'<button class="btn" data-export-pdf>'+UI.ic('file-text',15)+' PDF</button>'
      +'<button class="btn" data-export-xlsx>'+UI.ic('table-2',15)+' XLSX</button>'
      +'<button class="btn primary" data-export-print>'+UI.ic('printer',15)+' Print</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-export-png]').onclick=()=>{ close(); exportSheet('png',svg,filename); };
      el.querySelector('[data-export-pdf]').onclick=()=>{ close(); exportSheet('pdf',svg,filename); };
      el.querySelector('[data-export-xlsx]').onclick=()=>{ close(); exportSheet('xlsx',svg,filename); };
      el.querySelector('[data-export-print]').onclick=()=>{ close(); SH.printSVG(svg,{title:'Working plan — '+monthSheetName()}); };
    }});
}
async function exportSheet(fmt,svg,filename){
  try{
    if(fmt==='print'){ SH.printSVG(svg,{title:filename}); return; }
    UI.toast('Preparing '+fmt.toUpperCase()+'…',{type:'info',duration:1500});
    let blob,name=filename+'.'+fmt;
    if(fmt==='png') blob=await SH.toPNG(svg,2);
    else if(fmt==='pdf') blob=await SH.toPDF(svg,{scale:3});
    else blob=SH.monthlyXLSX(monthSheetPlan());
    U.download(name,blob);
    UI.toast(name+' saved',{type:'ok'});
    S.audit({action:'roster.export.'+fmt,entity:'workingPlans',entityId:mk,detail:'Working plan exported as '+fmt.toUpperCase()});
    S.save();
  }catch(e){ UI.toast('Export failed · '+(e&&e.message||e),{type:'err',duration:7000}); }
}
function openWeekSheet(){
  const start=weekStart(), dates=S.weekDates(start), svcs=S.services(), alloc=allocationOf(start);
  const night={}; dates.forEach(iso=>{ const n=S.unitNight(start,iso)||onDutyName(iso); if(n) night[iso]=n; });
  const data={weekStart:start,dates,services:svcs,alloc,night};
  const svg=SH.weeklySVG(data);
  const filename='unit-roster-'+start;
  UI.modal({title:'Weekly unit roster — week of '+U.fmtDateShort(start),sub:'Allocated units, weekend shading and the night shift row, on one A4 landscape page.',width:'min(1180px,96vw)',
    body:'<div style="border:1px solid var(--border);border-radius:10px;overflow:auto;background:#fff;max-height:60vh">'+svg+'</div>'
      +'<div class="hint" style="margin-top:8px">Night shift names come from this week\'s allocation; where none is set, the person on the night code in the working plan is used.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-wpng>'+UI.ic('image',15)+' PNG</button>'
      +'<button class="btn" data-wpdf>'+UI.ic('file-text',15)+' PDF</button>'
      +'<button class="btn" data-wxlsx>'+UI.ic('table-2',15)+' XLSX</button>'
      +'<button class="btn primary" data-wprint>'+UI.ic('printer',15)+' Print</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-wpng]').onclick=()=>{ close(); exportWeek('png',svg,filename,data); };
      el.querySelector('[data-wpdf]').onclick=()=>{ close(); exportWeek('pdf',svg,filename); };
      el.querySelector('[data-wxlsx]').onclick=()=>{ close(); exportWeek('xlsx',svg,filename,data); };
      el.querySelector('[data-wprint]').onclick=()=>{ close(); SH.printSVG(svg,{title:'Weekly unit roster'}); };
    }});
}
async function exportWeek(fmt,svg,filename,data){
  try{
    UI.toast('Preparing '+fmt.toUpperCase()+'…',{type:'info',duration:1500});
    let blob,name=filename+'.'+fmt;
    if(fmt==='png') blob=await SH.toPNG(svg,2);
    else if(fmt==='pdf') blob=await SH.toPDF(svg,{scale:3});
    else blob=SH.weeklyXLSX(data||weekData());
    U.download(name,blob); UI.toast(name+' saved',{type:'ok'});
    S.audit({action:'roster.export.'+fmt,entity:'unitRosters',entityId:weekStart(),detail:'Weekly roster exported as '+fmt.toUpperCase()}); S.save();
  }catch(e){ UI.toast('Export failed · '+(e&&e.message||e),{type:'err',duration:7000}); }
}
function weekData(){
  const start=weekStart(), dates=S.weekDates(start), alloc=allocationOf(start), night={};
  dates.forEach(iso=>{ const n=S.unitNight(start,iso)||onDutyName(iso); if(n) night[iso]=n; });
  return {weekStart:start,dates,services:S.services(),alloc,night};
}
function onDutyName(iso){
  const p=planForDate(iso);
  const row=p&&p.staff?p.staff.find(s=>(s.codes||[])[p.dates.indexOf(iso)]==='N'):null;
  if(row) return row.name;
  return '';
}
function planForDate(iso){
  const e=S.db().workingPlans[String(iso).slice(0,7)];
  return e&&e.primary?e.primary:null;
}
function printRoster(){
  const p=plan();
  if(!p) return UI.toast('Nothing to print — this month has no working plan',{type:'warn'});
  SH.printSVG(SH.monthlySVG(p),{title:'Working plan — '+(p.meta&&p.meta.period||p.label||'')});
  S.audit({action:'roster.print',entity:'workingPlans',entityId:mk,detail:'Printed roster '+p.label}); S.save();
}
async function generateMonth(){
  if(!LS.auth.guard('edit')) return;
  const key=mk, existing=plan();
  const official=!!(existing&&existing.meta&&existing.meta.official);
  const ok=await UI.confirm({
    title:official?'Archive and regenerate '+U.monthLabel(key)+'?':'Generate a draft plan for '+U.monthLabel(key)+'?',
    body:official
      ? 'This month holds an official plan ('+(existing.meta.label||'published')+'). Generating a draft replaces the grid in force; the current version is archived under plan versions and can be restored. Screens and print-outs will show the new draft as unsigned until you publish it.'
      : existing?'The current grid is archived first, then rebuilt from staff patterns and approved leave. Every cell stays editable.'
        :'Built from staff patterns and approved leave. Nothing is published until you review and edit it.',
    confirm:official?'Archive & regenerate':'Generate draft'});
  if(!ok) return;
  S.commit(d=>{
    d.workingPlans[key]=d.workingPlans[key]||{versions:[]};
    const cur=d.workingPlans[key].primary;
    if(cur){ d.workingPlans[key].versions=(d.workingPlans[key].versions||[]).concat([cur]); }
    d.workingPlans[key].primary=S.buildPlan(key);
  },{action:official?'roster.regenerate.official':'roster.generate',entity:'workingPlans',entityId:key,detail:(official?'Archived official plan and generated draft for ':'Draft generated for ')+U.monthLabel(key)});
  paint(); UI.toast('Draft generated · '+(plan()?plan().staff.length:0)+' staff · previous version archived',{type:'ok'});
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ view=b.dataset.view; paint(); });
  r.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    const d=+b.dataset.nav;
    if(d===0){ mk=U.monthKey(); } else { const [y,m]=mk.split('-').map(Number); const dt=new Date(y,m-1+d,1); mk=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); }
    paint();
  });
  r.querySelectorAll('[data-generate]').forEach(b=>b.onclick=generateMonth);
  r.querySelectorAll('[data-empty-generate]').forEach(b=>b.onclick=generateMonth);
  r.querySelectorAll('[data-open-month]').forEach(b=>b.onclick=()=>{ mk=b.dataset.openMonth; paint(); });
  r.querySelectorAll('[data-empty-blank]').forEach(b=>b.onclick=()=>{
    S.commit(d=>{ const key=mk; const days=U.monthRange(key);
      d.workingPlans[key]=d.workingPlans[key]||{versions:[]};
      const prev=d.workingPlans[key].primary; if(prev){ d.workingPlans[key].versions=(d.workingPlans[key].versions||[]).concat([prev]); }
      d.workingPlans[key].primary={label:U.monthLabel(key),dates:days,staff:S.activeStaff().map(s=>({name:s.name,id:s.id,codes:days.map(()=>'')})),
        meta:{date:U.todayISO(),fy:U.fyLabel(),period:U.monthLabel(key),generated:false,draft:true,blank:true}};
    },{action:'roster.blank',entity:'workingPlans',entityId:mk,detail:'Blank month created for '+U.monthLabel(mk)});
    paint(); UI.toast('Blank month created · click any cell to assign shifts',{type:'ok'});
  });
  r.querySelectorAll('[data-wknav]').forEach(b=>b.onclick=()=>{ const d=+b.dataset.wknav; if(d===0){ wk=S.weekStart(U.todayISO()); paint(); } else shiftWeek(d); });
  r.querySelectorAll('[data-wcell]').forEach(td=>td.onclick=()=>{ const [iso,svc]=td.dataset.wcell.split('|'); servicePicker(iso,svc); });
  r.querySelectorAll('[data-auto-week]').forEach(b=>b.onclick=autoAllocate);
  r.querySelectorAll('[data-print-week]').forEach(b=>b.onclick=printWeek);
  r.querySelectorAll('[data-week-sheet]').forEach(b=>b.onclick=openWeekSheet);
  const wkSvg=function(){ const start=weekStart(), dates=S.weekDates(start), svcs=S.services(), alloc=allocationOf(start), night={};
    dates.forEach(iso=>{ const n=S.unitNight(start,iso)||onDutyName(iso); if(n) night[iso]=n; });
    return {start,dates,data:{weekStart:start,dates,services:svcs,alloc,night},svg:SH.weeklySVG({weekStart:start,dates,services:svcs,alloc,night})}; };
  r.querySelectorAll('[data-week-png]').forEach(b=>b.onclick=()=>{ const o=wkSvg(); exportWeek('png',o.svg,'unit-roster-'+o.start,o.data); });
  r.querySelectorAll('[data-week-pdf]').forEach(b=>b.onclick=()=>{ const o=wkSvg(); exportWeek('pdf',o.svg,'unit-roster-'+o.start,o.data); });
  r.querySelectorAll('[data-week-xlsx]').forEach(b=>b.onclick=()=>{ const o=wkSvg(); exportWeek('xlsx',o.svg,'unit-roster-'+o.start,o.data); });
  if(view==='sheet'){
    const host=r.querySelector('#sheetHost');
    const fn=monthSheetName();
    const getSVG=()=>{
      if(sheetSVG) return sheetSVG;
      try{ sheetSVG=SH.monthlySVG(monthSheetPlan()); sheetFailed=false; return sheetSVG; }
      catch(e){ sheetFailed=true; return null; }
    };
    setTimeout(()=>{
      const svg=getSVG(), el=rootEl&&rootEl.querySelector('#sheetHost');
      if(!el) return;
      if(svg) el.innerHTML=fitSVG(svg);
      else el.innerHTML='<div style="padding:22px;text-align:center"><b>This sheet could not be drawn.</b>'
        +'<div class="xs faint" style="margin-top:6px">The roster data is intact — switch to the grid, then come back, or try the PNG export.</div></div>';
    },16);
    const go=(fnName)=>()=>{ const svg=getSVG(); if(!svg){ UI.toast('Sheet could not be drawn — the plan data is intact',{type:'err'}); return; } fnName(svg); };
    r.querySelectorAll('[data-sheet-png]').forEach(b=>b.onclick=go(svg=>exportSheet('png',svg,fn)));
    r.querySelectorAll('[data-sheet-pdf]').forEach(b=>b.onclick=go(svg=>exportSheet('pdf',svg,fn)));
    r.querySelectorAll('[data-sheet-xlsx]').forEach(b=>b.onclick=()=>exportSheet('xlsx',getSVG(),fn));
    r.querySelectorAll('[data-sheet-print]').forEach(b=>b.onclick=go(svg=>SH.printSVG(svg,{title:'Working plan — '+fn})));
  }
  r.querySelectorAll('[data-manage-services]').forEach(b=>b.onclick=()=>{ view='services'; paint(); });
  r.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>{ view=b.dataset.viewJump; paint(); });
  r.querySelectorAll('[data-add-svc]').forEach(b=>b.onclick=()=>serviceModal(null));
  r.querySelectorAll('[data-edit-svc]').forEach(b=>b.onclick=()=>serviceModal(b.dataset.editSvc));
  r.querySelectorAll('[data-patterns]').forEach(b=>b.onclick=patternsModal);
  r.querySelectorAll('[data-print]').forEach(b=>b.onclick=printRoster);
  r.querySelectorAll('[data-sheet]').forEach(b=>b.onclick=openMonthSheet);
  r.querySelectorAll('[data-new-swap]').forEach(b=>b.onclick=swapModal);
  r.querySelectorAll('[data-swap-approve]').forEach(b=>b.onclick=()=>{ if(!LS.auth.guard('approve'))return; S.commit(d=>{ const sw=(d.swaps||[]).find(x=>x.id===b.dataset.swapApprove); if(sw){ sw.status='Approved'; sw.approvedBy=LS.auth.user.name; sw.approvedAt=U.nowISO(); } },{action:'roster.swap.approve',entity:'workingPlans',detail:'Swap approved: '+b.dataset.swapApprove}); paint(); UI.toast('Swap approved · roster updated',{type:'ok'}); });
  r.querySelectorAll('[data-swap-decline]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ const sw=(d.swaps||[]).find(x=>x.id===b.dataset.swapDecline); if(sw) sw.status='Declined'; },{action:'roster.swap.decline',entity:'workingPlans',detail:'Swap declined'}); paint(); UI.toast('Swap declined',{type:'warn'}); });
  // grid interactions
  if(view==='grid'){
    r.querySelectorAll('[data-cell]').forEach(td=>{
      td.addEventListener('click',()=>{ if(suppressClick){ suppressClick=false; return; } shiftPicker(+td.dataset.si,+td.dataset.di); });
      td.addEventListener('dragstart',e=>{ drag={si:+td.dataset.si,di:+td.dataset.di}; e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',td.dataset.cell); });
      td.addEventListener('dragover',e=>{ e.preventDefault(); td.classList.add('drag-over'); });
      td.addEventListener('dragleave',()=>td.classList.remove('drag-over'));
      td.addEventListener('drop',e=>{
        e.preventDefault(); td.classList.remove('drag-over');
        if(!drag) return;
        const si=+td.dataset.si, di=+td.dataset.di;
        if(si!==drag.si){ UI.toast('Shifts swap within one staff member’s row — use Swap requests for cross-staff trades.',{type:'warn'}); drag=null; return; }
        if(di===drag.di){ drag=null; return; }
        const p=plan(); if(!p){ drag=null; return; } const err=collision(p,si,drag.di,di);
        if(err){ UI.toast(err,{type:'warn',duration:6200}); drag=null; return; }
        const a=p.staff[si].codes[drag.di], b=p.staff[si].codes[di];
        S.commit(d=>{ const pl=d.workingPlans[mk].primary; pl.staff[si].codes[drag.di]=b; pl.staff[si].codes[di]=a; pl.meta.draft=true; },{action:'roster.drag',entity:'workingPlans',entityId:mk,detail:p.staff[si].name+' · '+p.dates[di]+' ⇄ '+p.dates[drag.di]});
        drag=null; suppressClick=true; paint(); UI.toast('Shift moved · coverage recalculated',{type:'ok'});
      });
    });
  }
  if(view==='fairness'){
    const p=plan(); if(!p) return; const f=fairness(p);
    C.hbars(r.querySelector('#fairNights'),{items:Object.keys(f).map(n=>({label:n.split(' ')[0],value:f[n].nights,tone:'blue'})).sort((a,b)=>b.value-a.value)});
    C.hbars(r.querySelector('#fairWeekend'),{items:Object.keys(f).map(n=>({label:n.split(' ')[0],value:f[n].weekends,tone:'gold'})).sort((a,b)=>b.value-a.value)});
  }
}
M.render=function(root,params){
  rootEl=root; view=params.tab||'grid'; mk=params.month||U.monthKey();
  root.innerHTML=header()+'<div id="roBody"></div>';
  paint();
};
M.staffDrawer=function(s){
  const last=(S.db().trainings.filter(t=>(t.attendees||[]).includes(s.id))).sort((a,b)=>String(b.start).localeCompare(String(a.start)))[0];
  return '<div class="row" style="gap:12px;margin-bottom:14px">'+U.avatar(s.name,'lg')+'<div><div class="strong">'+U.esc(s.name)+'</div><div class="xs faint">'+U.esc(s.role)+' · joined '+U.fmtDate(s.joinDate)+'</div></div></div>'
   +'<div class="split-2">'+[['Contract',s.contract],['Pattern',s.pattern],['Max nights',s.maxNights],['Consecutive nights',s.maxConsecN],['Phone',s.phone],['Email',s.email]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11px">'+U.esc(v==null?'—':v)+'</span></div>').join('')+'</div>'
   +'<div class="hint" style="margin-top:12px">'+U.esc(s.note||'')+'</div>'
   +'<div class="section-head"><h2>Last training</h2></div><p class="small muted">'+(last?U.esc(last.title)+' · '+U.fmtDate(last.start):'No training recorded')+'</p>';
};
})();
