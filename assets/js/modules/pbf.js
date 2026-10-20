/* ============================================================================
   MODULE · PBF EVALUATION — performance-based financing for health centres
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.pbf=M;
let rootEl=null, sort='total', q='';
const DOMAINS=[['quality','Quality management',20],['tat','Turnaround & referral',20],['stock','Commodity security',15],['data','Data quality & reporting',15],['hr','Staffing & competency',15],['infra','Infrastructure & safety',15]];

function list(){ return (S.db().pbf||[]); }
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
    +'<div class="hint" style="margin-top:12px">Scores can be adjusted locally, but only the district PBF team can close the quarter. Adjustments are written to the audit trail.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit>'+UI.ic('sliders',15)+'Adjust scores</button><button class="btn primary" data-print>'+UI.ic('printer',15)+'Print scorecard</button>',
    onMount:(panel,close)=>{
      panel.querySelector('[data-edit]').onclick=()=>{ close(); editScores(r); };
      panel.querySelector('[data-print]').onclick=()=>printCentre(r);
    }});
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
    +'<tr><td colspan="2"><b>Weighted composite</b></td><td colspan="2"><b>'+total(r)+'%</b></td><td>'+r.prior+'%</td></tr></tbody></table>',
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
  root.innerHTML='<div class="page-head"><div><h1>PBF evaluation</h1><div class="sub">Performance-based financing, scored on the same records the bench works from — quality, TAT, commodity security, data, staffing and infrastructure.</div></div>'
   +'<div class="actions"><a class="btn" href="#/quality">'+UI.ic('shield-check',15)+' ISO readiness</a><button class="btn" data-district>'+UI.ic('printer',15)+' District report</button></div></div>'
   +kpis()+hero()
   +'<div class="section-head"><h2>Centre scorecards</h2><span class="more">Click any row for the full evaluation</span></div>'
   +table()
   +'<div class="section-head"><h2>Domain comparison</h2><span class="more">Six weighted domains · '+list().length+' centres</span></div>'
   +matrix();

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
};
})();
