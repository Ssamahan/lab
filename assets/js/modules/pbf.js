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
  ['quality','Quality control charts completed and reviewed daily',5],
  ['quality','EQA/PT panels analysed and results returned on time',5],
  ['quality','Non-conformances logged with corrective action',5],
  ['tat','Referred samples dispatched within 24 hours',5],
  ['tat','Turnaround time monitored against the test menu targets',5],
  ['tat','Rejection and re-draw rate reviewed monthly',5],
  ['stock','Stock cards match physical counts',5],
  ['stock','No stock-out of tracer commodities in the quarter',5],
  ['stock','Cold chain temperature log complete and signed',5],
  ['data','Register complete: no missing patient or result fields',5],
  ['data','Monthly HMIS/lab report submitted by the 5th',5],
  ['data','Results traceable to specimen and requester',5],
  ['hr','Duty roster published and followed',5],
  ['hr','Every staff member has a current competency file',5],
  ['hr','Safety briefing and PEP protocol known by all staff',5],
  ['infra','Equipment maintenance log up to date',5],
  ['infra','Waste segregation and sharps disposal correct',5],
  ['infra','Water, power and bench space adequate for the workload',5]
];
function questions(){
  const db=S.db();
  if(!db.pbfQuestions) db.pbfQuestions=DEFAULT_QUESTIONS.map(([domain,text,max],i)=>({id:'q'+(i+1),domain,text,max,active:true}));
  return db.pbfQuestions;
}
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
function list(){
  const centres=S.db().catalog.healthCenters.map(h=>h.name);
  const names=U.uniq(centres.concat((S.db().pbf||[]).map(r=>r.name)).concat((S.db().pbfVisits||[]).map(v=>v.hcName)));
  return names.map((name,i)=>{
    const vs=visitsFor(name);
    const legacy=(S.db().pbf||[]).find(r=>r.name===name);
    if(!vs.length && legacy) return legacy;
    if(!vs.length) return {id:'hc-'+i,name,scores:{},prior:0,submitted:null,assessor:'',visits:0};
    const latest=vs[0], prev=vs[1];
    const scores=visitScore(latest);
    return {id:latest.id,name,scores,total:visitTotal(latest),prior:prev?visitTotal(prev):0,
      submitted:latest.date,assessor:latest.assessor||'District PBF team',quarter:latest.quarter,fy:latest.fy,
      visit:latest,visits:vs.length,status:'draft'};
  });
}
function total(row){ return Math.round(DOMAINS.reduce((a,[k,,w])=>a+(row.scores[k]||0)*w/100,0)); }
function tone(v){ return v>=85?'teal':v>=70?'gold':'rose'; }
function delta(r){ return total(r)-(r.prior||total(r)); }
function stats(){
  const rows=list();
  return {avg:Math.round(U.avg(rows.map(total))), top:rows.slice().sort((a,b)=>total(b)-total(a))[0], bottom:rows.slice().sort((a,b)=>total(a)-total(b))[0],
    below:rows.filter(r=>total(r)<70).length, improved:rows.filter(r=>delta(r)>0).length, rows};
}
function kpis(){
  const s=stats();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'District average',value:s.avg,unit:'%',icon:'chart-line',formatted:'0',delta:3.4,note:s.rows.length+' health centres · Q1 FY 26/27',spark:C.spark(s.rows.map(total),{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Leading centre',value:s.top?total(s.top):0,unit:'%',icon:'award',formatted:'0',note:s.top?s.top.name:'—',spark:C.spark([62,66,70,71,74,78,total(s.top||{scores:{}})],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Below 70% floor',value:s.below,icon:'alert-triangle',formatted:'0',note:s.below?'Support plan required':'All centres above floor',spark:C.spark([3,3,2,2,2,1,1,s.below],{color:'var(--crit)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Improved vs Q4',value:s.improved,unit:'/ '+s.rows.length,icon:'trending-up',formatted:'0',note:'Quarter-on-quarter movement',spark:C.spark([2,3,3,4,4,5,5,s.improved],{color:'var(--pos)'})})+'</div></div>';
}
function hero(){
  const s=stats(); const rows=s.rows.slice().sort((a,b)=>total(b)-total(a));
  return '<div class="grid-12"><div class="c12">'+UI.card({title:'Quarterly index',sub:'Weighted laboratory score · Q1 FY 2026/2027 · draft returns',icon:'building-2',
    tools:'<span class="chip gold">'+UI.ic('file-text',12)+'Verification meeting 12 Nov</span>',
    body:'<div class="pbf-strip">'+rows.map((r,i)=>{
      const t=total(r), d=delta(r);
      return '<div class="pbf-col" data-pbf="'+r.id+'" title="'+U.esc(r.name)+' · '+t+'%">'
        +'<div class="pbf-bar" style="height:'+U.clamp(t,4,100)+'%"><span class="pbf-fill '+(t>=85?'teal':t>=70?'gold':'rose')+'"></span></div>'
        +'<div class="pbf-rank mono">#'+(i+1)+'</div><div class="pbf-name">'+U.esc(r.name.replace(' HC',''))+'</div>'
        +'<div class="mono xs '+(d>0?'':'')+'" style="color:var(--'+(d>0?'pos':d<0?'crit':'text-faint')+')">'+(d>0?'+':'')+d+'</div></div>';
    }).join('')+'</div>'
    +'<div class="pbf-axis"><span class="xs faint">20%</span><span class="xs faint">70% floor</span><span class="xs faint">100%</span></div>'})+'</div></div>';
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
      +'<td><div class="primary-cell"><b>'+U.esc(r.name)+'</b><small>'+U.esc(r.assessor||'District PBF team')+' · '+U.fmtDate(r.submitted)+'</small></div></td>'
      +DOMAINS.map(([k])=>'<td class="num"><span class="mono xs" style="color:var(--'+(r.scores[k]>=85?'pos':r.scores[k]>=70?'gold-bright':'crit')+')">'+r.scores[k]+'</span></td>').join('')
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
        return '<td><span class="heat-tile" data-tip="'+U.esc(DOMAINS.find(d=>d[0]===k)[1]+' · '+v+'%')+'" style="--a:'+((v/100)*0.9+0.06).toFixed(2)+';--tone:'+(v>=85?'63,211,182':v>=70?'201,168,76':'227,114,124')+'">'+v+'</span></td>';
      }).join('')+'<td><b class="mono">'+total(r)+'</b></td></tr>').join('')
    +'</tbody></table></div><div class="card-foot"><span>Cell intensity maps the score; 85%+ is green, under 70% is red</span><span class="mono">6 domains</span></div>'});
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
      +'<span class="mono small" style="color:var(--'+(v>=85?'pos':v>=70?'gold-bright':'crit')+')">'+v+'%</span></div>'
      +UI.meter(v,v>=85?'teal':v>=70?'gold':'rose',prev)+'<div class="xs faint" style="margin-top:3px">Marker shows the Q4 position</div></div>'; }).join('')
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
          +qs.map(q=>{ const v=r.visit.answers&&r.visit.answers[q.id]; const ok=v!=null&&+v>=q.max*0.8;
            return '<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">'+U.esc(r.visit.quarter)+' · max '+q.max+'</div></div><span class="pill '+(v==null?'slate':ok?'teal':+v>=q.max*0.5?'amber':'rose')+' mono">'+(v==null?'—':v+'/'+q.max)+'</span></div>';
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
  if(db.meta&&db.meta.pbfVisitsSeeded) return;
  const legacy=db.pbf||[]; if(!legacy.length){ db.meta.pbfVisitsSeeded=true; return; }
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
}
function visitModal(id,presetCentre){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const v=id?(db.pbfVisits||[]).find(x=>x.id===id):null;
  const centres=U.uniq(db.catalog.healthCenters.map(h=>h.name).concat((db.pbf||[]).map(r=>r.name)));
  const qs=questions();
  const answers=v?(v.answers||{}):{};
  const section=k=>qs.filter(q=>q.domain===k).map(q=>{
    const val=answers[q.id];
    return '<div class="row between gap-sm" style="padding:5px 0;border-bottom:1px solid var(--border)"><span class="small grow" style="max-width:74%">'+U.esc(q.text)+'</span>'
      +'<span class="row gap-sm"><input class="input mono" data-q="'+q.id+'" type="number" min="0" max="'+q.max+'" step="1" value="'+(val==null?'':val)+'" style="width:64px" placeholder="—"><span class="xs faint">/'+q.max+'</span></span></div>';
  }).join('');
  UI.modal({title:v?'Edit PBF visit':'Record PBF visit',sub:'Marks per question · the centre keeps every visit, so quarterly progress is visible.',width:'min(780px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Health centre</label><select class="select" id="pvCentre">'+centres.map(c=>'<option'+((v?v.hcName===c:presetCentre===c)?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Quarter</label><input class="input mono" id="pvQuarter" value="'+U.esc(v?v.quarter:'Q1')+'"></div>'
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
      inputs().forEach(i=>i.addEventListener('input',preview));
      preview();
      el.querySelector('[data-all-max]').onclick=()=>{ inputs().forEach(i=>{ const q=qById(i.dataset.q); i.value=q?q.max:5; }); preview(); };
      el.querySelector('[data-save]').onclick=()=>{
        const hcName=el.querySelector('#pvCentre').value;
        const answers=currentAnswers();
        if(!Object.keys(answers).length) return UI.toast('Enter at least one question mark',{type:'warn'});
        const rec={hcName,quarter:el.querySelector('#pvQuarter').value.trim()||'Q1',fy:U.fyLabel(),
          date:el.querySelector('#pvDate').value,assessor:el.querySelector('#pvAssessor').value.trim(),
          answers,note:el.querySelector('#pvNote').value.trim()};
        S.commit(d=>{
          d.pbfVisits=d.pbfVisits||[];
          if(v){ const x=d.pbfVisits.find(y=>y.id===v.id); if(x) Object.assign(x,rec); }
          else d.pbfVisits.unshift(Object.assign({id:U.uid('pbfv')},rec));
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
      +'<div class="field"><label>Maximum marks</label><input class="input mono" type="number" min="1" max="20" id="qbMax" value="'+(q?q.max:5)+'"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save question</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const text=el.querySelector('#qbText').value.trim();
        if(!text) return UI.toast('Question text required',{type:'warn'});
        const rec={domain:el.querySelector('#qbDomain').value,text,max:Math.max(1,parseInt(el.querySelector('#qbMax').value,10)||5),active:true};
        S.commit(d=>{ d.pbfQuestions=d.pbfQuestions||questions().slice();
          if(q){ const i=d.pbfQuestions.findIndex(x=>x.id===q.id); if(i>=0) d.pbfQuestions[i]=Object.assign({},d.pbfQuestions[i],rec); }
          else d.pbfQuestions.push(Object.assign({id:U.uid('q')},rec)); },
          {action:'pbf.question.'+(q?'edit':'add'),entity:'pbf',detail:rec.text.slice(0,80)});
        close(); LS.shell.refresh(); UI.toast('Question bank updated',{type:'ok'});
      };
    }});
}
function questionBank(){
  const qs=questions();
  return UI.card({title:'Question bank',sub:'What is evaluated on every quarterly visit · '+qs.length+' questions',icon:'list-checks',
    tools:'<button class="btn xs" data-add-q>'+UI.ic('plus',12)+'Add question</button>',
    body:DOMAINS.map(([k,label,w])=>{ const group=qs.filter(q=>q.domain===k);
      return '<div style="margin-bottom:10px"><div class="row between"><span class="eyebrow">'+U.esc(label)+' <span class="faint">· '+w+'% of index</span></span><span class="xs faint">'+group.length+' questions</span></div>'
        +group.map(q=>'<div class="list-row" style="padding:6px 0"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(q.text)+'</div><div class="lr-sub">max '+q.max+' marks</div></div>'
          +'<div class="row gap-sm"><button class="icon-btn" style="width:24px;height:24px" data-edit-q="'+q.id+'">'+UI.ic('pencil',12)+'</button></div></div>').join('')
        +'</div>';
    }).join('')});
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
   +'<div class="grid-12"><div class="c7">'+questionBank()+'</div><div class="c5">'+visitLog()+'</div></div>';

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
};
})();
