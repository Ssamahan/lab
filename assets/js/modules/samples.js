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
/* Culture and microscopy results are not numbers. They are a call (negative or
   positive) and, when positive, an organism and a susceptibility panel. The drug
   list is the panel the receiving laboratory reports back to us. */
const CULTURE_TESTS={
  'Blood Culture':{drugs:['Ampicillin','Gentamicin','Ceftriaxone','Ciprofloxacin','Meropenem','Vancomycin'],organism:'Staphylococcus aureus'},
  'TB Culture':{drugs:['Rifampicin','Isoniazid','Pyrazinamide','Ethambutol','Streptomycin'],organism:'Mycobacterium tuberculosis'},
  'Sputum AFB (Ziehl-Neelsen)':{drugs:['Rifampicin','Isoniazid','Pyrazinamide','Ethambutol'],organism:'Mycobacterium tuberculosis'}
};
/* A blood culture is not ordered on its own: Gram Stain and Cytology are done as routine
   with it, on the same specimen, so they join the order and are listed first on the
   manifest — Cytology · Gram Stain · Blood Culture. */
const ROUTINE_WITH={'Blood Culture':['Cytology','Gram Stain']};
const ROUTINE_ORDER=['Cytology','Gram Stain'];
function routineWith(name){ return (ROUTINE_WITH[name]||[]).slice(); }
/* Every test on the order, companions first, then whatever else was ticked. */
function orderedTests(s){
  const list=((s&&s.tests&&s.tests.length?s.tests.slice():[s&&s.test])||[]).filter(Boolean);
  const rank=t=>{ const i=ROUTINE_ORDER.indexOf(t); return i<0?ROUTINE_ORDER.length:i; };
  return list.map((t,i)=>({t,i})).sort((a,b)=>rank(a.t)-rank(b.t)||a.i-b.i).map(x=>x.t);
}
function cultureOf(test){ return CULTURE_TESTS[test]||null; }
function isQualitative(test){ return !!cultureOf(test) || /culture|afb|microscopy/i.test(test||''); }
const FILTERS=[
  {k:'all',label:'All samples'},
  {k:'active',label:'Active'},
  {k:'stat',label:'STAT'},
  {k:'overdue',label:'Overdue'},
  {k:'rbc',label:'Awaiting RBC'},
  {k:'resulted',label:'Resulted'},
  {k:'register',label:'Register data'}
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
  else if(s.filter==='register') list=list.filter(x=>x.source!=='telemetry');
  if(s.q){
    const q=s.q.toLowerCase();
    list=list.filter(x=>[x.sampleId,x.test,x.healthFacility,x.hospital,x.transporter,x.patientId,
      (U.canSeeNames()?x.patientName:'')].join(' ').toLowerCase().indexOf(q)>=0);
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
    rbc:all.filter(x=>/NRL|RBC/i.test(x.hospital||'')).length, register:all.filter(x=>x.source!=='telemetry').length};
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
   +'<td><div class="primary-cell"><b class="mono" style="font-size:11px;letter-spacing:-.01em">'+U.esc(s.sampleId)+'</b><small>'+U.esc(U.ptName(s))+' · '+(s.sex||'—')+'</small></div></td>'
   +'<td><span class="small truncate" style="display:block;max-width:150px">'+U.esc(s.test)+'</span><span class="xs faint mono">'+U.esc(s.testCode||'')+'</span></td>'
   +'<td class="hide-sm"><span class="small truncate" style="display:block;max-width:130px">'+U.esc(s.healthFacility||s.healthCenter||'—')+'</span><span class="xs faint truncate" style="display:block;max-width:130px">'+U.esc(s.hospital||'Ruli DH')+'</span></td>'
   +'<td><span class="pill '+U.statusTone(s.status)+'">'+U.esc(s.status)+'</span></td>'
   +'<td>'+tatCell+'</td>'
   +'<td class="hide-lg">'+(s.flag?'<span class="pill rose">'+U.esc(s.flag)+'</span>':'<span class="xs faint">—</span>')+'</td>'
   +'<td class="hide-sm">'+UI.audit({by:s.collector||'Register',date:s.collectionDate})+(s.editedAt?' <span class="pill amber" data-tip="Edited '+U.fmtDT(s.editedAt)+' by '+U.esc(s.editedBy||'')+'">'+UI.ic('pencil',9)+'</span>':'')+'</td>'
   +'<td style="width:60px"><span class="row" style="gap:2px"><button class="icon-btn row-actions" style="width:26px;height:26px" data-edit="'+s.id+'" aria-label="Edit sample">'+UI.ic('pencil',13)+'</button><button class="icon-btn row-actions" style="width:26px;height:26px" data-open="'+s.id+'" aria-label="Open sample">'+UI.ic('chevron-right',14)+'</button></span></td></tr>';
}
function tableHTML(){
  const s=base(); const list=filtered(); const shown=list.slice(0,s.limit); const cnt=counts();
  const rows=shown.map(x=>rowHTML(x,s.selected)).join('');
  const bulk=s.selected.size? '<div class="bulkbar">'+UI.ic('layers',13)+'<b>'+s.selected.size+' selected</b><span class="faint">·</span><button class="btn xs" data-bulk-manifest>Add to manifest</button><button class="btn xs" data-bulk-export>Export selection</button>'+(LS.auth.can('delete')?'<button class="btn xs danger" data-bulk-delete>'+UI.ic('trash-2',12)+' Delete selected</button>':'')+'<button class="btn xs ghost" data-bulk-clear>Clear</button><span class="grow"></span><span class="xs faint">Chain of custody preserved</span></div>':'';
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
   +'<div id="smpMore" style="padding:10px 14px;text-align:center">'+(list.length>s.limit?'<button class="btn sm" data-more>Load '+(Math.min(100,list.length-s.limit))+' more · '+list.length+' matching</button>':'<span class="xs faint">'+list.length+' samples · sorted by '+(s.sort==='tat'?'TAT pressure':'newest collection')+'</span>')
     +'<div class="xs faint" style="margin-top:6px">'+S.db().samples.length+' referred samples on the register — every one was sent by Ruli DH to NRL, CHUK or Kibagabaga. Nothing is generated.</div></div>'
   +'</div></div>';
}

/* ——— Referral network: the partner laboratories, editable ———————— */
function labName(l){ return typeof l==='string'?l:(l&&l.name)||''; }
function labs(){ const db=S.db(); return db.catalog.hospitals||[]; }
function retiredLabs(){ return (S.db().catalog.retiredHospitals||[]); }
function restoreLabEntry(id){
  S.commit(d=>{
    const rec=(d.catalog.retiredHospitals||[]).find(x=>x.id===id); if(!rec) return;
    d.catalog.hospitals=d.catalog.hospitals||[];
    d.catalog.hospitals.push({id:rec.id,name:rec.name,type:rec.type||'Hospital'});
    d.catalog.retiredHospitals=(d.catalog.retiredHospitals||[]).filter(x=>x.id!==id);
  },{action:'samples.lab.restore',entity:'catalog',entityId:id,detail:'Laboratory restored to the referral network'});
  UI.toast('Laboratory restored',{type:'ok'}); LS.shell.refresh();
}
function usedLabs(){
  const cnt={};
  S.db().samples.forEach(s=>{ const h=s.hospital||'Ruli DH'; cnt[h]=(cnt[h]||0)+1; });
  return cnt;
}
function referralPanel(){
  const rows=S.referralTAT(12);
  const total=U.sum(rows,r=>r.registered);
  return UI.card({title:'Referral network',sub:'Receiving laboratories we actually refer to · last 12 months',icon:'truck',
    tools:'<button class="btn xs" data-edit-labs>'+UI.ic('pencil',12)+'Edit</button>',
    body:'<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:12px">'
      +'<span class="pill gold">'+total+' referred</span><span class="pill slate">'+rows.length+' route'+(rows.length===1?'':'s')+'</span></div>'
      +'<div style="display:flex;flex-direction:column;gap:10px">'+rows.map(r=>{
        const ok=r.compliance==null?null:r.compliance>=90?'teal':r.compliance>=70?'amber':'rose';
        return '<div>'
          +'<div class="row between" style="margin-bottom:4px"><span class="small truncate">'+U.esc(r.lab)+'</span>'
          +(ok?'<span class="pill '+ok+' mono">'+r.compliance+'% on time</span>':'<span class="pill slate">no result yet</span>')+'</div>'
          +'<div style="height:6px;border-radius:99px;background:var(--surface-3);overflow:hidden"><div style="height:100%;width:'+Math.round(r.registered/Math.max(1,rows[0].registered)*100)+'%;background:linear-gradient(90deg,var(--gold-700),var(--gold-300));border-radius:99px"></div></div>'
          +'<div class="row between" style="margin-top:3px"><span class="xs faint">'+r.registered+' registered · '+r.resulted+' resulted'+(r.open?' · '+r.open+' open':'')+'</span>'
          +'<span class="xs faint">'+(r.avgH!=null?'avg '+r.avgH+'h':'—')+'</span></div></div>';
      }).join('')
      +(rows.length?'':'<p class="xs faint">No referred sample is on the register yet. Register one and it will appear here.</p>')+'</div>',
    foot:'<button class="btn xs" data-edit-labs>'+UI.ic('settings-2',12)+'Manage laboratories</button><span class="xs faint">NRL · CHUK · Kibagabaga</span>'});
}

/* 12 months of registered → resulted and TAT compliance, per receiving laboratory. */
function tatByLabCard(){
  const rows=S.referralTAT(12);
  return UI.card({title:'TAT compliance by receiving laboratory',sub:'Rolling 12 months · registered vs resulted for referred samples only',icon:'timer',
    tools:'<span class="pill slate">12 months</span>',
    body:'<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Receiving laboratory</th><th class="num">Registered</th><th class="num">Resulted</th><th class="num">Open</th><th>Compliance</th><th class="num">Mean TAT</th><th class="num">Target</th></tr></thead><tbody>'
      +rows.map(r=>{
        const ok=r.compliance==null?null:r.compliance>=90?'teal':r.compliance>=70?'amber':'rose';
        return '<tr><td><div class="primary-cell"><b>'+U.esc(r.lab)+'</b><small>'+r.resulted+' of '+r.registered+' returned</small></div></td>'
          +'<td class="num">'+r.registered+'</td><td class="num">'+r.resulted+'</td><td class="num">'+r.open+'</td>'
          +'<td style="width:130px">'+(ok?'<div class="row gap-sm"><span class="mono xs" style="width:34px">'+r.compliance+'%</span><div style="width:66px">'+UI.meter(r.compliance,ok)+'</div></div>':'<span class="xs faint">—</span>')+'</td>'
          +'<td class="num mono">'+(r.avgH!=null?r.avgH+'h':'—')+'</td><td class="num mono faint">'+(r.targetH!=null?r.targetH+'h':'—')+'</td></tr>';
      }).join('')
      +(rows.length?'':'<tr><td colspan="7" class="xs faint" style="padding:16px">No referred samples in the last 12 months.</td></tr>')
      +'</tbody></table></div>',
    foot:'<span>Compliance counts a sample as on time when the result lands inside its own test target</span><span class="mono">'+U.sum(rows,r=>r.registered)+' referrals</span>'});
}

/* Monthly registered vs resulted for referred samples — the honest register, not telemetry. */
function throughputMini(){
  const series=[];
  for(let i=11;i>=0;i--){
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-i);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const rows=S.referredSamples().filter(x=>String(x.collectionDate||'').slice(0,7)===key);
    series.push({label:U.M3[d.getMonth()],registered:rows.length,resulted:rows.filter(x=>x.resultedAt).length});
  }
  const max=Math.max.apply(null,series.map(x=>Math.max(x.registered,x.resulted)).concat([1]));
  return UI.card({title:'Registered vs resulted',sub:'Referred samples only · last 12 months',icon:'chart-line',
    tools:'<span class="pill slate mono">'+U.sum(series,x=>x.registered)+' registered</span>',
    body:series.map(x=>'<div style="margin-bottom:8px"><div class="row between"><span class="xs faint mono">'+x.label+'</span><span class="xs faint">'+x.registered+' / '+x.resulted+'</span></div>'
      +'<div class="row gap-sm" style="margin-top:3px"><div class="grow" style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+Math.round(x.registered/max*100)+'%;background:var(--gold);border-radius:99px"></div></div>'
      +'<div class="grow" style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+Math.round(x.resulted/max*100)+'%;background:var(--teal-400);border-radius:99px"></div></div></div></div>').join(''),
    foot:'<span><b>Registered</b> gold · <b>Resulted</b> teal · a gap means the result has not come back</span><span class="mono">'+U.sum(series,x=>x.resulted)+' resulted</span>'});
}

function retiredBlock(){
  const list=retiredLabs();
  if(!list.length) return '<div class="xs faint">No laboratory has been removed from the network.</div>';
  return '<div class="eyebrow" style="margin-bottom:6px">Removed from the network</div>'
    +list.map(l=>'<div class="list-row" style="padding:5px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(l.name)+'</div>'
      +'<div class="lr-sub">'+U.esc(l.type||'Hospital')+(l.samples?' · '+l.samples+' sample'+(l.samples===1?'':'s')+' still name it':'')+'</div></div>'
      +'<button class="btn xs" data-lab-restore="'+l.id+'">'+UI.ic('rotate-ccw',11)+'Restore</button></div>').join('');
}
function labEditor(){
  if(!LS.auth.guard('edit')) return;
  const cnt=usedLabs();
  const rowHtml=(l)=>'<div class="row gap-sm" data-lab-row>'
    +'<input type="hidden" data-lab-id value="'+U.esc((l&&l.id)||'')+'">'
    +'<input class="input grow" data-lab-name value="'+U.esc(l?labName(l):'')+'" placeholder="Laboratory name">'
    +'<input class="input mono" data-lab-type value="'+U.esc(l?l.type||'Hospital':'Hospital')+'" placeholder="Type" style="max-width:130px">'
    +'<span class="pill slate mono" data-lab-count>'+((l&&cnt[labName(l)])||0)+'</span>'
    +'<button class="icon-btn" data-lab-del style="width:30px;height:30px" aria-label="Remove">'+UI.ic('trash-2',13)+'</button></div>';
  UI.modal({title:'Referral network',sub:'Rename a laboratory to fix a misspelling — every sample that names it is re-pointed. Routes can be added or removed.',width:'min(680px,100%)',
    body:'<div id="labRows" style="display:flex;flex-direction:column;gap:8px">'+labs().map(rowHtml).join('')+'</div>'
      +'<button class="btn xs" data-lab-add style="margin-top:10px">'+UI.ic('plus',12)+'Add laboratory</button>'
      +'<div class="hint" style="margin-top:10px">Edits apply to the sample register, the referral wizard and every manifest that names the laboratory.</div>'
      +'<div id="labRetired" style="margin-top:14px">'+retiredBlock()+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save-labs>'+UI.ic('check',15)+'Save network</button>',
    onMount:(el,close)=>{
      const bindDel=()=>el.querySelectorAll('[data-lab-del]').forEach(b=>b.onclick=()=>b.closest('[data-lab-row]').remove());
      bindDel();
      const bindRestore=()=>el.querySelectorAll('[data-lab-restore]').forEach(b=>b.onclick=()=>{
        const rec=retiredLabs().find(x=>x.id===b.dataset.labRestore); if(!rec) return;
        el.querySelector('#labRows').insertAdjacentHTML('beforeend',rowHtml({id:rec.id,name:rec.name,type:rec.type||'Hospital'}));
        bindDel(); b.closest('.list-row').remove(); UI.toast(rec.name+' queued for restore — save the network',{type:'info'});
      });
      bindRestore();
      el.querySelector('[data-lab-add]').onclick=()=>{
        el.querySelector('#labRows').insertAdjacentHTML('beforeend',rowHtml(null));
        bindDel();
        const rows=el.querySelectorAll('[data-lab-row]');
        const last=rows[rows.length-1]; if(last) last.querySelector('[data-lab-name]').focus();
      };
      el.querySelector('[data-save-labs]').onclick=async()=>{
        const existing={}; labs().forEach(l=>{ existing[l.id]=l; });
        const next=[], renamed={};
        el.querySelectorAll('[data-lab-row]').forEach(row=>{
          const name=row.querySelector('[data-lab-name]').value.trim();
          if(!name) return;
          const id=row.querySelector('[data-lab-id]').value||U.uid('h');
          const type=row.querySelector('[data-lab-type]').value.trim()||'Hospital';
          if(existing[id] && labName(existing[id])!==name) renamed[labName(existing[id])]=name;
          next.push({id,name,type});
        });
        const keptIds=next.map(l=>l.id);
        const removed=Object.keys(existing).filter(id=>keptIds.indexOf(id)<0).map(id=>existing[id]);
        const usedIn={}; S.db().samples.forEach(s=>{ usedIn[s.hospital||'']=(usedIn[s.hospital||'']||0)+1; });
        const inUse=removed.filter(l=>(usedIn[labName(l)]||0)>0);
        if(inUse.length){
          const total=U.sum(inUse,l=>usedIn[labName(l)]);
          const ok=await UI.confirm({title:'Remove '+inUse.length+' laboratory'+(inUse.length===1?'':'ies')+' from the network?',
            body:total+' sample'+(total===1?'':'s')+' still name '+inUse.map(l=>labName(l)).join(', ')+'. Their records keep the name exactly as referred — nothing is rewritten. The laboratory can be restored later from this dialog.',
            confirm:'Remove from network',danger:true});
          if(!ok) return;
        }
        let moved=0;
        S.commit(d=>{
          d.catalog.retiredHospitals=d.catalog.retiredHospitals||[];
          removed.forEach(l=>{
            if(!d.catalog.retiredHospitals.some(x=>x.id===l.id)){
              d.catalog.retiredHospitals.push({id:l.id,name:labName(l),type:l.type||'Hospital',samples:usedIn[labName(l)]||0,at:U.nowISO(),by:LS.auth.user.name});
            }
          });
          d.catalog.retiredHospitals=d.catalog.retiredHospitals.filter(x=>keptIds.indexOf(x.id)<0);
          d.catalog.hospitals=next;
          if(Object.keys(renamed).length){
            d.samples.forEach(s=>{ if(s.hospital&&renamed[s.hospital]){ s.hospital=renamed[s.hospital]; moved++; } });
          }
        },{action:'samples.labs.edit',entity:'catalog',detail:'Referral network updated · '+next.length+' laboratories'+(removed.length?' · '+removed.length+' removed':'')+(moved?' · '+moved+' samples re-pointed':'')});
        close(); LS.shell.refresh();
        UI.toast('Referral network saved'+(removed.length?' · '+removed.length+' removed':'' )+(moved?' · '+moved+' samples re-pointed':''),{type:'ok'});
      };
    }});
}

/* ——— Drawer: sample detail + chain of custody ————— */
/* datetime-local input value in local time, defaulting to "now". */
function releaseStamp(s){
  const d=s&&s.resultedAt?new Date(s.resultedAt):new Date();
  const pad=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
}
function openSample(id){
  const db=S.db(); const s=db.samples.find(x=>x.id===id); if(!s) return;
  const t=S.tatFor(s);
  const ref=REF[s.test]||{unit:'',lo:null,hi:null,dec:1};
  const cult=cultureOf(s.test);
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
       +[['Patient',U.ptName(s)],['Patient ID',s.patientId||'—'],['Sex',s.sex||'—'],['Date of birth',s.dob?U.fmtDate(s.dob):'—'],['Age',(s.age!==''&&s.age!=null)?(s.age+' yrs'):'—'],['Origin',s.healthFacility||'—'],['Tests',orderedTests(s).join(' · ')],['Receiving lab',s.hospital||'Ruli DH'],['Collected',U.fmtDate(s.collectionDate)],['Target TAT',s.tatTargetDays+' days']].map(([k,v])=>'<div><div class="eyebrow">'+k+'</div><div class="small" style="margin-top:2px">'+U.esc(v)+'</div></div>').join('')
     +'</div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('timer',14,'ic')+'Turnaround</div><div class="card-sub">'+(s.resultedAt?'Completed in '+Math.round(t.elapsedH)+'h of a '+Math.round(t.targetH)+'h target':'Due '+U.fmtDate(U.isoLocal(t.dueAt)))+'</div></div>'
     +'<span class="pill '+(t.breached?'rose':t.ratio>.8?'amber':'teal')+'">'+(t.breached?'Breached':t.ratio>.8?'At risk':'On track')+'</span></div>'
     +'<div class="card-body">'+UI.meter(U.clamp(t.ratio*100,1,100),t.breached?'rose':t.ratio>.8?'amber':'teal',100)+'<div class="row between" style="margin-top:6px"><span class="xs faint">'+Math.round(t.elapsedH)+'h elapsed</span><span class="xs faint">'+Math.round(t.targetH)+'h target</span></div></div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('git-branch',14,'ic')+'Chain of custody</div><div class="card-sub">Append-only · actor + timestamp on every handoff</div></div></div><div class="card-body"><div class="custody">'
     +steps.map((x,i)=>'<div class="custody-step '+(x.done?'done':(i===current?'current':'pending'))+'"><div class="node">'+UI.ic(x.done?'check':'circle-dot',9)+'</div><div class="cs-t">'+U.esc(x.k)+'</div><div class="cs-m">'+(x.done?U.fmtDT(x.at)+' · '+U.esc(x.by):'Pending')+'</div></div>').join('')
     +'</div></div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('test-tube',14,'ic')+'Result entry</div><div class="card-sub">'+(cult?'Qualitative culture · negative / positive · susceptibility panel':'Reference range '+ (ref.lo!=null?ref.lo+'–'+ref.hi+' '+ref.unit:'qualitative')+' · auto-flagged')+'</div></div></div>'
     +'<div class="card-body">'
       +(s.resultedAt?'<div class="row between" style="padding:10px 12px;border-radius:8px;background:var(--pos-soft);border:1px solid var(--pos-border);margin-bottom:10px"><div><div class="strong" style="font-size:13px">'+U.esc(s.resultValue||'Verified')+(s.organism?' · '+U.esc(s.organism):'')+'</div><div class="xs faint">Released '+U.fmtDT(s.resultedAt)+' · '+U.esc(s.resultBy||'Laboratory')+'</div></div><span class="pill teal">Released</span></div>'
          +(s.ast?'<div class="row wrap gap-sm" style="margin:-4px 0 10px">'+Object.keys(s.ast).map(d=>'<span class="pill '+(s.ast[d]==='R'?'rose':s.ast[d]==='I'?'amber':'teal')+'">'+U.esc(d)+' · '+U.esc(s.ast[d])+'</span>').join('')+'</div>':'')
          :'')
       +(cult
         ? '<div class="field"><label>Culture call</label><div class="seg" id="resCall">'
             +['Negative','Positive'].map(v=>'<button type="button" class="'+((s.resultStatus||s.resultValue||'Negative')===v?'on':'')+'" data-call="'+v+'">'+v+'</button>').join('')
           +'</div></div>'
           +'<div class="field" style="margin-top:10px"><label>Organism</label><input class="input" id="resOrg" placeholder="'+U.esc(cult.organism)+'" value="'+U.esc(s.organism||'')+'"></div>'
           +'<div id="astWrap" style="margin-top:12px;'+(s.resultStatus==='Positive'?'':'display:none')+'">'
             +'<div class="eyebrow" style="margin-bottom:6px">Antimicrobial susceptibility (AST)</div>'
             +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Drug</th><th>S</th><th>I</th><th>R</th></tr></thead><tbody>'
             +cult.drugs.map(d=>{ const cur=(s.ast||{})[d]||''; return '<tr><td class="small">'+U.esc(d)+'</td>'
               +['S','I','R'].map(k=>'<td><label class="row gap-sm" style="cursor:pointer"><input type="radio" name="ast_'+U.esc(d)+'" data-ast="'+U.esc(d)+'" value="'+k+'"'+(cur===k?' checked':'')+' style="accent-color:#C9A84C"></label></td>').join('')
               +'</tr>'; }).join('')
             +'</tbody></table></div>'
             +'<div class="hint" style="margin-top:6px">S susceptible · I intermediate · R resistant</div>'
           +'</div>'
         : '<div class="form-grid"><div class="field"><label>Result value</label><input class="input mono" id="resVal" placeholder="'+(ref.lo!=null?ref.lo+'–'+ref.hi:'e.g. Positive')+'" value="'+U.esc(s.resultValue||'')+'"></div>'
           +'<div class="field"><label>Unit</label><input class="input mono" value="'+U.esc(ref.unit||'qualitative')+'" readonly></div></div>'
           +'<div id="resFlag" class="hint" style="margin-top:8px">Out-of-range values are flagged automatically and require a comment.</div>')
       +'<div class="field" style="margin-top:12px"><label>Result released on</label><input class="input mono" type="datetime-local" id="resWhen" value="'+releaseStamp(s)+'">'
       +'<div class="hint" style="margin-top:4px">Back-date this when the result arrived earlier than you could record it — turnaround is measured from the release time on this field, not from when you typed it.</div></div>'
       +'<div class="field" style="margin-top:10px"><label>Comment</label><textarea class="textarea" id="resNote" placeholder="Optional — critical value notification, repeat, dilution…"></textarea></div>'
       +'<button class="btn primary sm" data-save-result style="margin-top:10px">'+UI.ic('check',14)+' Verify & release result</button>'
     +'</div></div>'
   +'<div class="card pad" style="background:var(--surface-inset)"><div class="row between"><div class="xs faint">Created by '+U.esc(s.collector||'Register')+' · '+U.fmtDate(s.collectionDate)+'</div><div class="xs faint mono">'+U.esc(s.source||'register')+' · '+U.esc(s.id)+'</div></div></div>';
  const d=UI.drawer({title:U.ptName(s),eyebrow:'Sample record',sub:s.sampleId+' · '+s.test,wide:true,body:body,
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit-rec>'+UI.ic('pencil',15)+'Edit record</button>'
      +(s.manifestId?'<button class="btn" data-print-manifest>'+UI.ic('clipboard-list',15)+'View manifest</button>':'<button class="btn" data-add-manifest>'+UI.ic('clipboard-list',15)+'Add to manifest</button>')
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
  // culture call switches the susceptibility panel in and out
  const callBox=panel.querySelector('#resCall');
  if(callBox){
    callBox.querySelectorAll('[data-call]').forEach(b=>b.addEventListener('click',()=>{
      callBox.querySelectorAll('[data-call]').forEach(x=>x.classList.toggle('on',x===b));
      const wrap=panel.querySelector('#astWrap');
      if(wrap) wrap.style.display=b.dataset.call==='Positive'?'':'none';
    }));
  }
  panel.querySelector('[data-save-result]')?.addEventListener('click',()=>{
    if(!LS.auth.guard('edit')) return;
    let raw, flag=null, ast=null, organism=null, call=null;
    if(cult){
      const btn=panel.querySelector('#resCall [data-call].on');
      call=btn?btn.dataset.call:'Negative';
      raw=call;
      organism=call==='Positive'?((panel.querySelector('#resOrg')||{}).value||cult.organism||'').trim():null;
      if(call==='Positive'){
        ast={};
        panel.querySelectorAll('[data-ast]:checked').forEach(r=>{ ast[r.dataset.ast]=r.value; });
        if(!Object.keys(ast).length) return UI.toast('Record at least one drug on the susceptibility panel',{type:'warn'});
        flag='POSITIVE';
      }
    } else {
      raw=(panel.querySelector('#resVal')||{}).value||''; raw=raw.trim();
      if(!raw) return UI.toast('Enter a result value first',{type:'warn'});
      const v=parseFloat(raw);
      if(ref.lo!=null&&!isNaN(v)) flag = v>ref.hi?'HIGH':v<ref.lo?'LOW':null;
    }
    /* The release time is whatever the operator confirms — recording a result a
       day late must not turn a compliant turnaround into a breach. */
    const whenEl=panel.querySelector('#resWhen');
    const when=whenEl&&whenEl.value?new Date(whenEl.value):new Date();
    if(isNaN(when.getTime())) return UI.toast('The release date is not valid',{type:'warn'});
    if(when.getTime()>Date.now()+60000) return UI.toast('A result cannot be released in the future',{type:'warn'});
    const releasedIso=when.toISOString(), localDate=U.isoLocal(when);
    const late=Math.abs(Date.now()-when.getTime())>12*3600*1000;
    S.commit(db2=>{ const x=db2.samples.find(y=>y.id===s.id); if(!x) return;
      x.resultValue=raw; x.flag=flag; x.resultedAt=releasedIso; x.resultDate=localDate;
      x.status=call==='Positive'?'Positive':call==='Negative'?'Done':'Done';
      x.resultBy=LS.auth.user.name;
      if(call){ x.resultStatus=call; }
      if(organism!=null) x.organism=organism;
      if(ast) x.ast=ast;
      if(late){ x.recordedLate=true; x.recordedAt=U.nowISO(); }
      else { delete x.recordedLate; }
    },{action:'sample.result',entity:'samples',entityId:s.id,detail:'Result released for '+s.sampleId+' on '+localDate+(flag?' · '+flag:'')+' · '+raw+(ast?' · AST '+Object.keys(ast).length+' drugs':'')+(late?' · back-dated':'')});
    UI.toast('Result released'+(flag?' · '+flag:'')+(late?' · back-dated to '+U.fmtDate(localDate):''),{type:'ok'});
    d.close(); LS.shell.refresh();
  });
  panel.querySelector('[data-quick-result]')?.addEventListener('click',()=>{ panel.querySelector('#resVal')?.focus(); panel.querySelector('#resVal')?.scrollIntoView({block:'center',behavior:'smooth'}); });
  panel.querySelector('[data-edit-rec]')?.addEventListener('click',()=>{ d.close(); editSample(s.id); });
  panel.querySelector('[data-add-manifest]')?.addEventListener('click',()=>{ addToManifest([s.id]); });
  panel.querySelector('[data-print-manifest]')?.addEventListener('click',()=>{ const man=S.db().manifests.find(m=>m.id===s.manifestId); if(man) manifestPreviewModal(man); });
}

/* ——— Manual correction of a register record ————————————————— */
function editSample(id){
  const s=S.db().samples.find(x=>x.id===id); if(!s) return;
  if(!LS.auth.guard('edit')) return;
  const opts=(list,cur)=>list.map(v=>'<option value="'+U.esc(v)+'"'+(v===cur?' selected':'')+'>'+U.esc(v)+'</option>').join('');
  const tests=U.uniq(S.tests().map(t=>t.name).concat([s.test]));
  const facilities=U.uniq(['Ruli DH'].concat(S.db().catalog.healthCenters.map(h=>h.name)).concat([s.healthFacility||'Ruli DH']));
  const labs=U.uniq(S.db().catalog.hospitals.map(h=>h.name).concat(['Ruli DH - GeneXpert',s.hospital||''])).filter(Boolean);
  const statuses=['Registered','Received','Pending','Resulting','Resulted','Done','Positive','Negative','Rejected'];
  UI.modal({title:'Edit sample record',sub:s.sampleId+' · corrections are written to the audit trail with your name.',width:'min(720px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Sample ID</label><input class="input mono" id="edSid" value="'+U.esc(s.sampleId)+'"></div>'
      +(U.canSeeNames()
        ? '<div class="field"><label>Patient name</label><input class="input" id="edName" value="'+U.esc(U.ptName(s))+'"><div class="xs faint" style="margin-top:4px">Stored with the order and shown to signed-in staff; the public visitor and every file read '+U.CONFIDENTIAL+'.</div></div>'
        : '<div class="field"><label>Patient</label><input class="input" id="edName" value="'+U.CONFIDENTIAL+'" readonly></div>')
      +'<div class="field"><label>Patient ID</label><input class="input mono" id="edPid" value="'+U.esc(s.patientId||'')+'"></div>'
      +'<div class="field"><label>Sex</label><select class="select" id="edSex">'+opts(['Female','Male','Other','Unknown'],s.sex||'Unknown')+'</select></div>'
      +'<div class="field"><label>Date of birth</label><input class="input mono" type="date" id="edDob" value="'+U.esc(String(s.dob||'').slice(0,10))+'" max="'+U.todayISO()+'"><div class="xs faint" style="margin-top:4px">Age is calculated from it.</div></div>'
      +'<div class="field"><label>Age · calculated</label><input class="input mono" id="edAge" value="'+U.esc(s.age==null?'':String(s.age))+'" readonly></div>'
      +'<div class="field"><label>Test</label><select class="select" id="edTest">'+opts(tests,s.test)+'</select></div>'
      +'<div class="field"><label>Priority</label><select class="select" id="edPri">'+opts(['Routine','Follow-up','STAT'],s.priority||'Routine')+'</select></div>'
      +'<div class="field"><label>Origin health centre</label><select class="select" id="edFac">'+opts(facilities,s.healthFacility||'')+'</select></div>'
      +'<div class="field"><label>Receiving laboratory</label><select class="select" id="edLab">'+opts(labs,s.hospital||'')+'</select></div>'
      +'<div class="field"><label>Collected on</label><input class="input" type="date" id="edColl" value="'+U.esc(String(s.collectionDate||'').slice(0,10))+'"></div>'
      +'<div class="field"><label>Sent / dispatched on</label><input class="input" type="date" id="edSent" value="'+U.esc(String(s.sentDate||'').slice(0,10))+'"></div>'
      +'<div class="field"><label>Transporter / courier</label><input class="input" id="edTrans" value="'+U.esc(s.transporter||'')+'"></div>'
      +'<div class="field"><label>Status</label><select class="select" id="edStatus">'+opts(statuses,s.status||'Registered')+'</select></div>'
      +'<div class="field"><label>Target TAT (days)</label><input class="input mono" type="number" min="0" step="1" id="edTat" value="'+(s.tatTargetDays!=null?s.tatTargetDays:'')+'"></div>'
      +'<div class="field"><label>Result value</label><input class="input mono" id="edVal" value="'+U.esc(s.resultValue||'')+'" placeholder="Leave blank to keep unreleased"></div>'
      +'<div class="field span2"><label>Notes</label><textarea class="textarea" id="edNotes" rows="2">'+U.esc(s.notes||'')+'</textarea></div>'
      +'</div><div class="hint" style="margin-top:8px">Editing dates re-computes TAT and the 12-month throughput view immediately. Nothing is deleted — the previous values stay in the audit log.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save changes</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const g=k=>{ const n=el.querySelector(k); return n?n.value:''; };
        const sampleId=g('#edSid').trim()||s.sampleId;
        if(S.db().samples.some(x=>x.id!==s.id && x.sampleId===sampleId)) return UI.toast('Another sample already uses that ID',{type:'err'});
        const dobV=g('#edDob');
        const changes={
          sampleId, patientName:(U.canSeeNames()&&g('#edName').trim())?g('#edName').trim():U.ptName(s), patientId:g('#edPid').trim(), sex:g('#edSex'),
          dob:dobV, age:(U.ageFromDob(dobV)===''?g('#edAge'):String(U.ageFromDob(dobV))),
          test:g('#edTest'), priority:g('#edPri'), healthFacility:g('#edFac'), hospital:g('#edLab'),
          collectionDate:g('#edColl'), sentDate:g('#edSent')||null, transporter:g('#edTrans').trim(),
          status:g('#edStatus'), resultValue:g('#edVal').trim()||null, notes:g('#edNotes').trim()
        };
        const tatRaw=parseFloat(g('#edTat'));
        if(!isNaN(tatRaw)) changes.tatTargetDays=tatRaw;
        const t=S.db().catalog.tests.find(x=>x.name===changes.test);
        changes.testCode=t?t.code:s.testCode; changes.cat=t?t.cat:s.cat;
        if(changes.collectionDate) changes.collectionAt=changes.collectionDate+'T'+(String(s.collectionAt||'T09:00:00').slice(11)||'09:00:00');
        S.commit(db2=>{ const x=db2.samples.find(y=>y.id===s.id); if(!x) return;
          Object.assign(x,changes); x.editedAt=U.nowISO(); x.editedBy=LS.auth.user.name;
        },{action:'sample.edit',entity:'samples',entityId:s.id,detail:'Record edited for '+sampleId});
        close(); LS.shell.refresh(); UI.toast('Sample record updated · audit entry written',{type:'ok'});
      };
    }});
}

/* ——— Manifest ————————————————————————— */
function addToManifest(ids){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const candidates=db.samples.filter(s=>!s.manifestId && !s.resultedAt).slice(0,40);
  UI.modal({title:'Add to manifest',sub:'Select samples travelling to the same receiving laboratory. The manifest ID is built from the test code and today\'s date: code + YYMMDD + four alphanumeric characters (BC261027A001).',
    width:'min(680px,100%)',
    body:'<div class="field" style="margin-bottom:12px"><label>Receiving laboratory</label><select class="select" id="manHosp">'+U.uniq(candidates.map(s=>s.hospital||'Ruli DH')).map(h=>'<option>'+U.esc(h)+'</option>').join('')+'</select></div>'
      +'<div style="max-height:280px;overflow:auto;border:1px solid var(--border);border-radius:9px">'+(candidates.length?candidates.map(s=>'<label class="row" style="padding:8px 11px;border-bottom:1px solid var(--border);gap:9px;cursor:pointer"><input type="checkbox" data-man-pick value="'+s.id+'" '+(ids.includes(s.id)?'checked':'')+' style="accent-color:#C9A84C"><span class="grow"><span class="small mono">'+U.esc(s.sampleId)+'</span> <span class="xs faint">'+U.esc(U.ptName(s))+' · '+U.esc(s.test)+'</span></span><span class="pill slate">'+U.esc(s.healthFacility||'—')+'</span></label>').join(''):'<div class="empty" style="padding:24px"><p class="xs muted">No unmanifested active samples.</p></div>')+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-gen>'+UI.ic('clipboard-list',15)+'Generate manifest</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-gen]').onclick=()=>{
        const picks=U.$$('[data-man-pick]:checked',el).map(x=>x.value);
        if(!picks.length) return UI.toast('Select at least one sample',{type:'warn'});
        const hosp=el.querySelector('#manHosp').value;
        /* The manifest carries the code of the samples on it and the day it was made:
           BC2610270001 → blood culture · 27 Oct 2026 · first manifest of that day. */
        const firstPick=S.db().samples.find(x=>x.id===picks[0]);
        const man={id:U.uid('man'),manifestId:'',type:'Referral',title:'Sample Referral Manifest',testingHospital:hosp,createdAt:U.todayISO(),samples:picks,status:'Generated',createdBy:LS.auth.user.name};
        let mid='';
        S.commit(d=>{ mid=S.takeManifestId(firstPick?firstPick.test:'',U.todayISO(),d); man.manifestId=mid;
          /* The courier was chosen when the orders were registered — carry it onto the sheet. */
          man.transportedBy=U.uniq(picks.map(id=>{ const s=d.samples.find(x=>x.id===id); return s&&s.transporter; }).filter(Boolean)).join(', ');
          d.manifests.unshift(man);
          picks.forEach(id=>{ const s=d.samples.find(x=>x.id===id); if(s){ s.manifestId=man.id; s.status='Received'; if(!s.receivedAt) s.receivedAt=U.nowISO(); } }); },
          {action:'manifest.create',entity:'manifest',entityId:man.id,detail:picks.length+' samples on manifest '+mid+' → '+hosp});
        close(); UI.toast('Manifest '+mid+' generated · '+picks.length+' samples',{type:'ok',actions:[{label:'View manifest',onClick:()=>manifestPreviewModal(man)}]});
        if(st) st.tab='manifests';
        paintView(); syncURL(); LS.shell.refresh();
      };
    }});
}
/* ——— The manifest document ————————————————————————
   Restored to the layout the department settled on in the first week of October:
   both coats in the header over a gold rule, the ID above its barcode in a pale band,
   a full table (No · Sample ID · Health facility · Patient · Patient ID · DOB · Sex ·
   Test · Collection date · Barcode) and the three signature lines underneath. */
function manifestSamples(man){
  const db=S.db();
  return (man.samples||[]).map(id=>db.samples.find(s=>s.id===id)).filter(Boolean);
}
function manifestDocHTML(man,opts){
  opts=opts||{};
  const db=S.db(); const st=db.settings||{};
  const samples=manifestSamples(man);
  const logoRuli='assets/ruli-hospital-192-centered.png';
  const logoRw='assets/rwanda-coat-192-centered.png';
  const rule='#C9A84C', navy='#0B1C3D';
  const head='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 6px 12px;border-bottom:3px solid '+rule+';margin-bottom:12px">'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:104px">'
      +'<img src="'+logoRw+'" alt="" style="width:96px;height:96px;object-fit:contain">'
      +'<span style="font-size:10px;font-weight:700;text-align:center;color:'+navy+'">Republic of Rwanda</span></div>'
    +'<div style="flex:1;text-align:center">'
      +'<div style="font-family:Georgia,serif;font-size:20px;font-weight:600;color:'+navy+';letter-spacing:.01em">'+U.esc(man.title||'Sample Referral Manifest')+'</div>'
      +'<div style="font-size:11px;font-weight:600;color:#444;margin-top:4px">Testing Hospital: '+U.esc(man.testingHospital||'')+'</div>'
      +'<div style="font-size:9.5px;color:#666;margin-top:3px;letter-spacing:.1em;text-transform:uppercase">'+U.esc(st.hospital||'Ruli District Hospital')+' · '+U.esc(st.dept||'Laboratory Department')+'</div></div>'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:104px">'
      +'<img src="'+logoRuli+'" alt="" style="width:96px;height:96px;object-fit:contain">'
      +'<span style="font-size:10px;font-weight:700;text-align:center;color:'+navy+'">'+U.esc(st.hospital||'Ruli District Hospital')+'</span></div>'
    +'</div>';
  const band='<div style="display:flex;align-items:center;justify-content:center;gap:26px;flex-wrap:wrap;margin-bottom:12px;padding:10px 12px;background:#F7F8FC;border:1px solid #e6e9f1;border-radius:8px">'
    +'<span style="font-weight:800;font-size:13px;letter-spacing:.06em;font-family:ui-monospace,Menlo,monospace;color:#111">'+U.esc(man.manifestId)+'</span>'
    +UI.barcodeSVG(man.manifestId)
    +'</div>';
  const th='background:#C4C4C4;color:#111;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;padding:5px 5px;border:1px solid #9a9a9a;text-align:left';
  const td='padding:4px 5px;border:1px solid #c9c9c9;font-size:8.6px;vertical-align:top';
  const rows=samples.map((x,i)=>'<tr>'
    +'<td style="'+td+'">'+(i+1)+'</td>'
    +'<td style="'+td+';font-weight:700;font-family:ui-monospace,Menlo,monospace;white-space:nowrap">'+U.esc(x.sampleId)+'</td>'
    +'<td style="'+td+'">'+U.esc([x.healthFacility||'',x.district||'Gakenke'].filter(Boolean).join(', '))+'</td>'
    +'<td style="'+td+'">'+U.esc(U.ptName(x))+'</td>'
    +'<td style="'+td+'">'+U.esc(x.patientId||'—')+'</td>'
    +'<td style="'+td+'">'+U.esc(x.dob?U.fmtDate(x.dob):'—')+'</td>'
    +'<td style="'+td+'">'+U.esc(x.sex||'—')+'</td>'
    +'<td style="'+td+'">'+orderedTests(x).map(t=>'<div style="white-space:nowrap">'+U.esc(t)+'</div>').join('')+'</td>'
    +'<td style="'+td+';white-space:nowrap">'+U.esc(x.collectionDate?U.fmtDate(x.collectionDate):'—')+'</td>'
    +'<td style="'+td+';text-align:center">'+UI.barcodeSVG(x.sampleId,{height:24})+'</td></tr>').join('');
  const table='<table style="width:100%;border-collapse:collapse;table-layout:auto">'
    +'<thead><tr>'+['No','Sample ID','Health facility','Patient name','Patient ID','DOB','Sex','Tests','Collection date','Barcode'].map(h=>'<th style="'+th+'">'+h+'</th>').join('')+'</tr></thead>'
    +'<tbody>'+(rows||'<tr><td colspan="10" style="'+td+';text-align:center;color:#888">No samples on this manifest.</td></tr>')+'</tbody></table>';
  /* Who carried it is already known: the transporter was chosen when the order was
     registered, so the manifest reads it back instead of leaving a blank.
     Only the date of reception is asked for — the generation and transport dates are the
     register's business, not the driver's — and the three signatories keep a full,
     aligned signature area each. */
  const couriers=U.uniq(samples.map(x=>x.transporter).filter(Boolean));
  const transportedBy=man.transportedBy||couriers.join(', ')||'';
  /* One line, three signatories: who generated it, who carried it and who receives it at the
     reference laboratory — no dates, the register holds those. */
  const labStyle='font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6b7a99;margin-right:7px';
  const nameStyle='font-size:10.5px;font-weight:600;color:'+navy+';white-space:nowrap';
  const sigGroup=(label,name)=>'<span style="display:inline-flex;align-items:baseline;white-space:nowrap">'
    +'<span style="'+labStyle+'">'+label+'</span><span style="'+nameStyle+'">'+name+'</span></span>';
  const sig='<div class="manifest-sig" style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:nowrap;margin-top:20px;padding-top:12px;border-top:1px solid #e6e9f1">'
    +sigGroup('Generated By',U.esc(man.createdBy||(LS.auth.user&&LS.auth.user.name)||'&nbsp;'))
    +sigGroup('Transported By',transportedBy?U.esc(transportedBy):'<span style="display:inline-block;min-width:130px">&nbsp;</span>')
    +'<span style="display:inline-flex;align-items:baseline;white-space:nowrap">'
      +'<span style="'+labStyle+'">Received By (at '+U.esc(man.testingHospital||'')+')</span>'
      +'<span style="display:inline-block;min-width:150px;border-bottom:1px solid #cfd4dd;height:14px"></span></span>'
    +'</div>';
  /* The footer, the way it has always read — centred, and on paper it sits in the bottom margin. */
  const foot='<div class="manifest-foot" style="margin-top:12px;padding-top:6px;text-align:center;font-size:9px;color:#6b7a99;letter-spacing:.02em">'
    +'Specimen Manifest Generated On: '+U.fmtDate(man.createdAt||U.todayISO())+' &nbsp;|&nbsp; Samples: '+samples.length+' &nbsp;|&nbsp; Page 1/1</div>';
  return '<div class="manifest-doc" id="manDoc" style="background:#fff;color:#111;padding:18px;border-radius:8px">'+head+band+table+sig+foot+'</div>';
}
/* Print: the very node on screen when the preview is open (so what is printed cannot drift
   from what is seen), otherwise a freshly built sheet. A4 landscape, own stylesheet. */
function printManifest(man,node){
  const css='@page{size:A4 landscape;margin:12mm 12mm 18mm}'
    +'html,body{background:#fff}'
    +'body{font-family:"Trebuchet MS",Segoe UI,Inter,sans-serif;color:#111;margin:0;font-size:10px;line-height:1.45;'
    +'-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'table{width:100%;border-collapse:collapse}img{display:block}svg{overflow:visible}'
    +'.manifest-doc{padding:0!important;border-radius:0!important}'
    /* the footer sits in the paper margin, on every page, not inside the sheet */
    +'.manifest-foot{position:fixed;left:0;right:0;bottom:0;margin:0!important;padding:4px 0 0;'
      +'text-align:center;border-top:1px solid #d8dde7;background:#fff;font-size:8px;color:#8a93a6}'
    +'.manifest-sig{page-break-inside:avoid;break-inside:avoid;max-width:none!important}';
  const sheet=node&&node.outerHTML?node.outerHTML:manifestDocHTML(man);
  U.print('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sample Referral Manifest — '+U.esc(man.manifestId)+'</title>'
    +'<style>'+css+'</style></head><body>'+sheet+'</body></html>');
}
function manifestPreviewModal(man){
  const samples=manifestSamples(man);
  UI.modal({title:'Manifest '+man.manifestId,
    sub:U.fmtDate(man.createdAt)+' · '+samples.length+' sample'+(samples.length===1?'':'s')+' · '+U.esc(man.testingHospital||''),
    width:'min(1080px,100%)',
    body:'<div class="manifest-preview-body" style="max-height:70vh;overflow:auto;border:1px solid var(--border);border-radius:10px">'+manifestDocHTML(man)+'</div>',
    foot:'<button class="btn" data-close>Close</button>'
      +'<button class="btn" data-copy-man>'+UI.ic('copy',15)+'Copy data</button>'
      +'<button class="btn primary" data-print-man>'+UI.ic('printer',15)+'Print / PDF</button>',
    onMount:(el)=>{
      /* While this sheet is open the *page* is printable too: the print stylesheet hides the
         console and leaves the sheet alone, so Ctrl+P, Share → Print and the button all agree. */
      document.body.classList.add('manifest-open');
      try{
        const watch=new MutationObserver(()=>{ if(!document.querySelector('#manDoc')){ document.body.classList.remove('manifest-open'); watch.disconnect(); } });
        watch.observe(document.getElementById('layer')||document.body,{childList:true,subtree:true});
      }catch(e){}
      el.querySelector('[data-print-man]').onclick=()=>printManifest(man,el.querySelector('#manDoc'));
      el.querySelector('[data-copy-man]').onclick=async()=>{
        const ok=await U.copy(U.toCSV([['No','Sample ID','Health facility','Patient','Patient ID','DOB','Sex','Test','Collection date']]
          .concat(samples.map((x,i)=>[i+1,x.sampleId,[x.healthFacility||'',x.district||''].filter(Boolean).join(', '),U.ptName(x),x.patientId||'',x.dob||'',x.sex||'',x.test,x.collectionDate||'']))));
        UI.toast(ok?'Manifest copied as CSV':'Copy failed',{type:ok?'ok':'err'});
      };
    }});
}

/* ——— The manifests that have been generated —————————————
   The tab that went missing: every manifest ever generated, newest first, with what
   is on it and what can be done to it. */
function manifestCard(man){
  const samples=manifestSamples(man);
  const gone=(man.samples||[]).length-samples.length;
  const canDelete=LS.auth.can('delete');
  return '<div class="card pad" data-man-card="'+man.id+'" style="break-inside:avoid">'
    +'<div class="row between" style="align-items:flex-start;gap:10px">'
      +'<div style="min-width:0"><div class="mono" style="font-size:13.5px;font-weight:700;color:var(--text-strong);letter-spacing:.02em">'+U.esc(man.manifestId)+'</div>'
      +'<div class="xs faint truncate" style="margin-top:3px">'+U.esc(man.title||'Sample Referral Manifest')+'</div></div>'
      +'<span class="pill gold">'+samples.length+' sample'+(samples.length===1?'':'s')+'</span>'
    +'</div>'
    +'<div class="thread" style="margin:11px 0"></div>'
    +'<div class="row between"><span class="xs faint">To</span><span class="small truncate" style="max-width:62%">'+U.esc(man.testingHospital||'—')+'</span></div>'
    +'<div class="row between" style="margin-top:5px"><span class="xs faint">Generated</span><span class="xs">'+U.fmtDate(man.createdAt||'')+(man.createdBy?' · '+U.esc(man.createdBy):'')+'</span></div>'
    +'<div class="row between" style="margin-top:5px"><span class="xs faint">Tests on it</span><span class="xs truncate" style="max-width:62%">'+U.esc(U.uniq([].concat.apply([],samples.map(orderedTests))).join(' · ')||'—')+'</span></div>'
    +(gone?'<div class="xs" style="margin-top:6px;color:var(--warn)">'+gone+' sample'+(gone===1?'':'s')+' on this manifest were deleted from the register.</div>':'')
    +'<div class="row gap-xs wrap" style="margin-top:12px">'
      +'<button class="btn xs primary" data-man-view="'+man.id+'">'+UI.ic('eye',12)+' View</button>'
      +'<button class="btn xs" data-man-print="'+man.id+'">'+UI.ic('printer',12)+' Print / PDF</button>'
      +(canDelete?'<span class="grow"></span><button class="btn xs danger" data-man-del="'+man.id+'" title="Delete this manifest">'+UI.ic('trash-2',12)+' Delete</button>':'')
    +'</div></div>';
}
function manifestsHTML(){
  const list=(S.db().manifests||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  return '<div class="toolbar">'
      +'<span class="chip gold"><b>'+list.length+'</b> manifest'+(list.length===1?'':'s')+'</span>'
      +'<span class="xs faint">Newest first · every generated manifest stays on this device and in the shared copy</span>'
      +'<span class="grow"></span>'
      +'<button class="btn sm" data-man-export>'+UI.ic('download',13)+'Export list</button>'
      +'<button class="btn primary sm" data-man-new>'+UI.ic('clipboard-list',14)+' Generate manifest</button>'
    +'</div>'
    +(list.length?'<div class="grid-12 stagger" style="row-gap:12px">'+list.map(m=>'<div class="c6">'+manifestCard(m)+'</div>').join('')+'</div>'
      :'<div class="card pad">'+UI.empty({art:'clipboard-list',title:'No manifests yet',body:'A manifest is created from registered samples travelling to the same receiving laboratory. Its ID is built from the test code and the day it is made.',action:'<button class="btn primary" data-man-new>'+UI.ic('plus',14)+' Generate manifest</button>'})+'</div>');
}
function findManifest(id){ return (S.db().manifests||[]).find(m=>m.id===id); }
function exportManifestList(){
  const list=(S.db().manifests||[]).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  if(!list.length) return UI.toast('No manifests to export yet',{type:'warn'});
  const rows=[['Manifest ID','Title','Receiving laboratory','Samples','Patient names','Tests','Generated','Generated by']]
    .concat(list.map(m=>{ const sm=manifestSamples(m);
      return [m.manifestId,m.title||'Sample Referral Manifest',m.testingHospital||'',sm.length,
        U.uniq(sm.map(x=>U.ptName(x))).filter(n=>n&&n!==U.CONFIDENTIAL).join(', ')||U.CONFIDENTIAL,U.uniq(sm.map(x=>x.test)).join(' · '),U.fmtDate(m.createdAt||''),m.createdBy||'']; }));
  U.exportCSV('manifests-'+U.todayISO()+'.csv',rows,{title:'Generated manifests',actor:LS.auth.user.name});
  UI.toast(list.length+' manifests exported',{type:'ok'});
}
function wireManifests(){
  const r=rootEl; if(!r) return;
  r.querySelectorAll('[data-man-new]').forEach(b=>b.onclick=()=>addToManifest([]));
  r.querySelectorAll('[data-man-export]').forEach(b=>b.onclick=exportManifestList);
  r.querySelectorAll('[data-man-view]').forEach(b=>b.onclick=()=>{ const m=findManifest(b.dataset.manView); if(m) manifestPreviewModal(m); });
  r.querySelectorAll('[data-man-print]').forEach(b=>b.onclick=()=>{ const m=findManifest(b.dataset.manPrint); if(m) printManifest(m); });
  r.querySelectorAll('[data-man-del]').forEach(b=>b.onclick=()=>deleteManifest(b.dataset.manDel));
}
function deleteManifest(id){
  const man=(S.db().manifests||[]).find(m=>m.id===id); if(!man) return;
  if(!LS.auth.guard('delete')) return;
  UI.confirm({title:'Delete manifest '+man.manifestId+'?',danger:true,confirm:'Delete manifest',
    body:'The manifest is removed. The '+manifestSamples(man).length+' sample'+(manifestSamples(man).length===1?'':'s')+' on it stay in the register — only the manifest goes.'}).then(ok=>{
    if(!ok) return;
    S.commit(d=>{ d.manifests=(d.manifests||[]).filter(m=>m.id!==id);
      (d.samples||[]).forEach(x=>{ if(x.manifestId===id) x.manifestId=null; }); },
      {action:'manifest.delete',entity:'manifest',entityId:id,detail:'Deleted manifest '+man.manifestId});
    UI.toast('Manifest '+man.manifestId+' deleted',{type:'ok'});
    paintView();
  });
}

/* ——— Deleting orders ——————————————————————————————
   Duplicates are a fact of a register typed at a bench. Selection plus one press, with
   an Undo in the toast and the sample removed from any manifest it sat on. */
function deleteSamples(ids){
  ids=(ids||[]).filter(Boolean);
  if(!ids.length) return;
  if(!LS.auth.guard('delete')) return;
  const db=S.db();
  const victims=ids.map(id=>db.samples.find(s=>s.id===id)).filter(Boolean);
  if(!victims.length) return;
  const onManifest=victims.filter(x=>x.manifestId);
  const listed=victims.slice(0,8).map(x=>'<span class="mono xs">'+U.esc(x.sampleId)+'</span>').join(' · ')
    +(victims.length>8?' <span class="xs faint">and '+(victims.length-8)+' more</span>':'');
  UI.confirm({title:'Delete '+victims.length+' order'+(victims.length===1?'':'s')+'?',danger:true,
    confirm:'Delete '+victims.length,
    body:'<p class="small" style="line-height:1.7">'+listed+'</p>'
      +(onManifest.length?'<p class="small" style="margin-top:8px;line-height:1.7;color:var(--warn)">'+onManifest.length+' of them are on a manifest. They will be taken off it; the manifest itself stays.</p>':'')
      +'<p class="small" style="margin-top:8px;line-height:1.7">This removes them from the register on this device and from the shared copy at the next sync. The audit trail keeps the fact that they were deleted, and <b>Undo</b> stays in the corner for a moment.</p>'
  }).then(ok=>{
    if(!ok) return;
    const snapshot=victims.map(x=>JSON.parse(JSON.stringify(x)));
    const links=victims.filter(x=>x.manifestId).map(x=>({id:x.id,manifestId:x.manifestId,status:x.status}));
    S.commit(d=>{
      d.samples=d.samples.filter(x=>ids.indexOf(x.id)<0);
      (d.manifests||[]).forEach(m=>{ m.samples=(m.samples||[]).filter(x=>ids.indexOf(x)<0); });
    },{action:'samples.delete',entity:'samples',detail:'Deleted '+victims.length+' order'+(victims.length===1?'':'s')+': '+snapshot.map(x=>x.sampleId).join(', ')});
    st.selected.clear();
    paintView();
    UI.toast(victims.length+' order'+(victims.length===1?'':'s')+' deleted',{type:'ok',duration:9000,
      actions:[{label:'Undo',onClick:()=>{
        S.commit(d=>{
          snapshot.forEach(x=>{ if(!d.samples.some(y=>y.id===x.id)) d.samples.push(x); });
          links.forEach(l=>{ const m=(d.manifests||[]).find(y=>y.id===l.manifestId); if(m&&m.samples.indexOf(l.id)<0) m.samples.push(l.id); });
        },{action:'samples.delete.undo',entity:'samples',detail:'Restored '+snapshot.length+' order'+(snapshot.length===1?'':'s')});
        UI.toast('Restored '+snapshot.length+' order'+(snapshot.length===1?'':'s'),{type:'ok'});
        paintView();
      }}]});
  });
}

/* ——— Register wizard ————————————————— */
function newWizard(){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const tests=S.tests();
  /* The laboratory that sends these specimens is the hospital's own: Ruli DH comes first
     and is the default. Health centres stay on the list for specimens collected there. */
  const hcs=U.uniq(['Ruli DH'].concat(db.catalog.healthCenters.map(h=>h.name)));
  const hospitals=db.catalog.hospitals.map(h=>h.name).concat(['Ruli DH - GeneXpert']);
  const state={step:1,patient:{name:'',pid:'',sex:'Female',dob:'',age:''},tests:[],priority:'Routine',origin:'Ruli DH',hospital:hospitals[0],transporter:'',notes:'',sampleId:''};
  /* The preview must read like the real thing: test code, month, next number. */
  const firstTestName=()=>{ const t=tests.find(x=>x.id===state.tests[0]); return t?t.name:''; };
  const previewId=()=>S.sampleId(firstTestName()||(tests[0]&&tests[0].name),U.todayISO());
  const stepHTML=()=>{
    if(state.step===1) return '<div class="wizard-step">'
      +'<div class="form-grid">'
      +(U.canSeeNames()
        ? '<div class="field span2"><label>Patient name</label><input class="input" id="wName" value="'+U.esc(state.patient.name)+'" placeholder="MUKAMANA Alice" autocomplete="off"><div class="xs faint" style="margin-top:4px">Recorded on this device and shown to signed-in staff. The public visitor reads <b>'+U.CONFIDENTIAL+'</b>.</div></div>'
        : '<div class="field span2"><label>Patient</label><div class="card pad" style="background:var(--surface-inset);padding:9px 11px"><b class="small">'+U.CONFIDENTIAL+'</b><div class="xs faint" style="margin-top:3px">Names are recorded by signed-in staff. The sample ID and the patient/insurance ID identify the specimen.</div></div></div>')
      +'<div class="field"><label>Patient / insurance ID</label><input class="input mono" id="wPid" value="'+U.esc(state.patient.pid)+'" placeholder="430129"></div>'
      +'<div class="field"><label>Sex</label><select class="select" id="wSex">'+['Female','Male'].map(x=>'<option '+(state.patient.sex===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Date of birth</label><input class="input mono" type="date" id="wDob" value="'+U.esc(state.patient.dob)+'" max="'+U.todayISO()+'"><div class="xs faint" style="margin-top:4px">The age below is calculated from it.</div></div>'
      +'<div class="field"><label>Age · calculated</label><input class="input mono" id="wAge" value="'+U.esc(state.patient.age)+'" placeholder="from the date of birth" readonly><div class="xs faint" style="margin-top:4px">Leave the date blank to type an age instead.</div></div>'
      +'<div class="field"><label>Priority</label><select class="select" id="wPri">'+['Routine','STAT','Follow-up'].map(x=>'<option '+(state.priority===x?'selected':'')+'>'+x+'</option>').join('')+'</select></div></div>'
      +'<div class="hint" style="margin-top:10px">The sample ID is built from the test you choose: <span class="mono">R+code+MMYY+number</span>. STAT samples are pinned to the top of the worklist and excluded from batching.</div></div>';
    if(state.step===2) return '<div class="wizard-step">'
      +'<div class="field" style="margin-bottom:10px"><label>Search test menu</label><div class="searchbox">'+UI.ic('search',14)+'<input class="input" id="wTestSearch" placeholder="CBC, malaria, GeneXpert…"></div></div>'
      +'<div id="wTestList" style="max-height:300px;overflow:auto;display:grid;grid-template-columns:1fr 1fr;gap:6px">'
      +tests.map(t=>'<button class="choice '+(state.tests.includes(t.id)?'on':'')+'" data-test="'+t.id+'" data-name="'+U.esc(t.name.toLowerCase())+'"><span class="cmark">'+UI.ic('check',9)+'</span><span class="grow"><span class="ct">'+U.esc(t.name)+'</span><span class="cs" style="display:block">'+U.esc(t.cat)+' · TAT '+t.tat+'d · '+U.esc(t.code)+'</span></span></button>').join('')
      +'</div><div class="row between" style="margin-top:10px"><span class="hint" id="wTestCount">'+state.tests.length+' selected</span><span class="hint">Barcode generated on save</span></div>'
      +'<div class="hint" id="wRoutine" style="display:none;margin-top:6px">Blood culture carries <b>Cytology</b> and <b>Gram Stain</b> as routine — the manifest lists them first.</div></div>';
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
        if(state.step===1){
          const nm=el.querySelector('#wName');
          state.patient.name=(nm&&U.canSeeNames())?(nm.value||'').trim():U.CONFIDENTIAL;
          state.patient.pid=(el.querySelector('#wPid')||{}).value||'';
          state.patient.sex=(el.querySelector('#wSex')||{}).value||'Female';
          state.patient.dob=(el.querySelector('#wDob')||{}).value||'';
          const calc=U.ageFromDob(state.patient.dob);
          state.patient.age=(calc===''?((el.querySelector('#wAge')||{}).value||''):String(calc));
          state.priority=(el.querySelector('#wPri')||{}).value||'Routine';
        }
        else if(state.step===3){ state.origin=(el.querySelector('#wOrigin')||{}).value||''; state.hospital=(el.querySelector('#wHosp')||{}).value||''; state.transporter=(el.querySelector('#wTrans')||{}).value||''; state.notes=(el.querySelector('#wNote')||{}).value||''; }
      };
      const paint=()=>{ body.innerHTML=stepHTML(); syncDots(); wireStep(); };
      const wireStep=()=>{
        if(state.step===1){
          /* Typing or picking a date of birth fills the age at once; clearing it
             hands the field back so an age can be typed instead. */
          const dob=body.querySelector('#wDob'), age=body.querySelector('#wAge');
          if(dob&&age){
            const sync=()=>{
              const a=U.ageFromDob(dob.value);
              if(a===''){ age.readOnly=false; if(!age.value) age.value=state.patient.age||''; }
              else { age.readOnly=true; age.value=String(a); }
            };
            dob.addEventListener('input',sync);
            dob.addEventListener('change',sync);
            sync();
          }
        }
        if(state.step===2){
          const companionIds=name=>routineWith(name).map(n=>{ const c=tests.find(x=>x.name===n); return c&&c.id; }).filter(Boolean);
          const paintRoutine=()=>{
            const bc=tests.find(t=>t.name==='Blood Culture');
            const on=!!bc&&state.tests.includes(bc.id);
            const note=body.querySelector('#wRoutine');
            if(note) note.style.display=on?'':'none';
            body.querySelectorAll('[data-test]').forEach(b=>{
              b.classList.toggle('on',state.tests.includes(b.dataset.test));
              const auto=bc&&b.dataset.test!==bc.id&&companionIds('Blood Culture').indexOf(b.dataset.test)>=0&&on;
              b.classList.toggle('routine',!!auto);
            });
            body.querySelector('#wTestCount').textContent=state.tests.length+' selected'+(on?' · Cytology and Gram Stain added as routine':'');
          };
          body.querySelectorAll('[data-test]').forEach(b=>b.onclick=()=>{
            const id=b.dataset.test; const t=tests.find(x=>x.id===id); if(!t) return;
            if(state.tests.includes(id)){
              state.tests=state.tests.filter(x=>x!==id);
              /* dropping the culture drops the routine pair with it */
              if(t.name==='Blood Culture') state.tests=state.tests.filter(x=>companionIds('Blood Culture').indexOf(x)<0);
            } else {
              state.tests.push(id);
              companionIds(t.name).forEach(cid=>{ if(!state.tests.includes(cid)) state.tests.push(cid); });
            }
            paintRoutine();
          });
          paintRoutine();
          const search=body.querySelector('#wTestSearch');
          search.addEventListener('input',()=>{ const q=search.value.toLowerCase(); body.querySelectorAll('[data-test]').forEach(b=>{ b.style.display=(b.dataset.name+' '+b.textContent).toLowerCase().indexOf(q)>=0?'':'none'; }); });
        }
      };
      const advance=()=>{
        capture();
        if(state.step===1 && String(state.patient.pid||'').trim().length<1) return UI.toast('Enter the patient / insurance ID to continue',{type:'warn'});
        if(state.step===2 && !state.tests.length) return UI.toast('Select at least one test',{type:'warn'});
        if(state.step<3){ state.step++; paint(); }
        else {
          const testObjs=state.tests.map(id=>tests.find(t=>t.id===id)).filter(Boolean);
          const ordered=orderedTests({tests:testObjs.map(t=>t.name)});
          const first=testObjs.find(t=>t.name==='Blood Culture')||testObjs[0];
          const today=U.todayISO();
          const name=(state.patient.name&&state.patient.name!==U.CONFIDENTIAL)?state.patient.name:U.CONFIDENTIAL;
          const sample={id:U.uid('sm'),sampleId:'',patientName:name,patientId:state.patient.pid,
            dob:state.patient.dob||'',age:state.patient.age||'',
            sex:state.patient.sex,
            test:first.name,testCode:first.code,cat:first.cat,hospital:state.hospital,healthFacility:state.origin,district:'Gakenke',
            collectionDate:today,collectionAt:U.nowISO(),sentDate:today,receivedAt:null,resultedAt:null,status:'Registered',
            priority:state.priority,tatTargetDays:Math.max.apply(null,testObjs.map(t=>t.tat)),notes:state.notes,transporter:state.transporter,
            collector:LS.auth.user.name,source:'register',manifestId:null,tests:ordered};
          /* The ID is taken inside the commit, from the test chosen and this month. */
          let sid='';
          S.commit(d=>{ sid=S.takeSampleId(first.name,today,d); sample.sampleId=sid; d.samples.push(sample); },
            {action:'sample.register',entity:'samples',entityId:sample.id,detail:'Registered '+sid+' · '+first.name+' · '+state.priority+' → '+state.hospital});
          close();
          UI.toast('Sample '+sid+' registered · barcode ready',{type:'ok',actions:[{label:'Open record',onClick:()=>openSample(sample.id)}]});
          LS.shell.refresh();
        }
      };
      next.onclick=advance; back.onclick=()=>{ capture(); state.step=Math.max(1,state.step-1); paint(); };
      el.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'){ e.preventDefault(); advance(); } });
      syncDots(); wireStep();
      setTimeout(()=>{ const f=el.querySelector('#wName')||el.querySelector('#wPid'); if(f) f.focus(); },80);
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
  r.querySelectorAll('[data-edit]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); editSample(b.dataset.edit); });
  r.querySelectorAll('[data-row]').forEach(tr=>tr.onclick=e=>{ if(e.target.closest('[data-check]')) return; openSample(tr.dataset.row); });
  r.querySelectorAll('[data-check]').forEach(cb=>cb.onclick=e=>{ e.stopPropagation(); const id=cb.dataset.check; if(st.selected.has(id)) st.selected.delete(id); else st.selected.add(id); paintTable(); });
  r.querySelectorAll('[data-bulk-clear]').forEach(b=>b.onclick=()=>{ st.selected.clear(); paintTable(); });
  r.querySelectorAll('[data-bulk-delete]').forEach(b=>b.onclick=()=>deleteSamples(Array.from(st.selected)));
  r.querySelectorAll('[data-bulk-manifest]').forEach(b=>b.onclick=()=>addToManifest(Array.from(st.selected)));
  r.querySelectorAll('[data-bulk-export]').forEach(b=>b.onclick=()=>{ const rows=[['Sample ID','Patient','Test','Origin','Hospital','Priority','Status','Collected']].concat(S.db().samples.filter(s=>st.selected.has(s.id)).map(s=>[s.sampleId,U.ptName(s),orderedTests(s).join(' · '),s.healthFacility,s.hospital,s.priority,s.status,s.collectionDate])); U.exportCSV('samples-selection-'+U.todayISO()+'.csv',rows,{title:'Referred samples — selection',actor:LS.auth.user.name}); UI.toast(rows.length-1+' samples exported',{type:'ok'}); });
  // infinite scroll
  const scroll=r.querySelector('#smpScroll');
  if(scroll){ onScroll=U.throttle(()=>{ if(scroll.scrollTop+scroll.clientHeight>scroll.scrollHeight-120){ const list=filtered(); if(st.limit<list.length){ st.limit+=80; const keep=scroll.scrollTop; paintTable(); const ns=rootEl.querySelector('#smpScroll'); if(ns) ns.scrollTop=keep; } } },300); scroll.addEventListener('scroll',onScroll); }
}
function paintTableKeepFocus(){
  const v=st.q; paintTable();
  const s=rootEl.querySelector('#smpSearch'); if(s){ s.value=v; s.focus(); s.setSelectionRange(v.length,v.length); }
}
function syncURL(){
  try{ const qs=[]; if(st.filter&&st.filter!=='all') qs.push('filter='+st.filter); if(st.tab==='manifests') qs.push('tab=manifests'); history.replaceState(null,'','#/samples'+(qs.length?'?'+qs.join('&'):'')); }catch(e){}
}
function exportCSV(){
  const list=filtered();
  const rows=[['Sample ID','Patient','Patient ID','Sex','Test','Category','Priority','Status','Origin facility','Receiving lab','Collected','TAT target (d)','Result','Flag','Collector']]
    .concat(list.map(s=>[s.sampleId,U.ptName(s),s.patientId,s.sex,orderedTests(s).join(' · '),s.cat,s.priority,s.status,s.healthFacility,s.hospital,s.collectionDate,s.tatTargetDays,s.resultValue||'',s.flag||'',s.collector||'']));
  U.exportCSV('referred-samples-'+U.todayISO()+'.csv',rows,{title:'Referred samples register',actor:LS.auth.user.name});
  UI.toast(list.length+' samples exported with letterhead metadata',{type:'ok'});
}

/* ——— Two views over the same register: the orders, and the manifests ————— */
function viewTabsHTML(){
  const tab=(st&&st.tab)==='manifests'?'manifests':'samples';
  const cnt=counts();
  const mk=(k,label,n)=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-tab="'+k+'">'+label+'<span class="cnt">'+n+'</span></button>';
  return '<div class="filters" id="smpTabs" style="margin-bottom:12px">'
    +mk('samples','Samples',cnt.register)
    +mk('manifests','Manifests',(S.db().manifests||[]).length)
    +'</div>';
}
function pressureChart(scope){
  if(!scope) return;
  const host=scope.querySelector('#smpPressure'); if(!host) return;
  C.hbars(host,{items:(function(){
    const active=S.db().samples.filter(s=>!s.resultedAt);
    const buckets=[['> 100% (breached)',active.filter(s=>S.tatFor(s).ratio>1).length,'rose'],['80–100% (at risk)',active.filter(s=>{const r=S.tatFor(s).ratio; return r>.8&&r<=1;}).length,'amber'],['40–80%',active.filter(s=>{const r=S.tatFor(s).ratio; return r>.4&&r<=.8;}).length,'gold'],['< 40%',active.filter(s=>S.tatFor(s).ratio<=.4).length,'teal']];
    return buckets.map(([label,value,tone])=>({label,value:Math.max(value,0),display:value+'',tone}));
  })()});
}
function paintView(){
  if(!rootEl) return;
  const host=rootEl.querySelector('#smpView'); if(!host) return;
  const tab=(st&&st.tab)==='manifests'?'manifests':'samples';
  const tabs=rootEl.querySelector('#smpTabs'); if(tabs) tabs.outerHTML=viewTabsHTML();
  const head=rootEl.querySelector('#smpHeadActions');
  if(head) head.innerHTML = tab==='manifests'
    ? '<button class="btn" data-man-export>'+UI.ic('download',15)+' Export list</button><button class="btn primary magnetic" data-man-new>'+UI.ic('clipboard-list',15)+' Generate manifest</button>'
    : '<button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn" data-saved>'+UI.ic('book-marked',15)+' Saved views</button><button class="btn primary magnetic" data-new>'+UI.ic('plus',15)+' Register sample</button>';
  if(tab==='manifests'){
    host.innerHTML=manifestsHTML();
    wireManifests();
  } else {
    host.innerHTML='<div class="grid-12" style="margin-bottom:14px"><div class="c8"><div id="smpTableWrap">'+tableHTML()+'</div></div><div class="c4">'+referralPanel()
       +'<div style="margin-top:14px">'+UI.card({title:'TAT pressure',sub:'Active samples by % of target consumed',icon:'gauge',body:'<div id="smpPressure"></div>'})+'</div>'
       +'<div style="margin-top:14px">'+throughputMini()+'</div></div></div>'
     +'<div style="margin-top:14px">'+tatByLabCard()+'</div>';
    pressureChart(host);
    host.querySelectorAll('[data-edit-labs]').forEach(b=>b.onclick=labEditor);
    wire();
  }
  rootEl.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{
    if(st.tab===b.dataset.tab) return;
    st.tab=b.dataset.tab; st.selected.clear(); syncURL(); paintView();
  });
  renderHeadMeta();
}
/* The subtitle follows the tab: the count in the header must describe what is on screen. */
function renderHeadMeta(){
  if(!rootEl) return;
  const sub=rootEl.querySelector('.page-head .sub'); if(!sub) return;
  const cnt=counts();
  sub.textContent=(st&&st.tab)==='manifests'
    ? 'Every manifest generated from this register, newest first. Open one to view, print or export the sheet you would hand the driver. '+((S.db().manifests||[]).length)+' on this device.'
    : 'Chain of custody you can feel — every registration, handoff and result is signed. '+cnt.active+' active samples, '+cnt.overdue+' past target.';
}

M.render=function(root,params){
  rootEl=root; st={q:params.q||'',filter:params.filter||'all',selected:new Set(),limit:90,sort:'collected',dir:'desc',tab:params.tab==='manifests'?'manifests':'samples'};
  root.innerHTML='<div class="page-head"><div><h1>Referred samples</h1><div class="sub"></div></div><div class="actions" id="smpHeadActions"></div></div>'
   +viewTabsHTML()
   +'<div id="smpView"></div>';
  paintView();
  if(M._nsHandler) document.removeEventListener('ls:new-sample',M._nsHandler);
  M._nsHandler=()=>newWizard();
  document.addEventListener('ls:new-sample',M._nsHandler);
  if(params.new) setTimeout(newWizard,120);
  if(params.manifest) setTimeout(()=>addToManifest([]),120);
  if(params.id) setTimeout(()=>openSample(params.id),120);
  if(params.tab||params.filter) syncURL();
};
M.paintView=paintView;
M.openSample=openSample;
M.newSample=newWizard;
})();
