/* ============================================================================
   MODULE · QUALITY & COMPLIANCE — SOPs and incidents
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
    rejection:st.rejectionRate, repeat:st.repeatRate, tat:st.tatCompliance, tatWindow:st.tatWindow,
    eqa:(function(){ const r=S.eqaSeries('__all'); return r.length?Math.round(U.avg(r.map(x=>x.score))*10)/10:null; })(),
    openIncidents:db.incidents.filter(i=>i.status!=='Closed').length,
    overdueIncidents:db.incidents.filter(i=>i.status!=='Closed'&&i.due<U.todayISO()).length,
    sopOverdue:db.sops.filter(s=>s.review<U.todayISO()).length,
    ackPct:Math.round(db.sops.filter(s=>s.acknowledged).length/db.sops.length*100)
  };
}
function kpis(){
  const m=metrics();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'TAT compliance',value:m.tat==null?0:m.tat,dec:1,unit:'%',icon:'timer',formatted:'0.0',
      note:m.tat==null?'No result on the register yet':m.tatWindow+'-day window · target per test',
      spark:C.spark(m.tat==null?[0,0,0,0,0,0,0,0]:[m.tat,m.tat,m.tat,m.tat,m.tat,m.tat,m.tat,m.tat],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Rejection rate',value:m.rejection==null?0:m.rejection,dec:1,unit:'%',icon:'circle-x',formatted:'0.0',
      note:m.rejection==null?'No rejection recorded on the register':'Target ≤ 2.0%',
      spark:C.spark(m.rejection==null?[0,0,0,0,0,0,0,0]:[m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection,m.rejection],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'EQA composite',value:m.eqa==null?0:m.eqa,dec:1,unit:'%',icon:'target',formatted:'0.0',
      note:m.eqa==null?'No PT round scored yet':'Mean across every PT round',
      spark:C.spark(m.eqa==null?[0,0,0,0,0,0,0,0]:[m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa,m.eqa],{color:'var(--pos)'})})+'</div></div>';
}
function overview(){
  const m=metrics(); const db=S.db();
  return '<div class="grid-12">'
   +'<div class="c12">'+UI.card({title:'Quality KPI trendlines',sub:'Referral TAT compliance and PT scores · 12 months',icon:'chart-line',cls:'gold',body:'<div id="qTrend"></div><div class="legend" style="margin-top:8px"><span class="lg"><span class="sw" style="background:var(--pos)"></span>TAT compliance %</span><span class="lg"><span class="sw" style="background:var(--gold)"></span>EQA composite %</span><span class="lg" style="margin-left:auto;color:var(--text-faint)">Blank months mean the register holds no result for that month</span></div>'})+'</div>'
   +'<div class="c3">'+UI.card({title:'Continuous improvement',sub:'Computed from the referral register',icon:'trending-up',body:
      '<div class="scorecard" style="padding:0"><div class="meta"><div class="eyebrow">TAT compliance</div><div class="serif" style="font-size:2.2rem;color:var(--text-strong);letter-spacing:-.03em">'+(m.tat==null?'—':m.tat)+'%</div><div class="xs faint">'+(m.tat==null?'No result on the register yet':m.tatWindow+'-day window')+'</div></div>'+C.ring(m.tat==null?0:m.tat,{size:76,stroke:6})+'</div>'
      +'<div class="thread" style="margin:12px 0"></div>'
      +[['Repeat rate',m.repeat==null?'no record':m.repeat+'%','teal'],['Rejection rate',m.rejection==null?'no record':m.rejection+'%','amber'],['Referred samples',S.referredSamples().length+'','slate']].map(([k,v,t])=>'<div class="row between" style="padding:6px 0"><span class="small">'+k+'</span><span class="pill '+t+' mono">'+v+'</span></div>').join('')})+'</div>'
   +'<div class="c4">'+UI.card({title:'Non-conformances',sub:'Severity · owner · resolution SLA',icon:'alert-triangle',
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
function sopEditor(id){
  if(!LS.auth.guard('edit')) return;
  const existing=id?S.db().sops.find(x=>x.id===id):null;
  if(id&&!existing) return;
  const doc=existing||{};
  const fields=[['Code','code','text'],['Title','title','text'],['Version','version','text'],['Effective date','effective','date'],['Next review','review','date'],['Owner','owner','text']];
  UI.modal({title:existing?'Edit SOP':'Register SOP',sub:'Review and verify all template details before use.',width:'min(620px,100%)',
    body:'<div class="form-grid">'+fields.map(([label,key,type])=>'<div class="field"><label>'+U.esc(label)+'</label><input class="input" type="'+type+'" data-sop-field="'+key+'" value="'+U.esc(doc[key]||'')+'"></div>').join('')+'<div class="field span2"><label>SOP text</label><textarea class="textarea" data-sop-field="content" rows="12">'+U.esc(doc.content||'')+'</textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save-sop>Save SOP</button>',
    onMount:(el,close)=>{el.querySelector('[data-save-sop]').onclick=()=>{
      const record={};el.querySelectorAll('[data-sop-field]').forEach(input=>{record[input.dataset.sopField]=input.value.trim();});
      if(!record.code||!record.title||!record.review) return UI.toast('Enter a code, title and next review date',{type:'warn'});
      if(S.db().sops.some(x=>x.id!==id&&String(x.code).toLowerCase()===record.code.toLowerCase())) return UI.toast('This SOP code already exists',{type:'warn'});
      S.commit(d=>{if(existing){const x=d.sops.find(y=>y.id===id);if(x){x.history=(x.history||[]).concat([{code:x.code,title:x.title,version:x.version,effective:x.effective,review:x.review,owner:x.owner,content:x.content||'',at:U.nowISO(),by:LS.auth.user.name}]);Object.assign(x,record);}}else d.sops.push(Object.assign({id:U.uid('sop'),acknowledged:false,history:[]},record));},{action:existing?'quality.sop.edit':'quality.sop.add',entity:'sops',entityId:id||'',detail:'SOP '+record.code});
      close();paint();UI.toast('SOP saved',{type:'ok'});
    };}
  });
}
function sopDrawer(id){
  const s=S.db().sops.find(x=>x.id===id); if(!s) return;
  UI.drawer({title:s.title,eyebrow:'SOP register',sub:s.code+' · '+s.version,
    body:'<div class="split-2">'+[['Effective',U.fmtDate(s.effective)],['Next review',U.fmtDate(s.review)],['Owner',s.owner]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v||'—')+'</span></div>').join('')+'</div><div class="section-head"><h2>SOP text</h2></div><p style="white-space:pre-wrap">'+U.esc(s.content||'No SOP text has been entered. Verify template details before use.')+'</p><div class="hint">'+(s.history||[]).length+' saved prior edit(s). No approval is inferred.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-edit-sop>Edit SOP</button>',
    onMount:(panel,close)=>{panel.querySelector('[data-edit-sop]').onclick=()=>{close();sopEditor(id);};}
  });
}
function paint(){
  const host=rootEl.querySelector('#qBody'); if(!host) return;
  host.innerHTML=tab==='overview'?overview():tab==='sops'?sopsView():incidentsView();
  U.$$('[data-q-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.qTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-q-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.qTab; paint(); });
  if(tab==='overview'){
    /* Both lines come from the register: referral TAT month by month, and the EQA
       scores in the order they were reported. Nothing is smoothed or invented. */
    const tatSeries=S.referralTATSeries(null,12);
    const eqaRows=S.eqaSeries('__all');
    const months=tatSeries.map(x=>x.label);
    C.line(r.querySelector('#qTrend'),{id:'qTrend',height:250,min:0,max:100,zeroBase:true,series:[
      {name:'TAT compliance',color:'var(--pos)',values:tatSeries.map(x=>x.compliance)},
      {name:'PT score',color:'var(--gold)',values:tatSeries.map((x,i)=>{ const r=eqaRows[i]; return r?r.score:null; })}
    ],labels:months,yFmt:v=>Math.round(v)+'%',tipFmt:v=>v+'%'});
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
  r.querySelectorAll('[data-add-sop]').forEach(b=>b.onclick=()=>sopEditor());
}
M.render=function(root,params){
  rootEl=root; tab=['overview','sops','incidents'].includes(params.tab)?params.tab:'overview';
  root.innerHTML='<div class="page-head"><div><h1>Quality &amp; compliance</h1><div class="sub">SOP register and non-conformances.</div></div>'
   +'<div class="actions"><button class="btn" data-add-inc>'+UI.ic('plus',15)+' Log incident</button><a class="btn primary" href="#/eqa">'+UI.ic('target',15)+' EQA scorecard</a></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['overview','Overview'],['sops','SOP register'],['incidents','Non-conformances']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-q-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="qBody"></div>';
  paint();
};
})();
