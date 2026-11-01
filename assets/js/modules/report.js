/* ============================================================================
   MODULE · MONTHLY REPORTS — the district hospital HMIS return, month by month
   ----------------------------------------------------------------------------
   The laboratory reports its month to the district on the HMIS form: a numbered
   list of examinations, each with positives, negatives and — for the malaria and
   stool sections — the age split. That list is data (see S.reportLines): the form's
   own lines, whatever the department has added, and a line for every examination on
   the test menu that no line covers yet. A new test therefore appears on the report
   the day it is introduced, without touching this file.

   Two readings of the same month:
     · the report — the form itself, filled in, with every total computed
     · the analysis — what was requested most and least, what came back positive,
       how the sections compare, and what the blood bank did
   Both feed the export, which is laid out like the paper return.
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.reports=M;
let rootEl=null, monthKey=null, lastParams={};

const MODES={
  pn:   {cols:['pos','neg'], heads:['Positives','Negatives']},
  pn2:  {cols:['pos','neg','a0','a1'], heads:['Positives','Negatives','<5 yrs','5 yrs+']},
  posage3:{cols:['pos','a0','a1','a2'], heads:['Positives','0–4 yrs','5–15 yrs','16+ yrs']},
  quant:{cols:['total'], heads:['Total']}
};
const FIELD_LABEL={pos:'positives',neg:'negatives',a0:'under five',a1:'five and over',a2:'sixteen and over',total:'total'};

function months(){ const list=S.reportMonths(); return list.length?list:[U.todayISO().slice(0,7)]; }
function monthLabel(k){
  const y=+String(k).slice(0,4), m=+String(k).slice(5,7);
  return (U.M3?U.M3[m-1]:'')+' '+y;
}
function pickMonth(){
  if(monthKey && S.reportMonths().indexOf(monthKey)>=0) return monthKey;
  return months()[0];
}
function summary(){ return S.reportSummary(pickMonth()); }
function canEdit(){ return !!(LS.auth.can && LS.auth.can('edit')); }

/* ——— the report itself ————————————————————————————————— */
function numCell(line,row,field){
  const v=row[field]||0;
  return '<td class="rep-td"><input class="rep-in mono'+(v?' has':'')+'" type="number" min="0" step="1" '
    +'inputmode="numeric" data-line="'+U.esc(line.id)+'" data-field="'+field+'" value="'+(v||'')+'" '
    +(canEdit()?'':'readonly ')+'aria-label="'+U.esc(line.label+' '+FIELD_LABEL[field])+'"></td>';
}
function rowHTML(r){
  const line=r.line;
  if(line.mode==='band'){
    return '<tr class="rep-band"><td colspan="6"><span class="rep-band-t">'+U.esc(line.label)+'</span></td></tr>';
  }
  const spec=MODES[line.mode]||MODES.pn;
  const cls='rep-row'+(line.indent?' ind'+Math.min(2,line.indent):'')+(line.breakdown?' rep-break':'')+(r.total?'':' rep-zero');
  return '<tr class="'+cls+'" data-row="'+U.esc(line.id)+'">'
    +'<td class="rep-exam">'+(line.no?'<span class="rep-no">'+U.esc(line.no)+'</span> ':'')+U.esc(line.label)
      +(line.auto?' <span class="rep-tag" title="Added from the test menu">new</span>':'')
      +(line.custom?' <span class="rep-tag" title="Added on this report">added</span>':'')+'</td>'
    +spec.cols.map(f=>numCell(line,r,f)).join('')
    +'<td class="rep-total mono" data-total="'+U.esc(line.id)+'">'+(r.total?U.fmtNum(r.total):'—')+'</td>'
    +(canEdit()&&line.custom?'<td class="rep-del"><button class="icon-btn" data-del-line="'+U.esc(line.id)+'" title="Remove this examination from the report">'+UI.ic('x',12)+'</button></td>':'<td class="rep-del"></td>')
    +'</tr>';
}
function sectionHTML(sec){
  const counted=sec.rows.filter(r=>!r.band);
  const spec=(function(){
    const l=counted.find(r=>r.line.mode!=='band'&&r.line.mode!=='quant');
    return MODES[l?l.line.mode:'pn2'];
  })();
  const hasAges=spec.cols.indexOf('a0')>=0;
  return '<div class="rep-sec" data-sec="'+sec.key+'">'
    +'<div class="rep-sec-head"><span class="rep-sec-no">'+U.esc(sec.no)+'</span>'
      +'<span class="rep-sec-title">'+U.esc(sec.title)+'</span>'
      +'<span class="grow"></span>'
      +(sec.key==='stool'?'<span class="rep-sec-note">'+U.fmtNum(sec.total)+' samples analysed</span>':'')
      +'<span class="rep-sec-tot mono" data-sec-total="'+sec.key+'">'+U.fmtNum(sec.total)+'</span></div>'
    +'<div class="rep-scroll"><table class="rep-table"><thead><tr>'
      +'<th class="rep-th-exam">Exams</th>'
      +spec.heads.map(h=>'<th>'+h+'</th>').join('')
      +'<th class="rep-th-total">Total</th><th class="rep-th-del"></th>'
    +'</tr></thead><tbody>'+sec.rows.map(rowHTML).join('')
      +(function(){
        if(!counted.length) return '';
        const sum=c=>U.sum(counted.filter(r=>!r.line.breakdown),r=>r[c]||0);
        return '<tr class="rep-sum"><td>Section total</td>'
          +spec.cols.map(f=>'<td class="mono">'+(sum(f)?U.fmtNum(sum(f)):'0')+'</td>').join('')
          +'<td class="mono strong">'+U.fmtNum(sec.total)+'</td><td></td></tr>';
      })()
    +'</tbody></table></div>'
    +(hasAges?'':'')
    +'</div>';
}
function tableCard(sm){
  return UI.card({title:'The return, filled in',sub:monthLabel(sm.key)+' · '+sm.totals.examinations+' examinations on the form · every total is computed, never typed twice',icon:'clipboard-list',
    cls:'rep-card',
    tools:'<button class="btn xs" data-add-line>'+UI.ic('plus',12)+'Add examination</button>'
      +'<button class="btn xs" data-export>'+UI.ic('download',12)+'Export the return</button>',
    body:'<div class="rep-legend"><span><i class="rep-dot"></i>typed here</span><span><b class="mono">—</b> computed</span>'
      +'<span><i class="rep-dot auto"></i>new test, added from the menu</span>'
      +'<span class="grow"></span><span class="xs faint">The form grows with the laboratory: a test added in Settings → Test menu appears here by itself.</span></div>'
      +sm.sections.map(sectionHTML).join(''),
    foot:'<span>Positives, negatives and the age split are what the district receives · blood supply is on its own table below</span>'
      +'<span class="mono strong">'+U.fmtNum(sm.totals.tests)+' tests</span>'});
}
function bloodCard(sm){
  const bt=sm.bloodTotals;
  const usage=bt.recv?Math.round(bt.used/bt.recv*100):0;
  return UI.card({title:'Blood supply',sub:'Section VIII · packs by group type, opening balance to closing balance',icon:'droplets',cls:'rep-blood',
    tools:'<span class="pill '+(usage>=90?'teal':usage>=60?'gold':'amber')+'">'+usage+'% of what arrived was transfused</span>',
    body:'<div class="rep-scroll"><table class="rep-table rep-blood-t"><thead><tr>'
      +'<th class="rep-th-exam">Group type</th>'
      +S.REPORT_BLOOD_FIELDS.map(f=>'<th>'+U.esc(f[1])+'</th>').join('')
      +'<th class="rep-th-total">Present at the end</th></tr></thead><tbody>'
      +S.REPORT_GROUPS.map(g=>{ const row=sm.blood[g];
        return '<tr class="rep-row'+(row.recv||row.open||row.used?'':' rep-zero')+'" data-blood="'+g+'"><td class="rep-exam"><span class="rep-no">'+U.esc(g)+'</span></td>'
          +S.REPORT_BLOOD_FIELDS.map(f=>'<td class="rep-td"><input class="rep-in mono'+(row[f[0]]?' has':'')+'" type="number" min="0" step="1" '
            +(canEdit()?'':'readonly ')+'data-blood-group="'+U.esc(g)+'" data-blood-field="'+f[0]+'" value="'+(row[f[0]]||'')+'"></td>').join('')
          +'<td class="rep-total mono" data-blood-end="'+g+'">'+(row.end?U.fmtNum(row.end):'—')+'</td></tr>';
      }).join('')
      +'<tr class="rep-sum"><td>Sum</td>'
        +S.REPORT_BLOOD_FIELDS.map(f=>'<td class="mono">'+U.fmtNum(bt[f[0]])+'</td>').join('')
        +'<td class="mono strong">'+U.fmtNum(bt.end)+'</td></tr>'
      +'</tbody></table></div>',
    foot:'<span>Closing balance = opening + received − used − expired/damaged/lost − returned</span>'
      +'<span class="mono">'+U.fmtNum(bt.recv)+' received · '+U.fmtNum(bt.used)+' used · '+U.fmtNum(bt.expired)+' lost</span>'});
}
function identCard(sm){
  const m=sm.meta||{};
  const rows=[['Service name','service','Laboratory'],['Catchment population','catchment','—'],
    ['District','district','Gakenke'],['Sector','sector','Ruli'],['Financial year','year','2026/2027'],
    ['Month','monthName',''],['Name of in-charge','charge','Kelvin SAMAHANI'],
    ['Qualification','qualification','A0'],['Date sent','sentDate',''],['Entered in DHIS2','enteredInDhis','—']];
  const field=(k,label,def)=>{
    const v=m[k]==null?'':m[k];
    return '<div class="rep-id"><label>'+U.esc(label)+'</label>'
      +'<input class="input mono" data-meta="'+k+'" value="'+U.esc(v===''?def:v)+'" placeholder="'+U.esc(def)+'"'+(canEdit()?'':' readonly')+'></div>';
  };
  return UI.card({title:'Identification',sub:'Section II · what the district needs to file the return',icon:'file-badge',cls:'rep-ident',
    body:'<div class="rep-id-grid">'+rows.map(r=>field(r[1],r[0],r[2])).join('')+'</div>'
      +(m.source?'<div class="xs faint" style="margin-top:8px">'+U.esc(m.source)+'</div>':''),
    foot:'<span>Sent to Gakenke District · HMIS section IX (laboratory) and VIII (blood supply)</span>'
      +'<span class="mono">'+U.fmtNum(sm.totals.tests)+' tests</span>'});
}

/* ——— analysis ————————————————————————————————————— */
function kpis(sm){
  const t=sm.totals, bt=sm.bloodTotals;
  const ranked=S.reportRankings(sm);
  const top=ranked.requested[0];
  const rate=t.qualTests?Math.round(t.qualPositives/t.qualTests*1000)/10:0;
  const monthsList=S.reportMonths();
  const all=monthsList.map(k=>S.reportSummary(k));
  const trend=all.slice().reverse().map(x=>x.totals.tests);
  const wastage=bt.recv?Math.round((bt.expired+bt.returned)/bt.recv*1000)/10:0;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Tests conducted',value:t.tests,icon:'flask-conical',formatted:'0',
      note:t.examinations+' examinations on the form · '+t.entered+' carried a figure',spark:C.spark(trend.length?trend:[t.tests],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Positive results',value:t.qualPositives,icon:'activity',formatted:'0',
      note:rate+'% of the '+U.fmtNum(t.qualTests)+' qualitative tests',spark:C.spark([rate,rate],{color:'var(--rose-400)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Most requested',value:top?top.figure:0,icon:'bar-chart-3',formatted:'0',
      note:top?top.label.split(' ').slice(1).join(' '):'—',spark:C.spark([1,1],{color:'var(--teal-400)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Blood packs used',value:bt.used,icon:'droplets',formatted:'0',
      note:bt.recv+' received · '+wastage+'% lost or returned',spark:C.spark([bt.open,bt.recv,bt.used,bt.end],{color:'var(--rose-500)'})})+'</div>'
   +'</div>';
}
function analysis(sm){
  const ranked=S.reportRankings(sm);
  const top=ranked.requested.slice(0,10);
  const least=ranked.least.filter(r=>r.figure>0).slice(0,10);
  const pos=ranked.positives.slice(0,10);
  const quiet=(sm.lines||[]).filter(r=>!r.band && !r.line.breakdown && r.total===0);
  const secs=sm.sections.filter(s=>s.total>0);
  const bt=sm.bloodTotals;
  return '<div class="grid-12" style="gap:14px">'
   +'<div class="c6">'+UI.card({title:'Top 10 requested examinations',sub:'By the number of tests carried out this month',icon:'bar-chart-3',
      body:'<div id="repTop"></div>',
      foot:'<span>Full list on the return above</span><span class="mono">'+U.fmtNum(sm.totals.tests)+' tests</span>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Top positive tests',sub:'Qualitative examinations, by the number that came back positive',icon:'activity',
      body:'<div id="repPos"></div>',
      foot:'<span>Percentages are of the tests of that examination, not of the month</span><span class="mono">'+U.fmtNum(sm.totals.qualPositives)+' positives</span>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Least requested examinations',sub:'The tests that ran fewest times — the ones to look at before ordering habits change',icon:'trending-down',
      body:'<div id="repLeast"></div>',
      foot:'<span>'+(quiet.length?quiet.length+' examinations were not requested at all this month':'Every examination was used at least once')+'</span>'
        +(quiet.length?'<span class="rep-quiet">'+quiet.slice(0,6).map(r=>U.esc(r.line.label)).join(' · ')+(quiet.length>6?' …':'')+'</span>':'')})+'</div>'
   +'<div class="c6">'+UI.card({title:'Blood transfusion',sub:'Packs by group type · received, transfused, closing balance',icon:'droplets',
      body:'<div class="rep-blood-an"><div class="rep-blood-bars">'+S.REPORT_GROUPS.map(g=>{
          const row=sm.blood[g]; const max=Math.max.apply(null,S.REPORT_GROUPS.map(x=>Math.max(sm.blood[x].recv,sm.blood[x].used)).concat([1]));
          return '<div class="rep-bb"><span class="rep-bb-g">'+U.esc(g)+'</span>'
            +'<div class="rep-bb-track"><i class="recv" style="width:'+(row.recv/max*100)+'%"></i><i class="used" style="width:'+(row.used/max*100)+'%"></i></div>'
            +'<span class="mono xs">'+row.used+'/'+row.recv+'</span></div>'; }).join('')+'</div>'
        +'<div class="rep-blood-sum">'
          +[['Received',bt.recv,'gold'],['Transfused',bt.used,'teal'],['Expired or lost',bt.expired,'rose'],['Returned',bt.returned,'slate'],['Closing balance',bt.end,'gold']]
            .map(x=>'<div><div class="eyebrow">'+x[0]+'</div><div class="mono strong" style="font-size:1.05rem">'+U.fmtNum(x[1])+'</div></div>').join('')
        +'</div>'
        +'<div class="rep-blood-ring">'+C.ring(bt.recv?Math.round(bt.used/bt.recv*100):0,{size:104,stroke:7})
          +'<div><div class="small strong">Transfusion rate</div><div class="xs faint">'+(bt.recv-bt.used-bt.expired-bt.returned)+' packs left in the bank · '+bt.expired+' expired · '+bt.returned+' returned</div></div></div>'
        +'</div>',
      foot:'<span>O+ and B+ carried the month</span><span class="mono">'+U.fmtNum(bt.recv)+' packs received</span>'})+'</div>'
   +'<div class="c7">'+UI.card({title:'Where the work sits',sub:'Tests by section of the return',icon:'layers',
      body:'<div id="repSections"></div>',
      foot:'<span>Section totals as printed on the return</span><span class="mono">'+secs.length+' sections used</span>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Month on month',sub:'Tests conducted, as the returns on file record them',icon:'chart-line',
      body:'<div id="repTrend"></div>',
      foot:'<span>'+(S.reportMonths().length<2?'One month on file — the line fills as returns are added':'Each point is a monthly return')+'</span>'
        +'<span class="mono">'+S.reportMonths().length+' months</span>'})+'</div>'
   +'</div>';
}

function drawCharts(root,sm){
  const ranked=S.reportRankings(sm);
  const hb=(el,items)=>{ if(!el) return; C.hbars(el,{items,limit:items.length,gap:9}); };
  hb(root.querySelector('#repTop'),ranked.requested.slice(0,10).map(r=>({label:r.label,value:r.figure,tone:'gold'})));
  hb(root.querySelector('#repPos'),ranked.positives.slice(0,10).map(r=>({label:r.label,value:r.pos,
    display:U.fmtNum(r.pos)+(r.rate!=null?' · '+r.rate+'%':''),tone:'rose'})));
  hb(root.querySelector('#repLeast'),ranked.least.filter(r=>r.figure>0).slice(0,10).map(r=>({label:r.label,value:r.figure,tone:'teal'})));
  hb(root.querySelector('#repSections'),sm.sections.filter(s=>s.total>0).map(s=>({
    label:s.no+'. '+s.title,value:s.total,display:U.fmtNum(s.total)+' · '+Math.round(s.total/sm.totals.tests*100)+'%',tone:'blue'})));
  const months=S.reportMonths().slice().reverse();
  const el=root.querySelector('#repTrend');
  if(el){
    if(months.length<2){
      el.innerHTML='<div class="rep-trend-single"><div class="rep-trend-v">'+U.fmtNum(sm.totals.tests)+'</div>'
        +'<div class="xs faint">tests in '+monthLabel(sm.key)+'</div></div>';
    } else {
      const sums=months.map(k=>S.reportSummary(k));
      C.line(el,{id:'repTrend',height:238,padLeft:56,series:[
        {name:'Tests',color:'var(--gold)',values:sums.map(x=>x.totals.tests)},
        {name:'Positives',color:'var(--rose-400)',values:sums.map(x=>x.totals.qualPositives)}],
        labels:months.map(monthLabel)});
    }
  }
}

/* ——— editing ————————————————————————————————— */
function wire(root){
  const paint=()=>{ renderInner(root); };
  root.querySelectorAll('.rep-in[data-line]').forEach(inp=>{
    inp.addEventListener('input',()=>{ if(inp.value!==''&&inp.value!=='0') inp.classList.add('has'); else if(inp.value==='') inp.classList.remove('has'); });
    inp.addEventListener('change',()=>{
      if(!canEdit()) return;
      const lineId=inp.dataset.line, field=inp.dataset.field;
      S.reportSet(pickMonth(),lineId,field,inp.value);
      /* the row total, the section total and the page totals move without a repaint */
      const sm=summary();
      const row=(sm.lines||[]).find(r=>r.id===lineId);
      const cel=root.querySelector('[data-total="'+lineId+'"]');
      if(cel&&row) cel.textContent=row.total?U.fmtNum(row.total):'—';
      const sec=sm.sections.find(s=>s.rows.some(r=>r.id===lineId));
      if(sec){ const st=root.querySelector('[data-sec-total="'+sec.key+'"]'); if(st) st.textContent=U.fmtNum(sec.total); }
      const head=root.querySelector('[data-page-total]'); if(head) head.textContent=U.fmtNum(sm.totals.tests);
      const foot=root.querySelector('[data-page-tests]'); if(foot) foot.textContent=U.fmtNum(sm.totals.tests);
    });
  });
  root.querySelectorAll('.rep-in[data-blood-group]').forEach(inp=>{
    inp.addEventListener('change',()=>{
      if(!canEdit()) return;
      const g=inp.dataset.bloodGroup, f=inp.dataset.bloodField;
      S.reportBlood(pickMonth(),g,f,inp.value);
      if(inp.value!==''&&inp.value!=='0') inp.classList.add('has'); else inp.classList.remove('has');
      const sm=summary();
      const endEl=root.querySelector('[data-blood-end="'+g+'"]');
      if(endEl) endEl.textContent=sm.blood[g].end?U.fmtNum(sm.blood[g].end):'—';
      const sumRow=root.querySelector('.rep-blood-t .rep-sum');
      if(sumRow){
        const cells=sumRow.querySelectorAll('td');
        S.REPORT_BLOOD_FIELDS.forEach((fld,i)=>{ if(cells[i+1]) cells[i+1].textContent=U.fmtNum(sm.bloodTotals[fld[0]]); });
        if(cells[cells.length-1]) cells[cells.length-1].textContent=U.fmtNum(sm.bloodTotals.end);
      }
    });
  });
  root.querySelectorAll('[data-meta]').forEach(inp=>{
    inp.addEventListener('change',()=>{ if(canEdit()) S.reportMeta(pickMonth(),inp.dataset.meta,inp.value); });
  });
  const add=root.querySelector('[data-add-line]'); if(add) add.onclick=addLineModal;
  const exp=root.querySelector('[data-export]'); if(exp) exp.onclick=()=>{
    if(!LS.sheets||!LS.sheets.offerReport) return UI.toast('The export is not available yet',{type:'warn'});
    LS.sheets.offerReport(summary(),{actor:LS.auth.user.name});
  };
  root.querySelectorAll('[data-del-line]').forEach(b=>b.onclick=()=>{
    if(!canEdit()) return;
    const id=b.dataset.delLine;
    UI.confirm({title:'Remove this examination from the report?',body:'The line leaves the form for every month. Past figures stored against it are removed with it; the audit trail keeps the record.',confirm:'Remove the line',danger:true,
      onConfirm:()=>{ S.reportRemoveLine(id); UI.toast('Line removed from the report',{type:'ok'}); paint(); }});
  });
}
function addLineModal(){
  if(!canEdit()) return UI.toast('Sign in to change the report',{type:'warn'});
  const secs=S.REPORT_SECTIONS.map(s=>'<option value="'+s.key+'">'+U.esc(s.no+'. '+s.title)+'</option>').join('');
  UI.modal({title:'Add an examination to the return',sub:'It joins the form from this month onwards — nothing has to be re-coded when the laboratory takes on a new test.',
    width:'min(560px,100%)',
    body:'<div class="form-grid">'
     +'<div class="field span2"><label>Examination</label><input class="input" id="rlLabel" placeholder="e.g. Blood cultures transferred"></div>'
     +'<div class="field"><label>Section of the form</label><select class="select" id="rlSection">'+secs+'</select></div>'
     +'<div class="field"><label>How it is counted</label><select class="select" id="rlMode">'
       +'<option value="pn">Positives and negatives</option><option value="pn2">Positives, negatives and age split</option>'
       +'<option value="posage3">Positives with 0–4 / 5–15 / 16+</option><option value="quant">A single total</option></select></div>'
     +'<div class="field"><label>Number on the form (optional)</label><input class="input mono" id="rlNo" placeholder="8.39"></div>'
     +'<div class="field"><label>Link to a test on the menu (optional)</label><select class="select" id="rlTest"><option value="">— none —</option>'
       +S.allTests().map(t=>'<option value="'+U.esc(t.name)+'">'+U.esc(t.name)+'</option>').join('')+'</select></div>'
     +'</div><div class="hint" style="margin-top:8px">A line linked to a test carries that test\u2019s name, so the two never drift apart. Left unlinked, it is simply a new line on the form — which is how the blood cultures that are referred out are added.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',14)+'Add to the form</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const label=(el.querySelector('#rlLabel').value||'').trim();
        if(!label) return UI.toast('Name the examination',{type:'warn'});
        S.reportAddLine({label,section:el.querySelector('#rlSection').value,mode:el.querySelector('#rlMode').value,
          no:(el.querySelector('#rlNo').value||'').trim(),test:el.querySelector('#rlTest').value||null});
        close(); UI.toast('“'+label+'” added to the return',{type:'ok'}); renderInner(rootEl);
      };
    }});
}

/* ——— paint ————————————————————————————————— */
function head(sm){
  const list=S.reportMonths();
  const opts=(list.length?list:[pickMonth()]).map(k=>'<option value="'+k+'"'+(k===pickMonth()?' selected':'')+'>'+monthLabel(k)+'</option>').join('');
  const status=sm.meta&&sm.meta.source?'<span class="pill gold">'+UI.ic('file-check',11)+'on file</span>':'<span class="pill amber">draft</span>';
  return '<div class="page-head"><div><h1>Monthly reports</h1>'
   +'<div class="sub">The laboratory\u2019s HMIS return to Gakenke District — the form the district receives, the analysis behind it, and an export laid out like the paper sheet.</div></div>'
   +'<div class="actions">'
     +'<div class="rep-month"><label class="xs faint">Return for</label><select class="select mono" id="repMonth">'+opts+'</select></div>'
     +'<button class="btn" data-new-month>'+UI.ic('calendar-plus',15)+'New month</button>'
     +'<button class="btn primary" data-export>'+UI.ic('download',15)+'Export the return</button>'
   +'</div></div>'
   +'<div class="rep-strip">'+status
     +'<span class="pill slate mono">'+U.fmtNum(sm.totals.tests)+' tests</span>'
     +'<span class="pill slate mono">'+U.fmtNum(sm.totals.qualPositives)+' positives</span>'
     +'<span class="pill slate mono">'+sm.bloodTotals.used+' packs transfused</span>'
     +'<span class="grow"></span><span class="xs faint">Section IX laboratory · section VIII blood supply · the same order every month</span></div>';
}
function renderInner(root){
  const sm=summary();
  root.innerHTML=head(sm)+kpis(sm)
    +'<div class="rep-pair">'+tableCard(sm)+'</div>'
    +'<div class="grid-12" style="gap:14px;margin-top:14px"><div class="c5">'+identCard(sm)+'</div><div class="c7">'+bloodCard(sm)+'</div></div>'
    +'<div class="rep-analysis-head"><h2>Analysis</h2><span class="xs faint">Every figure is read off the return above — nothing is estimated.</span></div>'
    +analysis(sm);
  const sel=root.querySelector('#repMonth');
  if(sel) sel.onchange=()=>{ monthKey=sel.value; renderInner(root); };
  const nm=root.querySelector('[data-new-month]'); if(nm) nm.onclick=newMonthModal;
  wire(root);
  drawCharts(root,sm);
}
function newMonthModal(){
  if(!canEdit()) return UI.toast('Sign in to open a month',{type:'warn'});
  const next=(function(){ const last=months()[0]; const d=U.parseISO(last+'-01'); d.setMonth(d.getMonth()+1); return d.toISOString().slice(0,7); })();
  UI.modal({title:'Open a month',sub:'The form keeps its lines; only the figures start empty.',width:'min(460px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Month</label><input class="input mono" type="month" id="nmKey" value="'+next+'"></div></div>'
      +'<div class="hint" style="margin-top:8px">Opening a month does not copy the previous figures — a new return starts empty, so nothing from last month can be mistaken for this one.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Open the month</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const k=el.querySelector('#nmKey').value;
        if(!k) return UI.toast('Choose a month',{type:'warn'});
        S.commit(db=>{ db.reporting=db.reporting||{lines:[],months:{}}; if(!db.reporting.months[k]) db.reporting.months[k]=JSON.parse(JSON.stringify({month:k,meta:{},values:{},blood:{},notes:''})); },
          {action:'report.month',entity:'reporting',entityId:k,detail:'Monthly return opened for '+k});
        monthKey=k; close(); UI.toast('Return opened for '+monthLabel(k),{type:'ok'}); renderInner(rootEl);
      };
    }});
}

M.render=async function(root,params){
  rootEl=root; lastParams=params||{};
  if(params&&params.month) monthKey=params.month;
  monthKey=pickMonth();
  renderInner(root);
};
M.month=()=>pickMonth();
})();
