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
let rootEl=null, monthKey=null, lastParams={}, tab='return', trendId=null, cmpOpen=false;

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
  return UI.card({title:'Blood supply',sub:'Section VIII · packs by group type, opening balance to closing balance',icon:'droplet',cls:'rep-blood',
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
  return UI.card({title:'Identification',sub:'Section II · what the district needs to file the return',icon:'file-text',cls:'rep-ident',
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
   +'<div class="c3">'+UI.stat({label:'Most requested',value:top?top.figure:0,icon:'chart-bar',formatted:'0',
      note:top?top.label.split(' ').slice(1).join(' '):'—',spark:C.spark([1,1],{color:'var(--teal-400)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Blood packs used',value:bt.used,icon:'droplet',formatted:'0',
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
   +'<div class="c6">'+UI.card({title:'Top 10 requested examinations',sub:'By the number of tests carried out this month',icon:'chart-bar',
      body:'<div id="repTop"></div>',
      foot:'<span>Full list on the return above</span><span class="mono">'+U.fmtNum(sm.totals.tests)+' tests</span>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Top positive tests',sub:'Qualitative examinations, by the number that came back positive',icon:'activity',
      body:'<div id="repPos"></div>',
      foot:'<span>Percentages are of the tests of that examination, not of the month</span><span class="mono">'+U.fmtNum(sm.totals.qualPositives)+' positives</span>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Least requested examinations',sub:'The tests that ran fewest times — the ones to look at before ordering habits change',icon:'chart-pie',
      body:'<div id="repLeast"></div>',
      foot:'<span>'+(quiet.length?quiet.length+' examinations were not requested at all this month':'Every examination was used at least once')+'</span>'
        +(quiet.length?'<span class="rep-quiet">'+quiet.slice(0,6).map(r=>U.esc(r.line.label)).join(' · ')+(quiet.length>6?' …':'')+'</span>':'')})+'</div>'
   +'<div class="c6">'+UI.card({title:'Blood transfusion',sub:'Packs by group type · received, transfused, closing balance',icon:'droplet',
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
     +'<button class="btn" data-new-month>'+UI.ic('calendar-days',15)+'New month</button>'
     +'<button class="btn" data-import>'+UI.ic('upload',15)+'Load a past month</button>'
     +'<button class="btn primary" data-export>'+UI.ic('download',15)+'Export the return</button>'
   +'</div></div>'
   +'<div class="rep-tabs">'
     +'<button class="rep-tab'+(tab==='return'?' on':'')+'" data-tab="return">'+UI.ic('clipboard-list',13)+' The return</button>'
     +'<button class="rep-tab'+(tab==='analysis'?' on':'')+'" data-tab="analysis">'+UI.ic('chart-line',13)+' Analysis & history</button>'
     +'<span class="grow"></span>'
     +'<span class="xs faint">'+(S.reportMonths().length)+' month'+(S.reportMonths().length===1?'':'s')+' on file · '+(S.reportMonths().length?'since '+monthLabel(S.reportMonths().slice().sort()[0]):'no history yet')+'</span>'
   +'</div>'
   +'<div class="rep-strip">'+status
     +'<span class="pill slate mono">'+U.fmtNum(sm.totals.tests)+' tests</span>'
     +'<span class="pill slate mono">'+U.fmtNum(sm.totals.qualPositives)+' positives</span>'
     +'<span class="pill slate mono">'+sm.bloodTotals.used+' packs transfused</span>'
     +'<span class="grow"></span><span class="xs faint">Section IX laboratory · section VIII blood supply · the same order every month</span></div>';
}
function renderInner(root){
  const sm=summary();
  root.innerHTML=head(sm)
    +(tab==='analysis'?analysisTab(sm):returnTab(sm));
  const sel=root.querySelector('#repMonth');
  if(sel) sel.onchange=()=>{ monthKey=sel.value; renderInner(root); };
  const nm=root.querySelector('[data-new-month]'); if(nm) nm.onclick=newMonthModal;
  const im=root.querySelector('[data-import]'); if(im) im.onclick=importModal;
  const wb=root.querySelector('[data-load-wb]'); if(wb) wb.onclick=workbookModal;
  root.querySelectorAll('[data-map-rows]').forEach(b=>b.onclick=()=>mapModal(b.dataset.mapRows));
  /* the month table is a way back in time: a row opens that month's return */
  root.querySelectorAll('.rep-hist tr[data-month]').forEach(tr=>tr.onclick=()=>{
    monthKey=tr.dataset.month; tab='return'; renderInner(root);
  });
  root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.tab; renderInner(root); });
  wire(root);
  if(tab==='analysis') drawHistoryCharts(root,sm); else drawCharts(root,sm);
}
function returnTab(sm){
  return kpis(sm)
    +'<div class="rep-pair">'+tableCard(sm)+'</div>'
    +'<div class="grid-12" style="gap:14px;margin-top:14px"><div class="c5">'+identCard(sm)+'</div><div class="c7">'+bloodCard(sm)+'</div></div>'
    +'<div class="rep-analysis-head"><h2>This month at a glance</h2><span class="xs faint">Every figure is read off the return above — nothing is estimated.</span></div>'
    +analysis(sm);
}

/* ——— Analysis & history ————————————————————————————————
   The same returns read as a series: this month against the one before and against
   the same month a year earlier, a month-by-month table, the years rolled up, and
   any single examination followed across every month on file. */
function dirTag(pct){
  if(pct==null) return '<span class="pill slate">no comparison</span>';
  const up=pct>0, flat=pct===0;
  return '<span class="rep-dir '+(flat?'flat':up?'up':'down')+'">'+UI.ic(flat?'arrow-right':up?'arrow-up':'arrow-down',11)+(flat?'no change':(up?'+':'')+pct+'%')+'</span>';
}
function compareStrip(sm){
  const c=S.reportCompare(sm.key);
  const card=(title,sub,cmp)=>{
    if(!cmp) return '<div class="rep-cmp-card"><div class="eyebrow">'+title+'</div>'
      +'<div class="rep-cmp-none">'+sub+'</div></div>';
    return '<div class="rep-cmp-card"><div class="eyebrow">'+title+'</div>'
      +'<div class="rep-cmp-row"><span class="rep-cmp-v mono">'+U.fmtNum(cmp.now.tests)+'</span>'+dirTag(cmp.pct.tests)+'</div>'
      +'<div class="xs faint">'+sub+' · '+(cmp.pct.delta>=0?'+':'')+U.fmtNum(cmp.pct.delta)+' tests</div>'
      +'<div class="rep-cmp-pos">positives '+U.fmtNum(cmp.now.positives)+' '+dirTag(cmp.pct.positives)+'</div></div>';
  };
  const withPrev=c.prev?{now:c.now,pct:c.vsPrev}:null;
  const withYear=c.lastYear?{now:c.now,pct:c.vsYear}:null;
  return '<div class="rep-cmp">'
    +card('This month',monthLabel(sm.key)+(c.prev?' · against '+monthLabel(c.prev.key):''),withPrev)
    +card('Same month last year',c.lastYear?('against '+monthLabel(c.lastYear.key)):'no return for this month a year earlier — load one to see the comparison',withYear)
    +'<div class="rep-cmp-card rep-cmp-wide"><div class="eyebrow">History on file</div>'
      +(function(){ const all=S.reportSeries();
        if(all.length<2) return '<div class="rep-cmp-none">One month on file. Load the months and years behind it — <b>Load a past month</b> — and the month-by-month, yearly and per-test trends fill in.</div>';
        return '<div class="rep-cmp-row"><span class="rep-cmp-v mono">'+all.length+'</span><span class="xs faint">months · '+monthLabel(all[0].key)+' → '+monthLabel(all[all.length-1].key)+'</span></div>'
          +'<div class="xs faint">'+U.fmtNum(U.sum(all,m=>m.tests))+' tests recorded across the history</div>';
      })()+'</div></div>';
}
function monthTable(){
  const all=S.reportSeries().slice().reverse();
  if(!all.length) return UI.empty({art:'search',title:'No returns yet',body:'Open a month, or load one from the spreadsheet, and the history starts here.'});
  const rows=[];
  all.forEach((m,i)=>{
    const prev=all[i+1];
    const pct=prev&&prev.tests?Math.round((m.tests-prev.tests)/prev.tests*1000)/10:null;
    const rate=m.qualTests?Math.round(m.positives/m.qualTests*1000)/10:0;
    rows.push('<tr data-month="'+m.key+'"><td class="rep-m">'+monthLabel(m.key)+'</td>'
      +'<td class="num mono">'+U.fmtNum(m.tests)+'</td>'
      +'<td class="num">'+dirTag(pct)+'</td>'
      +'<td class="num mono">'+U.fmtNum(m.positives)+'</td>'
      +'<td class="num mono">'+rate+'%</td>'
      +'<td class="num mono">'+(m.samples?U.fmtNum(m.samples):'—')+'</td>'
      +'<td class="num mono">'+U.fmtNum(m.bloodUsed)+'</td>'
      +'<td class="num mono">'+U.fmtNum(m.bloodEnd)+'</td></tr>');
  });
  return '<div class="dt-scroll"><table class="dt rep-hist"><thead><tr><th>Month</th><th>Tests</th><th>Change</th><th>Positives</th><th>Positivity</th><th>Stool samples</th><th>Packs used</th><th>Packs left</th></tr></thead>'
    +'<tbody>'+rows.join('')+'</tbody></table></div>';
}
function yearTable(){
  const r=S.reportRollup();
  const row=(x,unit,prev)=>{
    const pct=prev&&prev.avg?Math.round((x.avg-prev.avg)/prev.avg*1000)/10:null;
    return '<tr><td class="rep-m">'+U.esc(x.key)+'</td><td class="num mono">'+x.months+'</td>'
      +'<td class="num mono">'+U.fmtNum(x.tests)+'</td><td class="num mono">'+U.fmtNum(x.avg)+'</td>'
      +'<td class="num">'+dirTag(pct)+'</td><td class="num mono">'+x.positivity+'%</td>'
      +'<td class="num mono">'+U.fmtNum(x.bloodRecv)+'</td><td class="num mono">'+U.fmtNum(x.bloodUsed)+'</td></tr>';
  };
  const body=(list)=>list.map((x,i)=>row(x,'',list[i+1])).join('');
  return '<div class="dt-scroll"><table class="dt rep-hist"><thead><tr><th>Year</th><th>Months</th><th>Tests</th><th>Average a month</th><th>Change</th><th>Positivity</th><th>Packs received</th><th>Packs used</th></tr></thead><tbody>'
    +body(r.years)+'</tbody></table></div>'
    +'<div class="xs faint" style="margin-top:8px">Financial year (July–June) as the district reports it:</div>'
    +'<div class="dt-scroll"><table class="dt rep-hist" style="margin-top:4px"><thead><tr><th>Financial year</th><th>Months</th><th>Tests</th><th>Average a month</th><th>Change</th><th>Positivity</th><th>Packs received</th><th>Packs used</th></tr></thead><tbody>'
    +body(r.fy.slice().reverse())+'</tbody></table></div>';
}
function trendCard(sm){
  const all=S.reportSeries();
  const lines=(sm.lines||[]).filter(r=>!r.band&&!r.line.breakdown);
  const withData=lines.filter(r=>r.total>0||(r.pos||0)>0);
  if(!trendId || !lines.some(r=>r.id===trendId)){
    const fbc=lines.find(r=>/full blood count/i.test(r.line.label));
    trendId=(withData[0]&&withData[0].id)||(fbc&&fbc.id)||null;
  }
  const opts=lines.map(r=>'<option value="'+U.esc(r.id)+'"'+(r.id===trendId?' selected':'')+'>'+U.esc((r.line.no?r.line.no+' ':'')+r.line.label)+'</option>').join('');
  const series=trendId?S.reportTestSeries(trendId):[];
  const line=lines.find(r=>r.id===trendId);
  const first=series.find(x=>x.total>0), last=[].concat(series).reverse().find(x=>x.total>0);
  const pct=first&&last&&first!==last&&first.total?Math.round((last.total-first.total)/first.total*1000)/10:null;
  return UI.card({title:'Follow one examination through time',sub:all.length>1?(series.length+' months on file · every figure read from the return of that month'):'One month on file — load the months before it and the line fills in',icon:'chart-line',cls:'rep-trend',
    tools:'<select class="select mono rep-trend-sel" id="repTrendSel">'+opts+'</select>',
    body:'<div class="rep-trend-head">'
      +(line?'<div><div class="rep-cmp-v mono">'+U.fmtNum(series.length?series[series.length-1].total:0)+'</div><div class="xs faint">'+U.esc(line.label)+' in '+monthLabel(sm.key)+'</div></div>':'')
      +(pct!=null?'<div class="rep-trend-delta">'+dirTag(pct)+'<span class="xs faint">since '+monthLabel(first.key)+'</span></div>':'')
      +'</div>'
      +'<div id="repTestTrend"></div>'
      +'<div class="rep-trend-mini">'+(series.length?series.slice(-6).map(x=>'<div><span class="xs faint">'+x.label+'</span><b class="mono">'+U.fmtNum(x.total)+'</b></div>').join(''):'')+'</div>',
    foot:'<span>Choose any examination on the form — full blood count, amylase, urea, HBV …</span>'
      +'<span class="mono">'+(line&&line.line.mode==='quant'?'a count each month':'positives and negatives')+'</span>'});
}
function moversCard(sm){
  const all=S.reportSeries();
  const idx=all.findIndex(m=>m.key===sm.key);
  const prev=idx>0?all[idx-1]:null;
  if(!prev) return UI.card({title:'What moved since last month',sub:'Needs two months on file',icon:'activity',
    body:'<div class="rep-cmp-none">Load the month before this one and the examinations that rose and fell are listed here, biggest movement first.</div>'});
  const movers=S.reportMovers(prev.key,sm.key);
  const up=movers.filter(m=>m.change>0).slice(0,7), down=movers.filter(m=>m.change<0).slice(0,7);
  const row=(m)=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(m.label)+'</div>'
    +'<div class="lr-sub">'+U.fmtNum(m.from)+' → '+U.fmtNum(m.to)+'</div></div>'
    +'<span class="mono xs" style="color:var(--'+(m.change>0?'pos':'crit')+')">'+(m.change>0?'+':'')+U.fmtNum(m.change)+'</span></div>';
  return UI.card({title:'What moved since '+monthLabel(prev.key),sub:'Examinations by change in the number carried out',icon:'activity',
    body:'<div class="grid-12" style="gap:12px"><div class="c6"><div class="eyebrow" style="margin-bottom:6px">Rising</div>'+(up.length?up.map(row).join(''):'<p class="xs faint">Nothing rose.</p>')+'</div>'
      +'<div class="c6"><div class="eyebrow" style="margin-bottom:6px">Falling</div>'+(down.length?down.map(row).join(''):'<p class="xs faint">Nothing fell.</p>')+'</div></div>',
    foot:'<span>Biggest movements first, on the examinations the form counts</span>'
      +'<span class="mono">'+movers.length+' moved</span>'});
}
function sectionsOverTime(){
  const all=S.reportSeries();
  const keys=S.REPORT_SECTIONS.map(x=>x.key);
  const used=keys.filter(k=>all.some(m=>m.sections[k]>0));
  if(!used.length) return '<p class="xs faint">No section carries a figure yet.</p>';
  return '<div class="dt-scroll"><table class="dt rep-hist"><thead><tr><th>Month</th>'
    +used.map(k=>{ const sec=S.REPORT_SECTIONS.find(x=>x.key===k); return '<th>'+U.esc(sec.no+'. '+sec.title)+'</th>'; }).join('')
    +'</tr></thead><tbody>'
    +all.slice().reverse().map(m=>'<tr><td class="rep-m">'+monthLabel(m.key)+'</td>'
      +used.map(k=>'<td class="num mono">'+(m.sections[k]?U.fmtNum(m.sections[k]):'—')+'</td>').join('')+'</tr>').join('')
    +'</tbody></table></div>';
}
function analysisTab(sm){
  const all=S.reportSeries();
  return '<div class="rep-cmp-wrap">'+compareStrip(sm)+'</div>'
    +'<div class="grid-12" style="gap:14px;margin-top:14px">'
      +'<div class="c7">'+UI.card({title:'Month by month',sub:'Every return on file, newest first · change against the month before',icon:'calendar-days',
        body:monthTable(),foot:'<span>Positivity is of the qualitative tests in that month</span><span class="mono">'+all.length+' months</span>'})+'</div>'
      +'<div class="c5">'+UI.card({title:'Year by year',sub:'Tests carried out, rolled up as the district reads them',icon:'layers',
        body:yearTable(),foot:'<span>Average a month is the fair comparison between a full year and a part year</span>'
          +'<span class="mono">'+all.length+' months</span>'})+'</div>'
      +'<div class="c7">'+trendCard(sm)+'</div>'
      +'<div class="c5">'+moversCard(sm)+'</div>'
    +'</div>'
    +'<div class="rep-loadbar">'
      +'<div><div class="rep-loadbar-t">'+(all.length>1?'Add more months to the history':'The history starts with the months behind this one')+'</div>'
      +'<div class="xs faint">The district\u2019s workbook has a sheet for every month. Load it whole and every comparison above fills in — month over month, year over year, and each examination\u2019s trend.</div></div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary sm" data-load-wb>'+UI.ic('folder-open',14)+'Load the workbook</button>'
      +'<button class="btn sm" data-import>'+UI.ic('clipboard-list',14)+'Paste one sheet</button></div>'
    +'</div>'
    +mapCard(sm.key)
    +'<div class="grid-12" style="gap:14px;margin-top:14px">'
      +'<div class="c12">'+UI.card({title:'Where the work sat, month by month',sub:'Tests by section of the return',icon:'chart-line',
        body:'<div id="repSecTrend"></div>',foot:'<span>Each line is one section of the form</span><span class="mono">'+S.REPORT_SECTIONS.filter(x=>all.some(m=>m.sections[x.key]>0)).length+' sections used</span>'})+'</div>'
    +'</div>'
    +'<div class="rep-analysis-head"><h2>This month, in full</h2><span class="xs faint">The same rankings, for the month chosen above.</span></div>'
    +analysis(sm);
}
function drawHistoryCharts(root,sm){
  drawCharts(root,sm);
  const all=S.reportSeries();
  /* the chosen examination through every month on file */
  const el=root.querySelector('#repTestTrend');
  if(el){
    const series=trendId?S.reportTestSeries(trendId):[];
    if(series.length<2){
      const one=series[0];
      el.innerHTML='<div class="rep-trend-single"><div class="rep-trend-v">'+U.fmtNum(one?one.total:0)+'</div>'
        +'<div class="xs faint">'+U.esc(one?one.label:'')+' · the trend needs a second month</div></div>';
    } else {
      C.line(el,{id:'repTestTrend',height:230,padLeft:56,series:[{name:'Tests',color:'var(--gold)',values:series.map(x=>x.total)}],
        labels:series.map(x=>x.label)});
    }
  }
  const sel=root.querySelector('#repTrendSel');
  if(sel) sel.onchange=()=>{ trendId=sel.value; renderInner(root); };
  /* every section, month by month */
  const st=root.querySelector('#repSecTrend');
  if(st&&all.length>=2){
    const keys=S.REPORT_SECTIONS.map(x=>x.key).filter(k=>all.some(m=>m.sections[k]>0));
    const tones=['var(--gold)','var(--teal-400)','var(--rose-400)','#7595C8','#3FA57E','#D9A13B','#8C93A3','#A3212E','#6B3C7A'];
    C.line(st,{id:'repSecTrend',height:280,padLeft:60,
      series:keys.map((k,i)=>({name:S.REPORT_SECTIONS.find(x=>x.key===k).title,color:tones[i%tones.length],
        values:all.map(m=>m.sections[k])})),
      labels:all.map(m=>m.label)});
  } else if(st){
    st.innerHTML='<div class="rep-cmp-none">One month on file — the section lines appear once a second month is loaded.</div>';
  }
}

/* ——— Rows the form could not place ————————————————————————
   Every sheet has a few rows written in words the form does not use. They carry
   figures, so they are kept and listed here rather than dropped: the reader picks the
   line each one belongs to, once, and that wording is remembered for every month after. */
function mapCard(key){
  const rows=S.reportUnmatched(key);
  if(!rows.length) return '';
  return '<div class="rep-map">'
    +'<div class="rep-map-ic">'+UI.ic('circle-help',16)+'</div>'
    +'<div class="rep-map-body"><div class="rep-map-t">'+rows.length+' row'+(rows.length===1?'':'s')+' on the '+monthLabel(key)+' sheet carried figures but matched no line of the form</div>'
    +'<div class="xs faint" style="margin-top:2px">'
      +rows.slice(0,4).map(r=>U.esc(r.label)+' <span class="mono">'+r.nums.join('·')+'</span>').join(' &nbsp;·&nbsp; ')
      +(rows.length>4?' …':'')+'</div>'
    +'<div class="xs faint" style="margin-top:4px">They are not lost and they are not guessed into a line. Place them and they count from now on.</div></div>'
    +'<button class="btn sm" data-map-rows="'+U.esc(key)+'">'+UI.ic('check',13)+'Place them</button>'
  +'</div>';
}
function mapModal(key){
  if(!canEdit()) return UI.toast('Sign in to change a month',{type:'warn'});
  const rows=S.reportUnmatched(key);
  if(!rows.length) return;
  const lines=S.reportLines().filter(l=>l.mode!=='band');
  const options='<option value="">— leave it out —</option>'
    +S.REPORT_SECTIONS.map(sec=>{
      const inSec=lines.filter(l=>l.section===sec.key&&!l.breakdown);
      if(!inSec.length) return '';
      return '<optgroup label="'+U.esc(sec.no+'. '+sec.title)+'">'
        +inSec.map(l=>'<option value="'+U.esc(l.id)+'">'+U.esc((l.no?l.no+' ':'')+l.label)+'</option>').join('')
      +'</optgroup>';
    }).join('');
  UI.modal({title:'Place '+rows.length+' row'+(rows.length===1?'':'s')+' of the '+monthLabel(key)+' sheet',
    sub:'The wording on the sheet, the figures it carried, and the line of the form it belongs to. Chosen once, remembered for every month after.',
    width:'min(720px,100%)',
    body:'<div class="rep-map-list">'+rows.map((r,i)=>
        '<div class="rep-map-row"><div class="rep-map-lbl"><b>'+U.esc(r.label)+'</b><span class="mono xs faint">'+r.nums.join(' · ')+'</span></div>'
        +'<select class="select" data-place="'+i+'">'+options+'</select></div>').join('')+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',14)+'Place the rows</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const places=[];
        el.querySelectorAll('[data-place]').forEach(sel=>{
          if(!sel.value) return;
          const r=rows[+sel.dataset.place];
          places.push({label:r.label,lineId:sel.value,nums:r.nums});
        });
        if(!places.length) return UI.toast('Choose a line for at least one row',{type:'warn'});
        S.reportPlaceRows(key,places);
        close(); UI.toast(places.length+' row'+(places.length===1?'':'s')+' placed — and remembered',{type:'ok'});
        renderInner(rootEl);
      };
    }});
}

/* ——— Loading past months ————————————————————————————————
   The district's workbook holds a sheet per month. Two ways in, both kept because
   one is quicker and the other always works: the .xlsx itself (read on the device,
   every sheet at once) or a sheet pasted from Excel. Whatever comes in is matched to
   the form line by line, and a row that matches nothing is reported rather than
   guessed at — nothing is invented to fill a month. */
const MONTH_ABBR={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,
  aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};
/* A sheet is named the way the district names it — “Oct 26”, “September 2024”,
   “Sep-25”, “2024-10”. The month it stands for is read off that name; when the name
   says nothing, no month is assumed and the reader is asked. */
function monthFromName(name){
  const raw=String(name||'').trim();
  const iso=/^(\d{4})[-_ ](\d{1,2})$/.exec(raw);
  if(iso){ const m=+iso[2]; if(m>=1&&m<=12) return iso[1]+'-'+String(m).padStart(2,'0'); }
  const t=raw.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const words=t.split(' ');
  let mon=0, yr=0;
  words.forEach(w=>{
    if(MONTH_ABBR[w]) mon=MONTH_ABBR[w];
    else if(/^(19|20)\d{2}$/.test(w)) yr=+w;
    else if(/^\d{2}$/.test(w)&&!yr&&!mon) { /* “Oct 26” — the year needs the month beside it */ }
  });
  if(!mon) return '';
  const two=words.find(w=>/^\d{2}$/.test(w)&&+w<=99&&+w>12);
  if(!yr && two!=null) yr=2000+ +two;
  if(!yr) return '';
  return yr+'-'+String(mon).padStart(2,'0');
}
/* The sheet states its own month — “6. Month | October”, “5. Year | 2026/2027” — which
   is more reliable than the tab’s name and is used when the name says nothing. */
function monthFromRows(rows){
  let mon='', fy='';
  (rows||[]).slice(0,40).forEach(row=>{
    (row||[]).forEach((cell,c)=>{
      const k=normLabel(cell);
      if(!k) return;
      for(let j=c+1;j<Math.min(c+4,row.length);j++){
        const v=String(row[j]==null?'':row[j]).trim();
        if(!v) continue;
        if(k.indexOf('month')>=0&&/^[a-z]+$/i.test(v)&&MONTH_ABBR[v.toLowerCase()]) mon=MONTH_ABBR[v.toLowerCase()];
        if(k.indexOf('year')>=0&&/^(19|20)\d{2}/.test(v)) fy=v;
        break;
      }
    });
  });
  if(!mon||!fy) return '';
  const y0=+String(fy).slice(0,4);
  const y=(fy.indexOf('/')>0)?(mon>=7?y0:y0+1):y0;
  return y+'-'+String(mon).padStart(2,'0');
}
const normLabel=x=>String(x==null?'':x).toLowerCase().replace(/[^a-z0-9]+/g,'');
/* The district prints its sheet with the form's numbering inside the label —
   “6.4 Full Blood Count”, “5.1.a Fresh”, “1. Blood Smears Plasmodium”. The number is
   the most reliable thing on the row, so it is tried first, then the wording with the
   number taken off, then the wording as written. */
const numberingOf=x=>{
  const m=/^\s*(\d+(?:\.\d+)*\.?[a-z]?\.?)\s*/i.exec(String(x==null?'':x));
  return m?{num:m[1].replace(/\.$/,'').toLowerCase(), rest:String(x).slice(m[0].length)}:null;
};
function lineIndex(){
  const byLabel={}, byNo={}, list=S.reportLines();
  list.forEach(l=>{
    const k=normLabel(l.label);
    if(k&&!byLabel[k]) byLabel[k]=l;
    if(l.no) byNo[normLabel(l.no)]=l;
    (l.alias||[]).forEach(a=>{ const ka=normLabel(a); if(ka&&!byLabel[ka]) byLabel[ka]=l; });
  });
  /* every known wording, longest first, so a label that carries extra words still
     finds the line it means */
  const keys=Object.keys(byLabel).sort((a,b)=>b.length-a.length);
  /* aliases the reader has already confirmed by hand, on any month */
  const saved=S.reportAliases?S.reportAliases():{};
  Object.keys(saved).forEach(k=>{ const l=list.find(x=>x.id===saved[k]); if(l&&!byLabel[k]) byLabel[k]=l; });
  return {byLabel,byNo,keys,list};
}
/* The number on the row wins only when the wording beside it agrees — “2. Catchment
   Area Population” must never become line 2, the malaria rapid test. */
function agrees(a,b){
  const x=normLabel(a), y=normLabel(b);
  if(!x||!y) return true;
  if(x===y||x.indexOf(y)>=0||y.indexOf(x)>=0) return true;
  const tw=a=>String(a||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ');
  const A=tw(a).filter(w=>w.length>2), B=tw(b).filter(w=>w.length>2);
  if(!A.length||!B.length) return false;
  return A.filter(w=>B.indexOf(w)>=0).length/Math.min(A.length,B.length)>=0.5;
}
function resolveLabel(cell,idx){
  const raw=String(cell==null?'':cell);
  if(!/[a-z]/i.test(raw)) return null;            /* a bare figure is not a label */
  const key=normLabel(raw);
  if(!key) return null;
  const n=numberingOf(raw);
  const rest=n?n.rest:'';
  /* 1 · the wording as written */
  if(idx.byLabel[key]) return idx.byLabel[key];
  /* 2 · the number, when it is specific (6.4, 5.3.a) and the wording agrees with the
         line it points at — “Urine” is both 4. and 5.3, so the number decides */
  if(n&&/\./.test(n.num)&&idx.byNo[normLabel(n.num)]){
    const hit=idx.byNo[normLabel(n.num)];
    if(!normLabel(rest)||agrees(rest,hit.label)) return hit;
  }
  /* 3 · the wording with the numbering taken off */
  const bare=normLabel(rest);
  if(bare&&idx.byLabel[bare]) return idx.byLabel[bare];
  /* 4 · the number, when the wording agrees with the line it points at */
  if(n&&idx.byNo[normLabel(n.num)]){
    const hit=idx.byNo[normLabel(n.num)];
    if(!bare||agrees(rest,hit.label)) return hit;
  }
  /* 4 · a label that carries extra words — “Stool Samples Total”, “of which Gram - Diplo” */
  if(bare){
    const hit=idx.keys.find(k=>k.length>=5&&(bare.indexOf(k)>=0||k.indexOf(bare)>=0));
    if(hit) return idx.byLabel[hit];
  }
  /* 5 · the number on its own, when the number is specific (6.4, 5.1.a) */
  if(n&&/\./.test(n.num)&&idx.byNo[normLabel(n.num)]) return idx.byNo[normLabel(n.num)];
  return null;
}
const num=x=>{
  if(typeof x==='number') return isFinite(x)?Math.round(x):null;
  const v=String(x==null?'':x).replace(/[ ,]/g,'').trim();
  if(v===''||v==='-'||v==='—'||/^n\/?a$/i.test(v)) return null;
  return isNaN(+v)?null:Math.round(+v);
};
/* The figures for a row are the run of numbers that follows its label. The sheet is
   laid out in blocks side by side, so the numbers for the next block sit further along
   the same row — the run stops at the first real gap, which is what keeps the blood
   bank's column from being read as the full blood count's total. */
function runAfter(row,from){
  const out=[]; let started=false, gap=0;
  for(let k=from+1;k<row.length;k++){
    const n=num(row[k]);
    if(n!=null){ started=true; gap=0; out.push(n); }
    else if(started){ gap++; if(gap>=2) break; }
  }
  return out;
}
function figuresFor(mode,nums){
  if(!nums.length) return null;
  if(mode==='quant') return {total:nums[nums.length-1]};
  if(mode==='posage3') return {pos:nums[0]||0,a0:nums[1]||0,a1:nums[2]||0,a2:nums[3]||0};
  if(mode==='pn2') return {pos:nums[0]||0,neg:nums[1]||0,a0:nums[2]||0,a1:nums[3]||0};
  if(mode==='pn') return {pos:nums[0]||0,neg:nums[1]||0};
  return null;
}
/* Rows in, figures out, and a list of what could not be placed — which is the honest
   half: a row the reader does not recognise is handed back to be mapped by hand, never
   quietly dropped and never guessed into a line. */
function matchSheet(rows){
  const idx=lineIndex();
  const values={}, detail={}, seen={}, unmatched=[];
  let rowsWithFigures=0, unclear=0;
  /* The sheet is built in blocks side by side — 5.1 Vaginal swab, 5.2 Urethral,
     5.3 Urine — and the sub-rows of the later blocks are often still numbered 5.1.a
     by the person filling it in. The block heading last seen is therefore the truest
     thing on the row: 5.1.a inside the 5.3 block is 5.3.a. */
  let block=null;
  const renumber=(cell,hit)=>{
    const n=numberingOf(cell);
    if(!block||!n||!hit||!hit.no) return hit;
    const parts=h=>String(h).split('.').filter(x=>x!=='');
    const bp=parts(block.no), np=parts(n.num), hp=parts(hit.no);
    if(bp.length!==2||hp.length<3||np.length<3) return hit;
    if(bp[0]!==np[0]||bp[1]===np[1]) return hit;
    const want=bp.join('.')+'.'+np.slice(2).join('.');
    const alt=idx.byNo[normLabel(want)];
    if(!alt) return hit;
    const rest=numberingOf(cell).rest;
    if(alt.id===hit.id||!agrees(rest,alt.label)) return hit;
    return alt;
  };
  (rows||[]).forEach(row=>{
    if(!row||!row.length) return;
    for(let c=0;c<row.length;c++){
      const cell=row[c];
      if(cell==null||cell==='') continue;
      if(typeof cell==='number'&&String(cell).indexOf('.')<0) continue;
      let hit=resolveLabel(cell,idx);
      if(hit) hit=renumber(cell,hit);
      if(hit&&hit.mode==='band') block={no:hit.no,col:c,label:hit.label};
      const nums=hit?runAfter(row,c):[];
      if(!hit||!nums.length) continue;
      const v=figuresFor(hit.mode,nums);
      if(!v) continue;
      if(seen[hit.id]){ c=Math.max(c,0); continue; }
      const want=hit.mode==='quant'?1:(hit.mode==='pn'?2:4);
      if(hit.mode!=='quant'&&nums.length<want) unclear++;
      seen[hit.id]=1; values[hit.id]=v;
      detail[hit.id]={id:hit.id,label:hit.label,mode:hit.mode,v,nums};
      /* the sheet lays several blocks across one row, so the rest of the row is read
         too — the urine block sits beside the malaria block on the very same line */
    }
    /* a row with figures that found no line is kept for the mapping screen */
    const nums=runAfter(row,-1);
    if(nums.length>=2){
      const placed=(function(){
        for(let c=0;c<row.length;c++){
          const cell=row[c];
          if(cell==null||cell===''||typeof cell==='number') continue;
          if(resolveLabel(cell,idx)) return true;
        }
        return false;
      })();
      if(placed) rowsWithFigures++;
      else {
        const label=(function(){
          for(let c=0;c<row.length;c++){
            const cell=row[c];
            if(typeof cell==='string'&&cell.trim().length>=3&&!num(cell)) return cell.trim();
          }
          return '';
        })();
        if(label) unmatched.push({label,nums:nums.slice(0,6)});
      }
    }
  });
  const matched=Object.keys(values).length;
  return {values,detail:Object.keys(detail).map(k=>detail[k]),matched,unmatched,unclear,
    skipped:Math.max(0,(rows||[]).length-rowsWithFigures-unmatched.length)};
}
function textToRows(text){
  return String(text||'').replace(/\r/g,'').split('\n').map(l=>l.split('\t'));
}
function parsePasted(text){ return matchSheet(textToRows(text)); }
const FIG=id=>{
  const line=S.reportLines().find(l=>l.id===id)||{label:id,mode:'pn'};
  return line;
};
function figureText(v,mode){
  if(mode==='quant') return 'total '+U.fmtNum(v.total||0);
  if(mode==='posage3') return 'pos '+U.fmtNum(v.pos||0)+(v.a0||v.a1||v.a2?' · ages '+[v.a0,v.a1,v.a2].map(n=>U.fmtNum(n||0)).join('/'):'');
  if(mode==='pn2') return 'pos '+U.fmtNum(v.pos||0)+' · neg '+U.fmtNum(v.neg||0)+' · ages '+[v.a0,v.a1].map(n=>U.fmtNum(n||0)).join('/');
  return 'pos '+U.fmtNum(v.pos||0)+' · neg '+U.fmtNum(v.neg||0);
}
function previewHTML(r){
  const rows=r.detail.map(d=>{
    const line=FIG(d.id);
    return '<div class="rep-imp-row"><span>'+U.esc((line.no?line.no+' ':'')+(line.label||d.id))+'</span><span class="mono">'+figureText(d.v,d.mode)+'</span></div>';
  }).join('');
  const left=(r.unmatched||[]).map(x=>'<div class="rep-imp-row"><span class="rep-miss">'+U.esc(x.label)+'</span><span class="mono">'+x.nums.join(' · ')+'</span></div>').join('');
  return '<div class="small" style="margin-top:10px"><b>'+r.matched+'</b> examination'+(r.matched===1?'':'s')+' placed'
    +(r.unclear?' · <b>'+r.unclear+'</b> with fewer figures than the form expects — worth checking':'')
    +((r.unmatched||[]).length?' · <b>'+(r.unmatched||[]).length+'</b> row'+(r.unmatched.length===1?'':'s')+' with figures that found no line (kept, and listed for mapping)':'')+'</div>'
    +'<div class="rep-imp-list">'+(rows||'<p class="xs faint">Nothing matched yet — check that the sheet has its examination names in a column of their own.</p>')
      +(left?'<div class="rep-imp-sep">Not placed — the wording does not match the form</div>'+left:'')+'</div>';
}
/* the whole workbook, every sheet at once */
function workbookModal(){
  if(!canEdit()) return UI.toast('Sign in to load history',{type:'warn'});
  const canRaw=typeof DecompressionStream==='function'&&typeof DOMParser==='function';
  let found=[];
  UI.modal({title:'Load the workbook',sub:'Every month in the district\\u2019s spreadsheet, read on this device. Nothing is uploaded; nothing is altered.',width:'min(760px,100%)',
    body:'<div class="rep-drop" id="wbDrop">'
        +'<div class="rep-drop-ic">'+UI.ic('upload',20)+'</div>'
        +'<div><b>Choose the workbook</b> — the .xlsx the district sends, with a sheet for each month.</div>'
        +'<div class="xs faint" style="margin-top:3px">A sheet is a month when its name says so: “Oct 26”, “September 2024”, “Sep-25”. Every sheet found is listed below and you choose what each one becomes.</div>'
        +'<input type="file" id="wbFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none">'
        +'<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
          +'<button class="btn primary sm" data-pick>'+UI.ic('folder-open',14)+'Choose a file</button>'
          +'<span class="xs faint">'+(canRaw?'or':'— and')+' paste a single sheet below'+(canRaw?'':' (this browser cannot open .xlsx directly)'+'"')+'</span></div>'
        +'</div>'
        +'<div id="wbList" style="margin-top:12px"></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn" data-paste>'+UI.ic('clipboard-list',14)+'Paste one sheet</button><button class="btn primary" data-save disabled>'+UI.ic('check',14)+'Load the months</button>',
    onMount:(el,close)=>{
      const listEl=el.querySelector('#wbList'), saveEl=el.querySelector('[data-save]');
      const fileEl=el.querySelector('#wbFile');
      el.querySelector('[data-pick]').onclick=()=>fileEl.click();
      el.querySelector('[data-paste]').onclick=()=>{ close(); importModal(); };
      const draw=()=>{
        if(!found.length){ listEl.innerHTML=''; saveEl.disabled=true; return; }
        listEl.innerHTML='<div class="dt-scroll"><table class="dt rep-hist" style="min-width:520px"><thead><tr><th>Sheet</th><th>Month it becomes</th><th>Matched</th><th>Ignored</th></tr></thead><tbody>'
          +found.map((f,i)=>'<tr><td class="rep-m">'+U.esc(f.name)+'</td>'
            +'<td><input class="input mono" type="month" data-wbmonth="'+i+'" value="'+U.esc(f.guess||'')+'" style="padding:3px 6px;font-size:11px"></td>'
            +'<td class="num mono">'+f.match.matched+'</td>'
            +'<td class="num mono">'+(f.match.skipped||0)+'</td></tr>').join('')
          +'</tbody></table></div>'
          +'<div class="xs faint" style="margin-top:6px">A month already on file is added to, not replaced — the figures in the workbook win for the examinations it names.</div>';
        listEl.querySelectorAll('[data-wbmonth]').forEach(inp=>{
          inp.onchange=()=>{ found[+inp.dataset.wbmonth].key=inp.value; refresh(); };
        });
        refresh();
      };
      const refresh=()=>{
        const ready=found.filter(f=>f.key&&f.match.matched>0);
        saveEl.disabled=!ready.length;
        saveEl.textContent='';
        saveEl.appendChild(document.createTextNode(' '));
        saveEl.innerHTML=UI.ic('check',14)+' Load '+ready.length+' month'+(ready.length===1?'':'s');
      };
      fileEl.onchange=async ()=>{
        const f=fileEl.files&&fileEl.files[0];
        if(!f) return;
        listEl.innerHTML='<p class="xs faint">Reading '+U.esc(f.name)+' …</p>';
        try{
          const sheets=await LSXLSX.readWorkbook(f);
          found=sheets.map(s=>{
            const byName=monthFromName(s.name), bySheet=monthFromRows(s.rows);
            const guess=byName||bySheet;
            return {name:s.name,guess,key:guess,said:byName?'name':'sheet',match:matchSheet(s.rows)};
          });
          draw();
          const blank=found.filter(f=>!f.guess).length;
          if(blank) UI.toast(blank+' sheet'+(blank===1?' has':'s have')+' no month in the name — set '+(blank===1?'it':'them')+' above',{type:'warn'});
        }catch(err){
          listEl.innerHTML='<div class="rep-cmp-none">'+U.esc(err&&err.message==='NOSTREAM'
            ?'This browser cannot unpack an .xlsx. Use “Paste one sheet” below — copy the sheet out of Excel and paste it.'
            :(err&&err.message)||'The workbook could not be read.')+'</div>';
        }
      };
      saveEl.onclick=()=>{
        const ready=found.filter(f=>f.key&&f.match.matched>0);
        if(!ready.length) return;
        let loaded=0, ex=0;
        let left=0;
        ready.slice().sort((a,b)=>a.key<b.key?-1:1).forEach(f=>{
          if(S.reportImportMonth(f.key,f.match.values,{meta:{source:'District workbook · sheet “'+f.name+'”',monthName:monthLabel(f.key).split(' ')[0]}})) { loaded++; ex+=f.match.matched; }
          S.reportStashUnmatched(f.key,f.match.unmatched||[]);
          left+=(f.match.unmatched||[]).length;
        });
        const last=ready[ready.length-1].key;
        monthKey=last; close();
        UI.toast(loaded+' month'+(loaded===1?'':'s')+' loaded · '+ex+' examinations'
          +(left?' · '+left+' rows still to place':''),{type:left?'warn':'ok'});
        tab='analysis'; renderInner(rootEl);
      };
    }});
}
function importModal(){
  if(!canEdit()) return UI.toast('Sign in to load a month',{type:'warn'});
  const next=(function(){ const a=S.reportMonths().slice().sort(); if(!a.length) return U.todayISO().slice(0,7);
    const d=U.parseISO(a[0]+'-01'); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();
  UI.modal({title:'Load a past month',sub:'From the spreadsheet: choose the month, then paste the sheet — the labels and the figures, exactly as they sit in Excel.',width:'min(680px,100%)',
    body:'<div class="form-grid"><div class="field"><label>Month</label><input class="input mono" type="month" id="impKey" value="'+next+'"></div>'
      +'<div class="field"><label>Source</label><input class="input" id="impSrc" placeholder="October 2024 HMIS sheet"></div></div>'
      +'<div class="field" style="margin-top:10px"><label>Paste the sheet</label>'
      +'<textarea class="textarea mono" id="impText" rows="8" placeholder="1.	Blood Smears Plasmodium	2	86	51	37&#10;6.4	Full Blood Count				1364&#10;Urea		929&#10;…"></textarea>'
      +'<div class="xs faint" style="margin-top:4px">Copy the whole block from Excel — the first column is the examination, the figures follow. Labels and numbers are matched to the form; a row that matches nothing is reported, not guessed at.</div></div>'
      +'<div id="impPreview" class="rep-imp-preview"></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn" data-preview>Check what matched</button><button class="btn primary" data-save>'+UI.ic('check',14)+'Load the month</button>',
    onMount:(el,close)=>{
      const run=()=>parsePasted(el.querySelector('#impText').value);
      el.querySelector('[data-preview]').onclick=()=>{
        el.querySelector('#impPreview').innerHTML=previewHTML(run());
      };
      el.querySelector('[data-save]').onclick=()=>{
        const key=el.querySelector('#impKey').value;
        if(!key) return UI.toast('Choose the month',{type:'warn'});
        const r=run();
        if(!r.matched) return UI.toast('Nothing matched — paste the sheet again',{type:'warn'});
        const src=(el.querySelector('#impSrc').value||'').trim();
        S.reportImportMonth(key,r.values,{meta:{source:src||('Loaded from the district workbook'),monthName:monthLabel(key).split(' ')[0],year:U.fyLabel?U.fyLabel():''}});
        monthKey=key; close(); UI.toast(r.matched+' examinations loaded into '+monthLabel(key),{type:'ok'}); renderInner(rootEl);
      };
    }});
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
/* Test seams — the reader and the matcher are the one place a workbook can be
   misread, so they are reachable from the harness without going through the DOM. */
M.__read={monthFromName,monthFromRows,matchSheet,parsePasted,figureText};
})();
