/* ============================================================================
   MODULE · EQA / PT SCORES — scorecard, z-scores, Westgard calendar, CAPA
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.eqa=M;
let rootEl=null, tab='scorecard', celebrated=false;

/* One round's percentage, read from the record and nothing else.
   Schemes the provider scores in % carry that figure. Schemes scored as a
   standard-deviation index use the provider's own criterion — |z| ≤ 2 is
   satisfactory, 2 to 3 is questionable, 3 and above is unsatisfactory — so a
   passing round reads 100 %, not a made-up "100 − z × 25". */
function ptAnalyteIncluded(program,name){return !(String(program||'').trim().toLowerCase()==='hematology'&&String(name||'').trim().toLowerCase()==='mcv');}
function pctOf(e){
  if(!e) return null;
  if(e.scorePercent!=null && isFinite(+e.scorePercent)) return Math.round(+e.scorePercent*10)/10;
  const raw=Object.keys(e.analytes||{}).filter(k=>ptAnalyteIncluded(e.program,k)).map(k=>e.analytes[k]).filter(v=>v!=null&&isFinite(v));
  if(/^%$/.test(e.scoring)){ if(raw.length) return Math.round(U.avg(raw)*10)/10; }
  const zs=raw.map(Math.abs);
  if(!Object.keys(e.analytes||{}).length&&e.score!=null&&isFinite(+e.score)) zs.push(Math.abs(+e.score));
  if(!zs.length) return null;
  const z=Math.max.apply(null,zs);
  return z>=3?0:z>=2?50:100;
}
/* The rounds grouped by the quarter they belong to, ordered by when the
   material actually went out. Nothing is extrapolated: a quarter with no
   recorded score simply does not appear. */
function ptQuarter(code){
  const raw=String(code||'').trim();
  let m=/^Q([1-4])\s+(\d{4})\s*\/\s*(\d{2}|\d{4})$/i.exec(raw),year,q,end;
  if(m){q=+m[1];year=+m[2];end=+m[3];}
  else {m=/^(\d{4})\s*\/\s*(\d{2}|\d{4})\s+Q([1-4])$/i.exec(raw);if(!m)return null;year=+m[1];end=+m[2];q=+m[3];}
  if(end<100) end=Math.floor(year/100)*100+end;
  if(end!==year+1)return null;
  return {index:year*4+q-1,label:year+'/'+end+' Q'+q};
}
function quarterLabel(index){const year=Math.floor(index/4);return year+'/'+(year+1)+' Q'+(index%4+1);}
function quarters(){
  const map={};
  S.db().eqa.forEach(e=>{
    const pct=pctOf(e); if(pct==null) return;
    const quarter=ptQuarter(e.code),key=quarter?quarter.label:(e.code||'Unlabelled round');
    const q=map[key]=map[key]||{label:key,index:quarter?quarter.index:null,first:e.delivered||e.reported||'9999',pcts:[],schemes:[]};
    q.pcts.push(pct);
    q.schemes.push({name:e.program,pct,raw:e});
    const d=e.delivered||e.reported||''; if(d && d<q.first) q.first=d;
  });
  return Object.keys(map).map(k=>map[k])
    .sort((a,b)=>a.index!=null&&b.index!=null?a.index-b.index:a.index!=null?-1:b.index!=null?1:String(a.first).localeCompare(String(b.first)))
    .map(q=>({label:q.label, first:q.first, count:q.pcts.length,
      value:Math.round(U.avg(q.pcts)*10)/10,
      schemes:q.schemes.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)))}));
}
function composite(){
  const latest=S.eqaLatest();
  const vals=Object.keys(latest).map(k=>pctOf(latest[k])).filter(v=>v!=null);
  return vals.length?Math.round(U.avg(vals)*10)/10:0;
}
/* Only the quarters that have real scores, plotted in order. */
function trend(){
  const qs=quarters();
  return {labels:qs.map(q=>q.label), values:qs.map(q=>q.value), points:qs, quarters:qs};
}
/* How the composite moved between the two most recent quarters — computed, never
   typed in. Null when there is only one quarter to compare. */
function movement(){
  const qs=quarters(); if(qs.length<2) return null;
  return Math.round((qs[qs.length-1].value-qs[qs.length-2].value)*10)/10;
}
/* ——— Round lifecycle —————————————————————————————
   A round is recorded when the material is tested and sent off, long before the
   report arrives. `stage` is derived, never guessed:
   awaiting  → no result values yet (we are waiting for the provider)
   reported  → values/results entered, verdict pending
   scored    → verdict + publication date recorded
   Every step is timestamped so turnaround is measurable. */
function stageOf(e){
  if(e.stage) return e.stage;
  const hasVals=e.analytes&&Object.keys(e.analytes).length;
  if(!hasVals&&!e.reported) return 'awaiting';
  if(!e.overall||!/pass|review|fail/i.test(e.overall)) return 'reported';
  return 'scored';
}
const STAGE={awaiting:{label:'Awaiting results',tone:'amber'},reported:{label:'Results in — review',tone:'blue'},scored:{label:'Scored',tone:'teal'}};
function daysBetweenSafe(a,b){ return (a&&b&&b>=a)?U.daysBetween(a,b):null; }
function turnaround(e){
  return {
    toResult:daysBetweenSafe(e.delivered,e.reported),
    toScore:daysBetweenSafe(e.delivered,e.scorePublished),
    testLag:daysBetweenSafe(e.delivered,e.tested)
  };
}
function awaitingRounds(){ return S.db().eqa.filter(e=>stageOf(e)==='awaiting'); }
function kpis(){
  const latest=S.eqaLatest();
  const schemes=Object.keys(latest);
  const passing=schemes.filter(k=>{ const e=latest[k]; return e.overall==='Pass'&&e.scorePercent>=S.EQA_MIN; }).length;
  const zs=[];
  S.db().eqa.filter(e=>e.scoring==='SD').forEach(e=>Object.entries(e.analytes||{}).forEach(([name,v])=>{if(ptAnalyteIncluded(e.program,name)&&v!=null&&v!==''&&Number.isFinite(Number(v))) zs.push(Math.abs(Number(v)));}));
  const waiting=awaitingRounds();
  const oldest=waiting.map(e=>U.daysBetween(e.delivered||U.todayISO(),U.todayISO())).sort((a,b)=>b-a)[0]||0;
  const closed=S.db().eqa.filter(e=>stageOf(e)==='scored'&&e.reported&&e.delivered);
  const avgTat=closed.length?Math.round(U.avg(closed.map(e=>U.daysBetween(e.delivered,e.reported)))*10)/10:null;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Composite score',value:composite(),dec:1,unit:'%',icon:'target',formatted:'0.0',delta:movement(),note:'Mean of the latest score in '+schemes.length+' schemes',spark:C.spark(trend().values.length?trend().values:[composite()],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Awaiting results',value:waiting.length,icon:'hourglass',formatted:'0',note:waiting.length?'Oldest: '+oldest+' days since dispatch':'Nothing outstanding',spark:C.spark([0,1,1,2,1,2,2,3,waiting.length],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Report turnaround',value:avgTat==null?0:avgTat,dec:1,unit:'days',icon:'timer',formatted:'0.0',note:closed.length?closed.length+' rounds from dispatch to report':'No completed rounds yet',spark:C.spark([9,8,9,7,7,6,6,5,avgTat||0],{color:'var(--info)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Max |z| score',value:Math.round(Math.max.apply(null,zs.concat([0]))*10)/10,dec:1,icon:'activity',formatted:'0.0',note:'Acceptable ≤ 2.0 · alert ≥ 3.0',spark:C.spark(zs.slice(-12),{color:'var(--teal, #3fb3a6)'})})+'</div></div>';
}
/* Analytes are remembered per scheme, so recording a round never asks for the
   list again — it arrives pre-filled and can still be extended. */
function analyteCatalog(program){
  const seen={};
  S.db().eqa.filter(e=>e.program===program).forEach(e=>Object.keys(e.analytes||{}).forEach(a=>{ seen[a]=(seen[a]||0)+1; }));
  Object.keys((S.db().eqaAnalytes||{})[program]||{}).forEach(a=>{ seen[a]=(seen[a]||0)+1; });
  return Object.keys(seen).filter(a=>ptAnalyteIncluded(program,a)).sort((a,b)=>seen[b]-seen[a]||a.localeCompare(b));
}
function schemeGroups(){
  const db=S.db(); const by={};
  db.eqa.forEach(e=>{ (by[e.program]=by[e.program]||[]).push(e); });
  return Object.keys(by).sort().map(program=>{
    const rounds=by[program].slice().sort((a,b)=>String(b.delivered||b.reported||'').localeCompare(String(a.delivered||a.reported||'')));
    const analytes=analyteCatalog(program);
    return {program,rounds,analytes};
  });
}
/* Every recorded round, laid out by scheme and quarter — the scores exactly as
   they were recorded. Empty cells are quarters with no record, not zeroes. */
function schemeMatrix(){
  const qs=quarters(); if(!qs.length) return '';
  const names=[];
  qs.forEach(q=>q.schemes.forEach(x=>{ if(names.indexOf(x.name)<0) names.push(x.name); }));
  const cell=(q,name)=>{
    const hit=q.schemes.filter(x=>x.name===name)[0];
    if(!hit) return '<td class="num"><span class="xs faint">no round</span></td>';
    const e=hit.raw, pct=hit.pct;
    const tone=pct>=S.EQA_MIN?'teal':pct>=S.EQA_MIN-10?'amber':'rose';
    const shown=e.scorePercent!=null ? pct+'%' : (e.scoring==='%' ? pct+'%' : (e.score!=null ? (e.score>0?'+':'')+e.score+' SD' : pct+'%'));
    return '<td class="num"><span class="pill '+tone+' mono" title="'+U.esc((e.overall||'')+' · '+(e.code||''))+'">'+U.esc(shown)+'</span>'
      +(e.scorePercent==null&&e.scoring!=='%'?'<div class="xs faint" style="margin-top:2px">'+(pct>=S.EQA_MIN?'satisfactory':pct>=50?'questionable':'unsatisfactory')+'</div>':'')+'</td>';
  };
  return '<div class="dt-scroll" style="margin-top:12px"><table class="dt"><thead><tr><th>Scheme</th>'
    +qs.map(q=>'<th class="num">'+U.esc(q.label)+'</th>').join('')+'</tr></thead><tbody>'
    +names.map(n=>'<tr><td class="small">'+U.esc(n)+'</td>'+qs.map(q=>cell(q,n)).join('')+'</tr>').join('')
    +'</tbody></table></div>';
}
function scorecard(){
  const db=S.db(); const latest=S.eqaLatest();
  const schemes=Object.keys(latest).map(k=>{ const e=latest[k]; const pct=pctOf(e)||0;
    return {name:k,e,pct:Math.round(pct),stage:stageOf(e)}; });
  const tr=trend();
  const groups=schemeGroups();
  const val=e=>e.scorePercent!=null?e.scorePercent+'%':(e.score!=null?e.score+' SD':'—');
  const cellPill=(v,scoring)=>{
    if(v==null) return '<span class="xs faint">—</span>';
    const bad=scoring==='%'?(v<S.EQA_MIN):(Math.abs(v)>=3), warn=scoring==='%'?(v<S.EQA_MIN):(Math.abs(v)>=2);
    return '<span class="pill '+(bad?'rose':warn?'amber':'teal')+' mono">'+(scoring==='%'?v+'%':(v>0?'+':'')+v)+'</span>';
  };
  const schemeTables = groups.map(g=>{
    const head='<thead><tr><th>Round</th><th>Dispatched</th><th>Reported</th><th>TAT</th>'
      +g.analytes.map(a=>'<th class="num">'+U.esc(a)+'</th>').join('')+'<th>Status</th><th>Verdict</th></tr></thead>';
    const body=g.rounds.map(e=>{
      const st=stageOf(e), tu=turnaround(e);
      return '<tr data-eqa="'+e.id+'"><td class="strong">'+U.esc(e.code||'—')+'</td>'
        +'<td class="num">'+U.fmtDate(e.delivered)+'</td>'
        +'<td class="num">'+(e.reported?U.fmtDate(e.reported):'<span class="xs faint">waiting</span>')+'</td>'
        +'<td class="num">'+(tu.toResult==null?'<span class="xs faint">—</span>':tu.toResult+'d')+'</td>'
        +g.analytes.map(a=>'<td class="num">'+cellPill((e.analytes||{})[a],e.scoring)+'</td>').join('')
        +'<td><span class="pill '+STAGE[st].tone+'">'+STAGE[st].label+'</span></td>'
        +'<td>'+(e.overall?'<span class="pill '+(/pass/i.test(e.overall)?'teal':/review/i.test(e.overall)?'amber':'rose')+'">'+U.esc(e.overall)+'</span>':'<span class="xs faint">pending</span>')+'</td></tr>';
    }).join('');
    const awaiting=g.rounds.filter(e=>stageOf(e)==='awaiting').length;
    return UI.card({title:g.program,sub:g.rounds.length+' round'+(g.rounds.length===1?'':'s')+' · newest first · '+g.analytes.length+' analytes tracked',icon:'award',
      cls:'', tools:'<div class="row gap-sm">'+(awaiting?'<span class="pill amber">'+awaiting+' awaiting</span>':'')
        +'<button class="btn xs" data-new-eqa-program="'+U.esc(g.program)+'">'+UI.ic('plus',12)+'Round</button></div>',
      body:'<div class="dt-scroll" style="max-height:none"><table class="dt">'+head+'<tbody>'+body+'</tbody></table></div>'});
  }).join('');

  return '<div class="grid-12">'
   +'<div class="c8">'+UI.card({title:'Quarterly composite',sub:'Every recorded round · minimum acceptable '+(S.EQA_MIN)+'%',icon:'chart-line',cls:'gold',
      tools:'<span class="pill '+(composite()>=S.EQA_MIN?'teal':'amber')+'">'+composite()+'% composite</span>',
      body:'<div id="eqaTrend"></div>'+schemeMatrix(),
      foot:'<span>Dashed band = minimum acceptable performance ('+(S.EQA_MIN)+'%) · a quarter with no recorded score is not plotted</span><span class="mono">'+quarters().length+' quarter'+(quarters().length===1?'':'s')+' · '+S.db().eqa.length+' rounds</span>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Overall standing',sub:'Traffic-light interpretation',icon:'shield-check',body:
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">'+C.ring(composite(),{size:104,stroke:7})+'<div><div class="strong">'+(composite()>=(S.EQA_MIN+3)?'Excellent':composite()>=S.EQA_MIN?'Acceptable':'Action required')+'</div><div class="xs faint" style="margin-top:3px">ISO 15189 §7.7.3<br>Interlaboratory comparisons</div></div></div>'
      +schemes.map(s=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc(s.e.code)+' · '+(s.stage==='awaiting'?'awaiting results':U.fmtDate(s.e.reported))+'</div></div><span class="pill '+(s.stage==='awaiting'?'amber':s.pct>=S.EQA_MIN?'teal':'amber')+'">'+(s.stage==='awaiting'?'pending':s.pct+'%')+'</span></div>').join('')})+'</div>'
   /* The per-scheme scorecard is a band of half-width tables rather than one full
      width stack: two schemes sit side by side, so the section stops running the
      length of the page and each table fits its own card. */
   +'<div class="c12" style="margin-top:14px"><div class="row between wrap gap-sm" style="margin-bottom:10px">'
      +'<div><div class="card-title">'+UI.ic('award',14,'ic')+'Per-scheme scorecard</div>'
      +'<div class="card-sub">One table per scheme, newest round first · every analyte that has data for that scheme is shown · analysts can be added from any round</div></div>'
      +'<div class="card-tool row gap-sm"><button class="btn xs" data-new-eqa>'+UI.ic('plus',12)+'New round</button><button class="btn xs" data-export>'+UI.ic('download',12)+'Export</button></div></div>'
      +'<div class="scheme-cells">'+(schemeTables||'<p class="xs faint">No EQA / PT rounds recorded yet.</p>')+'</div></div>'
   +'</div>';
}
const SD_COLORS=['#e4b748','#42c6b0','#f07978','#78a8f5','#c893ea','#ef9e53','#9aca6a','#e78ac0','#54b9db','#d1cd68'];
function sdTrendData(){
  const groups=new Map();
  (S.db().eqa||[]).forEach(e=>{
    if(e.scoring!=='SD') return;
    const values={};
    Object.entries(e.analytes||{}).forEach(([name,value])=>{if(ptAnalyteIncluded(e.program,name)&&value!==null&&value!==''&&Number.isFinite(Number(value))) values[name]=Number(value);});
    const program=String(e.program||'Unspecified programme');
    if(!groups.has(program)) groups.set(program,{program,rounds:[]});
    groups.get(program).rounds.push({values,date:e.scorePublished||e.reported||e.tested||e.delivered||'',round:e.code||'Unlabelled round',quarter:ptQuarter(e.code),pending:stageOf(e)==='awaiting'||(!Object.keys(e.analytes||{}).length&&!e.scorePublished),id:String(e.id||'')});
  });
  return Array.from(groups.values()).sort((a,b)=>a.program.localeCompare(b.program)).map(g=>{
    g.rounds.sort((a,b)=>a.quarter&&b.quarter?a.quarter.index-b.quarter.index||a.date.localeCompare(b.date)||a.id.localeCompare(b.id):a.quarter?-1:b.quarter?1:a.date.localeCompare(b.date));
    g.names=Array.from(new Set(g.rounds.flatMap(r=>Object.keys(r.values)))).sort((a,b)=>a.localeCompare(b));
    const scored=g.rounds.filter(r=>r.quarter&&Object.keys(r.values).length).map(r=>r.quarter.index);
    const available=g.rounds.filter(r=>r.quarter).map(r=>r.quarter.index);
    const first=scored.length?Math.min(...scored):(available.length?Math.min(...available):null);
    const last=available.length?Math.max(...available):null;
    g.indices=first==null?[]:Array.from({length:Math.min(100,last-first+1)},(_,i)=>Math.max(first,last-99)+i);
    return g;
  });
}
function sdTrends(){
  const groups=sdTrendData();
  return '<div class="hint" style="margin-bottom:14px">Each programme has one graph; colours identify tests. Only recorded SD-index results are shown; percentages and awaiting results are not converted to z-scores. Missing results are gaps, not zero. Smaller absolute values are closer to zero; provider interpretation still applies. Quarters follow the recorded round label (July–June fiscal year); unrecognised labels are listed but not plotted. Awaiting PT is shown without an invented score. Multiple values for the same test in one quarter are withheld from the graph for review.</div>'
   +(groups.length?'<div class="grid-12">'+groups.map((g,i)=>'<div class="c12">'+UI.card({title:U.esc(g.program),sub:g.names.length+' test'+(g.names.length===1?'':'s')+' · '+g.rounds.length+' recorded round'+(g.rounds.length===1?'':'s'),icon:'activity',body:'<div class="legend" style="margin-bottom:8px">'+g.names.map((name,j)=>'<span class="lg"><span class="sw" style="background:'+SD_COLORS[j%SD_COLORS.length]+'"></span>'+U.esc(name)+'</span>').join('')+'</div><div data-sd-chart="'+i+'"></div><div class="row wrap gap-sm" aria-label="Fiscal quarter timeline">'+g.indices.map(idx=>'<span class="pill '+(g.rounds.some(r=>r.pending&&r.quarter&&r.quarter.index===idx)?'amber':'slate')+'">'+U.esc(quarterLabel(idx))+(g.rounds.some(r=>r.pending&&r.quarter&&r.quarter.index===idx)?' · awaiting':'')+'</span>').join('')+'</div><div class="dt-scroll"><table class="dt"><thead><tr><th>Date used</th><th>Round</th><th>Test</th><th>SD index</th><th>Change in distance from zero</th></tr></thead><tbody>'+g.names.map(name=>{let previous=null;return g.rounds.filter(r=>Object.hasOwn(r.values,name)).map(r=>{const value=r.values[name],delta=previous===null?null:Math.abs(value)-Math.abs(previous);previous=value;return '<tr><td>'+U.esc(r.date||'Date not recorded')+'</td><td>'+U.esc(r.quarter?r.quarter.label:r.round+' (quarter unrecognised)')+'</td><td>'+U.esc(name)+'</td><td class="mono">'+(value>0?'+':'')+value.toFixed(2)+'</td><td>'+(delta==null?'—':Math.abs(delta)<1e-9?'No change':delta<0?'Closer to zero':'Further from zero')+'</td></tr>';}).join('');}).join('')+'</tbody></table></div><div class="hint">'+g.rounds.filter(r=>r.pending).map(r=>'Awaiting PT: '+U.esc(r.quarter?r.quarter.label:r.round+' (quarter unrecognised)')+' · no score yet').join('<br>')+'</div>'})+'</div>').join('')+'</div>':'<p class="small faint">No SD-index results recorded yet.</p>');
}
function drawSdTrends(){
  sdTrendData().forEach((g,i)=>{const series=g.names.map((name,j)=>({name,color:SD_COLORS[j%SD_COLORS.length],values:g.indices.map(idx=>{const hits=g.rounds.filter(r=>r.quarter&&r.quarter.index===idx&&Object.hasOwn(r.values,name));return hits.length===1?hits[0].values[name]:null;}),area:false}));
    const values=series.flatMap(s=>s.values.filter(v=>v!==null)),range=Math.max(2,Math.ceil(Math.max(0,...values.map(Math.abs))));
    C.line(rootEl.querySelector('[data-sd-chart="'+i+'"]'),{id:'sdTrend'+i,height:240,min:-range,max:range,zeroBase:false,series,labels:g.indices.map(quarterLabel),target:{value:0,label:'0.0 SD'},yFmt:v=>v.toFixed(1),tipFmt:v=>v.toFixed(2)+' SD',aria:U.esc(g.program+' SD indices by fiscal quarter')});
  });
}
function qcCalendar(){
  const db=S.db(); const runs=db.qc.runs;
  const days=28; const dates=[]; for(let i=days-1;i>=0;i--) dates.push(U.addDays(U.todayISO(),-i));
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'QC calendar',sub:'Westgard rule evaluation per analyte per day',icon:'calendar-days',
      tools:'<div class="row gap-sm"><span class="pill teal">in control</span><span class="pill amber">2-2s</span><span class="pill rose">1-3s</span></div>',
      body:'<div style="overflow-x:auto"><table style="border-collapse:separate;border-spacing:3px;width:100%">'
        +'<thead><tr><td></td>'+dates.filter((_,i)=>i%3===0).map(d=>'<th colspan="'+(i=>1)(0)+'" style="font-family:var(--font-mono);font-size:8px;color:var(--text-faint);font-weight:400">'+U.parseISO(d).getDate()+'</th>').join('')+'</tr></thead><tbody>'
        +Object.keys(runs).map(k=>{ const r=runs[k];
          return '<tr><td class="xs" style="white-space:nowrap;padding-right:8px;color:var(--text-muted)">'+U.esc(k)+'</td>'
            +r.points.map(p=>{ const az=Math.abs(p.z); const col=az>=3?'var(--crit)':az>=2?'var(--warn)':'rgba(63,211,182,.34)';
              return '<td data-tip="'+U.esc(k+' · '+U.fmtDate(p.date)+' · '+(p.z>0?'+':'')+p.z+' SD')+'" style="height:20px;border-radius:3px;background:'+col+';min-width:14px"></td>'; }).join('')+'</tr>';
        }).join('')+'</tbody></table></div>'
      +'<div class="hint" style="margin-top:10px">Each cell is one QC run. Amber = 2-2s warning rule, red = 1-3s rejection rule. Click a row to inspect the run.</div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Rule violations',sub:'Auto-detected from run data',icon:'alert-triangle',body:(function(){
      const out=[]; Object.keys(runs).forEach(k=>runs[k].points.forEach(p=>{ if(Math.abs(p.z)>=2) out.push({k,p}); }));
      out.sort((a,b)=>String(b.p.date).localeCompare(String(a.p.date)));
      return out.length?out.slice(0,6).map(x=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(x.k)+' · '+(Math.abs(x.p.z)>=3?'1-3s rejection':'2-2s warning')+'</div><div class="lr-sub">'+U.fmtDate(x.p.date)+' · z = '+(x.p.z>0?'+':'')+x.p.z+'</div></div><span class="traffic '+(Math.abs(x.p.z)>=3?'r':'a')+'">'+(Math.abs(x.p.z)>=3?'R':'W')+'</span></div>').join(''):'<p class="xs faint">No violations in the last 28 runs.</p>';
    })()})+'</div></div></div>'
   +'<div class="grid-12" style="margin-top:14px"><div class="c7">'+UI.card({title:'Z-score interpretation',sub:'Latest round · traffic-light thresholds',icon:'activity',body:(function(){
      const e=S.db().eqa.find(x=>x.program==='Hematology')||S.db().eqa[0]; const an=e.analytes||{};
      return '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Analyte</th><th>z-score</th><th>Status</th><th>Root cause / note</th></tr></thead><tbody>'
       +Object.keys(an).map(a=>{ const z=an[a], az=Math.abs(z);
        return '<tr><td class="strong">'+U.esc(a)+'</td><td class="num">'+(z>0?'+':'')+z+'</td><td><span class="traffic '+(az>=3?'r':az>=2?'a':'g')+'">'+(az>=3?'F':az>=2?'W':'P')+'</span></td><td class="small">'+(az>=2?(az>=3?'Bias investigated — calibration verified, repeat in next round':'Monitor — within warning, no action required'):'Within acceptable limits')+'</td></tr>'; }).join('')
       +'</tbody></table></div><div class="hint" style="margin-top:8px">|z| ≤ 2 acceptable · 2–3 warning · ≥ 3 unsatisfactory (requires CAPA).</div>';
    })()})+'</div>'
   +'<div class="c5">'+UI.card({title:'PT history & CAPA',sub:'Corrective and preventive actions',icon:'clipboard-check',
      tools:'<button class="btn xs" data-new-capa>'+UI.ic('plus',12)+'CAPA</button>',body:'<div id="capaList"></div>'})+'</div></div>';
}
function capaList(){
  const db=S.db(); db.capa=db.capa||[
    {id:'capa1',ref:'CAPA-2026-014',refTitle:'WBC +3.4 SD · Q1 Hematology',status:'Closed',owner:'Kelvin SAMAHANI',opened:U.addDays(U.todayISO(),-64),due:U.addDays(U.todayISO(),-40),root:'Calibration drift after reagent lot change',action:'Recalibrated; lot verified with 3 levels; next round passed'},
    {id:'capa2',ref:'CAPA-2026-021',refTitle:'Creatinine 1-3s rejection',status:'In progress',owner:'Diane UWASE',opened:U.addDays(U.todayISO(),-18),due:U.addDays(U.todayISO(),9),root:'Reagent lot degradation',action:'Lot quarantined; replacement ordered'},
    {id:'capa3',ref:'CAPA-2026-024',refTitle:'HIV EQA result transcription',status:'Open',owner:'Aurelie YANSONEYE',opened:U.addDays(U.todayISO(),-6),due:U.addDays(U.todayISO(),14),root:'Manual entry without second check',action:'Dual-verification step added to worksheet'}
  ];
  const el=rootEl&&rootEl.querySelector('#capaList'); if(!el) return;
  el.innerHTML=db.capa.map(c=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.8px">'+U.esc(c.ref)+'</div><div class="lr-sub">'+U.esc(c.refTitle)+' · due '+U.fmtDate(c.due)+'</div><div class="xs faint" style="margin-top:2px">'+U.esc(c.action)+'</div></div><span class="pill '+(c.status==='Closed'?'teal':c.status==='Open'?'rose':'amber')+'">'+U.esc(c.status)+'</span></div>').join('')
   +'<button class="btn xs" data-new-capa style="margin-top:8px">'+UI.ic('plus',12)+'New CAPA</button>';
  el.querySelectorAll('[data-new-capa]').forEach(b=>b.onclick=()=>newCapa());
}
function newCapa(){
  UI.modal({title:'Open corrective action',body:'<div class="form-grid"><div class="field span2"><label>Finding</label><input class="input" id="cpTitle" placeholder="e.g. Glucose +3.1 SD · Q2 Biochemistry"></div><div class="field"><label>Owner</label><select class="select" id="cpOwner">'+S.activeStaff().map(s=>'<option>'+U.esc(s.name)+'</option>').join('')+'</select></div><div class="field"><label>Due date</label><input class="input mono" type="date" id="cpDue" value="'+U.addDays(U.todayISO(),14)+'"></div><div class="field span2"><label>Root cause</label><textarea class="textarea" id="cpRoot"></textarea></div><div class="field span2"><label>Corrective action</label><textarea class="textarea" id="cpAction"></textarea></div></div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Open CAPA</button>',onMount:(el,close)=>{ el.querySelector('[data-save]').onclick=()=>{ if(!LS.auth.guard('edit'))return;
    S.commit(d=>{ d.capa=d.capa||[]; d.capa.unshift({id:U.uid('capa'),ref:'CAPA-2026-'+String(30+d.capa.length).padStart(3,'0'),refTitle:el.querySelector('#cpTitle').value||'EQA finding',status:'Open',owner:el.querySelector('#cpOwner').value,opened:U.todayISO(),due:el.querySelector('#cpDue').value,root:el.querySelector('#cpRoot').value,action:el.querySelector('#cpAction').value}); },
      {action:'eqa.capa',entity:'eqa',detail:'CAPA opened: '+el.querySelector('#cpTitle').value});
    close(); capaList(); UI.toast('CAPA opened and assigned',{type:'ok'}); }; }});
}
/* ——— Record / edit an EQA-PT round ————————————————— */
const PROGRAMS=['Serology'];
function analyzeRow(a,v,scoring){
  return '<div class="row gap-sm" data-analyte-row style="margin-bottom:6px">'
    +'<input class="input mono" data-an="name" placeholder="Analyte" value="'+U.esc(a||'')+'" style="flex:1;min-width:110px">'
    +'<input class="input mono" data-an="value" type="number" step="0.1" placeholder="'+(scoring==='%'?'%':'z')+'" value="'+(v==null?'':v)+'" style="width:96px">'
    +'<button class="icon-btn" data-rm-row style="width:30px;height:30px" aria-label="Remove analyte">'+UI.ic('x',14)+'</button></div>';
}
function eqaModal(id, presetProgram){
  if(!LS.auth.guard('edit')) return;
  const e=id?S.db().eqa.find(x=>x.id===id):null;
  const stage=e?stageOf(e):'awaiting';
  const scoring=e?e.scoring:'SD';
  const an=e?Object.fromEntries(Object.entries(e.analytes||{}).filter(([name])=>ptAnalyteIncluded(e.program,name))):{};
  const courses=U.uniq(S.db().eqa.map(x=>x.program).filter(Boolean).concat(PROGRAMS));
  const program=(e&&e.program)||presetProgram||courses[0];
  const known=analyteCatalog(program);
  const rows=Object.keys(an).length
    ? Object.keys(an).map(a=>analyzeRow(a,an[a],scoring)).join('')
    : (known.length?known.map(a=>analyzeRow(a,null,scoring)).join(''):analyzeRow('',null,scoring)+analyzeRow('',null,scoring));
  const title=e?(stage==='awaiting'?'Add results — ':'Edit EQA / PT round — ')+e.program+' '+e.code:(presetProgram?'Record a '+presetProgram+' round':'Record an EQA / PT round');
  UI.modal({title,sub:'Record the dispatch now and come back for the results. Nothing is lost while you wait, and the wait itself is measured.',width:'min(820px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Scheme / programme</label><select class="select" id="eqProgram">'+courses.map(c=>'<option'+(program===c?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'<option value="__other">Add another programme…</option></select></div>'
      +'<div class="field" id="eqOtherField" hidden><label>New programme</label><input class="input" id="eqOtherProgram"></div>'
      +'<div class="field"><label>Round code</label><input class="input mono" id="eqCode" value="'+U.esc(e?e.code:'')+'" placeholder="Q3 2026/27"></div>'
      +'<div class="field"><label>Scoring</label><select class="select" id="eqScoring"><option value="SD"'+(scoring==='SD'?' selected':'')+'>SD index (z-score)</option><option value="%'+(scoring==='%'?' selected':'')+'">Percentage recovery</option></select></div>'
      +'<div class="field"><label>Material delivered</label><input class="input" type="date" id="eqDelivered" value="'+(e&&e.delivered?String(e.delivered).slice(0,10):U.todayISO())+'"></div>'
      +'<div class="field"><label>Tested &amp; submitted on</label><input class="input" type="date" id="eqTested" value="'+(e&&e.tested?String(e.tested).slice(0,10):U.todayISO())+'"></div>'
      +'<div class="field"><label>Results received <span class="xs faint">— leave empty while waiting</span></label><input class="input" type="date" id="eqReported" value="'+(e&&e.reported?String(e.reported).slice(0,10):'')+'"></div>'
      +'<div class="field"><label>Score published</label><input class="input" type="date" id="eqPublished" value="'+(e&&e.scorePublished?String(e.scorePublished).slice(0,10):'')+'"></div>'
      +'<div class="field"><label>Verdict</label><select class="select" id="eqOverall"><option value=""'+(e&&!e.overall?' selected':'')+'>— pending —</option><option'+(e&&e.overall==='Pass'?' selected':'')+'>Pass</option><option'+(e&&e.overall==='Review'?' selected':'')+'>Review</option><option'+(e&&/Fail/i.test(e.overall||'')?' selected':'')+'>Fail</option></select></div>'
      +'<div class="field span2"><label>Analyte results <span class="xs faint">— z-score (SD) or recovery (%). Leave blank while awaiting the report.</span></label>'
      +'<div id="eqAnalyteRows">'+rows+'</div>'
      +'<button class="btn xs" data-add-analyte style="margin-top:4px">'+UI.ic('plus',12)+'Add analyte</button>'
      +'<span class="xs faint" style="margin-left:8px">'+(known.length?known.length+' known for '+U.esc(program)+' — pre-filled from earlier rounds.':'First round for this scheme — the analytes you enter are remembered.')+'</span></div>'
      +'<div class="field span2"><label>Note / root cause</label><textarea class="textarea" id="eqNote" rows="2">'+U.esc(e?e.note||'':'')+'</textarea></div></div>'
      +'<div class="hint" style="margin-top:8px">Saving without results keeps the round <b>open · awaiting results</b>. The scorecard then counts the days from dispatch to report, and flags rounds that run past 30 days.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+(e?'Save round':'Record round')+'</button>',
    onMount:(el,close)=>{
      const host=el.querySelector('#eqAnalyteRows');
      const scoringSel=el.querySelector('#eqScoring');
      const bindRows=()=>host.querySelectorAll('[data-rm-row]').forEach(b=>b.onclick=()=>{ if(host.querySelectorAll('[data-analyte-row]').length>1) b.closest('[data-analyte-row]').remove(); });
      bindRows();
      el.querySelector('[data-add-analyte]').onclick=()=>{ host.insertAdjacentHTML('beforeend',analyzeRow('',null,scoringSel.value)); bindRows(); };
      scoringSel.onchange=()=>host.querySelectorAll('[data-an="value"]').forEach(i=>i.placeholder=scoringSel.value==='%'?'%':'z');
      // switching scheme pre-fills that scheme's analytes (keeps any values already typed)
      el.querySelector('#eqProgram').onchange=ev=>{
        el.querySelector('#eqOtherField').hidden=ev.target.value!=='__other';
        const list=analyteCatalog(ev.target.value);
        const typed={};
        host.querySelectorAll('[data-analyte-row]').forEach(r=>{ const n=r.querySelector('[data-an="name"]').value.trim(); const v=r.querySelector('[data-an="value"]').value; if(n) typed[n]=v; });
        const merged=U.uniq(list.concat(Object.keys(typed)));
        host.innerHTML=(merged.length?merged.map(a=>analyzeRow(a,typed[a]===''||typed[a]===undefined?null:typed[a],scoringSel.value)).join(''):analyzeRow('',null,scoringSel.value));
        bindRows();
      };
      el.querySelector('[data-save]').onclick=()=>{
        const selected=el.querySelector('#eqProgram').value;
        const program=selected==='__other'?el.querySelector('#eqOtherProgram').value.trim():selected;
        if(!program) return UI.toast('Enter a programme name',{type:'warn'});
        const code=el.querySelector('#eqCode').value.trim()||'Round';
        const scoring=scoringSel.value;
        const analytes={};
        host.querySelectorAll('[data-analyte-row]').forEach(row=>{
          const name=row.querySelector('[data-an="name"]').value.trim();
          const val=parseFloat(row.querySelector('[data-an="value"]').value);
          if(name && !isNaN(val)) analytes[name]=val;
        });
        if(Object.keys(analytes).some(name=>!ptAnalyteIncluded(program,name))) return UI.toast('MCV is not included in Hematology PT',{type:'warn'});
        const hasResults=Object.keys(analytes).length>0;
        const reported=el.querySelector('#eqReported').value||'';
        if(!hasResults && (reported||el.querySelector('#eqOverall').value))
          return UI.toast('Add at least one analyte before marking the results as received',{type:'warn'});
        const stage=!hasResults&&!reported?'awaiting':(!el.querySelector('#eqOverall').value?'reported':'scored');
        const rec={program,code,scoring,stage,
          delivered:el.querySelector('#eqDelivered').value,tested:el.querySelector('#eqTested').value,
          reported:reported||null,scorePublished:el.querySelector('#eqPublished').value||null,
          overall:el.querySelector('#eqOverall').value||'',analytes,note:el.querySelector('#eqNote').value.trim()};
        if(hasResults){
          const vals=Object.values(analytes);
          rec.score=scoring==='SD'?Math.round(U.avg(vals.map(v=>Math.abs(v)))*10)/10:null;
          rec.scorePercent=scoring==='%'?Math.round(U.avg(vals)):null;
        } else { rec.score=null; rec.scorePercent=null; }
        S.commit(d=>{
          d.eqaAnalytes=d.eqaAnalytes||{};
          d.eqaAnalytes[program]=d.eqaAnalytes[program]||{};
          Object.keys(analytes).forEach(a=>{ d.eqaAnalytes[program][a]=1; });
          if(e){ const x=d.eqa.find(y=>y.id===e.id); if(x){Object.entries(x.analytes||{}).forEach(([name,value])=>{if(!ptAnalyteIncluded(x.program,name)) rec.analytes[name]=value;});Object.assign(x,rec);} }
          else d.eqa.unshift(Object.assign({id:U.uid('eqa')},rec));
        },{action:'eqa.round.'+(e?'edit':'add'),entity:'eqa',entityId:e?e.id:code,
          detail:program+' · '+code+' · '+stage+(hasResults?' · '+Object.keys(analytes).length+' analytes':'')});
        close(); paint();
        UI.toast(stage==='awaiting'?'Round recorded · awaiting results — the clock is running'
          :stage==='reported'?'Results saved · add the verdict when you have it'
          :'Round closed · '+Object.keys(analytes).length+' analytes scored',{type:'ok'});
      };
    }});
}
/* CQI mentorship is an assessment record, not a PT score. Every finding is
   independently dated and can be corrected or removed without inventing scores. */
const CQ_ACT=[
 {name:'Monitoring GeneXpert Data Management at Health Facility',max:23},
 {name:'AFB Smear Microscopy and Quality Control for Blind Retesting',max:23},
 {name:'TB-LAM and TB Pooling',max:5},
 {name:'Biosafety in Mycobacteriology Laboratory',max:4}
];
const cqiScores=()=> (S.db().cqiAssessments||[]).filter(r=>!r.deleted).slice().sort((a,b)=>a.fy.localeCompare(b.fy)||Number(a.quarter)-Number(b.quarter));
function cqCalc(r){
 const m=r.marks||[];if(CQ_ACT.some((a,i)=>m[i]===null||m[i]===undefined||m[i]===''||!Number.isFinite(+m[i])||+m[i]<0||+m[i]>a.max))return null;
 const total=Number(CQ_ACT.reduce((sum,_,i)=>sum+Number(m[i]),0).toFixed(8));return {total,pct:Math.round(total/55*1000)/10};
}
const cqLabel=r=>'Q'+r.quarter+' · '+r.fy;
const pp=n=>(n>0?'+':'')+n.toFixed(1)+' pp';
function cqiScoreView(){
 const rows=cqiScores(), valid=rows.filter(r=>cqCalc(r)), last=valid[valid.length-1], prior=valid[valid.length-2];
 const previousYear=last?valid.find(r=>r.fy===(String(+last.fy.slice(0,4)-1)+'/'+String(+last.fy.slice(0,4)))&&+r.quarter===+last.quarter):null;
 const stats=last?(()=>{const v=cqCalc(last),vals=CQ_ACT.map((a,i)=>({i,pct:+last.marks[i]/a.max*100})),least=Math.min(...vals.map(x=>x.pct)),most=Math.max(...vals.map(x=>x.pct));
  return '<div class="grid-12" style="margin-bottom:14px"><div class="c4">'+UI.card({title:'Latest recorded assessment',sub:U.esc(cqLabel(last)),icon:'target',body:'<div class="strong" style="font-size:26px">'+v.pct.toFixed(1)+'%</div><div class="small faint">'+v.total+' / 55 marks</div>'})+'</div><div class="c4">'+UI.card({title:'Change from previous assessment',sub:prior?U.esc(cqLabel(prior))+' → '+U.esc(cqLabel(last)):'No earlier complete assessment',icon:'chart-line',body:'<div class="strong" style="font-size:24px">'+(prior?pp(v.pct-cqCalc(prior).pct):'—')+'</div><div class="hint">Percentage points, not a relative percentage.</div>'})+'</div><div class="c4">'+UI.card({title:'Same quarter, previous FY',sub:previousYear?U.esc(cqLabel(previousYear))+' → '+U.esc(cqLabel(last)):'No matching recorded quarter',icon:'calendar',body:'<div class="strong" style="font-size:24px">'+(previousYear?pp(v.pct-cqCalc(previousYear).pct):'—')+'</div>'})+'</div></div>'
  +'<div class="dt-scroll" style="margin-bottom:14px"><table class="dt"><thead><tr><th>Latest activity</th><th>Marks</th><th>Share of maximum</th><th>Marks remaining</th><th>Change from previous assessment</th></tr></thead><tbody>'+CQ_ACT.map((a,i)=>{const v=+last.marks[i],pct=v/a.max*100,delta=prior?pct-(+prior.marks[i]/a.max*100):null;return '<tr><td class="small">'+U.esc(a.name)+'</td><td class="num">'+v+' / '+a.max+'</td><td class="num">'+pct.toFixed(1)+'%</td><td class="num">'+Number((a.max-v).toFixed(8))+'</td><td class="num">'+(delta===null?'—':pp(delta))+'</td></tr>';}).join('')+'</tbody></table></div>'
  +'<div class="hint" style="margin-bottom:14px"><b>Latest activity profile:</b> highest proportional score: '+vals.filter(x=>x.pct===most).map(x=>U.esc(CQ_ACT[x.i].name)).join(' / ')+' ('+most.toFixed(1)+'%); lowest: '+vals.filter(x=>x.pct===least).map(x=>U.esc(CQ_ACT[x.i].name)).join(' / ')+' ('+least.toFixed(1)+'%). These describe recorded marks, not a pass/fail threshold.</div>';})(): '<div class="hint" style="margin-bottom:14px">No complete TB CQI assessment yet. Blank activity marks are not counted as zero.</div>';
 const fyList=Array.from(new Set(rows.map(r=>r.fy))).sort().reverse();
 const fyTable=fyList.map(fy=>{const all=rows.filter(r=>r.fy===fy),complete=all.filter(r=>cqCalc(r));const avg=complete.length?complete.reduce((n,r)=>n+cqCalc(r).total/55*100,0)/complete.length:null;
  return '<tr><td>'+U.esc(fy)+'</td>'+[1,2,3,4].map(q=>{const r=all.find(x=>+x.quarter===q),c=r&&cqCalc(r);return '<td class="num">'+(!r?'—':c?c.pct.toFixed(1)+'%':'Incomplete')+'</td>';}).join('')+'<td class="num">'+(avg==null?'—':avg.toFixed(1)+'%')+' <span class="faint xs">('+complete.length+'/4 recorded)</span></td></tr>';}).join('');
 const table=rows.slice().reverse().map(r=>{const calc=cqCalc(r);return '<tr><td>'+U.esc(r.fy)+'</td><td>Q'+U.esc(r.quarter)+'</td>'+CQ_ACT.map((a,i)=>'<td class="num">'+(r.marks&&r.marks[i]!=null?U.esc(r.marks[i]):'—')+' / '+a.max+'</td>').join('')+'<td class="num">'+(calc?calc.total+' / 55':'Incomplete')+'</td><td class="num">'+(calc?calc.pct.toFixed(1)+'%':'—')+'</td><td><button class="btn xs" data-cq-score-edit="'+U.esc(r.id)+'">Edit</button> <button class="btn xs" data-cq-score-delete="'+U.esc(r.id)+'">Remove</button></td></tr>';}).join('');
 return '<div class="section-head"><div><h2>TB CQI assessment analysis</h2><div class="small faint">NRL · four activities · fiscal quarters July–June</div></div><div class="row gap-sm"><button class="btn sm" data-cq-scores-export>Export scores</button><button class="btn sm primary" data-cq-score-add>'+UI.ic('plus',13)+'Record assessment</button></div></div>'+stats
  +(rows.length?'<div class="grid-12"><div class="c6">'+UI.card({title:'Total score over time',sub:'Most recent 100 fiscal quarters · gaps are not zero',icon:'chart-line',body:'<div id="cqiTotalTrend"></div>'})+'</div><div class="c6">'+UI.card({title:'Activity trends',sub:'Most recent 100 quarters · percentage of each activity maximum',icon:'chart-line',body:'<div id="cqiActivityTrend"></div><div class="hint">Activity 1 · gold &nbsp; 2 · teal &nbsp; 3 · blue &nbsp; 4 · rose</div>'})+'</div></div><div style="margin-top:14px">'+UI.card({title:'Quarter and fiscal-year comparison',sub:'Average of complete recorded quarters only, not a full-year score unless all four are recorded',icon:'calendar',body:'<div class="dt-scroll"><table class="dt"><thead><tr><th>Fiscal year</th><th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Recorded-quarter average</th></tr></thead><tbody>'+fyTable+'</tbody></table></div>'})+'</div><div style="margin-top:14px">'+UI.card({title:'Assessment records',sub:'Marks per activity, total and calculated percentage',icon:'clipboard-check',body:'<div class="dt-scroll"><table class="dt"><thead><tr><th>Fiscal year</th><th>Quarter</th><th>1 / 23</th><th>2 / 23</th><th>3 / 5</th><th>4 / 4</th><th>Total</th><th>Score</th><th></th></tr></thead><tbody>'+table+'</tbody></table></div>'})+'</div>':'');
}
function cqiScoreModal(id){
 if(!LS.auth.guard('edit'))return;const old=id?(S.db().cqiAssessments||[]).find(x=>x.id===id&&!x.deleted):null;if(id&&!old)return;
 const fy=old?old.fy:'';const marks=old&&old.marks||[];
 UI.modal({title:old?'Edit TB CQI assessment':'Record TB CQI assessment',sub:'NRL TB mentorship · select the evaluated fiscal year and quarter. Historical periods are welcome.',body:'<div class="form-grid"><div class="field"><label for="cqsFy">Fiscal year (July–June)</label><input class="input" id="cqsFy" value="'+U.esc(fy)+'" placeholder="2026/2027"></div><div class="field"><label for="cqsQuarter">Quarter evaluated</label><select class="select" id="cqsQuarter"><option value="">Choose quarter</option>'+[['1','Q1 · Jul–Sep'],['2','Q2 · Oct–Dec'],['3','Q3 · Jan–Mar'],['4','Q4 · Apr–Jun']].map(([v,label])=>'<option value="'+v+'"'+(old&&+old.quarter===+v?' selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="field"><label>Assessment date (optional)</label><input class="input" type="date" id="cqsDate" value="'+U.esc(old&&old.date||'')+'"></div>'+CQ_ACT.map((a,i)=>'<div class="field span2"><label for="cqs'+i+'">Activity '+(i+1)+': '+U.esc(a.name)+' / '+a.max+'</label><input class="input" type="number" min="0" max="'+a.max+'" step="any" id="cqs'+i+'" value="'+(marks[i]!=null?U.esc(marks[i]):'')+'" placeholder="Not recorded"></div>').join('')+'<div class="field span2"><div class="hint" id="cqsTotal">Enter marks to calculate total.</div></div></div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cqs-save>Save assessment</button>',onMount:(el,close)=>{
  const get=s=>el.querySelector(s).value.trim();const read=()=>CQ_ACT.map((a,i)=>{const v=get('#cqs'+i);return v===''?null:Number(v);});
  const preview=()=>{const marks=read(),invalid=marks.some((n,i)=>n!=null&&(!Number.isFinite(n)||n<0||n>CQ_ACT[i].max));const c=!invalid&&cqCalc({marks});el.querySelector('#cqsTotal').textContent=invalid?'A mark is outside its permitted range.':c?'Total: '+c.total+' / 55 · '+c.pct.toFixed(1)+'%':'Incomplete: enter all four marks to calculate the total and percentage.';};
  CQ_ACT.forEach((_,i)=>el.querySelector('#cqs'+i).addEventListener('input',preview));preview();
  el.querySelector('[data-cqs-save]').onclick=()=>{if(!LS.auth.guard('edit'))return;const fy=get('#cqsFy'),quarter=get('#cqsQuarter'),match=/^(\d{4})\/(\d{4})$/.exec(fy),marks=read();if(!match||+match[2]!==+match[1]+1)return UI.toast('Enter a fiscal year such as 2026/2027',{type:'warn'});if(!quarter)return UI.toast('Choose the quarter evaluated',{type:'warn'});if(marks.some((v,i)=>v!=null&&(!Number.isFinite(v)||v<0||v>CQ_ACT[i].max)))return UI.toast('Check each mark against its maximum',{type:'warn'});if((S.db().cqiAssessments||[]).some(x=>!x.deleted&&x.id!==id&&x.fy===fy&&+x.quarter===+quarter))return UI.toast('That fiscal year and quarter already has an assessment. Edit it instead.',{type:'warn'});
   const rec={fy,quarter:Number(quarter),date:get('#cqsDate'),marks,program:'TB',provider:'NRL',updatedAt:U.nowISO(),updatedBy:LS.auth.user.name};const entityId=id||U.uid('cqis');S.commit(d=>{d.cqiAssessments=d.cqiAssessments||[];if(old){const x=d.cqiAssessments.find(y=>y.id===id&&!y.deleted);if(x){const prev=Object.assign({},x);delete prev.history;x.history=(x.history||[]).concat([prev]);Object.assign(x,rec);}}else d.cqiAssessments.push(Object.assign({id:entityId,createdAt:U.nowISO(),createdBy:LS.auth.user.name},rec));},{action:old?'cqi.assessment.edit':'cqi.assessment.add',entity:'cqiAssessments',entityId,detail:'NRL TB CQI · '+fy+' Q'+quarter});close();paint();UI.toast('Assessment saved · sync pending',{type:'ok'});
  };
 }});
}
async function cqiScoreDelete(id){if(!LS.auth.guard('edit'))return;const x=cqiScores().find(r=>r.id===id);if(!x)return;if(!await UI.confirm({title:'Remove this TB CQI assessment?',body:'The assessment is hidden from analysis but retained for audit.',confirm:'Remove',danger:true}))return;S.commit(d=>{const r=(d.cqiAssessments||[]).find(t=>t.id===id);if(r){r.deleted=true;r.deletedAt=U.nowISO();r.deletedBy=LS.auth.user.name;}},{action:'cqi.assessment.remove',entity:'cqiAssessments',entityId:id,detail:'Removed '+cqLabel(x)});paint();}
function drawCqiCharts(){
 const rows=cqiScores();if(!rows.length)return;const index=r=>(+r.fy.slice(0,4))*4+(+r.quarter-1),first=index(rows[0]),last=index(rows[rows.length-1]);
 // Bound display to the most recent 100 fiscal quarters; all records remain in the table.
 const start=Math.max(first,last-99),map=new Map(rows.map(r=>[index(r),r])),slots=Array.from({length:last-start+1},(_,i)=>start+i),labels=slots.map(i=>'Q'+(i%4+1)+' '+Math.floor(i/4)),entries=slots.map(i=>map.get(i));
 C.line(rootEl.querySelector('#cqiTotalTrend'),{id:'cqi-total',height:230,min:0,max:100,labels,series:[{name:'Total',color:'var(--gold)',values:entries.map(r=>r&&cqCalc(r)?cqCalc(r).pct:null)}],yFmt:v=>v.toFixed(0)+'%',tipFmt:v=>v.toFixed(1)+'%'});
 C.line(rootEl.querySelector('#cqiActivityTrend'),{id:'cqi-activities',height:230,min:0,max:100,labels,series:CQ_ACT.map((a,k)=>({name:'Activity '+(k+1),color:['var(--gold)','var(--teal, #3fb3a6)','#648cce','#e26d6d'][k],area:false,values:entries.map(r=>r&&r.marks&&r.marks[k]!=null&&Number.isFinite(+r.marks[k])&&+r.marks[k]>=0&&+r.marks[k]<=a.max?+r.marks[k]/a.max*100:null)})),yFmt:v=>v.toFixed(0)+'%',tipFmt:v=>v.toFixed(1)+'%'});
}
const cqiRecommendations=()=> (S.db().cqiRecommendations||[]).filter(r=>!r.deleted).slice().sort((a,b)=>(a.status==='Fully implemented')-(b.status==='Fully implemented')||String(a.commitDate||'').localeCompare(String(b.commitDate||'')));
function cqiRecommendationsView(){
 const rows=cqiRecommendations(),reminder=LS.auth.can('edit')&&S.cqiQuarterReminder?S.cqiQuarterReminder():null;
 const reminderHTML=reminder?'<div class="hint" role="status"><b>Quarter-end review:</b> '+reminder.count+' recommendation'+(reminder.count===1?'':'s')+' not fully implemented. Update each status before '+U.esc(U.fmtDate(reminder.end))+'.</div>':'';
 const list=rows.length?'<div class="dt-scroll"><table class="dt"><thead><tr><th>Recommendation</th><th>Commitment date</th><th>Implementation</th><th>Explanation / evidence</th><th>Actions</th></tr></thead><tbody>'+rows.map(r=>{
  const status=r.status||'Awaiting review',overdue=r.commitDate<U.todayISO()&&status!=='Fully implemented';
  const updates=(r.updates||[]).slice().reverse();
  return '<tr><td class="small">'+U.esc(r.text)+(r.activity?'<br><span class="xs faint">'+U.esc(r.activity)+'</span>':'')+(r.source?'<br><span class="xs faint">Source: '+U.esc(r.source)+'</span>':'')+'</td><td class="small">'+U.esc(U.fmtDate(r.commitDate))+(overdue?'<br><span class="xs" style="color:var(--warn)">Past commitment date</span>':'')+'</td><td class="small">'+U.esc(status)+(r.reviewedAt?'<br><span class="xs faint">Reviewed '+U.esc(U.fmtDate(String(r.reviewedAt).slice(0,10)))+'</span>':'')+'</td><td class="small">'+U.esc(r.comment||'—')+(updates.length?'<details><summary class="xs">Status history ('+updates.length+')</summary>'+updates.map(u=>'<div class="xs">'+U.esc(U.fmtDate(String(u.at||'').slice(0,10)))+' · '+U.esc(u.status)+(u.comment?' — '+U.esc(u.comment):'')+' · '+U.esc(u.by||'')+'</div>').join('')+'</details>':'')+'</td><td style="min-width:200px"><div class="row wrap gap-sm"><button class="btn xs" data-cq-rec-status="'+U.esc(r.id)+'" data-state="Fully implemented">Done</button><button class="btn xs" data-cq-rec-status="'+U.esc(r.id)+'" data-state="Partially implemented">Partial</button><button class="btn xs" data-cq-rec-status="'+U.esc(r.id)+'" data-state="Not implemented">Not implemented</button><button class="btn xs" data-cq-rec-edit="'+U.esc(r.id)+'">Edit</button><button class="btn xs" data-cq-rec-delete="'+U.esc(r.id)+'">Remove</button></div></td></tr>';}).join('')+'</tbody></table></div>':'<p class="small faint">No recommendations recorded. Add recommendations from NRL reports and choose the date you commit to implement each one.</p>';
 return UI.card({title:'NRL TB CQI recommendations',sub:'Commitment dates and implementation follow-up',icon:'clipboard-check',tools:'<button class="btn sm" data-cq-rec-export>Export</button> <button class="btn sm primary" data-cq-rec-add>'+UI.ic('plus',13)+'Add recommendation</button>',body:reminderHTML+'<div class="hint">Reminders appear in the app during the last seven calendar days of each fiscal quarter for recommendations not fully implemented. This is not an email or a phone notification when the app is closed.</div>'+list});
}
function cqiRecModal(id){
 if(!LS.auth.guard('edit'))return;const old=id?cqiRecommendations().find(r=>r.id===id):null;if(id&&!old)return;
 UI.modal({title:old?'Edit recommendation':'Add NRL recommendation',sub:'Record the recommendation as given and the date you commit to implement it.',body:'<div class="form-grid"><div class="field span2"><label for="cqrText">Recommendation</label><textarea class="textarea" id="cqrText">'+U.esc(old&&old.text||'')+'</textarea></div><div class="field"><label for="cqrDate">Committed implementation date</label><input class="input" type="date" id="cqrDate" value="'+U.esc(old&&old.commitDate||'')+'"></div><div class="field"><label for="cqrActivity">Activity (optional)</label><select class="select" id="cqrActivity"><option value="">Not specified</option>'+CQ_ACT.map((a,i)=>'<option value="'+U.esc(a.name)+'"'+(old&&old.activity===a.name?' selected':'')+'>Activity '+(i+1)+' · '+U.esc(a.name)+'</option>').join('')+'</select></div><div class="field span2"><label for="cqrSource">Report / source reference (optional)</label><input class="input" id="cqrSource" value="'+U.esc(old&&old.source||'')+'"></div></div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cqr-save>Save recommendation</button>',onMount:(el,close)=>{el.querySelector('[data-cqr-save]').onclick=()=>{
  if(!LS.auth.guard('edit'))return;const get=x=>el.querySelector(x).value.trim(),text=get('#cqrText'),commitDate=get('#cqrDate');if(!text||!commitDate)return UI.toast('Enter the recommendation and commitment date',{type:'warn'});
  el.querySelector('[data-cqr-save]').disabled=true;
  const record={text,commitDate,activity:get('#cqrActivity'),source:get('#cqrSource'),updatedAt:U.nowISO(),updatedBy:LS.auth.user.name},entityId=id||U.uid('cqir');
  S.commit(d=>{d.cqiRecommendations=d.cqiRecommendations||[];if(old){const x=d.cqiRecommendations.find(r=>r.id===id&&!r.deleted);if(x){const prev=Object.assign({},x);delete prev.history;delete prev.updates;x.history=(x.history||[]).concat([prev]);if(x.text!==record.text){const at=U.nowISO(),by=LS.auth.user.name;x.updates=(x.updates||[]).concat([{status:'Awaiting review',comment:'Recommendation text changed; implementation must be reviewed again.',at,by}]);Object.assign(x,{status:'Awaiting review',comment:'',reviewedAt:'',reviewedBy:''});}Object.assign(x,record);}}else d.cqiRecommendations.push(Object.assign({id:entityId,program:'TB',provider:'NRL',status:'Awaiting review',comment:'',createdAt:U.nowISO(),createdBy:LS.auth.user.name,updates:[]},record));},{action:old?'cqi.recommendation.edit':'cqi.recommendation.add',entity:'cqiRecommendations',entityId,detail:'NRL TB CQI recommendation · commitment '+commitDate});close();paint();UI.toast('Recommendation saved · sync pending',{type:'ok'});
 };}});
}
function cqiRecStatus(id,status){
 if(!LS.auth.guard('edit')||!['Fully implemented','Partially implemented','Not implemented'].includes(status))return;const rec=cqiRecommendations().find(r=>r.id===id);if(!rec)return;
 const needsComment=status!=='Fully implemented';
 UI.modal({title:'Mark '+status.toLowerCase(),sub:U.esc(rec.text),body:'<div class="field"><label for="cqrComment">'+(needsComment?'Why is it not fully implemented? (required)':'Implementation details or evidence (optional)')+'</label><textarea class="textarea" id="cqrComment" placeholder="'+(needsComment?'Explain the delay, barrier or work remaining':'Describe what was completed')+'"></textarea></div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cqr-status-save>Save status</button>',onMount:(el,close)=>{el.querySelector('[data-cqr-status-save]').onclick=()=>{if(!LS.auth.guard('edit'))return;const comment=el.querySelector('#cqrComment').value.trim();if(needsComment&&!comment)return UI.toast('Explain why it is not fully implemented',{type:'warn'});
  el.querySelector('[data-cqr-status-save]').disabled=true;
  S.commit(d=>{const r=(d.cqiRecommendations||[]).find(x=>x.id===id&&!x.deleted);if(!r)return;const at=U.nowISO(),by=LS.auth.user.name;r.updates=(r.updates||[]).concat([{status,comment,at,by}]);Object.assign(r,{status,comment,reviewedAt:at,reviewedBy:by,updatedAt:at,updatedBy:by});},{action:'cqi.recommendation.status',entity:'cqiRecommendations',entityId:id,detail:'NRL TB CQI recommendation · '+status});close();paint();UI.toast('Implementation status saved · sync pending',{type:'ok'});
 };}});
}
async function cqiRecDelete(id){if(!LS.auth.guard('edit'))return;const rec=cqiRecommendations().find(r=>r.id===id);if(!rec)return;if(!await UI.confirm({title:'Remove this recommendation?',body:'It will be hidden from the list but retained for audit.',confirm:'Remove',danger:true}))return;S.commit(d=>{const r=(d.cqiRecommendations||[]).find(x=>x.id===id);if(r){r.deleted=true;r.deletedAt=U.nowISO();r.deletedBy=LS.auth.user.name;}},{action:'cqi.recommendation.remove',entity:'cqiRecommendations',entityId:id,detail:'NRL TB CQI recommendation removed'});paint();}
function cqiView(){
 const rows=(S.db().cqiFindings||[]).filter(x=>!x.deleted).slice().sort((a,b)=>String(b.visitDate||'').localeCompare(String(a.visitDate||'')));
 return cqiScoreView()+'<div style="margin-top:18px">'+cqiRecommendationsView()+'</div><div style="margin-top:18px">'+UI.card({title:'NRL TB CQI mentorship',sub:'Continuous Quality Improvement · ISO-aligned mentorship findings for TB, including historical visits',icon:'clipboard-check',tools:'<button class="btn sm" data-cqi-export>Export findings</button> <button class="btn sm primary" data-cqi-add>'+UI.ic('plus',13)+'Add finding</button>',body:'<div class="hint">Record the assessment date, finding and follow-up as reported by NRL. These are separate from EQA/PT rounds and do not change PT scores.</div>'+(rows.length?'<div class="dt-scroll"><table class="dt"><thead><tr><th>Visit</th><th>Area / ISO reference</th><th>Finding</th><th>Action / follow-up</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td class="num">'+U.fmtDate(x.visitDate)+'</td><td class="small">'+U.esc(x.area||'—')+(x.isoRef?'<br><span class="faint">'+U.esc(x.isoRef)+'</span>':'')+'</td><td class="small">'+U.esc(x.finding)+'</td><td class="small">'+U.esc(x.action||'—')+(x.due?'<br><span class="faint">Due '+U.fmtDate(x.due)+'</span>':'')+'</td><td>'+U.esc(x.status||'Not recorded')+'</td><td><button class="btn xs" data-cqi-edit="'+U.esc(x.id)+'">Edit</button> <button class="btn xs" data-cqi-delete="'+U.esc(x.id)+'">Remove</button></td></tr>').join('')+'</tbody></table></div>':'<p class="small faint">No mentorship findings recorded. Add an existing historical finding or a new one.</p>')})+'</div>';
}
function cqiModal(id){
 if(!LS.auth.guard('edit'))return; const old=id?(S.db().cqiFindings||[]).find(x=>x.id===id&&!x.deleted):null;if(id&&!old)return;
 const v=(k)=>U.esc(old&&old[k]||'');
 UI.modal({title:old?'Edit TB CQI finding':'Record TB CQI finding',sub:'NRL mentorship · use the actual visit date, including for historical findings.',body:'<div class="form-grid"><div class="field"><label>Visit date</label><input class="input" type="date" id="cqDate" value="'+v('visitDate')+'"></div><div class="field"><label>Area assessed</label><input class="input" id="cqArea" value="'+v('area')+'" placeholder="e.g. quality management, TB testing"></div><div class="field"><label>ISO clause / reference (optional)</label><input class="input" id="cqRef" value="'+v('isoRef')+'"></div><div class="field"><label>Assessor / mentor (optional)</label><input class="input" id="cqAssessor" value="'+v('assessor')+'" placeholder="Name or NRL team"></div><div class="field span2"><label>Finding</label><textarea class="textarea" id="cqFinding">'+v('finding')+'</textarea></div><div class="field span2"><label>Corrective action / follow-up (optional)</label><textarea class="textarea" id="cqAction">'+v('action')+'</textarea></div><div class="field"><label>Due date (optional)</label><input class="input" type="date" id="cqDue" value="'+v('due')+'"></div><div class="field"><label>Status</label><select class="select" id="cqStatus">'+['Not recorded','Open','In progress','Closed'].map(x=>'<option'+((old&&old.status||'Not recorded')===x?' selected':'')+'>'+x+'</option>').join('')+'</select></div><div class="field"><label>Closure date (optional)</label><input class="input" type="date" id="cqClosed" value="'+v('closedDate')+'"></div><div class="field"><label>Source / report reference (optional)</label><input class="input" id="cqSource" value="'+v('source')+'"></div></div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cqi-save>Save finding</button>',onMount:(el,close)=>{el.querySelector('[data-cqi-save]').onclick=()=>{if(!LS.auth.guard('edit'))return;const get=k=>el.querySelector(k).value.trim();const date=get('#cqDate'),finding=get('#cqFinding');if(!date||!finding)return UI.toast('Enter the visit date and finding',{type:'warn'});const rec={visitDate:date,area:get('#cqArea'),isoRef:get('#cqRef'),assessor:get('#cqAssessor'),finding,action:get('#cqAction'),due:get('#cqDue'),status:get('#cqStatus'),closedDate:get('#cqClosed'),source:get('#cqSource'),updatedAt:U.nowISO(),updatedBy:LS.auth.user.name};if(rec.closedDate&&rec.closedDate<date)return UI.toast('Closure cannot precede the visit',{type:'warn'});S.commit(d=>{d.cqiFindings=d.cqiFindings||[];if(old){const x=d.cqiFindings.find(y=>y.id===id&&!y.deleted);if(x){x.history=(x.history||[]).concat([Object.assign({},x,{history:undefined})]);Object.assign(x,rec);}}else d.cqiFindings.push(Object.assign({id:U.uid('cqi'),program:'TB',provider:'NRL',createdAt:U.nowISO(),createdBy:LS.auth.user.name},rec));},{action:old?'cqi.finding.edit':'cqi.finding.add',entity:'cqiFindings',entityId:id||date,detail:'NRL TB CQI finding · '+date});close();paint();UI.toast('CQI finding saved · sync pending',{type:'ok'});};}});
}
async function cqiDelete(id){if(!LS.auth.guard('edit'))return;const x=(S.db().cqiFindings||[]).find(y=>y.id===id&&!y.deleted);if(!x)return;const yes=await UI.confirm({title:'Remove this CQI finding?',body:'The finding is hidden but retained in the record for audit.',confirm:'Remove',danger:true});if(!yes)return;S.commit(d=>{const f=(d.cqiFindings||[]).find(y=>y.id===id);if(f){f.deleted=true;f.deletedAt=U.nowISO();f.deletedBy=LS.auth.user.name;}},{action:'cqi.finding.remove',entity:'cqiFindings',entityId:id,detail:'Removed NRL TB CQI finding · '+x.visitDate});paint();}
function paint(){
  const host=rootEl.querySelector('#eqaBody'); if(!host) return;
  host.innerHTML=tab==='scorecard'?scorecard():tab==='cqi'?cqiView():sdTrends();
  U.$$('[data-eqa-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.eqaTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-eqa-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.eqaTab; paint(); });
  if(tab==='cqi'){
    drawCqiCharts();
    r.querySelectorAll('[data-cq-rec-add]').forEach(b=>b.onclick=()=>cqiRecModal());
    r.querySelectorAll('[data-cq-rec-edit]').forEach(b=>b.onclick=()=>cqiRecModal(b.dataset.cqRecEdit));
    r.querySelectorAll('[data-cq-rec-status]').forEach(b=>b.onclick=()=>cqiRecStatus(b.dataset.cqRecStatus,b.dataset.state));
    r.querySelectorAll('[data-cq-rec-delete]').forEach(b=>b.onclick=()=>cqiRecDelete(b.dataset.cqRecDelete));
    r.querySelectorAll('[data-cq-rec-export]').forEach(b=>b.onclick=()=>{U.exportCSV('nrl-tb-cqi-recommendations-'+U.todayISO()+'.csv',[['Recommendation','Activity','Source','Committed implementation date','Status','Explanation or evidence','Last reviewed','Reviewed by']].concat(cqiRecommendations().map(x=>[x.text,x.activity||'',x.source||'',x.commitDate,x.status||'Awaiting review',x.comment||'',x.reviewedAt||'',x.reviewedBy||''])),{title:'NRL TB CQI recommendations',actor:(LS.auth.user&&LS.auth.user.name)||'Visitor'});});
    r.querySelectorAll('[data-cq-score-add]').forEach(b=>b.onclick=()=>cqiScoreModal());
    r.querySelectorAll('[data-cq-score-edit]').forEach(b=>b.onclick=()=>cqiScoreModal(b.dataset.cqScoreEdit));
    r.querySelectorAll('[data-cq-score-delete]').forEach(b=>b.onclick=()=>cqiScoreDelete(b.dataset.cqScoreDelete));
    r.querySelectorAll('[data-cq-scores-export]').forEach(b=>b.onclick=()=>{const rows=cqiScores().slice().reverse();U.exportCSV('nrl-tb-cqi-scores-'+U.todayISO()+'.csv',[['Fiscal year','Quarter','Assessment date','Activity 1 / 23','Activity 2 / 23','Activity 3 / 5','Activity 4 / 4','Total / 55','Percentage']].concat(rows.map(r=>{const c=cqCalc(r);return [r.fy,'Q'+r.quarter,r.date||'',...(r.marks||[]).map(x=>x==null?'':x),c?c.total:'',c?c.pct.toFixed(1):''];})),{title:'NRL TB CQI assessments',actor:(LS.auth.user&&LS.auth.user.name)||'Visitor'});});
    r.querySelectorAll('[data-cqi-export]').forEach(b=>b.onclick=()=>{const rows=(S.db().cqiFindings||[]).filter(x=>!x.deleted);U.exportCSV('nrl-tb-cqi-findings-'+U.todayISO()+'.csv',[['Visit date','Assessor','Area','ISO reference','Finding','Action','Due','Status','Closed','Source']].concat(rows.map(x=>[x.visitDate,x.assessor,x.area,x.isoRef,x.finding,x.action,x.due,x.status,x.closedDate,x.source])),{title:'NRL TB CQI mentorship findings',actor:(LS.auth.user&&LS.auth.user.name)||'Visitor'});});
    r.querySelectorAll('[data-cqi-add]').forEach(b=>b.onclick=()=>cqiModal());
    r.querySelectorAll('[data-cqi-edit]').forEach(b=>b.onclick=()=>cqiModal(b.dataset.cqiEdit));
    r.querySelectorAll('[data-cqi-delete]').forEach(b=>b.onclick=()=>cqiDelete(b.dataset.cqiDelete));
  } else if(tab==='sd'||tab==='qc'){
    drawSdTrends();
  } else if(tab==='scorecard'){
    const tr=trend();
    /* The axis opens only as far as the recorded scores need — it no longer runs
       from 70 % when nothing was ever scored that low. */
    const lo=Math.min.apply(null,tr.values.concat([S.EQA_MIN]));
    const floor=Math.max(0,Math.floor((lo-4)/5)*5);
    C.line(r.querySelector('#eqaTrend'),{id:'eqaT',height:230,min:floor,max:100,
      series:[{name:'Composite',color:'var(--gold)',values:tr.values}],labels:tr.labels,
      target:{value:S.EQA_MIN,label:'minimum '+S.EQA_MIN+'%'},
      yFmt:v=>Math.round(v)+'%',tipFmt:v=>v+'%',drawMs:1400,padLeft:46});
    r.querySelectorAll('[data-eqa]').forEach(tr2=>tr2.onclick=()=>{ const e=S.db().eqa.find(x=>x.id===tr2.dataset.eqa); if(!e) return;
      const st=stageOf(e), tu=turnaround(e), waiting=U.daysBetween(e.delivered||U.todayISO(),U.todayISO());
      UI.drawer({title:e.program+' · '+e.code,eyebrow:'EQA round',body:'<div class="row wrap gap-sm" style="margin-bottom:12px"><span class="pill '+STAGE[st].tone+'">'+STAGE[st].label+'</span>'
        +(st==='awaiting'?'<span class="pill '+(waiting>30?'rose':'slate')+'">'+waiting+' days since dispatch</span>':'')
        +(tu.toResult!=null?'<span class="pill slate">report in '+tu.toResult+'d</span>':'')+'</div>'
        +'<div class="split-2">'+[['Delivered',U.fmtDate(e.delivered)],['Tested / submitted',U.fmtDate(e.tested)],['Results received',e.reported?U.fmtDate(e.reported):'waiting'],['Score published',U.fmtDate(e.scorePublished)],['Scoring',e.scoring==='%'?'Percentage':'Standard deviation index'],['Verdict',e.overall||'pending']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
      +'<div class="section-head"><h2>Analyte detail</h2></div>'+Object.keys(e.analytes||{}).filter(a=>ptAnalyteIncluded(e.program,a)).map(a=>{ const z=e.analytes[a]; const az=Math.abs(z); return '<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(a)+'</div><div class="lr-sub">'+(e.scoring==='%'?'recovery':'z-score')+' · '+(az>=3?'unsatisfactory':az>=2?'warning':'acceptable')+'</div></div><span class="pill '+(az>=3?'rose':az>=2?'amber':'teal')+' mono">'+(z>0?'+':'')+z+'</span></div>'; }).join('')
      +'<div class="hint" style="margin-top:12px">'+U.esc(e.note||'')+'</div>',foot:'<button class="btn" data-close>Close</button>'+'<button class="btn" data-edit-round>'+UI.ic('pencil',15)+(st==='awaiting'?'Add results':'Edit round')+'</button><button class="btn primary" data-capa2>Open CAPA</button>',onMount:(p)=>{ p.querySelector('[data-capa2]').onclick=()=>{ UI.closeAll(); newCapa(); }; p.querySelector('[data-edit-round]').onclick=()=>{ UI.closeAll(); eqaModal(e.id); }; }}); });
    capaList();
    r.querySelectorAll('[data-new-capa]').forEach(b=>b.onclick=newCapa);
    r.querySelectorAll('[data-new-eqa]').forEach(b=>b.onclick=()=>eqaModal());
    r.querySelectorAll('[data-new-eqa-program]').forEach(b=>b.onclick=()=>eqaModal(null,b.dataset.newEqaProgram));
    r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
      U.exportCSV('eqa-pt-scores-'+U.todayISO()+'.csv',[['Program','Round','Stage','Dispatched','Tested','Reported','Days to report','Score published','Days to score','Score','Percent','Verdict','Analytes']]
        .concat(S.db().eqa.map(e=>{ const tu=turnaround(e);
          return [e.program,e.code,stageOf(e),e.delivered,e.tested,e.reported||'',tu.toResult==null?'':tu.toResult,e.scorePublished||'',tu.toScore==null?'':tu.toScore,e.score!=null?e.score:'',e.scorePercent||'',e.overall||'',JSON.stringify(e.analytes||{})]; })),
        {title:'EQA / PT scorecard',actor:LS.auth.user.name});
      UI.toast('EQA scorecard exported',{type:'ok'});
    });
    if(!celebrated && Math.max.apply(null,Object.values(S.eqaLatest()).map(e=>e.scorePercent||0))>=100){ celebrated=true; setTimeout(()=>{ UI.confetti({count:110}); UI.toast('100% PT round — outstanding quality performance',{type:'ok'}); },600); }
  } else {
    capaList(); r.querySelectorAll('[data-new-capa]').forEach(b=>b.onclick=newCapa);
  }
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'scorecard';
  root.innerHTML='<div class="page-head"><div><h1>EQA / PT scores</h1><div class="sub">ISO 15189 as a product feature — proficiency testing, z-scores, Westgard rules and corrective action, in one auditable scorecard.</div></div>'
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn" data-new-capa>'+UI.ic('clipboard-check',15)+' Open CAPA</button><button class="btn primary" data-new-eqa>'+UI.ic('plus',15)+' Record EQA round</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['scorecard','Scorecard'],['sd','SD trends'],['cqi','TB CQI mentorship']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-eqa-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="eqaBody"></div>';
  paint();
};
})();
