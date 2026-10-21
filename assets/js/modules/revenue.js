/* ============================================================================
   MODULE · TRAINING REVENUE — expenses, reimbursements, balance
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.revenue=M;
let rootEl=null;
const sumExp=t=>U.sum(t.expenses||[],e=>e.amount||0);
const sumReimb=t=>U.sum(t.reimbursements||[],r=>r.amount||0);
function data(){
  const list=S.db().trainingExpenses||[];
  const exp=U.sum(list,sumExp), reimb=U.sum(list,sumReimb);
  return {list,exp,reimb,balance:reimb-exp,pending:U.sum(list.filter(t=>sumReimb(t)<sumExp(t)),t=>sumExp(t)-sumReimb(t))};
}
function kpis(){
  const d=data();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Reimbursed',value:Math.round(d.reimb/1000),unit:'k RWF',icon:'banknote',formatted:'0',delta:18,note:d.list.length+' sessions',spark:C.spark([20,26,22,34,30,42,38,45,48,52],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Expenses',value:Math.round(d.exp/1000),unit:'k RWF',icon:'receipt',formatted:'0',delta:6,note:'Transport, per-diem, materials',spark:C.spark([10,14,12,18,16,20,22,19,24,26],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Net balance',value:Math.round(d.balance/1000),unit:'k RWF',icon:'wallet',formatted:'0',delta:d.balance>=0?9:-9,note:d.balance>=0?'Positive return':'Awaiting reimbursement',spark:C.spark([4,6,5,9,8,12,10,14,13,16],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Pending claims',value:Math.round(d.pending/1000),unit:'k RWF',icon:'clock',formatted:'0',note:d.list.filter(t=>sumReimb(t)<sumExp(t)).length+' sessions open',spark:C.spark([18,14,16,10,12,8,9,6,7,4],{color:'var(--crit)'})})+'</div></div>';
}
function table(){
  const d=data();
  return '<div class="grid-12"><div class="c8"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="revSearch" placeholder="Search session, organizer…"></div><span class="grow"></span><button class="btn sm" data-add>'+UI.ic('plus',13)+'Log session</button><button class="btn sm" data-export>'+UI.ic('download',13)+'Export</button></div>'
   +'<div class="dt-scroll"><table class="dt" id="revTable"><thead><tr><th>Session</th><th class="hide-sm">Organizer</th><th>Dates</th><th>Expenses</th><th>Reimbursed</th><th>Net</th><th>Status</th></tr></thead><tbody>'
   +d.list.map(t=>{ const e=sumExp(t),r=sumReimb(t),net=r-e;
      return '<tr data-rev="'+t.id+'"><td><div class="primary-cell"><b>'+U.esc(t.title)+'</b><small>'+U.esc(t.location||'—')+'</small></div></td>'
      +'<td class="small hide-sm">'+U.esc(t.organizer||'—')+'</td><td class="num">'+U.fmtDateShort(t.start)+'</td>'
      +'<td class="num">'+U.fmtNum(e)+'</td><td class="num" style="color:var(--pos)">'+U.fmtNum(r)+'</td><td class="num" style="color:'+(net>=0?'var(--pos)':'var(--crit)')+'">'+(net>=0?'+':'')+U.fmtNum(net)+'</td>'
      +'<td>'+(r>=e?'<span class="pill teal">settled</span>':'<span class="pill amber">pending</span>')+'</td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>All amounts in RWF · admin-only module</span><span class="mono strong" style="color:'+(d.balance>=0?'var(--pos)':'var(--crit)')+'">Net '+U.fmtRWF(d.balance)+'</span></div></div></div>'
   +'<div class="c4"><div class="col" style="gap:14px">'+UI.card({title:'Monthly cash flow',sub:'Expenses vs reimbursements',icon:'chart-line',body:'<div id="revChart"></div>'})
    +UI.card({title:'Reimbursement sources',sub:'Where funds came from',icon:'building-2',body:(function(){
      const g={}; d.list.forEach(t=>(t.reimbursements||[]).forEach(r=>{ g[r.source||'Other']=(g[r.source||'Other']||0)+(r.amount||0); }));
      const keys=Object.keys(g); const max=Math.max.apply(null,keys.map(k=>g[k]).concat([1]));
      return keys.length?keys.map(k=>'<div style="margin-bottom:9px"><div class="row between"><span class="xs">'+U.esc(k)+'</span><span class="mono xs faint">'+U.fmtNum(g[k])+'</span></div><div class="meter teal" style="margin-top:4px"><i style="width:'+(g[k]/max*100)+'%"></i></div></div>').join(''):'<p class="xs faint">No reimbursements recorded.</p>';
    })()})+'</div></div></div>';
}
function drawer(id){
  const t=data().list.find(x=>x.id===id); if(!t) return;
  const e=sumExp(t),r=sumReimb(t);
  UI.drawer({title:t.title,eyebrow:'Training revenue',sub:(t.organizer||'')+' · '+U.fmtDate(t.start),wide:true,
    body:'<div class="row wrap" style="gap:6px;margin-bottom:14px"><span class="pill gold">'+U.esc(t.organizer||'—')+'</span><span class="pill slate">'+U.esc(t.location||'—')+'</span><span class="pill '+(r>=e?'teal':'amber')+'">'+(r>=e?'settled':'pending')+'</span></div>'
     +'<div class="split-3" style="margin-bottom:14px">'+[['Expenses',e,'amber'],['Reimbursed',r,'teal'],['Net',r-e,r-e>=0?'teal':'rose']].map(([k,v,tone])=>'<div class="card pad"><div class="eyebrow">'+k+'</div><div class="serif" style="font-size:1.4rem;margin-top:4px;color:var(--'+(tone==='teal'?'pos':tone==='rose'?'crit':'warn')+')">'+U.fmtNum(v)+'</div><div class="xs faint">RWF</div></div>').join('')+'</div>'
     +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('receipt',14,'ic')+'Expense lines</div></div><button class="btn xs" data-add-exp>'+UI.ic('plus',12)+'Add line</button></div><div class="card-body">'
       +(t.expenses||[]).map(x=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(x.desc||x.cat)+'</div><div class="lr-sub">'+U.esc(x.cat||'')+' · '+U.fmtDate(x.date)+'</div></div><div class="lr-val">'+U.fmtNum(x.amount)+'</div></div>').join('')
     +'</div></div>'
     +'<div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('banknote',14,'ic')+'Reimbursements</div></div><button class="btn xs" data-add-reimb>'+UI.ic('plus',12)+'Add</button></div><div class="card-body">'
       +((t.reimbursements||[]).length?(t.reimbursements||[]).map(x=>'<div class="list-row"><div class="lr-main"><div class="lr-title">'+U.esc(x.source||'Reimbursement')+'</div><div class="lr-sub">'+U.fmtDate(x.date)+(x.note?' · '+U.esc(x.note):'')+'</div></div><div class="lr-val" style="color:var(--pos)">'+U.fmtNum(x.amount)+'</div></div>').join(''):'<p class="xs faint">No reimbursement recorded yet.</p>')
     +'</div></div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn primary" data-print>'+UI.ic('printer',15)+'Statement</button>',
    onMount:(panel)=>{
      panel.querySelector('[data-add-exp]').onclick=()=>addLine(t,'expense',panel);
      panel.querySelector('[data-add-reimb]').onclick=()=>addLine(t,'reimb',panel);
      panel.querySelector('[data-print]').onclick=()=>{
        U.printDoc('Training revenue statement — '+t.title,
          '<table><thead><tr><th>Item</th><th>Category</th><th>Date</th><th>Amount (RWF)</th></tr></thead><tbody>'
          +(t.expenses||[]).map(x=>'<tr><td>'+U.esc(x.desc||'')+'</td><td>'+U.esc(x.cat||'')+'</td><td>'+U.fmtDate(x.date)+'</td><td>'+U.fmtNum(x.amount)+'</td></tr>').join('')
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
    +(kind==='expense'?'<div class="field span2"><label>Category</label><select class="select" id="lnCat"><option>Transport</option><option>Per-diem</option><option>Materials</option><option>Other</option></select></div>':'<div class="field span2"><label>Source</label><input class="input" id="lnSrc" value="RBC"></div>')+'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save line</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        if(!LS.auth.guard('revenue')) return;
        const amt=+el.querySelector('#lnAmt').value;
        S.commit(d=>{ const x=d.trainingExpenses.find(y=>y.id===t.id); if(!x) return;
          if(kind==='expense'){ x.expenses=x.expenses||[]; x.expenses.push({id:U.uid('x'),cat:el.querySelector('#lnCat').value,desc:el.querySelector('#lnDesc').value,amount:amt,date:el.querySelector('#lnDate').value}); }
          else { x.reimbursements=x.reimbursements||[]; x.reimbursements.push({id:U.uid('r'),amount:amt,date:el.querySelector('#lnDate').value,source:el.querySelector('#lnSrc').value,note:el.querySelector('#lnDesc').value}); }
        },{action:'revenue.'+kind,entity:'trainingExpenses',entityId:t.id,detail:kind+' RWF '+amt+' · '+t.title});
        close(); UI.closeAll(); UI.toast('Revenue line saved',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
function addSession(){
  if(!LS.auth.guard('revenue')) return;
  UI.modal({title:'Log training session',sub:'Expenses and reimbursements stay linked to the training registry.',width:'min(600px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Title</label><input class="input" id="rsTitle" placeholder="e.g. IPC and WASH FIT"></div>'
     +'<div class="field"><label>Organizer</label><input class="input" id="rsOrg" value="RBC"></div>'
     +'<div class="field"><label>Location</label><input class="input" id="rsLoc" value="Ruli DH"></div>'
     +'<div class="field"><label>Start</label><input class="input mono" type="date" id="rsStart" value="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>End</label><input class="input mono" type="date" id="rsEnd" value="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>Expense (RWF)</label><input class="input mono" id="rsExp" type="number" value="0"></div>'
     +'<div class="field"><label>Reimbursement (RWF)</label><input class="input mono" id="rsRei" type="number" value="0"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save session</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const title=el.querySelector('#rsTitle').value.trim(); if(!title) return UI.toast('Title required',{type:'warn'});
        const start=el.querySelector('#rsStart').value, end=el.querySelector('#rsEnd').value;
        const exp=+el.querySelector('#rsExp').value, rei=+el.querySelector('#rsRei').value;
        const rec={id:U.uid('te'),title,organizer:el.querySelector('#rsOrg').value,location:el.querySelector('#rsLoc').value,start,end,linkedTraining:null,
          expenses:exp?[{id:U.uid('x'),cat:'Other',desc:'Recorded expense',amount:exp,date:end}]:[],
          reimbursements:rei?[{id:U.uid('r'),amount:rei,date:end,source:'RBC',note:''}]:[],note:''};
        S.commit(d=>{ d.trainingExpenses.unshift(rec); },{action:'revenue.session',entity:'trainingExpenses',entityId:rec.id,detail:title+' · RWF '+exp+'/'+rei});
        close(); UI.toast('Session logged',{type:'ok'}); LS.shell.refresh();
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
  C.line(root.querySelector('#revChart'),{id:'revC',height:168,padLeft:34,series:[
    {name:'Expenses',color:'var(--amber)',values:keys.map(k=>U.sum(g[k],sumExp))},
    {name:'Reimbursed',color:'var(--pos)',values:keys.map(k=>U.sum(g[k],sumReimb))}
  ],labels:keys.map(k=>U.M3[+k.slice(5,7)-1]+' '+k.slice(2,4)),yFmt:v=>Math.round(v/1000)+'k',tipFmt:v=>U.fmtRWF(v)});
};
})();
