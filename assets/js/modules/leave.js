/* ============================================================================
   MODULE · LEAVE & TIMELINE
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.leave=M;
let rootEl=null, tab='requests';
const TYPE={AL:{label:'Annual',cls:'al'},SICK:{label:'Sick',cls:'sick'},MAT:{label:'Maternity',cls:'mat'},TR:{label:'Training',cls:'tr'},STUDY:{label:'Study',cls:'tr'},W:{label:'Weekend',cls:'w'},COMP:{label:'Compassionate',cls:'al'},UNPAID:{label:'Unpaid',cls:'w'}};
/* Requests are entered by people. The module never seeds demo requests: an
   empty inbox stays empty and says so. */
function ensureRequests(){ /* no-op by design — see the empty state instead */ }
function days(l){ return U.daysBetween(l.from,l.to)+1; }
function onLeaveToday(){ const t=U.todayISO(); return S.leaves().filter(l=>l.status!=='Declined'&&l.status!=='Rejected'&&t>=l.from&&t<=l.to); }
function pending(){ return S.leaves().filter(l=>l.status==='Pending'); }
/* Approvals are normally decided in the week before the leave starts. */
function approvalWindow(l){
  const start=U.daysBetween(U.todayISO(),l.from);
  if(start<0) return {state:'running',label:'Already started',tone:'blue'};
  if(start<=7) return {state:'due',label:'Approval due — starts in '+start+'d',tone:'amber'};
  return {state:'later',label:'Starts in '+start+'d',tone:'slate'};
}
function entitlementCard(){
  const fy=U.fyLabel();
  const rows=S.activeStaff().map(s=>{ const e=S.leaveEntitlement(s,fy), used=S.leaveUsed(s,fy);
    return {s,e,used,left:Math.max(0,e.days-used.days)}; });
  return UI.card({title:'Leave entitlement',sub:'Under statute · 30 calendar days — Contractual · 21 working days',icon:'scale',
    tools:'<span class="pill slate">FY '+fy+'</span>',
    body:'<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Staff</th><th>Contract</th><th>Sponsor</th><th class="num">Entitlement</th><th class="num">Taken</th><th class="num">Balance</th></tr></thead><tbody>'
      +rows.map(r=>'<tr><td><div class="row gap-sm">'+U.avatar(r.s.name,'sm')+'<span class="small">'+U.esc(r.s.name)+'</span></div></td>'
        +'<td><span class="pill '+(r.e.kind==='contractual'?'blue':'teal')+'">'+U.esc(r.e.label)+'</span></td>'
        +'<td class="small">'+U.esc(r.e.sponsor)+'</td>'
        +'<td class="num">'+r.e.days+' '+(r.e.workingDays?'weekdays':'days')+'</td>'
        +'<td class="num">'+r.used.days+'</td>'
        +'<td class="num"><b style="color:'+(r.left>0?'var(--pos)':'var(--crit)')+'">'+r.left+'</b></td></tr>').join('')
      +'</tbody></table></div>',
    foot:'<span>Entitlement follows the contract; the sponsor names who pays for it.</span><span class="mono">'+rows.length+' staff</span>'});
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
function kpis(){
  const db=S.db();
  const fy=U.fyLabel();
  const taken=S.leaves().filter(l=>l.fy===fy||String(l.from).startsWith(fy.slice(0,4)));
  const daysTaken=U.sum(taken.filter(l=>l.status!=='Pending'),days);
  const upcoming=S.leaves().filter(l=>l.status!=='Declined'&&l.from>=U.todayISO()&&l.from<=U.addDays(U.todayISO(),30)).length;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Off today',value:onLeaveToday().length,icon:'plane-takeoff',formatted:'0',note:onLeaveToday().map(l=>(S.staffById(l.staffId)||{}).name||'').map(n=>n.split(' ')[0]).filter(Boolean).join(', ')||'Full bench',spark:C.spark([1,0,1,2,1,0,1,1,2,1,1,onLeaveToday().length],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Pending requests',value:pending().length,icon:'calendar-clock',formatted:'0',note:pending().length?'Awaiting approval':'Inbox zero',spark:C.spark([2,1,3,2,1,2,1,2,3,2,1,pending().length],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Leave days this FY',value:daysTaken,icon:'calendar-check',formatted:'0',note:taken.length+' records',spark:C.spark([2,5,8,12,14,18,20,24,28,31],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Absences next 30d',value:upcoming,icon:'calendar-days',formatted:'0',note:'Modelled on '+S.absenceHistory().months+' months of plans',spark:C.spark([1,2,1,3,2,1,2,3,2,2,3,upcoming],{color:'var(--info)'})})+'</div></div>';
}
function requestsView(){
  const list=pending().sort((a,b)=>String(a.from).localeCompare(String(b.from)));
  const today=onLeaveToday();
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Leave requests',sub:'Approve or decline · conflict checks run automatically',icon:'inbox',
    tools:'<span class="pill '+(list.length?'amber':'teal')+'">'+list.length+' pending</span>',
    body:list.length?list.map(l=>{ const s=S.staffById(l.staffId)||{name:'Unknown'}; const c=conflicts(l); const t=TYPE[l.type]||{label:l.type,cls:'al'};
      return '<div class="card pad" style="margin-bottom:10px;background:var(--surface-inset)"><div class="row between wrap" style="align-items:flex-start;gap:10px">'
       +'<div class="row gap-sm">'+U.avatar(s.name,'sm')+'<div><div class="strong" style="font-size:12.5px">'+U.esc(s.name)+'</div><div class="xs faint">'+U.esc(s.role||'')+' · requested '+U.relTime(l.requested||l.from)+'</div></div></div>'
       +'<div class="row gap-sm"><span class="gantt-bar '+t.cls+'" style="position:static;height:20px;padding:0 8px;font-size:9px">'+U.esc(t.label)+'</span><span class="pill slate mono">'+days(l)+'d</span></div></div>'
       +'<div class="row between wrap" style="margin-top:10px"><span class="small">'+U.fmtDate(l.from)+' → '+U.fmtDate(l.to)+'</span><span class="xs faint">back on '+U.fmtDate(l.backOn||U.addDays(l.to,1))+'</span></div>'
       +'<div class="row gap-sm wrap" style="margin-top:8px"><span class="pill '+(c.level==='ok'?'teal':c.level==='warn'?'amber':'rose')+'">'+UI.ic(c.level==='ok'?'check':'alert-triangle',10)+c.level+'</span><span class="xs" style="color:var(--text-muted)">'+U.esc(c.text)+'</span><span class="pill '+approvalWindow(l).tone+'">'+UI.ic('calendar-clock',10)+U.esc(approvalWindow(l).label)+'</span></div>'
       +(l.note?'<div class="hint" style="margin-top:6px">'+U.esc(l.note)+'</div>':'')
       +'<div class="row gap-sm" style="margin-top:10px;justify-content:flex-end"><button class="btn xs" data-decline="'+l.id+'">Decline</button><button class="btn xs primary" data-approve="'+l.id+'" '+(c.level==='block'?'aria-disabled="true"':'')+'>'+UI.ic('check',12)+'Approve</button></div></div>';
    }).join(''):UI.empty({art:'calendar',title:'No leave requests',body:'No leave request has been recorded yet. Requests entered here wait for your decision — approve them in the week before the leave starts; the working plan is never rewritten, the approval is applied as an overlay.',action:'<button class="btn primary" data-new>'+UI.ic('plus',14)+' Record a request</button>'}),
    foot:'<span>Approvals update the Working Plan immediately</span><button class="btn xs" data-new>'+UI.ic('plus',12)+'New request</button>'})+'</div>'
   +'<div class="c4"><div class="col" style="gap:14px">'
     +UI.card({title:"Who's off today",sub:U.fmtDateLong(),icon:'users',body:today.length?today.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'};
        return '<div class="list-row">'+U.avatar(s.name,'sm')+'<div class="lr-main"><div class="lr-title">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc((TYPE[l.type]||{}).label||l.type)+' · returns '+U.fmtDate(l.backOn||U.addDays(l.to,1))+'</div></div></div>'; }).join(''):'<p class="xs faint">Full bench is on duty today.</p>'})
     +UI.card({title:'Absence forecast',sub:'Next 30 days · from the register\'s own history',icon:'calendar-days',body:(function(){
        const f=S.absenceForecast(30), h=f.history;
        const up=S.leaveInForce().filter(l=>l.to>=U.todayISO()&&l.from<=U.addDays(U.todayISO(),30)).sort((a,b)=>String(a.from).localeCompare(String(b.from))).slice(0,5);
        if(!h.months && !h.leaveRecords) return '<p class="xs faint">No history to forecast from yet — record a month of the working plan or a leave entry and the forecast starts here.</p>';
        const basis=[];
        if(h.months) basis.push(h.months+' stored month'+(h.months===1?'':'s')+(h.from?' ('+U.monthLabel(h.from)+' → '+U.monthLabel(h.to)+')':''));
        if(h.leaveRecords) basis.push(h.leaveRecords+' leave records');
        return '<div class="row between" style="margin-bottom:8px"><span class="xs faint">Expected absent days</span><span class="mono strong">'+f.expected+'</span></div>'
          +UI.meter(Math.min(100,f.expected/Math.max(1,S.activeStaff().length*30)*100*4),'teal')
          +'<div class="xs faint" style="margin-top:6px">'+Math.round(h.rate*1000)/10+'% of rostered days were leave or absence across '+basis.join(' · ')+'. '+f.planned+' approved block'+(f.planned===1?'':'s')+' already booked ('+f.plannedDays+'d).</div>'
          +(up.length?'<div class="thread" style="margin:10px 0"></div>'+up.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.fmtDateShort(l.from)+' – '+U.fmtDateShort(l.to)+'</div></div><span class="pill '+(l.status==='Pending'?'amber':'slate')+'">'+days(l)+'d</span></div>'; }).join(''):'');
      })()})
   +'</div></div></div>'
   +'<div class="grid-12" style="margin-top:14px"><div class="c12">'+entitlementCard()+'</div></div>';
}
function timelineView(){
  const staff=S.activeStaff();
  const fy=U.fyInfo();
  const start=fy.start, end=fy.end;
  const total=U.daysBetween(start,end)+1;
  const months=[]; let cur=U.parseISO(start);
  while(cur<=U.parseISO(end)){ months.push(U.MONTHS[cur.getMonth()].slice(0,3)); cur=new Date(cur.getFullYear(),cur.getMonth()+1,1); }
  const rows=staff.map(s=>{
    const leaves=S.leaves().filter(l=>l.staffId===s.id&&l.status!=='Declined'&&l.to>=start&&l.from<=end);
    return '<div class="gantt-row"><div class="gantt-label">'+U.avatar(s.name,'sm')+'<span class="truncate">'+U.esc(s.name)+'</span></div><div class="gantt-track">'
      +leaves.map(l=>{ const t=TYPE[l.type]||{label:l.type,cls:'al'};
        const from=Math.max(U.daysBetween(start,l.from),0), to=Math.min(U.daysBetween(start,l.to),total-1);
        const left=from/total*100, width=Math.max(0.6,(to-from+1)/total*100);
        return '<div class="gantt-bar '+t.cls+'" style="left:'+left+'%;width:'+width+'%" data-tip="'+U.esc(t.label+' · '+U.fmtDate(l.from)+' → '+U.fmtDate(l.to))+'">'+U.esc(t.label)+'</div>'; }).join('')
      +'</div></div>';
  }).join('');
  return UI.card({title:'Leave timeline · FY '+fy.label,sub:'Type-coloured Gantt across the fiscal year',icon:'calendar-days',
    tools:'<div class="row gap-sm"><span class="gantt-bar al" style="position:static;width:16px;height:8px"></span><span class="xs faint">Annual</span><span class="gantt-bar sick" style="position:static;width:16px;height:8px"></span><span class="xs faint">Sick</span><span class="gantt-bar tr" style="position:static;width:16px;height:8px"></span><span class="xs faint">Training</span><span class="gantt-bar mat" style="position:static;width:16px;height:8px"></span><span class="xs faint">Maternity</span></div>',
    body:'<div style="overflow-x:auto"><div style="min-width:680px"><div class="gantt-months">'+months.map(m=>'<span>'+m+'</span>').join('')+'</div><div class="gantt">'+rows+'</div></div></div>',
    foot:'<span>Hover a bar for exact dates</span><span class="mono">'+S.leaves().length+' records</span>'});
}
function recordsView(){
  const list=S.leaves().slice().sort((a,b)=>String(b.from).localeCompare(String(a.from)));
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="lvSearch" placeholder="Search staff, type, note…"></div><span class="grow"></span><button class="btn sm" data-export>'+UI.ic('download',13)+'Export register</button><button class="btn sm" data-print>'+UI.ic('printer',13)+'Print records</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="lvTable"><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th class="hide-sm">Note</th></tr></thead><tbody>'
   +list.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; const t=TYPE[l.type]||{label:l.type,cls:'al'};
     return '<tr><td><div class="row gap-sm">'+U.avatar(s.name,'sm')+'<span class="small">'+U.esc(s.name)+'</span></div></td>'
      +'<td><span class="gantt-bar '+t.cls+'" style="position:static;height:18px;padding:0 7px;font-size:9px;display:inline-flex">'+U.esc(t.label)+'</span></td>'
      +'<td class="num">'+U.fmtDate(l.from)+'</td><td class="num">'+U.fmtDate(l.to)+'</td><td class="num">'+days(l)+'</td>'
      +'<td><span class="pill '+(l.status==='Pending'?'amber':/declin|reject/i.test(l.status)?'rose':'teal')+'">'+U.esc(l.status||'Approved')+'</span></td>'
      +'<td class="small hide-sm truncate" style="max-width:280px">'+U.esc(l.note||'—')+'</td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+list.length+' leave records · FY '+U.fyLabel()+'</span><span class="mono">Append-only history</span></div></div></div></div>';
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
        const l={id:U.uid('l'),staffId:el.querySelector('#lvStaff').value,type:el.querySelector('#lvType').value,from,to,backOn:U.addDays(to,1),status:'Pending',fy:U.fyLabel(),note:el.querySelector('#lvNote').value,requested:U.nowISO()};
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
  host.innerHTML=tab==='requests'?requestsView():tab==='timeline'?timelineView():recordsView();
  U.$$('[data-lv-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.lvTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-lv-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.lvTab; paint(); });
  r.querySelectorAll('[data-new]').forEach(b=>b.onclick=newRequest);
  r.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>{ if(!LS.auth.guard('approve'))return; decide(b.dataset.approve,true); });
  r.querySelectorAll('[data-decline]').forEach(b=>b.onclick=()=>{ if(!LS.auth.guard('approve'))return; decide(b.dataset.decline,false); });
  r.querySelectorAll('[data-print]').forEach(b=>b.onclick=()=>{
    const list=S.leaves().slice().sort((a,b)=>String(b.from).localeCompare(String(a.from)));
    U.printDoc('Leave register — FY '+U.fyLabel(),'<table><thead><tr><th>Staff</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead><tbody>'+list.map(l=>{ const s=S.staffById(l.staffId)||{name:'—'}; return '<tr><td>'+U.esc(s.name)+'</td><td>'+U.esc((TYPE[l.type]||{}).label||l.type)+'</td><td>'+U.fmtDate(l.from)+'</td><td>'+U.fmtDate(l.to)+'</td><td>'+days(l)+'</td><td>'+U.esc(l.status||'')+'</td></tr>'; }).join('')+'</tbody></table>',{landscape:true});
  });
  r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
    const list=S.leaves();
    U.exportCSV('leave-register-'+U.todayISO()+'.csv',[['Staff','Type','From','To','Days','Status','Note']].concat(list.map(l=>[(S.staffById(l.staffId)||{}).name||'',(TYPE[l.type]||{}).label||l.type,l.from,l.to,days(l),l.status||'',l.note||''])),{title:'Leave register',actor:LS.auth.user.name});
    UI.toast('Leave register exported',{type:'ok'});
  });
  const s=r.querySelector('#lvSearch'); if(s) s.addEventListener('input',()=>{ const q=s.value.toLowerCase(); U.$$('#lvTable tbody tr',r).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'); });
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'requests';
  ensureRequests();
  root.innerHTML='<div class="page-head"><div><h1>Leave &amp; timeline</h1><div class="sub">Fairness with a paper trail: requests, automatic coverage checks, an audited approval trail and a fiscal-year Gantt.</div></div>'
   +'<div class="actions"><button class="btn" data-print>'+UI.ic('printer',15)+' Print register</button><button class="btn primary" data-new>'+UI.ic('plus',15)+' Request leave</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['requests','Requests inbox'],['timeline','Timeline'],['records','Records']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-lv-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="lvBody"></div>';
  paint();
};
})();
