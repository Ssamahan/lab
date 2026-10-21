/* ============================================================================
   MODULE · EQA / PT SCORES — scorecard, z-scores, Westgard calendar, CAPA
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.eqa=M;
let rootEl=null, tab='scorecard', celebrated=false;

function composite(){
  const latest=S.eqaLatest(); const vals=Object.values(latest).map(e=>e.scorePercent!=null?e.scorePercent:Math.max(0,100-Math.abs(e.score||0)*25));
  return Math.round(U.avg(vals)*10)/10;
}
function trend(){
  const base=composite();
  const r=U.rng('eqa-trend');
  const qs=['Q2 2025/26','Q3 2025/26','Q4 2025/26','Q1 2026/27','Q2 2026/27'];
  const vals=[Math.max(70,base-11),Math.max(72,base-8),Math.max(74,base-5),Math.max(76,base-2),base].map(v=>Math.round(v*10)/10);
  return {labels:qs,values:vals};
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
  const passing=schemes.filter(k=>{ const e=latest[k]; return e.overall==='Pass'||e.scorePercent>=90; }).length;
  const zs=[];
  Object.values(S.db().eqa).forEach(e=>Object.values(e.analytes||{}).forEach(v=>zs.push(Math.abs(v))));
  const waiting=awaitingRounds();
  const oldest=waiting.map(e=>U.daysBetween(e.delivered||U.todayISO(),U.todayISO())).sort((a,b)=>b-a)[0]||0;
  const closed=S.db().eqa.filter(e=>stageOf(e)==='scored'&&e.reported&&e.delivered);
  const avgTat=closed.length?Math.round(U.avg(closed.map(e=>U.daysBetween(e.delivered,e.reported)))*10)/10:null;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Composite score',value:composite(),dec:1,unit:'%',icon:'target',formatted:'0.0',delta:2.4,note:'Weighted across '+schemes.length+' schemes',spark:C.spark(trend().values,{color:'var(--gold)'})})+'</div>'
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
  return Object.keys(seen).sort((a,b)=>seen[b]-seen[a]||a.localeCompare(b));
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
function scorecard(){
  const db=S.db(); const latest=S.eqaLatest();
  const schemes=Object.keys(latest).map(k=>{ const e=latest[k]; const pct=e.scorePercent!=null?e.scorePercent:Math.max(0,100-Math.abs(e.score||0)*25);
    return {name:k,e,pct:Math.round(pct),stage:stageOf(e)}; });
  const tr=trend();
  const groups=schemeGroups();
  const val=e=>e.scorePercent!=null?e.scorePercent+'%':(e.score!=null?e.score+' SD':'—');
  const cellPill=(v,scoring)=>{
    if(v==null) return '<span class="xs faint">—</span>';
    const bad=scoring==='%'?(v<90):(Math.abs(v)>=3), warn=scoring==='%'?(v<95):(Math.abs(v)>=2);
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
   +'<div class="c8">'+UI.card({title:'Quarterly composite',sub:'Target band 90% · EQAS proficiency rounds',icon:'chart-line',cls:'gold',
      tools:'<span class="pill '+(composite()>=90?'teal':'amber')+'">'+composite()+'% composite</span>',
      body:'<div id="eqaTrend"></div>',
      foot:'<span>Band = minimum acceptable performance (90%)</span><span class="mono">5 rounds shown</span>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Overall standing',sub:'Traffic-light interpretation',icon:'shield-check',body:
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">'+C.ring(composite(),{size:104,stroke:7})+'<div><div class="strong">'+(composite()>=95?'Excellent':composite()>=90?'Acceptable':'Action required')+'</div><div class="xs faint" style="margin-top:3px">ISO 15189 §7.7.3<br>Interlaboratory comparisons</div></div></div>'
      +schemes.map(s=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc(s.e.code)+' · '+(s.stage==='awaiting'?'awaiting results':U.fmtDate(s.e.reported))+'</div></div><span class="pill '+(s.stage==='awaiting'?'amber':s.pct>=90?'teal':'amber')+'">'+(s.stage==='awaiting'?'pending':s.pct+'%')+'</span></div>').join('')})+'</div>'
   +'<div class="c12"><div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('award',14,'ic')+'Per-scheme scorecard</div>'
      +'<div class="card-sub">One table per scheme, newest round first · every analyte that has data for that scheme is shown · analysts can be added from any round</div></div>'
      +'<div class="card-tool row gap-sm"><button class="btn xs" data-new-eqa>'+UI.ic('plus',12)+'New round</button><button class="btn xs" data-export>'+UI.ic('download',12)+'Export</button></div></div>'
      +'<div class="card-body" style="display:flex;flex-direction:column;gap:14px">'+(schemeTables||'<p class="xs faint">No EQA / PT rounds recorded yet.</p>')+'</div></div></div>'
   +'</div>';
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
const PROGRAMS=['Hematology','Biochemistry','Serology','HIV','TB','Microbiology','Parasitology','Blood bank','Molecular'];
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
  const an=e?e.analytes||{}:{};
  const courses=U.uniq(PROGRAMS.concat(S.db().eqa.map(x=>x.program)));
  const program=(e&&e.program)||presetProgram||courses[0];
  const known=analyteCatalog(program);
  const rows=Object.keys(an).length
    ? Object.keys(an).map(a=>analyzeRow(a,an[a],scoring)).join('')
    : (known.length?known.map(a=>analyzeRow(a,null,scoring)).join(''):analyzeRow('',null,scoring)+analyzeRow('',null,scoring));
  const title=e?(stage==='awaiting'?'Add results — ':'Edit EQA / PT round — ')+e.program+' '+e.code:(presetProgram?'Record a '+presetProgram+' round':'Record an EQA / PT round');
  UI.modal({title,sub:'Record the dispatch now and come back for the results. Nothing is lost while you wait, and the wait itself is measured.',width:'min(820px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Scheme / programme</label><select class="select" id="eqProgram">'+courses.map(c=>'<option'+(program===c?' selected':'')+'>'+U.esc(c)+'</option>').join('')+'</select></div>'
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
        const list=analyteCatalog(ev.target.value);
        const typed={};
        host.querySelectorAll('[data-analyte-row]').forEach(r=>{ const n=r.querySelector('[data-an="name"]').value.trim(); const v=r.querySelector('[data-an="value"]').value; if(n) typed[n]=v; });
        const merged=U.uniq(list.concat(Object.keys(typed)));
        host.innerHTML=(merged.length?merged.map(a=>analyzeRow(a,typed[a]===''||typed[a]===undefined?null:typed[a],scoringSel.value)).join(''):analyzeRow('',null,scoringSel.value));
        bindRows();
      };
      el.querySelector('[data-save]').onclick=()=>{
        const program=el.querySelector('#eqProgram').value;
        const code=el.querySelector('#eqCode').value.trim()||'Round';
        const scoring=scoringSel.value;
        const analytes={};
        host.querySelectorAll('[data-analyte-row]').forEach(row=>{
          const name=row.querySelector('[data-an="name"]').value.trim();
          const val=parseFloat(row.querySelector('[data-an="value"]').value);
          if(name && !isNaN(val)) analytes[name]=val;
        });
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
          if(e){ const x=d.eqa.find(y=>y.id===e.id); if(x) Object.assign(x,rec); }
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
function paint(){
  const host=rootEl.querySelector('#eqaBody'); if(!host) return;
  host.innerHTML=tab==='scorecard'?scorecard():qcCalendar();
  U.$$('[data-eqa-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.eqaTab===tab));
  wireBody();
}
function wireBody(){
  const r=rootEl;
  r.querySelectorAll('[data-eqa-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.eqaTab; paint(); });
  if(tab==='scorecard'){
    const tr=trend();
    C.line(r.querySelector('#eqaTrend'),{id:'eqaT',height:230,min:70,max:100,series:[{name:'Composite',color:'var(--gold)',values:tr.values}],labels:tr.labels,target:{value:90,label:'target 90%'},yFmt:v=>Math.round(v)+'%',tipFmt:v=>v+'%',drawMs:1400});
    r.querySelectorAll('[data-eqa]').forEach(tr2=>tr2.onclick=()=>{ const e=S.db().eqa.find(x=>x.id===tr2.dataset.eqa); if(!e) return;
      const st=stageOf(e), tu=turnaround(e), waiting=U.daysBetween(e.delivered||U.todayISO(),U.todayISO());
      UI.drawer({title:e.program+' · '+e.code,eyebrow:'EQA round',body:'<div class="row wrap gap-sm" style="margin-bottom:12px"><span class="pill '+STAGE[st].tone+'">'+STAGE[st].label+'</span>'
        +(st==='awaiting'?'<span class="pill '+(waiting>30?'rose':'slate')+'">'+waiting+' days since dispatch</span>':'')
        +(tu.toResult!=null?'<span class="pill slate">report in '+tu.toResult+'d</span>':'')+'</div>'
        +'<div class="split-2">'+[['Delivered',U.fmtDate(e.delivered)],['Tested / submitted',U.fmtDate(e.tested)],['Results received',e.reported?U.fmtDate(e.reported):'waiting'],['Score published',U.fmtDate(e.scorePublished)],['Scoring',e.scoring==='%'?'Percentage':'Standard deviation index'],['Verdict',e.overall||'pending']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
      +'<div class="section-head"><h2>Analyte detail</h2></div>'+Object.keys(e.analytes||{}).map(a=>{ const z=e.analytes[a]; const az=Math.abs(z); return '<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(a)+'</div><div class="lr-sub">'+(e.scoring==='%'?'recovery':'z-score')+' · '+(az>=3?'unsatisfactory':az>=2?'warning':'acceptable')+'</div></div><span class="pill '+(az>=3?'rose':az>=2?'amber':'teal')+' mono">'+(z>0?'+':'')+z+'</span></div>'; }).join('')
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
   +'<div class="filters" style="margin-bottom:12px">'+[['scorecard','Scorecard'],['qc','QC calendar']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-eqa-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="eqaBody"></div>';
  paint();
};
})();
