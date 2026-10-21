/* ============================================================================
   MODULE · REFERRED SAMPLES — register wizard, chain of custody, manifest
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.samples=M;
let rootEl=null, st=null, onScroll=null;

const REF={
  'CBC (Full Blood Count)':{unit:'×10⁹/L',lo:4,hi:11,dec:1},
  'Fasting Blood Glucose':{unit:'mmol/L',lo:3.9,hi:5.6,dec:1},
  'Serum Creatinine':{unit:'µmol/L',lo:53,hi:106,dec:0},
  'ALT (SGPT)':{unit:'U/L',lo:7,hi:45,dec:0},
  'Hemoglobin':{unit:'g/dL',lo:12,hi:17,dec:1},
  'HIV Rapid Test (Determine)':{unit:'',lo:null,hi:null,dec:0},
  'Malaria RDT':{unit:'',lo:null,hi:null,dec:0},
  'Blood Slide for Malaria':{unit:'parasites/µL',lo:0,hi:0,dec:0},
  'TB Culture':{unit:'',lo:null,hi:null,dec:0}
};
const FILTERS=[
  {k:'all',label:'All samples'},
  {k:'active',label:'Active'},
  {k:'stat',label:'STAT'},
  {k:'overdue',label:'Overdue'},
  {k:'rbc',label:'Awaiting RBC'},
  {k:'resulted',label:'Resulted'}
];
function base(){
  if(!st) st={q:'',filter:'all',selected:new Set(),limit:90,sort:'collected',dir:'desc'};
  return st;
}
function filtered(){
  const s=base(), db=S.db();
  let list=db.samples.slice();
  if(s.filter==='active') list=list.filter(x=>!x.resultedAt);
  else if(s.filter==='stat') list=list.filter(x=>x.priority==='STAT'&&!x.resultedAt);
  else if(s.filter==='overdue') list=list.filter(x=>!x.resultedAt&&S.tatFor(x).breached);
  else if(s.filter==='resulted') list=list.filter(x=>!!x.resultedAt);
  else if(s.filter==='rbc') list=list.filter(x=>/NRL|RBC/i.test(x.hospital||''));
  if(s.q){
    const q=s.q.toLowerCase();
    list=list.filter(x=>[x.sampleId,x.patientName,x.test,x.healthFacility,x.hospital,x.transporter].join(' ').toLowerCase().indexOf(q)>=0);
  }
  const dir=s.dir==='asc'?1:-1;
  if(s.sort==='collected') list.sort((a,b)=>String(a.collectionAt||a.collectionDate).localeCompare(String(b.collectionAt||b.collectionDate))*dir);
  if(s.sort==='tat') list.sort((a,b)=>(S.tatFor(a).ratio-S.tatFor(b).ratio)*dir);
  if(s.sort==='priority'){ const r=p=>p==='STAT'?0:p==='Follow-up'?1:2; list.sort((a,b)=>(r(a.priority)-r(b.priority))*dir); }
  if(s.sort==='id') list.sort((a,b)=>String(a.sampleId).localeCompare(String(b.sampleId))*dir);
  return list;
}
function counts(){
  const db=S.db(); const all=db.samples;
  return {all:all.length, active:all.filter(x=>!x.resultedAt).length, stat:all.filter(x=>x.priority==='STAT'&&!x.resultedAt).length,
    overdue:all.filter(x=>!x.resultedAt&&S.tatFor(x).breached).length, resulted:all.filter(x=>!!x.resultedAt).length,
    rbc:all.filter(x=>/NRL|RBC/i.test(x.hospital||'')).length};
}
function rowHTML(s,sel){
  const t=S.tatFor(s); const pct=U.clamp(t.ratio*100,2,100);
  const tone=t.done? 'teal' : t.breached?'rose':t.ratio>.8?'amber':'teal';
  const pri=s.priority==='STAT'?'stat':s.priority==='Follow-up'?'follow':'routine';
  const label=s.priority==='STAT'?'STAT':s.priority==='Follow-up'?'FLW':'RTN';
  const tatCell = s.resultedAt
    ? '<span class="mono xs">'+Math.round(t.elapsedH)+'h <span class="faint">/ '+Math.round(t.targetH)+'h</span></span>'
    : '<div style="width:86px"><div class="meter '+tone+'"><i style="width:'+pct+'%"></i></div><div class="xs" style="margin-top:3px;color:'+(t.breached?'var(--crit)':t.ratio>.8?'var(--warn)':'var(--text-faint)')+'">'+(t.breached?'breach +'+Math.round(-t.remainingH)+'h':Math.round(t.remainingH)+'h left')+'</div></div>';
  return '<tr class="prio-'+pri+(sel.has(s.id)?' selected':'')+'" data-row="'+s.id+'">'
   +'<td style="width:34px"><span class="checkbox '+(sel.has(s.id)?'on':'')+'" data-check="'+s.id+'">'+UI.ic('check',10)+'</span></td>'
   +'<td style="width:58px"><span class="priority-flag '+pri+'">'+label+'</span></td>'
   +'<td><div class="primary-cell"><b class="mono" style="font-size:11px;letter-spacing:-.01em">'+U.esc(s.sampleId)+'</b><small>'+U.esc(s.patientName)+' · '+(s.sex||'—')+'</small></div></td>'
   +'<td><span class="small truncate" style="display:block;max-width:150px">'+U.esc(s.test)+'</span><span class="xs faint mono">'+U.esc(s.testCode||'')+'</span></td>'
   +'<td class="hide-sm"><span class="small truncate" style="display:block;max-width:130px">'+U.esc(s.healthFacility||s.healthCenter||'—')+'</span><span class="xs faint truncate" style="display:block;max-width:130px">'+U.esc(s.hospital||'Ruli DH')+'</span></td>'
   +'<td><span class="pill '+U.statusTone(s.status)+'">'+U.esc(s.status)+'</span></td>'
   +'<td>'+tatCell+'</td>'
   +'<td class="hide-lg">'+(s.flag?'<span class="pill rose">'+U.esc(s.flag)+'</span>':'<span class="xs faint">—</span>')+'</td>'
   +'<td class="hide-sm">'+UI.audit({by:s.collector||'Register',date:s.collectionDate})+'</td>'
   +'<td style="width:34px"><button class="icon-btn row-actions" style="width:26px;height:26px" data-open="'+s.id+'" aria-label="Open sample">'+UI.ic('chevron-right',14)+'</button></td></tr>';
}
function tableHTML(){
  const s=base(); const list=filtered(); const shown=list.slice(0,s.limit); const cnt=counts();
  const rows=shown.map(x=>rowHTML(x,s.selected)).join('');
  const bulk=s.selected.size? '<div class="bulkbar">'+UI.ic('layers',13)+'<b>'+s.selected.size+' selected</b><span class="faint">·</span><button class="btn xs" data-bulk-manifest>Add to manifest</button><button class="btn xs" data-bulk-export>Export selection</button><button class="btn xs ghost" data-bulk-clear>Clear</button><span class="grow"></span><span class="xs faint">Chain of custody preserved</span></div>':'';
  return '<div class="card table-card">'
   +'<div class="toolbar">'
     +'<div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="smpSearch" placeholder="Search sample ID, patient, facility…" value="'+U.esc(s.q)+'"></div>'
     +'<div class="filters">'+FILTERS.map(f=>'<button class="filter-tab '+(s.filter===f.k?'on':'')+'" data-filter="'+f.k+'">'+f.label+'<span class="cnt">'+cnt[f.k]+'</span></button>').join('')+'</div>'
     +'<span class="grow"></span>'
     +'<div class="row gap-sm">'
       +'<button class="btn sm" data-saved>'+UI.ic('book-marked',13)+' Saved views</button>'
       +'<button class="btn sm" data-export>'+UI.ic('download',13)+'<span class="hide-sm">Export</span></button>'
       +'<button class="btn primary sm" data-new>'+UI.ic('plus',14)+'<span class="hide-sm">New sample</span></button>'
     +'</div>'
   +'</div>'
   +bulk
   +'<div class="dt-scroll" id="smpScroll"><table class="dt" id="smpTable">'
   +'<thead><tr><th style="width:34px"></th><th style="width:58px">Pri</th><th data-sort="id" class="sortable"><span class="sort">Sample '+UI.ic('chevron-down',10)+'</span></th><th>Test</th><th class="hide-sm">Origin → laboratory</th><th>Status</th><th data-sort="tat" class="sortable"><span class="sort">TAT '+UI.ic('chevron-down',10)+'</span></th><th class="hide-lg">Flag</th><th class="hide-sm">Audit</th><th></th></tr></thead>'
   +'<tbody id="smpBody">'+(rows||'<tr><td colspan="10">'+UI.empty({art:'samples',title: s.q?'No samples match “'+U.esc(s.q)+'”':'Nothing in this view',body: s.q?'Try a sample ID, patient surname or facility. Filters stay shareable by URL.':'Register a sample to begin the chain of custody. Every registration is stamped to the audit trail.',action:'<button class="btn primary" data-new>'+UI.ic('plus',14)+' Register sample</button>'})+'</td></tr>')+'</tbody></table>'
   +'<div id="smpMore" style="padding:10px 14px;text-align:center">'+(list.length>s.limit?'<button class="btn sm" data-more>Load '+(Math.min(100,list.length-s.limit))+' more · '+list.length+' matching</button>':'<span class="xs faint">'+list.length+' samples · sorted by '+(s.sort==='tat'?'TAT pressure':'newest collection')+'</span>')+'</div>'
   +'</div></div>';
}

function referralPanel(){
  const db=S.db();
  const items=U.uniq(db.samples.map(s=>s.hospital)).filter(h=>/NRL|CHUK|Kibagabaga|GeneXpert/i.test(h)).map(h=>{
    const list=db.samples.filter(s=>s.hospital===h);
    const transit={'NRL':72,'CHUK':48,'Kibagabaga':36,'Ruli DH - GeneXpert':0}[h]||24;
    return {label:h,value:list.length,transit,avgTat:Math.round(U.avg(list.map(s=>S.tatFor(s).elapsedH)))};
  }).sort((a,b)=>b.value-a.value);
  const max=items[0]?items[0].value:1;
  return UI.card({title:'Referral network',sub:'Partner laboratories · volume & transit SLA',icon:'truck',
    body:'<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">'
      +'<span class="pill gold">'+items.reduce((a,b)=>a+b.value,0)+' referred</span><span class="pill teal">96% on-time dispatch</span><span class="pill slate">3 routes</span></div>'
      +'<div style="display:flex;flex-direction:column;gap:9px">'+items.map(it=>'<div>'
        +'<div class="row between" style="margin-bottom:4px"><span class="small truncate">'+U.esc(it.label)+'</span><span class="mono xs faint">'+it.transit+'h SLA</span></div>'
        +'<div style="height:6px;border-radius:99px;background:var(--surface-3);overflow:hidden"><div style="height:100%;width:'+Math.round(it.value/max*100)+'%;background:linear-gradient(90deg,var(--gold-700),var(--gold-300));border-radius:99px"></div></div>'
        +'<div class="row between" style="margin-top:3px"><span class="xs faint">'+it.value+' samples</span><span class="xs '+(it.avgTat>it.transit?'':'')+'" style="color:'+(it.avgTat>it.transit?'var(--warn)':'var(--pos)')+'">avg '+it.avgTat+'h</span></div></div>').join('')+'</div>',
    foot:'<a class="more" href="#/stock" style="color:var(--gold)">Manage referral routes '+UI.ic('arrow-right',12)+'</a>'});
}

/* ——— Drawer: sample detail + chain of custody ————— */
function openSample(id){
  const db=S.db(); const s=db.samples.find(x=>x.id===id); if(!s) return;
  const t=S.tatFor(s);
  const ref=REF[s.test]||{unit:'',lo:null,hi:null,dec:1};
  const steps=[
    {k:'Collected',at:s.collectionAt||s.collectionDate,by:s.collector||'Phlebotomy',done:true},
    {k:'Received at Ruli DH',at:s.receivedAt||s.sentDate,by:'Sample reception · Beatrice NGEZEKURE',done:!!s.receivedAt||['Received','Pending','Resulted','Done','Positive','Negative'].indexOf(s.status)>=0},
    {k:'Dispatched for referral',at:s.sentDate,by:s.transporter||'RBC courier',done:!!s.sentDate},
    {k:'Resulted',at:s.resultedAt,by:s.resultBy||'Laboratory',done:!!s.resultedAt}
  ];
  const current=steps.findIndex(x=>!x.done);
  const body=''
   +'<div class="row wrap" style="gap:6px;margin-bottom:14px"><span class="priority-flag '+(s.priority==='STAT'?'stat':s.priority==='Follow-up'?'follow':'routine')+'">'+U.esc(s.priority)+'</span>'
     +'<span class="pill '+U.statusTone(s.status)+'">'+U.esc(s.status)+'</span>'
     +'<span class="pill slate mono">'+U.esc(s.testCode||'GEN')+'</span>'
     +(s.flag?'<span class="pill rose">'+U.esc(s.flag)+'</span>':'')
     +(s.manifestId?'<span class="pill gold">On manifest</span>':'')+'</div>'
   +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:14px">'
     +'<div class="row between" style="margin-bottom:10px"><div><div class="eyebrow">Sample ID</div><div class="mono" style="font-size:15px;color:var(--text-strong);letter-spacing:.02em;margin-top:2px">'+U.esc(s.sampleId)+'</div></div>'+UI.barcode(s.sampleId)+'</div>'
     +'<div class="thread" style="margin:10px 0"></div>'
     +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'
       +[['Patient',s.patientName],['Patient ID',s.patientId||'—'],['Sex',s.sex||'—'],['Origin',s.healthFacility||'—'],['Test',s.test],['Receiving lab',s.hospital||'Ruli DH'],['Collected',U.fmtDate(s.collectionDate)],['Target TAT',s.tatTargetDays+' days']].map(([k,v])=>'<div><div class="eyebrow">'+k+'</div><div class="small" style="margin-top:2px">'+U.esc(v)+'</div></div>').join('')
     +'</div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('timer',14,'ic')+'Turnaround</div><div class="card-sub">'+(s.resultedAt?'Completed in '+Math.round(t.elapsedH)+'h of a '+Math.round(t.targetH)+'h target':'Due '+U.fmtDate(U.isoLocal(t.dueAt)))+'</div></div>'
     +'<span class="pill '+(t.breached?'rose':t.ratio>.8?'amber':'teal')+'">'+(t.breached?'Breached':t.ratio>.8?'At risk':'On track')+'</span></div>'
     +'<div class="card-body">'+UI.meter(U.clamp(t.ratio*100,1,100),t.breached?'rose':t.ratio>.8?'amber':'teal',100)+'<div class="row between" style="margin-top:6px"><span class="xs faint">'+Math.round(t.elapsedH)+'h elapsed</span><span class="xs faint">'+Math.round(t.targetH)+'h target</span></div></div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('git-branch',14,'ic')+'Chain of custody</div><div class="card-sub">Append-only · actor + timestamp on every handoff</div></div></div><div class="card-body"><div class="custody">'
     +steps.map((x,i)=>'<div class="custody-step '+(x.done?'done':(i===current?'current':'pending'))+'"><div class="node">'+UI.ic(x.done?'check':'circle-dot',9)+'</div><div class="cs-t">'+U.esc(x.k)+'</div><div class="cs-m">'+(x.done?U.fmtDT(x.at)+' · '+U.esc(x.by):'Pending')+'</div></div>').join('')
     +'</div></div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('test-tube',14,'ic')+'Result entry</div><div class="card-sub">Reference range '+ (ref.lo!=null?ref.lo+'–'+ref.hi+' '+ref.unit:'qualitative')+' · auto-flagged</div></div></div>'
     +'<div class="card-body">'
       +(s.resultedAt?'<div class="row between" style="padding:10px 12px;border-radius:8px;background:var(--pos-soft);border:1px solid var(--pos-border);margin-bottom:10px"><div><div class="strong" style="font-size:13px">'+U.esc(s.resultValue||'Verified')+'</div><div class="xs faint">'+U.fmtDT(s.resultedAt)+' · '+U.esc(s.resultBy||'Laboratory')+'</div></div><span class="pill teal">Released</span></div>':'')
       +'<div class="form-grid"><div class="field"><label>Result value</label><input class="input mono" id="resVal" placeholder="'+(ref.lo!=null?ref.lo+'–'+ref.hi:'e.g. Positive')+'" value="'+U.esc(s.resultValue||'')+'"></div>'
       +'<div class="field"><label>Unit</label><input class="input mono" value="'+U.esc(ref.unit||'qualitative')+'" readonly></div></div>'
       +'<div id="resFlag" class="hint" style="margin-top:8px">Out-of-range values are flagged automatically and require a comment.</div>'
       +'<div class="field" style="margin-top:10px"><label>Comment</label><textarea class="textarea" id="resNote" placeholder="Optional — critical value notification, repeat, dilution…"></textarea></div>'
       +'<button class="btn primary sm" data-save-result style="margin-top:10px">'+UI.ic('check',14)+' Verify & release result</button>'
     +'</div></div>'
   +'<div class="card pad" style="background:var(--surface-inset)"><div class="row between"><div class="xs faint">Created by '+U.esc(s.collector||'Register')+' · '+U.fmtDate(s.collectionDate)+'</div><div class="xs faint mono">'+U.esc(s.source||'register')+' · '+U.esc(s.id)+'</div></div></div>';
  const d=UI.drawer({title:s.patientName,eyebrow:'Sample record',sub:s.sampleId+' · '+s.test,wide:true,body:body,
    foot:'<button class="btn" data-close>Close</button>'
      +(s.manifestId?'<button class="btn" data-print-manifest>'+UI.ic('printer',15)+'Print manifest</button>':'<button class="btn" data-add-manifest>'+UI.ic('clipboard-list',15)+'Add to manifest</button>')
      +(s.resultedAt?'':'<button class="btn" data-quick-result>'+UI.ic('check',15)+'Quick result</button>')});
  const panel=d.panel;
  const val=panel.querySelector('#resVal');
  if(val) val.addEventListener('input',()=>{
    const v=parseFloat(val.value); const box=panel.querySelector('#resFlag');
    if(ref.lo==null||isNaN(v)){ box.innerHTML='Out-of-range values are flagged automatically and require a comment.'; box.style.color=''; return; }
    const high=v>ref.hi, low=v<ref.lo;
    box.innerHTML=high?'▲ Above reference range ('+ref.hi+' '+ref.unit+') — will be flagged HIGH':low?'▼ Below reference range ('+ref.lo+' '+ref.unit+') — will be flagged LOW':'Within reference range';
    box.style.color=high||low?'var(--crit)':'var(--pos)';
  });
  panel.querySelector('[data-save-result]')?.addEventListener('click',()=>{
    if(!LS.auth.guard('edit')) return;
    const raw=panel.querySelector('#resVal').value.trim();
    if(!raw) return UI.toast('Enter a result value first',{type:'warn'});
    const v=parseFloat(raw);
    let flag=null;
    if(ref.lo!=null&&!isNaN(v)) flag = v>ref.hi?'HIGH':v<ref.lo?'LOW':null;
    S.commit(db2=>{ const x=db2.samples.find(y=>y.id===s.id); if(!x) return;
      x.resultValue=raw; x.flag=flag; x.resultedAt=U.nowISO(); x.resultDate=U.todayISO(); x.status='Done'; x.resultBy=LS.auth.user.name;
    },{action:'sample.result',entity:'samples',entityId:s.id,detail:'Result released for '+s.sampleId+(flag?' · flagged '+flag:'')+' · '+raw});
    UI.toast('Result released'+(flag?' · flagged '+flag:''),{type:'ok'});
    d.close(); LS.shell.refresh();
  });
  panel.querySelector('[data-quick-result]')?.addEventListener('click',()=>{ panel.querySelector('#resVal')?.focus(); panel.querySelector('#resVal')?.scrollIntoView({block:'center',behavior:'smooth'}); });
  panel.querySelector('[data-add-manifest]')?.addEventListener('click',()=>{ addToManifest([s.id]); });
  panel.querySelector('[data-print-manifest]')?.addEventListener('click',()=>{ const man=S.db().manifests.find(m=>m.id===s.manifestId); if(man) printManifest(man); });
}

/* ——— Manifest ————————————————————————— */
function addToManifest(ids){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const candidates=db.samples.filter(s=>!s.manifestId && !s.resultedAt).slice(0,40);
  UI.modal({title:'Add to manifest',sub:'Select samples travelling to the same receiving laboratory. Manifest IDs are generated with the Ruli DH prefix.',
    width:'min(680px,100%)',
    body:'<div class="field" style="margin-bottom:12px"><label>Receiving laboratory</label><select class="select" id="manHosp">'+U.uniq(candidates.map(s=>s.hospital||'Ruli DH')).map(h=>'<option>'+U.esc(h)+'</option>').join('')+'</select></div>'
      +'<div style="max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:9px">'+(candidates.length?candidates.map(s=>'<label class="row" style="padding:8px 11px;border-bottom:1px solid var(--border);gap:9px;cursor:pointer"><input type="checkbox" data-man-pick value="'+s.id+'" '+(ids.includes(s.id)?'checked':'')+' style="accent-color:#C9A84C"><span class="grow"><span class="small mono">'+U.esc(s.sampleId)+'</span> <span class="xs faint">'+U.esc(s.patientName)+' · '+U.esc(s.test)+'</span></span><span class="pill slate">'+U.esc(s.healthFacility||'—')+'</span></label>').join(''):'<div class="empty" style="padding:24px"><p class="xs muted">No unmanifested active samples.</p></div>')+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-gen>'+UI.ic('clipboard-list',15)+'Generate manifest</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-gen]').onclick=()=>{
        const picks=U.$$('[data-man-pick]:checked',el).map(x=>x.value);
        if(!picks.length) return UI.toast('Select at least one sample',{type:'warn'});
        const hosp=el.querySelector('#manHosp').value;
        const db2=S.db(); db2.manifestCounter=db2.manifestCounter||{last:26030410,tail:'GEDK'};
        db2.manifestCounter.last++;
        const mid=U.fyLabel().slice(0,4)+String(db2.manifestCounter.last).padStart(6,'0')+db2.manifestCounter.tail;
        const man={id:U.uid('man'),manifestId:mid,type:'Referral',title:'Sample Referral Manifest',testingHospital:hosp,createdAt:U.todayISO(),samples:picks,status:'Generated',createdBy:LS.auth.user.name};
        S.commit(d=>{ d.manifests.unshift(man); picks.forEach(id=>{ const s=d.samples.find(x=>x.id===id); if(s){ s.manifestId=man.id; s.status='Received'; if(!s.receivedAt) s.receivedAt=U.nowISO(); } }); },{action:'manifest.create',entity:'manifest',entityId:man.id,detail:picks.length+' samples on manifest '+mid+' → '+hosp});
        close(); UI.toast('Manifest '+mid+' generated · '+picks.length+' samples',{type:'ok',actions:[{label:'Preview',onClick:()=>printManifest(man)}]});
        LS.shell.refresh();
      };
    }});
}
function printManifest(man){
  const db=S.db(); const samples=man.samples.map(id=>db.samples.find(s=>s.id===id)).filter(Boolean);
  const body='<table><thead><tr><th>#</th><th>Sample ID</th><th>Patient</th><th>Sex</th><th>Test</th><th>Origin</th><th>Collected</th><th>Priority</th></tr></thead><tbody>'
    +samples.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(s.sampleId)+'</td><td>'+U.esc(s.patientName)+'</td><td>'+U.esc(s.sex||'')+'</td><td>'+U.esc(s.test)+'</td><td>'+U.esc(s.healthFacility||'')+'</td><td>'+U.fmtDate(s.collectionDate)+'</td><td>'+U.esc(s.priority)+'</td></tr>').join('')
    +'</tbody></table>'
    +'<p style="font-size:8.5px;color:#444;margin-top:10px">Total samples: <b>'+samples.length+'</b> · Manifest ID <b>'+U.esc(man.manifestId)+'</b> · Receiving laboratory <b>'+U.esc(man.testingHospital)+'</b> · Dispatcher '+(LS.auth.user?U.esc(LS.auth.user.name):'')+' · Generated '+U.fmtDate(U.todayISO())+'</p>';
  U.printDoc('Sample Referral Manifest — '+man.manifestId,body,{landscape:true,signatures:true,meta:'<span>Triple packaging UN3373 · cold chain where required</span><span>Page 1 of 1</span>'});
}
function manifestPreviewModal(man){
  const db=S.db(); const samples=man.samples.map(id=>db.samples.find(s=>s.id===id)).filter(Boolean);
  const doc='<div class="manifest-doc" id="manDoc"><div class="mhead"><div><h1>'+U.esc(db.settings.hospital)+'</h1><div style="font-size:9px;color:#666;letter-spacing:.08em;text-transform:uppercase">'+U.esc(db.settings.dept)+' · Referral manifest</div></div>'
    +'<div style="text-align:right"><div style="font-family:monospace;font-size:12px;font-weight:700">'+U.esc(man.manifestId)+'</div><div style="font-size:9px;color:#666">'+U.fmtDate(man.createdAt)+'</div></div></div>'
    +'<div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:8px"><span><b>To:</b> '+U.esc(man.testingHospital)+'</span><span><b>Samples:</b> '+samples.length+'</span><span><b>Priority:</b> STAT where flagged</span></div>'
    +'<table><thead><tr><th>#</th><th>Sample ID</th><th>Patient</th><th>Test</th><th>Origin</th><th>Collected</th></tr></thead><tbody>'
    +samples.map((s,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(s.sampleId)+'</td><td>'+U.esc(s.patientName)+'</td><td>'+U.esc(s.test)+'</td><td>'+U.esc(s.healthFacility||'')+'</td><td>'+U.fmtDate(s.collectionDate)+'</td></tr>').join('')
    +'</tbody></table><div class="sig"><div>Dispatched by</div><div>Received by (laboratory)</div><div>Date / time</div></div></div>';
  UI.modal({title:'Manifest preview',sub:'Print-ready, letterheaded and signature-blocked.',width:'min(780px,100%)',
    body:doc,
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-copy-man>'+UI.ic('copy',15)+'Copy data</button><button class="btn primary" data-print-man>'+UI.ic('printer',15)+'Print manifest</button>',
    onMount:(el)=>{ el.querySelector('[data-print-man]').onclick=()=>printManifest(man);
      el.querySelector('[data-copy-man]').onclick=async()=>{ const ok=await U.copy(U.toCSV([['Sample ID','Patient','Test','Origin','Collected']].concat(samples.map(s=>[s.sampleId,s.patientName,s.test,s.healthFacility,U.fmtDate(s.collectionDate)])))); UI.toast(ok?'Manifest copied as CSV':'Copy failed',{type:ok?'ok':'err'}); }; }});
}

/* ——— Register wizard ————————————————— */
function newWizard(){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const tests=db.catalog.tests;
  const hcs=db.catalog.healthCenters.map(h=>h.name);
  const hospitals=db.catalog.hospitals.map(h=>h.name).concat(['Ruli DH - GeneXpert']);
  const state={step:1,patient:{name:'',pid:'',sex:'Female',age:''},tests:[],priority:'Routine',origin:hcs[0],hospital:hospitals[0],transporter:'',notes:'',sampleId:''};
  const previewId=()=>{
    const seq=(db.meta.sampleSeq||120000)+1;
    return 'RDH-'+U.fyLabel().slice(-4)+'-'+String(seq).padStart(6,'0');
  };
  const stepHTML=()=>{
    if(state.step===1) return '<div class="wizard-step">'
      +'<div class="form-grid"><div class="field span2"><label>Patient full name *</label><input class="input" id="wName" value="'+U.esc(state.patient.name)+'" placeholder="e.g. MUKAMANA Alice" autocomplete="off"></div>'
      +'<div class="field"><label>Patient / insurance ID</label><input class="input mono" id="wPid" value="'+U.esc(state.patient.pid)+'" placeholder="430129"></div>'
      +'<div class="field"><label>Sex</label><select class="select" id="wSex">'+['Female','Male'].map(x=>'<option '+(state.patient.sex===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Age</label><input class="input mono" id="wAge" value="'+U.esc(state.patient.age)+'" placeholder="34" inputmode="numeric"></div>'
      +'<div class="field"><label>Priority</label><select class="select" id="wPri">'+['Routine','STAT','Follow-up'].map(x=>'<option '+(state.priority===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>'
      +'<div class="hint" style="margin-top:10px">Patient identifiers are stored only in the local register. STAT samples are pinned to the top of the worklist and excluded from batching.</div></div>';
    if(state.step===2) return '<div class="wizard-step">'
      +'<div class="field" style="margin-bottom:10px"><label>Search test menu</label><div class="searchbox">'+UI.ic('search',14)+'<input class="input" id="wTestSearch" placeholder="CBC, malaria, GeneXpert…"></div></div>'
      +'<div id="wTestList" style="max-height:300px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      +tests.map(t=>'<button class="choice '+(state.tests.includes(t.id)?'on':'')+'" data-test="'+t.id+'" data-name="'+U.esc(t.name.toLowerCase())+'"><span class="cmark">'+UI.ic('check',9)+'</span><span class="grow"><span class="ct">'+U.esc(t.name)+'</span><span class="cs" style="display:block">'+U.esc(t.cat)+' · TAT '+t.tat+'d · '+U.esc(t.code)+'</span></span></button>').join('')
      +'</div><div class="row between" style="margin-top:10px"><span class="hint" id="wTestCount">'+state.tests.length+' selected</span><span class="hint">Barcode generated on save</span></div></div>';
    return '<div class="wizard-step">'
      +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:12px"><div class="row between"><div><div class="eyebrow">Auto-generated sample ID</div><div class="mono" style="font-size:14px;color:var(--text-strong);margin-top:3px">'+previewId()+'</div></div>'+UI.barcode(previewId())+'</div></div>'
      +'<div class="form-grid"><div class="field"><label>Originating health facility</label><select class="select" id="wOrigin">'+hcs.map(h=>'<option '+(state.origin===h?'selected':'')+'>'+U.esc(h)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Receiving laboratory</label><select class="select" id="wHosp">'+hospitals.map(h=>'<option '+(state.hospital===h?'selected':'')+'>'+U.esc(h)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Transporter</label><select class="select" id="wTrans"><option value="">— assign later —</option>'+S.activeStaff().map(s=>'<option '+(state.transporter===s.name?'selected':'')+'>'+U.esc(s.name)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Collection date</label><input class="input mono" value="'+U.todayISO()+'" readonly></div>'
      +'<div class="field span2"><label>Notes for receiving laboratory</label><textarea class="textarea" id="wNote" placeholder="Triple packaging, cold chain, clinical context…">'+U.esc(state.notes)+'</textarea></div></div>'
      +'<div class="card pad" style="margin-top:12px;background:rgba(201,168,76,.05);border-color:var(--border-gold)"><div class="row gap-sm"><span class="pill gold">'+state.tests.length+' test'+(state.tests.length===1?'':'s')+'</span><span class="pill '+ (state.priority==='STAT'?'rose':'slate')+'">'+U.esc(state.priority)+'</span><span class="pill slate">'+U.esc(state.origin)+' → '+U.esc(state.hospital)+'</span></div></div>';
  };
  const m=UI.modal({title:'Register a referred sample',sub:'Three steps · keyboard navigable · Enter advances, Esc closes.',width:'min(620px,100%)',
    body:'<div class="row between" style="margin-bottom:14px"><div class="step-dots"><span class="step-dot on"></span><span class="step-dot"></span><span class="step-dot"></span></div><span class="xs faint" id="wStepLbl">Step 1 of 3 · Patient</span></div><div id="wBody">'+stepHTML()+'</div>',
    foot:'<button class="btn ghost" data-wback hidden>'+UI.ic('arrow-left',14)+'Back</button><span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-wnext>Continue '+UI.ic('arrow-right',14)+'</button>',
    onMount:(el,close)=>{
      const body=el.querySelector('#wBody'), next=el.querySelector('[data-wnext]'), back=el.querySelector('[data-wback]');
      const syncDots=()=>{ U.$$('.step-dot',el).forEach((d,i)=>d.classList.toggle('on',i<state.step)); el.querySelector('#wStepLbl').textContent='Step '+state.step+' of 3 · '+['Patient','Tests','Routing'][state.step-1]; back.hidden=state.step===1; next.innerHTML=state.step===3?'Create sample '+UI.ic('check',14):'Continue '+UI.ic('arrow-right',14); };
      const capture=()=>{
        if(state.step===1){ state.patient.name=(el.querySelector('#wName')||{}).value||''; state.patient.pid=(el.querySelector('#wPid')||{}).value||''; state.patient.sex=(el.querySelector('#wSex')||{}).value||'Female'; state.patient.age=(el.querySelector('#wAge')||{}).value||''; state.priority=(el.querySelector('#wPri')||{}).value||'Routine'; }
        else if(state.step===3){ state.origin=(el.querySelector('#wOrigin')||{}).value||''; state.hospital=(el.querySelector('#wHosp')||{}).value||''; state.transporter=(el.querySelector('#wTrans')||{}).value||''; state.notes=(el.querySelector('#wNote')||{}).value||''; }
      };
      const paint=()=>{ body.innerHTML=stepHTML(); syncDots(); wireStep(); };
      const wireStep=()=>{
        if(state.step===2){
          body.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>{ const id=b.dataset.test; if(state.tests.includes(id)) state.tests=state.tests.filter(x=>x!==id); else state.tests.push(id); b.classList.toggle('on'); body.querySelector('#wTestCount').textContent=state.tests.length+' selected'; });
          const search=body.querySelector('#wTestSearch');
          search.addEventListener('input',()=>{ const q=search.value.toLowerCase(); body.querySelectorAll('[data-test]').forEach(b=>{ b.style.display=(b.dataset.name+' '+b.textContent).toLowerCase().indexOf(q)>=0?'':'none'; }); });
        }
      };
      const advance=()=>{
        capture();
        if(state.step===1 && state.patient.name.trim().length<3) return UI.toast('Enter the patient name to continue',{type:'warn'});
        if(state.step===2 && !state.tests.length) return UI.toast('Select at least one test',{type:'warn'});
        if(state.step<3){ state.step++; paint(); }
        else {
          const testObjs=state.tests.map(id=>tests.find(t=>t.id===id)).filter(Boolean);
          const first=testObjs[0];
          const seq=(S.db().meta.sampleSeq||120000)+1;
          const sid='RDH-'+U.fyLabel().slice(0,4)+'-'+String(seq).padStart(6,'0');
          const sample={id:U.uid('sm'),sampleId:sid,patientName:state.patient.name.trim(),patientId:state.patient.pid,dob:'',sex:state.patient.sex,age:state.patient.age,
            test:first.name,testCode:first.code,cat:first.cat,hospital:state.hospital,healthFacility:state.origin,district:'Gakenke',
            collectionDate:U.todayISO(),collectionAt:U.nowISO(),sentDate:U.todayISO(),receivedAt:null,resultedAt:null,status:'Registered',
            priority:state.priority,tatTargetDays:Math.max.apply(null,testObjs.map(t=>t.tat)),notes:state.notes,transporter:state.transporter,
            collector:LS.auth.user.name,source:'register',manifestId:null,tests:testObjs.map(t=>t.name)};
          S.commit(d=>{ d.samples.push(sample); d.meta.sampleSeq=seq; },{action:'sample.register',entity:'samples',entityId:sample.id,detail:'Registered '+sid+' · '+first.name+' · '+state.priority+' → '+state.hospital});
          close();
          UI.toast('Sample '+sid+' registered · barcode ready',{type:'ok',actions:[{label:'Open record',onClick:()=>openSample(sample.id)}]});
          LS.shell.refresh();
        }
      };
      next.onclick=advance; back.onclick=()=>{ capture(); state.step=Math.max(1,state.step-1); paint(); };
      el.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){ e.preventDefault(); advance(); } });
      syncDots(); wireStep();
      setTimeout(()=>el.querySelector('#wName')?.focus(),80);
    }});
}

/* ——— saved views ——————————————————————— */
function savedViews(){
  const db=S.db();
  const rows=db.savedViews.filter(v=>v.module==='samples').map(v=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(v.name)+'</div><div class="lr-sub">'+U.esc(v.owner)+' · shareable by URL</div></div><button class="btn xs" data-apply="'+v.id+'">Apply</button><button class="icon-btn" style="width:24px;height:24px" data-del="'+v.id+'">'+UI.ic('trash-2',12)+'</button></div>').join('');
  UI.drawer({title:'Saved views',eyebrow:'Filters',body:(rows||UI.empty({art:'search',title:'No saved views',body:'Save the current filter as a named view — it becomes a shareable URL.'}))
    +'<div class="thread" style="margin:12px 0"></div><button class="btn wide" data-save-view>'+UI.ic('plus',14)+'Save current filter as view</button>',
    foot:'<button class="btn" data-close>Close</button>',
    onMount:(panel,close)=>{
      panel.querySelectorAll('[data-apply]').forEach(b=>b.onclick=()=>{ const v=db.savedViews.find(x=>x.id===b.dataset.apply); if(!v) return; st.filter=v.filter.priority==='STAT'?'stat':v.filter.hospital==='NRL'?'rbc':'all'; close(); paintTable(); });
      panel.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ d.savedViews=d.savedViews.filter(x=>x.id!==b.dataset.del); },{action:'view.delete',entity:'savedViews',entityId:b.dataset.del}); close(); UI.toast('View removed',{type:'ok'}); });
      panel.querySelector('[data-save-view]').onclick=()=>{ UI.modal({title:'Save this view',body:'<div class="field"><label>View name</label><input class="input" id="svName" placeholder="e.g. My STAT samples"></div><div class="hint" style="margin-top:8px">Saved views are shareable by URL and persist on this device.</div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save view</button>',onMount:(el,cl)=>{ el.querySelector('[data-save]').onclick=()=>{ const name=el.querySelector('#svName').value.trim()||'Untitled view'; S.commit(d=>{ d.savedViews.push({id:U.uid('sv'),name,module:'samples',filter:{view:st.filter},owner:LS.auth.user.name}); },{action:'view.save',entity:'savedViews',detail:'Saved view: '+name}); cl(); close(); UI.toast('View saved',{type:'ok'}); }; }}); };
    }});
}

/* ——— painting ————————————————————————— */
function paintTable(){
  const host=rootEl.querySelector('#smpTableWrap'); if(!host) return;
  host.innerHTML=tableHTML(); wire();
}
function wire(){
  const r=rootEl;
  const search=r.querySelector('#smpSearch');
  if(search){ const deb=U.debounce(()=>{ st.q=search.value; st.limit=90; paintTableKeepFocus(); },180); search.addEventListener('input',deb); }
  r.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{ st.filter=b.dataset.filter; st.limit=90; st.selected.clear(); syncURL(); paintTable(); });
  r.querySelectorAll('[data-new]').forEach(b=>b.onclick=newWizard);
  r.querySelectorAll('[data-saved]').forEach(b=>b.onclick=savedViews);
  r.querySelectorAll('[data-export]').forEach(b=>b.onclick=exportCSV);
  r.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>{ st.limit+=100; paintTable(); });
  r.querySelectorAll('[data-sort]').forEach(th=>th.onclick=()=>{ const k=th.dataset.sort; if(st.sort===k) st.dir=st.dir==='asc'?'desc':'asc'; else { st.sort=k; st.dir='desc'; } paintTable(); });
  r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); openSample(b.dataset.open); });
  r.querySelectorAll('[data-row]').forEach(tr=>tr.onclick=e=>{ if(e.target.closest('[data-check]')) return; openSample(tr.dataset.row); });
  r.querySelectorAll('[data-check]').forEach(cb=>cb.onclick=e=>{ e.stopPropagation(); const id=cb.dataset.check; if(st.selected.has(id)) st.selected.delete(id); else st.selected.add(id); paintTable(); });
  r.querySelectorAll('[data-bulk-clear]').forEach(b=>b.onclick=()=>{ st.selected.clear(); paintTable(); });
  r.querySelectorAll('[data-bulk-manifest]').forEach(b=>b.onclick=()=>addToManifest(Array.from(st.selected)));
  r.querySelectorAll('[data-bulk-export]').forEach(b=>b.onclick=()=>{ const rows=[['Sample ID','Patient','Test','Origin','Hospital','Priority','Status','Collected']].concat(S.db().samples.filter(s=>st.selected.has(s.id)).map(s=>[s.sampleId,s.patientName,s.test,s.healthFacility,s.hospital,s.priority,s.status,s.collectionDate])); U.exportCSV('samples-selection-'+U.todayISO()+'.csv',rows,{title:'Referred samples — selection',actor:LS.auth.user.name}); UI.toast(rows.length-1+' samples exported',{type:'ok'}); });
  // infinite scroll
  const scroll=r.querySelector('#smpScroll');
  if(scroll){ onScroll=U.throttle(()=>{ if(scroll.scrollTop+scroll.clientHeight>scroll.scrollHeight-120){ const list=filtered(); if(st.limit<list.length){ st.limit+=80; const keep=scroll.scrollTop; paintTable(); const ns=rootEl.querySelector('#smpScroll'); if(ns) ns.scrollTop=keep; } } },300); scroll.addEventListener('scroll',onScroll); }
}
function paintTableKeepFocus(){
  const v=st.q; paintTable();
  const s=rootEl.querySelector('#smpSearch'); if(s){ s.value=v; s.focus(); s.setSelectionRange(v.length,v.length); }
}
function syncURL(){
  try{ const q=st.filter==='all'?'':'?filter='+st.filter; history.replaceState(null,'','#/samples'+q); }catch(e){}
}
function exportCSV(){
  const list=filtered();
  const rows=[['Sample ID','Patient','Patient ID','Sex','Test','Category','Priority','Status','Origin facility','Receiving lab','Collected','TAT target (d)','Result','Flag','Collector']]
    .concat(list.map(s=>[s.sampleId,s.patientName,s.patientId,s.sex,s.test,s.cat,s.priority,s.status,s.healthFacility,s.hospital,s.collectionDate,s.tatTargetDays,s.resultValue||'',s.flag||'',s.collector||'']));
  U.exportCSV('referred-samples-'+U.todayISO()+'.csv',rows,{title:'Referred samples register',actor:LS.auth.user.name});
  UI.toast(list.length+' samples exported with letterhead metadata',{type:'ok'});
}

M.render=function(root,params){
  rootEl=root; st={q:params.q||'',filter:params.filter||'all',selected:new Set(),limit:90,sort:'collected',dir:'desc'};
  const cnt=counts();
  root.innerHTML='<div class="page-head"><div><h1>Referred samples</h1><div class="sub">Chain of custody you can feel — every registration, handoff and result is signed. '+cnt.active+' active samples, '+cnt.overdue+' past target.</div></div>'
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn" data-saved>'+UI.ic('book-marked',15)+' Saved views</button><button class="btn primary magnetic" data-new>'+UI.ic('plus',15)+' Register sample</button></div></div>'
   +'<div class="grid-12" style="margin-bottom:14px"><div class="c8"><div id="smpTableWrap">'+tableHTML()+'</div></div><div class="c4">'+referralPanel()
     +'<div style="margin-top:14px">'+UI.card({title:'TAT pressure',sub:'Active samples by % of target consumed',icon:'gauge',body:'<div id="smpPressure"></div>'})+'</div></div></div>';
  C.hbars(root.querySelector('#smpPressure'),{items:(function(){
    const active=S.db().samples.filter(s=>!s.resultedAt);
    const buckets=[['> 100% (breached)',active.filter(s=>S.tatFor(s).ratio>1).length,'rose'],['80–100% (at risk)',active.filter(s=>{const r=S.tatFor(s).ratio; return r>.8&&r<=1;}).length,'amber'],['40–80%',active.filter(s=>{const r=S.tatFor(s).ratio; return r>.4&&r<=.8;}).length,'gold'],['< 40%',active.filter(s=>S.tatFor(s).ratio<=.4).length,'teal']];
    return buckets.map(([label,value,tone])=>({label,value:Math.max(value,0),display:value+'',tone}));
  })()});
  wire();
  if(M._nsHandler) document.removeEventListener('ls:new-sample',M._nsHandler);
  M._nsHandler=()=>newWizard();
  document.addEventListener('ls:new-sample',M._nsHandler);
  if(params.new) setTimeout(newWizard,120);
  if(params.manifest) setTimeout(()=>addToManifest([]),120);
  if(params.id) setTimeout(()=>openSample(params.id),120);
  if(params.filter) syncURL();
};
M.openSample=openSample;
M.newSample=newWizard;
})();
