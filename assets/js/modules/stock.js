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
function itemRow(x){
  const days=x.daysLeft;
  const tone=x.low?'rose':days<21?'amber':'teal';
  const expiry=x.nearest?U.daysBetween(U.todayISO(),x.nearest.expiry):null;
  const expTone=expiry==null?'slate':expiry<=0?'rose':expiry<=30?'amber':'teal';
  return '<tr data-item="'+x.id+'">'
   +'<td><div class="primary-cell"><b>'+U.esc(x.name)+'</b><small>'+U.esc(x.unit)+(x.coldChain?' · cold chain 2–8 °C':'')+'</small></div></td>'
   +'<td class="num">'+U.fmtNum(x.onHand)+'</td>'
   +'<td class="num hide-sm">'+U.fmtNum(x.threshold||0)+'</td>'
   +'<td style="width:130px"><div class="meter '+tone+'"><i style="width:'+U.clamp(x.onHand/Math.max(1,(x.max||x.threshold*3))*100,2,100)+'%"></i></div><div class="xs faint" style="margin-top:3px">'+x.burn.toFixed(1)+'/day</div></td>'
   +'<td><span class="mono small" style="color:'+(days<14?'var(--crit)':days<30?'var(--warn)':'var(--text)')+'">'+Math.min(days,999)+'d</span></td>'
   +'<td>'+(expiry!=null?'<span class="pill '+expTone+' mono">'+expiry+'d</span>':'<span class="xs faint">—</span>')+'</td>'
   +'<td class="num hide-sm">'+(x.daysLeft==null?'<span class="xs faint">—</span>':x.daysLeft+'d')+'</td>'
   +'<td style="width:64px;white-space:nowrap">'
   +'<button class="icon-btn row-actions" style="width:26px;height:26px" data-open="'+x.id+'" title="Open lot ledger">'+UI.ic('chevron-right',14)+'</button>'
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
     +coldCard()+supplierMini()
   +'</div></div></div>';
}
function coldCard(){
  const cc=S.db().coldChain||[];
  const last=cc[0];
  return UI.card({title:'Cold chain',sub:'2–8 °C · excursion history',icon:'thermometer',
    tools:'<button class="btn xs" data-cold-log>'+UI.ic('plus',12)+'Log temp</button>',
    body:'<div class="row between" style="padding:10px 12px;border-radius:9px;background:'+(last.temp>last.max?'var(--crit-soft)':'var(--pos-soft)')+';border:1px solid '+(last.temp>last.max?'var(--crit-border)':'var(--pos-border)')+';margin-bottom:10px">'
      +'<div><div class="eyebrow">Blood bank fridge</div><div class="serif" style="font-size:1.45rem;color:'+(last.temp>last.max?'var(--crit)':'var(--pos)')+'">'+last.temp+' °C</div></div>'
      +'<div style="text-align:right"><span class="pill '+(last.temp>last.max?'rose':'teal')+'">'+(last.temp>last.max?'Excursion':'In range')+'</span><div class="xs faint" style="margin-top:4px">'+U.relTime(last.at)+'</div></div></div>'
      +cc.slice(0,4).map(c=>'<div class="list-row"><div class="fic" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:'+(c.temp>c.max?'var(--crit)':'var(--text-faint)')+'">'+UI.ic(c.temp>c.max?'alert-triangle':'thermometer',12)+'</div><div class="lr-main"><div class="lr-title" style="font-size:11.5px">'+U.esc(c.device)+'</div><div class="lr-sub">'+c.temp+' °C on '+U.fmtDate(String(c.at).slice(0,10))+(c.duration?' · '+c.duration+' min':'')+'</div></div></div>').join('')});
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
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Lot / batch</th><th>Consumable</th><th>Qty</th><th>Received</th><th>Expiry</th><th>Status</th><th>Age</th></tr></thead><tbody>'
   +rows.map(b=>{ const c=S.consumable(b.cid)||{name:b.cid,unit:''}; const d=U.daysBetween(U.todayISO(),b.expiry);
      return '<tr data-lot="'+b.id+'"><td class="mono small">'+U.esc(b.id.toUpperCase())+'</td><td>'+U.esc(c.name)+(b.ageGroup?' <span class="pill slate">'+U.esc(b.ageGroup)+'</span>':'')+'</td><td class="num">'+b.qty+' <span class="faint">'+U.esc(c.unit||'')+'</span></td><td class="num">'+U.fmtDate(b.received)+'</td><td class="num">'+U.fmtDate(b.expiry)+'</td><td><span class="pill '+(d<0?'rose':d<=30?'amber':'teal')+'">'+(d<0?'expired':d<=30?'≤30d':'in date')+'</span></td><td class="num">'+U.daysBetween(b.received,U.todayISO())+'d</td></tr>'; }).join('')
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
   +'<div class="c12">'+UI.card({title:'Burn-rate forecast',sub:'How many days the current stock lasts if the trend continues',icon:'gauge',
      body:'<div id="burnBars" style="margin-top:4px"></div><div class="hint" style="margin-top:12px">Days of cover = stock on hand ÷ daily burn. Burn is a blend of the last 30 days and the last 90 days of recorded issues. A line under 21 days raises a purchase-request suggestion.</div>'})+'</div></div>';
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
  return '<div style="display:flex;flex-direction:column;gap:10px">'+(items.length?items.slice(0,5).map(x=>'<div><div class="row between"><span class="small truncate">'+U.esc(x.name)+'</span><span class="pill '+(x.low?'rose':'amber')+'">'+Math.min(x.daysLeft,999)+'d</span></div><div class="xs faint" style="margin-top:2px">Order '+Math.max(1,Math.ceil((x.max||x.threshold*3)-x.onHand))+' '+U.esc(x.unit)+' · '+x.burn.toFixed(1)+'/day used</div></div>').join(''):'<p class="xs faint">No reorder needed.</p>')+'</div>';
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
   +(x.coldChain?'<div class="row gap-sm" style="margin-bottom:14px"><span class="pill teal">'+UI.ic('thermometer',11)+'Cold chain '+(x.minTemp||2)+'–'+(x.maxTemp||8)+' °C</span><span class="pill slate">Excursion log retained</span></div>':'')
   +'<div class="card" style="margin-bottom:14px"><div class="card-head"><div><div class="card-title">'+UI.ic('boxes',14,'ic')+'Lots (FEFO)</div><div class="card-sub">First-expiry-first-out allocation</div></div></div><div class="card-body">'
     +(x.batches.length?x.batches.map(b=>'<div class="list-row"><div class="lr-main"><div class="lr-title mono" style="font-size:11.5px">'+U.esc(b.id.toUpperCase())+'</div><div class="lr-sub">Received '+U.fmtDate(b.received)+' · expires '+U.fmtDate(b.expiry)+'</div></div><div class="lr-val">'+b.qty+' '+U.esc(x.unit)+'</div></div>').join(''):'<p class="xs faint">No lots on hand.</p>')
   +'</div></div>'
   +'<div class="card"><div class="card-head"><div><div class="card-title">'+UI.ic('history',14,'ic')+'Distribution log</div><div class="card-sub">Who consumed what, from which lot</div></div></div><div class="card-body">'
     +'<div class="dt-scroll" style="max-height:300px"><table class="dt"><thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Destination / note</th></tr></thead><tbody>'
     +entries.map(e=>'<tr><td class="num">'+U.fmtDate(e.date)+'</td><td><span class="pill '+(e.type==='received'?'teal':e.type==='issued'?'blue':'amber')+'">'+U.esc(e.type)+'</span></td><td class="num">'+e.qty+'</td><td class="small">'+U.esc(e.healthCenter||e.note||'—')+'</td></tr>').join('')
     +(entries.length?'':'<tr><td colspan="4" class="xs faint" style="padding:14px">No movements recorded.</td></tr>')+'</tbody></table></div></div></div>';
  UI.drawer({title:x.name,eyebrow:'Consumable',sub:x.unit+' · '+(x.supplier?S.db().suppliers.find(s=>s.id===x.supplier).name:''),body:body,wide:true,
    foot:'<button class="btn danger" data-del-line>'+UI.ic('trash-2',15)+'Delete line</button><button class="btn" data-close>Close</button><button class="btn primary" data-pr>'+UI.ic('file-text',15)+'Purchase request</button>',
    onMount:(panel)=>{ panel.querySelectorAll('[data-pr]').forEach(b=>b.onclick=purchaseRequest);
      const del=panel.querySelector('[data-del-line]'); if(del) del.onclick=()=>{ UI.closeAll(); deleteLine(cid); }; }});
}
function coldLog(){
  UI.modal({title:'Log cold-chain temperature',sub:'Every reading is appended to the excursion register.',
    body:'<div class="form-grid"><div class="field span2"><label>Device</label><select class="select" id="ccDev"><option>Blood Bank Fridge</option><option>Chemistry Reagent Fridge</option><option>VTM Cold Box</option></select></div>'
     +'<div class="field"><label>Temperature (°C)</label><input class="input mono" id="ccTemp" type="number" step="0.1" value="6.2"></div>'
     +'<div class="field"><label>Action taken</label><input class="input" id="ccAct" placeholder="In range / door closed…"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-cc-save>Log reading</button>',
    onMount:(el,close)=>{ el.querySelector('[data-cc-save]').onclick=()=>{
      const dev=el.querySelector('#ccDev').value, temp=parseFloat(el.querySelector('#ccTemp').value), act=el.querySelector('#ccAct').value;
      S.commit(d=>{ d.coldChain.unshift({id:U.uid('cc'),at:U.nowISO(),device:dev,temp,min:2,max:8,duration:temp>8?15:0,action:act||(temp>8?'Excursion — action required':'In range'),actor:LS.auth.user.name}); },{action:'coldchain.log',entity:'stock',detail:dev+' · '+temp+' °C'});
      close(); UI.toast(temp>8?'Excursion logged — CAPA suggested':'Reading logged',{type:temp>8?'warn':'ok'}); LS.shell.refresh();
    }; }});
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
    r.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{ S.restoreConsumable(b.dataset.restore); UI.toast('Consumable restored',{type:'ok'}); LS.shell.refresh(); });
  }
  if(tab==='lots'){
    fifo();
    const eh=r.querySelector('#expHealth'); if(eh){
      const lots=S.db().stock.batches.slice().sort((a,b)=>U.daysBetween(U.todayISO(),a.expiry)-U.daysBetween(U.todayISO(),b.expiry)).slice(0,8);
      eh.innerHTML=lots.map(b=>{ const d=U.daysBetween(U.todayISO(),b.expiry); const c=S.consumable(b.cid)||{name:b.cid};
        return '<div style="margin-bottom:8px"><div class="row between"><span class="xs truncate" style="max-width:150px">'+U.esc(c.name)+'</span><span class="mono xs" style="color:'+(d<30?'var(--warn)':'var(--text-faint)')+'">'+d+'d</span></div>'+UI.meter(U.clamp(d/365*100,2,100),d<0?'rose':d<30?'amber':'teal')+'</div>'; }).join('');
    }
    r.querySelectorAll('[data-lot]').forEach(tr=>tr.onclick=()=>{ const b=S.db().stock.batches.find(x=>x.id===tr.dataset.lot); if(b) lotDrawer(b.cid); });
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
  r.querySelectorAll('[data-receive]').forEach(b=>b.onclick=receiveModal);
  r.querySelectorAll('[data-pr]').forEach(b=>b.onclick=purchaseRequest);
  r.querySelectorAll('[data-cold-log]').forEach(b=>b.onclick=coldLog);
  r.querySelectorAll('[data-tab-stock]').forEach(b=>b.onclick=()=>{ tab=b.dataset.tabStock; paint(); syncTabs(); });
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
    const rows=[['Consumable','Unit','On hand','Min','Burn/day','Days cover','Projected stock-out','Consumption trend %','Last issue','Nearest expiry','Supplier','Cold chain']]
      .concat(items.map(x=>{ const t=trend[x.id]||{}; return [x.name,x.unit,x.onHand,x.threshold,(t.burn||x.burn).toFixed(2),t.daysLeft==null?'':t.daysLeft,t.stockOut||'',t.trend==null?'':t.trend,t.lastIssue||'',x.nearest?x.nearest.expiry:'',(S.db().suppliers.find(s=>s.id===x.supplier)||{}).name||'',x.coldChain?'2–8 °C':'ambient']; }));
    U.exportCSV('stock-register-'+U.todayISO()+'.csv',rows,{title:'Stock & supply register',actor:LS.auth.user.name});
    UI.toast('Stock register exported',{type:'ok'});
  };
  if(params.item) setTimeout(()=>lotDrawer(params.item),100);
};
})();
