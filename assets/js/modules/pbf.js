/* ============================================================================
   MODULE · PBF EVALUATION — performance-based financing for health centres
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.pbf=M;
let rootEl=null, sort='total', q='';
/* Domains are data, not constants: the district decides how many there are, what
   they are called and how they should read on the report. They live in
   db.pbfDomains so a domain can be renamed, re-weighted, added or removed without
   a code change, and every question is allocated to one of them by hand. */
const SEED_DOMAINS=[
  {key:'quality',label:'Quality management',weight:20},
  {key:'tat',label:'Turnaround & referral',weight:20},
  {key:'stock',label:'Commodity security',weight:15},
  {key:'data',label:'Data quality & reporting',weight:15},
  {key:'hr',label:'Staffing & competency',weight:15},
  {key:'infra',label:'Infrastructure & safety',weight:15}
];
function domains(){
  const db=S.db();
  if(!db.pbfDomains||!db.pbfDomains.length) db.pbfDomains=SEED_DOMAINS.map(d=>Object.assign({},d));
  return db.pbfDomains;
}
function domainById(k){ return domains().find(d=>d.key===k); }
function domainLabel(k){ const d=domainById(k); return d?d.label:k; }
/* The percentage is printed inside the index chart, not only in the tooltip. */
function bandColor(v){
  return v==null?'var(--text-faint)':v>=90?'var(--idx-g2)':v>=80?'var(--idx-g1)':v>=75?'var(--idx-r1)':'var(--idx-r2)';
}
/* ——— Assessors ————————————————————————————————
   The district PBF assessor is the person using the console (Kelvin by default);
   any other lab staff member can be picked from the roster, or typed in once and
   kept. Compliance is measured against the date the visit was planned for. */
function assessorNames(){
  const db=S.db();
  const out=[LS.auth.user.name||'Kelvin'];
  (S.activeStaff?S.activeStaff():[]).forEach(p=>{ if(p.name) out.push(p.name); });
  (db.pbfAssessors||[]).forEach(n=>out.push(n));
  schedule().forEach(sc=>{ if(sc.assessor && !/district pbf team/i.test(sc.assessor)) out.push(sc.assessor); });
  (db.pbfVisits||[]).forEach(v=>{ if(v.assessor) out.push(v.assessor); });
  return U.uniq(out.filter(Boolean));
}
function addAssessor(name){
  name=String(name||'').trim(); if(!name) return;
  if(assessorNames().indexOf(name)>=0) return;
  S.commit(d=>{ d.pbfAssessors=d.pbfAssessors||[]; if(d.pbfAssessors.indexOf(name)<0) d.pbfAssessors.push(name); },
    {action:'pbf.assessor.add',entity:'pbf',detail:name});
}
/* Planned vs actual. A slot is compliant when the visit happened on or before the
   planned date; late by n days otherwise; missed when the planned date has passed
   with no visit and no explicit “not visited” confirmation to excuse it. */
function slotCompliance(sc){
  const visits=(S.db().pbfVisits||[]).filter(v=>v.hcName===sc.hcName && (!sc.quarter || v.quarter===sc.quarter));
  const visit=sc.visitId?visits.find(v=>v.id===sc.visitId):null;
  const actual=visit?String(visit.date).slice(0,10):(sc.visitedAt?String(sc.visitedAt).slice(0,10):null);
  const planned=sc.plannedDate?String(sc.plannedDate).slice(0,10):null;
  const assessor=visit?(visit.assessor||sc.assessor||''):(sc.assessor||'');
  if(actual&&planned){
    const late=Math.round((new Date(actual)-new Date(planned))/86400000);
    return {state:late<=0?'onTime':'late',late:Math.max(0,late),planned,actual,assessor,sc,visit};
  }
  if(actual) return {state:'onTime',late:0,planned,actual,assessor,sc,visit};
  if(sc.status==='notVisited') return {state:'excused',late:0,planned,actual:null,assessor,sc,visit};
  if(planned && planned<U.todayISO()) return {state:'missed',late:0,planned,actual:null,assessor,sc,visit};
  return {state:'upcoming',late:0,planned,actual:null,assessor,sc,visit};
}
function complianceSummary(){
  const all=schedule().map(slotCompliance);
  const done=all.filter(x=>x.state==='onTime'||x.state==='late');
  const onTime=all.filter(x=>x.state==='onTime').length;
  const late=all.filter(x=>x.state==='late').length;
  const missed=all.filter(x=>x.state==='missed').length;
  const upcoming=all.filter(x=>x.state==='upcoming').length;
  const excused=all.filter(x=>x.state==='excused').length;
  const pct=done.length?Math.round(onTime/done.length*100):null;
  const by={};
  all.forEach(x=>{ const k=x.assessor||'Unassigned'; const b=by[k]=by[k]||{name:k,onTime:0,late:0,missed:0,upcoming:0,excused:0,done:0,lateDays:0};
    b[x.state]++; if(x.state==='onTime'||x.state==='late'){ b.done++; b.lateDays+=x.late; } });
  const people=Object.keys(by).map(k=>{ const b=by[k]; b.pct=b.done?Math.round(b.onTime/b.done*100):null; return b; })
    .sort((a,b)=>(b.done-a.done)||((b.pct==null?-1:b.pct)-(a.pct==null?-1:a.pct)));
  return {all,onTime,late,missed,upcoming,excused,pct,done:done.length,people};
}


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
function domainQuestions(k){ return questions().filter(q=>q.domain===k); }

/* ——— Domains, weights and percentages ————————————————
   A domain exists only while it holds questions. A domain whose questions have
   all been deleted disappears from the scorecard, the heatmap and every report,
   and its weight is shared out across the domains that remain — so the columns
   on screen are always exactly the domains that are being scored. */
function liveDomains(){ return domains().filter(d=>domainQuestions(d.key).length>0); }
/* Weights are printed as whole percentages that add up to exactly 100 (largest
   remainder), so the header of a scorecard can never read 29+29+21+22 = 101. */
function domainWeights(){
  const live=liveDomains();
  const declared=U.sum(live,d=>+d.weight||0)||1;
  const raw=live.map(d=>({k:d.key,pct:(+d.weight||0)/declared*100}));
  const out={};
  domains().forEach(d=>{ out[d.key]=0; });
  if(!raw.length) return out;
  const floors=raw.map(x=>({k:x.k,base:Math.floor(x.pct),rem:x.pct-Math.floor(x.pct)}));
  let left=Math.round(raw.reduce((a,x)=>a+x.pct,0))-floors.reduce((a,x)=>a+x.base,0);
  floors.slice().sort((a,b)=>b.rem-a.rem).forEach(x=>{ if(left>0){ x.base++; left--; } });
  floors.forEach(x=>{ out[x.k]=x.base; });
  return out;
}
/* The same weights, unrounded — used for the arithmetic, never for display. */
function rawWeights(){
  const live=liveDomains(); const declared=U.sum(live,d=>+d.weight||0)||1; const out={};
  domains().forEach(d=>{ out[d.key]=0; });
  live.forEach(d=>{ out[d.key]=(+d.weight||0)/declared; });
  return out;
}
/* How much of the index a domain is actually worth, stated in marks rather than in
   the report weights: the share of all available marks that sits in that domain. */
function domainMarks(k){
  const qs=domainQuestions(k);
  return {count:qs.length, max:U.sum(qs,q=>+q.max||0)};
}
function declaredWeightTotal(){ return U.sum(domains(),d=>+d.weight||0); }
function scorecardOf(visit){
  const qs=questions();
  const answered=qs.filter(q=>visit&&visit.answers&&visit.answers[q.id]!=null&&visit.answers[q.id]!=='').length;
  return {answered, total:qs.length, complete:qs.length>0&&answered===qs.length, missing:qs.filter(q=>!(visit&&visit.answers&&visit.answers[q.id]!=null&&visit.answers[q.id]!==''))};
}
/* ——— Marks, domain percentages and the index ————————————————
   Every question is marked out of its own maximum (25 by default), so 25/25 is
   100 % of that question. A domain's percentage is its own marks earned over its
   own marks available — a health centre can score 60 % on a domain without that
   domain being worth 60 % of anything. The index is the whole scorecard's marks
   earned over the marks available, converted to 100. The domain weights are the
   wording of the report; they never move the index. */
function domainMarksFor(visit,k){
  const qs=domainQuestions(k);
  let got=0,max=0,answered=0;
  qs.forEach(q=>{
    max+=+q.max||0;
    const v=visit&&visit.answers?visit.answers[q.id]:null;
    if(v==null||v==='') return;
    answered++; got+=U.clamp(+v,0,+q.max||0);
  });
  return {got,max,answered,count:qs.length,complete:qs.length>0&&answered===qs.length,
    pct:max?Math.round(got/max*100):null};
}
function visitScore(visit){
  const scores={};
  domains().forEach(d=>{ const m=domainMarksFor(visit,d.key); scores[d.key]=m.complete?m.pct:null; });
  return scores;
}
/* The index: marks earned across every question in use, out of the marks those
   questions are worth, ×100. No weights, no renormalising. */
function visitMarks(visit){
  const qs=questions();
  let got=0,max=0,answered=0;
  qs.forEach(q=>{
    max+=+q.max||0;
    const v=visit&&visit.answers?visit.answers[q.id]:null;
    if(v==null||v==='') return;
    answered++; got+=U.clamp(+v,0,+q.max||0);
  });
  return {got,max,answered,total:qs.length,complete:qs.length>0&&answered===qs.length,
    pct:max?Math.round(got/max*100):null};
}
function visitTotal(v){ const m=visitMarks(v); return m.complete?m.pct:null; }
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
  if(last){
    const card=scorecardOf(last);
    if(card.complete) return {key:'visited',label:'Visited',detail:U.fmtDate(last.date)+' · '+(last.quarter||''),pill:'teal',schedule:sc,visit:last};
    return {key:'pending',label:'Visited',detail:'marks pending · '+card.answered+' of '+card.total+' questions marked'+((last.date)?' · '+U.fmtDate(last.date):''),pill:'amber',schedule:sc,visit:last};
  }
  if(sc) return {key:'due',label:'Not yet visited',detail:'scheduled '+U.fmtDate(sc.plannedDate)+' · '+(sc.quarter||'')+(sc.fy?' '+sc.fy:''),pill:'blue',schedule:sc};
  return {key:'due',label:'Not yet visited',detail:'no supervision recorded this quarter',pill:'blue',schedule:null};
}
function statusLine(r){
  const st=r.state||{key:'due',label:'Not yet visited',detail:''};
  if(st.key==='visited') return (r.assessor||'District PBF team')+' · '+U.fmtDate(r.submitted);
  return st.label+' · '+st.detail;
}

function list(){
  const centres=S.db().catalog.healthCenters.map(h=>h.name);
  const names=U.uniq(centres.concat((S.db().pbf||[]).map(r=>r.name)).concat((S.db().pbfVisits||[]).map(v=>v.hcName)));
  return names.map((name,i)=>{
    const vs=visitsFor(name);
    const state=centreState(name);
    if(!vs.length){
      const legacy=(S.db().pbf||[]).find(r=>r.name===name);
      return {id:(legacy&&legacy.id)||('hc-'+i),name,scores:{},prior:null,submitted:null,assessor:'',visits:0,state};
    }
    const latest=vs[0];
    const prev=vs.slice(1).find(v=>scorecardOf(v).complete);
    const marks=visitMarks(latest);
    const dm={}; domains().forEach(d=>{ dm[d.key]=domainMarksFor(latest,d.key); });
    return {id:latest.id,name,scores:visitScore(latest),marks,dm,prior:prev?visitTotal(prev):null,
      submitted:latest.date,assessor:latest.assessor||'District PBF team',quarter:latest.quarter,fy:latest.fy,
      visit:latest,visits:vs.length,status:'draft',state};
  });
}
/* The index is the whole scorecard's marks earned over the marks available, out of
   100. Nothing is weighted: 25-mark questions mean 25/25 is full marks and the
   district index is a plain percentage of everything that was marked. */
function total(row){
  if(!row) return null;
  if(row.marks) return row.marks.complete?row.marks.pct:null;
  if(row.answers) return visitMarks(row).pct;
  return null;
}
/* ——— Bands ————————————————————————————————
   One colour language for the index everywhere: 90 % and above is the deepest
   green, 80–89 green, 75–79 light red, below 75 blood red. */
function bandOf(v){
  if(v==null) return 'slate';
  if(v>=90) return 'g2';
  if(v>=80) return 'g1';
  if(v>=75) return 'r1';
  return 'r2';
}
function bandRgb(v){ return {g2:'23,196,139',g1:'46,158,119',r1:'226,154,162',r2:'163,33,46'}[bandOf(v)]||'120,130,150'; }
const sc=v=>v==null?'—':v+'%';
function tone(v){ return v==null?'slate':bandOf(v); }
function delta(r){ const t=total(r); if(t==null) return null; return r.prior==null?0:t-r.prior; }
function stats(){
  const rows=list();
  const scored=rows.filter(r=>total(r)!=null);
  const sorted=scored.slice().sort((a,b)=>total(b)-total(a));
  return {avg:scored.length?Math.round(U.avg(scored.map(total))):null, top:sorted[0], bottom:sorted[sorted.length-1],
    below:scored.filter(r=>total(r)<80).length, improved:scored.filter(r=>delta(r)>0).length,
    scored:scored.length, pending:rows.length-scored.length, rows};
}
function kpis(){
  const s=stats();
  const spark=vals=>C.spark(vals.length?vals:[0],{color:'var(--gold)'});
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'District average',value:s.avg==null?0:s.avg,unit:'%',icon:'chart-line',formatted:'0',note:s.scored+' of '+s.rows.length+' centres scored',spark:spark(s.rows.filter(r=>total(r)!=null).map(total))})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Leading centre',value:s.top?total(s.top):0,unit:'%',icon:'award',formatted:'0',note:s.top?s.top.name:'No scorecard yet',spark:spark(s.rows.filter(r=>total(r)!=null).map(total))})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Below the green band',value:s.below,icon:'alert-triangle',formatted:'0',note:s.below?'Support plan required':(s.scored?'Every scored centre is green':'Nothing scored yet'),spark:spark([s.below])})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Marks pending',value:s.pending,icon:'clipboard-list',formatted:'0',note:s.pending?'Visits recorded without a full scorecard':'Every visit has a full scorecard',spark:spark([s.pending])})+'</div></div>'
   +'<div class="card pad" style="margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">'
     +'<span class="pill '+(s.scored?'teal':'slate')+'">'+UI.ic('calculator',12)+'Index auto-calculated</span>'
     +'<span class="small grow">The index is <b>marks earned ÷ marks available × 100</b> — every question is marked out of 25, so 25/25 is 100 %. Each domain reports its own percentage of its own marks; the weights only describe how the report is composed and add to 100 %. A centre gets an index once <b>every</b> question is marked.</span>'
     +'<span class="xs faint">'+questions().length+' questions · '+liveDomains().length+' domains in use</span></div>';
}
function hero(){
  const s=stats();
  const rows=s.rows.filter(r=>total(r)!=null).sort((x,y)=>total(y)-total(x));
  return '<div class="grid-12"><div class="c12">'+UI.card({title:'Quarterly index',sub:'Marks earned over marks available · only complete scorecards are ranked',icon:'building-2',
    tools:'<span class="chip gold">'+UI.ic('file-text',12)+s.pending+' awaiting marks</span>',
    body:(rows.length?'<div class="pbf-strip">'+rows.map((r,i)=>{
      const t=total(r), d=delta(r)||0;
      return '<div class="pbf-col" data-pbf="'+r.id+'" title="'+U.esc(r.name)+' · '+t+'% · '+r.marks.got+' of '+r.marks.max+' marks">'
        +'<div class="pbf-pct idx-text '+bandOf(t)+'">'+t+'<span>%</span></div>'
        +'<div class="pbf-bar" style="height:'+U.clamp(t,4,100)+'%"><span class="pbf-fill '+bandOf(t)+'"></span></div>'
        +'<div class="pbf-rank mono">#'+(i+1)+'</div><div class="pbf-name">'+U.esc(r.name.replace(' HC',''))+'</div>'
        +'<div class="mono xs" style="color:var(--'+(d>0?'pos':d<0?'crit':'text-faint')+')">'+(d>0?'+':'')+d+'</div></div>';
    }).join('')+'</div>':'<div class="chart-empty">No centre has a complete scorecard yet — record a visit to start the index</div>')
    +'<div class="pbf-axis"><span class="xs faint">0%</span><span class="xs faint">90 %+ greenest · 80–89 green</span><span class="xs faint">75–79 light red · below 75 blood red</span></div>'})+'</div></div>';
}
function rowData(){
  return list().filter(r=>!q||r.name.toLowerCase().indexOf(q)>=0).slice().sort((a,b)=>{
    if(sort==='name') return a.name.localeCompare(b.name);
    const ta=total(a), tb=total(b);
    if(ta==null&&tb==null) return a.name.localeCompare(b.name);
    if(ta==null) return 1; if(tb==null) return -1;
    if(sort==='delta') return (delta(b)||0)-(delta(a)||0);
    return tb-ta;
  });
}
function rowsHTML(){
  const rows=rowData();
  const w=domainWeights();
  if(!rows.length) return '<tr><td colspan="'+(liveDomains().length+5)+'"><div style="padding:26px 8px">'+UI.empty({art:'search',title:'No health centre matches',body:'Try a shorter search term.'})+'</div></td></tr>';
  return rows.map(r=>{ const t=total(r), d=delta(r);
    return '<tr data-pbf-row="'+r.id+'" style="cursor:pointer">'
      +'<td><div class="primary-cell"><b>'+U.esc(r.name)+'</b><small>'+U.esc(statusLine(r))+'</small></div></td>'
      +liveDomains().map(d=>{ const v=r.scores?r.scores[d.key]:null; const m=r.dm?r.dm[d.key]:null;
        return '<td class="num" title="'+U.esc(d.label)+(m?' · '+m.got+' of '+m.max+' marks':'')+'"><span class="idx-chip '+bandOf(v)+'">'+(v==null?'—':v)+'</span></td>'; }).join('')
      +'<td>'+(t!=null?'<span class="pill '+tone(t)+'">'+t+'%</span>'
        :r.state&&r.state.key==='pending'?'<span class="pill amber">marks pending</span>'
        :'<span class="pill blue">not yet visited</span>')+'</td>'
      +'<td class="num xs faint">'+(r.prior==null?'—':r.prior)+'</td>'
      +'<td class="mono xs" style="color:var(--'+(d==null?'text-faint':d>0?'pos':d<0?'crit':'text-faint')+')">'+(d==null?'—':(d>0?'+':'')+d)+'</td>'
      +'<td><button class="icon-btn" style="width:26px;height:26px" data-open="'+r.id+'">'+UI.ic('chevron-right',14)+'</button></td></tr>'; }).join('');
}
function table(){
  const w=domainWeights();
  return '<div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="pbfSearch" placeholder="Search health centre…" value="'+U.esc(q)+'"></div>'
   +'<span class="grow"></span>'
   +'<div class="seg">'+[['total','Score'],['delta','Momentum'],['name','Name']].map(([k,l])=>'<button class="'+(sort===k?'on':'')+'" data-sort="'+k+'">'+l+'</button>').join('')+'</div></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Health centre</th>'+liveDomains().map(d=>'<th class="num" title="'+U.esc(d.label)+'">'+U.esc(d.label.split(' ')[0])+'<span class="xs faint" style="display:block;font-weight:400">'+w[d.key]+'% weight</span></th>').join('')+'<th>Index</th><th>Prev</th><th>Δ</th><th></th></tr></thead>'
   +'<tbody id="pbfBody">'+rowsHTML()+'</tbody></table></div>'
   +'<div class="card-foot"><span>Draft indices — subject to district verification</span><span class="mono" id="pbfCount">'+rowData().length+' of '+list().length+' centres</span></div></div>';
}
function matrix(){
  const rows=list().slice().sort((a,b)=>{ const ta=total(a), tb=total(b); if(ta==null&&tb==null) return a.name.localeCompare(b.name); if(ta==null) return 1; if(tb==null) return -1; return tb-ta; });
  const w=domainWeights();
  return UI.card({title:'Domain heatmap',sub:'Every cell is a recorded scorecard — a blank cell is a centre whose marks are not in yet',icon:'layout-grid',body:
    '<div style="overflow-x:auto"><table class="pbf-heat"><thead><tr><th></th>'+liveDomains().map(d=>'<th>'+U.esc(d.label.split(' ')[0])+'<span class="w">'+w[d.key]+'%</span></th>').join('')+'<th>Index</th></tr></thead><tbody>'
    +rows.map(r=>'<tr><td class="pbf-hc">'+U.esc(r.name)+'</td>'+liveDomains().map(d=>{
        const v=r.scores?r.scores[d.key]:null, m=r.dm?r.dm[d.key]:null;
        const tip=U.esc(d.label)+(m?' · '+m.got+'/'+m.max+' marks':'')+(v==null?' · no marks recorded':' · '+v+'%');
        if(v==null) return '<td><span class="heat-tile empty" data-tip="'+tip+'" style="--a:0.04;--tone:120,130,150">—</span></td>';
        return '<td><span class="heat-tile" data-tip="'+tip+'" style="--a:'+((v/100)*0.9+0.06).toFixed(2)+';--tone:'+bandRgb(v)+'">'+v+'</span></td>';
      }).join('')+'<td><b class="mono '+(total(r)==null?'':'idx-text '+bandOf(total(r)))+'">'+(total(r)==null?'—':total(r))+'</b></td></tr>').join('')
    +'</tbody></table></div><div class="card-foot"><span>Cell intensity maps the score. Bands: 90 %+ deep green, 80–89 green, 75–79 light red, below 75 blood red. A dash means that domain has no marks recorded for the centre.</span><span class="mono">'+liveDomains().length+' domains · '+questions().length+' questions</span></div>'});
}
function recommendationBlock(visit){
  if(!visit) return '';
  const rec=visit.recommendations||'';
  const prev=visit.previous||null;
  return '<div class="section-head"><h2>Recommendations</h2></div>'
   +'<div class="card pad" style="background:var(--surface-inset)">'
   +'<div class="eyebrow">Given at this visit</div>'
   +'<div class="small" style="margin-top:4px;line-height:1.6">'+(rec?U.esc(rec):'<span class="faint">No recommendation recorded.</span>')+'</div>'
   +(prev?'<div class="thread" style="margin:10px 0"></div><div class="eyebrow">Previous recommendation'+(prev.quarter?' · '+U.esc(prev.quarter):'')+'</div>'
     +'<div class="small" style="margin-top:4px;line-height:1.6">'+U.esc(prev.text||'—')+'</div>'
     +'<div style="margin-top:6px"><span class="pill '+(prev.addressed==='Yes'?'teal':prev.addressed==='Partly'?'amber':'rose')+'">Addressed: '+U.esc(prev.addressed||'not stated')+'</span>'
     +(prev.note?' <span class="xs faint">'+U.esc(prev.note)+'</span>':'')+'</div>'
     :'<div class="xs faint" style="margin-top:8px">First recorded supervision — there are no earlier recommendations to check.</div>')
   +'</div>';
}
function drawer(id){
  const r=list().find(x=>x.id===id); if(!r) return;
  const t=total(r), d=delta(r);
  const w=domainWeights();
  const st=r.state||centreState(r.name);
  const card=r.visit?scorecardOf(r.visit):{complete:false,answered:0,total:questions().length,missing:questions()};
  UI.drawer({title:r.name,eyebrow:'PBF evaluation · '+(r.quarter||'Q1')+' '+U.fyLabel(),
    sub:(st.key==='visited'?'Assessed '+U.fmtDate(r.submitted):st.label+' · '+st.detail)+' · '+U.esc(r.assessor||'District PBF team'),wide:true,body:
    '<div class="row gap-lg" style="align-items:center;margin-bottom:16px">'+(t==null?C.ring(0,{size:104,stroke:8,color:'var(--text-faint)',label:'—'}):C.ring(t,{size:104,stroke:8,color:bandColor(t)}))
    +'<div><div class="row gap-sm">'+(t==null?'<span class="pill amber">Index not calculated</span>':'<span class="pill '+tone(t)+'">Index '+t+'%</span>')
    +(r.prior!=null?'<span class="pill slate">Previous '+r.prior+'%</span>':'')
    +(d!=null?'<span class="delta '+(d<0?'down':'')+'">'+UI.ic(d>=0?'arrow-up':'arrow-down',10)+(d>0?'+':'')+d+' pts</span>':'')+'</div>'
    +'<div class="xs faint" style="margin-top:8px;max-width:380px">'+questions().length+' questions across '+liveDomains().length+' domains, '+(r.marks?r.marks.got+' of '+r.marks.max+' marks':'marks pending')+'. The index is marks earned ÷ marks available ×100 — the only place the weights appear is the report wording. A partial scorecard is never ranked.</div></div></div>'
    +'<div class="card pad" style="background:var(--surface-inset);margin-bottom:14px"><div class="row between"><span class="small">Scorecard completeness</span>'
    +'<span class="pill '+(card.complete?'teal':'amber')+'">'+card.answered+' / '+card.total+' marked</span></div>'
    +UI.meter(card.total?card.answered/card.total*100:0,card.complete?'teal':'amber')
    +(card.complete?'':'<div class="xs faint" style="margin-top:6px">'+card.missing.length+' question'+(card.missing.length===1?'':'s')+' still blank — open the visit and mark them all to calculate the index.</div>')+'</div>'
    +liveDomains().map(d=>{ const v=r.scores?r.scores[d.key]:null; const m=r.dm?r.dm[d.key]:null;
      return '<div style="margin-bottom:14px"><div class="row between" style="margin-bottom:5px"><span class="small">'+U.esc(d.label)+' <span class="xs faint">· '+w[d.key]+'% of index weight · '+(m?m.got+'/'+m.max+' marks':'no marks')+'</span></span>'
      +'<span class="mono small idx-text '+bandOf(v)+'">'+(v==null?'—':v+'%')+'</span></div>'
      +UI.meter(v==null?0:v,v==null?'slate':v>=90?'teal':v>=80?'teal':v>=75?'rose':'rose')+'</div>'; }).join('')
    +'<div class="section-head"><h2>Verification</h2></div>'
    +'<div class="custody">'+[['Register reconciliation',r.submitted?U.addDays(r.submitted,-1):'','Laboratory register cross-checked with the district HIS'],
      ['Stock card audit',r.submitted?U.addDays(r.submitted,-2):'','Physical count matched to stock cards'],
      ['Staff interviews',r.submitted||'','Competency and duty rosters sampled'],
      ['District verification','','Awaiting PBF team sign-off']].map(([ti,dt,note])=>
      '<div class="custody-item'+(dt?'':' pending')+'"><span class="custody-dot"></span><div class="custody-body"><div class="custody-title">'+U.esc(ti)+'</div><div class="custody-meta">'+(dt?U.fmtDate(dt)+' · ':'Pending · ')+U.esc(note)+'</div></div></div>').join('')+'</div>'
    +recommendationBlock(r.visit)
    +'<div class="section-head"><h2>Questions evaluated</h2><span class="more">'+(r.visit?card.answered+' of '+card.total+' questions':'no visit recorded')+'</span></div>'
    +(r.visit?liveDomains().map(d=>{
        const k=d.key, label=d.label;
        const qs=domainQuestions(k); if(!qs.length) return '';
        return '<div style="margin-bottom:10px"><div class="eyebrow">'+U.esc(label)+'</div>'
          +qs.map(q=>{ const v=r.visit.answers&&r.visit.answers[q.id]; const pct=v==null?null:Math.round(+v/q.max*100); const ok=pct!=null&&pct>=S.PBF_MIN;
            return '<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">max '+q.max+' marks</div></div><span class="pill '+(v==null?'slate':ok?'teal':+v>=q.max*0.5?'amber':'rose')+' mono">'+(v==null?'blank':v+'/'+q.max+' · '+pct+'%')+'</span></div>';
          }).join('')+'</div>';
      }).join(''):'<p class="xs faint">No question-level visit has been logged for this centre yet.</p>')
    +'<div class="section-head"><h2>Visit history</h2><span class="more">'+(r.visits||0)+' visit'+(r.visits===1?'':'s')+'</span></div>'
    +(visitsFor(r.name).length?visitsFor(r.name).map(v=>{ const vt=visitTotal(v);
        return '<div class="list-row" data-visit="'+v.id+'" style="cursor:pointer"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(v.quarter||'')+' · '+U.fmtDate(v.date)+'</div><div class="lr-sub">'+U.esc(v.assessor||'')+(v.recommendations?' · '+U.esc(v.recommendations.slice(0,60)):'')+'</div></div>'
        +(vt==null?'<span class="pill amber">marks pending</span>':'<span class="pill '+tone(vt)+' mono">'+vt+'%</span>')+'</div>'; }).join(''):'<p class="xs faint">No visits logged.</p>')
    +'<div class="hint" style="margin-top:12px">Adding a visit never overwrites an earlier one — the quarterly history stays intact.</div>',
    foot:'<button class="btn" data-close>Close</button>'
      +(r.visit?'<button class="btn" data-edit>'+UI.ic('sliders',15)+(card.complete?'Adjust marks':'Enter marks')+'</button>':'')
      +'<button class="btn" data-new-visit>'+UI.ic('plus',15)+'Record visit</button><button class="btn primary" data-print>'+UI.ic('printer',15)+'Print scorecard</button>',
    onMount:(panel,close)=>{
      const ed=panel.querySelector('[data-edit]'); if(ed) ed.onclick=()=>{ close(); visitModal(r.visit.id); };
      panel.querySelector('[data-new-visit]').onclick=()=>{ close(); visitModal(null,r.name); };
      panel.querySelectorAll('[data-visit]').forEach(el=>el.onclick=()=>{ close(); visitModal(el.dataset.visit); });
      panel.querySelector('[data-print]').onclick=()=>printCentre(r);
    }});
}

/* ——— Baseline ——— from the aggregate Q1 scorecard ————— */
/* ——— Baseline ————————————————————————————————————
   The question-level marks that shipped with 6.6 were generated from the old
   aggregate scorecard. They are not evidence, so they are dropped. The district
   has confirmed four supervision visits (Coko, Minazi, Rwankuba, Muhondo) — those
   stay as visits with their scorecard still to be entered; every other centre
   reads "not yet visited". */
const BASELINE_VISITED=['Coko HC','Minazi HC','Rwankuba HC','Muhondo HC'];
function normaliseAssessors(){
  const db=S.db(); const me=(LS.auth.user&&LS.auth.user.name)||'Kelvin';
  const fix=o=>{ if(!o.assessor||/district pbf team/i.test(o.assessor)) o.assessor=me; };
  (db.pbfSchedule||[]).forEach(fix); (db.pbfVisits||[]).forEach(fix);
}
function ensureSeeded(){
  const db=S.db();
  /* One-time: the seeded plan and the four confirmed visits carried a placeholder
     assessor (“District PBF team”). There is a real person behind it — whoever is
     signed in — so the compliance figures start from a name the district knows. */
  if(db.meta&&!db.meta.pbfAssessor692){ db.meta.pbfAssessor692=true; normaliseAssessors(); try{ S.save(); }catch(e){} }
  if(db.meta&&db.meta.pbfRealV67){ ensureSchedule(); return; }
  db.meta.pbfRealV67=true; db.meta.pbfVisitsSeeded=true;
  const legacy=db.pbf||[];
  const manual=(db.pbfVisits||[]).filter(v=>!v.seeded);
  const kept=manual.slice();
  BASELINE_VISITED.forEach(name=>{
    if(kept.some(v=>v.hcName===name)) return;
    const old=legacy.find(r=>r.name===name)||{};
    kept.push({id:U.uid('pbfv'),hcName:name,quarter:old.quarter||'Q1',fy:old.fy||U.fyLabel(),
      date:old.submitted||'',assessor:(old.assessor&&!/district pbf team/i.test(old.assessor))?old.assessor:((LS.auth.user&&LS.auth.user.name)||'Kelvin'),answers:{},
      note:'Supervision visit recorded — question marks still to be entered',pending:true});
  });
  S.commit(d=>{
    d.pbfVisits=kept;
    d.pbfSchedule=(d.pbfSchedule||[]).filter(sc=>!sc.seeded);
    kept.forEach(v=>{ if(!(d.pbfSchedule||[]).some(x=>x.hcName===v.hcName&&x.quarter===v.quarter))
      d.pbfSchedule.push({id:U.uid('pbfs'),hcName:v.hcName,quarter:v.quarter,fy:v.fy,plannedDate:v.date,status:'visited',visitId:v.id,visitedAt:v.date,assessor:v.assessor}); });
    d.meta.pbfScheduleSeeded=true;
  },{action:'pbf.baseline',entity:'pbf',detail:'Question-level marks reset · '+kept.length+' recorded visits, '+(U.uniq((db.catalog.healthCenters||[]).map(h=>h.name)).length-kept.length)+' centres not yet visited'});
  ensureSchedule();
  normaliseAssessors();
}
/* Planned supervision is entered by the user; nothing is scheduled on their behalf. */
function ensureSchedule(){
  const db=S.db();
  if(!db.pbfSchedule) db.pbfSchedule=[];
  db.meta.pbfScheduleSeeded=true;
}
function previousVisitFor(hcName, skipId){
  const current=skipId?(S.db().pbfVisits||[]).find(v=>v.id===skipId):null;
  const vs=visitsFor(hcName).filter(v=>v.id!==skipId && v.date);
  const before=current&&current.date?vs.filter(v=>String(v.date)<String(current.date)):vs;
  return before[0]||null;
}
function visitModal(id,presetCentre,presetQuarter,presetDate){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const v=id?(db.pbfVisits||[]).find(x=>x.id===id):null;
  const assessors=assessorNames();
  const presetSlot=presetCentre&&presetQuarter?schedule().find(sc=>sc.hcName===presetCentre&&sc.quarter===presetQuarter):null;
  const plannedFor=presetSlot&&presetSlot.plannedDate?String(presetSlot.plannedDate).slice(0,10):null;
  const centres=U.uniq(db.catalog.healthCenters.map(h=>h.name).concat((db.pbf||[]).map(r=>r.name)));
  const qs=questions();
  const answers=v?(v.answers||{}):{};
  const section=k=>domainQuestions(k).map(q=>{
    const val=answers[q.id];
    return '<div class="row between gap-sm" style="padding:5px 0;border-bottom:1px solid var(--border)"><span class="small grow" style="max-width:72%">'+U.esc(q.text)+'<span class="xs faint"> · max '+q.max+'</span></span>'
      +'<span class="row gap-sm"><input class="input mono" data-q="'+q.id+'" type="number" min="0" max="'+q.max+'" step="1" value="'+(val==null?'':val)+'" style="width:64px" placeholder="—" aria-label="'+U.esc(q.text)+'"><span class="xs faint">/'+q.max+'</span><span class="pill slate mono" data-qpct="'+q.id+'">'+(val==null?'—':Math.round(val/q.max*100)+'%')+'</span></span></div>';
  }).join('');
  UI.modal({title:v?'Edit PBF visit':'Record PBF visit',
    sub:'Every question must carry a mark — a supervision only counts once the scorecard is complete.',width:'min(800px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Health centre</label><select class="select" id="pvCentre">'+centres.map(c=>'<option'+((v?v.hcName===c:presetCentre===c)?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Quarter</label><input class="input mono" id="pvQuarter" value="'+U.esc(v?v.quarter:(presetQuarter||'Q1'))+'"></div>'
      +'<div class="field"><label>Visit date</label><input class="input" type="date" id="pvDate" value="'+(v&&v.date?String(v.date).slice(0,10):(presetDate||U.todayISO()))+'">'
        +(plannedFor?'<div class="xs faint" style="margin-top:4px">Planned for '+U.fmtDate(plannedFor)+' — the difference counts against assessor compliance.</div>':'')+'</div>'
      +'<div class="field"><label>Assessor</label><select class="select" id="pvAssessor">'
        +assessors.map(a=>'<option value="'+U.esc(a)+'"'+(((v?v.assessor:assessors[0])===a)?' selected':'')+'>'+U.esc(a)+'</option>').join('')
        +'<option value="__other">＋ Add another staff member…</option></select>'
        +'<input class="input" id="pvAssessorOther" placeholder="Type the assessor’s name" style="margin-top:6px;display:none"></div>'
      +'<div class="field span2"><label>Marks — every question, no blanks</label>'
        +liveDomains().map(d=>'<div style="margin-top:8px"><div class="eyebrow">'+U.esc(d.label)+' · '+domainQuestions(d.key).length+' questions · '+U.sum(domainQuestions(d.key),x=>+x.max||0)+' marks</div>'+section(d.key)+'</div>').join('')
        +'<div class="row gap-sm" style="margin-top:10px;flex-wrap:wrap"><span class="pill amber" id="pvPreview">0 / '+qs.length+' marked</span><span class="pill slate" id="pvIndex">Index —</span><button class="btn xs" type="button" data-all-max>'+UI.ic('check-check',12)+'Mark all full</button><button class="btn xs" type="button" data-clear>'+UI.ic('eraser',12)+'Clear marks</button></div>'
      +'</div>'
      +'<div class="field span2" style="margin-top:6px"><label>Recommendations given at this visit</label>'
        +'<textarea class="textarea" id="pvRec" rows="2" placeholder="Two or three actions agreed with the in-charge…">'+U.esc(v?(v.recommendations||''):'')+'</textarea>'
        +'<div class="xs faint" style="margin-top:4px">Keep it short — this is what the next visit will check.</div></div>'
      +'<div class="field span2"><div id="pvPrev"></div></div>'
      +'<div class="field span2"><label>Visit note</label><input class="input" id="pvNote" value="'+U.esc(v?(v.note||''):'')+'" placeholder="Observed gaps, who was present"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save visit</button>',
    onMount:(el,close)=>{
      const aSel=el.querySelector('#pvAssessor'), aOther=el.querySelector('#pvAssessorOther');
      const syncOther=()=>{ aOther.style.display=aSel.value==='__other'?'':'none'; if(aSel.value==='__other') aOther.focus(); };
      aSel.addEventListener('change',syncOther); syncOther();
      const inputs=()=>Array.from(el.querySelectorAll('[data-q]'));
      const currentAnswers=()=>{ const a={}; inputs().forEach(i=>{ if(i.value!=='') a[i.dataset.q]=U.clamp(+i.value,0,+(i.max||Q_MAX_DEFAULT)); }); return a; };
      const pct=i=>{ const cell=el.querySelector('[data-qpct="'+i.dataset.q+'"]'); if(!cell) return;
        const q=qById(i.dataset.q); const m=q?+q.max:Q_MAX_DEFAULT;
        cell.textContent = i.value===''?'—':Math.round(U.clamp(+i.value,0,m)/m*100)+'%'; };
      const preview=()=>{ const a=currentAnswers(); const n=Object.keys(a).length;
        const card=scorecardOf({answers:a});
        el.querySelector('#pvPreview').textContent=n+' / '+qs.length+' marked';
        el.querySelector('#pvPreview').className='pill '+(card.complete?'teal':'amber');
        const idx=visitMarks({answers:a});
        el.querySelector('#pvIndex').textContent='Index '+(card.complete&&idx.complete?idx.pct+'% — '+idx.got+' of '+idx.max+' marks':'—'); };
      inputs().forEach(i=>{ i.addEventListener('input',()=>{ pct(i); preview(); }); pct(i); });
      preview();
      const paintPrev=()=>{
        const centre=el.querySelector('#pvCentre').value;
        const prev=previousVisitFor(centre, v?v.id:null);
        const box=el.querySelector('#pvPrev');
        if(!prev){
          box.innerHTML='<div class="card pad" style="background:var(--surface-inset)"><div class="eyebrow">Previous recommendations</div><div class="xs faint" style="margin-top:4px">First recorded supervision for this centre — there is nothing to follow up yet.</div></div>';
          return;
        }
        const rec=prev.recommendations||'';
        const chosen=(v&&v.previous&&v.previous.visitId===prev.id)?v.previous:{};
        box.innerHTML='<div class="card pad" style="background:var(--surface-inset)"><div class="eyebrow">Previous recommendations · '+U.esc(prev.quarter||'')+' '+U.fmtDate(prev.date)+'</div>'
          +'<div class="small" style="margin-top:4px;line-height:1.55">'+(rec?U.esc(rec):'<span class="faint">No recommendation was written last time.</span>')+'</div>'
          +(rec?'<div class="form-grid" style="margin-top:8px"><div class="field"><label>Were they addressed?</label><select class="select" id="pvAddr">'
            +['','Yes','Partly','No'].map(o=>'<option value="'+o+'"'+((chosen.addressed||'')===o?' selected':'')+'>'+(o||'— not checked —')+'</option>').join('')+'</select></div>'
            +'<div class="field"><label>Evidence / note (optional)</label><input class="input" id="pvAddrNote" value="'+U.esc(chosen.note||'')+'" placeholder="What changed since the last visit"></div></div>':'')
          +'</div>';
      };
      paintPrev();
      el.querySelector('#pvCentre').addEventListener('change',paintPrev);
      el.querySelector('[data-all-max]').onclick=()=>{ inputs().forEach(i=>{ const q=qById(i.dataset.q); i.value=q?q.max:Q_MAX_DEFAULT; pct(i); }); preview(); };
      el.querySelector('[data-clear]').onclick=()=>{ inputs().forEach(i=>{ i.value=''; pct(i); }); preview(); };
      el.querySelector('[data-save]').onclick=()=>{
        const hcName=el.querySelector('#pvCentre').value;
        const answers=currentAnswers();
        const card=scorecardOf({answers});
        if(!card.complete){
          const first=card.missing[0];
          const input=first?el.querySelector('[data-q="'+first.id+'"]'):null; if(input) input.focus();
          return UI.toast('Every question needs a mark — '+(card.total-card.answered)+' still blank',{type:'warn'});
        }
        const vSlotId=presetSlot?presetSlot.id:null;
        const prev=previousVisitFor(hcName, v?v.id:null);
        const addrEl=el.querySelector('#pvAddr');
        const rec=el.querySelector('#pvRec').value.trim();
        const rec_previous=prev?{visitId:prev.id,quarter:prev.quarter||'',date:prev.date||'',text:prev.recommendations||'',
          addressed:addrEl?addrEl.value:'',note:(el.querySelector('#pvAddrNote')||{}).value||''}:null;
        const aSel=el.querySelector('#pvAssessor');
        let assessor=aSel.value;
        if(assessor==='__other') assessor=(el.querySelector('#pvAssessorOther').value||'').trim();
        if(!assessor) assessor=LS.auth.user.name;
        if(assessor!=='__other') addAssessor(assessor);
        const rec2={hcName,quarter:el.querySelector('#pvQuarter').value.trim()||'Q1',fy:U.fyLabel(),
          date:el.querySelector('#pvDate').value,assessor,
          answers,note:el.querySelector('#pvNote').value.trim(),recommendations:rec,previous:rec_previous,pending:false};
        const vid=v?v.id:U.uid('pbfv');
        S.commit(d=>{
          d.pbfVisits=d.pbfVisits||[];
          if(v){ const x=d.pbfVisits.find(y=>y.id===v.id); if(x) Object.assign(x,rec2); }
          else d.pbfVisits.unshift(Object.assign({id:vid},rec2));
          d.pbfSchedule=d.pbfSchedule||[];
          /* If the quarter somehow holds more than one slot for a centre, fill the
             one whose planned date is closest to the visit rather than whichever
             happens to be first. */
          const cands=d.pbfSchedule.filter(x=>x.hcName===hcName && x.quarter===rec2.quarter);
          const dist=x=>x.plannedDate?Math.abs(new Date(x.plannedDate)-new Date(rec2.date)):Infinity;
          const slot=cands.find(x=>x.id===vSlotId)
            || cands.filter(x=>x.status!=='visited').sort((a,b)=>dist(a)-dist(b))[0]
            || cands[0];
          const stampCompliance=x=>{
            const planned=x.plannedDate?String(x.plannedDate).slice(0,10):null;
            if(planned&&rec2.date){
              const late=Math.round((new Date(rec2.date)-new Date(planned))/86400000);
              x.compliance=late<=0?'onTime':'late'; x.lateDays=Math.max(0,late);
            } else { x.compliance='onTime'; x.lateDays=0; }
            x.assessor=rec2.assessor;
          };
          if(slot){ slot.status='visited'; slot.visitId=vid; slot.visitedAt=rec2.date; stampCompliance(slot); }
          else d.pbfSchedule.push({id:U.uid('pbfs'),hcName,quarter:rec2.quarter,fy:rec2.fy,plannedDate:rec2.date,
            status:'visited',visitId:vid,visitedAt:rec2.date,compliance:'onTime',lateDays:0,assessor:rec2.assessor});
        },{action:'pbf.visit.'+(v?'edit':'add'),entity:'pbf',entityId:v?v.id:hcName,detail:hcName+' · '+rec2.quarter+' · index '+visitMarks({answers}).pct+'%'});
        const cslot=schedule().find(x=>x.hcName===hcName && x.quarter===rec2.quarter);
        const cl=cslot&&cslot.compliance==='late'?' · recorded '+cslot.lateDays+' day'+(cslot.lateDays===1?'':'s')+' late against the plan':cslot&&cslot.compliance==='onTime'?' · on schedule':'';
        close(); LS.shell.refresh(); UI.toast('Visit saved · index '+visitMarks({answers}).pct+'%'+cl,{type:'ok'});
      };
    }});
}
function questionModal(id){
  if(!LS.auth.guard('edit')) return;
  const q=id?qById(id):null;
  UI.modal({title:q?'Edit question':'Add evaluation question',sub:'Every question belongs to exactly one domain. The index ignores the weights — it is marks earned over marks available.',width:'min(560px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Question</label><textarea class="textarea" id="qbText" rows="2">'+U.esc(q?q.text:'')+'</textarea></div>'
      +'<div class="field"><label>Domain</label><select class="select" id="qbDomain">'+domains().map(d=>{ const n=domainQuestions(d.key).length; return '<option value="'+d.key+'"'+((q?q.domain:(liveDomains()[0]||domains()[0]).key)===d.key?' selected':'')+'>'+U.esc(d.label)+' ('+n+' question'+(n===1?'':'s')+', weight '+d.weight+')</option>'; }).join('')+'</select><div class="xs faint" style="margin-top:4px">Need a new domain? Use <b>Manage domains</b> in the question bank.</div></div>'
      +'<div class="field"><label>Maximum marks</label><input class="input mono" type="number" min="1" max="100" id="qbMax" value="'+(q?q.max:Q_MAX_DEFAULT)+'"></div></div>'
      +'<div class="hint" style="margin-top:10px">Each question carries its own maximum — 25 by default, so 25/25 is 100 % of that question. A domain reports its own percentage (its marks earned over its marks available); the weights are how the report describes the composition and are renormalised to 100 over the domains that hold questions.</div>',
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
async function deleteQuestions(ids){
  const list=ids.map(id=>qById(id)).filter(Boolean);
  if(!list.length) return;
  if(!LS.auth.guard('edit')) return;
  const answered=U.sum(list,q=>(S.db().pbfVisits||[]).filter(v=>v.answers&&v.answers[q.id]!=null).length);
  const ok=await UI.confirm({title:'Delete '+list.length+' question'+(list.length===1?'':'s')+'?',
    body:list.slice(0,6).map(q=>'· '+q.text).join('<br>')+(list.length>6?'<br>· and '+(list.length-6)+' more':'')
      +'<div style="margin-top:8px">The domain percentages and the index weights are recalculated from the questions that remain.'+(answered?' Marks already recorded are kept for audit and the questions can be restored.':'')+'</div>',
    confirm:'Delete '+list.length+(list.length===1?' question':' questions'),danger:true});
  if(!ok) return;
  S.commit(d=>{ (d.pbfQuestions||[]).forEach(x=>{
      if(ids.indexOf(x.id)<0) return;
      x.deleted=true; x.deletedAt=U.nowISO(); x.deletedBy=LS.auth.user.name; }); },
    {action:'pbf.question.delete',entity:'pbf',detail:list.length+' question'+(list.length===1?'':'s')+' deleted · '+list.map(q=>q.text.slice(0,32)).join(' | ').slice(0,140)});
  LS.shell.refresh(); UI.toast(list.length+' question'+(list.length===1?'':'s')+' deleted',{type:'ok'});
}
function restoreQuestion(id){
  const q=(S.db().pbfQuestions||[]).find(x=>x.id===id); if(!q) return;
  S.commit(d=>{ const x=(d.pbfQuestions||[]).find(y=>y.id===id);
    if(x){ delete x.deleted; delete x.deletedAt; delete x.deletedBy; x.active=true; } },
    {action:'pbf.question.restore',entity:'pbf',entityId:id,detail:q.text.slice(0,80)});
  LS.shell.refresh(); UI.toast('Question restored',{type:'ok'});
}
/* ——— Domain manager ————————————————————————————————
   The domain list is the district's, not the code's. Add, rename, re-weight and
   retire here; every question is allocated to a domain by hand, either from the
   question editor or in bulk from the bank. Weights are kept as written and are
   normalised to 100 for display, so a district can work in points or percentages. */
function domainModal(){
  if(!LS.auth.guard('edit')) return;
  const rowsHTML=()=>domains().map(d=>{
    const qs=domainQuestions(d.key);
    return '<div class="dom-row" data-dom="'+U.esc(d.key)+'">'
      +'<input class="input" data-dom-label value="'+U.esc(d.label)+'" placeholder="Domain name">'
      +'<input class="input mono" data-dom-weight type="number" min="0" max="100" step="1" value="'+(+d.weight||0)+'" style="width:78px">'
      +'<span class="xs faint" style="min-width:88px">'+qs.length+' q · '+U.sum(qs,q=>+q.max||0)+' marks</span>'
      +'<button class="icon-btn" data-dom-del="'+U.esc(d.key)+'" title="'+(qs.length?'Move its questions first':'Remove domain')+'"'+(qs.length?' disabled style="opacity:.35"':'')+'>'+UI.ic('trash-2',13)+'</button>'
      +'</div>';
  }).join('');
  UI.modal({title:'Manage domains',sub:'Rename, re-weight, add or retire. Weights are normalised to 100 % of the report; they never change the index arithmetic.',width:'min(660px,100%)',
    body:'<div class="dom-head"><span>Domain</span><span>Weight</span><span>Allocation</span><span></span></div>'
      +'<div id="domList">'+rowsHTML()+'</div>'
      +'<div class="row gap-sm" style="margin-top:10px;flex-wrap:wrap"><input class="input" id="domNew" placeholder="New domain name" style="flex:1;min-width:180px">'
        +'<button class="btn xs" data-dom-add>'+UI.ic('plus',12)+'Add domain</button>'
        +'<button class="btn xs" data-dom-norm>Normalise weights to 100</button></div>'
      +'<div class="row between" style="margin-top:10px"><span class="xs faint" id="domSum"></span><span class="pill slate mono" id="domLive"></span></div>'
      +'<div class="hint" style="margin-top:10px">A domain holding no questions is left out of the scorecard, the heatmap and every report, and its weight is shared across the domains that remain. Allocate questions with “Move to domain” in the bank.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save domains</button>',
    onMount:(el,close)=>{
      const sum=()=>{ const ws=U.$$('[data-dom-weight]',el).map(i=>+i.value||0); const t=U.sum(ws,w=>w)||0;
        const elSum=el.querySelector('#domSum');
        elSum.innerHTML=t===100?'Weights total <b>100</b> — the report reads exactly as written.'
          :'Weights total <b>'+t+'</b>; the report normalises them to 100 over the domains in use.';
        elSum.style.color=t===100?'var(--pos)':'var(--text-faint)';
        el.querySelector('#domLive').textContent=liveDomains().length+' of '+(domains().length)+' domains scored';
      };
      const bind=()=>{ U.$$('[data-dom-weight]',el).forEach(i=>i.addEventListener('input',sum)); sum(); };
      bind();
      el.querySelector('[data-dom-add]').onclick=()=>{
        const label=el.querySelector('#domNew').value.trim();
        if(!label) return UI.toast('Give the domain a name',{type:'warn'});
        S.commit(d=>{ d.pbfDomains=d.pbfDomains||domains().slice();
          const base=label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'domain';
          let key=base, n=2; while(d.pbfDomains.some(x=>x.key===key)) key=base+'-'+(n++);
          d.pbfDomains.push({key,label,weight:0}); },
          {action:'pbf.domain.add',entity:'pbf',detail:label});
        close(); domainModal(); UI.toast('Domain added · allocate questions to it',{type:'ok'});
      };
      el.querySelector('[data-dom-norm]').onclick=()=>{
        const ws=U.$$('[data-dom-weight]',el); const t=U.sum(ws,i=>+i.value||0);
        if(!t) return UI.toast('Set at least one weight first',{type:'warn'});
        /* Largest remainder, so the weights add to exactly 100 and never to 102. */
        const parts=ws.map(i=>({el:i,raw:(+i.value||0)/t*100}));
        parts.forEach(p=>{ p.base=Math.floor(p.raw); p.rem=p.raw-p.base; });
        let left=100-parts.reduce((a,p)=>a+p.base,0);
        parts.slice().sort((a,b)=>b.rem-a.rem).forEach(p=>{ if(left>0){ p.base++; left--; } });
        parts.forEach(p=>{ p.el.value=p.base; }); sum();
      };
      el.querySelectorAll('[data-dom-del]').forEach(b=>b.onclick=async()=>{
        const key=b.dataset.domDel; const d=domainById(key); if(!d) return;
        if(domainQuestions(key).length) return UI.toast('Move its questions to another domain first',{type:'warn'});
        const ok=await UI.confirm({title:'Remove the domain “'+d.label+'”?',
          body:'It holds no questions, so nothing is lost from the scorecards. Weights are normalised over the domains that remain.',
          confirm:'Remove domain',danger:true});
        if(!ok) return;
        S.commit(x=>{ x.pbfDomains=(x.pbfDomains||domains()).filter(y=>y.key!==key); },
          {action:'pbf.domain.remove',entity:'pbf',detail:d.label});
        close(); domainModal();
      });
      el.querySelector('[data-save]').onclick=()=>{
        const map={}; U.$$('[data-dom]',el).forEach(row=>{
          const key=row.dataset.dom; const label=row.querySelector('[data-dom-label]').value.trim();
          const weight=U.clamp(parseInt(row.querySelector('[data-dom-weight]').value,10)||0,0,100);
          if(label) map[key]={label,weight};
        });
        S.commit(d=>{ (d.pbfDomains||domains()).forEach(x=>{ if(map[x.key]){ x.label=map[x.key].label; x.weight=map[x.key].weight; } }); },
          {action:'pbf.domain.edit',entity:'pbf',detail:Object.keys(map).length+' domains updated'});
        close(); LS.shell.refresh(); UI.toast('Domains saved',{type:'ok'});
      };
    }});
}
function moveQuestions(ids,key){
  if(!ids.length||!key) return;
  if(!LS.auth.guard('edit')) return;
  const d=domainById(key); if(!d) return;
  S.commit(x=>{ (x.pbfQuestions||[]).forEach(q=>{ if(ids.indexOf(q.id)>=0) q.domain=key; }); },
    {action:'pbf.question.move',entity:'pbf',detail:ids.length+' question'+(ids.length===1?'':'s')+' → '+d.label});
  LS.shell.refresh(); UI.toast(ids.length+' question'+(ids.length===1?'':'s')+' moved to '+d.label,{type:'ok'});
}
function questionBank(){
  const qs=questions();
  const w=domainWeights();
  return UI.card({title:'Question bank',sub:'Tick the questions you want to drop · '+qs.length+' in use',icon:'list-checks',
    tools:'<button class="btn xs" data-manage-domains>'+UI.ic('layers',12)+'Manage domains</button><button class="btn xs" data-add-q>'+UI.ic('plus',12)+'Add question</button>',
    body:'<div class="row between gap-sm" style="padding:4px 0 8px;border-bottom:1px solid var(--border);flex-wrap:wrap">'
      +'<label class="row gap-sm" style="cursor:pointer"><input type="checkbox" data-q-all style="accent-color:var(--gold)"><span class="small">Select all '+qs.length+'</span></label>'
      +'<span class="grow"></span>'
      +'<span class="pill slate mono" id="qSelCount">0 selected</span>'
      +'<select class="select" id="qMoveTarget" style="width:auto;min-width:150px;height:30px;font-size:11px">'+domains().map(d=>'<option value="'+d.key+'">Move to: '+U.esc(d.label)+'</option>').join('')+'</select>'
      +'<button class="btn xs" data-move-selected disabled>'+UI.ic('folder-input',12)+'Move</button>'
      +'<button class="btn xs danger" data-del-selected disabled>'+UI.ic('trash-2',12)+'Delete selected</button></div>'
      +liveDomains().map(dd=>{ const k=dd.key, label=dd.label; const group=qs.filter(q=>q.domain===k);
      return '<div style="margin-top:10px" data-q-group="'+k+'"><div class="row between"><span class="eyebrow">'+U.esc(label)+' <span class="faint">· '+w[k]+'% weight · '+U.sum(group,x=>+x.max||0)+' marks</span></span>'
        +'<span class="xs faint" style="display:flex;gap:8px;align-items:center">'+group.length+' question'+(group.length===1?'':'s')+'<label class="row gap-xs" style="cursor:pointer;gap:4px"><input type="checkbox" data-q-group-all="'+k+'" style="accent-color:var(--gold)"><span>all</span></label></span></div>'
        +group.map(q=>'<div class="list-row" style="padding:6px 0"><input type="checkbox" data-q-sel="'+q.id+'" style="accent-color:var(--gold);margin-right:8px">'
          +'<div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">max '+q.max+' marks · '+Math.round(q.max/Math.max(1,U.sum(group,x=>+x.max||0))*100)+'% of the domain</div></div>'
          +'<div class="row gap-sm"><button class="icon-btn" style="width:24px;height:24px" data-edit-q="'+q.id+'" title="Edit">'+UI.ic('pencil',12)+'</button></div></div>').join('')
        +'</div>';
    }).join('')
    +'<div class="xs faint" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">'+liveDomains().length+' of '+domains().length+' domains in use — a domain with no questions is dropped from the scorecards, the heatmap and every report, and its weight is shared across the domains that remain.</div>'
    +(retiredQuestions().length?'<div class="row between" style="margin-top:8px;flex-wrap:wrap;gap:6px"><span class="xs faint">'+retiredQuestions().length+' deleted question'+(retiredQuestions().length===1?'':'s')+' · not scored</span><span class="row gap-sm wrap">'+retiredQuestions().map(q=>'<button class="btn xs" data-restore-q="'+q.id+'">'+UI.ic('rotate-ccw',11)+U.esc(q.text.slice(0,18))+(q.text.length>18?'…':'')+'</button>').join('')+'</span></div>':'')
    });
}
/* ——— Scheduling ————————————————————————————————— */
function scheduleModal(id,presetDate){
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
      +'<div class="field"><label>Planned visit date</label><input class="input" type="date" id="psDate" value="'+(sc?String(sc.plannedDate).slice(0,10):(presetDate||U.todayISO()))+'"></div>'
      +'<div class="field"><label>Assessor</label><select class="select" id="psAssessor">'+assessorNames().map(a=>'<option value="'+U.esc(a)+'"'+((sc?sc.assessor:LS.auth.user.name)===a?' selected':'')+'>'+U.esc(a)+'</option>').join('')+'</select></div>'
      +'<div class="field span2"><label>Note</label><input class="input" id="psNote" value="'+U.esc(sc?sc.note||'':'')+'" placeholder="Agreed with the in-charge at the last visit"></div></div>'
      +'<div class="hint" style="margin-top:10px">Until the visit is recorded the centre reads “not yet visited”. It only reads “not visited” if you confirm that separately, after the quarter closes.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save schedule</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const rec={hcName:el.querySelector('#psCentre').value,quarter:el.querySelector('#psQuarter').value,
          fy:el.querySelector('#psFy').value.trim()||q.fy,plannedDate:el.querySelector('#psDate').value,
          assessor:el.querySelector('#psAssessor').value.trim()||LS.auth.user.name,note:el.querySelector('#psNote').value.trim()};
        if(!rec.plannedDate) return UI.toast('Pick a planned date',{type:'warn'});
        addAssessor(rec.assessor);
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
/* ——— Supervision calendar ——————————————————————————
   The calendar is the plan; a visit is the result. Planned visits are surfaced in
   the notification centre as upcoming live events, so a supervision never arrives
   unannounced. */
function upcomingSlots(days){
  const today=U.todayISO();
  const horizon=U.addDays(today,days||60);
  return schedule().filter(sc=>sc.status!=='notVisited' && sc.plannedDate && sc.plannedDate>=today && sc.plannedDate<=horizon)
    .sort((a,b)=>String(a.plannedDate).localeCompare(String(b.plannedDate)));
}
/* ——— Month calendar ————————————————————————————————
   The plan is a calendar, so the calendar is the control: tap a day to record the
   visit that happened on it, or to put a visit on that day. A day carries three
   kinds of ink — planned, visited, and missed (a planned date gone by with no
   record). */
let calMonth=null;
function calMonthOf(){ return calMonth||U.todayISO().slice(0,7); }
function dayInk(iso){
  const today=U.todayISO();
  const slots=schedule().filter(sc=>sc.plannedDate&&String(sc.plannedDate).slice(0,10)===iso);
  const visits=(S.db().pbfVisits||[]).filter(v=>v.date&&String(v.date).slice(0,10)===iso);
  const plannedDone=slots.filter(sc=>sc.status==='visited');
  const plannedMissed=slots.filter(sc=>sc.status==='notVisited'||(sc.status==='scheduled'&&iso<today));
  const walkin=visits.filter(v=>!plannedDone.some(sc=>sc.visitId===v.id));
  return {slots,visits,plannedDone,plannedMissed,walkin};
}
function calendarHTML(){
  const [y,m]=calMonthOf().split('-').map(Number);
  const first=new Date(y,m-1,1), startDow=(first.getDay()+6)%7;   // Monday first
  const days=new Date(y,m,0).getDate();
  const today=U.todayISO();
  const cells=[];
  for(let i=0;i<startDow;i++) cells.push('<div class="cal-cell blank"></div>');
  for(let d=1;d<=days;d++){
    const iso=calMonthOf()+'-'+String(d).padStart(2,'0');
    const ink=dayInk(iso);
    const classes=['cal-cell'];
    if(iso===today) classes.push('today');
    if(iso<today) classes.push('past');
    if(iso>today) classes.push('future');
    const dots=(ink.plannedDone.length?'<i class="cal-dot done"></i>':'')
      +((ink.slots.length-ink.plannedDone.length)>0&&iso>=today?'<i class="cal-dot planned"></i>':'')
      +(ink.plannedMissed.length?'<i class="cal-dot missed"></i>':'')
      +(ink.walkin.length?'<i class="cal-dot adhoc"></i>':'');
    const n=ink.slots.length+ink.walkin.length;
    cells.push('<button class="'+classes.join(' ')+'" data-cal-day="'+iso+'" title="'+U.fmtDate(iso)+' · '+(n?n+' visit'+(n===1?'':'s')+' on the plan':'nothing planned')+'">'
      +'<span class="cal-num">'+d+'</span>'+(dots?'<span class="cal-dots">'+dots+'</span>':'')
      +(n>2?'<span class="cal-more">+'+n+'</span>':'')+'</button>');
  }
  while(cells.length%7) cells.push('<div class="cal-cell blank"></div>');
  const total=schedule().filter(sc=>sc.plannedDate&&String(sc.plannedDate).slice(0,7)===calMonthOf()).length;
  return '<div class="cal-head"><button class="icon-btn" data-cal-nav="-1" title="Previous month">'+UI.ic('chevron-left',14)+'</button>'
    +'<span class="cal-title">'+U.MONTHS[m-1]+' '+y+'<span class="xs faint"> · '+total+' planned</span></span>'
    +'<button class="icon-btn" data-cal-nav="1" title="Next month">'+UI.ic('chevron-right',14)+'</button>'
    +'<span class="grow"></span><button class="btn xs" data-cal-today>Today</button></div>'
    +'<div class="cal-grid">'+['M','T','W','T','F','S','S'].map(x=>'<div class="cal-dow">'+x+'</div>').join('')+cells.join('')+'</div>'
    +'<div class="cal-legend"><span class="lg"><i class="cal-dot done"></i>visited as planned</span><span class="lg"><i class="cal-dot planned"></i>planned</span>'
      +'<span class="lg"><i class="cal-dot missed"></i>missed</span><span class="lg"><i class="cal-dot adhoc"></i>unscheduled visit</span><span class="lg faint">Tap a day to record a visit</span></div>';
}
function dayModal(iso){
  if(!LS.auth.guard('edit')) return;
  const ink=dayInk(iso);
  const slotRow=(sc,kind)=>{
    const planned=sc.plannedDate?String(sc.plannedDate).slice(0,10):iso;
    const late=iso>planned?Math.round((new Date(iso)-new Date(planned))/86400000):0;
    return '<div class="list-row" style="padding:7px 0"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(sc.hcName)+'</div>'
      +'<div class="lr-sub">'+U.esc(sc.quarter||'')+(sc.fy?' '+U.esc(sc.fy):'')+' · planned '+U.fmtDate(planned)
      +(kind==='visit'?(late>0?' · <b style="color:var(--crit)">'+late+' day'+(late===1?'':'s')+' late</b>':' · on time'):'')
      +' · '+U.esc(sc.assessor||'Unassigned')+'</div></div>'
      +(sc.status==='visited'?'<span class="pill teal">visited</span>'
        :'<button class="btn xs primary" data-day-visit="'+sc.id+'">'+UI.ic('check',12)+'Record today</button>')+'</div>';
  };
  UI.modal({title:U.fmtDate(iso),sub:'Supervision plan for this day — record what happened, or add to the plan.',width:'min(560px,100%)',
    body:(ink.slots.length?'<div class="eyebrow">Planned on the calendar</div>'+ink.slots.map(sc=>slotRow(sc,'visit')).join(''):'<p class="xs faint" style="margin:0 0 8px">Nothing planned for this day.</p>')
      +(ink.walkin.length?'<div class="eyebrow" style="margin-top:10px">Visits recorded on this day outside the plan</div>'
        +ink.walkin.map(v=>'<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(v.hcName)+'</div><div class="lr-sub">'+U.esc(v.quarter||'')+' · '+U.esc(v.assessor||'')+' · index '+(visitTotal(v)==null?'pending':visitTotal(v)+'%')+'</div></div><span class="pill slate">unscheduled</span></div>').join(''):'')
      +'<div class="row gap-sm" style="margin-top:12px;flex-wrap:wrap"><button class="btn" data-day-record>'+UI.ic('plus',13)+'Record a visit on this day</button>'
      +'<button class="btn" data-day-schedule>'+UI.ic('calendar-plus',13)+'Plan a visit for this day</button></div>'
      +'<div class="hint" style="margin-top:10px">Recording a visit on a day that already has a plan fills that slot in and stamps the assessor’s compliance — on time, or late by the number of days.</div>',
    foot:'<button class="btn" data-close>Close</button>',
    onMount:(el,close)=>{
      el.querySelectorAll('[data-day-visit]').forEach(b=>b.onclick=()=>{
        const sc=schedule().find(x=>x.id===b.dataset.dayVisit); if(!sc) return;
        close(); visitModal(null,sc.hcName,sc.quarter,iso);
      });
      el.querySelector('[data-day-record]').onclick=()=>{ close(); visitModal(null,null,null,iso); };
      el.querySelector('[data-day-schedule]').onclick=()=>{ close(); scheduleModal(null,iso); };
    }});
}
function complianceCard(){
  const c=complianceSummary();
  const band=c.pct==null?'slate':bandOf(c.pct);
  return UI.card({title:'Assessor compliance',sub:'Planned date against the date the visit was actually recorded',icon:'user-check',
    tools:'<span class="pill '+band+' mono">'+(c.pct==null?'no visits yet':c.pct+'% on time')+'</span>',
    body:(c.done||c.missed||c.upcoming)
      ?'<div class="row" style="gap:14px;align-items:center;margin-bottom:10px">'
        +(c.pct==null?C.ring(0,{size:84,stroke:7,color:'var(--text-faint)',label:'—'})
          :C.ring(c.pct,{size:84,stroke:7,color:bandColor(c.pct)}))
        +'<div class="comp-chips">'
          +[['On time',c.onTime,'teal'],['Late',c.late,'amber'],['Missed',c.missed,'rose'],['Upcoming',c.upcoming,'blue']]
            .map(([l,v,p])=>'<span class="pill '+p+' mono">'+v+' '+l.toLowerCase()+'</span>').join('')
        +'<div class="xs faint" style="margin-top:4px">'+c.done+' of '+c.all.length+' planned visits have a record'+(c.excused?' · '+c.excused+' excused':'')+'</div></div></div>'
        +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Assessor</th><th class="num">Planned</th><th class="num">On time</th><th class="num">Late</th><th class="num">Missed</th><th>Compliance</th></tr></thead><tbody>'
        +c.people.map(p=>'<tr><td class="strong">'+U.esc(p.name)+'</td><td class="num mono">'+p.done+'</td><td class="num mono">'+p.onTime+'</td>'
          +'<td class="num mono">'+p.late+(p.lateDays?' <span class="xs faint">(+'+p.lateDays+'d)</span>':'')+'</td><td class="num mono">'+p.missed+'</td>'
          +'<td>'+(p.pct==null?'<span class="pill slate">—</span>':'<span class="pill '+bandOf(p.pct)+' mono">'+p.pct+'%</span>')+'</td></tr>').join('')
        +'</tbody></table></div>'
        +'<div class="xs faint" style="margin-top:8px">On-time means the visit was recorded on or before the planned date. A visit confirmed “not visited” after the quarter closes is excused, not missed.</div>'
      :'<p class="xs faint" style="margin:0">No planned visits yet — plan a quarter and the assessor’s compliance builds itself from the calendar.</p>',
    foot:'<span>Defaults to you; pick any lab staff member or add one when recording.</span><span class="mono">'+c.people.length+' assessors</span>'});
}
function scheduleCard(){
  const rows=schedule().slice().sort((a,b)=>String(a.quarter||'').localeCompare(String(b.quarter||''))||String(a.plannedDate||'').localeCompare(String(b.plannedDate||'')));
  const pending=rows.filter(r=>r.status==='scheduled').length;
  const ahead=upcomingSlots(90);
  const byMonth={};
  ahead.forEach(sc=>{ const k=String(sc.plannedDate).slice(0,7); (byMonth[k]=byMonth[k]||[]).push(sc); });
  return UI.card({title:'Supervision calendar',sub:'What is planned, and what is still waiting for a record',icon:'calendar-clock',
    tools:'<button class="btn xs" data-plan-quarter>'+UI.ic('calendar-plus',12)+'Plan quarter</button><button class="btn xs" data-schedule>'+UI.ic('plus',12)+'Visit</button>',
    body:'<div id="pbfCal" class="cal-wrap">'+calendarHTML()+'</div>'
      +(ahead.length?'<div class="row wrap gap-sm" style="margin-bottom:10px;margin-top:12px">'+Object.keys(byMonth).sort().map(k=>{
        const [y,m]=k.split('-');
        return '<div class="card pad" style="background:var(--surface-inset);min-width:150px;flex:1"><div class="eyebrow">'+U.MONTHS[+m-1]+' '+y+'</div>'
          +byMonth[k].map(sc=>'<div class="row between" style="margin-top:5px"><span class="small truncate">'+U.esc(sc.hcName)+'</span><span class="mono xs faint">'+U.fmtDateShort(sc.plannedDate)+'</span></div>').join('')+'</div>';
      }).join('')+'</div>':'')
      +(rows.length?'<div class="dt-scroll" style="max-height:320px"><table class="dt"><thead><tr><th>Health centre</th><th>Quarter</th><th>Planned</th><th>State</th><th></th></tr></thead><tbody>'
      +rows.map(sc=>{
        const st=sc.status==='visited'?{label:'Visited',pill:'teal'}
          :sc.status==='notVisited'?{label:'Not visited',pill:'rose'}
          :{label:'Not yet visited',pill:'blue'};
        const act=sc.status==='visited'?'<span class="xs faint">'+U.fmtDate(sc.visitedAt||sc.plannedDate)+'</span>'
          :sc.status==='notVisited'?'<button class="btn xs" data-sched-undo="'+sc.id+'">Undo</button>'
          :'<button class="btn xs" data-sched-visit="'+sc.id+'">Record</button> <button class="btn xs" data-sched-edit="'+sc.id+'">Edit</button> <button class="btn xs" data-sched-confirm="'+sc.id+'">Not visited</button>';
        return '<tr><td class="strong">'+U.esc(sc.hcName)+'<div class="xs faint">'+U.esc(sc.assessor||'District PBF team')+'</div></td>'
          +'<td class="mono xs">'+U.esc(sc.quarter||'—')+'<div class="xs faint">'+U.esc(sc.fy||'')+'</div></td>'
          +'<td class="num mono xs">'+(sc.plannedDate?U.fmtDate(sc.plannedDate):'not set')+'</td><td><span class="pill '+st.pill+'">'+st.label+'</span></td>'
          +'<td class="num">'+act+'</td></tr>';
      }).join('')+'</tbody></table></div>'
      :'<p class="xs faint" style="margin:0">Nothing planned yet. Record the quarter’s supervision dates — every centre without a visit keeps reading “not yet visited”, never “missed”.</p>'),
    foot:'<span>Planned visits appear in the notification centre as upcoming live events.</span><span class="mono">'+pending+' planned</span>'});
}
function planQuarterModal(){
  if(!LS.auth.guard('edit')) return;
  const q=activeQuarter();
  const centres=U.uniq(S.db().catalog.healthCenters.map(h=>h.name));
  const missing=centres.filter(name=>!schedule().some(sc=>sc.hcName===name && sc.quarter===q.quarter));
  UI.modal({title:'Plan the supervision quarter',sub:q.quarter+' '+q.fy+' · every health centre on one calendar',width:'min(640px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Start date</label><input class="input" type="date" id="pqStart" value="'+U.todayISO()+'"></div>'
      +'<div class="field"><label>Visit every</label><select class="select" id="pqEvery">'+[1,2,3,4].map(n=>'<option value="'+n+'">'+n+' week'+(n>1?'s':'')+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Quarter</label><input class="input mono" id="pqQuarter" value="'+U.esc(q.quarter)+'"></div>'
      +'<div class="field"><label>Fiscal year</label><input class="input mono" id="pqFy" value="'+U.esc(q.fy)+'"></div>'
      +'<div class="field span2"><label>Health centres</label><div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:9px;padding:8px">'
        +centres.map(name=>{ const has=!missing.includes(name);
          return '<label class="row gap-sm" style="padding:3px 0;cursor:pointer"><input type="checkbox" data-pq-centre="'+U.esc(name)+'"'+(has?' disabled':' checked')+'>'
            +'<span class="small grow">'+U.esc(name)+'</span>'+(has?'<span class="xs faint">already planned</span>':'')+'</label>'; }).join('')
        +'</div><div class="xs faint" style="margin-top:6px">Centres already on the '+U.esc(q.quarter)+' calendar are skipped.</div></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Add to calendar</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const start=el.querySelector('#pqStart').value;
        if(!start) return UI.toast('Pick a start date',{type:'warn'});
        const step=(parseInt(el.querySelector('#pqEvery').value,10)||1)*7;
        const quarter=el.querySelector('#pqQuarter').value.trim()||q.quarter;
        const fy=el.querySelector('#pqFy').value.trim()||q.fy;
        const picked=U.$$('[data-pq-centre]',el).filter(c=>c.checked&&!c.disabled).map(c=>c.dataset.pqCentre);
        if(!picked.length) return UI.toast('Tick at least one health centre',{type:'warn'});
        S.commit(d=>{
          d.pbfSchedule=d.pbfSchedule||[];
          picked.forEach((name,i)=>d.pbfSchedule.push({id:U.uid('pbfs'),hcName:name,quarter,fy,
            plannedDate:U.addDays(start,i*step),status:'scheduled',assessor:LS.auth.user.name}));
        },{action:'pbf.schedule.plan',entity:'pbf',detail:picked.length+' centres planned for '+quarter+' '+fy});
        close(); LS.shell.refresh(); UI.toast(picked.length+' visits added to the calendar',{type:'ok'});
      };
    }});
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
function printCentre(r){
  const w=domainWeights();
  const card=r.visit?scorecardOf(r.visit):{complete:false,answered:0,total:questions().length};
  U.printDoc('PBF laboratory evaluation — '+r.name,
    '<table><thead><tr><th>Domain</th><th>Weight</th><th>Questions</th><th>Marks earned</th><th>Domain score</th><th>Weighted</th></tr></thead><tbody>'
    +liveDomains().map(d=>{ const k=d.key; const v=r.scores?r.scores[k]:null; const m=r.dm?r.dm[k]:null;
      return '<tr><td>'+U.esc(d.label)+'</td><td>'+w[k]+'%</td><td>'+domainQuestions(k).length+'</td><td>'+(m?m.got+' / '+m.max:'—')+'</td><td>'+(v==null?'—':v+'%')+'</td><td>'+(v==null?'—':(v*w[k]/100).toFixed(1))+'</td></tr>'; }).join('')
    +'<tr><td colspan="3"><b>Index — marks earned over marks available</b></td><td><b>'+(r.marks?r.marks.got+' / '+r.marks.max:'—')+'</b></td><td colspan="2"><b>'+(total(r)==null?'marks pending':total(r)+'%')+'</b></td></tr></tbody></table>'
    +'<p style="font-size:8.5px;margin:4px 0">Domain scores are percentages of each domain’s own marks. The index is the whole scorecard’s marks out of the marks available, converted to 100; the weights describe the composition of the report and are not applied to the index.</p>'
    +'<p style="font-size:9px;margin:6px 0">Scorecard '+(card.complete?'complete':'incomplete — '+card.answered+' of '+card.total+' questions marked')+'.</p>'
    +(r.visit?'<h3 style="font-size:9px;margin:10px 0 4px">Questions evaluated — '+U.esc(r.visit.quarter||'')+' · '+U.fmtDate(r.visit.date)+'</h3><table><thead><tr><th>Question</th><th>Domain</th><th>Marks</th></tr></thead><tbody>'
      +questions().map(q=>{ const v=r.visit.answers&&r.visit.answers[q.id];
        return '<tr><td>'+U.esc(q.text)+'</td><td>'+U.esc(domainLabel(q.domain))+'</td><td style="text-align:center">'+(v==null?'—':v+' / '+q.max)+'</td></tr>'; }).join('')
      +'</tbody></table>':'')
    +(r.visit&&r.visit.recommendations?'<h3 style="font-size:9px;margin:10px 0 4px">Recommendations</h3><p style="font-size:9px">'+U.esc(r.visit.recommendations)+'</p>':'')
    +(r.visit&&r.visit.previous?'<p style="font-size:9px">Previous ('+U.esc(r.visit.previous.quarter||'')+'): '+U.esc(r.visit.previous.text||'—')+' — addressed: '+U.esc(r.visit.previous.addressed||'not stated')+'</p>':'')
    +'<h3 style="font-size:9px;margin:10px 0 4px">Visit history</h3><table><thead><tr><th>Quarter</th><th>Date</th><th>Assessor</th><th>Index</th></tr></thead><tbody>'
    +(visitsFor(r.name).length?visitsFor(r.name).map(v=>{ const vt=visitTotal(v); return '<tr><td>'+U.esc(v.quarter||'')+'</td><td>'+U.fmtDate(v.date)+'</td><td>'+U.esc(v.assessor||'')+'</td><td>'+(vt==null?'pending':vt+'%')+'</td></tr>'; }).join(''):'<tr><td colspan="4">No visits recorded</td></tr>')
    +'</tbody></table>',
    {meta:'<span>'+(r.submitted?'Assessed '+U.fmtDate(r.submitted):'Not yet visited')+'</span><span>'+U.esc(r.assessor||'District PBF team')+'</span>'});
}
function printDistrict(){
  const rows=list().filter(r=>total(r)!=null).sort((a,b)=>total(b)-total(a));
  const w=domainWeights();
  U.printDoc('District PBF laboratory report — Q1 FY 2026/2027',
    '<table><thead><tr><th>Rank</th><th>Health centre</th>'+liveDomains().map(d=>'<th>'+U.esc(d.label.split(' ')[0])+' ('+w[d.key]+'%)</th>').join('')+'<th>Index</th><th>Prev</th><th>Δ</th></tr></thead><tbody>'
    +rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+U.esc(r.name)+'</td>'+liveDomains().map(d=>'<td>'+(r.scores[d.key]==null?'—':r.scores[d.key])+'</td>').join('')+'<td><b>'+total(r)+'</b></td><td>'+(r.prior==null?'—':r.prior)+'</td><td>'+((delta(r)||0)>0?'+':'')+(delta(r)||0)+'</td></tr>').join('')
    +'<tr><td colspan="2"><b>District average</b></td>'+liveDomains().map(d=>{ const vals=rows.map(r=>r.scores[d.key]).filter(v=>v!=null); return '<td>'+(vals.length?Math.round(U.avg(vals)):'—')+'</td>'; }).join('')+'<td><b>'+(rows.length?Math.round(U.avg(rows.map(total))):'—')+'</b></td><td></td><td></td></tr></tbody></table>',
    {landscape:true,meta:'<span>Gakenke District · PBF laboratory indicators</span><span>'+(list().length-rows.length)+' centres without a complete scorecard</span>'});
}
M.render=function(root,params){
  rootEl=root; sort=params.sort||'total'; q=params.q||'';
  ensureSeeded();
  root.innerHTML='<div class="page-head"><div><h1>PBF evaluation</h1><div class="sub">Performance-based financing. Every centre is scored on the questions you keep in the bank, and a visit only counts once every question carries a mark.</div></div>'
   +'<div class="actions"><a class="btn" href="#/quality">'+UI.ic('shield-check',15)+' ISO readiness</a><button class="btn" data-district>'+UI.ic('printer',15)+' District report</button><button class="btn primary" data-new-visit>'+UI.ic('plus',15)+' Record visit</button></div></div>'
   +kpis()+hero()
   +'<div class="section-head"><h2>Centre scorecards</h2><span class="more">Click any row for the full evaluation</span></div>'
   +table()
   +'<div class="section-head"><h2>Domain comparison</h2><span class="more">'+liveDomains().length+' domains in use · each cell is that domain’s own % <button class="btn xs" data-manage-domains>'+UI.ic('layers',11)+'Manage domains</button></span></div>'
   +matrix()
   +'<div class="section-head"><h2>Evaluation questions & visits</h2><span class="more">Questions, marks and the supervision calendar</span></div>'
   +'<div class="grid-12"><div class="c7">'+questionBank()+'</div><div class="c5">'+scheduleCard()
   +'<div style="margin-top:14px">'+complianceCard()+'</div>'
   +'<div style="margin-top:14px">'+visitLog()+'</div></div></div>';

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
  root.querySelectorAll('[data-manage-domains]').forEach(b=>b.onclick=()=>domainModal());
  root.querySelectorAll('[data-edit-q]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); questionModal(b.dataset.editQ); });
  root.querySelectorAll('[data-open-visit]').forEach(el=>el.onclick=ev=>{ ev.stopPropagation(); visitModal(el.dataset.openVisit); });
  root.querySelectorAll('[data-schedule]').forEach(b=>b.onclick=()=>scheduleModal(null));
  root.querySelectorAll('[data-sched-visit]').forEach(b=>b.onclick=()=>{ const sc=schedule().find(x=>x.id===b.dataset.schedVisit); visitModal(null, sc?sc.hcName:null, sc?sc.quarter:null); });
  root.querySelectorAll('[data-sched-confirm]').forEach(b=>b.onclick=()=>confirmNotVisited(b.dataset.schedConfirm));
  root.querySelectorAll('[data-sched-undo]').forEach(b=>b.onclick=()=>undoNotVisited(b.dataset.schedUndo));
  root.querySelectorAll('[data-plan-quarter]').forEach(b=>b.onclick=()=>planQuarterModal());
  /* calendar month grid */
  const shiftCal=n=>{ const [y,m]=calMonthOf().split('-').map(Number); const d=new Date(y,m-1+n,1);
    calMonth=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); paintCal(); };
  const bindCal=()=>{
    const cal=root.querySelector('#pbfCal'); if(!cal) return;
    cal.querySelectorAll('[data-cal-day]').forEach(b=>b.onclick=()=>dayModal(b.dataset.calDay));
    cal.querySelectorAll('[data-cal-nav]').forEach(b=>b.onclick=()=>shiftCal(+b.dataset.calNav));
    const t=cal.querySelector('[data-cal-today]'); if(t) t.onclick=()=>{ calMonth=U.todayISO().slice(0,7); paintCal(); };
  };
  const paintCal=()=>{ const cal=root.querySelector('#pbfCal'); if(!cal) return; cal.innerHTML=calendarHTML(); bindCal(); };
  bindCal();
  root.querySelectorAll('[data-sched-edit]').forEach(b=>b.onclick=()=>scheduleModal(b.dataset.schedEdit));
  /* multi-select question bank */
  const selState=()=>U.$$('[data-q-sel]',root).filter(c=>c.checked).map(c=>c.dataset.qSel);
  const refreshSel=()=>{
    const ids=selState();
    const count=root.querySelector('#qSelCount'); if(count) count.textContent=ids.length+' selected';
    const del=root.querySelector('[data-del-selected]'); if(del) del.disabled=!ids.length;
    const mv=root.querySelector('[data-move-selected]'); if(mv) mv.disabled=!ids.length;
    const mt=root.querySelector('#qMoveTarget'); if(mt) mt.disabled=!ids.length;
    const all=root.querySelector('[data-q-all]'); if(all){ const boxes=U.$$('[data-q-sel]',root); all.checked=boxes.length>0&&ids.length===boxes.length; all.indeterminate=ids.length>0&&ids.length<boxes.length; }
    U.$$('[data-q-group-all]',root).forEach(g=>{ const boxes=U.$$('[data-q-sel]',root).filter(c=>{ const q=qById(c.dataset.qSel); return q&&q.domain===g.dataset.qGroupAll; });
      g.checked=boxes.length>0&&boxes.every(c=>c.checked); g.indeterminate=boxes.some(c=>c.checked)&&!g.checked; });
  };
  root.querySelectorAll('[data-q-sel]').forEach(c=>{ c.onclick=ev=>{ ev.stopPropagation(); refreshSel(); }; });
  const allBox=root.querySelector('[data-q-all]');
  if(allBox) allBox.onclick=()=>{ U.$$('[data-q-sel]',root).forEach(c=>{ c.checked=allBox.checked; }); refreshSel(); };
  root.querySelectorAll('[data-q-group-all]').forEach(g=>{ g.onclick=()=>{ U.$$('[data-q-sel]',root).forEach(c=>{ const q=qById(c.dataset.qSel); if(q&&q.domain===g.dataset.qGroupAll) c.checked=g.checked; }); refreshSel(); }; });
  const delSel=root.querySelector('[data-del-selected]');
  if(delSel) delSel.onclick=()=>deleteQuestions(selState());
  const mvSel=root.querySelector('[data-move-selected]');
  if(mvSel) mvSel.onclick=()=>{ const t=root.querySelector('#qMoveTarget'); moveQuestions(selState(), t?t.value:null); };
  refreshSel();
  root.querySelectorAll('[data-restore-q]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); restoreQuestion(b.dataset.restoreQ); });
};
})();
