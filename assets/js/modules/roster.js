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
  const wRec=(S.db().unitRosters||{})[start]||{};
  const overrides=wRec.overrides||{};
  const orientMap=wRec.orientation||{};
  const ctxOf=iso=>dutyContext(iso);
  const statusOf=(iso,name)=>{ const st=S.staffByName(name); return st?S.shiftState(st,iso):null; };
  const unstaffed=dates.reduce((a,iso)=>a+svcs.filter(sv=>!cellStaff(iso,sv.name)).length,0);
  const conflicts=[], breaches=[];
  dates.forEach(iso=>svcs.forEach(sv=>{ const n=cellStaff(iso,sv.name); if(!n) return; const st=statusOf(iso,n);
    if(st && (st.kind==='off'||st.kind==='leave'||st.kind==='exited')) conflicts.push({iso,svc:sv.name,staff:n,state:st});
    /* a hard block, or the reserve on a busy plan, without a recorded override
       is a rule breach — not a preference */
    const ctx=ctxOf(iso), ov=!!((overrides[iso]||{})[sv.name]);
    if(ctx.nightOnly.some(x=>x.name===n)) breaches.push({iso,svc:sv.name,staff:n,why:n+' is on nights that day — a night is a whole shift, not a day post'});
    let g=gate(ctx.rules[n],sv.name,{alone:ctx.alone,override:ov});
    if(g.ok&&!ov){
      const r=ctx.rules[n];
      if(r&&r.reserve&&!reserveAllowed(r,ctx.planCount))
        g={ok:false,why:r.name+' is reserve cover — the plan carries '+ctx.planCount+' staff (limit '+r.reserveMax+')'};
    }
    if(!g.ok) breaches.push({iso,svc:sv.name,staff:n,why:g.why});
  }));
  const head='<thead><tr><th class="staff-cell" style="z-index:4">Service</th>'+dates.map(iso=>{
    const dow=U.dow(iso), today=iso===U.todayISO();
    return '<th class="'+(dow>=5?'wkend':'')+'" style="'+(today?'color:var(--gold)':'')+'">'+U.DOWL[dow]+'<div style="font-family:var(--font-mono);font-size:10.5px;color:'+(today?'var(--gold)':'var(--text-muted)')+'">'+U.parseISO(iso).getDate()+'</div></th>';
  }).join('')+'</tr></thead>';
  const body=svcs.map(sv=>'<tr><td class="staff-cell"><div class="nm">'+U.esc(sv.name)+'</div><div class="rl mono">'+U.esc(sv.code)+' · min '+sv.min+'</div></td>'
    +dates.map(iso=>{
      const name=cellStaff(iso,sv.name); const st=name?statusOf(iso,name):null;
      const danger=st&&(st.kind==='off'||st.kind==='leave'||st.kind==='exited');
      /* The shift code belongs on the working plan, not repeated in every service
         cell. Here a name is all the roster needs; a conflict is shown by colour. */
      const ov=(overrides[iso]||{})[sv.name];
      const ctx=ctxOf(iso);
      let g=name?gate(ctx.rules[name],sv.name,{alone:ctx.alone,override:!!ov}):{ok:true};
      if(g.ok&&name&&!ov){
        const r=ctx.rules[name];
        if(r&&r.reserve&&!reserveAllowed(r,ctx.planCount))
          g={ok:false,why:r.name+' is reserve cover — the plan carries '+ctx.planCount+' staff (limit '+r.reserveMax+')'};
      }
      const breach=!!name&&!g.ok;
      const tip=danger?st.label+' — not on duty that day':breach?g.why:ov?('Override by '+(ov.by||'manager')+' · '+(ov.rule||ov.why||'')):'';
      return '<td class="day '+(U.dow(iso)>=5?'wkend':'')+' '+(iso===U.todayISO()?'today':'')+'" data-wcell="'+iso+'|'+U.esc(sv.name)+'" style="cursor:pointer;min-width:104px"'+(tip?' data-tip="'+U.esc(tip)+'"':'')+'>'
        +(name?'<span class="small'+(danger||breach?' warn-name':'')+'" style="display:block;line-height:1.3">'+U.esc(name.split(' ')[0])+' <span class="xs faint">'+U.esc(name.split(' ').slice(1).join(' '))+'</span></span>'
          :'<span class="xs faint">—</span>')
        +(()=>{ const covers=name?Object.keys(alloc[iso]||{}).filter(b=>alloc[iso][b]===name).length:0;
                return covers>1?'<span class="xs mono" style="display:block;font-size:8.5px;color:var(--text-faint)">'+covers+' benches</span>':''; })()
        +(()=>{ const o=(orientMap[iso]||{})[name];
                return o?'<span class="pill blue" style="font-size:8.5px;padding:1px 5px;margin-top:2px">W'+o.week+'</span>':''; })()
        +(ov?'<span class="pill amber" style="font-size:8.5px;padding:1px 5px;margin-top:2px">override</span>':'')
        +(breach?'<span class="pill rose" style="font-size:8.5px;padding:1px 5px;margin-top:2px">rule</span>':'')
        +'</td>';
    }).join('')+'</tr>').join('');
  const load={};
  dates.forEach(iso=>svcs.forEach(sv=>{ const n=cellStaff(iso,sv.name); if(n) load[n]=(load[n]||0)+1; }));
  const maxLoad=Math.max.apply(null,Object.values(load).concat([1]));
  return '<div class="row between wrap gap-sm" style="margin-bottom:10px">'
    +'<div class="seg"><button data-wknav="-1" aria-label="Previous week">'+UI.ic('chevron-left',14)+'</button><button data-wknav="0" style="font-family:var(--font-mono);font-size:11px;min-width:150px">'+U.esc(weekNavLabel(start))+'</button><button data-wknav="1" aria-label="Next week">'+UI.ic('chevron-right',14)+'</button></div>'
    +'<div class="row gap-sm"><span class="pill '+(conflicts.length?'amber':'teal')+'">'+conflicts.length+' allocation conflict'+(conflicts.length===1?'':'s')+'</span>'
    +'<span class="pill '+(breaches.length?'rose':'teal')+'">'+breaches.length+' rule '+(breaches.length===1?'breach':'breaches')+'</span>'
    +'<span class="pill '+(unstaffed?'rose':'teal')+'">'+unstaffed+' empty slots</span>'
    +'<button class="btn sm" data-auto-week>'+UI.ic('wand-sparkles',13)+' Auto-allocate</button>'
    +'<button class="btn sm" data-auto-nights>'+UI.ic('moon',13)+' Auto nights</button>'
    +'<button class="btn sm" data-print-week>'+UI.ic('printer',13)+' Print week</button>'
    +'<button class="btn sm" data-week-png>'+UI.ic('image',13)+' PNG</button>'
    +'<button class="btn sm" data-week-pdf>'+UI.ic('file-text',13)+' PDF</button>'
    +'<button class="btn sm" data-week-xlsx>'+UI.ic('table-2',13)+' XLSX</button>'
    +'<button class="btn sm primary" data-week-sheet>'+UI.ic('file-down',13)+' Sheet</button></div></div>'
    +'<div class="grid-12"><div class="c9"><div class="card table-card"><div class="dt-scroll" style="max-height:none"><table class="cal"><thead>'+head.slice(7)+'<tbody>'+body+'</tbody>'
    +'<tfoot><tr class="night-row"><td class="staff-cell"><div class="nm">Night</div><div class="rl">17:00–08:00</div></td>'
    +dates.map(iso=>{ const n=S.nightCover(iso); const nm=n.name||'';
        const tag=n.source==='manual'?'<span class="pill amber" style="font-size:8.5px;padding:1px 5px;margin-top:2px">by hand</span>'
          :n.source==='plan'?'<span class="pill teal" style="font-size:8.5px;padding:1px 5px;margin-top:2px">plan</span>'
          :n.source==='pattern'?'<span class="pill slate" style="font-size:8.5px;padding:1px 5px;margin-top:2px">pattern</span>':'';
        return '<td class="day '+(U.dow(iso)>=5?'wkend':'')+'" data-night="'+iso+'" style="cursor:pointer"'+(nm?' data-tip="'+U.esc(nm+' · '+(n.source==='plan'?'from the working plan':'set '+n.source))+'"':'')+'>'
          +(nm?'<span class="small" style="display:block;line-height:1.3">'+U.esc(String(nm).split(' ')[0])+' <span class="xs faint">'+U.esc(String(nm).split(' ').slice(1).join(' '))+'</span></span>':'<span class="xs faint">—</span>')+tag+'</td>'; }).join('')
    +'</tr></tfoot></table></div>'
    +'<div class="card-foot"><span>Click any cell to allocate a staff member · '+svcs.length+' services · '+(p?'shift codes from '+U.monthLabel(mk):'no working plan for this month')+'</span><span class="mono">'+dates.length+' days</span></div></div></div>'
    +'<div class="c3"><div class="col" style="gap:14px">'
      +UI.card({title:'Weekly allocation',sub:'Services covered per staff member',icon:'users',body:Object.keys(load).length?Object.keys(load).sort((a,b)=>load[b]-load[a]).map(n=>'<div style="margin-bottom:8px"><div class="row between"><span class="xs truncate">'+U.esc(n)+'</span><span class="mono xs faint">'+load[n]+'</span></div>'+UI.meter(load[n]/maxLoad*100,'teal')+'</div>').join(''):'<p class="xs faint">No allocations this week.</p>'})
      +postsCard()
      +orientationCard()
      +benchRulesCard()
      +UI.card({title:'Services in this laboratory',sub:'Derived from the service register',icon:'flask-conical',body:svcs.map(sv=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(sv.name)+'</div><div class="lr-sub">'+U.esc(sv.code)+' · min '+sv.min+' staff</div></div><span class="pill '+(svcs.length?'slate':'rose')+'">'+U.esc(sv.note||'').slice(0,18)+'</span></div>').join('')+'<div style="margin-top:8px"><button class="btn xs" data-manage-services>'+UI.ic('settings-2',12)+'Manage services</button></div>'})
    +'</div></div></div>';
}
/* The rules are data, so they are shown as data — and can be corrected without a
   code change. Each line is one person's contract: home bench, what they never do,
   what they do only when alone, and the reserve threshold. */
function ruleLine(r){
  const bits=[];
  if(r.home) bits.push('home '+r.home);
  if(r.alt) bits.push('alt '+r.alt+(r.altMax?' · '+r.altMax+'/mo':''));
  if(r.never.length) bits.push('never '+r.never.join(', '));
  if(r.solo.length) bits.push('alone only '+r.solo.join(', '));
  if(r.reserve) bits.push('reserve ≤ '+r.reserveMax+' on the plan');
  return bits.length?bits.join(' · '):'no bench contract — fills any open bench';
}
/* What the unit is staffed by today, and who holds each post. This is the view that
   makes the shift logic checkable: change the post model and this card moves. */
function postsCard(){
  const iso=U.todayISO();
  const {core,alone}=dutyContext(iso);
  const n=core.length;
  const groups=postGroupsFor(n);
  const w=(S.db().unitRosters||{})[weekStart()]||{};
  const alloc=(w.assignments||{})[iso]||{};
  const holder=post=>{
    const names=U.uniq(post.services.map(b=>alloc[b]).filter(Boolean));
    return names.length?names.join(' · '):'';
  };
  const rows=groups.map(post=>{
    const who=holder(post);
    return '<div class="list-row" style="padding:6px 0"><div class="lr-main">'
      +'<div class="lr-title" style="font-size:11.2px">'+U.esc(post.label)+'</div>'
      +'<div class="lr-sub">'+post.services.length+' bench'+(post.services.length===1?'':'es')+(post.reservePost?' · manager':'')+'</div></div>'
      +(who?'<span class="pill teal">'+U.esc(who.split(' ')[0])+'</span>':'<span class="pill '+(post.reservePost?'gold':'rose')+'">open</span>')
      +'</div>';
  }).join('');
  return UI.card({title:'Posting today',sub:postModeLabel(n),icon:'layout-grid',
    tools:'<button class="btn xs" data-post-model>'+UI.ic('settings-2',12)+'Model</button>',
    body:rows
      +'<div class="hint" style="margin-top:8px">'+(n<=postModel().reserveMax
        ? 'Two or fewer on duty: you take <b>Biochemistry + Serology</b>, the two on the plan take the other posts.'
        : 'You are not on a post today — the plan carries '+n+' staff, more than your reserve threshold of '+postModel().reserveMax+'.')
      +'</div>'});
}
/* New technologists: where the thirty-day rotation has them today, and when they
   sit the end-of-orientation assessment. */
function orientationCard(){
  const rows=S.activeStaff().map(st=>({st, plan:S.orientationPlan(st, U.todayISO())})).filter(x=>x.plan);
  if(!rows.length) return '';
  return UI.card({title:'Orientation',sub:'First thirty days · four-week bench rotation',icon:'graduation-cap',
    body:rows.map(({st,plan})=>{
      const exam=plan.exam?U.fmtDate(plan.exam):'to be set';
      const bench=plan.benches.length?plan.benches.join(' + '):'full staff rotation';
      return '<div class="list-row" style="padding:7px 0"><div class="lr-main">'
        +'<div class="lr-title" style="font-size:11.4px">'+U.esc(st.name)+'</div>'
        +'<div class="lr-sub">Week '+plan.week+' · '+U.esc(bench)+' · day '+plan.dayNo+' of 30</div>'
        +'<div class="lr-sub" style="color:var(--text-faint)">Assessment '+U.esc(exam)+'</div></div>'
        +'<span class="pill '+(plan.week===4?'gold':'blue')+'">W'+plan.week+'</span></div>';
    }).join('')
    +'<div class="hint" style="margin-top:8px">W1 phlebotomy then reception · W2 haematology, parasitology, TB · W3 biochemistry, serology · W4 full staff, assessed on the Wednesday (or Thursday) before day 30.</div>'});
}
function postModelModal(){
  if(!LS.auth.guard('edit')) return;
  const m=postModel();
  const field=(id,label,val,min,max)=>'<div class="field"><label>'+label+'</label><input class="input" id="'+id+'" type="number" min="'+min+'" max="'+max+'" value="'+val+'"></div>';
  UI.modal({title:'Post model',sub:'How the unit splits its work as staff get scarce.',width:'min(560px,100%)',
    body:'<div class="form-grid">'
      +field('pmSplit','Phlebotomy and haematology split at',m.splitManyAt,2,20)
      +field('pmBioSer','Biochemistry + serology merge below',m.mergeBioSerBelow,2,20)
      +field('pmRec','Reception joins parasitology + TB below',m.mergeReceptionBelow,1,20)
      +'</div>'
      +'<div class="hint" style="margin-top:12px">Counts are people on day duty, <b>never including you</b>. At two or fewer the Biochemistry + Serology post is yours. Defaults: split at 6, merge biochemistry + serology below 5, merge reception below 4.</div>'
      +'<div class="hint" style="margin-top:8px">A post is one person covering every bench in it: five on duty sit on Reception · Phlebotomy + Haematology · Biochemistry · Serology · Parasitology + TB.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-pm-save>'+UI.ic('check',15)+'Save model</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-pm-save]').onclick=()=>{
        const num=(id,d)=>{ const v=+el.querySelector('#'+id).value; return isFinite(v)&&v>=0?v:d; };
        S.commit(d=>{
          d.settings=d.settings||{};
          d.settings.rosterModel={splitManyAt:num('pmSplit',6), mergeBioSerBelow:num('pmBioSer',5), mergeReceptionBelow:num('pmRec',4)};
        },{action:'roster.postmodel',entity:'settings',detail:'Post model updated'});
        close(); paint(); UI.toast('Post model saved · auto-allocate follows it',{type:'ok'});
      };
    }});
}
function benchRulesCard(){
  const rules=benchPlan();
  const names=Object.keys(rules);
  return UI.card({title:'Bench rules',sub:'Enforced by Auto-allocate — never, alone-only, and the reserve threshold',icon:'shield-check',
    body:names.map(n=>{
      const r=rules[n];
      const tone=r.never.length?'rose':r.reserve?'gold':r.solo.length?'amber':'teal';
      return '<div class="list-row" data-bench-rules="'+U.esc(n)+'" style="cursor:pointer"><div class="lr-main">'
        +'<div class="lr-title" style="font-size:11.4px">'+U.esc(n)+'</div>'
        +'<div class="lr-sub">'+U.esc(ruleLine(r))+'</div></div>'
        +'<span class="pill '+tone+'">'+UI.ic('pencil',10)+'</span></div>';
    }).join('')
    +'<div class="hint" style="margin-top:8px">Biochemistry and Serology are the scarcity pair: on a day with fewer staff than benches, one person covers both rather than leaving one empty.</div>'});
}
function benchRulesModal(name){
  if(!LS.auth.guard('edit')) return;
  const st=S.staffByName(name); if(!st) return;
  const r=rulesOf(name);
  const svcs=S.services().map(sv=>sv.name);
  const sel=(cur,id)=>'<select class="select" id="'+id+'"><option value="">— none —</option>'+svcs.map(b=>'<option'+(b===cur?' selected':'')+'>'+U.esc(b)+'</option>').join('')+'</select>';
  const checks=(list,id)=>'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px">'+svcs.map(b=>
    '<label class="row gap-sm" style="cursor:pointer"><input type="checkbox" data-'+id+'="'+U.esc(b)+'"'+(list.indexOf(b)>=0?' checked':'')+' style="accent-color:var(--gold)"><span class="small">'+U.esc(b)+'</span></label>').join('')+'</div>';
  UI.modal({title:'Bench rules · '+name,sub:'What the allocator may and may not do for this person.',width:'min(640px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Home bench</label>'+sel(r.home,'brHome')+'</div>'
      +'<div class="field"><label>Alternative bench</label>'+sel(r.alt,'brAlt')+'</div>'
      +'<div class="field"><label>Alternative quota (days a month)</label><input class="input" id="brAltMax" type="number" min="0" max="31" value="'+r.altMax+'"></div>'
      +'<div class="field"><label>Reserve threshold</label><input class="input" id="brResMax" type="number" min="0" max="20" value="'+r.reserveMax+'"></div>'
      +'</div>'
      +'<div class="field" style="margin-top:10px"><label>Never works these benches (hard block)</label>'+checks(r.never,'never')+'</div>'
      +'<div class="field" style="margin-top:10px"><label>Only when alone on the unit</label>'+checks(r.solo,'solo')+'</div>'
      +'<label class="row gap-sm" style="margin-top:12px;cursor:pointer"><input type="checkbox" id="brReserve"'+(r.reserve?' checked':'')+' style="accent-color:var(--gold)"><span class="small">Reserve cover — on the weekly roster only when the day\'s plan has no more than the threshold above</span></label>'
      +'<div class="hint" style="margin-top:10px">A hard block can still be overridden for a single cell, with a reason and your name recorded against it. The weekly sheet and the grid both print that override.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-br-save>'+UI.ic('check',15)+'Save rules</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-br-save]').onclick=()=>{
        const pick=id=>[...el.querySelectorAll('[data-'+id+']')].filter(x=>x.checked).map(x=>x.getAttribute('data-'+id));
        const never=U.uniq(pick('never'));
        const solo=pick('solo').filter(b=>never.indexOf(b)<0);
        S.commit(d=>{
          const p=d.staff.find(x=>x.id===st.id); if(!p) return;
          p.homeBench=el.querySelector('#brHome').value||'';
          p.altBench=el.querySelector('#brAlt').value||'';
          p.altMaxMonth=Math.max(0,+el.querySelector('#brAltMax').value||0);
          p.neverBench=never;
          p.soloBench=solo;
          p.avoidBench=[];                    /* migrated into neverBench */
          p.rareBench=[];
          p.reserveOnly=el.querySelector('#brReserve').checked;
          p.reserveMinDay=Math.max(0,+el.querySelector('#brResMax').value||0);
        },{action:'roster.rules.edit',entity:'staff',entityId:st.id,
           detail:'Bench rules for '+name+': never '+(never.join(', ')||'—')+' · alone only '+(solo.join(', ')||'—')+' · reserve '+el.querySelector('#brReserve').checked});
        close(); paint(); UI.toast('Bench rules saved · auto-allocate will follow them',{type:'ok'});
      };
    }});
}
function servicesView(){
  const svcs=S.services();
  const start=weekStart(), dates=S.weekDates(start), alloc=allocationOf(start);
  const used={}; dates.forEach(iso=>Object.keys(alloc[iso]||{}).forEach(sv=>{ used[sv]=(used[sv]||0)+1; }));
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('flask-conical',14,'ic')+'Laboratory services</div><div class="card-sub">The service menu staff are rostered against — reception, benches, blood bank, molecular</div></div><span class="grow"></span><button class="btn sm" data-add-svc>'+UI.ic('plus',13)+'Add service</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Service</th><th>Code</th><th>Minimum staff</th><th>Note</th><th>Filled this week</th><th></th></tr></thead><tbody>'
   +svcs.map(sv=>'<tr><td><div class="primary-cell"><b>'+U.esc(sv.name)+'</b><small>'+U.esc(sv.note||'')+'</small></div></td><td class="mono xs">'+U.esc(sv.code)+'</td><td class="num">'+sv.min+'</td>'
     +'<td class="small">'+U.esc(sv.note||'—')+'</td><td class="num">'+(used[sv.name]||0)+' / 7 days</td>'
     +'<td><button class="icon-btn" style="width:26px;height:26px" data-edit-svc="'+sv.id+'">'+UI.ic('pencil',13)+'</button></td></tr>').join('')
   +'</tbody></table></div><div class="card-foot"><span>Services drive the weekly roster and the print-out</span><span class="mono">'+svcs.length+' services</span></div></div></div>'
   +'<div class="c12" style="margin-top:14px">'+UI.card({title:'Allocation this week',sub:weekNavLabel(start)+' · one column per service, re-flowing to the width of the screen',icon:'calendar-days',
      tools:'<button class="btn xs" data-view-jump="week">'+UI.ic('arrow-right',12)+'Open weekly roster</button>',
      body:'<div class="services-grid">'+svcs.map(sv=>{
        const n=dates.filter(iso=>alloc[iso]&&alloc[iso][sv.name]).length;
        return '<div class="service-cell"><div class="row between"><span class="small truncate">'+U.esc(sv.name)+'</span><span class="mono xs faint">'+n+'/7</span></div>'
          +UI.meter(n/7*100,n>=5?'teal':n>0?'amber':'rose')
          +'<div class="xs faint" style="margin-top:4px">'+U.esc(sv.code)+' · min '+sv.min+' staff</div></div>';
      }).join('')+'</div>'})+'</div></div>';
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
  const start=weekStart(); const w=S.db().unitRosters&&S.db().unitRosters[start];
  const ovr=(w&&w.overrides&&w.overrides[iso])||{};
  const st=S.staffByName((allocationOf(start)[iso]||{})[svc]||'');
  const {duty:onDuty,core,alone,planCount}=dutyContext(iso);
  const others=S.activeStaff().filter(s=>!onDuty.some(d=>d.id===s.id));
  const rules=benchPlan();
  /* Anyone who may not work this bench is still selectable — with the reason shown —
     because a manager may override it; the override is recorded, not silent. */
  const whyBlocked=s=>{
    if(!reserveAllowed(rules[s.name]||{},planCount)) return 'reserve · plan has '+planCount+' staff (limit '+(rules[s.name].reserveMax)+')';
    const g=gate(rules[s.name],svc,{alone});
    return g.ok?'':g.why;
  };
  const opt=(s,sel)=>{
    const why=whyBlocked(s);
    return '<option value="'+U.esc(s.name)+'"'+(sel&&st&&st.id===s.id?' selected':'')+(why?' data-blocked="1"':'')+'>'
      +U.esc(s.name)+' · '+U.esc(S.shiftState(s,iso).label)+(why?' — '+U.esc(why):'')+'</option>';
  };
  UI.modal({title:'Allocate '+svc,sub:U.fmtDate(iso)+' · '+U.DOWL[U.dow(iso)]+' · week of '+weekNavLabel(start),width:'min(560px,100%)',
    body:'<div class="field"><label>Staff member on this service</label><select class="select" id="alStaff"><option value="">— Unassigned —</option><optgroup label="On duty this day">'+onDuty.map(s=>opt(s,true)).join('')+'</optgroup><optgroup label="Off duty / leave">'+others.map(s=>opt(s,false)).join('')+'</optgroup></select></div>'
      +'<div class="field" style="margin-top:10px"><label>Reason (only needed for a recorded override)</label><input class="input" id="alWhy" placeholder="e.g. only technologist on the unit that morning"></div>'
      +'<div class="hint" style="margin-top:10px">Bench rules are enforced: <b>never</b> benches, <b>alone-only</b> benches and the reserve threshold. Choosing someone the rules exclude asks you to confirm and writes a dated override against that cell — it then shows as <b>override</b> on the grid, in print and in the sheet.</div>'
      +(alone?'<div class="hint" style="margin-top:6px">Only one person is on this unit today, so alone-only benches are open.</div>':''),
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Allocate</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=async()=>{
        const name=el.querySelector('#alStaff').value;
        const why=el.querySelector('#alWhy').value.trim();
        const who=name?S.staffByName(name):null;
        const mustOverride=!!(who&&whyBlocked(who));
        if(mustOverride){
          const ok=await UI.confirm({title:'Record an override for '+svc+'?',confirm:'Record override',
            body:whyBlocked(who)+'. If you continue, this allocation is saved as a dated override by '+((LS.auth.user&&LS.auth.user.name)||'you')+' and flagged wherever the roster is shown or printed.'});
          if(!ok) return;
        }
        const at=U.nowISO(), by=(LS.auth.user&&LS.auth.user.name)||'';
        S.commit(d=>{
          d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
          const we=d.unitRosters[start];
          we.assignments[iso]=we.assignments[iso]||{};
          we.overrides=we.overrides||{}; we.overrides[iso]=we.overrides[iso]||{};
          if(name) we.assignments[iso][svc]=name; else delete we.assignments[iso][svc];
          if(name&&mustOverride) we.overrides[iso][svc]={by,at,why:why||whyBlocked(who),rule:whyBlocked(who)};
          else delete we.overrides[iso][svc];
          if(we.auto&&we.auto[iso]) delete we.auto[iso][svc];   /* manual now, not automatic */
        },{action:mustOverride?'roster.allocate.override':'roster.allocate',entity:'unitRosters',entityId:start,
           detail:svc+' · '+U.fmtDate(iso)+' → '+(name||'unassigned')+(mustOverride?' · OVERRIDE: '+whyBlocked(who):'')});
        close(); paint();
        UI.toast(name?(mustOverride?'Allocated with a recorded override':'Allocated to '+name):'Allocation cleared',{type:mustOverride?'warn':'ok'});
      };
    }});
}
/* ——— Bench rules —————————————————————————————————————————
   Three strengths, not one preference list:
     home / alt(+monthly quota) / rare — preference, used to order candidates
     never  — a hard block; only a recorded manual override may place them
     solo   — allowed only when they are the only person on duty that day
     reserve— on the roster only when the day's plan carries no more than N staff
   Biochemistry + Serology are the scarcity pair: when a day has fewer people than
   benches, one person covers both rather than leaving one empty. */
const SCARCITY_PAIRS=[['Biochemistry','Serology']];
function rulesOf(name){
  const st=S.staffByName(name)||{};
  const never=U.uniq([].concat(st.neverBench||[], st.avoidBench||[]).filter(Boolean));
  return {
    name,
    home: st.homeBench||'',
    alt: st.altBench||'',
    altMax: st.altMaxMonth==null?0:st.altMaxMonth,
    rare: [].concat(st.rareBench||[]).filter(b=>never.indexOf(b)<0),
    never,
    solo: [].concat(st.soloBench||[]).filter(b=>never.indexOf(b)<0),
    reserve: !!st.reserveOnly,
    reserveMax: st.reserveMinDay==null?2:st.reserveMinDay
  };
}
function benchPlan(){
  const out={}; S.activeStaff().forEach(s=>{ out[s.name]=rulesOf(s.name); });
  return out;
}
/* ctx: {alone, override}. An override is a recorded, attributed exception — it is
   the only thing that lifts a hard block. */
function gate(r, bench, ctx){
  ctx=ctx||{};
  if(!r) return {ok:true};
  if(ctx.override) return {ok:true,overridden:true};
  if(r.never.indexOf(bench)>=0) return {ok:false,why:r.name+' never works '+bench};
  if(r.solo.indexOf(bench)>=0 && !ctx.alone) return {ok:false,why:r.name+' works '+bench+' only when alone on the unit'};
  return {ok:true};
}
function reserveAllowed(r, planCount){ return !r.reserve || planCount<=r.reserveMax; }
function altUsedThisMonth(name, bench, monthKey){
  const db=S.db(); let n=0;
  Object.keys(db.unitRosters||{}).forEach(w=>{
    if(String(w).slice(0,7)!==monthKey) return;
    const as=db.unitRosters[w].assignments||{};
    Object.keys(as).forEach(iso=>{ if((as[iso]||{})[bench]===name) n++; });
  });
  return n;
}
/* ——— Posts ————————————————————————————————————————————————
   A post is the unit of work, not a bench. The laboratory is staffed by posts, and
   the post list adapts to how many people are actually on duty that day (never
   counting the manager, who is reserve):

     six or more   Reception · Phlebotomy · Haematology · Biochemistry · Serology · Para+TB
     five          Phlebotomy + Haematology are one person             (5 posts)
     four          …and Biochemistry + Serology are one person          (4 posts)
     three         …and Reception joins Parasitology + TB               (3 posts)
     two or fewer  …and the Biochemistry + Serology post is the manager's (3 posts)

   A post holds one person, and that person covers every bench in the post — the
   grid writes their name into each of those services. */
const POST_BASE=[
  {key:'REC', services:['Reception']},
  {key:'PHL', services:['Phlebotomy']},
  {key:'HAE', services:['Hematology']},
  {key:'BIO', services:['Biochemistry']},
  {key:'SER', services:['Serology']},
  {key:'PBT', services:['Parasitology','TB/Molecular']}
];
const POST_DEFAULTS={splitManyAt:6, mergeBioSerBelow:5, mergeReceptionBelow:4};
function postModel(){
  const st=(S.settings&&S.settings())||{};
  const m=Object.assign({},POST_DEFAULTS,st.rosterModel||{});
  const r=(S.staffByName&&S.activeStaff().filter(x=>x.reserveOnly)[0])||{};
  m.reserveMax=r.reserveMinDay==null?2:r.reserveMinDay;
  return m;
}
function shortBench(b){ return b==='TB/Molecular'?'TB':b; }
function postLabel(services){ return services.map(shortBench).join(' + '); }
function postGroupsFor(n){
  const m=postModel();
  const reg=S.services().map(x=>x.name);
  let groups=POST_BASE
    .map(g=>({key:g.key, services:g.services.filter(b=>reg.indexOf(b)>=0)}))
    .filter(g=>g.services.length);
  /* a service added by the manager is its own post until it is merged below */
  reg.forEach(b=>{ if(!POST_BASE.some(g=>g.services.indexOf(b)>=0)) groups.push({key:'X'+b, services:[b]}); });
  const merge=(keys,at)=>{
    const picked=groups.filter(g=>keys.indexOf(g.key)>=0);
    if(picked.length<2) return;
    const idx=Math.min.apply(null,picked.map(g=>groups.indexOf(g)));
    const services=[]; picked.forEach(g=>g.services.forEach(b=>{ if(services.indexOf(b)<0) services.push(b); }));
    const key=keys.join('+');
    groups=groups.filter(g=>keys.indexOf(g.key)<0);
    groups.splice(idx,0,{key, services});
  };
  if(n<m.splitManyAt) merge(['PHL','HAE']);                 /* phlebotomy + haematology, one person */
  if(n<m.mergeBioSerBelow) merge(['BIO','SER']);            /* one person does both */
  if(n<m.mergeReceptionBelow) merge(['REC','PBT']);         /* reception joins parasitology + TB */
  return groups.map(g=>Object.assign({},g,{
    label:postLabel(g.services),
    /* in a two-person unit the biochemistry + serology post belongs to the manager */
    reservePost: n<=m.reserveMax && g.services.indexOf('Biochemistry')>=0 && g.services.indexOf('Serology')>=0
  }));
}
function postModeLabel(n){
  const m=postModel();
  if(n<=m.reserveMax) return 'Very few · '+n+' on duty, manager takes Biochemistry + Serology';
  if(n<m.mergeReceptionBelow) return 'Few · '+n+' on duty';
  if(n<m.mergeBioSerBelow) return 'Short · '+n+' on duty';
  if(n<m.splitManyAt) return 'Full · '+n+' on duty';
  return 'Many · '+n+' on duty, phlebotomy and haematology split';
}
/* Everyone on duty that day, split so the reserve is never counted as "cover" when
   deciding whether the unit is short-staffed. */
function dutyContext(iso){
  const all=S.onDuty(iso);
  const rules=benchPlan();
  /* A night is a whole shift of its own: whoever is on nights that day is not on the
     day roster, and cannot hold a bench post. Only day and day+night staff are
     available for the day's work. */
  const duty=all.filter(x=>x.kind==='day'||x.kind==='daynight').map(x=>x.staff);
  const nightOnly=all.filter(x=>x.kind==='night').map(x=>x.staff);
  const core=duty.filter(s=>!(rules[s.name]||{}).reserve);
  return {duty, core, nightOnly, alone:core.length<=1, planCount:duty.length, rules};
}
/* A new technologist inside their first thirty days follows the orientation rota
   instead of taking a normal post. */
function orientationFor(iso){
  const out={};
  S.activeStaff().forEach(st=>{
    const p=S.orientationPlan(st,iso);
    if(p && p.week<4 && p.benches.length) out[st.name]=p;
  });
  return out;
}
/* Night cover is its own row: one name per night, chosen from the people whose
   contract allows it. It writes the same unitRosters.night map the printed sheet
   and the dashboard already read. */
function nightModal(iso){
  if(!LS.auth.guard('edit')) return;
  const start=weekStart();
  const cover=S.nightCover(iso);
  const cur=S.unitNight(start,iso)||cover.name||'';
  const people=S.activeStaff().filter(x=>x.nightPref!=='no'&&(x.maxNights||0)>0);
  UI.modal({title:'Night duty · '+U.fmtDate(iso),sub:'17:00 – 08:00 the next day.',width:'min(460px,100%)',
    body:'<div class="hint" style="margin-bottom:10px">'+(cover.source==='plan'?'The working plan puts <b>'+U.esc(cover.name||'nobody')+'</b> on this night. Changing it here records a by-hand override and leaves the plan alone.':'No working plan covers this night — the name comes from '+(cover.source==='pattern'?'the contract pattern':'nothing yet')+'.')+'</div>'
      +'<div class="field"><label>Who is on nights</label><select class="select" id="ntPick"><option value="">— nobody assigned —</option>'
      +people.map(p=>'<option value="'+U.esc(p.name)+'"'+(p.name===cur?' selected':'')+'>'+U.esc(p.name)+' · '+U.esc(p.role)+'</option>').join('')+'</select></div>',
    foot:(cover.source==='manual'?'<button class="btn" data-nt-clear>'+UI.ic('rotate-ccw',15)+'Back to the plan</button>':'')
      +'<button class="btn" data-close>Cancel</button><button class="btn primary" data-nt-save>'+UI.ic('check',15)+'Save night cover</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-nt-save]').onclick=()=>{
        const name=el.querySelector('#ntPick').value;
        S.commit(d=>{ d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
          const w=d.unitRosters[start]; w.night=w.night||{}; if(name) w.night[iso]=name; else delete w.night[iso]; },
          {action:'roster.night',entity:'unitRosters',entityId:start,detail:'Night '+U.fmtDate(iso)+' → '+(name||'unassigned')});
        close(); paint(); UI.toast(name?'Night cover set to '+name:'Night cover cleared',{type:'ok'});
      };
      const back=el.querySelector('[data-nt-clear]');
      if(back) back.onclick=()=>{
        S.commit(d=>{ const w=d.unitRosters&&d.unitRosters[start]; if(w&&w.night) delete w.night[iso]; },
          {action:'roster.night.clear',entity:'unitRosters',entityId:start,detail:'Night '+U.fmtDate(iso)+' returned to the working plan'});
        close(); paint(); UI.toast('Back to the working plan — '+cover.name,{type:'ok'});
      };
    }});
}
function autoAllocate(){
  if(!LS.auth.guard('edit')) return;
  const start=weekStart(), dates=S.weekDates(start), mkOf=String(start).slice(0,7);
  const rules=benchPlan();
  let posts=0, servicesFilled=0, skipped=0, reservePosts=0, cleared=0, split=0;
  S.commit(d=>{
    d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
    const w=d.unitRosters[start];
    w.overrides=w.overrides||{}; w.auto=w.auto||{};
    const altTally={};
    dates.forEach(iso=>{
      const {duty,core,alone}=dutyContext(iso);
      const n=core.length;                                   /* never counts the manager */
      const groups=postGroupsFor(n);
      w.assignments[iso]=w.assignments[iso]||{};
      const day=w.assignments[iso];
      const ovr=w.overrides[iso]||{};
      /* A re-run reflects today's post list: the previous automatic pass is taken
         back, while manual allocations and recorded overrides stay put. */
      const prevAuto=w.auto[iso]||{};
      Object.keys(prevAuto).forEach(b=>{ if(day[b]===prevAuto[b] && !ovr[b]){ delete day[b]; cleared++; } });
      w.auto[iso]={};
      const held=()=>U.uniq(Object.keys(day).map(b=>day[b]).filter(Boolean));
      const placedOn=bench=>day[bench]||'';
      const gateFor=(name,bench)=>gate(rules[name],bench,{alone,override:!!ovr[bench]});
      const mayWorkAll=(name,services)=>services.every(b=>gateFor(name,b).ok);
      const reserveOf=name=>!!(rules[name]&&rules[name].reserve);
      const rankFor=(name,services)=>{
        const r=rules[name]||{home:'',alt:'',altMax:0,rare:[],reserve:false};
        if(r.reserve) return 70;
        if(services.indexOf(r.home)>=0) return 0;
        if(!r.home && !r.alt) return 20;
        if(services.indexOf(r.alt)>=0){
          const used=services.reduce((a,b)=>a+(altUsedThisMonth(name,b,mkOf)+(altTally[name+'|'+b]||0)),0);
          return used<(r.altMax||0)?10:35;
        }
        if((r.rare||[]).some(b=>services.indexOf(b)>=0)) return 40;
        return 50;
      };
      const write=(bench,who)=>{
        day[bench]=who.name; w.auto[iso][bench]=who.name;
        const r=rules[who.name]||{};
        if(r.alt&&(r.alt===bench)) altTally[who.name+'|'+bench]=(altTally[who.name+'|'+bench]||0)+1;
      };
      /* one post = one person covering every bench in it */
      const assignPost=(post,who)=>{
        post.services.forEach(b=>{ if(!placedOn(b)) write(b,who); });
        posts++; servicesFilled+=post.services.filter(b=>day[b]===who.name).length;
        if(reserveOf(who.name)) reservePosts++;
        if(post.services.length>1) split++;
      };
      const freePool=()=>{ const used=held(); return duty.filter(x=>used.indexOf(x.name)<0); };
      const mayBeOnPlan=x=>!reserveOf(x.name)||n<=postModel().reserveMax;
      const couldCover=(x,post)=>mayBeOnPlan(x)&&post.services.every(b=>gateFor(x.name,b).ok);
      const openPost=g=>g.services.some(b=>!placedOn(b));

      /* 0 — the orientation rota comes first: a new technologist works the benches
             their week names, and is not handed a normal post. */
      const orient=orientationFor(iso);
      Object.keys(orient).forEach(name=>{
        const person=duty.filter(x=>x.name===name)[0];
        if(!person) return;
        const plan=orient[name];
        const allowed=plan.benches.filter(b=>S.services().some(sv=>sv.name===b)&&!placedOn(b));
        allowed.forEach(b=>write(b,person));
        w.orientation=w.orientation||{}; w.orientation[iso]=w.orientation[iso]||{};
        w.orientation[iso][name]={week:plan.week,label:plan.weekLabel,benches:plan.benches};
      });
      /* the reserve's own post on a very-few day, so he is never pushed elsewhere */
      const reservePost=groups.find(g=>g.reservePost);
      if(reservePost&&openPost(reservePost)){
        const rp=freePool().filter(x=>reserveOf(x.name)).filter(x=>couldCover(x,reservePost));
        const rp2=freePool().filter(x=>couldCover(x,reservePost));
        const who=rp[0]||rp2[0];
        if(who) assignPost(reservePost,who);
      }
      /* 2 — most-constrained person first. Someone who cannot cover a whole post
             because of a bench rule still gets the part they may work, instead of
             standing idle while every bench is handed out around them. */
      const remaining=groups.filter(g=>g!==reservePost);
      const breadth=x=>remaining.filter(g=>g.services.every(b=>!placedOn(b))&&couldCover(x,g)).length;
      const people=freePool().filter(mayBeOnPlan).sort((a,b)=>{
        const d=breadth(a)-breadth(b); if(d) return d;
        return rankFor(a.name,['Reception'])-rankFor(b.name,['Reception']);
      });
      const homeOf=x=>(rules[x.name]||{}).home||'';
      people.forEach(x=>{
        const whole=remaining.find(g=>g.services.indexOf(homeOf(x))>=0&&g.services.every(b=>!placedOn(b))&&couldCover(x,g))
          ||remaining.find(g=>g.services.every(b=>!placedOn(b))&&couldCover(x,g));
        if(whole){ assignPost(whole,x); return; }
        /* best partial: the post where this person may work the most benches */
        let best=null, bestN=0;
        remaining.forEach(g=>{
          const allowed=g.services.filter(b=>!placedOn(b)&&gateFor(x.name,b).ok);
          if(allowed.length>bestN){ bestN=allowed.length; best={g,allowed}; }
        });
        if(best&&bestN){
          best.allowed.forEach(b=>write(b,x));
          servicesFilled+=bestN;
          if(bestN>1) split++;
        }
      });
      /* 3 — everyone has had one turn; a second post only if benches are still open
             and the person may work them (a truly short day). */
      if(n<remaining.length+ (reservePost?1:0)){
        remaining.forEach(g=>{
          const open=g.services.filter(b=>!placedOn(b));
          if(!open.length) return;
          const cand=freePool().concat(duty.filter(y=>held().indexOf(y.name)>=0))
            .filter(y=>mayBeOnPlan(y)&&open.every(b=>gateFor(y.name,b).ok))
            .sort((a,b)=>rankFor(a.name,open)-rankFor(b.name,open));
          if(cand.length){ open.forEach(b=>write(b,cand[0])); servicesFilled+=open.length; }
        });
      }
      /* 3 — the manager never sits on a day that carries more than his threshold. */
      Object.keys(day).forEach(bench=>{
        const who=day[bench]; if(!who||ovr[bench]) return;
        if(reserveOf(who)&&n>postModel().reserveMax){ delete day[bench]; delete w.auto[iso][bench]; cleared++; }
      });
      skipped+=S.services().filter(sv=>!placedOn(sv.name)).length;
    });
  },{action:'roster.allocate.auto',entity:'unitRosters',entityId:start,
     detail:'Auto-allocation by post (Reception · Phleb+Hem · Bio+Ser · Para+TB), week of '+start});
  paint();
  const bits=[servicesFilled+' benches covered in '+posts+' posts'];
  if(split) bits.push(split+' post'+(split===1?'':'s')+' combining two benches');
  if(reservePosts) bits.push('manager on '+reservePosts+' post'+(reservePosts===1?'':'s'));
  if(cleared) bits.push(cleared+' auto slot'+(cleared===1?'':'s')+' withdrawn by a bench rule');
  if(skipped) bits.push(skipped+' left open (no one may work that bench)');
  UI.toast(bits.join(' · '),{type:'ok',duration:5200});
}
/* ——— Nights ——————————————————————————————————————————————
   The night week has three owners, not seven:
     Mon–Wed  one person does three nights
     Thu–Fri  a second person does two
     Sat–Sun  the weekend-only technologist, day + night, when she is not on leave
   Nobody is given a night they cannot take: contract (nightPref / maxConsecN /
   maxNights), leave, and the month's night count are all checked first. */
function nightEligible(dates){
  return S.activeStaff().filter(st=>{
    if(st.reserveOnly||st.pattern==='manager') return false;
    if(st.nightPref==='no'||!(st.maxNights>0)) return false;
    if(st.weekendOnly) return false;
    /* not on leave for any of the nights in question */
    const lv=dates.some(iso=>{
      const s2=S.shiftState(st,iso);
      return s2.kind==='leave'||s2.kind==='exited'||s2.kind==='training';
    });
    return !lv;
  });
}
function weekendOwner(dates){
  const wk=S.activeStaff().find(st=>st.weekendOnly&&st.status==='active');
  if(!wk) return null;
  const free=dates.every(iso=>{ const st=S.shiftState(wk,iso); return st.kind!=='leave'&&st.kind!=='exited'&&st.kind!=='training'; });
  return free?wk:null;
}
function nightsThisMonth(name, mkOf){
  const db=S.db(); let n=0;
  Object.keys(db.unitRosters||{}).forEach(w=>{
    if(String(w).slice(0,7)!==mkOf) return;
    const map=(db.unitRosters[w].night)||{};
    Object.keys(map).forEach(iso=>{ if(map[iso]===name) n++; });
  });
  return n;
}
function nightPlanFor(start){
  const dates=S.weekDates(start), mkOf=String(start).slice(0,7);
  const out={}, notes=[];
  const week=Math.floor(U.parseISO(start)/86400000/7);
  const monWed=dates.slice(0,3), thuFri=dates.slice(3,5), weekend=dates.slice(5,7);
  const pool=nightEligible(dates).filter(st=>(st.maxConsecN||0)>=2)
    .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  /* A three-night block is earned: only staff flagged for it, Patrick ahead of
     Jean Paul, and Patrick carries two weeks out of every three. Nobody else is
     given a third consecutive night. */
  const three=pool.filter(st=>(st.maxConsecN||0)>=3 && st.threeNight)
    .sort((a,b)=>(a.nightRank||9)-(b.nightRank||9));
  const capOk=(st,days)=>nightsThisMonth(st.name,mkOf)+days<=st.maxNights;
  const threePick=three.length?(three.length>1&&week%3===2?three[1]:three[0]):null;
  if(threePick&&capOk(threePick,3)){ monWed.forEach(iso=>{ out[iso]=threePick.name; }); notes.push('Mon–Wed · '+threePick.name); }
  else if(pool.length){ const alt=pool.find(st=>st!==threePick&&capOk(st,3))||pool[0]; monWed.forEach(iso=>{ out[iso]=alt.name; }); notes.push('Mon–Wed · '+alt.name+' (three-night cover unavailable)'); }
  /* two nights, Thu–Fri — a different person */
  const twoPick=pool.find(st=>st!==threePick && st.name!==out[monWed[0]] && capOk(st,2));
  if(twoPick){ thuFri.forEach(iso=>{ out[iso]=twoPick.name; }); notes.push('Thu–Fri · '+twoPick.name); }
  else notes.push('Thu–Fri · nobody free');
  /* the weekend, day + night */
  const wk=weekendOwner(weekend);
  if(wk){ weekend.forEach(iso=>{ out[iso]=wk.name; }); notes.push('Sat–Sun (day + night) · '+wk.name); }
  else {
    /* she is away: the two-night person takes the weekend nights rather than leaving them open */
    const spare=pool.filter(st=>capOk(st,2));
    if(spare.length){ weekend.forEach(iso=>{ out[iso]=spare[0].name; }); notes.push('Sat–Sun · '+spare[0].name+' (weekend technologist away)'); }
    else notes.push('Sat–Sun · nobody free');
  }
  return {map:out, notes};
}
function autoNights(){
  if(!LS.auth.guard('edit')) return;
  const start=weekStart();
  const {map, notes}=nightPlanFor(start);
  S.commit(d=>{
    d.unitRosters=d.unitRosters||{}; if(!d.unitRosters[start]) d.unitRosters[start]={weekStart:start,assignments:{}};
    const w=d.unitRosters[start]; w.night=w.night||{};
    S.weekDates(start).forEach(iso=>{ if(map[iso]) w.night[iso]=map[iso]; });
  },{action:'roster.night.auto',entity:'unitRosters',entityId:start,
     detail:'Night cover planned: '+notes.join(' · ')});
  paint();
  UI.toast('Nights planned · '+notes.join(' · '),{type:'ok',duration:5600});
}
function printWeek(){
  SH.printSVG(SH.weeklySVG(weekData()),{title:'Weekly unit roster — week of '+U.fmtDateShort(weekStart())});
  S.audit({action:'roster.print.week',entity:'unitRosters',entityId:weekStart(),detail:'Printed weekly roster week of '+weekStart()}); S.save();
}
function paint(){ sheetSVG=null;

  /* the header carries the month label and the plan pill, so it has to be redrawn
     every time the month changes — otherwise Next / Previous moved the plan but the
     label kept the month the page was opened on */
  const head=rootEl.querySelector('#roHead');
  if(head) head.innerHTML=header();
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
  const night={}; dates.forEach(iso=>{ const n=S.nightCover(iso).name; if(n) night[iso]=n; });
  const data={weekStart:start,dates,services:svcs,alloc,night};
  const svg=SH.weeklySVG(data);
  const filename='unit-roster-'+start;
  UI.modal({title:'Weekly unit roster — week of '+U.fmtDateShort(start),sub:'Allocated units, weekend shading and the night shift row, on one A4 landscape page.',width:'min(1180px,96vw)',
    body:'<div style="border:1px solid var(--border);border-radius:10px;overflow:auto;background:#fff;max-height:60vh">'+svg+'</div>'
      +'<div class="hint" style="margin-top:8px">Night shift names are read from the working plan (a night code or a day+night code); a night entered by hand overrides the plan and is marked as such.</div>',
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
  dates.forEach(iso=>{ const n=S.nightCover(iso).name; if(n) night[iso]=n; });
  const wRec=(S.db().unitRosters||{})[start]||{};
  return {weekStart:start,dates,services:S.services(),alloc,night,overrides:wRec.overrides||{},orientation:wRec.orientation||{}};
}
/* Kept as the one call the sheet builders use; the plan does the deciding. */
function onDutyName(iso){ return S.nightCover(iso).name||''; }
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
  r.querySelectorAll('[data-night]').forEach(td=>td.onclick=()=>nightModal(td.dataset.night));
  r.querySelectorAll('[data-auto-week]').forEach(b=>b.onclick=autoAllocate);
  r.querySelectorAll('[data-auto-nights]').forEach(b=>b.onclick=autoNights);
  r.querySelectorAll('[data-print-week]').forEach(b=>b.onclick=printWeek);
  r.querySelectorAll('[data-week-sheet]').forEach(b=>b.onclick=openWeekSheet);
  const wkSvg=function(){ const start=weekStart(), dates=S.weekDates(start), svcs=S.services(), alloc=allocationOf(start), night={};
    dates.forEach(iso=>{ const n=S.nightCover(iso).name; if(n) night[iso]=n; });
    const wRec=(S.db().unitRosters||{})[start]||{};
    const data={weekStart:start,dates,services:svcs,alloc,night,overrides:wRec.overrides||{},orientation:wRec.orientation||{}};
    return {start,dates,data,svg:SH.weeklySVG(data)}; };
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
  r.querySelectorAll('[data-bench-rules]').forEach(el=>el.onclick=()=>benchRulesModal(el.dataset.benchRules));
  r.querySelectorAll('[data-post-model]').forEach(b=>b.onclick=postModelModal);
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
  root.innerHTML='<div id="roHead">'+header()+'</div><div id="roBody"></div>';
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
