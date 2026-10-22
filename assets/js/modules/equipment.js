/* ============================================================================
   MODULE · EQUIPMENT & FACILITIES — uptime, preventive + curative maintenance,
   supplier response time, off-site repair, backup analyser pool, cold chain
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.equipment=M;
let rootEl=null, tab='fleet';
const STATUS={
  operational:['Operational','teal'],
  standby:['Standby · backup','slate'],
  deployed:['Deployed as backup','teal'],
  maintenance:['In maintenance','amber'],
  warning:['Attention','amber'],
  offsite:['Off-site repair','rose'],
  offline:['Offline','rose'],
  retired:['Retired','slate']
};
const TYPES_P=['PM','Calibration','Installation','Verification'];
const TYPES_C=['Repair','Breakdown','Supplier intervention','Incident'];
const KIND_LABEL={preventive:'Preventive',curative:'Curative'};

/* ---------------------------------------------------------------- helpers */
function num(v,d){ const n=Number(v); return isNaN(n)?(d==null?0:d):n; }
function pad(n){ return String(n).padStart(2,'0'); }
function parseDT(v){
  if(!v) return null;
  const s=String(v);
  const t=Date.parse(s.length<=10? s+'T08:00:00' : s);
  return isNaN(t)?null:t;
}
function hBetween(a,b){
  const x=parseDT(a), y=parseDT(b);
  if(x==null||y==null) return null;
  return Math.max(0, Math.round((y-x)/36e5*10)/10);
}
const M3=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDT(v){
  const t=parseDT(v); if(t==null) return '—';
  const d=new Date(t);
  return d.getDate()+' '+M3[d.getMonth()]+' · '+pad(d.getHours())+':'+pad(d.getMinutes());
}
function fmtDay(v){ return v?U.fmtDate(String(v).slice(0,10)):'—'; }
function hm(h){
  if(h==null||isNaN(h)) return '—';
  if(h<1) return Math.round(h*60)+' min';
  if(h<48) return (Math.round(h*10)/10)+' h';
  return (Math.round(h/24*10)/10)+' d';
}
function nowLocalInput(){ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()); }

/* ------------------------------------------------------------- event model */
function kindOf(ev){ return ev.kind || (/repair|breakdown|incident|fault|supplier/i.test(ev.type||'')?'curative':'preventive'); }
function events(e){
  const list=[];
  (e.services||[]).forEach(s=>list.push(s));
  (e.downtime||[]).forEach(d=>{
    if(!list.some(x=>x.date===d.date && x.type===d.type && x.note===d.note))
      list.push({date:d.date,type:d.type||'Event',by:d.by||'',note:d.note||'',hours:d.hours||0,legacy:true});
  });
  list.forEach(s=>{ s.kind=kindOf(s); });
  return list.sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.emailAt||'').localeCompare(String(a.emailAt||'')));
}
function preventive(e){ return events(e).filter(x=>x.kind==='preventive'); }
function curative(e){ return events(e).filter(x=>x.kind==='curative'); }
function lastService(e){
  const h=preventive(e).filter(x=>x.type!=='Installation'&&x.type!=='Verification');
  return h[0]||preventive(e)[0]||null;
}
function overdue(e){ return !!(e.nextPM && e.nextPM<U.todayISO()); }
function daysToPM(e){ return e.nextPM?U.daysBetween(U.todayISO(),e.nextPM):null; }

function openCase(e){ return events(e).find(ev=>ev.shippedOn && !ev.returnedOn) || null; }
function evDowntime(ev){
  if(ev.shippedOn){
    const s=new Date(ev.shippedOn+'T08:00:00').getTime();
    const en=ev.returnedOn? new Date(ev.returnedOn+'T17:00:00').getTime() : Date.now();
    return Math.max(num(ev.hours), Math.max(0,(en-s)/36e5));
  }
  return num(ev.hours);
}
function downtimeIn(e,days,curativeOnly){
  const from=Date.now()-days*864e5;
  let h=0;
  events(e).forEach(ev=>{
    if(curativeOnly && ev.kind!=='curative') return;
    if(ev.shippedOn){
      const s=new Date(ev.shippedOn+'T08:00:00').getTime();
      const en=ev.returnedOn? new Date(ev.returnedOn+'T17:00:00').getTime() : Date.now();
      const os=Math.max(s,from), oe=Math.min(en,Date.now());
      if(oe>os) h+=(oe-os)/36e5;
    }else{
      const t=parseDT(ev.date);
      if(t!=null && t>=from) h+=num(ev.hours);
    }
  });
  return h;
}
function uptimeOf(e){
  const base=(e.uptime==null?100:num(e.uptime,100));
  const dt=downtimeIn(e,30,false);
  if(!dt) return base;
  return Math.max(0,Math.min(base, Math.round((100-dt/720*100)*10)/10));
}
function responseOf(ev){ return ev.responseH!=null? num(ev.responseH) : hBetween(ev.emailAt,ev.interventionAt); }
function responseStats(list){
  const vals=list.map(responseOf).filter(x=>x!=null).sort((a,b)=>a-b);
  if(!vals.length) return null;
  const sum=vals.reduce((a,b)=>a+b,0);
  const median=vals.length%2?vals[(vals.length-1)/2]:(vals[vals.length/2-1]+vals[vals.length/2])/2;
  return {n:vals.length, avg:Math.round(sum/vals.length*10)/10, median, best:vals[0], worst:vals[vals.length-1]};
}
function allCurative(){
  const out=[];
  S.db().equipment.forEach(e=>curative(e).forEach(ev=>out.push({e,ev})));
  return out.sort((a,b)=>String(b.ev.date).localeCompare(String(a.ev.date)));
}
function primaries(){ return S.db().equipment.filter(e=>e.role!=='backup'); }
function backups(){ return S.db().equipment.filter(e=>e.role==='backup'); }
function fleetStats(){
  const list=primaries();
  const op=list.filter(e=>e.status==='operational').length;
  const d30=list.reduce((a,e)=>a+downtimeIn(e,30,false),0);
  const unplanned=list.reduce((a,e)=>a+downtimeIn(e,30,true),0);
  const open=list.filter(openCase).length;
  return {total:list.length, operational:op,
    uptime:+(U.avg(list.map(uptimeOf))||0).toFixed(1),
    due:list.filter(e=>{ const d=daysToPM(e); return d!=null&&d<=30; }).length,
    overdue:list.filter(overdue).length,
    offline:list.filter(e=>e.status==='offline'||e.status==='offsite').length,
    downtime30:+d30.toFixed(1), unplanned30:+unplanned.toFixed(1), open,
    response:responseStats(allCurative().map(x=>x.ev)),
    awaiting:allCurative().filter(x=>x.ev.emailAt&&!x.ev.interventionAt).length};
}
function applyPM(e){
  const prev=preventive(e).filter(x=>x.type!=='Installation');
  if(!prev.length) return;
  const latest=prev.map(x=>x.date).sort().pop();
  e.pmIntervalDays=e.pmIntervalDays||180;
  if(latest){
    if(!e.lastPM||latest>String(e.lastPM).slice(0,10)) e.lastPM=latest;
    const candidate=U.addDays(latest,e.pmIntervalDays);
    // Additive history: the service clock only ever moves forward.
    if(!e.nextPM||candidate>e.nextPM) e.nextPM=candidate;
  }
}

/* ------------------------------------------------------------------- KPI bar */
function kpis(){
  const f=fleetStats();
  const r=f.response;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Fleet uptime',value:f.uptime,dec:1,unit:'%',icon:'activity',formatted:''+f.uptime,
      note:f.operational+' of '+f.total+' analysers online',spark:C.spark([94,95,96,95,97,96,98,f.uptime],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'PM due ≤ 30 days',value:f.due,icon:'wrench',formatted:''+f.due,
      note:f.overdue?f.overdue+' already overdue':'On schedule',spark:C.spark([1,2,2,3,2,3,2,f.due],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Unplanned downtime',value:f.unplanned30,dec:1,unit:'h',icon:'timer',formatted:''+f.unplanned30,
      note:f.open? f.open+' off-site case'+((f.open===1)?'':'s')+' still accruing' : (f.unplanned30? 'Rolling 30 days · curative cases' : 'No downtime logged yet')})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Supplier response',value:r?r.avg:0,dec:1,unit:'h',icon:'mail',formatted:r?(''+r.avg):'—',
      note:r? 'Median '+hm(r.median)+' · '+r.n+' case'+(r.n===1?'':'s')+(f.awaiting?' · '+f.awaiting+' awaiting':'') : 'No supplier emails logged yet'})+'</div>'
   +'</div>';
}

/* ---------------------------------------------------------------- fleet view */
function fleetCard(e){
  const st=STATUS[e.status]||['Unknown','slate'];
  const d=daysToPM(e); const late=overdue(e);
  const oc=openCase(e); const up=uptimeOf(e);
  const dt=downtimeIn(e,30,true);
  return '<div class="c4"><div class="card hover pad" data-eq="'+e.id+'" style="cursor:pointer">'
    +'<div class="row between" style="align-items:flex-start;margin-bottom:9px"><div style="min-width:0"><div class="card-title truncate">'+U.esc(e.name)+'</div><div class="card-sub truncate">'+U.esc(e.model)+' · '+U.esc(e.location)+'</div></div><span class="pill '+st[1]+'"><span class="dot'+(e.status==='operational'?' live':'')+'"></span>'+st[0]+'</span></div>'
    +'<div class="row between" style="margin-bottom:5px"><span class="xs faint">Uptime (30 d)</span><span class="mono small" style="color:var(--'+(up>=95?'pos':up>=85?'gold-bright':'crit')+')">'+up+'%</span></div>'
    +UI.meter(up,up>=95?'teal':up>=85?'gold':'rose')
    +(oc? '<div class="hint" style="margin-top:9px;color:var(--rose)">'+UI.ic('truck',12)+' Off site since '+U.fmtDateShort(oc.shippedOn)+' · '+hm(evDowntime(oc))+' downtime'+'</div>':'')
    +'<div class="thread" style="margin:12px 0 10px"></div>'
    +'<div class="row between"><span class="xs faint">Next PM</span><span class="xs '+(late?'':'muted')+'" style="'+(late?'color:var(--crit)':'')+'">'+(e.nextPM? U.fmtDate(e.nextPM)+(late?' · overdue':' · in '+d+'d') : 'Not scheduled')+'</span></div>'
    +'<div class="row between" style="margin-top:4px"><span class="xs faint mono">'+U.esc(e.serial)+'</span><span class="xs faint">'+(dt?'downtime '+hm(dt):U.esc(e.manufacturer||''))+'</span></div></div></div>';
}
function fleet(){
  return '<div class="grid-12 stagger">'+primaries().map(fleetCard).join('')+'</div>';
}

/* ------------------------------------------------------------ preventive tab */
function pmView(){
  const list=primaries();
  return '<div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('wrench',14,'ic')+'Preventive maintenance plan</div><div class="card-sub">Manufacturer schedule · last service and next due</div></div><span class="grow"></span><button class="btn sm" data-backfill>'+UI.ic('history',13)+'Previous history</button><button class="btn sm" data-logpm>'+UI.ic('plus',13)+'Record service</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Analyser</th><th>Serial</th><th>Last service</th><th>Next PM</th><th>Window</th><th>Uptime</th><th>Status</th><th></th></tr></thead><tbody>'
   +list.map(e=>{ const d=daysToPM(e); const late=overdue(e);
      return '<tr><td><div class="primary-cell"><b>'+U.esc(e.name)+'</b><small>'+U.esc(e.model)+'</small></div></td><td class="mono xs">'+U.esc(e.serial)+'</td>'
      +'<td class="num">'+U.fmtDate(e.lastPM)+'</td><td class="num" style="color:'+(late?'var(--crit)':'')+'">'+U.fmtDate(e.nextPM)+'</td>'
      +'<td>'+(late?'<span class="pill rose">'+Math.abs(d)+'d overdue</span>':d<=30?'<span class="pill amber">in '+d+'d</span>':'<span class="pill slate">in '+d+'d</span>')+'</td>'
      +'<td class="mono small">'+uptimeOf(e)+'%</td><td><span class="pill '+(STATUS[e.status]||['','slate'])[1]+'">'+(STATUS[e.status]||['—'])[0]+'</span></td>'
      +'<td><div class="row" style="gap:2px"><button class="icon-btn" style="width:26px;height:26px" data-editeq="'+e.id+'" aria-label="Edit equipment">'+UI.ic('pencil',13)+'</button><button class="icon-btn" style="width:26px;height:26px" data-eqrow="'+e.id+'">'+UI.ic('chevron-right',14)+'</button></div></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>PM completion is an ISO 15189 clause 6.4 requirement</span><span class="mono">'+list.length+' assets</span></div></div>';
}

/* -------------------------------------------------------------- curative tab */
function curativeView(){
  const rows=allCurative();
  const r=responseStats(rows.map(x=>x.ev));
  const open=rows.filter(x=>x.ev.shippedOn&&!x.ev.returnedOn);
  const awaiting=rows.filter(x=>x.ev.emailAt&&!x.ev.interventionAt);
  const body=rows.length? '<div class="dt-scroll"><table class="dt"><thead><tr><th>Analyser</th><th>Case</th><th>Email to supplier</th><th>Intervened</th><th>Response</th><th>Site</th><th>Downtime</th><th>Backup</th><th>Status</th></tr></thead><tbody>'
    +rows.map(({e,ev})=>{
      const resp=responseOf(ev);
      const oc=ev.shippedOn&&!ev.returnedOn;
      const bk=ev.backupId? S.db().equipment.find(x=>x.id===ev.backupId) : null;
      return '<tr><td><div class="primary-cell"><b>'+U.esc(e.name)+'</b><small>'+U.esc(ev.type||'')+'</small></div></td>'
        +'<td class="num">'+U.fmtDate(ev.date)+'</td>'
        +'<td class="num">'+(ev.emailAt? fmtDT(ev.emailAt):'<span class="faint">not logged</span>')+'</td>'
        +'<td class="num">'+(ev.interventionAt? fmtDT(ev.interventionAt):(ev.emailAt?'<span class="pill amber">awaiting</span>':'—'))+'</td>'
        +'<td class="num mono">'+(resp!=null? hm(resp):'—')+'</td>'
        +'<td>'+(ev.offsite||oc? '<span class="pill rose">Off site</span>':'<span class="pill slate">On site</span>')+'</td>'
        +'<td class="num mono">'+hm(evDowntime(ev))+'</td>'
        +'<td>'+(bk? '<span class="xs">'+U.esc(bk.name)+'</span>':'<span class="faint">—</span>')+'</td>'
        +'<td>'+(oc? '<span class="pill rose"><span class="dot live"></span>open</span>':'<span class="pill teal">closed</span>')+'</td></tr>';
    }).join('')+'</tbody></table></div>'
    : UI.empty({title:'No curative maintenance recorded yet',body:'Log a breakdown, a supplier call-out or an off-site repair. Records entered here build the supplier response-time and downtime KPIs above.',action:'<button class="btn primary" data-logcur>'+UI.ic('plus',15)+' Log a curative case</button>'});
  const summary='<div class="grid-12" style="margin-bottom:14px">'
    +'<div class="c4">'+UI.card({title:'Supplier response speed',sub:'Email sent → supplier intervention',icon:'mail',body:
        (r? '<div class="split-3">'+[['Mean',hm(r.avg)],['Median',hm(r.median)],['Cases',String(r.n)]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl">'+v+'</span></div>').join('')+'</div>'
            +'<div class="hint" style="margin-top:10px">Fastest '+hm(r.best)+' · slowest '+hm(r.worst)+'</div>'
          : '<p class="xs faint">No case has both an email time and an intervention time yet. Enter both when you log a curative case and the response speed is calculated automatically.</p>')})+'</div>'
    +'<div class="c4">'+UI.card({title:'Open off-site cases',sub:'Downtime keeps accruing until return',icon:'truck',body:
        (open.length? open.map(x=>{ const oc=openCase(x.e);
            return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(x.e.name)+'</div><div class="lr-sub">Shipped '+U.fmtDateShort(oc.shippedOn)+' · '+hm(evDowntime(oc))+' so far</div></div><button class="btn xs" data-return="'+x.e.id+'">Mark returned</button></div>'; }).join('')
          : '<p class="xs faint">Nothing is out for repair. When an analyser cannot be fixed on site, record the shipment and a backup; it stays in downtime until you mark it returned.</p>')})+'</div>'
    +'<div class="c4">'+UI.card({title:'Awaiting intervention',sub:'Email sent, no visit recorded',icon:'clock',body:
        (awaiting.length? awaiting.map(({e,ev})=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(e.name)+'</div><div class="lr-sub">Emailed '+fmtDT(ev.emailAt)+'</div></div><span class="pill amber">'+hm(hBetween(ev.emailAt,nowLocalInput()))+'</span></div>').join('')
          : '<p class="xs faint">No supplier email is waiting for a visit.</p>')})+'</div>'
    +'</div>';
  return summary+'<div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('activity',14,'ic')+'Curative maintenance log</div><div class="card-sub">Breakdowns, supplier call-outs and off-site repairs · newest first</div></div><span class="grow"></span><button class="btn sm" data-backfill>'+UI.ic('history',13)+'Previous history</button><button class="btn sm primary" data-logcur>'+UI.ic('plus',13)+'Log curative case</button></div>'
    +body+'</div>';
}

/* ------------------------------------------------------------- inventory tab */
function inventoryView(){
  const list=primaries(), pool=backups();
  const row=(e,extra)=>{ const st=STATUS[e.status]||['Unknown','slate'];
    return '<tr><td><div class="primary-cell"><b>'+U.esc(e.name)+'</b><small>'+U.esc(e.model)+'</small></div></td>'
      +'<td class="mono xs">'+U.esc(e.serial)+'</td><td>'+U.esc(e.location||'—')+'</td>'
      +'<td><span class="pill '+st[1]+'">'+st[0]+'</span></td>'
      +'<td class="xs">'+(e.status==='deployed'&&e.deployedTo? 'Covering '+U.esc(e.deployedTo)+(e.deployedAt?' since '+U.fmtDateShort(e.deployedAt):'') : (e.role==='backup'?'Available for deployment':'In service'))+'</td>'
      +'<td>'+(extra||'')+'</td></tr>'; };
  return '<div class="grid-12">'
   +'<div class="c8">'+UI.card({title:'Analysers in service',sub:'Primary fleet · '+list.length+' assets',icon:'microscope',tools:'<button class="btn xs" data-addeq>'+UI.ic('plus',12)+'Add</button>',
      body:'<div class="dt-scroll"><table class="dt"><thead><tr><th>Analyser</th><th>Serial</th><th>Location</th><th>Status</th><th>Deployment</th><th></th></tr></thead><tbody>'
        +list.map(e=>row(e,'<button class="icon-btn" style="width:26px;height:26px" data-editeq="'+e.id+'">'+UI.ic('pencil',13)+'</button>')).join('')+'</tbody></table></div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Backup pool',sub:'Loan analysers held for breakdown cover',icon:'package',tools:'<button class="btn xs" data-addbackup>'+UI.ic('plus',12)+'Register</button>',
      body:(pool.length? pool.map(e=>{ const st=STATUS[e.status]||['Unknown','slate'];
          return '<div class="list-row"><div class="lr-main"><div class="lr-title truncate" style="font-size:11.6px">'+U.esc(e.name)+'</div><div class="lr-sub">'+U.esc(e.model)+' · '+U.esc(e.serial)+'</div></div><span class="pill '+st[1]+'">'+(e.status==='deployed'?'Deployed':'Standby')+'</span></div>'
            +(e.status==='deployed'&&e.deployedTo? '<div class="xs faint" style="padding-left:0;margin:-2px 0 8px">Covering '+U.esc(e.deployedTo)+' since '+U.fmtDateShort(e.deployedAt)+'</div>':''); }).join('')
        : '<p class="xs faint">No backup analyser is held yet. Register one here so a breakdown can be covered the same day.</p>')})+'</div>'
   +'<div class="c12">'+UI.card({title:'Downtime accounting',sub:'Shipped analysers stay in the downtime ledger until they return',icon:'timer',body:
      '<div class="dt-scroll"><table class="dt"><thead><tr><th>Analyser</th><th>Downtime 30 d</th><th>Curative cases</th><th>Open shipment</th><th>Supplier</th><th>Response (mean)</th></tr></thead><tbody>'
      +list.map(e=>{ const rs=responseStats(curative(e)); const oc=openCase(e);
        return '<tr><td>'+U.esc(e.name)+'</td><td class="num mono">'+hm(downtimeIn(e,30,false))+'</td><td class="num">'+curative(e).length+'</td>'
          +'<td>'+(oc? '<span class="pill rose">'+hm(evDowntime(oc))+' · since '+U.fmtDateShort(oc.shippedOn)+'</span>':'<span class="faint">—</span>')+'</td>'
          +'<td class="xs">'+U.esc((curative(e).find(x=>x.supplier)||{}).supplier||e.vendor||e.manufacturer||'—')+'</td>'
          +'<td class="num mono">'+(rs?hm(rs.avg):'—')+'</td></tr>'; }).join('')+'</tbody></table></div>',
      foot:'<span>Downtime counts from the shipment date · stopped only by “Mark returned”</span><span class="mono">30-day window</span>'})+'</div>'
   +'</div>';
}

/* --------------------------------------------------------- record a service */
function serviceModal(preId, presetKind){
  if(!LS.auth.guard('edit')) return;
  const db=S.db();
  const eqs=primaries();
  if(!eqs.length) return UI.toast('Add an analyser first',{type:'warn'});
  const pool=db.equipment.filter(e=>e.role==='backup'&&e.status!=='deployed');
  let kind=presetKind==='curative'?'curative':'preventive';
  const sel=(preId&&eqs.find(e=>e.id===preId))?preId:eqs[0].id;
  UI.modal({title:'Record a maintenance event',sub:'Preventive or curative · past events can be back-dated. The register keeps the whole history, not only the latest visit.',width:'min(640px,100%)',
    body:'<div class="form-grid">'
     +'<div class="field span2"><label>Analyser</label><select class="select" id="svEq">'+eqs.map(e=>'<option value="'+e.id+'"'+(sel===e.id?' selected':'')+'>'+U.esc(e.name+' · '+e.serial)+'</option>').join('')+'</select></div>'
     +'<div class="field span2"><label>Maintenance type</label><div class="row gap-sm" id="svKind">'
        +'<button type="button" class="filter-tab '+(kind==='preventive'?'on':'')+'" data-k="preventive">Preventive</button>'
        +'<button type="button" class="filter-tab '+(kind==='curative'?'on':'')+'" data-k="curative">Curative · breakdown</button>'
     +'</div></div>'
     +'<div class="field"><label>Date</label><input class="input" type="date" id="svDate" value="'+U.todayISO()+'" max="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>Record type</label><select class="select" id="svTypeP"'+''+'>'+TYPES_P.map(t=>'<option>'+t+'</option>').join('')+'</select>'
        +'<select class="select" id="svTypeC" style="display:none">'+TYPES_C.map(t=>'<option>'+t+'</option>').join('')+'</select></div>'
     +'<div class="field"><label>Performed by</label><input class="input" id="svBy" value="'+U.esc(LS.auth.user.name)+'"></div>'
     +'<div class="field"><label>Downtime caused (hours)</label><input class="input mono" type="number" min="0" step="0.5" id="svHours" value="0"></div>'
     +'<div class="field span2"><label>Work performed / diagnosis</label><textarea class="textarea" id="svNote" placeholder="Probe cleaning, calibration verification, lamp replacement…"></textarea></div>'
     +'<div class="field span2" id="svCurWrap" style="display:none"><div class="card pad" style="background:var(--surface-inset)">'
        +'<div class="eyebrow">Supplier call-out</div>'
        +'<div class="form-grid" style="margin-top:8px">'
        +'<div class="field"><label>Supplier</label><input class="input" id="svSupplier" placeholder="e.g. Sysmex East Africa"></div>'
        +'<div class="field"><label>Email address used</label><input class="input" type="email" id="svSupplierEmail" placeholder="service@supplier.rw"></div>'
        +'<div class="field"><label>Email sent to supplier</label><input class="input" type="datetime-local" id="svSent" max="'+nowLocalInput()+'"></div>'
        +'<div class="field"><label>Supplier intervened at</label><input class="input" type="datetime-local" id="svInterv" max="'+nowLocalInput()+'"></div>'
        +'<div class="field span2"><div class="hint" id="svResp">Enter the email time and the intervention time — the supplier response speed is calculated from the two.</div></div>'
        +'<div class="field"><label>Repaired on site?</label><select class="select" id="svSite"><option value="1">Yes — back in service</option><option value="0">No — shipped to supplier</option></select></div>'
        +'<div class="field"><label>Shipment date</label><input class="input" type="date" id="svShip" value="'+U.todayISO()+'" max="'+U.todayISO()+'" disabled></div>'
        +'<div class="field span2"><label>Backup analyser provided</label><select class="select" id="svBackup" disabled><option value="">None available</option>'
           +pool.map(b=>'<option value="'+b.id+'">'+U.esc(b.name+' · '+b.serial)+'</option>').join('')+'</select></div>'
        +'<div class="field span2"><div class="hint" id="svShipHint">A shipped analyser is added to the backup inventory and stays under downtime calculation until you mark it returned.</div></div>'
        +'</div></div></div>'
     +'</div>'
     +'<div class="hint" style="margin-top:8px">Back-dated events never move the next-PM date backwards; the latest preventive service in the log sets the clock.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Record event</button>',
    onMount:(el,close)=>{
      const q=s=>el.querySelector(s);
      const paintKind=()=>{
        U.$$('[data-k]',el).forEach(b=>b.classList.toggle('on',b.dataset.k===kind));
        q('#svCurWrap').style.display=kind==='curative'?'':'none';
        q('#svTypeP').style.display=kind==='curative'?'none':'';
        q('#svTypeC').style.display=kind==='curative'?'':'none';
        q('#svHours').closest('.field').style.display=kind==='curative'?'':'';
      };
      U.$$('[data-k]',el).forEach(b=>b.onclick=()=>{ kind=b.dataset.k; paintKind(); });
      const respInfo=()=>{
        const h=hBetween(q('#svSent').value,q('#svInterv').value);
        const box=q('#svResp');
        if(h!=null){ box.innerHTML='<b style="color:var(--text)">Supplier responded in '+hm(h)+'</b> — from email to intervention.'; }
        else if(q('#svSent').value){ box.innerHTML='Email logged. Enter the intervention time to close the response clock.'; }
        else { box.innerHTML='Enter the email time and the intervention time — the supplier response speed is calculated from the two.'; }
      };
      ['#svSent','#svInterv'].forEach(s=>{ q(s).oninput=respInfo; q(s).onchange=respInfo; });
      const site=q('#svSite');
      const paintSite=()=>{
        const off=site.value==='0';
        q('#svShip').disabled=!off; q('#svBackup').disabled=!off;
        if(off) q('#svShipHint').innerHTML='<b style="color:var(--text)">Shipped out:</b> the analyser stays in the downtime ledger and the backup is marked deployed until the analyser is marked returned.';
        else q('#svShipHint').innerHTML='A shipped analyser is added to the backup inventory and stays under downtime calculation until you mark it returned.';
      };
      site.onchange=paintSite;
      q('#svEq').onchange=()=>{ const e=db.equipment.find(x=>x.id===q('#svEq').value); if(e){ q('#svSupplier').value=e.vendor||e.manufacturer||''; q('#svSupplierEmail').value=e.vendorEmail||''; } };
      q('#svEq').onchange();
      paintKind(); paintSite(); respInfo();
      q('[data-save]').onclick=()=>{
        const id=q('#svEq').value, date=q('#svDate').value;
        if(!date) return UI.toast('Pick the service date',{type:'warn'});
        if(date>U.todayISO()) return UI.toast('Use a date today or earlier',{type:'warn'});
        const by=q('#svBy').value.trim()||LS.auth.user.name;
        const note=q('#svNote').value.trim();
        const type=kind==='curative'? q('#svTypeC').value : q('#svTypeP').value;
        const ev={id:U.uid('svc'),date,kind,type,by,note:note||type+' recorded',hours:+q('#svHours').value||0,
          recordedAt:new Date().toISOString(),source:'record'};
        if(kind==='curative'){
          const sent=q('#svSent').value, interv=q('#svInterv').value;
          if(sent&&interv&&parseDT(interv)<parseDT(sent)) return UI.toast('The intervention cannot precede the email',{type:'warn'});
          ev.supplier=q('#svSupplier').value.trim()||''; ev.supplierEmail=q('#svSupplierEmail').value.trim()||'';
          ev.emailAt=sent||null; ev.interventionAt=interv||null;
          ev.responseH=hBetween(sent,interv);
          const onsite=q('#svSite').value==='1';
          ev.onsite=onsite;
          if(!onsite){
            ev.offsite=true; ev.shippedOn=q('#svShip').value||date;
            ev.backupId=q('#svBackup').value||null;
          }
        }
        S.commit(d=>{
          const e=d.equipment.find(x=>x.id===id); if(!e) return;
          e.services=e.services||[]; e.services.push(ev);
          if(!e.downtime) e.downtime=[];
          if(kind==='curative'){
            if(ev.shippedOn){
              e.status='offsite';
              if(ev.backupId){
                const b=d.equipment.find(x=>x.id===ev.backupId);
                if(b){ b.status='deployed'; b.deployedTo=e.name; b.deployedAt=ev.shippedOn; b.deployedFor=e.id; }
              }
            }else if(['offline','offsite','maintenance','warning'].indexOf(e.status)>=0 && ev.interventionAt){
              e.status='operational';
            }
          }else{
            applyPM(e);
            if(e.status==='offline'&&ev.type!=='Incident') e.status='operational';
          }
        },{action:'equipment.'+kind,entity:'equipment',entityId:id,detail:type+' recorded '+date+' by '+by+(ev.responseH!=null?' · supplier response '+hm(ev.responseH):'')+(ev.shippedOn?' · shipped '+ev.shippedOn:'')});
        close(); LS.shell.refresh();
        UI.toast(kind==='curative'? 'Curative case recorded'+(ev.responseH!=null?' · response '+hm(ev.responseH):'')+(ev.shippedOn?' · shipped out':''): 'Service recorded · next PM '+(ev.nextPM||''),{type:'ok'});
      };
    }});
}

/* --------------------------------------------- previous (back-dated) history */
function histRow(){
  return '<div class="hist-row card pad" style="background:var(--surface-inset);margin-bottom:10px">'
   +'<div class="row between" style="margin-bottom:6px"><div class="eyebrow">Past event</div><button type="button" class="icon-btn" style="width:24px;height:24px" data-del-row aria-label="Remove">'+UI.ic('x',12)+'</button></div>'
   +'<div class="form-grid">'
   +'<div class="field"><label>Date</label><input class="input hDate" type="date" max="'+U.todayISO()+'"></div>'
   +'<div class="field"><label>Kind</label><select class="select hKind"><option value="preventive">Preventive</option><option value="curative">Curative</option></select></div>'
   +'<div class="field"><label>Record type</label><input class="input hType" placeholder="PM / Repair / Calibration"></div>'
   +'<div class="field"><label>Downtime (h)</label><input class="input mono hHours" type="number" min="0" step="0.5" value="0"></div>'
   +'<div class="field"><label>Email to supplier</label><input class="input hSent" type="datetime-local" max="'+nowLocalInput()+'"></div>'
   +'<div class="field"><label>Supplier intervened</label><input class="input hInterv" type="datetime-local" max="'+nowLocalInput()+'"></div>'
   +'<div class="field span2"><label>Work performed / note</label><input class="input hNote" placeholder="What was done"></div>'
   +'</div></div>';
}
function historyModal(preId){
  if(!LS.auth.guard('edit')) return;
  const eqs=primaries();
  if(!eqs.length) return UI.toast('Add an analyser first',{type:'warn'});
  const sel=(preId&&eqs.find(e=>e.id===preId))?preId:eqs[0].id;
  UI.modal({title:'Enter previous maintenance history',sub:'Back-fill what happened before the console was in use: services, breakdowns, supplier emails and visits. Nothing here can push next PM backwards.',width:'min(720px,100%)',
    body:'<div class="form-grid" style="margin-bottom:10px"><div class="field span2"><label>Analyser</label><select class="select" id="hEq">'+eqs.map(e=>'<option value="'+e.id+'"'+(sel===e.id?' selected':'')+'>'+U.esc(e.name+' · '+e.serial)+'</option>').join('')+'</select></div></div>'
     +'<div id="histRows">'+histRow()+'</div>'
     +'<button type="button" class="btn sm" data-add-row>'+UI.ic('plus',13)+'Add another past event</button>'
     +'<div class="hint" style="margin-top:10px">Leave the date empty on a row to skip it. Email and intervention times are optional — give both and the supplier response speed is measured for that past visit.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save history</button>',
    onMount:(el,close)=>{
      const host=el.querySelector('#histRows');
      const rows=()=>Array.prototype.slice.call(host.querySelectorAll('.hist-row'));
      el.querySelector('[data-add-row]').onclick=()=>{ host.insertAdjacentHTML('beforeend',histRow()); };
      host.addEventListener('click',ev=>{ const b=ev.target.closest('[data-del-row]'); if(b&&rows().length>1) b.closest('.hist-row').remove(); });
      el.querySelector('[data-save]').onclick=()=>{
        const id=el.querySelector('#hEq').value;
        const payload=[];
        rows().forEach(r=>{
          const date=r.querySelector('.hDate').value;
          if(!date) return;
          if(date>U.todayISO()) return;
          const kind=r.querySelector('.hKind').value;
          const type=r.querySelector('.hType').value.trim()||(kind==='curative'?'Repair':'PM');
          const sent=r.querySelector('.hSent').value, interv=r.querySelector('.hInterv').value;
          const ev={id:U.uid('svc'),date,kind,type,by:LS.auth.user.name,
            note:r.querySelector('.hNote').value.trim()||type+' (past history)',
            hours:+r.querySelector('.hHours').value||0,source:'backfill',recordedAt:new Date().toISOString()};
          if(kind==='curative'||sent||interv){
            ev.emailAt=sent||null; ev.interventionAt=interv||null;
            ev.responseH=hBetween(sent,interv);
          }
          payload.push(ev);
        });
        if(!payload.length) return UI.toast('Add at least one past event with a date',{type:'warn'});
        S.commit(d=>{
          const e=d.equipment.find(x=>x.id===id); if(!e) return;
          e.services=e.services||[]; if(!e.downtime) e.downtime=[];
          payload.forEach(ev=>e.services.push(ev));
          applyPM(e);
        },{action:'equipment.history',entity:'equipment',entityId:id,detail:payload.length+' past maintenance events entered'});
        close(); LS.shell.refresh();
        UI.toast(payload.length+' past event'+(payload.length===1?'':'s')+' added to the history',{type:'ok'});
      };
    }});
}

/* ------------------------------------------------------- mark off-site return */
function returnModal(eqId){
  if(!LS.auth.guard('edit')) return;
  const e=S.db().equipment.find(x=>x.id===eqId); if(!e) return;
  const oc=openCase(e);
  if(!oc) return UI.toast('No analyser is out for repair',{type:'warn'});
  const bk=oc.backupId? S.db().equipment.find(x=>x.id===oc.backupId):null;
  UI.modal({title:'Mark analyser returned',sub:'Downtime stops on the return date · the backup is released back to the pool.',width:'min(520px,100%)',
    body:'<div class="form-grid">'
     +'<div class="field span2"><div class="hint">'+U.esc(e.name)+' was shipped on '+U.fmtDate(oc.shippedOn)+' — '+hm(evDowntime(oc))+' of downtime so far'+(bk?', covered by '+U.esc(bk.name):'')+'.</div></div>'
     +'<div class="field"><label>Returned on</label><input class="input" type="date" id="rtDate" value="'+U.todayISO()+'" min="'+oc.shippedOn+'" max="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>Status after return</label><select class="select" id="rtStatus"><option value="operational">Operational</option><option value="maintenance">In maintenance</option><option value="offline">Still offline</option></select></div>'
     +'<div class="field span2"><label>Return note</label><input class="input" id="rtNote" placeholder="Repaired, verified with QC, accessories returned…"></div>'
     +'</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Mark returned</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const date=el.querySelector('#rtDate').value;
        if(!date) return UI.toast('Pick the return date',{type:'warn'});
        if(date<oc.shippedOn) return UI.toast('Return cannot precede the shipment',{type:'warn'});
        const status=el.querySelector('#rtStatus').value;
        const note=el.querySelector('#rtNote').value.trim();
        S.commit(d=>{
          const x=d.equipment.find(y=>y.id===eqId); if(!x) return;
          const ev=(x.services||[]).find(y=>y.id===oc.id) || (x.services||[]).find(y=>y.shippedOn===oc.shippedOn&&!y.returnedOn);
          if(ev){ ev.returnedOn=date; if(note) ev.returnNote=note; }
          if(status==='offsite') x.status='operational'; else x.status=status;
          if(oc.backupId){ const b=d.equipment.find(y=>y.id===oc.backupId); if(b){ b.status='standby'; b.deployedTo=null; b.deployedAt=null; b.deployedFor=null; } }
        },{action:'equipment.return',entity:'equipment',entityId:eqId,detail:e.name+' returned '+date+(note?' · '+note:'')});
        close(); LS.shell.refresh(); UI.toast(e.name+' marked returned · downtime closed',{type:'ok'});
      };
    }});
}

/* -------------------------------------------------------------- equipment form */
function equipmentModal(id,presetRole){
  if(!LS.auth.guard('edit')) return;
  const e=id?S.db().equipment.find(x=>x.id===id):null;
  const role=e? (e.role||'primary') : (presetRole||'primary');
  UI.modal({title:e?'Edit equipment record':(role==='backup'?'Register a backup analyser':'Add equipment'),sub:'Admin only · the register feeds maintenance scheduling, QC links, the backup pool and the exported asset list.',width:'min(680px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field span2"><label>Equipment name</label><input class="input" id="eqName" value="'+U.esc(e?e.name:'')+'" placeholder="e.g. Sysmex XN-550"></div>'
      +'<div class="field"><label>Model</label><input class="input" id="eqModel" value="'+U.esc(e?e.model:'')+'"></div>'
      +'<div class="field"><label>Manufacturer / supplier</label><input class="input" id="eqManu" value="'+U.esc(e?e.manufacturer:'')+'"></div>'
      +'<div class="field"><label>Serial number</label><input class="input mono" id="eqSerial" value="'+U.esc(e?e.serial:'')+'"></div>'
      +'<div class="field"><label>Location</label><input class="input" id="eqLoc" value="'+U.esc(e?e.location:'')+'"></div>'
      +'<div class="field"><label>Role in the lab</label><select class="select" id="eqRole"><option value="primary"'+(role==='primary'?' selected':'')+'>Analyser in service</option><option value="backup"'+(role==='backup'?' selected':'')+'>Backup analyser</option></select></div>'
      +'<div class="field"><label>Status</label><select class="select" id="eqStatus">'+Object.keys(STATUS).map(k=>'<option value="'+k+'"'+((e?e.status:(role==='backup'?'standby':'operational'))===k?' selected':'')+'>'+STATUS[k][0]+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Uptime (30 d, %)</label><input class="input mono" type="number" min="0" max="100" step="0.1" id="eqUptime" value="'+(e&&e.uptime!=null?e.uptime:100)+'"></div>'
      +'<div class="field"><label>Commissioned on</label><input class="input" type="date" id="eqInstalled" value="'+U.esc(e&&e.installed?e.installed:'')+'"></div>'
      +'<div class="field"><label>Last service</label><input class="input" type="date" id="eqLast" value="'+U.esc(e&&e.lastPM?String(e.lastPM).slice(0,10):'')+'" max="'+U.todayISO()+'"></div>'
      +'<div class="field"><label>PM interval (days)</label><input class="input mono" type="number" min="15" step="15" id="eqInterval" value="'+(e&&e.pmIntervalDays?e.pmIntervalDays:180)+'"></div>'
      +'<div class="field"><label>Supplier service email</label><input class="input" type="email" id="eqVendorEmail" value="'+U.esc(e&&e.vendorEmail?e.vendorEmail:'')+'" placeholder="service@supplier.rw"></div>'
      +'<div class="field span2"><label>Notes</label><textarea class="textarea" id="eqNote" rows="2" placeholder="Service contract, known faults, accessories…">'+U.esc(e?e.note||'':'')+'</textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save equipment</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#eqName').value.trim();
        if(!name) return UI.toast('Equipment name required',{type:'warn'});
        const rec={name,model:el.querySelector('#eqModel').value.trim(),manufacturer:el.querySelector('#eqManu').value.trim(),
          serial:el.querySelector('#eqSerial').value.trim()||'—',location:el.querySelector('#eqLoc').value.trim(),
          role:el.querySelector('#eqRole').value,
          status:el.querySelector('#eqStatus').value,uptime:+el.querySelector('#eqUptime').value||0,
          installed:el.querySelector('#eqInstalled').value||null,
          vendorEmail:el.querySelector('#eqVendorEmail').value.trim(),
          pmIntervalDays:Math.max(15,+el.querySelector('#eqInterval').value||180),
          note:el.querySelector('#eqNote').value.trim()};
        rec.vendor=rec.manufacturer;
        rec.lastPM=el.querySelector('#eqLast').value||null;
        rec.nextPM=rec.lastPM?U.addDays(rec.lastPM,rec.pmIntervalDays):null;
        S.commit(d=>{
          if(e){ const x=d.equipment.find(y=>y.id===e.id); if(x){ Object.assign(x,rec); x.services=x.services||[]; x.downtime=x.downtime||[]; } }
          else { const nid=U.uid('eq'); d.equipment.push(Object.assign({id:nid,services:[],downtime:[],uptime:rec.uptime},rec)); }
        },{action:'equipment.'+(e?'edit':'add'),entity:'equipment',entityId:e?e.id:rec.name,detail:rec.name+' · '+rec.serial});
        close(); LS.shell.refresh(); UI.toast(e?'Equipment record updated':'Equipment added to the register',{type:'ok'});
      };
    }});
}

/* ------------------------------------------------------------------- drawer */
function eqDrawer(id){
  const e=S.db().equipment.find(x=>x.id===id); if(!e) return;
  const d=daysToPM(e);
  const related=S.db().qc.analytes.filter(a=>a.analyzer===e.name);
  const hist=events(e);
  const last=lastService(e);
  const rs=responseStats(curative(e));
  const oc=openCase(e);
  const bk=oc&&oc.backupId? S.db().equipment.find(x=>x.id===oc.backupId):null;
  const evRow=(ev)=>{
    const kind=kindOf(ev);
    const resp=responseOf(ev);
    const bad=ev.shippedOn&&!ev.returnedOn;
    return '<div class="custody-item"><span class="custody-dot" style="background:var(--'+(kind==='curative'?'rose':'teal')+')"></span><div class="custody-body">'
      +'<div class="custody-title">'+U.esc(ev.type||'Event')
        +' <span class="pill '+(kind==='curative'?'rose':'teal')+'">'+(KIND_LABEL[kind]||'')+'</span>'
        +(ev.hours||ev.shippedOn? ' <span class="xs faint">'+hm(evDowntime(ev))+' downtime</span>':'')
        +(ev.source==='backfill'?' <span class="xs faint">· back-filled</span>':'')+'</div>'
      +'<div class="custody-meta">'+U.fmtDate(ev.date)+(ev.by?' · '+U.esc(ev.by):'')+' · '+U.esc(ev.note||'')+'</div>'
      +(ev.emailAt||ev.interventionAt? '<div class="custody-meta">'+UI.ic('mail',11)+' Email '+fmtDT(ev.emailAt)+' → intervened '+fmtDT(ev.interventionAt)+(resp!=null?' · <b style="color:var(--text)">response '+hm(resp)+'</b>':' · awaiting')+'</div>':'')
      +(ev.shippedOn? '<div class="custody-meta">'+UI.ic('truck',11)+' Shipped '+U.fmtDate(ev.shippedOn)+(ev.returnedOn?' · returned '+U.fmtDate(ev.returnedOn):' · still off site')+(ev.backupId&&S.db().equipment.find(x=>x.id===ev.backupId)?' · backup '+U.esc(S.db().equipment.find(x=>x.id===ev.backupId).name):'')+'</div>':'')
      +'</div></div>';
  };
  UI.drawer({title:e.name,eyebrow:e.role==='backup'?'Backup analyser':'Equipment record',sub:e.model+' · '+e.location,wide:true,body:
    '<div class="split-4">'+[['Uptime 30d',uptimeOf(e)+'%'],['Status',(STATUS[e.status]||['—'])[0]],['Downtime 30d',hm(downtimeIn(e,30,false))],['Supplier response',rs?hm(rs.avg):'—']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:'+(String(v).length>12?'10.5px':'13px')+'">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +(oc? '<div class="card pad" style="background:var(--surface-inset);margin-top:12px;border-left:3px solid var(--rose)"><div class="row between"><div><div class="eyebrow" style="color:var(--rose)">Off-site repair in progress</div><div class="xs muted" style="margin-top:4px">Shipped '+U.fmtDate(oc.shippedOn)+' · '+hm(evDowntime(oc))+' downtime accrued'+(bk?' · covered by '+U.esc(bk.name):'')+'. The clock runs until the analyser is marked returned.</div></div><button class="btn sm" data-return>Mark returned</button></div></div>':'')
    +'<div class="section-head"><h2>Maintenance & downtime history</h2><span class="more">'+hist.length+' events</span></div>'
    +'<div class="custody">'+(hist.length?hist.map(evRow).join(''):'<p class="xs faint" style="padding-left:22px">No maintenance events recorded yet — use “Record maintenance”, or “Previous history” to back-fill visits from before the console.</p>')+'</div>'
    +'<div class="hint" style="margin-top:8px">Latest preventive service: '+(last?U.fmtDate(last.date)+' ('+U.esc(last.type)+')':'—')+' · PM interval '+(e.pmIntervalDays||180)+' days · next '+(e.nextPM?U.fmtDate(e.nextPM):'not scheduled')+'</div>'
    +(rs? '<div class="hint" style="margin-top:6px">Supplier response across '+rs.n+' case'+(rs.n===1?'':'s')+': mean '+hm(rs.avg)+' · median '+hm(rs.median)+' · fastest '+hm(rs.best)+'.</div>':'')
    +'<div class="section-head"><h2>Linked quality control</h2></div>'
    +(related.length?related.map(a=>{ const run=S.db().qc.runs[a.key]; const l=run?run.points[run.points.length-1]:null;
        return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(a.key)+' <span class="xs faint">· '+a.level+'</span></div><div class="lr-sub">Mean '+a.mean+' ± '+a.sd+' '+U.esc(a.unit)+'</div></div><span class="pill '+(l&&Math.abs(l.z)>2?'amber':'teal')+'">'+(l?((l.z>0?'+':'')+l.z+' SD'):'no runs')+'</span></div>'; }).join(''):'<p class="xs faint">No QC scheme linked to this analyser.</p>')
    +'<div class="card pad" style="background:var(--surface-inset);margin-top:14px"><div class="eyebrow">Specification</div><div class="split-2" style="margin-top:6px">'+[['Manufacturer',e.manufacturer],['Install date',e.installed||'—'],['Serial',e.serial],['Location',e.location],['Supplier email',e.vendorEmail||'—'],['Role',e.role==='backup'?'Backup':'In service']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11px">'+U.esc(v)+'</span></div>').join('')+'</div>'
      +(e.note?'<div class="xs faint" style="margin-top:8px">'+U.esc(e.note)+'</div>':'')+'</div>'
    +'<div class="hint" style="margin-top:12px">Downtime is calculated from the maintenance log and the shipment dates. An analyser sent off site keeps accruing downtime until it is marked returned.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-history>'+UI.ic('history',15)+'Previous history</button><button class="btn" data-edit-eq>'+UI.ic('pencil',15)+'Edit</button><button class="btn" data-flag>'+UI.ic('alert-triangle',15)+'Flag fault</button><button class="btn primary" data-pm>'+UI.ic('wrench',15)+'Record maintenance</button>',
    onMount:(panel,close)=>{
      panel.querySelector('[data-pm]').onclick=()=>{ close(); serviceModal(e.id); };
      panel.querySelector('[data-history]').onclick=()=>{ close(); historyModal(e.id); };
      panel.querySelector('[data-edit-eq]').onclick=()=>{ close(); equipmentModal(e.id); };
      const rt=panel.querySelector('[data-return]'); if(rt) rt.onclick=()=>{ close(); returnModal(e.id); };
      panel.querySelector('[data-flag]').onclick=()=>{
        S.commit(db=>{ const x=db.equipment.find(y=>y.id===e.id); if(x) x.status='offline'; },{action:'equipment.flag',entity:'equipment',entityId:e.id,detail:e.name+' flagged offline'});
        close(); LS.shell.refresh(); UI.toast(e.name+' flagged offline · biomedical engineer notified',{type:'warn'});
      };
    }});
}

/* --------------------------------------------------------------- page render */
M.render=function(root,params){
  rootEl=root; tab=params.tab||'fleet';
  if(['fleet','pm','curative','inventory'].indexOf(tab)<0) tab='fleet';
  root.innerHTML='<div class="page-head"><div><h1>Equipment &amp; facilities</h1><div class="sub">Every analyser, its preventive and curative maintenance, supplier response time, off-site repairs and the cold chain that keeps results valid — in one register.</div></div>'
   +'<div class="actions"><button class="btn" data-history>'+UI.ic('history',15)+' Previous history</button><button class="btn" data-logpm>'+UI.ic('wrench',15)+' Record maintenance</button><button class="btn" data-addeq>'+UI.ic('plus',15)+' Add equipment</button><button class="btn primary" data-export>'+UI.ic('download',15)+' Export register</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px;flex-wrap:wrap">'+[['fleet','Fleet'],['pm','Preventive plan'],['curative','Curative & downtime'],['inventory','Backup inventory']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-e-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="eqBody"></div>';
  const paint=()=>{
    const host=root.querySelector('#eqBody');
    if(tab==='pm') host.innerHTML=pmView();
    else if(tab==='curative') host.innerHTML=curativeView();
    else if(tab==='inventory') host.innerHTML=inventoryView();
    else host.innerHTML=fleet()+uptimeChart();
    U.$$('[data-e-tab]',root).forEach(b=>b.classList.toggle('on',b.dataset.eTab===tab));
    if(tab==='fleet'){
      const months=['May','Jun','Jul','Aug','Sep','Oct'];
      const eqs=primaries().slice(0,4);
      const trend=host.querySelector('#eqTrend');
      if(trend) C.line(trend,{id:'eqTrend',height:240,min:60,max:100,labels:months,series:eqs.map((e,i)=>({name:e.name,color:'var(--chart-'+(i+1)+')',values:[e.uptime-3,e.uptime-2,e.uptime-1.4,e.uptime-0.8,e.uptime-0.4,uptimeOf(e)].map(v=>+Number(v||0).toFixed(1))})),yFmt:v=>Math.round(v)+'%'});
      const cold=host.querySelector('#coldTrend');
      if(cold){
        const temps=[2.4,3.1,4.8,5.2,6.9,7.1,6.2,5.4,4.1,3.8,3.2,2.9,9.4,8.6,6.1,5.2,4.4,3.9,3.5,3.1,2.8,2.6,2.4,2.3];
        C.line(cold,{id:'coldTrend',height:190,min:0,max:12,labels:temps.map((_,i)=>i+':00'),series:[{name:'Fridge °C',color:'var(--chart-1)',values:temps}],yFmt:v=>v+'°',bands:[{from:2,to:8,color:'rgba(63,211,182,.08)'}],target:8,targetLabel:'Upper limit'});
      }
    }
    host.querySelectorAll('[data-eq],[data-eqrow]').forEach(el=>el.onclick=()=>eqDrawer(el.dataset.eq||el.dataset.eqrow));
    U.$$('[data-logpm]',root).forEach(b=>b.onclick=()=>serviceModal());
    U.$$('[data-logcur]',host).forEach(b=>b.onclick=()=>serviceModal(null,'curative'));
    U.$$('[data-backfill]',host).forEach(b=>b.onclick=()=>historyModal());
    U.$$('[data-return]',host).forEach(b=>b.onclick=()=>returnModal(b.dataset.return));
    U.$$('[data-addeq]',root).forEach(b=>b.onclick=()=>equipmentModal(null));
    U.$$('[data-addbackup]',host).forEach(b=>b.onclick=()=>equipmentModal(null,'backup'));
    U.$$('[data-editeq]',host).forEach(b=>b.onclick=()=>equipmentModal(b.dataset.editeq));
  };
  U.$$('[data-e-tab]',root).forEach(b=>b.onclick=()=>{ tab=b.dataset.eTab; paint(); });
  root.querySelector('[data-history]').onclick=()=>historyModal();
  root.querySelector('[data-export]').onclick=()=>{
    U.exportCSV('equipment-register-'+U.todayISO()+'.csv',
      [['Asset','Role','Model','Manufacturer','Serial','Location','Status','Uptime %','Last service','Next PM','Downtime 30d h','Curative cases','Supplier response h','Events']]
      .concat(S.db().equipment.map(e=>{ const rs=responseStats(curative(e));
        return [e.name,e.role==='backup'?'Backup':'In service',e.model,e.manufacturer,e.serial,e.location,e.status,uptimeOf(e),e.lastPM,e.nextPM,
          Math.round(downtimeIn(e,30,false)*10)/10,curative(e).length,rs?rs.avg:'',events(e).length]; })),
      {title:'Equipment register — '+S.settings().labName,actor:LS.auth.user.name});
    UI.toast('Equipment register exported',{type:'ok'});
  };
  paint();
};

/* ------------------------------------------------------------- chart section */
function uptimeChart(){
  const list=primaries();
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Uptime by analyser',sub:'Six-month trend · downtime events included',icon:'activity',
    tools:'<span class="pill teal">Fleet '+fleetStats().uptime+'%</span>',body:'<div id="eqTrend"></div><div class="legend" style="margin-top:8px">'+list.slice(0,4).map((e,i)=>'<span class="lg"><span class="sw" style="background:var(--chart-'+(i+1)+')"></span>'+U.esc(e.name)+'</span>').join('')+'</div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Maintenance calendar',sub:'Next 90 days',icon:'calendar-days',body:(function(){
      const items=list.filter(e=>e.nextPM).sort((a,b)=>String(a.nextPM).localeCompare(String(b.nextPM))).slice(0,6);
      if(!items.length) return '<p class="xs faint">No preventive schedule set.</p>';
      return items.map(e=>{ const d=daysToPM(e); const late=overdue(e);
        return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(e.name)+'</div><div class="lr-sub">'+U.esc(e.manufacturer)+' · '+(late?'overdue':'in '+d+' days')+'</div></div><span class="pill '+(late?'rose':'slate')+'">'+U.fmtDateShort(e.nextPM)+'</span></div>'; }).join('');
    })()})+'</div>'
   +'<div class="c12">'+UI.card({title:'Cold chain · 24 h trace',sub:'Blood bank fridge · excursion flags trigger a non-conformance',icon:'thermometer',
      tools:'<a class="btn xs" href="#/stock">Stock</a>',body:'<div id="coldTrend"></div><div class="row wrap gap-sm" style="margin-top:10px">'+S.db().coldChain.slice(0,4).map(c=>'<span class="pill '+(c.temp>c.max||c.temp<c.min?'rose':'teal')+'">'+U.esc(c.device)+' · '+c.temp+' °C · '+U.relTime(c.at)+'</span>').join('')+'</div>'})+'</div></div>';
}
})();
