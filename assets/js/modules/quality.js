/* ============================================================================
   MODULE · QUALITY & COMPLIANCE — ISO 15189 readiness, SOPs, incidents
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.quality=M;
let rootEl=null, tab='overview';

function metrics(){
  const st=S.sampleStats();
  const db=S.db();
  return {
    rejection:1.8, repeat:2.4, errorPer10k:6.2, tat:st.tatCompliance,
    eqa:Math.round(U.avg(Object.values(S.eqaLatest()).map(e=>e.scorePercent!=null?e.scorePercent:Math.max(0,100-Math.abs(e.score||0)*25)))),
    openIncidents:db.incidents.filter(i=>i.status!=='Closed').length,
    overdueIncidents:db.incidents.filter(i=>i.status!=='Closed'&&i.due<U.todayISO()).length,
    sopOverdue:db.sops.filter(s=>s.review<U.todayISO()).length,
    ackPct:Math.round(db.sops.filter(s=>s.acknowledged).length/db.sops.length*100)
  };
}
function kpis(){
  const m=metrics();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'ISO 15189 readiness',value:S.compliance().pct,unit:'%',icon:'shield-check',formatted:'0',delta:4,note:S.compliance().done+' of '+S.compliance().total+' controls met',spark:C.spark([62,66,70,73,76,80,82,S.compliance().pct],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'TAT compliance',value:m.tat,dec:1,unit:'%',icon:'timer',formatted:'0.0',delta:1.8,note:'30-day rolling',spark:C.spark([88,91,90,93,92,95,94,m.tat],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Rejection rate',value:m.rejection,dec:1,unit:'%',icon:'circle-x',formatted:'0.0',delta:-0.4,note:'Target ≤ 2.0%',spark:C.spark([3.1,2.8,2.6,2.4,2.3,2.1,1.9,m.rejection],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'EQA composite',value:m.eqa,dec:1,unit:'%',icon:'target',formatted:'0.0',delta:2.1,note:'All schemes passing',spark:C.spark([84,86,88,87,90,92,94,m.eqa],{color:'var(--pos)'})})+'</div></div>';
}
function overview(){
  const m=metrics(); const db=S.db();
  return '<div class="grid-12">'
   +'<div class="c8">'+UI.card({title:'Quality KPI trendlines',sub:'TAT compliance · EQA composite · rejection rate — 12 months',icon:'chart-line',cls:'gold',body:'<div id="qTrend"></div><div class="legend" style="margin-top:8px"><span class="lg"><span class="sw" style="background:var(--pos)"></span>TAT compliance %</span><span class="lg"><span class="sw" style="background:var(--gold)"></span>EQA composite %</span><span class="lg"><span class="sw" style="background:var(--crit)"></span>Rejection rate %</span></div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Continuous improvement',sub:'Error rate per 10,000 samples',icon:'trending-up',body:
      '<div class="scorecard" style="padding:0"><div class="meta"><div class="eyebrow">Error rate / 10k</div><div class="serif" style="font-size:2.2rem;color:var(--text-strong);letter-spacing:-.03em">'+m.errorPer10k+'</div><div class="xs faint">↓ 18% year on year</div></div>'+C.ring(82,{size:76,stroke:6})+'</div>'
      +'<div class="thread" style="margin:12px 0"></div>'
      +[['Repeat rate',m.repeat+'%','teal'],['Rejection rate',m.rejection+'%','amber'],['Sample loss','0.3%','teal']].map(([k,v,t])=>'<div class="row between" style="padding:6px 0"><span class="small">'+k+'</span><span class="pill '+t+' mono">'+v+'</span></div>').join('')})+'</div>'
   +'<div class="c7">'+UI.card({title:'ISO 15189 readiness',sub:'Live compliance percentage across the control set',icon:'shield-check',
      tools:'<a class="btn xs" href="#/quality?tab=iso">Open checklist</a>',body:(function(){
        const g=U.groupBy(S.db().checklist,c=>c.section);
        return '<div class="row" style="gap:18px;align-items:center;margin-bottom:12px">'+C.ring(S.compliance().pct,{size:88,stroke:7})+'<div><div class="strong">'+(S.compliance().pct>=90?'Accreditation ready':S.compliance().pct>=75?'Minor gaps remain':'Action plan required')+'</div><div class="xs faint" style="margin-top:3px">'+S.compliance().done+' of '+S.compliance().total+' controls evidenced<br>Next surveillance: Q2 FY 2026/27</div></div></div>'
        +Object.keys(g).map(k=>'<div class="row between" style="padding:5px 0"><span class="small">'+U.esc(k)+'</span><span class="mono xs faint">'+g[k].filter(x=>x.done).length+'/'+g[k].length+'</span></div>').join('')+'';
      })()})+'</div>'
   +'<div class="c5">'+UI.card({title:'Non-conformances',sub:'Severity · owner · resolution SLA',icon:'alert-triangle',
      tools:'<a class="btn xs" href="#/quality?tab=incidents">All '+db.incidents.length+'</a>',body:(function(){
        const open=db.incidents.filter(i=>i.status!=='Closed').sort((a,b)=>String(a.due).localeCompare(String(b.due))).slice(0,5);
        return open.length?open.map(i=>{ const late=i.due<U.todayISO();
          return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.8px">'+U.esc(i.ref)+' · '+U.esc(i.title)+'</div><div class="lr-sub">'+U.esc(i.owner)+' · due '+U.fmtDate(i.due)+'</div></div><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+(late?' · late':'')+'</span></div>'; }).join(''):'<p class="xs faint">No open non-conformances.</p>';
      })()})+'</div>'
   +'<div class="c12">'+UI.card({title:'Document control',sub:'SOP register · versions, review dates and acknowledgements',icon:'file-text',
      tools:'<a class="btn xs" href="#/quality?tab=sops">SOP register</a>',body:(function(){
        return '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Code</th><th>Title</th><th>Version</th><th>Effective</th><th>Next review</th><th>Owner</th><th>Status</th></tr></thead><tbody>'
        +db.sops.slice(0,6).map(s=>{ const overdue=s.review<U.todayISO();
          return '<tr><td class="mono small">'+U.esc(s.code)+'</td><td class="small">'+U.esc(s.title)+'</td><td class="mono xs">'+U.esc(s.version)+'</td><td class="num">'+U.fmtDate(s.effective)+'</td><td class="num">'+U.fmtDate(s.review)+'</td><td class="small">'+U.esc(s.owner)+'</td><td>'+(overdue?'<span class="pill rose">review due</span>':s.acknowledged?'<span class="pill teal">acknowledged</span>':'<span class="pill amber">pending</span>')+'</td></tr>'; }).join('')
        +'</tbody></table></div>';
      })()})+'</div></div>';
}
function isoView(){
  const list=S.db().checklist; const g=U.groupBy(list,c=>c.section);
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'ISO 15189 readiness checklist',sub:'Toggle a control to record evidence · percentage recalculates live',icon:'shield-check',
    tools:'<span class="pill '+(S.compliance().pct>=90?'teal':'amber')+'">'+S.compliance().pct+'% ready</span>',
    body:Object.keys(g).map(sec=>'<div style="margin-bottom:16px"><div class="row between" style="margin-bottom:6px"><div class="eyebrow">'+U.esc(sec)+'</div><span class="mono xs faint">'+g[sec].filter(x=>x.done).length+'/'+g[sec].length+'</span></div>'
      +g[sec].map(c=>'<label class="ob-item '+(c.done?'done':'')+'" data-ck="'+c.id+'" style="cursor:pointer"><span class="obx">'+UI.ic(c.done?'check':'circle-dot',10)+'</span><span class="obt">'+U.esc(c.item)+'</span><span class="xs faint">weight '+c.weight+'</span></label>').join('')+'</div>').join(''),
    foot:'<span>Evidence is stored locally and included in the audit export</span><button class="btn xs" data-export-iso>'+UI.ic('download',12)+'Export</button>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Readiness',sub:'Weighted compliance',icon:'gauge',body:'<div class="row" style="gap:16px">'+C.ring(S.compliance().pct,{size:110,stroke:8})+'<div class="xs muted" style="line-height:1.6">Sections are weighted by accreditation risk. Gaps are automatically listed in the CAPA register.</div></div>'})
    +'<div style="margin-top:14px">'+UI.card({title:'Open gaps',sub:'Controls without evidence',icon:'circle-x',body:(function(){
      const gaps=list.filter(c=>!c.done); return gaps.length?gaps.map(c=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(c.item)+'</div><div class="lr-sub">'+U.esc(c.section)+'</div></div><span class="pill amber">open</span></div>').join(''):'<p class="xs faint">All controls evidenced.</p>';
    })()})+'</div></div></div>';
}
function sopsView(){
  const db=S.db();
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="sopSearch" placeholder="Search SOP code, title, owner…"></div><span class="grow"></span><button class="btn sm" data-add-sop>'+UI.ic('plus',13)+'Register SOP</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="sopTable"><thead><tr><th>Code</th><th>Title</th><th>Version</th><th>Effective</th><th>Next review</th><th>Owner</th><th>Acknowledgement</th><th></th></tr></thead><tbody>'
   +db.sops.map(s=>{ const overdue=s.review<U.todayISO();
      return '<tr data-sop="'+s.id+'"><td class="mono small">'+U.esc(s.code)+'</td><td class="small strong">'+U.esc(s.title)+'</td><td class="mono xs">'+U.esc(s.version)+'</td><td class="num">'+U.fmtDate(s.effective)+'</td><td class="num" style="color:'+(overdue?'var(--crit)':'')+'">'+U.fmtDate(s.review)+'</td><td class="small">'+U.esc(s.owner)+'</td>'
      +'<td>'+(s.acknowledged?'<span class="pill teal">'+UI.ic('check',10)+'acknowledged</span>':'<span class="pill amber">pending</span>')+'</td><td><button class="icon-btn" style="width:26px;height:26px" data-open="'+s.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>'+db.sops.filter(s=>s.review<U.todayISO()).length+' documents past review date</span><span class="mono">'+db.sops.length+' controlled documents</span></div></div></div></div>';
}
function incidentsView(){
  const db=S.db();
  return '<div class="grid-12"><div class="c12"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="incSearch" placeholder="Search non-conformance, owner…"></div><span class="grow"></span><button class="btn sm" data-add-inc>'+UI.ic('plus',13)+'Log incident</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="incTable"><thead><tr><th>Ref</th><th>Finding</th><th>Severity</th><th>Owner</th><th>Opened</th><th>Due</th><th>Status</th></tr></thead><tbody>'
   +db.incidents.map(i=>{ const late=i.due<U.todayISO()&&i.status!=='Closed';
      return '<tr data-inc="'+i.id+'"><td class="mono small">'+U.esc(i.ref)+'</td><td><div class="primary-cell"><b>'+U.esc(i.title)+'</b><small>'+U.esc(i.rootCause||'')+'</small></div></td>'
      +'<td><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+'</span></td>'
      +'<td class="small">'+U.esc(i.owner)+'</td><td class="num">'+U.fmtDate(i.opened)+'</td><td class="num" style="color:'+(late?'var(--crit)':'')+'">'+U.fmtDate(i.due)+(late?' · late':'')+'</td>'
      +'<td><span class="pill '+(i.status==='Closed'?'teal':i.status==='Open'?'rose':'amber')+'">'+U.esc(i.status)+'</span></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>Resolution SLA: Critical 48h · Major 7d · Minor 30d</span><span class="mono">'+db.incidents.filter(i=>i.status!=='Closed').length+' open</span></div></div></div></div>';
}
function logIncident(){
  if(!LS.auth.guard('edit')) return;
  UI.modal({title:'Log non-conformance',sub:'Creates an audited quality record with an SLA clock.',width:'min(620px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Finding</label><input class="input" id="inTitle" placeholder="e.g. Fridge excursion during inventory"></div>'
     +'<div class="field"><label>Severity</label><select class="select" id="inSev"><option>Minor</option><option>Major</option><option>Critical</option></select></div>'
     +'<div class="field"><label>Owner</label><select class="select" id="inOwner">'+S.activeStaff().map(s=>'<option>'+U.esc(s.name)+'</option>').join('')+'</select></div>'
     +'<div class="field span2"><label>Root cause</label><textarea class="textarea" id="inRoot"></textarea></div>'
     +'<div class="field span2"><label>Corrective action</label><textarea class="textarea" id="inCapa"></textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Open non-conformance</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const sev=el.querySelector('#inSev').value; const sla=sev==='Critical'?2:sev==='Major'?7:30;
        S.commit(d=>{ d.incidents.unshift({id:U.uid('nc'),ref:'NC-2026-'+String(46+d.incidents.length).padStart(3,'0'),title:el.querySelector('#inTitle').value||'Untitled finding',severity:sev,owner:el.querySelector('#inOwner').value,opened:U.todayISO(),due:U.addDays(U.todayISO(),sla),status:'Open',rootCause:el.querySelector('#inRoot').value,capa:el.querySelector('#inCapa').value}); },
          {action:'quality.incident',entity:'incidents',detail:sev+' non-conformance logged'});
        close(); LS.shell.refresh(); UI.toast('Non-conformance logged · SLA clock started',{type:'ok'});
      };
    }});
}
function sopDrawer(id){
  const s=S.db().sops.find(x=>x.id===id); if(!s) return;
  UI.drawer({title:s.title,eyebrow:'Controlled document',sub:s.code+' · '+s.version,body:
    '<div class="split-2">'+[['Code',s.code],['Version',s.version],['Effective',U.fmtDate(s.effective)],['Next review',U.fmtDate(s.review)],['Owner',s.owner],['Acknowledgement',s.acknowledged?'Recorded':'Pending']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="section-head"><h2>Version history</h2></div>'
    +[['v'+s.version.replace('v',''),U.fmtDate(s.effective),'Current — approved by Laboratory Manager']].concat([['previous',U.addDays(s.effective,-365),'Superseded on controlled release']]).map(([v,d,n])=>'<div class="list-row"><div class="lr-main"><div class="lr-title mono" style="font-size:11.5px">'+U.esc(v)+'</div><div class="lr-sub">'+U.fmtDate(d)+' · '+U.esc(n)+'</div></div></div>').join('')
    +'<div class="section-head"><h2>Staff acknowledgement</h2></div>'
    +S.activeStaff().map(st=>'<div class="list-row">'+U.avatar(st.name,'sm')+'<div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(st.name)+'</div><div class="lr-sub">'+U.esc(st.role)+'</div></div>'+(s.acknowledged?'<span class="pill teal">signed</span>':'<button class="btn xs" data-ack>Sign</button>')+'</div>').join(''),
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-ackall>'+UI.ic('check',15)+'Record acknowledgement</button>',
    onMount:(panel,close)=>{
      panel.querySelector('[data-ackall]').onclick=()=>{ S.commit(d=>{ const x=d.sops.find(y=>y.id===s.id); if(x) x.acknowledged=true; },{action:'quality.sop.ack',entity:'sops',entityId:s.id,detail:'Acknowledged '+s.code}); close(); LS.shell.refresh(); UI.toast('Acknowledgement recorded',{type:'ok'}); };
      panel.querySelectorAll('[data-ack]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ const x=d.sops.find(y=>y.id===s.id); if(x) x.acknowledged=true; },{action:'quality.sop.ack',entity:'sops',entityId:s.id,detail:'Acknowledged '+s.code}); close(); LS.shell.refresh(); UI.toast('Acknowledgement recorded',{type:'ok'}); });
    }});
}
function paint(){
  const host=rootEl.querySelector('#qBody'); if(!host) return;
  host.innerHTML=tab==='overview'?overview():tab==='iso'?isoView():tab==='sops'?sopsView():incidentsView();
  U.$$('[data-q-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.qTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-q-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.qTab; paint(); });
  if(tab==='overview'){
    const months=[]; for(let i=11;i>=0;i--){ const d=new Date(); d.setMonth(d.getMonth()-i); months.push(U.M3[d.getMonth()]); }
    const m=metrics();
    C.line(r.querySelector('#qTrend'),{id:'qTrend',height:250,min:60,max:100,series:[
      {name:'TAT compliance',color:'var(--pos)',values:[88,91,90,93,92,95,94,96,95,96,m.tat,m.tat]},
      {name:'EQA composite',color:'var(--gold)',values:[84,86,88,87,90,92,94,93,95,96,97,m.eqa]},
      {name:'Rejection rate',color:'var(--crit)',values:[3.1,2.8,2.6,2.4,2.3,2.1,1.9,2.0,1.8,1.9,1.7,m.rejection]}
    ],labels:months,yFmt:v=>Math.round(v)+'%',tipFmt:v=>v+'%'});
  }
  if(tab==='iso'){
    r.querySelectorAll('[data-ck]').forEach(el=>el.onclick=()=>{ if(!LS.auth.guard('edit')) return; const id=el.dataset.ck;
      S.commit(d=>{ const c=d.checklist.find(x=>x.id===id); if(c) c.done=!c.done; },{action:'quality.checklist',entity:'checklist',entityId:id,detail:'ISO control toggled'});
      paint(); });
    r.querySelector('[data-export-iso]').onclick=()=>{ U.exportCSV('iso-15189-checklist-'+U.todayISO()+'.csv',[['Section','Control','Weight','Evidenced']].concat(S.db().checklist.map(c=>[c.section,c.item,c.weight,c.done?'yes':'no'])),{title:'ISO 15189 readiness checklist',actor:LS.auth.user.name}); UI.toast('Checklist exported',{type:'ok'}); };
  }
  if(tab==='sops'){
    r.querySelectorAll('[data-sop]').forEach(tr=>tr.onclick=()=>sopDrawer(tr.dataset.sop));
    r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); sopDrawer(b.dataset.open); });
    const s=r.querySelector('#sopSearch'); if(s) s.addEventListener('input',()=>{ const q=s.value.toLowerCase(); U.$$('#sopTable tbody tr',r).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'); });
  }
  if(tab==='incidents'){
    r.querySelectorAll('[data-inc]').forEach(tr=>tr.onclick=()=>{ const i=S.db().incidents.find(x=>x.id===tr.dataset.inc);
      UI.drawer({title:i.ref,eyebrow:'Non-conformance',sub:i.title,body:'<div class="row wrap gap-sm" style="margin-bottom:14px"><span class="pill '+(i.severity==='Critical'?'rose':i.severity==='Major'?'amber':'slate')+'">'+U.esc(i.severity)+'</span><span class="pill '+(i.status==='Closed'?'teal':'amber')+'">'+U.esc(i.status)+'</span><span class="pill slate">Owner · '+U.esc(i.owner)+'</span></div>'
        +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:12px"><div class="eyebrow">Root cause</div><p class="small" style="margin-top:4px">'+U.esc(i.rootCause||'—')+'</p></div>'
        +'<div class="card pad" style="background:var(--surface-inset)"><div class="eyebrow">Corrective / preventive action</div><p class="small" style="margin-top:4px">'+U.esc(i.capa||'—')+'</p></div>'
        +'<div class="hint" style="margin-top:12px">Opened '+U.fmtDate(i.opened)+' · SLA due '+U.fmtDate(i.due)+'</div>',
        foot:'<button class="btn" data-close>Close</button>'+(i.status!=='Closed'?'<button class="btn primary" data-close-inc>'+UI.ic('check',15)+'Close with evidence</button>':''),
        onMount:(panel,close)=>{ const b=panel.querySelector('[data-close-inc]'); if(b) b.onclick=()=>{ S.commit(d=>{ const x=d.incidents.find(y=>y.id===i.id); if(x){ x.status='Closed'; x.closedBy=LS.auth.user.name; x.closedAt=U.nowISO(); } },{action:'quality.incident.close',entity:'incidents',entityId:i.id,detail:i.ref+' closed with evidence'}); close(); LS.shell.refresh(); UI.toast('Non-conformance closed',{type:'ok'}); }; }});
    });
  }
  r.querySelectorAll('[data-add-inc]').forEach(b=>b.onclick=logIncident);
  r.querySelectorAll('[data-add-sop]').forEach(b=>b.onclick=()=>UI.toast('Document registration is controlled by the quality officer — use Staff & Settings to change ownership.',{type:'info'}));
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'overview';
  root.innerHTML='<div class="page-head"><div><h1>Quality &amp; compliance</h1><div class="sub">ISO 15189 as a product feature — readiness evidenced live, documents controlled, non-conformances tracked to closure.</div></div>'
   +'<div class="actions"><button class="btn" data-add-inc>'+UI.ic('plus',15)+' Log incident</button><a class="btn primary" href="#/eqa">'+UI.ic('target',15)+' EQA scorecard</a></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['overview','Overview'],['iso','ISO readiness'],['sops','SOP register'],['incidents','Non-conformances']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-q-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="qBody"></div>';
  paint();
};
})();
