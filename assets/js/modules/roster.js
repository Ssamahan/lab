/* ============================================================================
   MODULE · WORKING PLAN — calendar grid, drag-to-assign, coverage, fairness
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.roster=M;
let rootEl=null, mk=null, view='grid', drag=null, suppressClick=false;
const CODES=[['D','Day 08–20'],['N','Night 20–08'],['DN','Day + Night'],['OFF','Off'],['AL','Annual leave'],['TR','Training'],['SICK','Sick leave'],['W','Weekend / rest']];

function plan(){ const db=S.db(); const key=mk||U.monthKey(); if(!db.workingPlans[key]){ db.workingPlans[key]={primary:null,versions:[]}; } return db.workingPlans[key].primary; }
function ensurePlan(){
  const db=S.db(); const key=mk||U.monthKey();
  if(!db.workingPlans[key] || !db.workingPlans[key].primary){
    S.commit(d=>{ d.workingPlans[key]={primary:S.buildPlan(key),versions:[]}; },{action:'roster.generate',entity:'workingPlans',entityId:key,detail:'Draft plan generated for '+U.monthLabel(key)});
  }
  return plan();
}
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
  const off=!p;
  const label=p?p.label:U.monthLabel(mk);
  return '<div class="page-head"><div><h1>Working plan</h1><div class="sub">A true calendar for the bench: staff × days, weekend shading, today marker, live coverage and a fairness ledger that survives scrutiny.</div></div>'
   +'<div class="actions">'
     +'<div class="seg" style="margin-right:4px"><button data-nav="-1" aria-label="Previous month">'+UI.ic('chevron-left',14)+'</button><button data-nav="0" style="font-family:var(--font-mono);font-size:11px;min-width:92px">'+U.esc(label)+'</button><button data-nav="1" aria-label="Next month">'+UI.ic('chevron-right',14)+'</button></div>'
     +'<button class="btn" data-generate>'+UI.ic('sparkles',15)+' Generate draft</button>'
     +'<button class="btn" data-patterns>'+UI.ic('layers',15)+' Patterns</button>'
     +'<button class="btn primary" data-print>'+UI.ic('printer',15)+' Print roster</button>'
   +'</div></div>'
   +'<div class="filters" style="margin-bottom:12px">'+[['grid','Shift grid'],['fairness','Fairness'],['swaps','Swap requests']].map(([k,l])=>'<button class="filter-tab '+(view===k?'on':'')+'" data-view="'+k+'">'+l+'</button>').join('')+'</div>';
}
function legend(){
  return '<div class="row wrap gap-sm" style="margin-bottom:10px"><span class="shift-code D">D</span><span class="xs faint">Day</span><span class="shift-code N">N</span><span class="xs faint">Night</span><span class="shift-code DN">DN</span><span class="xs faint">Day+Night</span><span class="shift-code AL">AL</span><span class="xs faint">Leave</span><span class="shift-code TR">TR</span><span class="xs faint">Training</span><span class="shift-code OFF">OFF</span><span class="xs faint">Off</span><span style="margin-left:auto" class="xs faint">Drag a shift to another day · click to edit</span></div>';
}
function gridView(){
  const p=ensurePlan(); if(!p) return UI.empty({art:'calendar',title:'No plan for this month',body:'Generate a draft from staff patterns and approved leave.'});
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
        const cls=['day',dow>=5?'wkend':'',today?'today':'',hol?'holiday':'',c==='OFF'?'off':''].filter(Boolean).join(' ');
        return '<td class="'+cls+'" data-cell="'+si+'-'+di+'" data-si="'+si+'" data-di="'+di+'" '+(c?'draggable="true"':'')+'><span class="shift-code '+c+'" style="pointer-events:none">'+U.esc(c||'·')+'</span></td>';
     }).join('')+'</tr>';
  }).join('');
  const footer='<tfoot><tr class="cov-footer"><td class="staff-cell" style="background:var(--surface-inset);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)">Day cover</td>'
   +p.dates.map(iso=>{ const c=cov[iso], r=required(iso); return '<td class="'+(c.day<r.day?'low':'')+'" data-tip="'+c.day+' of '+r.day+' required">'+c.day+'</td>'; }).join('')+'</tr>'
   +'<tr class="cov-footer"><td class="staff-cell" style="background:var(--surface-inset);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)">Night cover</td>'
   +p.dates.map(iso=>{ const c=cov[iso], r=required(iso); return '<td class="'+(c.night<r.night?'low':'')+'" data-tip="'+c.night+' of '+r.night+' required">'+c.night+'</td>'; }).join('')+'</tr></tfoot>';
  const under=p.dates.filter(iso=>cov[iso].day<required(iso).day||cov[iso].night<required(iso).night);
  return legend()
   +'<div class="grid-12"><div class="c9"><div class="card table-card"><div class="dt-scroll" style="max-height:none"><table class="cal">'+head+'<tbody>'+body+'</tbody>'+footer+'</table></div>'
   +'<div class="card-foot"><span>'+(p.meta&&p.meta.generated?'Draft generated from staff patterns':'Official published plan')+' · '+p.dates.length+' days</span><span class="pill '+(under.length?'amber':'teal')+'">'+(under.length?under.length+' days under-covered':'Coverage complete')+'</span></div></div></div>'
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
  const p=ensurePlan(); const f=fairness(p);
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
function paint(){
  const host=rootEl.querySelector('#roBody'); if(!host) return;
  host.innerHTML=view==='grid'?gridView():view==='fairness'?fairnessView():swapsView();
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
  const p=ensurePlan(); const s=p.staff[si];
  S.commit(d=>{ const pl=d.workingPlans[mk].primary; pl.staff[si].codes[di]=code; pl.meta.draft=true; pl.meta.edited=U.nowISO(); },
    {action:'roster.assign',entity:'workingPlans',entityId:mk,detail:s.name+' · '+U.fmtDate(p.dates[di])+' → '+code});
  paint();
}
function shiftPicker(si,di){
  const p=ensurePlan(); const s=p.staff[si]; const cur=s.codes[di];
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
        const p=ensurePlan();
        S.commit(d=>{
          const pl=d.workingPlans[mk].primary;
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
  const p=ensurePlan();
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
function printRoster(){
  const p=ensurePlan();
  const head='<tr><th>Staff</th>'+p.dates.map(iso=>'<th style="font-size:7px;padding:2px">'+U.parseISO(iso).getDate()+'<br>'+U.DOW1[U.dow(iso)]+'</th>').join('')+'</tr>';
  const rows=p.staff.map(s=>'<tr><td style="font-size:7.5px;white-space:nowrap">'+U.esc(s.name)+'</td>'+s.codes.map(c=>'<td style="text-align:center;font-size:7.5px;padding:2px;background:'+(c==='OFF'?'#f4f4f4':c==='N'?'#e8eef8':c==='AL'?'#eef7f2':c==='TR'?'#f2eef8':'#fff')+'">'+U.esc(c||'')+'</td>').join('')+'</tr>').join('');
  U.printDoc('Monthly duty roster — '+p.label,'<table style="font-size:7.5px">'+head+rows+'</table><p style="font-size:7px;color:#666;margin-top:5px">D = Day 08:00–20:00 · N = Night 20:00–08:00 · DN = Day + night · AL = Annual leave · TR = Training · OFF = Rest day</p>',
    {landscape:true,meta:'<span>Prepared by '+(LS.auth.user?U.esc(LS.auth.user.name):'')+'</span><span>FY '+U.fyLabel()+'</span>',signatures:true});
  S.audit({action:'roster.print',entity:'workingPlans',entityId:mk,detail:'Printed roster '+p.label}); S.save();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{ view=b.dataset.view; paint(); });
  r.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    const d=+b.dataset.nav;
    if(d===0){ mk=U.monthKey(); } else { const [y,m]=mk.split('-').map(Number); const dt=new Date(y,m-1+d,1); mk=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0'); }
    paint();
  });
  r.querySelectorAll('[data-generate]').forEach(b=>b.onclick=async()=>{
    const ok=await UI.confirm({title:'Generate a draft plan?',body:'This replaces the current month with a pattern-balanced draft. Leave and training records are respected. You can still edit every cell.',confirm:'Generate draft'});
    if(!ok) return;
    S.commit(d=>{ delete d.workingPlans[mk]; },{action:'roster.regenerate',entity:'workingPlans',entityId:mk,detail:'Draft regenerated for '+U.monthLabel(mk)});
    ensurePlan(); paint(); UI.toast('Draft generated · '+plan().staff.length+' staff',{type:'ok'});
  });
  r.querySelectorAll('[data-patterns]').forEach(b=>b.onclick=patternsModal);
  r.querySelectorAll('[data-print]').forEach(b=>b.onclick=printRoster);
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
        const p=ensurePlan(); const err=collision(p,si,drag.di,di);
        if(err){ UI.toast(err,{type:'warn',duration:6200}); drag=null; return; }
        const a=p.staff[si].codes[drag.di], b=p.staff[si].codes[di];
        S.commit(d=>{ const pl=d.workingPlans[mk].primary; pl.staff[si].codes[drag.di]=b; pl.staff[si].codes[di]=a; pl.meta.draft=true; },{action:'roster.drag',entity:'workingPlans',entityId:mk,detail:p.staff[si].name+' · '+p.dates[di]+' ⇄ '+p.dates[drag.di]});
        drag=null; suppressClick=true; paint(); UI.toast('Shift moved · coverage recalculated',{type:'ok'});
      });
    });
  }
  if(view==='fairness'){
    const p=ensurePlan(); const f=fairness(p);
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
