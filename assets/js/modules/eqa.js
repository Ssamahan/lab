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
function kpis(){
  const latest=S.eqaLatest();
  const schemes=Object.keys(latest);
  const passing=schemes.filter(k=>{ const e=latest[k]; return e.overall==='Pass'||e.scorePercent>=90; }).length;
  const zs=[];
  Object.values(S.db().eqa).forEach(e=>Object.values(e.analytes||{}).forEach(v=>zs.push(Math.abs(v))));
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Composite score',value:composite(),dec:1,unit:'%',icon:'target',formatted:'0.0',delta:2.4,note:'Weighted across '+schemes.length+' schemes',spark:C.spark(trend().values,{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Schemes passing',value:passing,unit:'/ '+schemes.length,icon:'badge-check',formatted:'0',note:'PT rounds closed',spark:C.spark([3,3,4,4,4,5],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Max |z| score',value:Math.round(Math.max.apply(null,zs.concat([0]))*10)/10,dec:1,icon:'activity',formatted:'0.0',note:'Acceptable ≤ 2.0 · alert ≥ 3.0',spark:C.spark(zs.slice(-12),{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Open CAPA',value:(S.db().capa||[]).filter(c=>c.status!=='Closed').length,icon:'clipboard-check',formatted:'0',note:'Corrective actions tracked to closure',spark:C.spark([3,2,3,2,1,2,1,1],{color:'var(--info)'})})+'</div></div>';
}
function scorecard(){
  const db=S.db(); const latest=S.eqaLatest();
  const schemes=Object.keys(latest).map(k=>{ const e=latest[k]; const pct=e.scorePercent!=null?e.scorePercent:Math.max(0,100-Math.abs(e.score||0)*25);
    return {name:k,e,pct:Math.round(pct),analytes:e.analytes||{}}; });
  const tr=trend();
  return '<div class="grid-12">'
   +'<div class="c8">'+UI.card({title:'Quarterly composite',sub:'Target band 90% · EQAS proficiency rounds',icon:'chart-line',cls:'gold',
      tools:'<span class="pill '+(composite()>=90?'teal':'amber')+'">'+composite()+'% composite</span>',
      body:'<div id="eqaTrend"></div>',
      foot:'<span>Band = minimum acceptable performance (90%)</span><span class="mono">5 rounds shown</span>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Overall standing',sub:'Traffic-light interpretation',icon:'shield-check',body:
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">'+C.ring(composite(),{size:104,stroke:7})+'<div><div class="strong">'+(composite()>=95?'Excellent':composite()>=90?'Acceptable':'Action required')+'</div><div class="xs faint" style="margin-top:3px">ISO 15189 §7.7.3<br>Interlaboratory comparisons</div></div></div>'
      +schemes.map(s=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(s.name)+'</div><div class="lr-sub">'+U.esc(s.e.code)+' · '+U.fmtDate(s.e.reported)+'</div></div><span class="pill '+(s.pct>=90?'teal':'amber')+'">'+s.pct+'%</span></div>').join('')})+'</div>'
   +'<div class="c12">'+UI.card({title:'Per-scheme scorecard',sub:'Analyte-level z-scores with root-cause notes',icon:'award',tools:'<button class="btn xs" data-export>'+UI.ic('download',12)+'Export</button>',body:
      '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Scheme</th><th>Quarter</th><th>Delivered</th><th>Reported</th><th>Score</th><th>Analytes</th><th>Verdict</th></tr></thead><tbody>'
      +db.eqa.map(e=>{ const pct=e.scorePercent!=null?e.scorePercent:Math.max(0,100-Math.abs(e.score||0)*25);
        return '<tr data-eqa="'+e.id+'"><td class="strong">'+U.esc(e.program)+'</td><td class="num">'+U.esc(e.code)+'</td><td class="num">'+U.fmtDate(e.delivered)+'</td><td class="num">'+U.fmtDate(e.reported)+'</td>'
        +'<td class="num">'+(e.score!=null?e.score+' SD':pct+'%')+'</td>'
        +'<td><div class="row gap-sm wrap">'+Object.keys(e.analytes||{}).slice(0,4).map(a=>{ const z=e.analytes[a]; const abs=e.scoring==='%'?0:Math.abs(z);
            return '<span class="pill '+(abs>=3?'rose':abs>=2?'amber':'teal')+' mono">'+U.esc(a)+' '+(e.scoring==='%'?z+'%':(z>0?'+':'')+z)+'</span>'; }).join('')+(Object.keys(e.analytes||{}).length>4?'<span class="xs faint">+'+(Object.keys(e.analytes).length-4)+'</span>':'')+'</div></td>'
        +'<td><span class="pill '+(pct>=90?'teal':'rose')+'">'+U.esc(e.overall||(pct>=90?'Pass':'Review'))+'</span></td></tr>'; }).join('')
      +'</tbody></table></div>'})+'</div></div>';
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
    r.querySelectorAll('[data-eqa]').forEach(tr2=>tr2.onclick=()=>{ const e=S.db().eqa.find(x=>x.id===tr2.dataset.eqa); if(e) UI.drawer({title:e.program+' · '+e.code,eyebrow:'EQA round',body:'<div class="split-2">'+[['Delivered',U.fmtDate(e.delivered)],['Tested',U.fmtDate(e.tested)],['Reported',U.fmtDate(e.reported)],['Score published',U.fmtDate(e.scorePublished)],['Scoring',e.scoring==='%'?'Percentage':'Standard deviation index'],['Verdict',e.overall||'Pass']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
      +'<div class="section-head"><h2>Analyte detail</h2></div>'+Object.keys(e.analytes||{}).map(a=>{ const z=e.analytes[a]; const az=Math.abs(z); return '<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(a)+'</div><div class="lr-sub">'+(e.scoring==='%'?'recovery':'z-score')+' · '+(az>=3?'unsatisfactory':az>=2?'warning':'acceptable')+'</div></div><span class="pill '+(az>=3?'rose':az>=2?'amber':'teal')+' mono">'+(z>0?'+':'')+z+'</span></div>'; }).join('')
      +'<div class="hint" style="margin-top:12px">'+U.esc(e.note||'')+'</div>',foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-capa2>Open CAPA</button>',onMount:(p)=>{ p.querySelector('[data-capa2]').onclick=()=>{ UI.closeAll(); newCapa(); }; }}); });
    capaList();
    r.querySelectorAll('[data-new-capa]').forEach(b=>b.onclick=newCapa);
    r.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>{
      U.exportCSV('eqa-pt-scores-'+U.todayISO()+'.csv',[['Program','Quarter','Delivered','Reported','Score','Percent','Verdict','Analytes']].concat(S.db().eqa.map(e=>[e.program,e.code,e.delivered,e.reported,e.score!=null?e.score:'',e.scorePercent||'',e.overall||'',JSON.stringify(e.analytes||{})])),{title:'EQA / PT scorecard',actor:LS.auth.user.name});
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
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn primary" data-new-capa>'+UI.ic('plus',15)+' Open CAPA</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['scorecard','Scorecard'],['qc','QC calendar']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-eqa-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="eqaBody"></div>';
  paint();
};
})();
