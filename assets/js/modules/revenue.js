/* ============================================================================
   MODULE · TRAINING REVENUE — expenses, reimbursements, balance
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.revenue=M;
let rootEl=null;
const EXPENSE_CATS=['Transport','Per-diem','Materials','Meal','Housing','Communication','Equipment','Other'];
const catLabel=e=>{ const c=e&&(e.cat||'Other'); return e&&e.custom?'Other — '+c:c; };
const sumExp=t=>U.sum(t.expenses||[],e=>e.amount||0);
const sumReimb=t=>U.sum(t.reimbursements||[],r=>r.amount||0);
function catOptions(cur){
  const list=EXPENSE_CATS.slice();
  if(cur && list.indexOf(cur)<0) list.push(cur);
  return list.map(c=>'<option value="'+U.esc(c)+'"'+(c===cur?' selected':'')+'>'+U.esc(c)+'</option>').join('');
}
/* ——— The roster behind the ledger ————————————————————————————
   A session logged here is a session in the training registry: same title, same dates,
   same organizer, same people. The ledger used to be typed independently, which is how
   a revenue row and its training drifted apart. The registry is now the place a session
   is chosen from, and `linkedTraining` is what joins them. */
function rosterRows(){
  const used={};
  (S.db().trainingExpenses||[]).forEach(t=>{ if(t.linkedTraining) used[t.linkedTraining]=t.id; });
  return (S.db().trainings||[]).slice()
    .sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')))
    .map(t=>({t,usedBy:used[t.id]||null}));
}
function rosterOption(tr,cur){
  const date=tr.start?U.fmtDateShort(tr.start):'';
  return '<option value="'+U.esc(tr.id)+'"'+(tr.id===cur?' selected':'')+'>'
    +U.esc(tr.title)+(date?' · '+U.esc(date):'')+(tr.organizer?' · '+U.esc(tr.organizer):'')+'</option>';
}
/* The choice offered wherever a session is picked: the ones still without a revenue line
   first — they are what this page is for — then the ones already carrying one, named so
   that a second session is never logged on top of the first by accident. */
function rosterOptions(cur,ownRow){
  const rows=rosterRows();
  const free=rows.filter(r=>!r.usedBy||r.usedBy===ownRow);
  const taken=rows.filter(r=>r.usedBy&&r.usedBy!==ownRow);
  let out='<option value="">— choose a training from the roster —</option>';
  if(free.length) out+='<optgroup label="Not yet on the ledger">'+free.map(r=>rosterOption(r.t,cur)).join('')+'</optgroup>';
  if(taken.length) out+='<optgroup label="Already carrying a revenue line">'+taken.map(r=>rosterOption(r.t,cur)).join('')+'</optgroup>';
  out+='<optgroup label="Not in the roster"><option value="__new"'+(cur==='__new'?' selected':'')+'>Type a new session instead…</option></optgroup>';
  return out;
}
function data(){
  const list=S.db().trainingExpenses||[];
  const exp=U.sum(list,sumExp), reimb=U.sum(list,sumReimb);
  return {list,exp,reimb,balance:reimb-exp,pending:U.sum(list.filter(t=>sumReimb(t)<sumExp(t)),t=>sumExp(t)-sumReimb(t))};
}
/* Every figure on this page is read back off the recorded ledger rows — the
   monthly series feeds the KPI sparks, the deltas and the cash-flow chart. */
function monthly(){
  const d=data();
  const g=U.groupBy(d.list,t=>String(t.start||'').slice(0,7));
  return Object.keys(g).sort().map(k=>({key:k,exp:U.sum(g[k],sumExp),reimb:U.sum(g[k],sumReimb),
    net:U.sum(g[k],sumReimb)-U.sum(g[k],sumExp)}));
}
function mov(series){
  if(series.length<2) return null;
  const last=series[series.length-1], prev=series[series.length-2];
  if(!prev) return last?100:0;
  return Math.round((last-prev)/Math.abs(prev)*100);
}
/* How much of the roster is accounted for — by the link each ledger row carries, not by
   counting rows. Two sessions of one training, or one session and a typed row, no longer
   make the registry look settled when it is not. */
/* ——— What a session costs, on average ————————————————————————————
   Every figure here is divided by the sessions actually on the ledger, so it moves the
   day a record is added and never invents a base. The trend compares the three latest
   sessions with everything before them: the recent habit, against the record. */
function averages(){
  const d=data();
  const list=d.list.slice().sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
  const n=list.length;
  const statOf=arr=>({n:arr.length,exp:U.sum(arr,sumExp),reimb:U.sum(arr,sumReimb)});
  const per=(x,k)=>x.n?Math.round(x[k]/x.n):0;
  const last=statOf(list.slice(0,3)), before=statOf(list.slice(3));
  const pct=(a,b)=>b?Math.round((a-b)/Math.abs(b)*1000)/10:null;
  return {n,
    avg:{exp:n?Math.round(d.exp/n):0,reimb:n?Math.round(d.reimb/n):0,net:n?Math.round(d.balance/n):0},
    recovery:d.exp?Math.round(d.reimb/d.exp*100):null,
    last:{n:last.n,exp:per(last,'exp'),reimb:per(last,'reimb')},
    before:{n:before.n,exp:per(before,'exp'),reimb:per(before,'reimb')},
    change:{exp:pct(per(last,'exp'),per(before,'exp')),reimb:pct(per(last,'reimb'),per(before,'reimb'))}};
}
function deltaChip(v){
  if(v==null) return '<span class="delta flat">—</span>';
  const cls=v>0?'':v<0?' down':' flat';
  return '<span class="delta'+cls+'">'+U.ic(v>0?'arrow-up':v<0?'arrow-down':'arrow-right',10)+(v>0?'+':'')+v+'%</span>';
}
function averagesCard(){
  const a=averages();
  if(!a.n) return UI.card({title:'Averages',sub:'From the record',icon:'chart-line',
    body:'<p class="xs faint">No sessions on the ledger yet — the first one sets the average.</p>'});
  const row=(label,value,sub)=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(label)+'</div>'
    +'<div class="lr-sub">'+U.esc(sub)+'</div></div><div class="lr-val mono">'+U.fmtRWF(value)+'</div></div>';
  return UI.card({title:'Average per session',sub:'Worked out from the '+a.n+' session'+(a.n===1?'':'s')+' on the ledger',icon:'chart-line',cls:'rev-avg',
    body:row('Reimbursed',a.avg.reimb,'reimbursed ÷ '+a.n+' session'+(a.n===1?'':'s'))
      +row('Expenses',a.avg.exp,'spent ÷ '+a.n+' session'+(a.n===1?'':'s'))
      +row('Net',a.avg.net,'reimbursed less expenses, per session')
      +'<div class="rev-avg-trend">'
        +'<div class="row between"><span class="xs faint">Last '+a.last.n+' session'+(a.last.n===1?'':'s')+' against the '+a.before.n+' before</span>'
          +'<span class="xs faint mono">'+(a.recovery!=null?a.recovery+'% recovered':'—')+'</span></div>'
        +'<div class="rev-avg-cols">'
          +'<div><span class="eyebrow">Reimbursed</span><b class="mono">'+U.fmtNum(a.last.reimb)+'</b>'+deltaChip(a.change.reimb)
            +'<span class="xs faint">was '+U.fmtNum(a.before.reimb)+'</span></div>'
          +'<div><span class="eyebrow">Expenses</span><b class="mono">'+U.fmtNum(a.last.exp)+'</b>'+deltaChip(a.change.exp)
            +'<span class="xs faint">was '+U.fmtNum(a.before.exp)+'</span></div>'
        +'</div>'
        +'<div class="hint" style="margin-top:8px">'+(a.before.n?'The chip is the change in the average per session, not the change in the total — one large session does not flatter the trend.':'Only '+a.last.n+' session'+(a.last.n===1?'':'s')+' on file — the trend fills in as more are logged.')+'</div>'
      +'</div>',
    foot:'<span>All amounts in RWF</span><span class="mono">'+a.n+' sessions</span>'});
}
function reconciliation(){
  const d=data();
  const trainings=S.db().trainings||[];
  const linked={};
  d.list.forEach(t=>{ if(t.linkedTraining) linked[t.linkedTraining]=1; });
  const covered=trainings.filter(t=>linked[t.id]).length;
  return {registry:trainings.length,covered,missing:Math.max(0,trainings.length-covered),
    unlinked:d.list.filter(t=>!t.linkedTraining).length,exp:d.exp,reimb:d.reimb,net:d.balance};
}
function kpis(){
  const d=data(), m=monthly(), reconciled=reconciliation(), avg=averages().avg;
  const spark=(vals,color)=>C.spark(vals.length?vals:[0],{color});
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Reimbursed',value:d.reimb,unit:'RWF',icon:'banknote',formatted:U.fmtNum(d.reimb),delta:mov(m.map(x=>x.reimb)),note:d.list.length+' sessions · avg '+U.fmtNum(avg.reimb)+' each',spark:spark(m.map(x=>x.reimb),'var(--pos)')})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Expenses',value:d.exp,unit:'RWF',icon:'receipt',formatted:U.fmtNum(d.exp),delta:mov(m.map(x=>x.exp)),note:'avg '+U.fmtNum(avg.exp)+' a session',spark:spark(m.map(x=>x.exp),'var(--amber)')})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Net balance',value:d.balance,unit:'RWF',icon:'wallet',formatted:U.fmtNum(d.balance),delta:mov(m.map(x=>x.net)),note:d.balance>=0?'Reimbursed less expenses':'Expenses exceed reimbursements',spark:spark(m.map(x=>x.net),'var(--gold)')})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Pending claims',value:d.pending,unit:'RWF',icon:'clock',formatted:U.fmtNum(d.pending),note:d.list.filter(t=>sumReimb(t)<sumExp(t)).length+' sessions open',spark:spark(m.map(x=>Math.max(0,x.exp-x.reimb)),'var(--crit)')})+'</div></div>'
   +'<div class="card pad" style="margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">'
     +'<span class="pill teal">'+UI.ic('check-check',12)+'Reconciled</span>'
     +'<span class="small grow">'+U.fmtNum(reconciled.exp)+' RWF recorded expenses · '+U.fmtNum(reconciled.reimb)+' RWF reimbursed · <b class="mono">net '+U.fmtNum(reconciled.net)+' RWF</b> across '+reconciled.covered+' ledger sessions.</span>'
     +'<span class="xs faint">'+reconciled.covered+' of '+reconciled.registry+' trainings in the roster carry a revenue line'
       +(reconciled.missing?', '+reconciled.missing+' still to log — <a href="#/training">open the roster</a>':' — every one of them logged')
       +(reconciled.unlinked?' · '+reconciled.unlinked+' ledger row'+(reconciled.unlinked===1?'':'s')+' not linked to the roster':'')+'</span></div>';
}
function table(){
  const d=data();
  return '<div class="grid-12"><div class="c8"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="revSearch" placeholder="Search session, organizer…"></div><span class="grow"></span><button class="btn sm" data-add>'+UI.ic('plus',13)+'Log session</button><button class="btn sm" data-export>'+UI.ic('download',13)+'Export</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="revTable"><thead><tr><th>Session</th><th class="hide-sm">Organizer</th><th>Dates</th><th>Expenses</th><th>Reimbursed</th><th>Net</th><th>Status</th></tr></thead><tbody>'
   +d.list.map(t=>{ const e=sumExp(t),r=sumReimb(t),net=r-e;
      const isLinked=!!t.linkedTraining;
      return '<tr data-rev="'+t.id+'"><td><div class="primary-cell"><b>'+U.esc(t.title)
        +(isLinked?' <span class="rep-tag" title="This session is a training in the roster">roster</span>':'')+'</b>'
        +'<small>'+U.esc(t.location||'—')+'</small></div></td>'
      +'<td class="small hide-sm">'+U.esc(t.organizer||'—')+'</td><td class="num">'+U.fmtDateShort(t.start)+'</td>'
      +'<td class="num">'+U.fmtNum(e)+'</td><td class="num" style="color:var(--pos)">'+U.fmtNum(r)+'</td><td class="num" style="color:'+(net>=0?'var(--pos)':'var(--crit)')+'">'+(net>=0?'+':'')+U.fmtNum(net)+'</td>'
      +'<td>'+(r>=e?'<span class="pill teal">settled</span>':'<span class="pill amber">pending</span>')+'</td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>All amounts in RWF · admin-only module</span><span class="mono strong" style="color:'+(d.balance>=0?'var(--pos)':'var(--crit)')+'">Net '+U.fmtRWF(d.balance)+'</span></div></div></div>'
   +'<div class="c4"><div class="col" style="gap:14px">'
    +UI.card({title:'Reimbursement sources',sub:'Where funds came from',icon:'building-2',body:(function(){
      const g={}; d.list.forEach(t=>(t.reimbursements||[]).forEach(r=>{ g[r.source||'Other']=(g[r.source||'Other']||0)+(r.amount||0); }));
      const keys=Object.keys(g); const max=Math.max.apply(null,keys.map(k=>g[k]).concat([1]));
      return keys.length?keys.map(k=>'<div style="margin-bottom:9px"><div class="row between"><span class="xs">'+U.esc(k)+'</span><span class="mono xs faint">'+U.fmtNum(g[k])+'</span></div><div class="meter teal" style="margin-top:4px"><i style="width:'+(g[k]/max*100)+'%"></i></div></div>').join(''):'<p class="xs faint">No reimbursements recorded.</p>';
    })()})+'</div></div></div>'
   +'<div class="grid-12" style="margin-top:14px"><div class="c4">'+averagesCard()+'</div><div class="c8">'+UI.card({title:'Monthly cash flow',sub:'Expenses against reimbursements, month by month',icon:'chart-line',
      tools:'<span class="pill gold">RWF</span><span class="pill teal">reimbursed</span><span class="pill amber">expenses</span>',
      body:'<div id="revChart"></div>',
      foot:'<span>Hover a month for exact figures</span><span class="mono">'+d.list.length+' sessions</span>'})+'</div></div>';
}
/* A ticket records places actually entered by the user, not a GPS trace. Google
   supplies a suggested driving route and may choose different roads than the vehicle. */
function ticketRoute(x){
  if(!x.routeFrom||!x.routeTo) return '';
  const url='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(x.routeFrom)+'&destination='+encodeURIComponent(x.routeTo)+'&travelmode=driving';
  return '<div class="xs">'+U.esc(x.routeFrom)+' → '+U.esc(x.routeTo)+' · <a target="_blank" rel="noopener noreferrer" href="'+U.esc(url)+'">Suggested road route ↗</a></div>';
}
function drawer(id){
  const t=data().list.find(x=>x.id===id); if(!t) return;
  const e=sumExp(t),r=sumReimb(t);
  const tr=(S.db().trainings||[]).find(x=>x.id===t.linkedTraining)||null;
  const attendeeNames=tr?(tr.attendees||[]).map(a=>(S.staffById(a)||{}).name).filter(Boolean):[];
  UI.drawer({title:t.title,eyebrow:'Training revenue',sub:(t.organizer||'')+' · '+U.fmtDate(t.start),wide:true,
    body:'<div class="row wrap" style="gap:6px;margin-bottom:14px"><span class="pill gold">'+U.esc(t.organizer||'—')+'</span><span class="pill slate">'+U.esc(t.location||'—')+'</span><span class="pill '+(r>=e?'teal':'amber')+'">'+(r>=e?'settled':'pending')+'</span>'
      +(tr?'<span class="pill teal">'+UI.ic('clipboard-list',11)+'on the training roster</span>':'<span class="pill amber">not in the roster</span>')+'</div>'
     +'<div class="card pad" style="margin-bottom:14px">'
       +'<div class="row between" style="gap:10px;flex-wrap:wrap;align-items:flex-end">'
         +'<div class="grow"><div class="eyebrow">Training in the roster</div>'
           +'<div class="small" data-roster-line style="margin-top:4px">'+(tr
             ? '<b>'+U.esc(tr.title)+'</b> · '+U.fmtDate(tr.start)+(tr.end&&tr.end!==tr.start?' – '+U.fmtDate(tr.end):'')
               +(attendeeNames.length?' · '+attendeeNames.length+' attendee'+(attendeeNames.length===1?'':'s'):'')
             : 'This ledger session is not tied to a training in the registry — choose one and the two stay together.')+'</div></div>'
         +'<div style="min-width:260px"><label class="xs faint">Choose from the roster</label>'
           +'<select class="select" data-link-select style="margin-top:4px">'+rosterOptions(t.linkedTraining||'',t.id)+'</select></div>'
       +'</div>'
       +'<div class="hint" style="margin-top:8px">Linked sessions are counted once on the registry side: the '+(tr?'training':'session')+' stops appearing as one still waiting for a revenue line. <a href="#/training" data-go-roster>Open the training roster</a></div>'
     +'</div>'
     +'<div class="split-3" style="margin-bottom:14px">'+[['Expenses',e,'amber'],['Reimbursed',r,'teal'],['Net',r-e,r-e>=0?'teal':'rose']].map(([k,v,tone])=>'<div class="card pad"><div class="eyebrow">'+k+'</div><div class="serif" style="font-size:1.4rem;margin-top:4px;color:var(--'+(tone==='teal'?'pos':tone==='rose'?'crit':'warn')+')">'+U.fmtNum(v)+'</div><div class="xs faint">RWF</div></div>').join('')+'</div>'
     +'<div class="hint" style="margin-bottom:14px">'
       +'This session against the average on the record: expenses <b class="mono">'+U.fmtNum(e)+'</b> vs <b class="mono">'+U.fmtNum(averages().avg.exp)+'</b>, '
       +'reimbursed <b class="mono">'+U.fmtNum(r)+'</b> vs <b class="mono">'+U.fmtNum(averages().avg.reimb)+'</b>.'
     +'</div>'
     +'<div class="hint" style="margin-bottom:10px">Ticket endpoints are the stops you entered. Google Maps suggests roads; this is not a GPS recording of the actual bus or taxi route.</div>'
     +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('receipt',14,'ic')+'Expense lines</div></div><button class="btn xs" data-add-exp>'+UI.ic('plus',12)+'Add line</button></div><div class="card-body">'
       +(t.expenses||[]).map(x=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(x.desc||x.cat)+'</div><div class="lr-sub">'+U.esc(catLabel(x))+' · '+U.fmtDate(x.date)+'</div>'+ticketRoute(x)+'</div><div class="lr-val">'+U.fmtNum(x.amount)+'</div></div>'+(x.desc&&x.custom?'':'' )).join('')
     +'</div></div>'
     +'<div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('banknote',14,'ic')+'Reimbursements</div></div><button class="btn xs" data-add-reimb>'+UI.ic('plus',12)+'Add</button></div><div class="card-body">'
       +((t.reimbursements||[]).length?(t.reimbursements||[]).map(x=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(x.source||'Reimbursement')+'</div><div class="lr-sub">'+U.fmtDate(x.date)+(x.note?' · '+U.esc(x.note):'')+'</div></div><div class="lr-val" style="color:var(--pos)">'+U.fmtNum(x.amount)+'</div></div>').join(''):'<p class="xs faint">No reimbursement recorded yet.</p>')
     +'</div></div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-print>'+UI.ic('printer',15)+'Statement</button>',
    onMount:(panel)=>{
      const linkSel=panel.querySelector('[data-link-select]');
      if(linkSel) linkSel.onchange=()=>{
        if(!LS.auth.guard('revenue')) return;
        const id=linkSel.value||null;
        const tr=(S.db().trainings||[]).find(x=>x.id===id)||null;
        S.commit(d=>{ const x=(d.trainingExpenses||[]).find(y=>y.id===t.id); if(x) x.linkedTraining=id; },
          {action:'revenue.link',entity:'trainingExpenses',entityId:t.id,
           detail:tr?('Linked to the training roster · '+tr.title):'Unlinked from the training roster'});
        const line=panel.querySelector('[data-roster-line]');
        if(line) line.innerHTML=tr
          ? '<b>'+U.esc(tr.title)+'</b> · '+U.fmtDate(tr.start)+((tr.attendees||[]).length?' · '+(tr.attendees||[]).length+' attendee'+((tr.attendees||[]).length===1?'':'s'):'')
          : 'This ledger session is not tied to a training in the registry — choose one and the two stay together.';
        UI.toast(tr?'Linked to the training roster':'Unlinked from the roster',{type:'ok'});
        LS.shell.refresh();
      };
      const goRoster=panel.querySelector('[data-go-roster]');
      if(goRoster) goRoster.onclick=ev=>{ ev.preventDefault(); UI.closeAll(); LS.shell.go('training'); };
      panel.querySelector('[data-add-exp]').onclick=()=>addLine(t,'expense',panel);
      panel.querySelector('[data-add-reimb]').onclick=()=>addLine(t,'reimb',panel);
      panel.querySelector('[data-print]').onclick=()=>{
        U.printDoc('Training revenue statement — '+t.title,
          '<table><thead><tr><th>Item</th><th>Category</th><th>Date</th><th>Amount (RWF)</th></tr></thead><tbody>'
          +(t.expenses||[]).map(x=>'<tr><td>'+U.esc(x.desc||'')+'</td><td>'+U.esc(catLabel(x))+'</td><td>'+U.fmtDate(x.date)+'</td><td>'+U.fmtNum(x.amount)+'</td></tr>').join('')
          +'<tr><td colspan="3"><b>Total expenses</b></td><td><b>'+U.fmtNum(e)+'</b></td></tr></tbody></table>'
          +'<p style="margin-top:8px;font-size:9px">Reimbursed: '+U.fmtRWF(r)+' · Net: '+U.fmtRWF(r-e)+'</p>',{meta:'<span>Prepared by '+U.esc(LS.auth.user.name)+'</span>'});
      };
    }});
}
function addLine(t,kind,panel){
  UI.modal({title:kind==='expense'?'Add expense line':'Record reimbursement',body:
    '<div class="form-grid"><div class="field span2"><label>Description</label><input class="input" id="lnDesc" placeholder="'+(kind==='expense'?'Transport to Musanze':'RBC reimbursement')+'"></div>'
    +'<div class="field"><label>Amount (RWF)</label><input class="input mono" id="lnAmt" type="number" min="0" value="0"></div>'
    +'<div class="field"><label>Date</label><input class="input mono" id="lnDate" type="date" value="'+U.todayISO()+'"></div>'
    +(kind==='expense'?'<div class="field"><label>Category</label><select class="select" id="lnCat">'+catOptions('Transport')+'</select></div>'
      +'<div class="field"><label for="lnFrom">Transport ticket from (optional)</label><input class="input" id="lnFrom" placeholder="Starting stop"></div><div class="field"><label for="lnTo">Transport ticket to (optional)</label><input class="input" id="lnTo" placeholder="Arrival stop"></div>'
      +'<div class="field" id="lnCatOtherWrap" style="display:none"><label>Custom category</label><input class="input" id="lnCatOther" placeholder="e.g. Venue hire, Translator, Printing"></div>'
      :'<div class="field span2"><label>Source</label><input class="input" id="lnSrc" value="RBC"></div>')+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save line</button>',
    onMount:(el,close)=>{
      const catSel=el.querySelector('#lnCat'), otherWrap=el.querySelector('#lnCatOtherWrap');
      if(catSel) catSel.onchange=()=>{ const isOther=catSel.value==='Other'; otherWrap.style.display=isOther?'':'none'; if(isOther) otherWrap.querySelector('input').focus(); };
      el.querySelector('[data-save]').onclick=()=>{
        if(!LS.auth.guard('revenue')) return;
        const amt=+el.querySelector('#lnAmt').value;
        let catVal=catSel?catSel.value:'';
        let custom=false;
        if(catSel && catSel.value==='Other'){
          const customLabel=(el.querySelector('#lnCatOther').value||'').trim();
          if(!customLabel) return UI.toast('Name the custom expense category',{type:'warn'});
          catVal=customLabel; custom=true;
        }
        S.commit(d=>{ const x=d.trainingExpenses.find(y=>y.id===t.id); if(!x) return;
          if(kind==='expense'){ x.expenses=x.expenses||[]; x.expenses.push({id:U.uid('x'),cat:catVal,custom,desc:el.querySelector('#lnDesc').value,amount:amt,date:el.querySelector('#lnDate').value,routeFrom:catVal==='Transport'?el.querySelector('#lnFrom').value.trim():'',routeTo:catVal==='Transport'?el.querySelector('#lnTo').value.trim():''}); }
          else { x.reimbursements=x.reimbursements||[]; x.reimbursements.push({id:U.uid('r'),amount:amt,date:el.querySelector('#lnDate').value,source:el.querySelector('#lnSrc').value,note:el.querySelector('#lnDesc').value}); }
        },{action:'revenue.'+kind,entity:'trainingExpenses',entityId:t.id,detail:kind+' RWF '+amt+' · '+(kind==='expense'?catLabel({cat:catVal,custom}):'')+' · '+t.title});
        close(); UI.closeAll(); UI.toast('Revenue line saved',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
/* ——— Logging a session ————————————————————————————————
   A training is rarely one expense and one reimbursement: fuel, per-diem, a venue, a meal
   — each with the day it was paid — and reimbursements that arrive later, often in more
   than one instalment. The form takes as many lines as the session actually had, each
   with its own date, and totals them live so the figure is known before it is saved. */
function addSession(){
  if(!LS.auth.guard('revenue')) return;
  const free=rosterRows().filter(r=>!r.usedBy).length;
  let expRows=[{amount:'',cat:'Transport',custom:'',date:U.todayISO(),desc:''}];
  let reiRows=[{amount:'',date:U.todayISO(),source:'RBC',note:''}];
  const catSelHTML=cur=>'<select class="select" data-e-cat>'+catOptions(cur||'Transport')+'</select>';
  const expRowHTML=(r,i)=>'<tr data-exp-row="'+i+'">'
    +'<td class="num"><input class="input mono" type="number" min="0" data-e-amount value="'+U.esc(r.amount)+'" placeholder="0" style="width:96px"></td>'
    +'<td>'+catSelHTML(r.cat).replace('class="select" data-e-cat','class="select" data-e-cat')+'</td>'
    +'<td><input class="input" data-e-custom value="'+U.esc(r.custom||'')+'" placeholder="name it" style="'+(r.cat==='Other'?'':'display:none')+'"></td>'
    +'<td><input class="input mono" type="date" data-e-date value="'+U.esc(r.date)+'"></td>'
    +'<td><input class="input" data-e-desc value="'+U.esc(r.desc||'')+'" placeholder="e.g. Fuel for 4 staff to Musanze"></td>'
    +'<td><input class="input" data-e-from aria-label="Ticket from" value="'+U.esc(r.routeFrom||'')+'" placeholder="Starting stop" style="width:140px"></td><td><input class="input" data-e-to aria-label="Ticket to" value="'+U.esc(r.routeTo||'')+'" placeholder="Arrival stop" style="width:140px"></td>'
    +'<td class="num"><button class="rep-del" data-e-del title="Remove this line" aria-label="Remove this expense line">'+UI.ic('trash-2',12)+'</button></td></tr>';
  const reiRowHTML=(r,i)=>'<tr data-rei-row="'+i+'">'
    +'<td class="num"><input class="input mono" type="number" min="0" data-r-amount value="'+U.esc(r.amount)+'" placeholder="0" style="width:96px"></td>'
    +'<td><input class="input mono" type="date" data-r-date value="'+U.esc(r.date)+'"></td>'
    +'<td><input class="input" data-r-source value="'+U.esc(r.source||'')+'"></td>'
    +'<td><input class="input" data-r-note value="'+U.esc(r.note||'')+'" placeholder="e.g. first instalment"></td>'
    +'<td class="num"><button class="rep-del" data-r-del title="Remove this line" aria-label="Remove this reimbursement line">'+UI.ic('trash-2',12)+'</button></td></tr>';

  UI.modal({title:'Log training session',sub:'Choose the session from the training roster, then record each expense and each reimbursement with the day it happened.',width:'min(760px,100%)',
    body:'<div class="form-grid">'
     +'<div class="field span2"><label>Training from the roster</label><select class="select" id="rsPick">'+rosterOptions('','')+'</select>'
       +'<div class="hint" style="margin-top:6px">'+(free?free+' training'+(free===1?'':'s')+' on the roster '+(free===1?'has':'have')+' no revenue line yet — they are listed first.':'Every training on the roster already carries a revenue line; a new session can still be typed below.')+'</div></div>'
     +'<div class="field span2"><label>Title</label><input class="input" id="rsTitle" placeholder="e.g. IPC and WASH FIT"></div>'
     +'<div class="field"><label>Organizer</label><input class="input" id="rsOrg" value="RBC"></div>'
     +'<div class="field"><label>Location</label><input class="input" id="rsLoc" value="Ruli DH"></div>'
     +'<div class="field"><label>Start</label><input class="input mono" type="date" id="rsStart" value="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>End</label><input class="input mono" type="date" id="rsEnd" value="'+U.todayISO()+'"></div>'
     +'</div>'
     +'<div class="rev-lines-head"><b>Expenses</b><span class="xs faint">each line carries the day it was paid; transport tickets can include stops</span><span class="grow"></span>'
       +'<button class="btn xs" data-add-exp-line>'+UI.ic('plus',12)+'Add expense</button></div>'
     +'<div class="dt-scroll"><table class="dt rev-lines"><thead><tr><th>Amount (RWF)</th><th>Category</th><th>Other</th><th>Date</th><th>Description</th><th>Ticket from</th><th>Ticket to</th><th></th></tr></thead>'
       +'<tbody data-exp-body></tbody></table></div>'
     +'<div class="rev-lines-head" style="margin-top:14px"><b>Reimbursements</b><span class="xs faint">money received, and the day it arrived</span><span class="grow"></span>'
       +'<button class="btn xs" data-add-rei-line>'+UI.ic('plus',12)+'Add reimbursement</button></div>'
     +'<div class="dt-scroll"><table class="dt rev-lines"><thead><tr><th>Amount (RWF)</th><th>Date received</th><th>Source</th><th>Note</th><th></th></tr></thead>'
       +'<tbody data-rei-body></tbody></table></div>'
     +'<div class="rev-lines-tot" data-totals></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save session</button>',
    onMount:(el,close)=>{
      const expBody=el.querySelector('[data-exp-body]'), reiBody=el.querySelector('[data-rei-body]');
      const totalsEl=el.querySelector('[data-totals]');
      const readExp=()=>[...expBody.querySelectorAll('[data-exp-row]')].map(tr=>({
        amount:tr.querySelector('[data-e-amount]').value,
        cat:tr.querySelector('[data-e-cat]').value,
        custom:tr.querySelector('[data-e-custom]').value,
        date:tr.querySelector('[data-e-date]').value,
        desc:tr.querySelector('[data-e-desc]').value,
        routeFrom:tr.querySelector('[data-e-from]').value,routeTo:tr.querySelector('[data-e-to]').value}));
      const readRei=()=>[...reiBody.querySelectorAll('[data-rei-row]')].map(tr=>({
        amount:tr.querySelector('[data-r-amount]').value,
        date:tr.querySelector('[data-r-date]').value,
        source:tr.querySelector('[data-r-source]').value,
        note:tr.querySelector('[data-r-note]').value}));
      const sync=()=>{ expRows=readExp(); reiRows=readRei(); };
      const totals=()=>{
        const e=U.sum(expRows,x=>Math.max(0,+x.amount||0));
        const r=U.sum(reiRows,x=>Math.max(0,+x.amount||0));
        totalsEl.innerHTML='<span>Expenses <b class="mono">'+U.fmtNum(e)+'</b> RWF · '+expRows.length+' line'+(expRows.length===1?'':'s')+'</span>'
          +'<span>Reimbursed <b class="mono">'+U.fmtNum(r)+'</b> RWF · '+reiRows.length+' line'+(reiRows.length===1?'':'s')+'</span>'
          +'<span class="'+(r-e>=0?'pos':'crit')+'">Net <b class="mono">'+(r-e>=0?'+':'')+U.fmtNum(r-e)+'</b> RWF</span>';
      };
      const draw=()=>{
        expBody.innerHTML=expRows.map(expRowHTML).join('')||'<tr><td colspan="8" class="xs faint">No expense line yet — add one above.</td></tr>';
        reiBody.innerHTML=reiRows.map(reiRowHTML).join('')||'<tr><td colspan="5" class="xs faint">No reimbursement recorded yet.</td></tr>';
        wireRows(); totals();
      };
      const wireRows=()=>{
        expBody.querySelectorAll('[data-exp-row]').forEach(tr=>{
          const i=+tr.dataset.expRow;
          tr.querySelector('[data-e-amount]').oninput=()=>{ expRows[i].amount=tr.querySelector('[data-e-amount]').value; totals(); };
          tr.querySelector('[data-e-date]').onchange=()=>{ expRows[i].date=tr.querySelector('[data-e-date]').value; };
          tr.querySelector('[data-e-desc]').oninput=()=>{ expRows[i].desc=tr.querySelector('[data-e-desc]').value; };
          tr.querySelector('[data-e-custom]').oninput=()=>{ expRows[i].custom=tr.querySelector('[data-e-custom]').value; };
          const cat=tr.querySelector('[data-e-cat]');
          cat.onchange=()=>{
            expRows[i].cat=cat.value;
            const c=tr.querySelector('[data-e-custom]'); c.style.display=cat.value==='Other'?'':'none';
            if(cat.value==='Other') c.focus();
          };
          tr.querySelector('[data-e-del]').onclick=()=>{ sync(); expRows.splice(i,1); if(!expRows.length) expRows=[{amount:'',cat:'Transport',custom:'',date:U.todayISO(),desc:''}]; draw(); };
        });
        reiBody.querySelectorAll('[data-rei-row]').forEach(tr=>{
          const i=+tr.dataset.reiRow;
          tr.querySelector('[data-r-amount]').oninput=()=>{ reiRows[i].amount=tr.querySelector('[data-r-amount]').value; totals(); };
          tr.querySelector('[data-r-date]').onchange=()=>{ reiRows[i].date=tr.querySelector('[data-r-date]').value; };
          tr.querySelector('[data-r-source]').oninput=()=>{ reiRows[i].source=tr.querySelector('[data-r-source]').value; };
          tr.querySelector('[data-r-note]').oninput=()=>{ reiRows[i].note=tr.querySelector('[data-r-note]').value; };
          tr.querySelector('[data-r-del]').onclick=()=>{ sync(); reiRows.splice(i,1); if(!reiRows.length) reiRows=[{amount:'',date:U.todayISO(),source:'RBC',note:''}]; draw(); };
        });
      };
      el.querySelector('[data-add-exp-line]').onclick=()=>{ sync(); expRows.push({amount:'',cat:'Transport',custom:'',date:el.querySelector('#rsEnd').value||U.todayISO(),desc:''}); draw(); };
      el.querySelector('[data-add-rei-line]').onclick=()=>{ sync(); reiRows.push({amount:'',date:todayOrEnd(),source:'RBC',note:''}); draw(); };
      const todayOrEnd=()=>el.querySelector('#rsEnd').value||U.todayISO();

      /* choosing a session fills the rest of the form from the registry, so the two
         records describe the same event rather than two similar-sounding ones */
      const pick=el.querySelector('#rsPick');
      let linked=null, attendees=[];
      pick.onchange=()=>{
        const tr=(S.db().trainings||[]).find(x=>x.id===pick.value);
        linked=tr?tr.id:null; attendees=tr?(tr.attendees||[]):[];
        const fields=[['rsTitle',tr&&tr.title],['rsOrg',tr&&tr.organizer],['rsLoc',tr&&tr.location],
          ['rsStart',tr&&tr.start],['rsEnd',tr&&(tr.end||tr.start)]];
        fields.forEach(([id,val])=>{ const inp=el.querySelector('#'+id); if(inp&&val) inp.value=val; });
        if(tr){
          const already=(S.db().trainingExpenses||[]).find(t=>t.linkedTraining===tr.id);
          if(already) UI.toast('“'+tr.title+'” already has a revenue line — adding a second one on top of it',{type:'warn',duration:5000});
        }
      };
      draw();

      el.querySelector('[data-save]').onclick=()=>{
        const title=el.querySelector('#rsTitle').value.trim(); if(!title) return UI.toast('Title required',{type:'warn'});
        const start=el.querySelector('#rsStart').value, end=el.querySelector('#rsEnd').value;
        sync();
        /* every line keeps its own day; a line with no date borrows the session's */
        const expenses=[];
        for(let i=0;i<expRows.length;i++){
          const x=expRows[i], amt=Math.max(0,Math.round(+x.amount||0));
          if(!amt&&!(x.desc||'').trim()&&!(x.routeFrom||'').trim()&&!(x.routeTo||'').trim()) continue;
          let catVal=x.cat, custom=false;
          if(catVal==='Other'){
            const customLabel=(x.custom||'').trim();
            if(!customLabel) return UI.toast('Name the custom expense category on line '+(i+1),{type:'warn'});
            catVal=customLabel; custom=true;
          }
          expenses.push({id:U.uid('x'),cat:catVal,custom,desc:(x.desc||'').trim()||catLabel({cat:catVal,custom}),
            amount:amt,date:x.date||end||start,routeFrom:catVal==='Transport'?(x.routeFrom||'').trim():'',routeTo:catVal==='Transport'?(x.routeTo||'').trim():''});
        }
        const reimbursements=[];
        for(let i=0;i<reiRows.length;i++){
          const x=reiRows[i], amt=Math.max(0,Math.round(+x.amount||0));
          if(!amt) continue;
          reimbursements.push({id:U.uid('r'),amount:amt,date:x.date||end||start,
            source:(x.source||'').trim()||'RBC',note:(x.note||'').trim()});
        }
        const expTotal=U.sum(expenses,x=>x.amount), reiTotal=U.sum(reimbursements,x=>x.amount);
        const rec={id:U.uid('te'),title,organizer:el.querySelector('#rsOrg').value,location:el.querySelector('#rsLoc').value,start,end,
          linkedTraining:linked,attendees:attendees.slice(),expenses,reimbursements,note:''};
        S.commit(d=>{ d.trainingExpenses.unshift(rec); },{action:'revenue.session',entity:'trainingExpenses',entityId:rec.id,
          detail:title+' · RWF '+reiTotal+'/'+expTotal+' · '+expenses.length+' expense line'+(expenses.length===1?'':'s')
            +', '+reimbursements.length+' reimbursement'+(reimbursements.length===1?'':'s')
            +(linked?' · linked to the training roster':' · not in the roster')});
        close(); UI.toast('Session logged — '+expenses.length+' expense'+(expenses.length===1?'':'s')
          +', '+reimbursements.length+' reimbursement'+(reimbursements.length===1?'':'s'),{type:'ok'});
        LS.shell.refresh();
      };
    }});
}
M.render=function(root,params){
  rootEl=root;
  if(!LS.auth.can('revenue')){
    root.innerHTML='<div class="card pad" style="max-width:540px;margin:6vh auto">'+UI.empty({art:'lock',title:'Confidential module',body:'Training revenue is restricted to Admin and Manager roles. Ask the Laboratory Manager to grant access.',action:'<button class="btn" data-go="dash">Back to Command Center</button>'})+'</div>';
    root.querySelector('[data-go]').onclick=()=>LS.shell.go('dash'); return;
  }
  const d=data();
  root.innerHTML='<div class="page-head"><div><h1>Training revenue</h1><div class="sub">The honest ledger behind competency: every session, expense and reimbursement reconciled to the training registry.</div></div>'
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn primary" data-add>'+UI.ic('plus',15)+' Log session</button></div></div>'
   +kpis()+table();
  root.querySelector('[data-add]').onclick=addSession;
  root.querySelector('[data-export]').onclick=()=>{
    const rows=[['Session','Organizer','Location','Start','End','Expenses','Reimbursed','Net']].concat(d.list.map(t=>{ const e=sumExp(t),r=sumReimb(t); return [t.title,t.organizer,t.location,t.start,t.end,e,r,r-e]; }));
    U.exportCSV('training-revenue-'+U.todayISO()+'.csv',rows,{title:'Training revenue ledger',actor:LS.auth.user.name}); UI.toast('Revenue ledger exported',{type:'ok'});
  };
  root.querySelectorAll('[data-rev]').forEach(tr=>tr.onclick=()=>drawer(tr.dataset.rev));
  const s=root.querySelector('#revSearch'); if(s) s.addEventListener('input',()=>{ const q=s.value.toLowerCase(); U.$$('#revTable tbody tr',root).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'); });
  // chart by year-month of sessions
  const g=U.groupBy(d.list,t=>String(t.start).slice(0,7));
  const keys=Object.keys(g).sort();
  C.line(root.querySelector('#revChart'),{id:'revC',height:320,padLeft:64,series:[
    {name:'Expenses',color:'var(--amber)',values:keys.map(k=>U.sum(g[k],sumExp))},
    {name:'Reimbursed',color:'var(--pos)',values:keys.map(k=>U.sum(g[k],sumReimb))}
  ],labels:keys.map(k=>U.M3[+k.slice(5,7)-1]+' '+k.slice(2,4)),yFmt:v=>Math.round(v/1000)+'k RWF',tipFmt:v=>U.fmtRWF(v)});
};
})();
