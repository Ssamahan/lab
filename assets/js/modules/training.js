/* ============================================================================
   MODULE · TRAINING ROSTER — FIFO queue, registry, competency history
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.training=M;
let rootEl=null, tab='fifo', q='';

/* In-house sessions held at Ruli DH do not reset a person's place in the queue:
   the FIFO is about who gets the next sponsored seat elsewhere, so only external
   training counts as "training attended". An on-site session is still recorded and
   still appears in the registry — it just is not a turn served. */
const isInHouse=t=>/ruli/i.test(String((t&&t.location)||'')) || /^in-?house$/i.test(String((t&&t.type)||''));
const lastNameTraining=id=>{
  const list=S.db().trainings.filter(t=>(t.attendees||[]).includes(id) && !isInHouse(t));
  return list.sort((a,b)=>String(b.start).localeCompare(String(a.start)))[0]||null;
};
/* Waiting time is measured from the last training. A staff member who has never
   been trained waits from their first day of employment — the day is treated as
   the training day — so a new joiner does not jump the queue ahead of colleagues
   who have been waiting for a year. */
function waitingSince(s){
  const last=lastNameTraining(s.id);
  if(last) return last.start;
  return s.joinDate||null;
}
function waitingDays(s){
  const since=waitingSince(s);
  if(!since) return 999;
  return Math.max(0,U.daysBetween(since,U.todayISO()));
}
/* Certificates are decided per session, never assumed: many sessions are internal
   briefings that issue nothing. `certificateGiven` is the authoritative flag, with
   the old free-text field honoured as a fallback. */
const certGiven=t=>t.certificateGiven!=null ? !!t.certificateGiven : /cert/i.test(String(t.certificate||''));
const certLabel=t=>certGiven(t)?'Certified':'Not certified';
const certPill=t=>certGiven(t)?'<span class="pill teal">'+UI.ic('badge-check',10)+'Certified</span>':'<span class="pill slate">Not certified</span>';
function scope(){
  return S.db().trainings.filter(t=>!q || [t.title,t.organizer,t.location,(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).join(' ')].join(' ').toLowerCase().indexOf(q)>=0);
}
function kpis(){
  const db=S.db(); const active=S.activeStaff();
  const year=U.fyLabel().slice(0,4);
  const ytd=db.trainings.filter(t=>String(t.start).startsWith(year));
  const certified=db.trainings.filter(certGiven).length;
  const waiting=active.map(s=>waitingDays(s));
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Trainings this FY',value:ytd.length,icon:'graduation-cap',formatted:'0',delta:12,note:U.sum(ytd,t=>(t.attendees||[]).length)+' attendances',spark:C.spark([3,5,4,7,6,8,7,9,8,10],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Staff trained',value:U.uniq(db.trainings.flatMap(t=>t.attendees||[])).length,icon:'users',formatted:'0',note:'Across '+db.trainings.length+' sessions',spark:C.spark([2,3,3,4,5,5,6,6,6,6],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Certified',value:certified,icon:'award',formatted:'0',note:'Sessions that issued certificates',spark:C.spark([1,2,4,5,7,9,10,12,13,14],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'FIFO wait (max)',value:Math.min(Math.max.apply(null,waiting),999),unit:'days',icon:'hourglass',formatted:'0',note:'Longest since last training',spark:C.spark(waiting.slice(0,10),{color:'var(--amber)'})})+'</div></div>';
}
function fifoView(){
  const staff=S.activeStaff().map(s=>{ const last=lastNameTraining(s.id); const days=waitingDays(s);
    return {s,last,days,count:S.db().trainings.filter(t=>(t.attendees||[]).includes(s.id)).length}; }).sort((a,b)=>b.days-a.days);
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'FIFO training queue',sub:'Longest wait first · fairness across the bench',icon:'git-branch',
      tools:'<button class="btn sm primary" data-schedule>'+UI.ic('plus',13)+'Schedule training</button>',
      body:'<div style="display:flex;flex-direction:column;gap:2px">'+staff.map((x,i)=>{ const pct=Math.min(100,x.days/365*100);
        return '<div class="list-row"><div style="width:22px;font-family:var(--font-mono);font-size:10px;color:var(--text-faint)">'+(i+1)+'</div>'+U.avatar(x.s.name,'sm')
        +'<div class="lr-main"><div class="lr-title">'+U.esc(x.s.name)+'</div><div class="lr-sub">'+U.esc(x.s.role)+' · '+x.count+' sessions</div></div>'
        +'<div style="width:96px"><div class="meter '+(x.days>365?'rose':x.days>240?'amber':'teal')+'"><i style="width:'+Math.min(100,pct)+'%"></i></div><div class="xs faint" style="margin-top:3px">'+(x.last?U.fmtDate(x.last.start):(x.s.joinDate?'since '+U.fmtDate(x.s.joinDate):'never'))+'</div></div>'
        +'<span class="mono xs" style="width:52px;text-align:right;color:'+(x.days>365?'var(--crit)':'var(--text-muted)')+'">'+(x.days>=999?'—':x.days+'d')+'</span></div>'; }).join('')+'</div>',
      foot:'<span>FIFO = first to have waited longest · in-house sessions at Ruli DH do not count</span><span class="mono">'+staff.length+' staff</span>'})+'</div>'
   +'<div class="c5"><div class="col" style="gap:14px">'
     +UI.card({title:'Training by year',sub:'Sessions recorded, year by year',icon:'chart-bar',tools:'<a class="more" href="#/training?tab=history" style="color:var(--gold)">History '+UI.ic('arrow-right',12)+'</a>',body:'<div id="trYears"></div>'})
     +UI.card({title:'Upcoming & planned',sub:'Scheduled competency activity',icon:'calendar-days',body:(function(){
        const up=S.db().trainings.filter(t=>t.start>=U.todayISO()).sort((a,b)=>String(a.start).localeCompare(String(b.start))).slice(0,4);
        return up.length?up.map(t=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(t.title)+'</div><div class="lr-sub">'+U.fmtDate(t.start)+' · '+U.esc(t.organizer||'—')+'</div></div><span class="pill gold">'+U.daysBetween(U.todayISO(),t.start)+'d</span></div>').join(''):'<p class="xs faint">No sessions scheduled. Use “Schedule training” to plan the next competency block.</p>';
      })()})
   +'</div></div></div>';
}
function registryView(){
  const list=scope().slice(0,80);
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="trSearch" value="'+U.esc(q)+'" placeholder="Search training, organizer, attendee…"></div><span class="grow"></span><button class="btn sm" data-export>'+UI.ic('download',13)+'Export register</button><button class="btn primary sm" data-schedule>'+UI.ic('plus',13)+'Schedule training</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Training</th><th>Organizer</th><th class="hide-sm">Location</th><th>Dates</th><th>Attendees</th><th>Certificate</th><th></th></tr></thead><tbody>'
   +list.map(t=>{ const names=(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).filter(Boolean);
      return '<tr data-tr="'+t.id+'"><td><div class="primary-cell"><b>'+U.esc(t.title)+'</b><small>'+U.esc(t.status||'completed')+(t.fromLeave?' · from leave record':'')+'</small></div></td>'
      +'<td class="small">'+U.esc(t.organizer||'—')+'</td><td class="small hide-sm truncate" style="max-width:130px">'+U.esc(t.location||'—')+'</td>'
      +'<td class="num">'+U.fmtDateShort(t.start)+(t.end&&t.end!==t.start?' – '+U.fmtDateShort(t.end):'')+'</td>'
      +'<td><div class="avatar-stack">'+names.slice(0,3).map(n=>U.avatar(n,'sm')).join('')+(names.length>3?'<span class="avatar sm" style="background:var(--surface-3);color:var(--text-muted)">+'+(names.length-3)+'</span>':'')+'</div></td>'
      +'<td>'+certPill(t)+'</td>'
      +'<td><button class="icon-btn" style="width:26px;height:26px" data-open="'+t.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+list.length+' of '+S.db().trainings.length+' sessions</span><span class="mono">FIFO queue auto-updates</span></div></div></div></div>';
}
function historyView(){
  const list=scope().slice().sort((a,b)=>String(b.start).localeCompare(String(a.start)));
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Competency timeline',sub:'Every recorded session, newest first',icon:'history',body:'<div style="position:relative;padding-left:18px">'
    +'<div style="position:absolute;left:4px;top:6px;bottom:6px;width:1px;background:linear-gradient(180deg,var(--gold),var(--border),transparent)"></div>'
    +list.slice(0,26).map(t=>{ const names=(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).filter(Boolean);
      return '<div style="position:relative;padding:0 0 16px 14px"><span style="position:absolute;left:-18px;top:4px;width:9px;height:9px;border-radius:50%;background:var(--surface-2);border:1px solid var(--gold)"></span>'
      +'<div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="small strong" style="line-height:1.35">'+U.esc(t.title)+'</div><div class="xs faint" style="margin-top:2px">'+U.esc(t.organizer||'—')+' · '+U.esc(t.location||'—')+'</div></div><span class="mono xs faint" style="white-space:nowrap">'+U.fmtDate(t.start)+'</span></div>'
      +'<div class="row gap-sm wrap" style="margin-top:5px"><span class="pill slate">'+names.length+' attendees</span>'+(certGiven(t)?'<span class="pill teal">certified</span>':'')+names.slice(0,3).map(n=>'<span class="xs faint">'+U.esc(n.split(' ')[0])+'</span>').join('')+'</div></div>'; }).join('')
    +'</div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Training by year',sub:'Sessions recorded',icon:'chart-bar',body:'<div id="trYears"></div>'})
     +'<div style="margin-top:14px">'+UI.card({title:'Organizers',sub:'Where competency comes from',icon:'building-2',body:(function(){
        const g=U.groupBy(S.db().trainings,t=>t.organizer||'Internal'); const max=Math.max.apply(null,Object.values(g).map(x=>x.length).concat([1]));
        return Object.keys(g).sort((a,b)=>g[b].length-g[a].length).slice(0,6).map(k=>'<div style="margin-bottom:9px"><div class="row between"><span class="xs truncate" style="max-width:150px">'+U.esc(k)+'</span><span class="mono xs faint">'+g[k].length+'</span></div><div class="meter teal" style="margin-top:4px"><i style="width:'+(g[k].length/max*100)+'%"></i></div></div>').join('');
      })()})+'</div></div></div></div>';
}
function trainingDrawer(id){
  const t=S.db().trainings.find(x=>x.id===id); if(!t) return;
  const names=(t.attendees||[]).map(a=>S.staffById(a)).filter(Boolean);
  UI.drawer({title:t.title,eyebrow:'Training record',sub:(t.organizer||'Internal')+' · '+U.fmtDate(t.start),body:
    '<div class="row wrap" style="gap:6px;margin-bottom:14px">'+certPill(t)+(isInHouse(t)?'<span class="pill amber">in-house · does not count for FIFO</span>':'')+'<span class="pill slate">'+(t.end&&t.end!==t.start?U.daysBetween(t.start,t.end)+1+' days':'1 day')+'</span><span class="pill gold">'+U.esc(t.location||'—')+'</span></div>'
    +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:14px;padding:12px"><div class="row between"><div><div class="small strong">Certificates issued?</div><div class="xs faint">Not every session provides one — record it here rather than assuming.</div></div>'
    +'<button class="btn sm'+(certGiven(t)?' danger':' primary')+'" data-cert-toggle>'+(certGiven(t)?'Mark not certified':'Mark certificates issued')+'</button></div></div>'
    +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:14px"><div class="eyebrow">Description</div><p class="small" style="margin-top:4px;line-height:1.6">'+U.esc(t.description||t.note||'No description recorded.')+'</p></div>'
    +'<div class="section-head" style="margin-top:0"><h2>Attendees</h2></div>'
    +(names.length?names.map(s=>'<div class="list-row">'+U.avatar(s.name,'sm')+'<div class="lr-main"><div class="lr-title">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc(s.role)+'</div></div>'+(certGiven(t)?'<span class="pill teal">certified</span>':'<span class="xs faint">not certified</span>')+'</div>').join(''):'<p class="xs faint">No attendees recorded.</p>')
    +'<div class="hint" style="margin-top:14px">Linked to leave and revenue trackers automatically when recorded from those registers.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-print>'+UI.ic('printer',15)+'Certificate list</button>',
    onMount:(panel)=>{ const ct=panel.querySelector('[data-cert-toggle]'); if(ct) ct.onclick=()=>{
        const next=!certGiven(t);
        S.commit(d=>{ const x=d.trainings.find(y=>y.id===t.id); if(x){ x.certificateGiven=next; x.certificate=next?(x.certificate||'Certificate issued'):''; } },
          {action:'training.certificate',entity:'trainings',entityId:t.id,detail:t.title+' · '+(next?'certificates issued':'no certificates')});
        UI.closeAll(); UI.toast(next?'Marked as certified':'Marked as not certified',{type:next?'ok':'info'}); LS.shell.refresh();
      };
      panel.querySelector('[data-print]').onclick=()=>{ U.printDoc('Training attendance — '+t.title,'<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Signature</th></tr></thead><tbody>'+names.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(s.name)+'</td><td>'+U.esc(s.role)+'</td><td style="width:120px"></td></tr>').join('')+'</tbody></table>',{meta:'<span>'+U.esc(t.organizer||'')+'</span><span>'+U.fmtDate(t.start)+'</span>'}); }; }});
}
function scheduleModal(){
  if(!LS.auth.guard('edit')) return;
  const staff=S.activeStaff();
  UI.modal({title:'Schedule training',sub:'Adds to the registry and advances the FIFO queue.',width:'min(640px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Title</label><input class="input" id="trTitle" placeholder="e.g. GeneXpert module maintenance"></div>'
     +'<div class="field"><label>Organizer</label><input class="input" id="trOrg" value="RBC"></div>'
     +'<div class="field"><label>Location</label><input class="input" id="trLoc" value="Ruli DH"></div>'
     +'<div class="field"><label>Start</label><input class="input mono" type="date" id="trStart" value="'+U.addDays(U.todayISO(),7)+'"></div>'
     +'<div class="field"><label>End</label><input class="input mono" type="date" id="trEnd" value="'+U.addDays(U.todayISO(),9)+'"></div>'
     +'<div class="field span2"><label>Attendees</label><div style="display:flex;flex-wrap:wrap;gap:6px">'+staff.map(s=>'<label class="row gap-sm" style="padding:5px 9px;border:1px solid var(--border);border-radius:8px;cursor:pointer"><input type="checkbox" data-att value="'+s.id+'" style="accent-color:#C9A84C"><span class="xs">'+U.esc(s.name)+'</span></label>').join('')+'</div></div>'
     +'<div class="field span2"><label>Description</label><textarea class="textarea" id="trDesc" placeholder="Objectives, competencies covered, facilitator…"></textarea></div>'
     +'<div class="field span2"><label class="row gap-sm" style="cursor:pointer"><input type="checkbox" id="trCert" style="accent-color:#C9A84C"><span class="small">This session issues certificates</span></label>'
     +'<div class="hint" style="margin-top:4px">Leave unticked for internal briefings — attendees show as <b>not certified</b>. Sessions held at Ruli DH never advance the FIFO queue.</div></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('calendar-check',15)+'Add to registry</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const title=el.querySelector('#trTitle').value.trim();
        if(!title) return UI.toast('Give the training a title',{type:'warn'});
        const attendees=U.$$('[data-att]:checked',el).map(x=>x.value);
        const rec={id:U.uid('tr'),title,organizer:el.querySelector('#trOrg').value,location:el.querySelector('#trLoc').value,start:el.querySelector('#trStart').value,end:el.querySelector('#trEnd').value,description:el.querySelector('#trDesc').value,attendees,certificate:el.querySelector('#trCert').checked?'Certificate issued':'',certificateGiven:el.querySelector('#trCert').checked,status:'completed',completionDate:el.querySelector('#trEnd').value,note:''};
        S.commit(d=>{ d.trainings.unshift(rec); },{action:'training.create',entity:'trainings',entityId:rec.id,detail:title+' · '+attendees.length+' attendees'});
        close(); UI.toast('Training added to the registry',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
function paint(){
  const host=rootEl.querySelector('#trBody'); if(!host) return;
  host.innerHTML=tab==='fifo'?fifoView():tab==='registry'?registryView():historyView();
  U.$$('[data-tr-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.trTab===tab));
  UI.animateCounts(host);
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-schedule]').forEach(b=>b.onclick=scheduleModal);
  r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
    const rows=[['Title','Organizer','Location','Start','End','Attendees','Certificate','Counts for FIFO']].concat(S.db().trainings.map(t=>[t.title,t.organizer,t.location,t.start,t.end,(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).join('; '),certLabel(t),isInHouse(t)?'no':'yes']));
    U.exportCSV('training-register-'+U.todayISO()+'.csv',rows,{title:'Training registry',actor:LS.auth.user.name}); UI.toast('Training register exported',{type:'ok'});
  });
  r.querySelectorAll('[data-tr]').forEach(tr=>tr.onclick=()=>trainingDrawer(tr.dataset.tr));
  r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); trainingDrawer(b.dataset.open); });
  const search=r.querySelector('#trSearch');
  if(search){ search.addEventListener('input',U.debounce(()=>{ q=search.value; paint(); const s=rootEl.querySelector('#trSearch'); if(s){ s.focus(); s.setSelectionRange(q.length,q.length); } },220)); }
  const drawYears=(el,id)=>{
    if(!el) return;
    const g=U.groupBy(S.db().trainings,t=>String(t.start).slice(0,4));
    const years=Object.keys(g).sort();
    if(!years.length){ el.innerHTML='<div class="chart-empty">No training sessions recorded yet</div>'; return; }
    C.line(el,{id,height:210,series:[{name:'Sessions',color:'var(--gold)',values:years.map(k=>g[k].length)}],labels:years,
      yFmt:v=>Math.round(v),padLeft:30,tipFmt:v=>v+' session'+(v===1?'':'s'),drawMs:900});
  };
  if(tab==='fifo') drawYears(r.querySelector('#trYears'),'trYrMain');
  if(tab==='history') drawYears(r.querySelector('#trYears'),'trYrHist');
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'fifo'; q=params.q||'';
  root.innerHTML='<div class="page-head"><div><h1>Training roster</h1><div class="sub">Competency is a controlled asset: a FIFO queue that is visibly fair, a registry that survives staff turnover, and certificates on file.</div></div>'
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn primary" data-schedule>'+UI.ic('plus',15)+' Schedule training</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['fifo','FIFO queue'],['registry','Registry'],['history','History']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-tr-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="trBody"></div>';
  U.$$('[data-tr-tab]',root).forEach(b=>b.onclick=()=>{ tab=b.dataset.trTab; paint(); });
  paint();
};
})();
