/* ============================================================================
   MODULE · PBF EVALUATION — performance-based financing for health centres
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.pbf=M;
let rootEl=null, sort='total', q='';
const DOMAINS=[['quality','Quality management',20],['tat','Turnaround & referral',20],['stock','Commodity security',15],['data','Data quality & reporting',15],['hr','Staffing & competency',15],['infra','Infrastructure & safety',15]];

/* ——— Question-level evaluation ————————————————————— */
const DEFAULT_QUESTIONS=[
  ['quality','Quality control charts completed and reviewed daily'],
  ['quality','EQA/PT panels analysed and results returned on time'],
  ['quality','Non-conformances logged with corrective action'],
  ['tat','Referred samples dispatched within 24 hours'],
  ['tat','Turnaround time monitored against the test menu targets'],
  ['tat','Rejection and re-draw rate reviewed monthly'],
  ['stock','Stock cards match physical counts'],
  ['stock','No stock-out of tracer commodities in the quarter'],
  ['data','Register complete: no missing patient or result fields'],
  ['data','Monthly HMIS/lab report submitted by the 5th'],
  ['data','Results traceable to specimen and requester'],
  ['hr','Duty roster published and followed'],
  ['hr','Every staff member has a current competency file'],
  ['hr','Safety briefing and PEP protocol known by all staff'],
  ['infra','Equipment maintenance log up to date'],
  ['infra','Waste segregation and sharps disposal correct'],
  ['infra','Water, power and bench space adequate for the workload']
];
/* Every question is marked out of its own maximum — 25 by default, editable per
   question. A question the district no longer evaluates is deleted from the bank
   (soft delete, so past visits keep their marks). */
const Q_MAX_DEFAULT=25;

function questions(){
  const db=S.db();
  if(!db.pbfQuestions){
    db.pbfQuestions=DEFAULT_QUESTIONS.map(([domain,text],i)=>({id:'q'+(i+1),domain,text,max:Q_MAX_DEFAULT,active:true}));
  }
  /* One-time migration: the bank used to be uniform 5-mark questions and carried
     a cold-chain indicator that this console no longer evaluates. Marks are
     rescaled to 25 per question so every stored percentage is preserved. */
  if(!db.meta.pbfQ66){
    db.meta.pbfQ66=true;
    (db.pbfQuestions||[]).forEach(q=>{
      const m=+q.max||5;
      if(m!==Q_MAX_DEFAULT){
        const f=Q_MAX_DEFAULT/m;
        (db.pbfVisits||[]).forEach(v=>{ if(v.answers&&v.answers[q.id]!=null) v.answers[q.id]=Math.round(v.answers[q.id]*f); });
        q.max=Q_MAX_DEFAULT;
      }
      if(/cold chain|temperature log/i.test(q.text)) q.deleted=true;
    });
    try{ S.save(); }catch(e){}
  }
  return (db.pbfQuestions||[]).filter(q=>!q.deleted);
}
function retiredQuestions(){ return (S.db().pbfQuestions||[]).filter(q=>q.deleted); }
function qById(id){ return questions().find(q=>q.id===id); }
function visitScore(visit){
  const scores={};
  DOMAINS.forEach(([k])=>{
    const qs=questions().filter(q=>q.domain===k);
    let got=0,max=0;
    qs.forEach(q=>{ const v=visit.answers&&visit.answers[q.id]; if(v==null) return; got+=Math.max(0,Math.min(q.max,+v)); max+=q.max; });
    scores[k]=max?Math.round(got/max*100):0;
  });
  return scores;
}
function visitTotal(v){ return total({scores:visitScore(v)}); }
function visitsFor(name){
  return (S.db().pbfVisits||[]).filter(v=>v.hcName===name).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
/* ——— Visit schedule & visit state ————————————————————
   A centre is "not yet visited" while its scheduled visit is still ahead of us
   (the quarter is running). "Not visited" is a separate, explicit statement the
   user makes — it is never inferred from a missing scorecard. */
function schedule(){ return S.db().pbfSchedule||[]; }
function latestSchedule(name){
  return schedule().filter(s=>s.hcName===name)
    .sort((a,b)=>String(b.plannedDate||'').localeCompare(String(a.plannedDate||'')))[0]||null;
}
function activeQuarter(){
  const vs=(S.db().pbfVisits||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  if(vs.length) return {quarter:vs[0].quarter||'Q1', fy:vs[0].fy||U.fyLabel()};
  return {quarter:'Q1', fy:U.fyLabel()};
}
function quarterOpen(sc){
  if(!sc) return false;
  if(sc.status==='visited') return false;
  if(sc.status==='notVisited') return false;
  return !sc.plannedDate || String(sc.plannedDate).slice(0,10)>=U.todayISO();
}
function centreState(name){
  const vs=visitsFor(name), last=vs[0], sc=latestSchedule(name);
  if(sc && sc.status==='notVisited' && (!last || String(sc.quarter||'')>=String(last.quarter||'')))
    return {key:'not-visited',label:'Not visited',detail:'confirmed '+U.fmtDate(sc.confirmedAt||sc.plannedDate)+(sc.reason?' · '+sc.reason:''),pill:'rose',schedule:sc};
  if(last) return {key:'visited',label:'Visited',detail:U.fmtDate(last.date)+' · '+(last.quarter||''),pill:'teal',schedule:sc};
  if(sc) return {key:'due',label:'Not yet visited',detail:(quarterOpen(sc)?'scheduled ':'was due ')+U.fmtDate(sc.plannedDate)+' · '+(sc.quarter||'')+' open',pill:'blue',schedule:sc};
  return {key:'unscheduled',label:'Not scheduled',detail:'no visit planned yet',pill:'slate',schedule:null};
}
function statusLine(r){
  const st=r.state||{key:'unscheduled'};
  if(st.key==='visited') return (r.assessor||'District PBF team')+' · '+U.fmtDate(r.submitted);
  return st.label+' · '+st.detail;
}

function list(){
  const centres=S.db().catalog.healthCenters.map(h=>h.name);
  const names=U.uniq(centres.concat((S.db().pbf||[]).map(r=>r.name)).concat((S.db().pbfVisits||[]).map(v=>v.hcName)));
  return names.map((name,i)=>{
    const vs=visitsFor(name);
    const legacy=(S.db().pbf||[]).find(r=>r.name===name);
    if(!vs.length && legacy) return Object.assign({},legacy,{state:centreState(name)});
    if(!vs.length) return {id:'hc-'+i,name,scores:{},prior:0,submitted:null,assessor:'',visits:0,state:centreState(name)};
    const latest=vs[0], prev=vs[1];
    const scores=visitScore(latest);
    return {id:latest.id,name,scores,total:visitTotal(latest),prior:prev?visitTotal(prev):0,
      submitted:latest.date,assessor:latest.assessor||'District PBF team',quarter:latest.quarter,fy:latest.fy,
      visit:latest,visits:vs.length,status:'draft',state:centreState(name)};
  });
}
function total(row){ return Math.round(DOMAINS.reduce((a,[k,,w])=>a+(row.scores[k]||0)*w/100,0)); }
function tone(v){ return v>=S.PBF_MIN+5?'teal':v>=S.PBF_MIN?'gold':'rose'; }
function delta(r){ return total(r)-(r.prior||total(r)); }
function stats(){
  const rows=list();
  return {avg:Math.round(U.avg(rows.map(total))), top:rows.slice().sort((a,b)=>total(b)-total(a))[0], bottom:rows.slice().sort((a,b)=>total(a)-total(b))[0],
    below:rows.filter(r=>total(r)<S.PBF_MIN).length, improved:rows.filter(r=>delta(r)>0).length, rows};
}
function kpis(){
  const s=stats();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'District average',value:s.avg,unit:'%',icon:'chart-line',formatted:'0',delta:3.4,note:s.rows.length+' health centres · Q1 FY 26/27',spark:C.spark(s.rows.map(total),{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Leading centre',value:s.top?total(s.top):0,unit:'%',icon:'award',formatted:'0',note:s.top?s.top.name:'—',spark:C.spark([62,66,70,71,74,78,total(s.top||{scores:{}})],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Below '+S.PBF_MIN+'% floor',value:s.below,icon:'alert-triangle',formatted:'0',note:s.below?'Support plan required':'All centres above floor',spark:C.spark([3,3,2,2,2,1,1,s.below],{color:'var(--crit)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Improved vs Q4',value:s.improved,unit:'/ '+s.rows.length,icon:'trending-up',formatted:'0',note:'Quarter-on-quarter movement',spark:C.spark([2,3,3,4,4,5,5,s.improved],{color:'var(--pos)'})})+'</div></div>';
}
function hero(){
  const s=stats(); const rows=s.rows.slice().sort((a,b)=>total(b)-total(a));
  return '<div class="grid-12"><div class="c12">'+UI.card({title:'Quarterly index',sub:'Weighted laboratory score · Q1 FY 2026/2027 · draft returns',icon:'building-2',
    tools:'<span class="chip gold">'+UI.ic('file-text',12)+'Verification meeting 12 Nov</span>',
    body:'<div class="pbf-strip">'+rows.map((r,i)=>{
      const t=total(r), d=delta(r);
      return '<div class="pbf-col" data-pbf="'+r.id+'" title="'+U.esc(r.name)+' · '+t+'%">'
        +'<div class="pbf-bar" style="height:'+U.clamp(t,4,100)+'%"><span class="pbf-fill '+(t>=S.PBF_MIN+5?'teal':t>=S.PBF_MIN?'gold':'rose')+'"></span></div>'
        +'<div class="pbf-rank mono">#'+(i+1)+'</div><div class="pbf-name">'+U.esc(r.name.replace(' HC',''))+'</div>'
        +'<div class="mono xs '+(d>0?'':'')+'" style="color:var(--'+(d>0?'pos':d<0?'crit':'text-faint')+')">'+(d>0?'+':'')+d+'</div></div>';
    }).join('')+'</div>'
    +'<div class="pbf-axis"><span class="xs faint">20%</span><span class="xs faint">'+S.PBF_MIN+'% floor</span><span class="xs faint">100%</span></div>'})+'</div></div>';
}
function rowData(){
  return list().filter(r=>!q||r.name.toLowerCase().indexOf(q)>=0).slice().sort((a,b)=>{
    if(sort==='name') return a.name.localeCompare(b.name);
    if(sort==='delta') return delta(b)-delta(a);
    return total(b)-total(a);
  });
}
function rowsHTML(){
  const rows=rowData();
  if(!rows.length) return '<tr><td colspan="'+(DOMAINS.length+5)+'"><div style="padding:26px 8px">'+UI.empty({art:'search',title:'No health centre matches',body:'Try a shorter search term.'})+'</div></td></tr>';
  return rows.map(r=>{ const t=total(r), d=delta(r);
    return '<tr data-pbf-row="'+r.id+'" style="cursor:pointer">'
      +'<td><div class="primary-cell"><b>'+U.esc(r.name)+'</b><small>'+U.esc(statusLine(r))+'</small></div></td>'
      +DOMAINS.map(([k])=>'<td class="num"><span class="mono xs" style="color:var(--'+(r.scores[k]>=S.PBF_MIN+5?'pos':r.scores[k]>=S.PBF_MIN?'gold-bright':'crit')+')">'+r.scores[k]+'</span></td>').join('')
      +'<td><span class="pill '+tone(t)+'">'+t+'%</span></td><td class="num xs faint">'+r.prior+'</td>'
      +'<td class="mono xs" style="color:var(--'+(d>0?'pos':d<0?'crit':'text-faint')+')">'+(d>0?'+':'')+d+'</td>'
      +'<td><button class="icon-btn" style="width:26px;height:26px" data-open="'+r.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('');
}
function table(){
  return '<div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="pbfSearch" placeholder="Search health centre…" value="'+U.esc(q)+'"></div>'
   +'<span class="grow"></span>'
   +'<div class="seg">'+[['total','Score'],['delta','Momentum'],['name','Name']].map(([k,l])=>'<button class="'+(sort===k?'on':'')+'" data-sort="'+k+'">'+l+'</button>').join('')+'</div></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Health centre</th>'+DOMAINS.map(d=>'<th class="num" title="'+U.esc(d[1])+'">'+U.esc(d[0])+'</th>').join('')+'<th>Weighted</th><th>Q4</th><th>Δ</th><th></th></tr></thead>'
   +'<tbody id="pbfBody">'+rowsHTML()+'</tbody></table></div>'
   +'<div class="card-foot"><span>Draft indices — subject to district verification</span><span class="mono" id="pbfCount">'+rowData().length+' of '+list().length+' centres</span></div></div>';
}
function matrix(){
  const rows=list().slice().sort((a,b)=>total(b)-total(a));
  return UI.card({title:'Domain heatmap',sub:'Where each centre loses points',icon:'layout-grid',body:
    '<div style="overflow-x:auto"><table class="pbf-heat"><thead><tr><th></th>'+DOMAINS.map(d=>'<th>'+U.esc(d[1].split(' ')[0])+'<span class="w">'+d[2]+'%</span></th>').join('')+'<th>Index</th></tr></thead><tbody>'
    +rows.map(r=>'<tr><td class="pbf-hc">'+U.esc(r.name)+'</td>'+DOMAINS.map(([k])=>{
        const v=r.scores[k];
        return '<td><span class="heat-tile" data-tip="'+U.esc(DOMAINS.find(d=>d[0]===k)[1]+' · '+v+'%')+'" style="--a:'+((v/100)*0.9+0.06).toFixed(2)+';--tone:'+(v>=S.PBF_MIN+5?'63,211,182':v>=S.PBF_MIN?'201,168,76':'227,114,124')+'">'+v+'</span></td>';
      }).join('')+'<td><b class="mono">'+total(r)+'</b></td></tr>').join('')
    +'</tbody></table></div><div class="card-foot"><span>Cell intensity maps the score; '+S.PBF_MIN+'% and above is green, below it red</span><span class="mono">6 domains</span></div>'});
}
function drawer(id){
  const r=list().find(x=>x.id===id); if(!r) return;
  const t=total(r), d=delta(r);
  UI.drawer({title:r.name,eyebrow:'PBF evaluation · Q1 FY 2026/2027',sub:'Assessed '+U.fmtDate(r.submitted)+' · '+U.esc(r.assessor||'District PBF team'),wide:true,body:
    '<div class="row gap-lg" style="align-items:center;margin-bottom:16px">'+C.ring(t,{size:104,stroke:8})
    +'<div><div class="row gap-sm"><span class="pill '+tone(t)+'">Index '+t+'%</span><span class="pill slate">Q4 baseline '+r.prior+'%</span><span class="delta '+(d<0?'down':'')+'">'+UI.ic(d>=0?'arrow-up':'arrow-down',10)+(d>0?'+':'')+d+' pts</span></div>'
    +'<div class="xs faint" style="margin-top:8px;max-width:320px">Weighted composite of six domains. Only fully evidenced indicators are counted; draft until the district verification meeting.</div></div></div>'
    +DOMAINS.map(([k,label,w])=>{ const v=r.scores[k]; const prev=U.clamp(r.prior-Math.round((1-v/100)*6),30,100);
      return '<div style="margin-bottom:14px"><div class="row between" style="margin-bottom:5px"><span class="small">'+U.esc(label)+' <span class="xs faint">· weight '+w+'%</span></span>'
      +'<span class="mono small" style="color:var(--'+(v>=S.PBF_MIN+5?'pos':v>=S.PBF_MIN?'gold-bright':'crit')+')">'+v+'%</span></div>'
      +UI.meter(v,v>=S.PBF_MIN+5?'teal':v>=S.PBF_MIN?'gold':'rose',prev)+'<div class="xs faint" style="margin-top:3px">Marker shows the Q4 position</div></div>'; }).join('')
    +'<div class="section-head"><h2>Verification</h2></div>'
    +'<div class="custody">'+[['Register reconciliation',U.addDays(r.submitted,-1),'Laboratory register cross-checked with the district HIS'],
      ['Stock card audit',U.addDays(r.submitted,-2),'Physical count matched to stock cards'],
      ['Staff interviews',r.submitted,'Competency and duty rosters sampled'],
      ['District verification','','Awaiting PBF team sign-off']].map(([ti,dt,note])=>
      '<div class="custody-item'+(dt?'':' pending')+'"><span class="custody-dot"></span><div class="custody-body"><div class="custody-title">'+U.esc(ti)+'</div><div class="custody-meta">'+(dt?U.fmtDate(dt)+' · ':'Pending · ')+U.esc(note)+'</div></div></div>').join('')+'</div>'
    +'<div class="section-head"><h2>Questions evaluated</h2><span class="more">'+(r.visit?Object.keys(r.visit.answers||{}).length+' of '+questions().length+' questions':'no visit recorded')+'</span></div>'
    +(r.visit?DOMAINS.map(([k,label])=>{
        const qs=questions().filter(q=>q.domain===k);
        return '<div style="margin-bottom:10px"><div class="eyebrow">'+U.esc(label)+'</div>'
          +qs.map(q=>{ const v=r.visit.answers&&r.visit.answers[q.id]; const pct=v==null?null:Math.round(+v/q.max*100); const ok=pct!=null&&pct>=S.PBF_MIN;
            return '<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">'+U.esc(r.visit.quarter)+' · max '+q.max+' marks</div></div><span class="pill '+(v==null?'slate':ok?'teal':+v>=q.max*0.5?'amber':'rose')+' mono">'+(v==null?'—':v+'/'+q.max+' · '+pct+'%')+'</span></div>';
          }).join('')+'</div>';
      }).join(''):'<p class="xs faint">No question-level visit has been logged for this centre yet.</p>')
    +'<div class="section-head"><h2>Visit history</h2><span class="more">'+(r.visits||0)+' visit'+(r.visits===1?'':'s')+'</span></div>'
    +(visitsFor(r.name).length?visitsFor(r.name).map(v=>'<div class="list-row" data-visit="'+v.id+'" style="cursor:pointer"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(v.quarter||'')+' · '+U.fmtDate(v.date)+'</div><div class="lr-sub">'+U.esc(v.assessor||'')+(v.note?' · '+U.esc(v.note):'')+'</div></div><span class="pill '+tone(visitTotal(v))+'">'+visitTotal(v)+'%</span></div>').join(''):'<p class="xs faint">No visits logged.</p>')
    +'<div class="hint" style="margin-top:12px">Scores are computed from the question marks of the latest visit. Adding a visit never overwrites an earlier one — the quarterly history stays intact.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit>'+UI.ic('sliders',15)+'Adjust scores</button><button class="btn" data-new-visit>'+UI.ic('plus',15)+'Record visit</button><button class="btn primary" data-print>'+UI.ic('printer',15)+'Print scorecard</button>',
    onMount:(panel,close)=>{
      panel.querySelector('[data-edit]').onclick=()=>{ close(); editScores(r); };
      panel.querySelector('[data-new-visit]').onclick=()=>{ close(); visitModal(null,r.name); };
      panel.querySelectorAll('[data-visit]').forEach(el=>el.onclick=()=>{ close(); visitModal(el.dataset.visit); });
      panel.querySelector('[data-print]').onclick=()=>printCentre(r);
    }});
}

/* ——— Seeded question-level visits from the aggregate Q1 scorecard ————— */
function ensureSeeded(){
  const db=S.db();
  if(db.meta&&db.meta.pbfVisitsSeeded){ ensureSchedule(); return; }
  const legacy=db.pbf||[]; if(!legacy.length){ db.meta.pbfVisitsSeeded=true; ensureSchedule(); return; }
  const qs=questions(); const visits=[];
  legacy.forEach(r=>{
    const answers={};
    qs.forEach(q=>{ const dom=+r.scores[q.domain]||70; const rnd=U.rng('pbfv-'+r.id+q.id);
      answers[q.id]=Math.round(q.max*U.clamp(dom/100+(rnd()-0.5)*0.16,0.2,1)); });
    visits.push({id:U.uid('pbfv'),hcName:r.name,quarter:r.quarter||'Q1',fy:r.fy||'2026/2027',
      date:r.submitted||U.todayISO(),assessor:r.assessor||'District PBF team',answers,
      note:'Imported from the Q1 aggregate scorecard',seeded:true});
  });
  S.commit(d=>{ d.pbfVisits=(d.pbfVisits||[]).concat(visits); d.meta.pbfVisitsSeeded=true; },
    {action:'pbf.visits.import',entity:'pbf',detail:legacy.length+' centres expanded to question-level visits'});
  ensureSchedule();
}
/* Every recorded visit settles the slot it was planned for; the district's plan
   for the quarter ahead is entered as scheduled, never as a result. */
function ensureSchedule(){
  const db=S.db();
  if(db.meta&&db.meta.pbfScheduleSeeded) return;
  db.meta.pbfScheduleSeeded=true;
  if((db.pbfSchedule||[]).length){ S.save(); return; }
  const slots=[];
  (db.pbfVisits||[]).forEach(v=>slots.push({id:U.uid('pbfs'),hcName:v.hcName,quarter:v.quarter||'Q1',fy:v.fy||U.fyLabel(),
    plannedDate:v.date,status:'visited',visitId:v.id,visitedAt:v.date,assessor:v.assessor||'District PBF team',seeded:true}));
  const latest=(db.pbfVisits||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  const nextQ=latest?(latest.quarter==='Q1'?'Q2':latest.quarter==='Q2'?'Q3':latest.quarter==='Q3'?'Q4':'Q1'):'Q2';
  const fy=latest?latest.fy||U.fyLabel():U.fyLabel();
  const plan=U.uniq((db.catalog.healthCenters||[]).map(h=>h.name)).slice(0,6);
  plan.forEach((name,i)=>slots.push({id:U.uid('pbfs'),hcName:name,quarter:nextQ,fy,
    plannedDate:U.addDays(U.todayISO(),14+i*7),status:'scheduled',assessor:'District PBF team',seeded:true}));
  S.commit(d=>{ d.pbfSchedule=slots; },{action:'pbf.schedule.seed',entity:'pbf',
    detail:slots.length+' visit slots · '+nextQ+' '+fy+' plan entered'});
}
function visitModal(id,presetCentre,presetQuarter){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const v=id?(db.pbfVisits||[]).find(x=>x.id===id):null;
  const centres=U.uniq(db.catalog.healthCenters.map(h=>h.name).concat((db.pbf||[]).map(r=>r.name)));
  const qs=questions();
  const answers=v?(v.answers||{}):{};
  const section=k=>qs.filter(q=>q.domain===k).map(q=>{
    const val=answers[q.id];
    return '<div class="row between gap-sm" style="padding:5px 0;border-bottom:1px solid var(--border)"><span class="small grow" style="max-width:74%">'+U.esc(q.text)+'</span>'
      +'<span class="row gap-sm"><input class="input mono" data-q="'+q.id+'" type="number" min="0" max="'+q.max+'" step="1" value="'+(val==null?'':val)+'" style="width:64px" placeholder="—"><span class="xs faint">/'+q.max+'</span><span class="pill slate mono" data-qpct="'+q.id+'">'+(val==null?'—':Math.round(val/q.max*100)+'%')+'</span></span></div>';
  }).join('');
  UI.modal({title:v?'Edit PBF visit':'Record PBF visit',sub:'Marks per question · the centre keeps every visit, so quarterly progress is visible.',width:'min(780px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Health centre</label><select class="select" id="pvCentre">'+centres.map(c=>'<option'+((v?v.hcName===c:presetCentre===c)?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Quarter</label><input class="input mono" id="pvQuarter" value="'+U.esc(v?v.quarter:(presetQuarter||'Q1'))+'"></div>'
      +'<div class="field"><label>Visit date</label><input class="input" type="date" id="pvDate" value="'+(v?String(v.date).slice(0,10):U.todayISO())+'"></div>'
      +'<div class="field"><label>Assessor</label><input class="input" id="pvAssessor" value="'+U.esc(v?v.assessor:LS.auth.user.name)+'"></div>'
      +'<div class="field span2"><label>Marks — every question evaluated at this visit</label>'
        +DOMAINS.map(([k,label])=>'<div style="margin-top:8px"><div class="eyebrow">'+U.esc(label)+'</div>'+section(k)+'</div>').join('')
        +'<div class="xs faint" style="margin-top:8px">Leave a question blank if it was not assessed — blanks are excluded from the domain percentage instead of scoring zero.</div>'
        +'<div class="row gap-sm" style="margin-top:8px"><span class="pill gold" id="pvPreview">Preview</span><button class="btn xs" data-all-max>'+UI.ic('check-check',12)+'Mark all full</button></div>'
      +'</div>'
      +'<div class="field span2"><label>Visit note</label><input class="input" id="pvNote" value="'+U.esc(v?v.note||'':'')+'" placeholder="Observed gaps, agreements reached with the in-charge"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+(v?'Save visit':'Save visit')+'</button>',
    onMount:(el,close)=>{
      const inputs=()=>Array.from(el.querySelectorAll('[data-q]'));
      const currentAnswers=()=>{ const a={}; inputs().forEach(i=>{ if(i.value!=='') a[i.dataset.q]=U.clamp(+i.value,0,+(i.max||5)); }); return a; };
      const preview=()=>{ const a=currentAnswers(); const sc=visitScore({answers:a});
        el.querySelector('#pvPreview').textContent='Index '+total({scores:sc})+'%'; };
      const pct=i=>{ const cell=el.querySelector('[data-qpct="'+i.dataset.q+'"]'); if(!cell) return;
        const q=qById(i.dataset.q); const m=q?+q.max:Q_MAX_DEFAULT;
        cell.textContent = i.value===''?'—':Math.round(U.clamp(+i.value,0,m)/m*100)+'%'; };
      inputs().forEach(i=>{ i.addEventListener('input',()=>{ pct(i); preview(); }); pct(i); });
      preview();
      el.querySelector('[data-all-max]').onclick=()=>{ inputs().forEach(i=>{ const q=qById(i.dataset.q); i.value=q?q.max:5; }); preview(); };
      el.querySelector('[data-save]').onclick=()=>{
        const hcName=el.querySelector('#pvCentre').value;
        const answers=currentAnswers();
        if(!Object.keys(answers).length) return UI.toast('Enter at least one question mark',{type:'warn'});
        const rec={hcName,quarter:el.querySelector('#pvQuarter').value.trim()||'Q1',fy:U.fyLabel(),
          date:el.querySelector('#pvDate').value,assessor:el.querySelector('#pvAssessor').value.trim(),
          answers,note:el.querySelector('#pvNote').value.trim()};
        const vid=v?v.id:U.uid('pbfv');
        S.commit(d=>{
          d.pbfVisits=d.pbfVisits||[];
          if(v){ const x=d.pbfVisits.find(y=>y.id===v.id); if(x) Object.assign(x,rec); }
          else d.pbfVisits.unshift(Object.assign({id:vid},rec));
          /* The visit settles its scheduled slot — the quarter stops reading
             "not yet visited" the moment the marks are recorded. */
          d.pbfSchedule=d.pbfSchedule||[];
          const slot=d.pbfSchedule.find(x=>x.hcName===hcName && x.quarter===rec.quarter);
          if(slot){ slot.status='visited'; slot.visitId=vid; slot.visitedAt=rec.date; }
          else d.pbfSchedule.push({id:U.uid('pbfs'),hcName,quarter:rec.quarter,fy:rec.fy,plannedDate:rec.date,status:'visited',visitId:vid,visitedAt:rec.date,assessor:rec.assessor});
        },{action:'pbf.visit.'+(v?'edit':'add'),entity:'pbf',entityId:v?v.id:hcName,detail:hcName+' · '+rec.quarter+' · index '+total({scores:visitScore({answers})})+'%'});
        close(); LS.shell.refresh(); UI.toast('Visit saved · question marks stored',{type:'ok'});
      };
    }});
}
function questionModal(id){
  if(!LS.auth.guard('edit')) return;
  const q=id?qById(id):null;
  UI.modal({title:q?'Edit question':'Add evaluation question',sub:'Questions are grouped by domain; the domain weight is applied automatically.',width:'min(560px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Question</label><textarea class="textarea" id="qbText" rows="2">'+U.esc(q?q.text:'')+'</textarea></div>'
      +'<div class="field"><label>Domain</label><select class="select" id="qbDomain">'+DOMAINS.map(([k,label,w])=>'<option value="'+k+'"'+((q?q.domain:'quality')===k?' selected':'')+'>'+U.esc(label)+' ('+w+'%)</option>').join('')+'</select></div>'
      +'<div class="field"><label>Maximum marks</label><input class="input mono" type="number" min="1" max="100" id="qbMax" value="'+(q?q.max:Q_MAX_DEFAULT)+'"></div></div>'
      +'<div class="hint" style="margin-top:10px">Each question carries its own maximum (25 by default). The domain score is the marks earned over the marks available, so questions of different weight can sit side by side.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save question</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const text=el.querySelector('#qbText').value.trim();
        if(!text) return UI.toast('Question text required',{type:'warn'});
        const rec={domain:el.querySelector('#qbDomain').value,text,max:U.clamp(parseInt(el.querySelector('#qbMax').value,10)||Q_MAX_DEFAULT,1,100),active:true};
        S.commit(d=>{ d.pbfQuestions=d.pbfQuestions||questions().slice();
          if(q){ const i=d.pbfQuestions.findIndex(x=>x.id===q.id); if(i>=0) d.pbfQuestions[i]=Object.assign({},d.pbfQuestions[i],rec); }
          else d.pbfQuestions.push(Object.assign({id:U.uid('q')},rec)); },
          {action:'pbf.question.'+(q?'edit':'add'),entity:'pbf',detail:rec.text.slice(0,80)});
        close(); LS.shell.refresh(); UI.toast('Question bank updated',{type:'ok'});
      };
    }});
}
async function deleteQuestion(id){
  const q=qById(id); if(!q) return;
  if(!LS.auth.guard('edit')) return;
  const answered=(S.db().pbfVisits||[]).filter(v=>v.answers&&v.answers[q.id]!=null).length;
  const ok=await UI.confirm({title:'Delete this question?',
    body:'“'+q.text+'” leaves the question bank and stops counting towards the domain percentage.'+(answered?' Marks already recorded on '+answered+' visit'+(answered===1?'':'s')+' are kept for audit and can be restored.':''),
    confirm:'Delete question',danger:true});
  if(!ok) return;
  S.commit(d=>{ const x=(d.pbfQuestions||[]).find(y=>y.id===id);
    if(x){ x.deleted=true; x.deletedAt=U.nowISO(); x.deletedBy=LS.auth.user.name; x.answerHistory=answered; } },
    {action:'pbf.question.delete',entity:'pbf',entityId:id,detail:q.text.slice(0,80)});
  LS.shell.refresh(); UI.toast('Question deleted',{type:'ok'});
}
function restoreQuestion(id){
  const q=(S.db().pbfQuestions||[]).find(x=>x.id===id); if(!q) return;
  S.commit(d=>{ const x=(d.pbfQuestions||[]).find(y=>y.id===id);
    if(x){ delete x.deleted; delete x.deletedAt; delete x.deletedBy; x.active=true; } },
    {action:'pbf.question.restore',entity:'pbf',entityId:id,detail:q.text.slice(0,80)});
  LS.shell.refresh(); UI.toast('Question restored',{type:'ok'});
}
function questionBank(){
  const qs=questions();
  return UI.card({title:'Question bank',sub:'What is evaluated on every quarterly visit · '+qs.length+' questions',icon:'list-checks',
    tools:'<button class="btn xs" data-add-q>'+UI.ic('plus',12)+'Add question</button>',
    body:DOMAINS.map(([k,label,w])=>{ const group=qs.filter(q=>q.domain===k);
      return '<div style="margin-bottom:10px"><div class="row between"><span class="eyebrow">'+U.esc(label)+' <span class="faint">· '+w+'% of index</span></span><span class="xs faint">'+group.length+' questions</span></div>'
        +group.map(q=>'<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">max '+q.max+' marks · '+Math.round(q.max/group.reduce((a,x)=>a+(+x.max||0),0)*100)+'% of the domain</div></div>'
          +'<div class="row gap-sm"><button class="icon-btn" style="width:24px;height:24px" data-edit-q="'+q.id+'" title="Edit">'+UI.ic('pencil',12)+'</button>'
          +'<button class="icon-btn" style="width:24px;height:24px" data-del-q="'+q.id+'" title="Delete question">'+UI.ic('trash-2',12)+'</button></div></div>').join('')
        +'</div>';
    }).join('')
    +(retiredQuestions().length?'<div class="row between" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px"><span class="xs faint">'+retiredQuestions().length+' deleted question'+(retiredQuestions().length===1?'':'s')+' · not scored</span><span class="row gap-sm">'+retiredQuestions().map(q=>'<button class="btn xs" data-restore-q="'+q.id+'">'+UI.ic('rotate-ccw',11)+U.esc(q.text.slice(0,18))+(q.text.length>18?'…':'')+'</button>').join('')+'</span></div>':'')
    });
}
/* ——— Scheduling ————————————————————————————————— */
function scheduleModal(id){
  if(!LS.auth.guard('edit')) return;
  const sc=id?schedule().find(x=>x.id===id):null;
  const q=activeQuarter();
  const centres=U.uniq(S.db().catalog.healthCenters.map(h=>h.name).concat((S.db().pbf||[]).map(r=>r.name)));
  UI.modal({title:sc?'Edit scheduled visit':'Schedule a quarterly visit',
    sub:'A scheduled visit can be planned at any point while the quarter is open — including today.',width:'min(560px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field span2"><label>Health centre</label><select class="select" id="psCentre">'+centres.map(c=>'<option'+(sc&&sc.hcName===c?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Quarter</label><select class="select" id="psQuarter">'+['Q1','Q2','Q3','Q4'].map(x=>'<option'+(x===(sc?sc.quarter:q.quarter)?' selected':'')+'>'+x+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Fiscal year</label><input class="input mono" id="psFy" value="'+U.esc(sc?sc.fy:q.fy)+'"></div>'
      +'<div class="field"><label>Planned visit date</label><input class="input" type="date" id="psDate" value="'+(sc?String(sc.plannedDate).slice(0,10):U.todayISO())+'"></div>'
      +'<div class="field"><label>Assessor (optional)</label><input class="input" id="psAssessor" value="'+U.esc(sc?sc.assessor||'':'')+'" placeholder="District PBF team"></div>'
      +'<div class="field span2"><label>Note</label><input class="input" id="psNote" value="'+U.esc(sc?sc.note||'':'')+'" placeholder="Agreed with the in-charge at the last visit"></div></div>'
      +'<div class="hint" style="margin-top:10px">Until the visit is recorded the centre reads “not yet visited”. It only reads “not visited” if you confirm that separately, after the quarter closes.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save schedule</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const rec={hcName:el.querySelector('#psCentre').value,quarter:el.querySelector('#psQuarter').value,
          fy:el.querySelector('#psFy').value.trim()||q.fy,plannedDate:el.querySelector('#psDate').value,
          assessor:el.querySelector('#psAssessor').value.trim(),note:el.querySelector('#psNote').value.trim()};
        if(!rec.plannedDate) return UI.toast('Pick a planned date',{type:'warn'});
        S.commit(d=>{ d.pbfSchedule=d.pbfSchedule||[];
          if(sc){ const x=d.pbfSchedule.find(y=>y.id===sc.id); if(x) Object.assign(x,rec); }
          else d.pbfSchedule.push(Object.assign({id:U.uid('pbfs'),status:'scheduled'},rec));
        },{action:'pbf.schedule.'+(sc?'edit':'add'),entity:'pbf',entityId:sc?sc.id:rec.hcName,detail:rec.hcName+' · '+rec.quarter+' · '+rec.plannedDate});
        close(); LS.shell.refresh(); UI.toast('Visit scheduled · '+rec.hcName,{type:'ok'});
      };
    }});
}
async function confirmNotVisited(id){
  const sc=schedule().find(x=>x.id===id); if(!sc) return;
  if(!LS.auth.guard('edit')) return;
  const ok=await UI.confirm({title:'Confirm '+sc.hcName+' was not visited?',
    body:'Only confirm this once '+sc.quarter+' '+sc.fy+' has closed without a visit. While the quarter is open the centre stays “not yet visited”.',
    confirm:'Confirm not visited',danger:true});
  if(!ok) return;
  S.commit(d=>{ const x=(d.pbfSchedule||[]).find(y=>y.id===id);
    if(x){ x.status='notVisited'; x.confirmedAt=U.nowISO(); x.confirmedBy=LS.auth.user.name; } },
    {action:'pbf.schedule.not_visited',entity:'pbf',entityId:id,detail:sc.hcName+' · '+sc.quarter+' '+sc.fy});
  LS.shell.refresh(); UI.toast('Recorded as not visited · '+sc.hcName,{type:'ok'});
}
function undoNotVisited(id){
  const sc=schedule().find(x=>x.id===id); if(!sc) return;
  S.commit(d=>{ const x=(d.pbfSchedule||[]).find(y=>y.id===id);
    if(x){ x.status='scheduled'; delete x.confirmedAt; delete x.confirmedBy; } },
    {action:'pbf.schedule.undo',entity:'pbf',entityId:id,detail:sc.hcName+' back to scheduled'});
  LS.shell.refresh(); UI.toast('Back to scheduled',{type:'info'});
}
function scheduleCard(){
  const rows=schedule().slice().sort((a,b)=>String(a.quarter||'').localeCompare(String(b.quarter||''))||String(a.plannedDate||'').localeCompare(String(b.plannedDate||'')));
  const pending=rows.filter(r=>r.status==='scheduled').length;
  return UI.card({title:'Visit schedule',sub:'Quarter by quarter · a planned visit can be entered while the quarter is open',icon:'calendar-clock',
    tools:'<button class="btn xs" data-schedule>'+UI.ic('plus',12)+'Schedule visit</button>',
    body:rows.length?'<div class="dt-scroll" style="max-height:320px"><table class="dt"><thead><tr><th>Health centre</th><th>Quarter</th><th>Planned</th><th>State</th><th></th></tr></thead><tbody>'
      +rows.map(sc=>{
        const st=sc.status==='visited'?{label:'Visited',pill:'teal'}
          :sc.status==='notVisited'?{label:'Not visited',pill:'rose'}
          :{label:quarterOpen(sc)?'Not yet visited':'Awaiting record',pill:quarterOpen(sc)?'blue':'amber'};
        const act=sc.status==='visited'?'<span class="xs faint">'+U.fmtDate(sc.visitedAt||sc.plannedDate)+'</span>'
          :sc.status==='notVisited'?'<button class="btn xs" data-sched-undo="'+sc.id+'">Undo</button>'
          :'<button class="btn xs" data-sched-visit="'+sc.id+'">Record</button> <button class="btn xs" data-sched-confirm="'+sc.id+'">Not visited</button>';
        return '<tr><td class="strong">'+U.esc(sc.hcName)+'<div class="xs faint">'+U.esc(sc.assessor||'District PBF team')+'</div></td>'
          +'<td class="mono xs">'+U.esc(sc.quarter||'—')+'<div class="xs faint">'+U.esc(sc.fy||'')+'</div></td>'
          +'<td class="num mono xs">'+U.fmtDate(sc.plannedDate)+'</td><td><span class="pill '+st.pill+'">'+st.label+'</span></td>'
          +'<td class="num">'+act+'</td></tr>';
      }).join('')+'</tbody></table></div>'
      :'<p class="xs faint" style="margin:0">Nothing planned yet. Add the quarter’s visits and each centre reads “not yet visited” until the visit happens — never “missed”.</p>',
    foot:'<span>“Not visited” is only ever confirmed by you, after the quarter closes.</span><span class="mono">'+pending+' pending</span>'});
}
function visitLog(){
  const visits=(S.db().pbfVisits||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return UI.card({title:'Quarterly visits',sub:'Every visit is kept — a centre’s marks accumulate over time',icon:'calendar-check',
    tools:'<button class="btn xs" data-new-visit>'+UI.ic('plus',12)+'Record visit</button>',
    body:visits.length?'<div class="dt-scroll" style="max-height:420px"><table class="dt"><thead><tr><th>Health centre</th><th>Quarter</th><th>Visit date</th><th>Assessor</th><th>Index</th><th></th></tr></thead><tbody>'
      +visits.map(v=>'<tr data-open-visit="'+v.id+'" style="cursor:pointer"><td class="strong">'+U.esc(v.hcName)+'</td><td class="mono xs">'+U.esc(v.quarter||'—')+'</td><td class="num">'+U.fmtDate(v.date)+'</td>'
        +'<td class="small">'+U.esc(v.assessor||'—')+'</td><td><span class="pill '+tone(visitTotal(v))+'">'+visitTotal(v)+'%</span></td>'
        +'<td><button class="icon-btn" style="width:26px;height:26px" data-open-visit="'+v.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>').join('')
      +'</tbody></table></div>':'<p class="xs faint">No visits recorded yet.</p>',
    foot:'<span>Visits are quarterly; the latest visit drives the index shown above.</span><span class="mono">'+visits.length+' visits</span>'});
}
function editScores(r){
  if(!LS.auth.guard('edit')) return;
  UI.modal({title:'Adjust evaluation scores',sub:r.name+' · weights apply automatically',width:'min(560px,100%)',
    body:'<div style="display:flex;flex-direction:column;gap:12px">'+DOMAINS.map(([k,label,w])=>
      '<div class="row between gap-sm"><span class="small grow">'+U.esc(label)+' <span class="xs faint">·'+w+'%</span></span>'
      +'<input type="number" min="0" max="100" class="input" style="width:76px" data-sc="'+k+'" value="'+r.scores[k]+'"></div>').join('')
      +'</div><div class="hint" style="margin-top:12px">Total is recalculated live when you save.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save draft</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const next={}; U.$$('[data-sc]',el).forEach(inp=>{ next[inp.dataset.sc]=U.clamp(+inp.value||0,0,100); });
        S.commit(d=>{ const x=(d.pbf||[]).find(y=>y.id===r.id); if(x){ x.scores=next; x.draft=true; x.status='draft'; } },
          {action:'pbf.edit',entity:'pbf',entityId:r.id,detail:'Scores adjusted for '+r.name});
        close(); LS.shell.refresh(); UI.toast('Draft index updated · '+total({scores:next})+'%',{type:'ok'});
      };
    }});
}
function printCentre(r){
  U.printDoc('PBF laboratory evaluation — '+r.name,
    '<table><thead><tr><th>Domain</th><th>Weight</th><th>Score</th><th>Weighted</th><th>Q4</th></tr></thead><tbody>'
    +DOMAINS.map(([k,label,w])=>'<tr><td>'+U.esc(label)+'</td><td>'+w+'%</td><td>'+r.scores[k]+'%</td><td>'+(r.scores[k]*w/100).toFixed(1)+'</td><td style="color:#666">'+(r.prior-3)+'%</td></tr>').join('')
    +'<tr><td colspan="2"><b>Weighted composite</b></td><td colspan="2"><b>'+total(r)+'%</b></td><td>'+r.prior+'%</td></tr></tbody></table>'
    +(r.visit?'<h3 style="font-size:9px;margin:10px 0 4px">Questions evaluated — '+U.esc(r.visit.quarter)+' · '+U.fmtDate(r.visit.date)+'</h3><table><thead><tr><th>Question</th><th>Domain</th><th>Marks</th></tr></thead><tbody>'
      +questions().map(q=>{ const v=r.visit.answers&&r.visit.answers[q.id]; const dom=DOMAINS.find(d=>d[0]===q.domain);
        return '<tr><td>'+U.esc(q.text)+'</td><td>'+U.esc(dom?dom[1]:q.domain)+'</td><td style="text-align:center">'+(v==null?'—':v+' / '+q.max)+'</td></tr>'; }).join('')
      +'</tbody></table>':'')
    +'<h3 style="font-size:9px;margin:10px 0 4px">Visit history</h3><table><thead><tr><th>Quarter</th><th>Date</th><th>Assessor</th><th>Index</th></tr></thead><tbody>'
    +(visitsFor(r.name).length?visitsFor(r.name).map(v=>'<tr><td>'+U.esc(v.quarter||'')+'</td><td>'+U.fmtDate(v.date)+'</td><td>'+U.esc(v.assessor||'')+'</td><td>'+visitTotal(v)+'%</td></tr>').join(''):'<tr><td colspan="4">No visits recorded</td></tr>')
    +'</tbody></table>',
    {meta:'<span>Assessed '+U.fmtDate(r.submitted)+'</span><span>'+U.esc(r.assessor||'District PBF team')+'</span>'});
}
function printDistrict(){
  const rows=list().slice().sort((a,b)=>total(b)-total(a));
  U.printDoc('District PBF laboratory report — Q1 FY 2026/2027',
    '<table><thead><tr><th>Rank</th><th>Health centre</th>'+DOMAINS.map(d=>'<th>'+U.esc(d[1].split(' ')[0])+'</th>').join('')+'<th>Index</th><th>Q4</th><th>Δ</th></tr></thead><tbody>'
    +rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(r.name)+'</td>'+DOMAINS.map(([k])=>'<td>'+r.scores[k]+'</td>').join('')+'<td><b>'+total(r)+'</b></td><td>'+r.prior+'</td><td>'+(delta(r)>0?'+':'')+delta(r)+'</td></tr>').join('')
    +'<tr><td colspan="2"><b>District average</b></td>'+DOMAINS.map(([k])=>'<td>'+Math.round(U.avg(rows.map(r=>r.scores[k])))+'</td>').join('')+'<td><b>'+Math.round(U.avg(rows.map(total)))+'</b></td><td></td><td></td></tr></tbody></table>',
    {landscape:true,meta:'<span>Gakenke District · PBF laboratory indicators</span><span>Draft — pending district verification</span>'});
}
M.render=function(root,params){
  rootEl=root; sort=params.sort||'total'; q=params.q||'';
  ensureSeeded();
  root.innerHTML='<div class="page-head"><div><h1>PBF evaluation</h1><div class="sub">Performance-based financing, scored on the same records the bench works from — quality, TAT, commodity security, data, staffing and infrastructure.</div></div>'
   +'<div class="actions"><a class="btn" href="#/quality">'+UI.ic('shield-check',15)+' ISO readiness</a><button class="btn" data-district>'+UI.ic('printer',15)+' District report</button><button class="btn primary" data-new-visit>'+UI.ic('plus',15)+' Record visit</button></div></div>'
   +kpis()+hero()
   +'<div class="section-head"><h2>Centre scorecards</h2><span class="more">Click any row for the full evaluation</span></div>'
   +table()
   +'<div class="section-head"><h2>Domain comparison</h2><span class="more">Six weighted domains · '+list().length+' centres</span></div>'
   +matrix()
   +'<div class="section-head"><h2>Evaluation questions & visits</h2><span class="more">Question-level marks, kept quarter after quarter</span></div>'
   +'<div class="grid-12"><div class="c7">'+questionBank()+'</div><div class="c5">'+scheduleCard()+'<div style="margin-top:14px">'+visitLog()+'</div></div></div>';

  const open=id=>drawer(id);
  function paintRows(){
    const b=root.querySelector('#pbfBody'); if(!b) return;
    b.innerHTML=rowsHTML();
    b.querySelectorAll('[data-pbf-row],[data-open]').forEach(el=>el.onclick=ev=>{ ev.stopPropagation(); open(el.dataset.pbfRow||el.dataset.open); });
    const c=root.querySelector('#pbfCount'); if(c) c.textContent=rowData().length+' of '+list().length+' centres';
  }
  paintRows();
  const s=root.querySelector('#pbfSearch');
  if(s) s.addEventListener('input',()=>{ q=s.value.toLowerCase().trim(); paintRows(); });
  root.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{
    sort=b.dataset.sort;
    root.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('on',x.dataset.sort===sort));
    paintRows();
  });
  root.querySelectorAll('[data-pbf]').forEach(el=>el.onclick=()=>open(el.dataset.pbf));
  root.querySelector('[data-district]').onclick=printDistrict;
  root.querySelectorAll('[data-new-visit]').forEach(b=>b.onclick=()=>visitModal(null));
  root.querySelectorAll('[data-add-q]').forEach(b=>b.onclick=()=>questionModal(null));
  root.querySelectorAll('[data-edit-q]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); questionModal(b.dataset.editQ); });
  root.querySelectorAll('[data-open-visit]').forEach(el=>el.onclick=ev=>{ ev.stopPropagation(); visitModal(el.dataset.openVisit); });
  root.querySelectorAll('[data-schedule]').forEach(b=>b.onclick=()=>scheduleModal(null));
  root.querySelectorAll('[data-sched-visit]').forEach(b=>b.onclick=()=>{ const sc=schedule().find(x=>x.id===b.dataset.schedVisit); visitModal(null, sc?sc.hcName:null, sc?sc.quarter:null); });
  root.querySelectorAll('[data-sched-confirm]').forEach(b=>b.onclick=()=>confirmNotVisited(b.dataset.schedConfirm));
  root.querySelectorAll('[data-sched-undo]').forEach(b=>b.onclick=()=>undoNotVisited(b.dataset.schedUndo));
  root.querySelectorAll('[data-del-q]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); deleteQuestion(b.dataset.delQ); });
  root.querySelectorAll('[data-restore-q]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); restoreQuestion(b.dataset.restoreQ); });
};
})();
