/* ============================================================================
   MODULE · STOCK & SUPPLY CHAIN
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.stock=M;
let tab='overview', rootEl=null;

function kpis(){
  const items=S.stockOverview();
  const cover=S.stockCover();
  const trend=S.stockTrend();
  const low=items.filter(x=>x.low).length;
  const exp=items.filter(x=>x.expiring);
  const soonest=cover.soonest;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Days of cover',value:cover.median===null?0:cover.median,unit:'median',icon:'gauge',formatted:'0',
      note:soonest?soonest.name.split(' ')[0]+' runs out in '+soonest.daysLeft+'d':'No issues logged yet',
      spark:C.spark(trend.filter(x=>x.daysLeft!=null).map(x=>Math.min(x.daysLeft,180)).slice(0,14),{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Below threshold',value:low,icon:'alert-triangle',formatted:'0',delta:low?6.2:-1,
      note:low?items.filter(x=>x.low).map(x=>x.name.split(' ')[0]).slice(0,2).join(', ')+'…':'All lines above minimum',
      spark:C.spark([1,2,1,2,3,2,4,3,2,3,4,low||0],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Expiring ≤ 30 days',value:exp.length,icon:'hourglass',formatted:'0',
      note:exp[0]?exp[0].name+' · '+U.daysBetween(U.todayISO(),exp[0].nearest.expiry)+'d':'No near-expiry stock',
      spark:C.spark([0,1,0,1,1,2,1,2,2,1,2,exp.length],{color:'var(--crit)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Stock-out projection',value:Math.max(0,trend.filter(x=>x.daysLeft!=null&&x.daysLeft<21).length),unit:'lines < 21d',icon:'trending-down',formatted:'0',
      note:cover.noConsumption?cover.noConsumption+' line(s) with no consumption yet':'Consumption rate is steady — no purchase request needed',
      spark:C.spark(trend.filter(x=>x.daysLeft!=null).map(x=>x.daysLeft).slice(0,14),{color:'var(--gold)'})})+'</div></div>';
}
/* "3.4 of 5 bottles a month" reads better on this bench than "0.11 a day". */
function monthLabel(perMonth,x){
  const n=Math.round((+perMonth||0)*10)/10;
  return n+' '+((x&&x.unit)||'units')+'/mo';
}
function itemRow(x){
  const days=x.daysLeft;
  const tone=x.low?'rose':days<21?'amber':'teal';
  const expiry=x.nearest?U.daysBetween(U.todayISO(),x.nearest.expiry):null;
  const expTone=expiry==null?'slate':expiry<=0?'rose':expiry<=30?'amber':'teal';
  return '<tr data-item="'+x.id+'">'
   +'<td><div class="primary-cell"><b>'+U.esc(x.name)+'</b><small>'+U.esc(x.unit)+'</small></div></td>'
   +'<td class="num">'+U.fmtNum(x.onHand)+'</td>'
   +'<td class="num hide-sm">'+U.fmtNum(x.threshold||0)+'</td>'
   +'<td style="width:150px"><div class="meter '+tone+'"><i style="width:'+U.clamp(x.onHand/Math.max(1,(x.max||x.threshold*3))*100,2,100)+'%"></i></div>'
     +'<div class="xs faint" style="margin-top:3px">'+x.burn.toFixed(1)+'/day · <b style="color:var(--text-muted)">'+monthLabel(x.perMonth,x)+'</b>'
     +(x.cap?' <span style="color:'+(x.capPct>100?'var(--crit)':x.capPct>85?'var(--warn)':'var(--pos)')+'">of '+x.cap+' cap</span>':'')+'</div></td>'
   +'<td><span class="mono small" style="color:'+(days<14?'var(--crit)':days<30?'var(--warn)':'var(--text)')+'">'+Math.min(days,999)+'d</span></td>'
   +'<td>'+(expiry!=null?'<span class="pill '+expTone+' mono">'+expiry+'d</span>':'<span class="xs faint">—</span>')+'</td>'
   +'<td class="num hide-sm">'+(x.daysLeft==null?'<span class="xs faint">—</span>':x.daysLeft+'d')+'</td>'
   +'<td style="width:64px;white-space:nowrap">'
   +'<button class="icon-btn row-actions" style="width:26px;height:26px" data-open="'+x.id+'" title="Open lot ledger">'+UI.ic('chevron-right',14)+'</button>'
   +'<button class="icon-btn row-actions" style="width:26px;height:26px" data-edit-item="'+x.id+'" title="Edit this line">'+UI.ic('pencil',14)+'</button>'
   +'<button class="icon-btn row-actions" style="width:26px;height:26px;color:var(--crit)" data-del="'+x.id+'" title="Delete this consumable line">'+UI.ic('trash-2',14)+'</button>'
   +'</td></tr>';
}
function archivedStrip(){
  const gone=S.deletedConsumables();
  const purged=(S.db().meta.stockPurgedNames||[]);
  if(!gone.length && !purged.length) return '';
  return '<div class="card" style="margin-top:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('trash-2',14,'ic')+'Archived lines</div>'
   +'<div class="card-sub">Removed from the register — nothing was invented back</div></div></div><div class="card-body">'
   +(gone.length?gone.map(c=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:12px">'+U.esc(c.name)+'</div><div class="lr-sub">Deleted '+U.fmtDate(String(c.deletedAt||'').slice(0,10))+' by '+U.esc(c.deletedBy||'user')+'</div></div><button class="btn xs" data-restore="'+c.id+'">Restore</button></div>').join(''):'')
   +(purged.length?'<p class="xs faint" style="margin-top:8px">Also removed with v6.5 (never in the store register): '+purged.map(U.esc).join(', ')+'.</p>':'')
   +'</div></div>';
}

function overview(){
  const items=S.stockOverview();
  return '<div class="grid-12">'
   +'<div class="c8"><div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="stkSearch" placeholder="Search consumable, lot, supplier…"></div>'
     +'<span class="grow"></span><button class="btn sm" data-receive>'+UI.ic('plus',13)+' Receive stock</button><button class="btn sm" data-pr>'+UI.ic('file-text',13)+' Purchase request</button></div>'
     +'<div class="dt-scroll"><table class="dt" id="stkTable"><thead><tr><th>Consumable</th><th>On hand</th><th class="hide-sm">Min</th><th>Burn &amp; capacity</th><th>Cover</th><th>Expiry</th><th class="hide-sm">Cover trend</th><th></th></tr></thead><tbody>'
     +items.map(itemRow).join('')+'</tbody></table></div>'
     +'<div class="card-foot"><span>'+items.filter(x=>x.low).length+' lines below minimum · '+items.filter(x=>x.expiring).length+' nearing expiry</span><span class="mono">'+items.length+' lines</span></div></div>'
     +archivedStrip()+'</div>'
   +'<div class="c4"><div class="col" style="gap:14px">'
     +UI.card({title:'Reorder radar',sub:'Suggested purchase quantities',icon:'alert-triangle',body:'<div id="reorderList"></div>',foot:'<button class="btn xs primary" data-pr>'+UI.ic('file-text',12)+' Generate request</button>'})
     +supplierMini()
   +'</div></div></div>';
}
function supplierMini(){
  const sups=S.db().suppliers;
  return UI.card({title:'Supplier performance',sub:'Lead time · fill rate · price variance',icon:'truck',
    tools:'<button class="btn xs ghost" data-tab-stock="suppliers">Details</button>',
    body:'<div style="display:flex;flex-direction:column;gap:11px">'+sups.slice(0,3).map(s=>'<div><div class="row between" style="margin-bottom:4px"><span class="small truncate">'+U.esc(s.name)+'</span><span class="mono xs" style="color:'+(s.fillRate>=92?'var(--pos)':s.fillRate>=85?'var(--warn)':'var(--crit)')+'">'+s.fillRate+'%</span></div><div style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+s.fillRate+'%;border-radius:99px;background:linear-gradient(90deg,var(--teal-700),var(--teal-400))"></div></div><div class="xs faint" style="margin-top:3px">'+s.leadDays+'d lead · ±'+s.priceVariance+'% price variance</div></div>').join('')+'</div>'});
}
function lotsView(){
  const db=S.db();
  const rows=db.stock.batches.slice().sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry)));
  const items=U.groupBy(rows,b=>b.cid);
  return '<div class="grid-12"><div class="c9"><div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('boxes',14,'ic')+'Lot &amp; batch register</div><div class="card-sub">FEFO order · every lot traceable to consumption</div></div><span class="grow"></span><button class="btn sm" data-receive>'+UI.ic('plus',13)+'Receive lot</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Lot / batch</th><th>Consumable</th><th class="num">Qty</th><th class="num">Received</th><th class="num">Expiry</th><th>Status</th><th class="num">Age</th><th></th></tr></thead><tbody>'
   +rows.map(b=>{ const c=S.consumable(b.cid)||{name:b.cid,unit:''}; const d=U.daysBetween(U.todayISO(),b.expiry);
      return '<tr data-lot="'+b.id+'" class="row-click" title="Open line"><td class="mono small">'+U.esc(b.id.toUpperCase())+'</td><td>'+U.esc(c.name)+(b.ageGroup?' <span class="pill slate">'+U.esc(b.ageGroup)+'</span>':'')+'</td><td class="num">'+b.qty+' <span class="faint">'+U.esc(c.unit||'')+'</span></td><td class="num">'+U.fmtDate(b.received)+'</td><td class="num">'+U.fmtDate(b.expiry)+'</td><td><span class="pill '+(d<0?'rose':d<=30?'amber':'teal')+'">'+(d<0?'expired':d<=30?'≤30d':'in date')+'</span></td><td class="num">'+U.daysBetween(b.received,U.todayISO())+'d</td>'
        +'<td><button class="icon-btn" style="width:26px;height:26px" data-edit-lot="'+b.id+'" title="Edit this lot">'+UI.ic('pencil',13)+'</button></td></tr>'; }).join('')
   +'</tbody></table></div></div></div>'
   +'<div class="c3"><div class="col" style="gap:14px">'+UI.card({title:'FIFO allocation',sub:'Suggested for training reagent assignments',icon:'git-branch',body:'<div id="fifoList"></div>',foot:'<span>Oldest in-date lot first</span>'})
   +UI.card({title:'Expiry health',sub:'Days remaining by lot',icon:'hourglass',body:'<div id="expHealth"></div>'})+'</div></div></div>';
}
function monthlyIssues(){
  const now=new Date(), out=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    out.push({key:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:U.M3[d.getMonth()]});
  }
  return out;
}
function consumptionView(){
  const months=monthlyIssues();
  const db=S.db();
  const items=S.stockOverview();
  const rows=items.map(it=>({
    item:it,
    vals:months.map(m=>U.sum(db.stock.entries.filter(e=>e.cid===it.id&&e.type!=='received'&&String(e.date).slice(0,7)===m.key),e=>e.qty))
  }));
  const max=Math.max.apply(null,rows.map(r=>Math.max.apply(null,r.vals)).concat([1]));
  const heatHTML='<table style="width:100%;border-collapse:separate;border-spacing:3px"><thead><tr><th></th>'+months.map(m=>'<th style="font-family:var(--font-mono);font-size:9px;color:var(--text-faint);font-weight:400">'+m.label+'</th>').join('')+'</tr></thead><tbody>'
   +rows.map(r=>'<tr><td class="xs truncate" style="max-width:150px;color:var(--text-muted);padding-right:6px">'+U.esc(r.item.name)+'</td>'
     +r.vals.map(v=>{ const a=v?0.12+(v/max)*0.8:0.04; return '<td data-tip="'+U.esc(r.item.name+' · '+v+' '+r.item.unit+(v?'':' (no issue logged)'))+'" style="height:26px;border-radius:4px;background:rgba(201,168,76,'+a.toFixed(2)+')"></td>'; }).join('')+'</tr>').join('')
   +'</tbody></table><div class="row between" style="margin-top:10px"><span class="heat-legend">low <i style="background:rgba(201,168,76,.12)"></i><i style="background:rgba(201,168,76,.32)"></i><i style="background:rgba(201,168,76,.55)"></i><i style="background:rgba(201,168,76,.8)"></i> high</span><span class="xs faint">Straight from the distribution log · blank means nothing was issued that month</span></div>';
  const labels=months.map(m=>m.label);
  const issued=months.map(m=>U.sum(db.stock.entries.filter(e=>e.type!=='received'&&String(e.date).slice(0,7)===m.key),e=>e.qty));
  const received=months.map(m=>U.sum(db.stock.entries.filter(e=>e.type==='received'&&String(e.date).slice(0,7)===m.key),e=>e.qty));
  const empty=!db.stock.entries.length;
  return '<div class="grid-12"><div class="c7">'+UI.card({title:'Consumption heatmap',sub:'Per consumable · last 12 months of recorded issues',icon:'layout-grid',
      body:empty?UI.empty({art:'boxes',title:'No consumption recorded yet',body:'The distribution log is empty. Every issue you record with “Receive stock” or a lot movement appears here — nothing is estimated.'}):heatHTML})+'</div>'
   +'<div class="c5">'+UI.card({title:'Issued vs received',sub:'Monthly units from the distribution log',icon:'chart-bar',
      body:empty?'<div class="chart-empty">No movements in this window</div>':'<div id="dualCons"></div>',
      foot:'<span>Bars = issued or used · line = received</span><span class="mono">'+U.fmtNum(U.sum(issued,v=>v))+' issued</span>'})+'</div>'
   +'<div class="c12">'+monthlyCeilingsCard()+'</div>'
   +'<div class="c12">'+UI.card({title:'Burn-rate forecast',sub:'How many days the current stock lasts if the trend continues',icon:'gauge',
      body:'<div id="burnBars" style="margin-top:4px"></div><div class="hint" style="margin-top:12px">Days of cover = stock on hand ÷ daily burn. Burn is a blend of the last 30 days and the last 90 days of recorded issues. A line under 21 days raises a purchase-request suggestion.</div>'})+'</div></div>';
}
/* Monthly ceilings: the department sets how much of each item a month may use,
   and the issue log says what it actually used. */
function monthlyCeilingsCard(){
  const items=S.stockOverview();
  const withCap=items.filter(x=>x.cap);
  return UI.card({title:'Monthly capacity',sub:'Planned ceiling against what the issue log says is used each month',icon:'calendar-range',
    tools:'<span class="pill '+(withCap.length?'gold':'slate')+'">'+withCap.length+' of '+items.length+' ceilings set</span>',
    body:'<div class="dt-scroll"><table class="dt"><thead><tr><th>Consumable</th><th class="num">Used / month</th><th class="num">Ceiling</th><th>Against the ceiling</th><th class="num">Stock covers</th><th></th></tr></thead><tbody>'
      +items.map(x=>{
        const pct=x.cap?Math.round(x.perMonth/x.cap*100):null;
        const tone=pct==null?'slate':pct>100?'rose':pct>85?'amber':'teal';
        return '<tr><td><div class="primary-cell"><b>'+U.esc(x.name)+'</b><small>'+U.esc(x.unit)+(x.perMonth?' · '+x.used30+' issued in the last 30 days':' · nothing issued in 90 days')+'</small></div></td>'
          +'<td class="num mono">'+(x.perMonth||'0')+'</td>'
          +'<td class="num">'+(x.cap?'<span class="mono">'+x.cap+'</span>':'<span class="xs faint">not set</span>')+'</td>'
          +'<td style="min-width:150px">'+(x.cap
            ?'<div class="meter '+tone+'"><i style="width:'+U.clamp(pct,2,100)+'%"></i></div><div class="xs" style="margin-top:3px;color:var(--'+(pct>100?'crit':pct>85?'warn':'text-faint')+')">'+(pct>100?(pct-100)+'% over the monthly ceiling':pct+'% of the ceiling')+'</div>'
            :'<span class="xs faint">Set a ceiling to track it</span>')+'</td>'
          +'<td class="num mono">'+(x.perMonth?(x.monthsLeft==null?'—':x.monthsLeft+' mo'):'<span class="xs faint">no draw</span>')+'</td>'
          +'<td><button class="icon-btn" style="width:26px;height:26px" data-edit-item="'+x.id+'" title="Set the monthly ceiling">'+UI.ic('pencil',13)+'</button></td></tr>';
      }).join('')
      +'</tbody></table></div>'
      +'<div class="hint" style="margin-top:10px">A ceiling is the most the bench expects to use in one month — for example five blood-culture bottles. Usage is measured from the distribution log over the last 90 days and expressed per month; when a line runs past its ceiling the row turns amber, then red.</div>',
    foot:'<span>Ceilings are set per consumable, on the same form as the minimum threshold.</span><span class="mono">'+items.length+' lines</span>'});
}
function suppliersView(){
  const sups=S.db().suppliers; const items=S.stockOverview();
  return '<div class="grid-12 stagger">'+sups.map(s=>{
    const supplied=items.filter(i=>i.supplier===s.id);
    return '<div class="c6"><div class="card pad">'
     +'<div class="row between" style="align-items:flex-start;margin-bottom:12px"><div><div class="card-title">'+U.esc(s.name)+'</div><div class="card-sub">'+U.esc(s.region)+' · '+supplied.length+' lines supplied</div></div>'+C.ring(s.rating,{size:64,stroke:5})+'</div>'
     +'<div class="split-3" style="gap:10px">'+[['Lead time',s.leadDays+'d','clock'],['Fill rate',s.fillRate+'%','package-check'],['Price variance','±'+s.priceVariance+'%','percent']].map(([k,v,ic])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl">'+UI.ic(ic,12)+v+'</span></div>').join('')+'</div>'
     +'<div class="thread" style="margin:14px 0"></div>'
     +'<div class="row between"><span class="xs faint">Scorecard weighted on fill rate &amp; price stability</span><button class="btn xs" data-sup-orders="'+s.id+'">Orders '+UI.ic('arrow-right',12)+'</button></div></div></div>';
  }).join('')+'</div>';
}
function reorderItems(){
  const items=S.stockOverview().filter(x=>x.low||x.daysLeft<25).sort((a,b)=>a.daysLeft-b.daysLeft);
  return '<div style="display:flex;flex-direction:column;gap:10px">'+(items.length?items.slice(0,5).map(x=>'<div><div class="row between"><span class="small truncate">'+U.esc(x.name)+'</span><span class="pill '+(x.low?'rose':'amber')+'">'+Math.min(x.daysLeft,999)+'d</span></div><div class="xs faint" style="margin-top:2px">Order '+Math.max(1,Math.ceil((x.max||x.threshold*3)-x.onHand))+' '+U.esc(x.unit)+' · '+monthLabel(x.perMonth,x)+' used'+(x.cap?' of '+x.cap+' cap':'')+'</div></div>').join(''):'<p class="xs faint">No reorder needed.</p>')+'</div>';
}

/* ——— Actions —————————————————————————— */
function receiveModal(){
  if(!LS.auth.guard('edit')) return;
  const items=S.consumables();
  UI.modal({title:'Receive stock',sub:'Creates a lot and a distribution-log entry. FEFO order recalculates automatically.',
    body:'<div class="form-grid"><div class="field span2"><label>Consumable</label><select class="select" id="rcItem">'+items.map(c=>'<option value="'+c.id+'">'+U.esc(c.name)+' ('+c.unit+')</option>').join('')+'</select></div>'
    +'<div class="field"><label>Quantity</label><input class="input mono" id="rcQty" type="number" min="1" value="20"></div>'
    +'<div class="field"><label>Expiry date</label><input class="input mono" id="rcExp" type="date" value="'+U.addDays(U.todayISO(),365)+'"></div>'
    +'<div class="field"><label>Supplier</label><select class="select" id="rcSup">'+S.db().suppliers.map(s=>'<option value="'+s.id+'">'+U.esc(s.name)+'</option>').join('')+'</select></div>'
    +'<div class="field"><label>Received from (document)</label><input class="input mono" id="rcDoc" placeholder="GRN-2026-0xx"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-receive-save>'+UI.ic('package-check',15)+'Receive &amp; log</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-receive-save]').onclick=()=>{
        const cid=el.querySelector('#rcItem').value, qty=+el.querySelector('#rcQty').value, exp=el.querySelector('#rcExp').value;
        if(!qty||qty<=0) return UI.toast('Quantity must be greater than zero',{type:'warn'});
        const b={id:'lot'+U.uid(''),cid,qty,received:U.todayISO(),expiry:exp,note:'Received '+el.querySelector('#rcDoc').value};
        S.commit(d=>{ d.stock.batches.push(b); d.stock.entries.push({id:U.uid('e'),cid,date:U.todayISO(),type:'received',qty,batch:b.id,expiry:exp,note:'Received · '+el.querySelector('#rcSup').value}); },
          {action:'stock.receive',entity:'stock',entityId:cid,detail:qty+' received · lot '+b.id+' · exp '+exp});
        close(); UI.toast(qty+' units received into stock',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
function purchaseRequest(){
  const items=S.stockOverview().filter(x=>x.low||x.daysLeft<25);
  const body=items.length? '<div class="card" style="overflow:hidden"><table class="dt"><thead><tr><th>Item</th><th>On hand</th><th>Order</th><th>Days of cover</th></tr></thead><tbody>'
    +items.map(x=>{ const qty=Math.max(1,Math.ceil((x.max||x.threshold*3)-x.onHand)); return '<tr><td class="small">'+U.esc(x.name)+'</td><td class="num">'+x.onHand+'</td><td class="num">'+qty+' '+U.esc(x.unit)+'</td><td class="num">'+Math.min(x.daysLeft,999)+'d</td></tr>'; }).join('')
    +'</tbody></table></div><div class="row between" style="margin-top:10px"><span class="hint">Delivery to Ruli DH laboratory · RBC standard lead time 18 days</span><span class="mono strong">'+items.length+' line'+(items.length===1?'':'s')+' to order</span></div>'
    : UI.empty({art:'boxes',title:'No purchase request needed',body:'All consumable lines are above their minimum threshold.'});
  UI.modal({title:'Purchase request',sub:'Generated from burn-rate forecast and minimum thresholds.',width:'min(680px,100%)',body:body,
    foot:'<button class="btn" data-close>Close</button>'+(items.length?'<button class="btn primary" data-print-pr>'+UI.ic('printer',15)+'Print request</button>':''),
    onMount:(el)=>{ const b=el.querySelector('[data-print-pr]'); if(b) b.onclick=()=>{
      const rows='<table><thead><tr><th>#</th><th>Item</th><th>Unit</th><th>On hand</th><th>Order qty</th><th>Days of cover</th></tr></thead><tbody>'
       +items.map((x,i)=>{ const qty=Math.max(1,Math.ceil((x.max||x.threshold*3)-x.onHand)); return '<tr><td>'+(i+1)+'</td><td>'+U.esc(x.name)+'</td><td>'+U.esc(x.unit)+'</td><td>'+x.onHand+'</td><td>'+qty+'</td><td>'+Math.min(x.daysLeft,999)+' days</td></tr>'; }).join('')+'</tbody></table>';
      U.printDoc('Purchase request — consumables',rows,{meta:'<span>Requested by '+U.esc(LS.auth.user.name)+'</span><span>'+items.length+' lines</span>',signatures:true});
      S.audit({action:'stock.purchase_request',entity:'stock',detail:'Purchase request printed · '+items.length+' lines'}); S.save();
    }; }});
}
function lotDrawer(cid){
  const x=S.stockOverview().find(i=>i.id===cid); if(!x) return;
  const entries=S.db().stock.entries.filter(e=>e.cid===cid).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const body='<div class="card pad" style="background:var(--surface-inset);margin-bottom:14px"><div class="row between"><div><div class="eyebrow">On hand</div><div class="serif" style="font-size:2rem;color:var(--text-strong);letter-spacing:-.03em">'+U.fmtNum(x.onHand)+' <span class="xs faint" style="font-family:var(--font-ui);letter-spacing:.06em">'+U.esc(x.unit)+'</span></div></div><div style="text-align:right"><span class="pill '+(x.low?'rose':'teal')+'">'+(x.low?'Below minimum':'Healthy')+'</span><div class="xs faint" style="margin-top:4px">'+x.daysLeft+' days cover at '+x.burn.toFixed(1)+'/day</div></div></div>'
    +'<div class="thread" style="margin:12px 0"></div><div class="split-3">'+[['Daily burn',x.burn.toFixed(2)],['Minimum',x.threshold||0],['Supplier',(S.db().suppliers.find(s=>s.id===x.supplier)||{}).name||'—']].map(([k,v])=>'<div><div class="eyebrow">'+k+'</div><div class="small" style="margin-top:2px">'+U.esc(v)+'</div></div>').join('')+'</div></div>'
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('boxes',14,'ic')+'Lots (FEFO)</div><div class="card-sub">First-expiry-first-out allocation</div></div></div><div class="card-body">'
     +(x.batches.length?x.batches.map(b=>'<div class="list-row"><div class="lr-main"><div class="lr-title mono" style="font-size:11.5px">'+U.esc(b.id.toUpperCase())+'</div><div class="lr-sub">Received '+U.fmtDate(b.received)+' · expires '+U.fmtDate(b.expiry)+'</div></div><div class="lr-val">'+b.qty+' '+U.esc(x.unit)+'</div><button class="btn xs" data-edit-lot2="'+b.id+'">'+UI.ic('pencil',12)+'Edit</button></div>').join(''):'<p class="xs faint">No lots on hand.</p>')
   +'</div></div>'
   +'<div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('history',14,'ic')+'Distribution log</div><div class="card-sub">Who consumed what, from which lot</div></div></div><div class="card-body">'
     +'<div class="dt-scroll" style="max-height:300px"><table class="dt"><thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Destination / note</th></tr></thead><tbody>'
     +entries.map(e=>'<tr><td class="num">'+U.fmtDate(e.date)+'</td><td><span class="pill '+(e.type==='received'?'teal':e.type==='issued'?'blue':'amber')+'">'+U.esc(e.type)+'</span></td><td class="num">'+e.qty+'</td><td class="small">'+U.esc(e.healthCenter||e.note||'—')+'</td></tr>').join('')
     +(entries.length?'':'<tr><td colspan="4" class="xs faint" style="padding:14px">No movements recorded.</td></tr>')+'</tbody></table></div></div></div>';
  UI.drawer({title:x.name,eyebrow:'Consumable',sub:x.unit+' · '+(x.supplier?S.db().suppliers.find(s=>s.id===x.supplier).name:''),body:body,wide:true,
    foot:'<button class="btn danger" data-del-line>'+UI.ic('trash-2',15)+'Delete line</button><button class="btn" data-edit-line>'+UI.ic('pencil',15)+'Edit line</button><button class="btn" data-close>Close</button><button class="btn primary" data-pr>'+UI.ic('file-text',15)+'Purchase request</button>',
    onMount:(panel)=>{ panel.querySelectorAll('[data-pr]').forEach(b=>b.onclick=purchaseRequest);
      panel.querySelectorAll('[data-edit-lot2]').forEach(b=>b.onclick=()=>editLot(b.dataset.editLot2));
      const ed=panel.querySelector('[data-edit-line]'); if(ed) ed.onclick=()=>{ UI.closeAll(); editConsumable(cid); };
      const del=panel.querySelector('[data-del-line]'); if(del) del.onclick=()=>{ UI.closeAll(); deleteLine(cid); }; }});
}
function fifo(){
  const reagents=S.stockOverview().filter(x=>/reagent|cartridge|diluent|VTM|Bottle/i.test(x.name)&&x.batches.length);
  const el=rootEl&&rootEl.querySelector('#fifoList'); if(!el) return;
  el.innerHTML=reagents.slice(0,4).map(x=>{
    const lot=x.batches.slice().sort((a,b)=>String(a.expiry).localeCompare(String(b.expiry)))[0];
    return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(x.name)+'</div><div class="lr-sub">Allocate lot '+U.esc(lot.id.toUpperCase())+' · expires '+U.fmtDate(lot.expiry)+'</div></div><span class="pill '+(U.daysBetween(U.todayISO(),lot.expiry)<30?'amber':'teal')+'">'+U.daysBetween(U.todayISO(),lot.expiry)+'d</span></div>';
  }).join('')||'<p class="xs faint">No reagent lots to allocate.</p>';
}
function paint(){
  if(!rootEl) return;
  const wrap=rootEl.querySelector('#stockBody'); if(!wrap) return;
  wrap.innerHTML=tab==='overview'?overview():tab==='lots'?lotsView():tab==='consumption'?consumptionView():suppliersView();
  wireBody();
}
/* ——— Editing register records ————————————————————————
   Every figure on these screens is editable: a lot can be corrected (quantity,
   expiry, receipt date) and a consumable line can be re-labelled, because a
   register that cannot be corrected just hides its own mistakes. */
function editLot(id){
  if(!LS.auth.guard('edit')) return;
  const b=S.db().stock.batches.find(x=>x.id===id); if(!b) return;
  const c=S.consumable(b.cid)||{name:b.cid,unit:''};
  UI.modal({title:'Edit lot '+String(b.id).toUpperCase(),sub:c.name+' · corrections are written to the audit trail.',width:'min(520px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field"><label>Quantity on hand</label><input class="input mono" id="lotQty" type="number" min="0" value="'+b.qty+'"></div>'
      +'<div class="field"><label>Expiry date</label><input class="input mono" id="lotExp" type="date" value="'+U.esc(b.expiry||'')+'"></div>'
      +'<div class="field"><label>Received on</label><input class="input mono" id="lotRec" type="date" value="'+U.esc(b.received||'')+'"></div>'
      +'<div class="field"><label>Age group</label><input class="input" id="lotAge" value="'+U.esc(b.ageGroup||'')+'" placeholder="Adult / Pediatric"></div>'
      +'<div class="field span2"><label>Note</label><input class="input" id="lotNote" value="'+U.esc(b.note||'')+'"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-lot-save>'+UI.ic('check',15)+'Save lot</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-lot-save]').onclick=()=>{
        const qty=Math.max(0,Math.round(+el.querySelector('#lotQty').value||0));
        const exp=el.querySelector('#lotExp').value, rec=el.querySelector('#lotRec').value;
        if(!exp) return UI.toast('An expiry date is required',{type:'warn'});
        S.commit(d=>{ const x=d.stock.batches.find(y=>y.id===id); if(!x) return;
          x.qty=qty; x.expiry=exp; x.received=rec||x.received; x.ageGroup=el.querySelector('#lotAge').value.trim()||null; x.note=el.querySelector('#lotNote').value.trim();
        },{action:'stock.lot.edit',entity:'stock',entityId:id,detail:c.name+' · lot '+b.id+' → '+qty+' · exp '+exp});
        close(); UI.toast('Lot updated',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
function editConsumable(cid){
  if(!LS.auth.guard('edit')) return;
  const c=S.consumable(cid); if(!c) return;
  UI.modal({title:'Edit '+c.name,sub:'Label, minimum threshold and the monthly ceiling on the stock register.',width:'min(520px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Name</label><input class="input" id="cnName" value="'+U.esc(c.name)+'"></div>'
      +'<div class="field"><label>Unit</label><input class="input" id="cnUnit" value="'+U.esc(c.unit||'')+'"></div>'
      +'<div class="field"><label>Minimum threshold</label><input class="input mono" id="cnMin" type="number" min="0" value="'+(c.threshold||0)+'"></div>'
      +'<div class="field"><label>Monthly ceiling ('+U.esc(c.unit||'units')+'/month)</label><input class="input mono" id="cnCap" type="number" min="0" step="1" value="'+(c.monthlyCap||'')+'" placeholder="e.g. 5"></div>'
      +'<div class="field span2"><div class="xs faint">The ceiling is the most the bench plans to use in a month — five blood-culture bottles, for example. Leave it blank if no ceiling applies.</div></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cn-save>'+UI.ic('check',15)+'Save</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-cn-save]').onclick=()=>{
        const name=el.querySelector('#cnName').value.trim(); if(!name) return UI.toast('A name is required',{type:'warn'});
        S.commit(d=>{ const x=(d.catalog.consumables||[]).find(y=>y.id===cid); if(!x) return;
          x.name=name; x.unit=el.querySelector('#cnUnit').value.trim()||x.unit; x.threshold=Math.max(0,+el.querySelector('#cnMin').value||0);
          const cap=+el.querySelector('#cnCap').value; x.monthlyCap=cap>0?cap:null;
        },{action:'stock.item.edit',entity:'catalog',entityId:cid,detail:name});
        close(); UI.toast('Consumable updated',{type:'ok'}); LS.shell.refresh();
      };
    }});
}
function deleteLine(cid){
  const c=S.consumable(cid); if(!c) return;
  const lots=S.db().stock.batches.filter(b=>b.cid===cid).length;
  const moves=S.db().stock.entries.filter(e=>e.cid===cid).length;
  UI.confirm({
    title:'Delete this consumable?',
    body:'<p class="small">You are about to remove <b>'+U.esc(c.name)+'</b> from the stock register.</p>'
      +'<p class="xs faint" style="margin-top:8px">'+lots+' lot record(s) and '+moves+' distribution-log movement(s) stay in the audit trail. The line stops appearing in stock, reorder and purchase-request views, and can be restored from Archived lines.</p>',
    confirm:'Delete line', cancel:'Keep it', danger:true
  }).then(ok=>{
    if(!ok) return;
    S.deleteConsumable(cid,'Deleted by '+LS.auth.user.name+' from the stock register');
    UI.toast(c.name+' deleted — restore it from Archived lines',{type:'warn'});
    LS.shell.refresh();
  });
}

function wireBody(){
  const r=rootEl;
  if(tab==='overview'){
    const search=r.querySelector('#stkSearch');
    if(search) search.addEventListener('input',()=>{ const q=search.value.toLowerCase(); r.querySelectorAll('#stkTable tbody tr').forEach(tr=>{ tr.style.display=tr.textContent.toLowerCase().indexOf(q)>=0?'':'none'; }); });
    const el=r.querySelector('#reorderList'); if(el) el.innerHTML=reorderItems();
    r.querySelectorAll('[data-item]').forEach(tr=>tr.onclick=e=>{ if(e.target.closest('button')) return; lotDrawer(tr.dataset.item); });
    r.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); lotDrawer(b.dataset.open); });
    r.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); deleteLine(b.dataset.del); });
    r.querySelectorAll('[data-edit-item]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); editConsumable(b.dataset.editItem); });
    r.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{ S.restoreConsumable(b.dataset.restore); UI.toast('Consumable restored',{type:'ok'}); LS.shell.refresh(); });
  }
  if(tab==='lots'){
    fifo();
    const eh=r.querySelector('#expHealth'); if(eh){
      const lots=S.db().stock.batches.slice().sort((a,b)=>U.daysBetween(U.todayISO(),a.expiry)-U.daysBetween(U.todayISO(),b.expiry)).slice(0,8);
      eh.innerHTML=lots.map(b=>{ const d=U.daysBetween(U.todayISO(),b.expiry); const c=S.consumable(b.cid)||{name:b.cid};
        return '<div style="margin-bottom:8px"><div class="row between"><span class="xs truncate" style="max-width:150px">'+U.esc(c.name)+'</span><span class="mono xs" style="color:'+(d<30?'var(--warn)':'var(--text-faint)')+'">'+d+'d</span></div>'+UI.meter(U.clamp(d/365*100,2,100),d<0?'rose':d<30?'amber':'teal')+'</div>'; }).join('');
    }
    r.querySelectorAll('[data-lot]').forEach(tr=>tr.onclick=e=>{ if(e.target.closest('button')) return; const b=S.db().stock.batches.find(x=>x.id===tr.dataset.lot); if(b) lotDrawer(b.cid); });
    r.querySelectorAll('[data-edit-lot]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); editLot(b.dataset.editLot); });
  }
  if(tab==='consumption'){
    const months=monthlyIssues();
    const db=S.db();
    const labels=months.map(m=>m.label);
    const issued=months.map(m=>U.sum(db.stock.entries.filter(e=>e.type!=='received'&&String(e.date).slice(0,7)===m.key),e=>e.qty));
    const received=months.map(m=>U.sum(db.stock.entries.filter(e=>e.type==='received'&&String(e.date).slice(0,7)===m.key),e=>e.qty));
    const dualEl=r.querySelector('#dualCons');
    if(dualEl && db.stock.entries.length) C.dual(dualEl,{labels,bars:issued,line:received,height:250});
    const trend=S.stockTrend().filter(x=>x.daysLeft!=null);
    C.hbars(r.querySelector('#burnBars'),{items:trend.slice(0,9).map(x=>({label:x.name,value:Math.min(x.daysLeft,180),display:Math.min(x.daysLeft,999)+'d',tone:x.daysLeft<14?'rose':x.daysLeft<30?'amber':'teal',target:21})),limit:9});
    const none=r.querySelector('#burnBars');
    if(none && !trend.length) none.innerHTML='<div class="chart-empty">No issues recorded yet, so days of cover cannot be projected</div>';
  }
  r.querySelectorAll('[data-edit-item]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); editConsumable(b.dataset.editItem); });
  r.querySelectorAll('[data-receive]').forEach(b=>b.onclick=receiveModal);
  r.querySelectorAll('[data-pr]').forEach(b=>b.onclick=purchaseRequest);
  /* The tab buttons carry data-stk-tab; the old handler listened for a different
     attribute, so only the overview ever rendered. */
  r.querySelectorAll('[data-stk-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.stkTab; paint(); syncTabs(); });
  r.querySelectorAll('[data-sup-orders]').forEach(b=>b.onclick=()=>{ const sup=S.db().suppliers.find(s=>s.id===b.dataset.supOrders); UI.drawer({title:sup.name,eyebrow:'Supplier scorecard',body:'<div class="split-2">'+[['Lead time',sup.leadDays+' days'],['Fill rate',sup.fillRate+'%'],['Price variance','±'+sup.priceVariance+'%'],['Region',sup.region]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl">'+U.esc(v)+'</span></div>').join('')+'</div><div class="section-head"><h2>Recent orders</h2></div>'+UI.empty({art:'boxes',title:'No open orders',body:'Purchase requests raised from this console appear here with their GRN references.'}),foot:'<button class="btn" data-close>Close</button>'}); });
}
function syncTabs(){ U.$$('[data-stk-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.stkTab===tab)); }
M.render=function(root,params){
  rootEl=root; tab=params.tab||'overview';
  root.innerHTML='<div class="page-head"><div><h1>Stock &amp; supplies</h1><div class="sub">Commodity security with a trading-desk read: expiry health, burn-rate forecasts, lot traceability and supplier performance.</div></div>'
   +'<div class="actions"><button class="btn" data-export>'+UI.ic('download',15)+' Export</button><button class="btn" data-receive>'+UI.ic('plus',15)+' Receive</button><button class="btn primary" data-pr>'+UI.ic('file-text',15)+' Purchase request</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['overview','Overview'],['lots','Lots &amp; expiry'],['consumption','Consumption'],['suppliers','Suppliers']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-stk-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="stockBody"></div>';
  paint(); syncTabs();
  root.querySelector('[data-export]').onclick=()=>{
    const items=S.stockOverview();
    const trend={}; S.stockTrend().forEach(t=>trend[t.id]=t);
    const rows=[['Consumable','Unit','On hand','Min','Burn/day','Days cover','Projected stock-out','Consumption trend %','Last issue','Nearest expiry','Supplier']]
      .concat(items.map(x=>{ const t=trend[x.id]||{}; return [x.name,x.unit,x.onHand,x.threshold,(t.burn||x.burn).toFixed(2),t.daysLeft==null?'':t.daysLeft,t.stockOut||'',t.trend==null?'':t.trend,t.lastIssue||'',x.nearest?x.nearest.expiry:'',(S.db().suppliers.find(s=>s.id===x.supplier)||{}).name||'']; }));
    U.exportCSV('stock-register-'+U.todayISO()+'.csv',rows,{title:'Stock & supply register',actor:LS.auth.user.name});
    UI.toast('Stock register exported',{type:'ok'});
  };
  if(params.item) setTimeout(()=>lotDrawer(params.item),100);
};
})();
