/* ============================================================================
   MODULE · LEAVE & TIMELINE — annual-leave plan book, authorised leave,
   requests, coverage, fiscal-year Gantt
   Wording: annual leave and authorised leave are records; "absent" is used only
   for an unexplained absence, which is an offence under Rwandan labour law.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.leave=M;
let rootEl=null, tab='plan', fy=null;

const TYPE={AL:{label:'Annual',cls:'al',kind:'annual'},
  SICK:{label:'Sick',cls:'sick',kind:'authorised'},
  MAT:{label:'Maternity',cls:'mat',kind:'authorised'},
  TR:{label:'Training',cls:'tr',kind:'authorised'},
  STUDY:{label:'Study',cls:'tr',kind:'authorised'},
  W:{label:'Wedding / rest',cls:'w',kind:'authorised'},
  COMP:{label:'Compassionate',cls:'al',kind:'authorised'},
  UNPAID:{label:'Unpaid',cls:'w',kind:'authorised'}};
/* Requests are entered by people. The module never seeds demo requests: an
   empty inbox stays empty and says so. */
function ensureRequests(){ /* no-op by design — see the empty state instead */ }
function days(l){ return U.daysBetween(l.from,l.to)+1; }
function tOf(l){ return TYPE[l.type]||{label:S.leaveTypeLabel(l.type),cls:'al',kind:'annual'}; }
/* Always derived from the dates: a label typed into the form can never move a
   record into a fiscal year the person was not actually away in. */
function fyOfLeave(l){ return U.fyInfo(l.from||l.to||U.todayISO()).label; }
function currentFy(){ return fy||U.fyLabel(); }
function fyList(){ return S.leaveFys(); }
function onLeaveToday(){ const t=U.todayISO(); return S.leaves().filter(l=>l.status!=='Declined'&&l.status!=='Rejected'&&t>=l.from&&t<=l.to); }
function pending(){ return S.leaves().filter(l=>l.status==='Pending'); }

/* Everyone who is NOT on a shift today, with the honest reason: leave, off
   (a rest day on the working plan), or a blank cell (never rostered). */
function offToday(){
  const iso=U.todayISO();
  const covered=S.planCovers(iso);
  return S.activeStaff().map(s=>{
    const lv=S.leaveFor(s,iso);
    if(lv) return {staff:s,kind:'leave',label:tOf(lv).label+' leave',
      detail:(S.leaveKind(lv.type)==='annual'?'Annual':'Authorised')+' · returns '+U.fmtDate(lv.backOn||U.addDays(lv.to,1))};
    const code=S.codeFor(s,iso);
    if(code==='OFF'||code==='W') return {staff:s,kind:'off',label:'Off duty',detail:'At home — rest day on the working plan'};
    if(!code && covered) return {staff:s,kind:'blank',label:'Not rostered',detail:'No shift on the published working plan'};
    return null;
  }).filter(Boolean);
}
function approvalWindow(l){
  const start=U.daysBetween(U.todayISO(),l.from);
  if(start<0) return {state:'running',label:'Already started',tone:'blue'};
  if(start<=7) return {state:'due',label:'Approval due — starts in '+start+'d',tone:'amber'};
  return {state:'later',label:'Starts in '+start+'d',tone:'slate'};
}
function conflicts(l){
  const active=S.activeStaff();
  const overlapping=active.filter(s=>s.id!==l.staffId && S.leaves().some(x=>x.staffId===s.id&&x.status!=='Declined'&&!(x.to<l.from||x.from>l.to)));
  const min=Math.max(1,(S.settings().coverWeekdayDay||3)-1);
  const remaining=active.length-overlapping.length-1;
  if(remaining<min) return {level:'block', text:remaining+' staff would remain available ('+overlapping.length+' also away) — below the '+min+'-person minimum.'};
  if(overlapping.length) return {level:'warn', text:overlapping.length+' colleague(s) already away in the same window: '+overlapping.map(s=>s.name.split(' ')[0]).join(', ')+'.'};
  return {level:'ok', text:'No coverage conflict detected.'};
}

/* ——— KPIs ————————————————————————————————— */
function kpis(){
  const today=onLeaveToday();
  const offs=offToday();
  const annual=U.sum(S.leaves().filter(l=>l.status!=='Pending'&&S.leaveCountsAgainstEntitlement(l.type)&&fyOfLeave(l)===currentFy()),days);
  const unauth=(S.db().absences||[]).length;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'On leave today',value:today.length,icon:'plane-takeoff',formatted:'0',
      note:today.map(l=>(S.staffById(l.staffId)||{}).name||'').map(n=>n.split(' ')[0]).filter(Boolean).join(', ')||'Nobody on leave',
      spark:C.spark([1,0,1,2,1,0,1,1,2,1,1,today.length],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Off duty today',value:offs.filter(o=>o.kind!=='leave').length,icon:'moon',formatted:'0',
      note:offs.filter(o=>o.kind==='off').length+' rest day · '+offs.filter(o=>o.kind==='blank').length+' not rostered',
      spark:C.spark([2,2,3,2,3,2,3,3,2,3,2,offs.length],{color:'var(--slate,var(--text-faint))'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Annual leave · FY '+currentFy(),value:annual,unit:'days',icon:'calendar-check',formatted:'0',
      note:'Charged to the entitlement, not to absence',spark:C.spark([2,5,8,12,14,18,20,24,28,31],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Unexcused absences',value:unauth,icon:'shield-alert',formatted:'0',
      note:unauth?'Recorded separately — a disciplinary matter':'None on record',spark:C.spark([0,0,0,0,0,0,0,0,0,0,0,unauth],{color:unauth?'var(--crit)':'var(--pos)'})})+'</div></div>';
}

/* ——— Plan book: annual leave per person, per fiscal year ————— */
function planBookView(){
  const book=(S.db().leavePlans&&S.db().leavePlans.fy)||currentFy();
  const rows=S.activeStaff().map(s=>S.leaveBook(s,currentFy()));
  const totals=rows.reduce((a,r)=>({ent:a.ent+r.entitlement.days,carry:a.carry+r.carry.days,taken:a.taken+r.taken,planned:a.planned+r.planned,bal:a.bal+r.balance}),{ent:0,carry:0,taken:0,planned:0,bal:0});
  return '<div class="row between wrap gap-sm" style="margin-bottom:10px">'
    +'<div class="row gap-sm"><span class="xs faint">Fiscal year</span><div class="seg">'+fyList().map(f=>'<button data-fy="'+f+'" class="'+(f===currentFy()?'on':'')+'">FY '+f+'</button>').join('')+'</div></div>'
    +'<div class="row gap-sm">'+(totals.carry?'<span class="pill gold">'+totals.carry+'d carried in</span>':'')+'<span class="pill gold">'+totals.taken+' taken</span><span class="pill blue">'+totals.planned+' booked</span><span class="pill teal">'+totals.bal+' days left</span>'
    +'<button class="btn sm primary" data-newplan>'+UI.ic('plus',13)+'Add leave plan</button></div></div>'
   +'<div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('calendar-check',14,'ic')+'Annual leave plan book · FY '+currentFy()+'</div><div class="card-sub">Entitlement by contract · days already taken · days booked ahead · plan a block for any month</div></div></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Staff</th><th>Contract</th><th class="num">Entitlement</th><th class="num" title="Unused days carried in from the previous fiscal year">Carried in</th><th class="num">Taken</th><th class="num">On leave now</th><th class="num">Booked ahead</th><th class="num">Balance</th><th>Planned blocks</th><th></th></tr></thead><tbody>'
   +rows.map(r=>{
      const blocks=r.annual.slice().sort((a,b)=>String(a.from).localeCompare(String(b.from)));
      return '<tr><td><div class="row gap-sm">'+U.avatar(r.staff.name,'sm')+'<div><div class="small">'+U.esc(r.staff.name)+'</div><div class="xs faint">'+U.esc(r.staff.role||'')+'</div></div></div></td>'
      +'<td><span class="pill '+(r.entitlement.kind==='contractual'?'blue':'teal')+'">'+U.esc(r.entitlement.label)+'</span><div class="xs faint" style="margin-top:2px">'+U.esc(r.entitlement.sponsor)+'</div></td>'
      +'<td class="num">'+r.entitlement.days+' <span class="xs faint">'+(r.entitlement.workingDays?'wd':'d')+'</span></td>'
      +'<td class="num">'+(r.carry.days?'<span class="pill gold mono" title="Unused in FY '+U.esc(r.carry.prevFy||'')+'">'+r.carry.days+'d</span>':'<span class="faint">—</span>')+'</td>'
      +'<td class="num">'+r.taken+'</td>'
      +'<td class="num">'+(r.running? '<span class="pill amber">'+r.running+'d</span>':'<span class="faint">—</span>')+'</td>'
      +'<td class="num">'+r.planned+'</td>'
      +'<td class="num"><b style="color:'+(r.balance>0?'var(--pos)':(r.over?'var(--crit)':'var(--text-faint)'))+'">'+r.balance+'</b>'+(r.over?'<div class="xs" style="color:var(--crit)">+'+r.over+' over</div>':'')+'</td>'
      +'<td style="max-width:250px">'+(blocks.length? blocks.map(l=>'<button class="chip" data-editplan="'+l.id+'" style="margin:0 3px 3px 0;cursor:pointer" title="Edit this block">'+U.fmtDateShort(l.from)+'–'+U.fmtDateShort(l.to)+' <span class="faint">'+S.leaveDays(r.staff,l)+'d</span></button>').join('') : '<span class="xs faint">No block booked</span>')+'</td>'
      +'<td><button class="icon-btn" style="width:26px;height:26px" data-newplan="'+r.staff.id+'" aria-label="Plan leave for '+U.esc(r.staff.name)+'">'+UI.ic('plus',13)+'</button></td></tr>';
   }).join('')
   +'</tbody></table></div><div class="card-foot"><span>Entitlement follows the contract: under statute 30 calendar days, contractual 21 working days. A block is charged to the fiscal year its dates fall in — never to a label typed on it — and unused days are carried into the next year.</span><span class="mono">'+rows.length+' staff</span></div></div>'
   +'<div class="grid-12" style="margin-top:14px">'
     +'<div class="c7">'+forecastCard()+'</div>'
     +'<div class="c5">'+whoOffCard()+'</div>'
   +'</div>';
}

/* Per-person authorised-leave forecast, phrased from each person's own records. */
function forecastCard(){
  const rows=S.activeStaff().map(s=>S.staffLeaveForecast(s,180));
  return UI.card({title:'Authorised leave & absence forecast',sub:'Per staff member · next 180 days · built from that person\'s own records',icon:'calendar-days',
    tools:'<span class="pill slate">'+rows.filter(r=>r.unexcused.length).length+' with unexcused absence</span>',
    body:rows.map(r=>{
      const b=r.book;
      return '<div class="card pad" style="background:var(--surface-inset);margin-bottom:9px">'
        +'<div class="row between wrap gap-sm" style="align-items:flex-start"><div class="row gap-sm">'+U.avatar(r.staff.name,'sm')+'<div><div class="strong" style="font-size:12.5px">'+U.esc(r.staff.name)+'</div><div class="xs faint">'+U.esc(r.staff.role||'')+'</div></div></div>'
        +'<span class="pill '+r.tone+'">'+U.esc(r.label)+'</span></div>'
        +'<div class="xs muted" style="margin-top:7px;line-height:1.55">'+U.esc(r.detail)+'</div>'
        +'<div class="row wrap gap-sm" style="margin-top:8px">'
          +'<span class="pill teal">Annual leave '+b.taken+'d taken · '+b.planned+'d booked</span>'
          +(b.authorisedDays?'<span class="pill blue">Authorised leave '+b.authorisedDays+'d</span>':'')
          +(r.unexcused.length?'<span class="pill rose">Unexcused '+r.unexcusedDays+'d</span>':'')
          +'<span class="pill slate">Balance '+b.balance+'d / '+b.entitlement.days+'</span>'
        +'</div>'
        +'<div style="margin-top:8px">'+UI.meter(U.clamp((b.taken+b.planned)/Math.max(1,b.entitlement.days)*100,0,100),b.over?'rose':'teal')+'</div>'
        +'<div class="xs faint" style="margin-top:4px">FY '+r.fy+': '+b.charged+' of '+b.entitlement.days+' days charged'+(r.prev.charged?' · FY '+r.prevFy+': '+r.prev.charged+'d':'')+'</div>'
      +'</div>';
    }).join('')
    +'<div class="hint">A person is only described as <b>absent</b> when an unexcused-absence record exists. Everything else is annual leave or authorised leave with a date.</div>',
    foot:'<span>Annual leave · authorised leave · unexcused absence — never mixed</span><span class="mono">180 days</span>'});
}

/* Who is off today: leave, a rest day on the plan, or a day never rostered. */
function whoOffCard(){
  const rows=offToday();
  const covers=S.planCovers(U.todayISO());
  return UI.card({title:"Who's off today",sub:U.fmtDateLong()+' · leave, rest days and days not rostered',icon:'users',
    tools:'<span class="pill '+(covers?'blue':'amber')+'">'+(covers?'Working plan published':'No working plan today')+'</span>',
    body:rows.length? rows.map(o=>
        '<div class="list-row">'+U.avatar(o.staff.name,'sm')
        +'<div class="lr-main"><div class="lr-title">'+U.esc(o.staff.name)+'</div><div class="lr-sub">'+U.esc(o.detail)+'</div></div>'
        +'<span class="pill '+(o.kind==='leave'?'blue':o.kind==='off'?'slate':'amber')+'">'+U.esc(o.label)+'</span></div>').join('')
      : '<p class="xs faint">Everyone on the establishment is on a shift today.</p>',
    foot:'<span>Rest days come from the working plan; blank cells mean the person was never rostered</span><span class="mono">'+rows.length+' people</span>'});
}

/* ——— Annual-leave plan editor ————————————————— */
function planModal(staffId, leaveId){
  if(!LS.auth.guard('edit')) return;
  const l=leaveId? S.leaves().find(x=>x.id===leaveId):null;
  const staff=S.activeStaff();
  const sel=staffId||(l&&l.staffId)||staff[0].id;
  const who=staff.find(s=>s.id===sel)||staff[0];
  const ent=S.leaveEntitlement(who);
  const fys=U.uniq(fyList().concat([U.fyLabel(),U.fyInfo(U.addDays(U.todayISO(),-400)).label])).sort().reverse();
  UI.modal({title:l?'Edit leave plan':'Add an annual-leave plan',
    sub:'Plan a block now, for this fiscal year or the one still being taken. The working plan is never rewritten — the block is an overlay with a date on it.',
    width:'min(640px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field span2"><label>Staff member</label><select class="select" id="plStaff">'+staff.map(s=>'<option value="'+s.id+'"'+(sel===s.id?' selected':'')+'>'+U.esc(s.name)+' · '+U.esc(s.role||'')+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Leave type</label><select class="select" id="plType">'+Object.keys(TYPE).map(k=>'<option value="'+k+'"'+((l&&l.type===k)?' selected':'')+'>'+TYPE[k].label+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Charged to fiscal year</label><select class="select" id="plFy" disabled>'+fys.map(f=>'<option value="'+f+'"'+((l?fyOfLeave(l):currentFy())===f?' selected':'')+'>FY '+f+'</option>').join('')+'</select><div class="xs faint" style="margin-top:4px">Follows the start date — a record can never sit under the wrong year.</div></div>'
      +'<div class="field"><label>From</label><input class="input" type="date" id="plFrom" value="'+(l?l.from:U.addDays(U.todayISO(),30))+'"></div>'
      +'<div class="field"><label>To</label><input class="input" type="date" id="plTo" value="'+(l?l.to:U.addDays(U.todayISO(),44))+'"></div>'
      +'<div class="field"><label>Status</label><select class="select" id="plStatus">'+['Planned','Approved','Pending'].map(x=>'<option '+(l&&l.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Entitlement</label><input class="input" value="'+ent.days+' days · '+ent.label+'" readonly></div>'
      +'<div class="field span2"><label>Note</label><input class="input" id="plNote" value="'+U.esc(l?l.note||'':'')+'" placeholder="e.g. carry-over from last FY, second installment, approval reference"></div>'
      +'</div>'
      +'<div class="hint" style="margin-top:10px" id="plSummary"></div>',
    foot:'<button class="btn" data-close>Cancel</button>'+(l?'<button class="btn danger" data-del>'+UI.ic('trash-2',15)+'Remove</button>':'')+'<button class="btn primary" data-save>'+UI.ic('check',15)+'Save plan</button>',
    onMount:(el,close)=>{
      const q=s=>el.querySelector(s);
      const summary=()=>{
        const s=staff.find(x=>x.id===q('#plStaff').value)||who;
        const from=q('#plFrom').value, to=q('#plTo').value, f=q('#plFy').value;
        if(!from||!to||to<from){ q('#plSummary').innerHTML='Pick a start and end date — the end cannot precede the start.'; return; }
        const n=U.daysBetween(from,to)+1;
        const derived=U.fyInfo(from).label;
        q('#plFy').value=derived;
        const b=S.leaveBook(s,derived);
        const overlap=S.leaves().find(x=>x.id!==(l&&l.id)&&x.staffId===s.id&&!(x.to<from||x.from>to));
        const after=Math.max(0,b.balance-(S.leaveCountsAgainstEntitlement(q('#plType').value)?n:0));
        q('#plSummary').innerHTML='<b style="color:var(--text)">'+n+' day'+(n===1?'':'s')+'</b> on '+U.esc(s.name)+' · charges FY '+derived
          +(b.carry.days?' (includes '+b.carry.days+'d carried in from '+U.esc(b.carry.prevFy)+')':'')
          +' · balance after booking <b style="color:var(--text)">'+after+' of '+b.pool+'</b>.'
          +(overlap?'<br><span style="color:var(--warn)">Overlaps an existing block ('+U.fmtDate(overlap.from)+' – '+U.fmtDate(overlap.to)+'): '+U.esc(overlap.status||'Planned')+'.</span>':'');
      };
      ['#plStaff','#plFrom','#plTo','#plFy','#plType'].forEach(s=>{ q(s).addEventListener('change',summary); q(s).addEventListener('input',summary); });
      summary();
      q('[data-save]').onclick=()=>{
        const id=q('#plStaff').value, from=q('#plFrom').value, to=q('#plTo').value;
        if(!from||!to) return UI.toast('Pick both dates',{type:'warn'});
        if(to<from) return UI.toast('End date cannot precede start date',{type:'warn'});
        const rec={staffId:id,type:q('#plType').value,from,to,backOn:U.addDays(to,1),
          fy:U.fyInfo(from).label,status:q('#plStatus').value,
          note:q('#plNote').value.trim(),requested:(l?l.requested:U.nowISO()),plannedBy:LS.auth.user.name,plannedAt:U.nowISO()};
        S.commit(d=>{
          if(l){ const x=(d.leaves||[]).find(y=>y.id===l.id); if(x) Object.assign(x,rec); }
          else { d.leaves=d.leaves||[]; d.leaves.push(Object.assign({id:U.uid('l')},rec)); }
        },{action:l?'leave.plan.edit':'leave.plan.add',entity:'leave',entityId:l?l.id:id,
          detail:(l?'Edited':'Planned')+' '+rec.type+' '+from+' → '+to+' (FY '+rec.fy+')'});
        close(); LS.shell.refresh();
        UI.toast(l?'Leave plan updated':'Leave plan added · '+(rec.status||'Planned'),{type:'ok'});
      };
      const del=q('[data-del]');
      if(del) del.onclick=async()=>{
        const ok=await UI.confirm({title:'Remove this leave plan?',body:'The block '+U.fmtDate(l.from)+' – '+U.fmtDate(l.to)+' will be removed from the register. The audit trail keeps the record of the change.',confirm:'Remove',danger:true});
        if(!ok) return;
        S.commit(d=>{ d.leaves=(d.leaves||[]).filter(y=>y.id!==l.id); },{action:'leave.plan.remove',entity:'leave',entityId:l.id,detail:'Removed leave plan '+l.from+' → '+l.to});
        close(); LS.shell.refresh(); UI.toast('Leave plan removed',{type:'warn'});
      };
    }});
}

/* ——— Requests inbox ————————————————————— */
function requestsView(){
  const list=pending().sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  const today=onLeaveToday();
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Leave requests',sub:'Approve or decline · conflict checks run automatically',icon:'inbox',
    tools:'<span class="pill '+(list.length?'amber':'teal')+'">'+list.length+' pending</span>',
    body:list.length?list.map(l=>{ const s=S.staffById(l.staffId)||{name:'Unknown'}; const c=conflicts(l); const t=tOf(l);
      return '<div class="card pad" style="margin-bottom:10px;background:var(--surface-inset)"><div class="row between wrap" style="align-items:flex-start;gap:10px">'
       +'<div class="row gap-sm">'+U.avatar(s.name,'sm')+'<div><div class="strong" style="font-size:12.5px">'+U.esc(s.name)+'</div><div class="xs faint">'+U.esc(s.role||'')+' · requested '+U.relTime(l.requested||l.from)+'</div></div></div>'
       +'<div class="row gap-sm"><span class="gantt-bar '+t.cls+'" style="position:static;height:20px;padding:0 8px;font-size:9px">'+U.esc(t.label)+'</span><span class="pill slate mono">'+days(l)+'d</span></div></div>'
       +'<div class="row between wrap" style="margin-top:10px"><span class="small">'+U.fmtDate(l.from)+' → '+U.fmtDate(l.to)+'</span><span class="xs faint">back on '+U.fmtDate(l.backOn||U.addDays(l.to,1))+'</span></div>'
       +'<div class="row gap-sm wrap" style="margin-top:8px"><span class="pill '+(c.level==='ok'?'teal':c.level==='warn'?'amber':'rose')+'">'+UI.ic(c.level==='ok'?'check':'alert-triangle',10)+c.level+'</span><span class="xs" style="color:var(--text-muted)">'+U.esc(c.text)+'</span><span class="pill '+approvalWindow(l).tone+'">'+UI.ic('calendar-clock',10)+U.esc(approvalWindow(l).label)+'</span></div>'
       +(l.note?'<div class="hint" style="margin-top:6px">'+U.esc(l.note)+'</div>':'')
       +'<div class="row gap-sm" style="margin-top:10px;justify-content:flex-end"><button class="btn xs" data-decline="'+l.id+'">Decline</button><button class="btn xs primary" data-approve="'+l.id+'" '+(c.level==='block'?'aria-disabled="true"':'')+'>'+UI.ic('check',12)+'Approve</button></div></div>';
    }).join(''):UI.empty({art:'calendar',title:'No leave requests waiting',body:'No leave request has been recorded yet. Requests entered here wait for your decision — approve them in the week before the leave starts; the working plan is never rewritten, the approval is applied as an overlay.',action:'<button class="btn primary" data-new>'+UI.ic('plus',14)+' Record a request</button>'}),
    foot:'<span>Approvals update the Working Plan immediately</span><button class="btn xs" data-new>'+UI.ic('plus',12)+'New request</button>'})+'</div>'
   +'<div class="c4"><div class="col" style="gap:14px">'
     +whoOffCard()
     +UI.card({title:'On leave now',sub:'Approved and planned blocks covering today',icon:'plane-takeoff',
        body:today.length?today.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; const t=tOf(l);
          return '<div class="list-row">'+U.avatar(s.name,'sm')+'<div class="lr-main"><div class="lr-title">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc(t.label)+' · returns '+U.fmtDate(l.backOn||U.addDays(l.to,1))+'</div></div><span class="pill blue">'+S.leaveDays(s,l)+'d</span></div>'; }).join(''):'<p class="xs faint">Nobody is on leave today.</p>'})
   +'</div></div></div>';
}

/* ——— Timeline ————————————————————————— */
function timelineView(){
  const staff=S.activeStaff();
  const fyStart=U.fyInfo().start, fyEnd=U.fyInfo().end;
  const start=fyStart, end=fyEnd;
  const total=U.daysBetween(start,end)+1;
  const months=[]; let cur=U.parseISO(start);
  while(cur<=U.parseISO(end)){ months.push(U.MONTHS[cur.getMonth()].slice(0,3)); cur=new Date(cur.getFullYear(),cur.getMonth()+1,1); }
  const rows=staff.map(s=>{
    const leaves=S.leaves().filter(l=>l.staffId===s.id&&l.status!=='Declined'&&l.to>=start&&l.from<=end);
    return '<div class="gantt-row"><div class="gantt-label">'+U.avatar(s.name,'sm')+'<span class="truncate">'+U.esc(s.name)+'</span></div><div class="gantt-track">'
      +leaves.map(l=>{ const t=tOf(l);
        const from=Math.max(U.daysBetween(start,l.from),0), to=Math.min(U.daysBetween(start,l.to),total-1);
        const left=from/total*100, width=Math.max(0.6,(to-from+1)/total*100);
        return '<div class="gantt-bar '+t.cls+'" style="left:'+left+'%;width:'+width+'%" data-tip="'+U.esc(t.label+' · '+U.fmtDate(l.from)+' → '+U.fmtDate(l.to))+'" data-editplan="'+l.id+'">'+U.esc(t.label)+'</div>'; }).join('')
      +'</div></div>';
  }).join('');
  return UI.card({title:'Leave timeline · FY '+U.fyInfo().label,sub:'Type-coloured Gantt across the fiscal year · click a bar to edit the plan',icon:'calendar-days',
    tools:'<div class="row gap-sm"><span class="gantt-bar al" style="position:static;width:16px;height:8px"></span><span class="xs faint">Annual</span><span class="gantt-bar sick" style="position:static;width:16px;height:8px"></span><span class="xs faint">Sick</span><span class="gantt-bar tr" style="position:static;width:16px;height:8px"></span><span class="xs faint">Authorised</span><span class="gantt-bar mat" style="position:static;width:16px;height:8px"></span><span class="xs faint">Maternity</span></div>',
    body:'<div style="overflow-x:auto"><div style="min-width:680px"><div class="gantt-months">'+months.map(m=>'<span>'+m+'</span>').join('')+'</div><div class="gantt">'+rows+'</div></div></div>',
    foot:'<span>Hover a bar for exact dates · click to edit</span><span class="mono">'+S.leaves().length+' records</span>'});
}
function recordsView(){
  const list=S.leaves().slice().sort((a,b)=>String(b.from).localeCompare(String(a.from)));
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="lvSearch" placeholder="Search staff, type, note…"></div><span class="grow"></span><button class="btn sm" data-export>'+UI.ic('download',13)+'Export register</button><button class="btn sm" data-print>'+UI.ic('printer',13)+'Print records</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="lvTable"><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>FY charged</th><th>Status</th><th class="hide-sm">Note</th><th></th></tr></thead><tbody>'
   +list.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; const t=tOf(l);
     return '<tr><td><div class="row gap-sm">'+U.avatar(s.name,'sm')+'<span class="small">'+U.esc(s.name)+'</span></div></td>'
      +'<td><span class="gantt-bar '+t.cls+'" style="position:static;height:18px;padding:0 7px;font-size:9px;display:inline-flex">'+U.esc(t.label)+'</span></td>'
      +'<td class="num">'+U.fmtDate(l.from)+'</td><td class="num">'+U.fmtDate(l.to)+'</td><td class="num">'+days(l)+'</td>'
      +'<td class="num mono xs">'+U.esc(fyOfLeave(l))+'</td>'
      +'<td><span class="pill '+(l.status==='Pending'?'amber':/declin|reject/i.test(l.status)?'rose':'teal')+'">'+U.esc(l.status||'Approved')+'</span></td>'
      +'<td class="small hide-sm truncate" style="max-width:250px">'+U.esc(l.note||'—')+'</td>'
      +'<td><button class="icon-btn" style="width:26px;height:26px" data-editplan="'+l.id+'" aria-label="Edit">'+UI.ic('pencil',13)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+list.length+' leave records · FY '+currentFy()+'</span><span class="mono">Append-only history</span></div></div></div></div>';
}
function newRequest(){
  if(!LS.auth.guard('edit')) return;
  UI.modal({title:'Request leave',sub:'Runs a coverage check before submitting.',body:
    '<div class="form-grid"><div class="field span2"><label>Staff</label><select class="select" id="lvStaff">'+S.activeStaff().map(s=>'<option value="'+s.id+'">'+U.esc(s.name)+'</option>').join('')+'</select></div>'
    +'<div class="field"><label>Type</label><select class="select" id="lvType">'+Object.keys(TYPE).map(k=>'<option value="'+k+'">'+TYPE[k].label+'</option>').join('')+'</select></div>'
    +'<div class="field"><label>From</label><input class="input mono" type="date" id="lvFrom" value="'+U.addDays(U.todayISO(),3)+'"></div>'
    +'<div class="field"><label>To</label><input class="input mono" type="date" id="lvTo" value="'+U.addDays(U.todayISO(),5)+'"></div>'
    +'<div class="field"><label>Note</label><input class="input" id="lvNote" placeholder="Reason / attachment reference"></div></div>'
    +'<div id="lvCheck" class="hint" style="margin-top:10px"></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-send>Submit request</button>',
    onMount:(el,close)=>{
      const check=()=>{ const l={staffId:el.querySelector('#lvStaff').value,from:el.querySelector('#lvFrom').value,to:el.querySelector('#lvTo').value};
        const c=conflicts(l); const box=el.querySelector('#lvCheck'); box.innerHTML=c.text; box.style.color=c.level==='block'?'var(--crit)':c.level==='warn'?'var(--warn)':'var(--pos)'; };
      ['#lvStaff','#lvFrom','#lvTo'].forEach(s=>el.querySelector(s).addEventListener('change',check)); check();
      el.querySelector('[data-send]').onclick=()=>{
        const from=el.querySelector('#lvFrom').value,to=el.querySelector('#lvTo').value;
        if(to<from) return UI.toast('End date cannot precede start date',{type:'warn'});
        const l={id:U.uid('l'),staffId:el.querySelector('#lvStaff').value,type:el.querySelector('#lvType').value,from,to,backOn:U.addDays(to,1),status:'Pending',fy:U.fyInfo(from).label,note:el.querySelector('#lvNote').value,requested:U.nowISO()};
        S.commit(d=>{ d.leaves.push(l); },{action:'leave.request',entity:'leave',entityId:l.id,detail:'Leave request '+from+' → '+to});
        close(); tab='requests'; paint(); UI.toast('Leave request submitted',{type:'ok'});
      };
    }});
}
function decide(id, approve){
  const l=S.leaves().find(x=>x.id===id); if(!l) return;
  const c=conflicts(l);
  if(approve && c.level==='block') return UI.toast(c.text,{type:'err',duration:6000});
  S.commit(d=>{ const x=d.leaves.find(y=>y.id===id); if(x){ x.status=approve?'Approved':'Declined'; x.decidedBy=LS.auth.user.name; x.decidedAt=U.nowISO(); } },
    {action:'leave.'+(approve?'approve':'decline'),entity:'leave',entityId:id,detail:(approve?'Approved':'Declined')+' leave for '+(S.staffById(l.staffId)||{}).name+' · '+U.fmtDate(l.from)+'–'+U.fmtDate(l.to)});
  paint(); UI.toast(approve?'Leave approved · roster updated':'Request declined',{type:approve?'ok':'warn',actions:approve?[{label:'Undo',onClick:()=>{ S.commit(d=>{ const x=d.leaves.find(y=>y.id===id); if(x) x.status='Pending'; },{action:'leave.undo',entity:'leave',entityId:id,detail:'Approval reverted'}); paint(); UI.toast('Approval reverted',{type:'info'}); }}]:undefined});
}
function paint(){
  const host=rootEl.querySelector('#lvBody'); if(!host) return;
  host.innerHTML=tab==='plan'?planBookView():tab==='requests'?requestsView():tab==='timeline'?timelineView():recordsView();
  U.$$('[data-lv-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.lvTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-lv-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.lvTab; paint(); });
  r.querySelectorAll('[data-fy]').forEach(b=>b.onclick=()=>{ fy=b.dataset.fy; try{ S.commit(d=>{ d.leavePlans=d.leavePlans||{}; d.leavePlans.fy=fy; },{action:'leave.view.fy',entity:'leave',detail:'Plan book viewed for FY '+fy}); }catch(e){} paint(); });
  r.querySelectorAll('[data-newplan]').forEach(b=>b.onclick=()=>planModal(b.dataset.newplan||null,null));
  r.querySelectorAll('[data-editplan]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const id=b.dataset.editplan; const l=S.leaves().find(x=>x.id===id); if(l) planModal(l.staffId,id); });
  r.querySelectorAll('[data-new]').forEach(b=>b.onclick=newRequest);
  r.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>{ if(!LS.auth.guard('approve'))return; decide(b.dataset.approve,true); });
  r.querySelectorAll('[data-decline]').forEach(b=>b.onclick=()=>{ if(!LS.auth.guard('approve'))return; decide(b.dataset.decline,false); });
  r.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{
    const list=S.leaves().slice().sort((a,b)=>String(b.from).localeCompare(String(a.from)));
    U.printDoc('Leave register — FY '+currentFy(),'<table><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>FY charged</th><th>Status</th></tr></thead><tbody>'+list.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; return '<tr><td>'+U.esc(s.name)+'</td><td>'+U.esc(tOf(l).label)+'</td><td>'+U.fmtDate(l.from)+'</td><td>'+U.fmtDate(l.to)+'</td><td>'+days(l)+'</td><td>'+U.esc(fyOfLeave(l))+'</td><td>'+U.esc(l.status||'')+'</td></tr>'; }).join('')+'</tbody></table>',{landscape:true});
  });
  r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
    const list=S.leaves();
    U.exportCSV('leave-register-'+U.todayISO()+'.csv',[['Staff','Type','From','To','Days','FY charged','Status','Note']].concat(list.map(l=>[(S.staffById(l.staffId)||{}).name||'',tOf(l).label,l.from,l.to,days(l),fyOfLeave(l),l.status||'',l.note||''])),{title:'Leave register',actor:LS.auth.user.name});
    UI.toast('Leave register exported',{type:'ok'});
  });
  const s=r.querySelector('#lvSearch'); if(s) s.addEventListener('input',()=>{ const q=s.value.toLowerCase(); U.$$('#lvTable tbody tr',r).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'); });
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'plan'; fy=(S.db().leavePlans&&S.db().leavePlans.fy)||null;
  ensureRequests();
  root.innerHTML='<div class="page-head"><div><h1>Leave &amp; timeline</h1><div class="sub">Annual leave planned by fiscal year, authorised leave recorded with a date, and a coverage check before anything is approved. Day shift 08:00–17:00 · night shift 17:00–08:00 the next day.</div></div>'
   +'<div class="actions"><button class="btn" data-print>'+UI.ic('printer',15)+' Print register</button><button class="btn primary" data-newplan>'+UI.ic('plus',15)+' Add leave plan</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['plan','Plan book'],['requests','Requests inbox'],['timeline','Timeline'],['records','Records']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-lv-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="lvBody"></div>';
  paint();
};
M.offToday=offToday;
})();
