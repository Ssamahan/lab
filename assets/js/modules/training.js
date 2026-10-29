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
/* A session is worth a turn in the queue only when it is held away from Ruli DH
   AND runs three days or longer. A one- or two-day briefing, wherever it is held,
   does not move anybody's place: the person stays at the front of the queue until
   they have attended a training of three days or more. */
const trainingDays=t=>{
  if(!t||!t.start) return 0;
  const end=t.end||t.start;
  return Math.max(1,U.daysBetween(t.start,end)+1);
};
const countsForFifo=t=>!isInHouse(t) && trainingDays(t)>=3;
const MIN_COUNTING_DAYS=3;
/* The last session that served a turn — the one the waiting time is measured from. */
const lastNameTraining=id=>{
  const list=S.db().trainings.filter(t=>(t.attendees||[]).includes(id) && countsForFifo(t));
  return list.sort((a,b)=>String(b.end||b.start).localeCompare(String(a.end||a.start)))[0]||null;
};
/* Everything a person has attended, counting or not — the history is complete. */
const allTrainingOf=id=>S.db().trainings.filter(t=>(t.attendees||[]).includes(id))
  .sort((a,b)=>String(b.start).localeCompare(String(a.start)));
/* Waiting time is measured from the last training. A staff member who has never
   been trained waits from their first day of employment — the day is treated as
   the training day — so a new joiner does not jump the queue ahead of colleagues
   who have been waiting for a year. */
/* Waiting is counted in days, from the day the person returned from their last
   counting training — the end of the cycle, not a number in a list. */
function waitingSince(s){
  const last=lastNameTraining(s.id);
  if(last) return last.end||last.start;
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
  const all=S.activeStaff().map(s=>{ const last=lastNameTraining(s.id); const days=waitingDays(s);
    const all=allTrainingOf(s.id);
    /* what stopped the last session from serving a turn — said plainly */
    const lastAny=all[0]||null;
    const why=!lastAny?null
      :countsForFifo(lastAny)?null
      :isInHouse(lastAny)?'held at Ruli DH — does not count'
      :trainingDays(lastAny)<=2?'only '+trainingDays(lastAny)+' day'+(trainingDays(lastAny)===1?'':'s')+' — does not count'
      :null;
    return {s,last,days,all,lastAny,why,count:all.length,counted:all.filter(countsForFifo).length}; })
    .sort((a,b)=>b.days-a.days);
  /* A post held by name — laboratory manager, laboratory quality manager,
     laboratory safety officer — is not a turn in the queue. Training aimed at one
     of those posts goes to the person who holds it, so they are shown above the
     queue and never wait behind the bench rota for it. */
  const posts=all.filter(x=>S.isRolePost(x.s));
  const staff=all.filter(x=>!S.isRolePost(x.s));
  const nextName=staff.length?staff[0].s.name:'';
  const postRow=x=>'<div class="list-row role-post-row">'+U.avatar(x.s.name,'sm')
    +'<div class="lr-main"><div class="lr-title">'+U.esc(x.s.name)+'</div>'
    +'<div class="lr-sub">'+U.esc(S.postOf(x.s))+' · never waits in the queue for training aimed at the post</div></div>'
    +'<span class="pill gold">called by role</span></div>';
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'FIFO training queue',sub:'Longest wait first · days served waiting, counted from the day they returned',icon:'git-branch',
      tools:'<button class="btn sm primary" data-schedule>'+UI.ic('plus',13)+'Schedule training</button>',
      body:(posts.length?'<div class="role-posts">'+posts.map(postRow).join('')+'</div><div class="thread" style="margin:10px 0"></div>':'')
        +'<div style="display:flex;flex-direction:column;gap:2px">'+staff.map((x,i)=>{ const pct=Math.min(100,x.days/365*100);
        const isNext=i===0;
        return '<div class="list-row'+(isNext?' fifo-next':'')+'">'
        +'<div style="width:24px;font-family:var(--font-mono);font-size:10px;color:'+(isNext?'var(--gold)':'var(--text-faint)')+'">'+(i+1)+'</div>'
        +U.avatar(x.s.name,isNext?'sm fifo-ring':'sm')
        +'<div class="lr-main"><div class="lr-title">'+U.esc(x.s.name)+(isNext?' <span class="pill gold" style="font-size:8.5px;padding:1px 6px">next</span>':'')+'</div>'
        +'<div class="lr-sub">'+U.esc(x.s.role)+' · '+x.count+' session'+(x.count===1?'':'s')+' · '+x.counted+' counted</div>'
        +(x.why?'<div class="xs" style="color:var(--warn);margin-top:2px">last: '+U.esc(x.why)+'</div>':'')+'</div>'
        +'<div style="width:96px"><div class="meter '+(x.days>365?'rose':x.days>240?'amber':'teal')+'"><i style="width:'+Math.min(100,pct)+'%"></i></div><div class="xs faint" style="margin-top:3px">'+(x.last?'returned '+U.fmtDate(x.last.end||x.last.start):(x.s.joinDate?'since '+U.fmtDate(x.s.joinDate):'never'))+'</div></div>'
        +'<span class="mono xs" style="width:56px;text-align:right;color:'+(x.days>365?'var(--crit)':'var(--text-muted)')+'">'+(x.days>=999?'—':x.days+'d')+'</span></div>'; }).join('')+'</div>',
      foot:'<span>Only a training held away from Ruli DH, of <b>3 days or more</b>, serves a turn · days are counted from the day the person returned</span><span class="mono">'+(nextName?'next: '+U.esc(nextName):staff.length+' staff')+'</span>'})+'</div>'
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
      return '<tr data-tr="'+t.id+'"><td><div class="primary-cell"><b>'+U.esc(t.title)+'</b><small>'+U.esc(t.status||'completed')+(t.audienceLabel?' · aimed at the '+U.esc(t.audienceLabel.toLowerCase()):'')+(t.fromLeave?' · from leave record':'')+'</small></div></td>'
      +'<td class="small">'+U.esc(t.organizer||'—')+'</td><td class="small hide-sm truncate" style="max-width:130px">'+U.esc(t.location||'—')+'</td>'
      +'<td class="num">'+U.fmtDateShort(t.start)+(t.end&&t.end!==t.start?' – '+U.fmtDateShort(t.end):'')+'</td>'
      +'<td><div class="avatar-stack">'+names.slice(0,3).map(n=>U.avatar(n,'sm')).join('')+(names.length>3?'<span class="avatar sm" style="background:var(--surface-3);color:var(--text-muted)">+'+(names.length-3)+'</span>':'')+'</div></td>'
      +'<td>'+certPill(t)+'</td>'
      +'<td style="white-space:nowrap"><button class="icon-btn" style="width:26px;height:26px" data-edit-tr="'+t.id+'" title="Edit this record">'+UI.ic('pencil',13)+'</button>'
      +'<button class="icon-btn" style="width:26px;height:26px;color:var(--crit)" data-del-tr="'+t.id+'" title="Delete this record">'+UI.ic('trash-2',13)+'</button>'
      +'<button class="icon-btn" style="width:26px;height:26px" data-open="'+t.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+list.length+' of '+S.db().trainings.length+' sessions</span><span class="mono">FIFO queue auto-updates</span></div></div></div></div>';
}
function historyView(){
  /* Every recorded session, newest first, grouped by calendar year — 2011, 2012,
     2019, 2022 and everything since. Nothing is truncated and no period is
     skipped: a year with one record is shown with its one record. */
  const list=scope().slice().sort((a,b)=>String(b.start).localeCompare(String(a.start)));
  const byYear=U.groupBy(list,t=>String(t.start).slice(0,4));
  const years=Object.keys(byYear).sort().reverse();
  return '<div class="grid-12">'
    +'<div class="c6">'+UI.card({title:'Per person',sub:'Sessions attended and turns served',icon:'users',
      body:S.activeStaff().map(x=>{ const all=allTrainingOf(x.id); const counted=all.filter(countsForFifo);
        const first=all.length?all[all.length-1]:null;
        return '<div style="margin-bottom:10px"><div class="row between"><span class="xs truncate">'+U.esc(x.name)+'</span><span class="mono xs faint">'+all.length+' · '+counted.length+'</span></div>'
          +'<div class="xs faint" style="margin-top:2px">'+(first?'first on file '+U.fmtDate(first.start):'no session on file')+(counted.length?' · last counted '+U.fmtDate(counted[0].end||counted[0].start):' · no counting session yet')+'</div></div>'; }).join('')})+'</div>'
    +'<div class="c6">'+UI.card({title:'Trainings by year',sub:'Sessions recorded, year by year',icon:'chart-bar',body:'<div id="trYears"></div>'})+'</div>'
    +'<div class="c12">'
    +UI.card({title:'Competency timeline',sub:list.length+' sessions · every year on file, newest first, laid out in two columns',icon:'history',
      tools:'<button class="btn xs primary" data-history>'+UI.ic('plus',12)+'Record past training</button>',
      body:list.length
        ?'<div class="hist-cols">'+years.map(y=>'<div>'
          +'<div class="row between" style="margin-bottom:6px"><span class="eyebrow">'+y+'</span><span class="xs faint">'+byYear[y].length+' session'+(byYear[y].length===1?'':'s')+'</span></div>'
          +'<div style="position:relative;padding-left:14px;border-left:1px solid var(--border);margin-left:2px">'
          +byYear[y].map(t=>{ const names=(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).filter(Boolean);
            const counts=countsForFifo(t);
            return '<div style="padding:0 0 12px 12px;position:relative">'
              +'<span style="position:absolute;left:-19px;top:5px;width:9px;height:9px;border-radius:50%;background:'+(counts?'var(--gold)':'var(--surface-2)')+';border:1px solid '+(counts?'var(--gold)':'var(--border)')+'"></span>'
              +'<div class="row between" style="align-items:flex-start;gap:10px"><div style="min-width:0"><div class="small strong" style="line-height:1.35">'+U.esc(t.title)+'</div>'
              +'<div class="xs faint" style="margin-top:2px">'+U.esc(t.organizer||'—')+' · '+U.esc(t.location||'—')+'</div></div>'
              +'<span class="mono xs faint" style="white-space:nowrap">'+U.fmtDate(t.start)+(t.end&&t.end!==t.start?' – '+U.fmtDate(t.end):'')+'</span></div>'
              +'<div class="row gap-sm wrap" style="margin-top:5px"><span class="pill '+(trainingDays(t)>=3?'teal':'slate')+'">'+trainingDays(t)+' day'+(trainingDays(t)===1?'':'s')+'</span>'
              +(isInHouse(t)?'<span class="pill amber">at Ruli DH · no turn served</span>':(counts?'<span class="pill gold">counts</span>':'<span class="pill slate">short · no turn served</span>'))
              +(names.length?'<span class="xs faint">'+U.esc(names.join(', '))+'</span>':'<span class="xs faint">no attendee recorded</span>')
              +'</div></div>';
          }).join('')
          +'</div></div>').join('')+'</div>'
        :UI.empty({art:'history',title:'No sessions on file',body:'Record a past training to build the history — the FIFO queue reads from it.'}),
      foot:'<span>History is complete: every year on file is shown · gold dot = the session served a turn in the queue</span><span class="mono">'+years.length+' years</span>'})
    +'</div></div>';
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
    foot:'<button class="btn" data-close>Close</button><button class="btn danger" data-del-rec>'+UI.ic('trash-2',15)+'Delete</button><button class="btn" data-edit-rec>'+UI.ic('pencil',15)+'Edit</button><button class="btn" data-print>'+UI.ic('printer',15)+'Certificate list</button>',
    onMount:(panel)=>{ const ct=panel.querySelector('[data-cert-toggle]'); if(ct) ct.onclick=()=>{
        const next=!certGiven(t);
        S.commit(d=>{ const x=d.trainings.find(y=>y.id===t.id); if(x){ x.certificateGiven=next; x.certificate=next?(x.certificate||'Certificate issued'):''; } },
          {action:'training.certificate',entity:'trainings',entityId:t.id,detail:t.title+' · '+(next?'certificates issued':'no certificates')});
        UI.closeAll(); UI.toast(next?'Marked as certified':'Marked as not certified',{type:next?'ok':'info'}); LS.shell.refresh();
      };
      panel.querySelector('[data-edit-rec]').onclick=()=>{ UI.closeAll(); scheduleModal(t.id); };
      panel.querySelector('[data-del-rec]').onclick=async()=>{
        const ok=await UI.confirm({title:'Delete “'+t.title+'”?',body:'The session leaves the registry and every attendee\u2019s history. The audit trail keeps the record of the deletion.',confirm:'Delete training',danger:true});
        if(!ok) return;
        S.commit(d=>{ d.trainings=(d.trainings||[]).filter(y=>y.id!==t.id); },{action:'training.delete',entity:'trainings',entityId:t.id,detail:t.title+' · '+U.fmtDate(t.start)});
        UI.closeAll(); UI.toast('Training record deleted',{type:'warn'}); LS.shell.refresh();
      };
      panel.querySelector('[data-print]').onclick=()=>{ U.printDoc('Training attendance — '+t.title,'<table><thead><tr><th>#</th><th>Name</th><th>Role</th><th>Signature</th></tr></thead><tbody>'+names.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(s.name)+'</td><td>'+U.esc(s.role)+'</td><td style="width:120px"></td></tr>').join('')+'</tbody></table>',{meta:'<span>'+U.esc(t.organizer||'')+'</span><span>'+U.fmtDate(t.start)+'</span>'}); }; }});
}
/* Training that is aimed at a post — the manager, the quality manager, the
   safety officer — is not a turn in the queue: it goes to the person who holds
   the post, and their name is ticked for them. */
const AUDIENCE=[['','Everybody on the establishment'],
  ['manager','Laboratory Manager'],['qualityManager','Lab Quality Manager'],
  ['safetyOfficer','Lab Safety Officer']];
function holderOf(key){ return key?S.activeStaff().find(x=>S.dutyKeyOf(x)===key):null; }
function scheduleModal(id, opts){
  if(!LS.auth.guard('edit')) return;
  opts=opts||{};
  const history=!!opts.history && !id;
  const staff=S.activeStaff();
  const everyone=S.db().staff;
  const t=id?S.db().trainings.find(x=>x.id===id):null;
  const att=t?(t.attendees||[]):[];
  /* Organisers are a picklist, and the list grows from the form: choose RBC, WHO
     or whatever was used last time, or add the organiser that is missing. */
  const organisers=S.trainingOrganizers();
  const orgNow=t?(t.organizer||''):(organisers[0]||'');
  UI.modal({title:t?'Edit training record':(history?'Record a training already attended':'Schedule training'),width:'min(680px,100%)',
    sub:t?'Correct anything that was entered wrongly — the FIFO queue recalculates from these dates.'
      :history?'For a training that has already taken place — including years back. It joins the history at its real date.'
      :'Adds to the registry and advances the FIFO queue.',
    body:'<div class="form-grid"><div class="field span2"><label>Title</label><input class="input" id="trTitle" value="'+U.esc(t?t.title:'')+'" placeholder="e.g. GeneXpert module maintenance"></div>'
     +'<div class="field"><label>Organizer</label><select class="select" id="trOrg">'
       +organisers.map(o=>'<option value="'+U.esc(o)+'"'+(orgNow===o?' selected':'')+'>'+U.esc(o)+'</option>').join('')
       +'<option value="__new">＋ Add a new organiser…</option></select>'
       +'<input class="input" id="trOrgNew" placeholder="Organiser name" style="margin-top:6px;display:none"></div>'
     +'<div class="field"><label>Location</label><input class="input" id="trLoc" list="trLocList" value="'+U.esc(t?t.location||'':'Ruli DH')+'">'
       +'<datalist id="trLocList">'+U.uniq(['Ruli DH','Kigali','Musanze','Bugesera District','Huye District','Gakenke District']).map(l=>'<option value="'+U.esc(l)+'">').join('')+'</datalist>'
       +'<div class="xs faint" style="margin-top:4px">Held at Ruli DH or online here? Then it does not serve a turn in the queue.</div></div>'
     +'<div class="field"><label>Start</label><input class="input mono" type="date" id="trStart" value="'+(t?t.start:(history?'':U.addDays(U.todayISO(),7)))+'"></div>'
     +'<div class="field"><label>End</label><input class="input mono" type="date" id="trEnd" value="'+(t?t.end||t.start:(history?'':U.addDays(U.todayISO(),9)))+'"></div>'
     +'<div class="field"><label>Days · calculated</label><input class="input mono" id="trDays" readonly value="'+(t?trainingDays(t):'')+'"><div class="xs faint" style="margin-top:4px">A turn is only served by 3 days or more.</div></div>'
     +'<div class="field span2"><label>Aimed at</label><select class="select" id="trAudience">'
       +AUDIENCE.map(([k,l])=>'<option value="'+k+'"'+((t?(t.audience||''):'')===k?' selected':'')+'>'+U.esc(l)+'</option>').join('')+'</select>'
       +'<div class="xs faint" style="margin-top:4px" id="trAudienceNote">A post-based session goes to the person who holds the post — they skip the FIFO queue, exactly as the manager does.</div></div>'
     +'<div class="field span2"><label>Attendees</label><div style="display:flex;flex-wrap:wrap;gap:6px">'
       +everyone.map(s=>'<label class="row gap-sm" style="padding:5px 9px;border:1px solid var(--border);border-radius:8px;cursor:pointer"><input type="checkbox" data-att value="'+s.id+'" style="accent-color:#C9A84C"'+(att.indexOf(s.id)>=0?' checked':'')+'><span class="xs">'+U.esc(s.name)+(s.status!=='active'?' <span class="faint">· left</span>':'')+'</span></label>').join('')+'</div></div>'
     +'<div class="field span2"><label>Description</label><textarea class="textarea" id="trDesc" placeholder="Objectives, competencies covered, facilitator…">'+U.esc(t?(t.description||t.note||''):'')+'</textarea></div>'
     +'<div class="field span2"><label class="row gap-sm" style="cursor:pointer"><input type="checkbox" id="trCert" style="accent-color:#C9A84C"'+(t&&certGiven(t)?' checked':'')+'><span class="small">This session issues certificates</span></label>'
     +'<div class="hint" style="margin-top:4px">Leave unticked for internal briefings — attendees show as <b>not certified</b>. Sessions held at Ruli DH never advance the FIFO queue.</div></div></div>',
    foot:'<button class="btn" data-close>Cancel</button>'+(t?'<button class="btn danger" data-del>'+UI.ic('trash-2',15)+'Delete</button>':'')+'<button class="btn primary" data-save>'+UI.ic('calendar-check',15)+(t?'Save changes':'Add to registry')+'</button>',
    onMount:(el,close)=>{
      const orgSel=el.querySelector('#trOrg'), orgNew=el.querySelector('#trOrgNew');
      orgSel.onchange=()=>{ orgNew.style.display=orgSel.value==='__new'?'':'none'; if(orgSel.value==='__new') orgNew.focus(); };
      const recap=()=>{ const a=el.querySelector('#trStart').value, b=el.querySelector('#trEnd').value;
        const n=(a&&b&&b>=a)?U.daysBetween(a,b)+1:(a?1:0);
        el.querySelector('#trDays').value=n?String(n):''; };
      ['#trStart','#trEnd'].forEach(k=>{ const f=el.querySelector(k); f.onchange=recap; f.oninput=recap; });
      recap();
      /* choosing a post ticks the person who holds it, and nobody else is
         assumed to be attending a session that was not aimed at them */
      const aud=el.querySelector('#trAudience');
      if(aud) aud.onchange=()=>{
        const holder=holderOf(aud.value);
        el.querySelectorAll('[data-att]').forEach(cb=>{ cb.checked = holder? cb.value===holder.id : cb.checked; });
        const note=el.querySelector('#trAudienceNote');
        if(note) note.textContent=holder?('Goes to '+holder.name+' — the post holder is ticked and does not wait in the queue.')
          :'A post-based session goes to the person who holds the post — they skip the FIFO queue, exactly as the manager does.';
        const titleEl=el.querySelector('#trTitle');
        if(holder && titleEl && !titleEl.value.trim())
          titleEl.value='Role training · '+((AUDIENCE.find(a=>a[0]===aud.value)||[])[1]||'');
      };
      el.querySelector('[data-save]').onclick=()=>{
        const title=el.querySelector('#trTitle').value.trim();
        if(!title) return UI.toast('Give the training a title',{type:'warn'});
        if(!el.querySelector('#trStart').value) return UI.toast('Give the training a start date',{type:'warn'});
        const attendees=U.$$('[data-att]:checked',el).map(x=>x.value);
        const cert=el.querySelector('#trCert').checked;
        const organiser=orgSel.value==='__new'?(orgNew.value||'').trim():orgSel.value;
        if(organiser) S.addTrainingOrganizer(organiser);
        const audKey=el.querySelector('#trAudience')?el.querySelector('#trAudience').value:'';
        const audLabel=(AUDIENCE.find(a=>a[0]===audKey)||[])[1]||'';
        const rec={title,organizer:organiser,location:el.querySelector('#trLoc').value,
          start:el.querySelector('#trStart').value,end:el.querySelector('#trEnd').value,
          description:el.querySelector('#trDesc').value,attendees,
          audience:audKey,audienceLabel:audKey?audLabel:'',
          certificate:cert?'Certificate issued':'',certificateGiven:cert,status:'completed',completionDate:el.querySelector('#trEnd').value};
        if(t){
          S.commit(d=>{ const x=d.trainings.find(y=>y.id===t.id); if(x) Object.assign(x,rec); },
            {action:'training.edit',entity:'trainings',entityId:t.id,detail:title+' · '+attendees.length+' attendees'});
          close(); UI.toast('Training record updated',{type:'ok'}); LS.shell.refresh(); return;
        }
        const created=Object.assign({id:U.uid('tr'),note:''},rec);
        S.commit(d=>{ d.trainings.unshift(created); },{action:'training.create',entity:'trainings',entityId:created.id,detail:title+' · '+attendees.length+' attendees'});
        close(); UI.toast('Training added to the registry',{type:'ok'}); LS.shell.refresh();
      };
      const del=el.querySelector('[data-del]');
      if(del) del.onclick=async()=>{
        const ok=await UI.confirm({title:'Delete “'+t.title+'”?',
          body:'The session is removed from the registry and from every attendee’s competency history. The FIFO queue recalculates from the sessions that remain. This is recorded in the audit trail.',
          confirm:'Delete training',danger:true});
        if(!ok) return;
        S.commit(d=>{ d.trainings=(d.trainings||[]).filter(y=>y.id!==t.id); },
          {action:'training.delete',entity:'trainings',entityId:t.id,detail:t.title+' · '+U.fmtDate(t.start)});
        close(); UI.toast('Training record deleted',{type:'warn'}); LS.shell.refresh();
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
  r.querySelectorAll('[data-schedule]').forEach(b=>b.onclick=()=>scheduleModal());
  r.querySelectorAll('[data-history]').forEach(b=>b.onclick=()=>scheduleModal(null,{history:true}));
  r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
    const rows=[['Title','Organizer','Location','Start','End','Attendees','Certificate','Counts for FIFO']].concat(S.db().trainings.map(t=>[t.title,t.organizer,t.location,t.start,t.end,(t.attendees||[]).map(a=>(S.staffById(a)||{}).name).join('; '),certLabel(t),isInHouse(t)?'no':'yes']));
    U.exportCSV('training-register-'+U.todayISO()+'.csv',rows,{title:'Training registry',actor:LS.auth.user.name}); UI.toast('Training register exported',{type:'ok'});
  });
  r.querySelectorAll('[data-tr]').forEach(tr=>tr.onclick=()=>trainingDrawer(tr.dataset.tr));
  r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); trainingDrawer(b.dataset.open); });
  r.querySelectorAll('[data-edit-tr]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); scheduleModal(b.dataset.editTr); });
  r.querySelectorAll('[data-del-tr]').forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    const t=S.db().trainings.find(x=>x.id===b.dataset.delTr); if(!t) return;
    const ok=await UI.confirm({title:'Delete “'+t.title+'”?',body:'Removed from the registry and from every attendee\u2019s history. '+U.fmtDate(t.start)+' · '+(t.attendees||[]).length+' attendees.',confirm:'Delete training',danger:true});
    if(!ok) return;
    S.commit(d=>{ d.trainings=(d.trainings||[]).filter(y=>y.id!==t.id); },{action:'training.delete',entity:'trainings',entityId:t.id,detail:t.title+' · '+U.fmtDate(t.start)});
    UI.toast('Training record deleted',{type:'warn'}); LS.shell.refresh();
  });
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
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn" data-history>'+UI.ic('history',15)+' Record past training</button><button class="btn primary" data-schedule>'+UI.ic('plus',15)+' Schedule training</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['fifo','FIFO queue'],['registry','Registry'],['history','History']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-tr-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="trBody"></div>';
  U.$$('[data-tr-tab]',root).forEach(b=>b.onclick=()=>{ tab=b.dataset.trTab; paint(); });
  paint();
};
})();
