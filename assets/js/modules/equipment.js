/* ============================================================================
   MODULE · EQUIPMENT & FACILITIES — uptime, preventive maintenance, cold chain
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.equipment=M;
let rootEl=null, tab='fleet';
const STATUS={operational:['Operational','teal'],maintenance:['In maintenance','amber'],warning:['Attention','amber'],offline:['Offline','rose'],retired:['Retired','slate']};

function history(e){
  const list=(e.services||[]).slice();
  (e.downtime||[]).forEach(d=>{ if(!list.some(x=>x.date===d.date&&x.type===d.type&&x.note===d.note)) list.push({date:d.date,type:d.type||'Event',by:d.by||'',note:d.note||'',hours:d.hours||0}); });
  return list.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
function lastService(e){ const h=history(e).filter(x=>/PM|Repair|Calibration|Service/i.test(x.type||'')); return h[0]||null; }
function overdue(e){ return e.nextPM && e.nextPM<U.todayISO(); }
function daysToPM(e){ return e.nextPM?U.daysBetween(U.todayISO(),e.nextPM):null; }
function fleetStats(){
  const list=S.db().equipment;
  const op=list.filter(e=>e.status==='operational').length;
  return {total:list.length, operational:op, uptime:+(U.avg(list.map(e=>e.uptime))||0).toFixed(1),
    due:list.filter(e=>{ const d=daysToPM(e); return d!=null&&d<=30; }).length,
    overdue:list.filter(overdue).length, offline:list.filter(e=>e.status==='offline').length};
}
function kpis(){
  const f=fleetStats();
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Fleet uptime',value:f.uptime,dec:1,unit:'%',icon:'activity',formatted:'0.0',delta:1.2,note:f.operational+' of '+f.total+' analysers online',spark:C.spark([94,95,96,95,97,96,98,f.uptime],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'PM due ≤ 30 days',value:f.due,icon:'wrench',formatted:'0',note:f.overdue?f.overdue+' already overdue':'On schedule',spark:C.spark([1,2,2,3,2,3,2,f.due],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Unplanned downtime',value:11.4,dec:1,unit:'h',icon:'timer',formatted:'0.0',delta:-3.2,note:'Rolling 30 days · target ≤ 8h',spark:C.spark([19,17,15,14,13,12,12,11.4],{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Cold-chain excursions',value:S.db().coldChain.filter(c=>c.temp>c.max||c.temp<c.min).length,icon:'thermometer',formatted:'0',note:'Last 30 days · 1 critical',spark:C.spark([0,1,0,0,1,0,1,1],{color:'var(--crit)'})})+'</div></div>';
}
function fleet(){
  return '<div class="grid-12 stagger">'+S.db().equipment.map(e=>{
    const st=STATUS[e.status]||['Unknown','slate']; const d=daysToPM(e); const late=overdue(e);
    return '<div class="c4"><div class="card hover pad" data-eq="'+e.id+'" style="cursor:pointer">'
      +'<div class="row between" style="align-items:flex-start;margin-bottom:9px"><div style="min-width:0"><div class="card-title truncate">'+U.esc(e.name)+'</div><div class="card-sub truncate">'+U.esc(e.model)+' · '+U.esc(e.location)+'</div></div><span class="pill '+st[1]+'"><span class="dot'+(e.status==='operational'?' live':'')+'"></span>'+st[0]+'</span></div>'
      +'<div class="row between" style="margin-bottom:5px"><span class="xs faint">Uptime (30 d)</span><span class="mono small" style="color:var(--'+(e.uptime>=95?'pos':e.uptime>=85?'gold-bright':'crit')+')">'+e.uptime+'%</span></div>'
      +UI.meter(e.uptime,e.uptime>=95?'teal':e.uptime>=85?'gold':'rose')
      +'<div class="thread" style="margin:12px 0 10px"></div>'
      +'<div class="row between"><span class="xs faint">Next PM</span><span class="xs '+(late?'':'muted')+'" style="'+(late?'color:var(--crit)':'')+'">'+U.fmtDate(e.nextPM)+(late?' · overdue':' · in '+d+'d')+'</span></div>'
      +'<div class="row between" style="margin-top:4px"><span class="xs faint mono">'+U.esc(e.serial)+'</span><span class="xs faint">'+U.esc(e.manufacturer)+'</span></div></div></div>';
  }).join('')+'</div>';
}
function uptimeChart(){
  const list=S.db().equipment;
  const months=['May','Jun','Jul','Aug','Sep','Oct'];
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Uptime by analyser',sub:'Six-month trend · downtime events included',icon:'activity',
    tools:'<span class="pill teal">Fleet '+fleetStats().uptime+'%</span>',body:'<div id="eqTrend"></div><div class="legend" style="margin-top:8px">'+list.slice(0,4).map((e,i)=>'<span class="lg"><span class="sw" style="background:var(--chart-'+(i+1)+')"></span>'+U.esc(e.name)+'</span>').join('')+'</div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Maintenance calendar',sub:'Next 90 days',icon:'calendar-days',body:(function(){
      const items=S.db().equipment.slice().sort((a,b)=>String(a.nextPM).localeCompare(String(b.nextPM))).slice(0,6);
      return items.map(e=>{ const d=daysToPM(e); const late=overdue(e);
        return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.4px">'+U.esc(e.name)+'</div><div class="lr-sub">'+U.esc(e.manufacturer)+' · '+(late?'overdue':'in '+d+' days')+'</div></div><span class="pill '+(late?'rose':'slate')+'">'+U.fmtDateShort(e.nextPM)+'</span></div>'; }).join('');
    })()})+'</div>'
   +'<div class="c12">'+UI.card({title:'Cold chain · 24 h trace',sub:'Blood bank fridge · excursion flags trigger a non-conformance',icon:'thermometer',
      tools:'<a class="btn xs" href="#/stock">Stock</a>',body:'<div id="coldTrend"></div><div class="row wrap gap-sm" style="margin-top:10px">'+S.db().coldChain.slice(0,4).map(c=>'<span class="pill '+(c.temp>c.max||c.temp<c.min?'rose':'teal')+'">'+U.esc(c.device)+' · '+c.temp+' °C · '+U.relTime(c.at)+'</span>').join('')+'</div>'})+'</div></div>';
}
function pmView(){
  const list=S.db().equipment;
  return '<div class="card table-card"><div class="toolbar"><div><div class="card-title">'+UI.ic('wrench',14,'ic')+'Preventive maintenance plan</div><div class="card-sub">Manufacturer schedule · last service and next due</div></div><span class="grow"></span><button class="btn sm" data-logpm>'+UI.ic('plus',13)+'Record service</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>Analyser</th><th>Serial</th><th>Last service</th><th>Next PM</th><th>Window</th><th>Uptime</th><th>Status</th><th></th></tr></thead><tbody>'
   +list.map(e=>{ const d=daysToPM(e); const late=overdue(e);
      return '<tr><td><div class="primary-cell"><b>'+U.esc(e.name)+'</b><small>'+U.esc(e.model)+'</small></div></td><td class="mono xs">'+U.esc(e.serial)+'</td>'
      +'<td class="num">'+U.fmtDate(e.lastPM)+'</td><td class="num" style="color:'+(late?'var(--crit)':'')+'">'+U.fmtDate(e.nextPM)+'</td>'
      +'<td>'+(late?'<span class="pill rose">'+Math.abs(d)+'d overdue</span>':d<=30?'<span class="pill amber">in '+d+'d</span>':'<span class="pill slate">in '+d+'d</span>')+'</td>'
      +'<td class="mono small">'+e.uptime+'%</td><td><span class="pill '+(STATUS[e.status]||['','slate'])[1]+'">'+(STATUS[e.status]||['—'])[0]+'</span></td>'
      +'<td><div class="row" style="gap:2px"><button class="icon-btn" style="width:26px;height:26px" data-editeq="'+e.id+'" aria-label="Edit equipment">'+UI.ic('pencil',13)+'</button><button class="icon-btn" style="width:26px;height:26px" data-eqrow="'+e.id+'">'+UI.ic('chevron-right',14)+'</button></div></td></tr>'; }).join('')
   +'</tbody></table></div><div class="card-foot"><span>PM completion is an ISO 15189 clause 6.4 requirement</span><span class="mono">'+list.length+' assets</span></div></div>';
}
function logPM(preId){
  if(!LS.auth.guard('edit')) return;
  const eqs=S.db().equipment;
  UI.modal({title:'Record a service event',sub:'Past events can be back-dated — the register keeps the full service history, not just the latest.',width:'min(600px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Analyser</label><select class="select" id="pmEq">'+eqs.map(e=>'<option value="'+e.id+'"'+(preId===e.id?' selected':'')+'>'+U.esc(e.name+' · '+e.serial)+'</option>').join('')+'</select></div>'
     +'<div class="field"><label>Service date</label><input class="input" type="date" id="pmDate" value="'+U.todayISO()+'" max="'+U.todayISO()+'"></div>'
     +'<div class="field"><label>Event type</label><select class="select" id="pmType"><option>PM</option><option>Repair</option><option>Calibration</option><option>Installation</option><option>Incident</option></select></div>'
     +'<div class="field"><label>Engineer / performed by</label><input class="input" id="pmBy" value="'+U.esc(LS.auth.user.name)+'"></div>'
     +'<div class="field"><label>Downtime (hours)</label><input class="input mono" type="number" min="0" step="0.5" id="pmHours" value="0"></div>'
     +'<div class="field span2"><label>Work performed</label><textarea class="textarea" id="pmNote" placeholder="Probe cleaning, calibration verification, lamp replacement…"></textarea></div></div>'
     +'<div class="hint" style="margin-top:8px">Saving a back-dated event does not move the next-PM date backwards; the latest service in the log always sets the clock.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Record service</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const id=el.querySelector('#pmEq').value, date=el.querySelector('#pmDate').value;
        if(!date) return UI.toast('Pick the service date',{type:'warn'});
        if(date>U.todayISO()) return UI.toast('Use a date today or earlier',{type:'warn'});
        const type=el.querySelector('#pmType').value, by=el.querySelector('#pmBy').value.trim(), hours=+el.querySelector('#pmHours').value||0;
        const note=el.querySelector('#pmNote').value.trim()||type+' recorded';
        let next=null;
        S.commit(d=>{ const e=d.equipment.find(x=>x.id===id); if(!e) return;
          e.services=e.services||[];
          e.services.push({date,type,by,note,hours});
          if(!e.downtime) e.downtime=[];
          e.downtime.push({date,type,by,note,hours});
          const latest=e.services.map(x=>x.date).sort().pop();
          e.lastPM=latest; e.pmIntervalDays=e.pmIntervalDays||180;
          e.nextPM=U.addDays(latest,e.pmIntervalDays);
          next=e.nextPM;
          if(e.status==='offline'&&type!=='Incident') e.status='operational';
        },{action:'equipment.pm',entity:'equipment',entityId:id,detail:type+' recorded '+date+' by '+by+' · '+note});
        close(); LS.shell.refresh();
        UI.toast('Service recorded · '+(next?'next PM '+U.fmtDate(next):''),{type:'ok'});
      };
    }});
}
function equipmentModal(id){
  if(!LS.auth.guard('edit')) return;
  const e=id?S.db().equipment.find(x=>x.id===id):null;
  UI.modal({title:e?'Edit equipment record':'Add equipment',sub:'Admin only · the register feeds maintenance scheduling, QC links and the exported asset list.',width:'min(680px,100%)',
    body:'<div class="form-grid">'
      +'<div class="field span2"><label>Equipment name</label><input class="input" id="eqName" value="'+U.esc(e?e.name:'')+'" placeholder="e.g. Sysmex XN-550"></div>'
      +'<div class="field"><label>Model</label><input class="input" id="eqModel" value="'+U.esc(e?e.model:'')+'"></div>'
      +'<div class="field"><label>Manufacturer</label><input class="input" id="eqManu" value="'+U.esc(e?e.manufacturer:'')+'"></div>'
      +'<div class="field"><label>Serial number</label><input class="input mono" id="eqSerial" value="'+U.esc(e?e.serial:'')+'"></div>'
      +'<div class="field"><label>Location</label><input class="input" id="eqLoc" value="'+U.esc(e?e.location:'')+'"></div>'
      +'<div class="field"><label>Status</label><select class="select" id="eqStatus">'+Object.keys(STATUS).map(k=>'<option value="'+k+'"'+((e?e.status:'operational')===k?' selected':'')+'>'+STATUS[k][0]+'</option>').join('')+'</select></div>'
      +'<div class="field"><label>Uptime (30 d, %)</label><input class="input mono" type="number" min="0" max="100" step="0.1" id="eqUptime" value="'+(e?e.uptime:100)+'"></div>'
      +'<div class="field"><label>Commissioned on</label><input class="input" type="date" id="eqInstalled" value="'+U.esc(e&&e.installed?e.installed:'')+'"></div>'
      +'<div class="field"><label>Last service</label><input class="input" type="date" id="eqLast" value="'+U.esc(e&&e.lastPM?String(e.lastPM).slice(0,10):'')+'"></div>'
      +'<div class="field"><label>PM interval (days)</label><input class="input mono" type="number" min="15" step="15" id="eqInterval" value="'+(e&&e.pmIntervalDays?e.pmIntervalDays:180)+'"></div>'
      +'<div class="field span2"><label>Notes</label><textarea class="textarea" id="eqNote" rows="2" placeholder="Service contract, known faults, accessories…">'+U.esc(e?e.note||'':'')+'</textarea></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Save equipment</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#eqName').value.trim();
        if(!name) return UI.toast('Equipment name required',{type:'warn'});
        const rec={name,model:el.querySelector('#eqModel').value.trim(),manufacturer:el.querySelector('#eqManu').value.trim(),
          serial:el.querySelector('#eqSerial').value.trim()||'—',location:el.querySelector('#eqLoc').value.trim(),
          status:el.querySelector('#eqStatus').value,uptime:+el.querySelector('#eqUptime').value||0,
          installed:el.querySelector('#eqInstalled').value||null,
          pmIntervalDays:Math.max(15,+el.querySelector('#eqInterval').value||180),
          note:el.querySelector('#eqNote').value.trim()};
        rec.lastPM=el.querySelector('#eqLast').value||null;
        rec.nextPM=rec.lastPM?U.addDays(rec.lastPM,rec.pmIntervalDays):null;
        S.commit(d=>{
          if(e){ const x=d.equipment.find(y=>y.id===e.id); if(x){ Object.assign(x,rec); x.services=x.services||[]; x.downtime=x.downtime||[]; } }
          else { const id=U.uid('eq'); d.equipment.push(Object.assign({id,services:[],downtime:[]},rec)); }
        },{action:'equipment.'+(e?'edit':'add'),entity:'equipment',entityId:e?e.id:rec.name,detail:rec.name+' · '+rec.serial});
        close(); LS.shell.refresh(); UI.toast(e?'Equipment record updated':'Equipment added to the register',{type:'ok'});
      };
    }});
}
function eqDrawer(id){
  const e=S.db().equipment.find(x=>x.id===id); if(!e) return;
  const d=daysToPM(e);
  const related=S.db().qc.analytes.filter(a=>a.analyzer===e.name);
  const hist=history(e);
  const last=lastService(e);
  UI.drawer({title:e.name,eyebrow:'Equipment record',sub:e.model+' · '+e.location,wide:true,body:
    '<div class="split-4">'+[['Uptime 30d',e.uptime+'%'],['Status',(STATUS[e.status]||['—'])[0]],['Next PM',U.fmtDateShort(e.nextPM)],['Serial',e.serial]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:'+(String(v).length>12?'10.5px':'13px')+'">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="section-head"><h2>Service & downtime history</h2><span class="more">'+hist.length+' events</span></div>'
    +'<div class="custody">'+(hist.length?hist.map(ev=>'<div class="custody-item"><span class="custody-dot"></span><div class="custody-body"><div class="custody-title">'+U.esc(ev.type||'Event')+' <span class="xs faint">'+(ev.hours?ev.hours+' h downtime':'')+'</span></div><div class="custody-meta">'+U.fmtDate(ev.date)+(ev.by?' · '+U.esc(ev.by):'')+' · '+U.esc(ev.note||'')+'</div></div></div>').join(''):'<p class="xs faint" style="padding-left:22px">No service events recorded yet — use “Record service” and back-date past visits.</p>')+'</div>'
    +'<div class="hint" style="margin-top:8px">Latest service: '+(last?U.fmtDate(last.date)+' ('+U.esc(last.type)+')':'—')+' · PM interval '+(e.pmIntervalDays||180)+' days</div>'
    +'<div class="section-head"><h2>Linked quality control</h2></div>'
    +(related.length?related.map(a=>{ const run=S.db().qc.runs[a.key]; const l=run?run.points[run.points.length-1]:null;
        return '<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(a.key)+' <span class="xs faint">· '+a.level+'</span></div><div class="lr-sub">Mean '+a.mean+' ± '+a.sd+' '+U.esc(a.unit)+'</div></div><span class="pill '+(l&&Math.abs(l.z)>2?'amber':'teal')+'">'+(l?((l.z>0?'+':'')+l.z+' SD'):'no runs')+'</span></div>'; }).join(''):'<p class="xs faint">No QC scheme linked to this analyser.</p>')
    +'<div class="card pad" style="background:var(--surface-inset);margin-top:14px"><div class="eyebrow">Specification</div><div class="split-2" style="margin-top:6px">'+[['Manufacturer',e.manufacturer],['Install date',e.installed||U.addDays(e.lastPM,-900)],['Serial',e.serial],['Location',e.location]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11px">'+U.esc(v)+'</span></div>').join('')+'</div>'
      +(e.note?'<div class="xs faint" style="margin-top:8px">'+U.esc(e.note)+'</div>':'')+'</div>'
    +'<div class="hint" style="margin-top:12px">Uptime is derived from the maintenance log. Downtime over 24 h escalates to the district biomedical engineer.</div>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit-eq>'+UI.ic('pencil',15)+'Edit details</button><button class="btn" data-flag>'+UI.ic('alert-triangle',15)+'Flag fault</button><button class="btn primary" data-pm>'+UI.ic('wrench',15)+'Record service</button>',
    onMount:(panel,close)=>{
      panel.querySelector('[data-pm]').onclick=()=>{ close(); logPM(e.id); };
      panel.querySelector('[data-edit-eq]').onclick=()=>{ close(); equipmentModal(e.id); };
      panel.querySelector('[data-flag]').onclick=()=>{
        S.commit(db=>{ const x=db.equipment.find(y=>y.id===e.id); if(x) x.status='offline'; },{action:'equipment.flag',entity:'equipment',entityId:e.id,detail:e.name+' flagged offline'});
        close(); LS.shell.refresh(); UI.toast(e.name+' flagged offline · biomedical engineer notified',{type:'warn'});
      };
    }});
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'fleet';
  root.innerHTML='<div class="page-head"><div><h1>Equipment &amp; facilities</h1><div class="sub">Every analyser, its uptime, its service clock and the cold chain that keeps results valid — in one register.</div></div>'
   +'<div class="actions"><button class="btn" data-logpm>'+UI.ic('wrench',15)+' Record service</button><button class="btn" data-addeq>'+UI.ic('plus',15)+' Add equipment</button><button class="btn primary" data-export>'+UI.ic('download',15)+' Export register</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['fleet','Fleet'],['pm','Maintenance plan']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-e-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="eqBody"></div>';
  const paint=()=>{
    const host=root.querySelector('#eqBody');
    host.innerHTML=tab==='pm'?pmView():fleet()+uptimeChart();
    U.$$('[data-e-tab]',root).forEach(b=>b.classList.toggle('on',b.dataset.eTab===tab));
    if(tab!=='pm'){
      const months=['May','Jun','Jul','Aug','Sep','Oct'];
      const eqs=S.db().equipment.slice(0,4);
      C.line(host.querySelector('#eqTrend'),{id:'eqTrend',height:240,min:60,max:100,labels:months,series:eqs.map((e,i)=>({name:e.name,color:'var(--chart-'+(i+1)+')',values:[e.uptime-3,e.uptime-2,e.uptime-1.4,e.uptime-0.8,e.uptime-0.4,e.uptime].map(v=>+v.toFixed(1))})),yFmt:v=>Math.round(v)+'%'});
      const temps=[2.4,3.1,4.8,5.2,6.9,7.1,6.2,5.4,4.1,3.8,3.2,2.9,9.4,8.6,6.1,5.2,4.4,3.9,3.5,3.1,2.8,2.6,2.4,2.3];
      C.line(host.querySelector('#coldTrend'),{id:'coldTrend',height:190,min:0,max:12,labels:temps.map((_,i)=>i+':00'),series:[{name:'Fridge °C',color:'var(--chart-1)',values:temps}],yFmt:v=>v+'°',bands:[{from:2,to:8,color:'rgba(63,211,182,.08)'}],target:8,targetLabel:'Upper limit'});
    }
    host.querySelectorAll('[data-eq],[data-eqrow]').forEach(el=>el.onclick=()=>eqDrawer(el.dataset.eq||el.dataset.eqrow));
    U.$$('[data-logpm]',root).forEach(b=>b.onclick=()=>logPM());
    U.$$('[data-addeq]',root).forEach(b=>b.onclick=()=>equipmentModal(null));
    U.$$('[data-editeq]',root).forEach(b=>b.onclick=()=>equipmentModal(b.dataset.editeq));
  };
  U.$$('[data-e-tab]',root).forEach(b=>b.onclick=()=>{ tab=b.dataset.eTab; paint(); });
  root.querySelector('[data-export]').onclick=()=>{
    U.exportCSV('equipment-register-'+U.todayISO()+'.csv',[['Asset','Model','Manufacturer','Serial','Location','Status','Uptime %','Last service','Next PM','Events']].concat(S.db().equipment.map(e=>[e.name,e.model,e.manufacturer,e.serial,e.location,e.status,e.uptime,e.lastPM,e.nextPM,e.downtime.length])),{title:'Equipment register — '+S.settings().labName,actor:LS.auth.user.name});
    UI.toast('Equipment register exported',{type:'ok'});
  };
  paint();
};
})();
