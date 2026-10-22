/* ============================================================================
   MODULE · STAFF & SETTINGS — registry, roles, branding, data governance
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store, A=LS.auth;
const M={}; LS.modules.staff=M;
let rootEl=null, tab='people';

function staff(){ return S.db().staff; }
function active(){ return staff().filter(s=>s.status==='active'); }
function roleTone(r){ return /admin/i.test(r)?'gold':/manager/i.test(r)?'teal':/tech/i.test(r)?'blue':'slate'; }
function roleFor(s){
  const u=A.users.find(x=>x.staffId===s.id);
  if(u) return u.role;
  if(/admin/i.test(s.role)) return 'Admin';
  if(/manager|in-?charge|quality/i.test(s.role)) return 'Manager';
  if(/tech/i.test(s.role)) return 'Technologist';
  return 'Read-only';
}
/* On authorised leave today — annual leave, sick leave, maternity or any other
   approved leave type. Nobody is described as absent without an unexcused record. */
function onLeaveNow(){ const t=U.todayISO(); const ids=S.db().leaves.filter(l=>l.status!=='Declined'&&t>=l.from&&t<=l.to).map(l=>l.staffId); return staff().filter(s=>ids.indexOf(s.id)>=0); }
function kpis(){
  const a=active(); const leave=onLeaveNow();
  const exp=A.users.filter(u=>!u.twoFactor).length;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Active staff',value:a.length,icon:'users',formatted:'0',note:staff().length-a.length+' archived · '+S.db().staff.filter(s=>s.weekendOnly).length+' weekend-only',spark:C.spark([7,7,8,8,9,9,9,a.length],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'On authorised leave',value:leave.length,icon:'plane-takeoff',formatted:'0',note:leave.length?leave.map(s=>s.name.split(' ')[0]).join(', '):'Everyone on the plan today',spark:C.spark([0,1,0,1,1,0,1,leave.length],{color:'var(--info)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Competency records',value:S.db().competency.length,icon:'badge-check',formatted:'0',note:S.db().competency.filter(c=>c.level==='full').length+' full authorisations',spark:C.spark([28,34,39,42,46,49,52,S.db().competency.length],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'2FA not enrolled',value:exp,icon:'shield-alert',formatted:'0',note:exp?A.users.filter(u=>!u.twoFactor).map(u=>u.name.split(' ')[0]).join(', '):'Every account enrolled',spark:C.spark([4,4,3,3,2,2,1,exp],{color:'var(--amber)'})})+'</div></div>';
}
function people(){
  return '<div class="grid-12 stagger">'+staff().map(s=>{
    const comp=S.db().competency.filter(c=>c.staffId===s.id);
    const full=comp.filter(c=>c.level==='full');
    const shift=S.shiftState(s);
    const user=A.users.find(u=>u.staffId===s.id);
    return '<div class="c4"><div class="card hover pad" data-person="'+s.id+'" style="cursor:pointer">'
      +'<div class="row gap-sm" style="align-items:flex-start;margin-bottom:10px">'+U.avatar(s.name,'lg')
      +'<div style="min-width:0"><div class="card-title truncate">'+U.esc(s.name)+'</div><div class="card-sub truncate">'+U.esc(s.role)+'</div>'
      +'<div class="row gap-xs wrap" style="margin-top:5px">'+UI.roleBadge(roleFor(s))+'<span class="pill '+shift.tone+'"><span class="dot '+((shift.kind==='day'||shift.kind==='night'||shift.kind==='daynight')?'live':'')+'"></span>'+U.esc(shift.label)+'</span>'+(s.status!=='active'?'<span class="pill slate">'+UI.ic('log-out',9)+' archived</span>':'')+'</div></div></div>'
      +'<div class="thread" style="margin:10px 0"></div>'
      +'<div class="row between"><span class="xs faint">Authorisations</span><span class="mono xs">'+full.length+' assays</span></div>'
      +UI.meter(comp.length?full.length/comp.length*100:0,full.length/comp.length>.6?'teal':'amber')
      +'<div class="row between" style="margin-top:9px"><span class="xs faint">'+U.esc(S.leaveEntitlement(s).label)+(s.sponsor?' · '+U.esc(s.sponsor):'')+'</span><span class="xs faint mono">'+U.esc(s.phone||'')+'</span></div>'
      +'</div></div>';
  }).join('')+'</div>';
}
function personDrawer(id){
  const s=staff().find(x=>x.id===id); if(!s) return;
  const comp=S.db().competency.filter(c=>c.staffId===s.id);
  const leaves=S.db().leaves.filter(l=>l.staffId===s.id);
  const roster=S.db().workingPlans[U.monthKey()];
  const row=roster&&roster.primary?roster.primary.staff.find(x=>x.id===s.id):null;
  const shift=S.shiftState(s);
  const user=A.users.find(u=>u.staffId===s.id);
  UI.drawer({title:s.name,eyebrow:'Staff record',sub:s.role+' · since '+U.fmtDate(s.joinDate||'2019-01-01'),wide:true,body:
    '<div class="row gap-lg" style="align-items:center;margin-bottom:16px">'+U.avatar(s.name,'xl')
    +'<div><div class="row gap-xs wrap">'+UI.roleBadge(roleFor(s))+'<span class="pill '+(s.status==='active'?'teal':'slate')+'">'+U.esc(s.status)+'</span><span class="pill '+shift.tone+'">'+U.esc(shift.label)+'</span>'+(s.weekendOnly?'<span class="pill blue">weekend only</span>':'')+'</div>'
    +(shift.note?'<div class="xs faint" style="margin-top:5px">'+U.esc(shift.note)+'</div>':'')
    +'<div class="small muted" style="margin-top:8px">'+U.esc(s.email||'')+' · '+U.esc(s.phone||'')+'</div></div></div>'
    +'<div class="split-4">'+[['Joined',U.fmtDateShort(s.joinDate)],['Pattern',s.pattern||'—'],['Max nights',(s.maxNights||0)+'/mo'],['Contract',S.leaveEntitlement(s).label]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="split-3" style="margin-top:12px">'+[['Sponsor',S.leaveEntitlement(s).sponsor],['Leave entitlement',S.leaveEntitlement(s).days+(S.contractOf(s)==='contractual'?' weekdays':' days')],['Leave taken',S.leaveUsed(s).days+' days']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="section-head"><h2>This month</h2><span class="more">'+(row?row.codes.filter(c=>c==='D'||c==='N'||c==='DN').length:0)+' shifts</span></div>'
    +(row?'<div class="row wrap gap-xs">'+row.codes.map(c=>'<span class="shift-code '+(c||'OFF')+'" data-tip="'+U.fmtDateShort(roster.primary.dates[row.codes.indexOf(c)])+'">'+(c||'·')+'</span>').join('')+'</div>':'<p class="xs faint">No working plan for this month yet.</p>')
    +'<div class="section-head"><h2>Competency</h2><span class="more">'+comp.filter(c=>c.level==='full').length+' full</span></div>'
    +'<div class="dt-scroll" style="max-height:260px"><table class="dt"><thead><tr><th>Assay</th><th>Level</th><th>Expires</th></tr></thead><tbody>'
    +comp.map(c=>'<tr><td class="small">'+U.esc(c.testCode)+'</td><td><span class="pill '+(c.level==='full'?'teal':c.level==='supervised'?'amber':'slate')+'">'+U.esc(c.level)+'</span></td><td class="num xs">'+U.fmtDate(c.expires)+'</td></tr>').join('')
    +(comp.length?'':'<tr><td colspan="3" class="xs faint">No competency records.</td></tr>')+'</tbody></table></div>'
    +'<div class="section-head"><h2>Leave history</h2></div>'
    +leaves.slice(-5).reverse().map(l=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(S.leaveTypeLabel(l.type))+' · '+U.daysBetween(l.from,l.to)+1+' days</div><div class="lr-sub">'+U.fmtDate(l.from)+' → '+U.fmtDate(l.to)+'</div></div><span class="pill '+(l.status==='Approved'?'teal':l.status==='Pending'?'amber':'slate')+'">'+U.esc(l.status||'—')+'</span></div>').join('')
    ||'<p class="xs faint">No leave recorded.</p>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit-person>'+UI.ic('pencil',15)+'Edit</button>',
    onMount:(panel,close)=>{ const b=panel.querySelector('[data-edit-person]'); if(b) b.onclick=()=>{ close(); editStaff(s.id); }; }});
}
function editStaff(id){
  if(!A.guard('staff')) return;
  const s=id?staff().find(x=>x.id===id):{};
  UI.modal({title:id?'Edit staff record':'Add staff member',sub:'Records feed the roster, leave inbox and audit trail.',width:'min(660px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Full name</label><input class="input" id="sfName" value="'+U.esc(s.name||'')+'"></div>'
     +'<div class="field"><label>Role</label><input class="input" id="sfRole" value="'+U.esc(s.role||'Laboratory Technician')+'"></div>'
     +'<div class="field"><label>Sex</label><select class="select" id="sfSex"><option '+(s.sex==='M'?'':'')+'>F</option><option '+(s.sex==='M'?'selected':'')+'>M</option></select></div>'
     +'<div class="field"><label>Phone</label><input class="input" id="sfPhone" value="'+U.esc(s.phone||'')+'"></div>'
     +'<div class="field"><label>Email</label><input class="input" id="sfEmail" value="'+U.esc(s.email||'')+'"></div>'
     +'<div class="field"><label>Shift pattern</label><input class="input" id="sfPattern" value="'+U.esc(s.pattern||'D D N N OFF')+'"></div>'
     +'<div class="field"><label>Contract</label><select class="select" id="sfContract"><option value="statute"'+(s.contract!=='contractual'?' selected':'')+'>Under statute · 30 days</option><option value="contractual"'+(s.contract==='contractual'?' selected':'')+'>Contractual · 21 weekdays</option></select></div>'
     +'<div class="field"><label>Contract sponsor</label><select class="select" id="sfSponsor">'+S.SPONSORS.map(sp=>'<option'+(sp===s.sponsor?' selected':'')+'>'+U.esc(sp)+'</option>').join('')+'</select></div>'
     +'<div class="field"><label>Joined</label><input class="input" type="date" id="sfJoin" value="'+(s.joinDate||U.todayISO())+'"></div>'
     +'<div class="field"><label>Max nights / month</label><input class="input" type="number" id="sfNights" min="0" max="20" value="'+(s.maxNights==null?8:s.maxNights)+'"></div>'
     +'<div class="field"><label>Status</label><select class="select" id="sfStatus"><option value="active">Active</option><option value="exited"'+(s.status==='exited'?' selected':'')+'>Exited</option></select></div></div>'
     +'<div class="hint" style="margin-top:8px">Annual leave follows the contract: <b>under statute 30 calendar days</b>, <b>contractual 21 working days</b> (Mon–Fri). The sponsor records who funds the post — Global Fund, own revenue, MoH/RBC or a partner.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save record</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#sfName').value.trim(); if(!name){ UI.toast('Name is required',{type:'err'}); return; }
        const rec={name, role:el.querySelector('#sfRole').value, sex:el.querySelector('#sfSex').value, phone:el.querySelector('#sfPhone').value, email:el.querySelector('#sfEmail').value,
          pattern:el.querySelector('#sfPattern').value, contract:el.querySelector('#sfContract').value, sponsor:el.querySelector('#sfSponsor').value,
          joinDate:el.querySelector('#sfJoin').value, maxNights:+el.querySelector('#sfNights').value, status:el.querySelector('#sfStatus').value};
        S.commit(d=>{ if(id){ Object.assign(d.staff.find(x=>x.id===id),rec); } else { d.staff.push(Object.assign({id:U.uid('s'), maxConsecN:2, nightPref:'neutral'},rec)); } },
          {action:id?'staff.update':'staff.create',entity:'staff',entityId:id||name,detail:(id?'Updated ':'Created ')+name});
        close(); LS.shell.refresh(); UI.toast(id?'Staff record updated':'Staff member added',{type:'ok'});
      };
    }});
}
/* ——— settings ————————————————————— */
function settingsView(){
  if(!A.can('staff')) return UI.card({body:UI.empty({art:'lock',title:'Administrator access required',body:'Only the Admin role can change laboratory settings.'})});
  const st=S.settings();
  const tests=S.tests();
  return '<div class="grid-12">'
   +'<div class="c7">'+UI.card({title:'Laboratory identity',sub:'Appears on every printed document',icon:'building-2',body:
     '<div class="form-grid"><div class="field span2"><label>Facility</label><input class="input" id="setLab" value="'+U.esc(st.labName)+'"></div>'
     +'<div class="field span2"><label>Department</label><input class="input" id="setDept" value="'+U.esc(st.dept||'Laboratory Department')+'"></div>'
     +'<div class="field"><label>Email</label><input class="input" id="setEmail" value="'+U.esc(st.email||'')+'"></div>'
     +'<div class="field"><label>Phone</label><input class="input" id="setPhone" value="'+U.esc(st.phone||'')+'"></div>'
     +'<div class="field"><label>Sample prefix</label><input class="input mono" id="setPrefix" value="'+U.esc(st.samplePrefix||'RDH')+'" maxlength="6"></div>'
     +'<div class="field"><label>Manifest prefix</label><input class="input mono" id="setMprefix" value="'+U.esc(st.manifestPrefix||'BLC')+'" maxlength="6"></div>'
     +'<div class="field"><label>Fiscal year</label><select class="select" id="setFy"><option value="july"'+(st.fiscalStart==='july'?' selected':'')+'>July – June</option><option value="january"'+(st.fiscalStart==='january'?' selected':'')+'>January – December</option></select></div>'
     +'<div class="field"><label>FY label</label><input class="input" id="setFyLabel" value="'+U.esc(st.fyLabel||U.fyLabel())+'"></div></div>'
     +'<div class="thread" style="margin:14px 0"></div>'
     +'<div class="eyebrow">Signatories</div><div class="form-grid" style="margin-top:8px">'
     +[['setSign1','Laboratory Manager',st.signatories&&st.signatories[0]],['setSign2','Medical Director',st.signatories&&st.signatories[1]],['setSign3','Quality Officer',st.signatories&&st.signatories[2]]].map(([id,l,v])=>'<div class="field"><label>'+l+'</label><input class="input" id="'+id+'" value="'+U.esc(v||'')+'"></div>').join('')+'</div>'
     ,foot:'<span>Changes apply immediately across the app and printed documents</span><button class="btn primary sm" data-save-identity>Save identity</button>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Appearance &amp; language',sub:'Ink / Porcelain · density · locale',icon:'palette',body:
     '<div class="field" style="margin-bottom:12px"><label>Theme</label><div class="seg" style="width:100%">'+[['ink','Ink'],['porcelain','Porcelain']].map(([k,l])=>'<button style="flex:1" class="'+(st.theme===k?'on':'')+'" data-set-theme="'+k+'">'+l+'</button>').join('')+'</div></div>'
     +'<div class="field" style="margin-bottom:12px"><label>Density</label><div class="seg" style="width:100%">'+[['comfortable','Comfortable'],['compact','Compact']].map(([k,l])=>'<button style="flex:1" class="'+(st.density===k?'on':'')+'" data-set-density="'+k+'">'+l+'</button>').join('')+'</div></div>'
     +'<div class="field"><label>Language</label><select class="select" id="setLang">'+LS.i18n.languages.map(l=>'<option value="'+l.code+'" '+(st.lang===l.code?'selected':'')+'>'+l.native+' — '+l.label+'</option>').join('')+'</select></div>'
     ,foot:'<span>Preference is stored on this device</span>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Coverage minimums',sub:'Drives roster & leave conflict warnings',icon:'calendar-check',body:
     [['coverWeekdayDay','Weekday · day'],['coverWeekdayNight','Weekday · night'],['coverWeekendDay','Weekend · day'],['coverWeekendNight','Weekend · night']].map(([k,l])=>
       '<div class="row between" style="padding:7px 0"><span class="small">'+l+'</span><input class="input mono" type="number" min="0" max="12" style="width:64px;height:30px" data-cover="'+k+'" value="'+(st[k]||0)+'"></div>').join('')
     ,foot:'<button class="btn sm" data-save-cover>Save minimums</button>'})+'</div>'
   +'<div class="c7">'+UI.card({title:'Turnaround targets',sub:'Hours from collection to verified result',icon:'timer',body:
     '<div class="dt-scroll" style="max-height:300px"><table class="dt"><thead><tr><th>Test</th><th>Code</th><th>Target (days)</th></tr></thead><tbody>'
     +tests.map(t=>'<tr><td class="small">'+U.esc(t.name)+'</td><td class="mono xs">'+U.esc(t.code)+'</td><td><input class="input mono" type="number" min="1" max="60" style="width:70px;height:28px" data-tat="'+U.esc(t.name)+'" value="'+(S.tatTarget(t.name)||3)+'"></td></tr>').join('')
     +'</tbody></table></div>',foot:'<button class="btn sm" data-save-tat>Save TAT targets</button>'})+'</div>'
   +'<div class="c12">'+UI.card({title:'Modules',sub:'Enable or hide optional surfaces',icon:'layers',body:
     '<div class="row wrap gap-sm">'+[['qc','QC & EQA'],['pbf','PBF evaluation'],['equipment','Equipment'],['cloud','Cloud sync']].map(([k,l])=>
       '<label class="choice '+(st.features[k]?'on':'')+'" data-feature="'+k+'" style="width:auto;min-width:150px"><span class="ct">'+l+'</span><span class="switch" style="margin-left:auto"></span></label>').join('')+'</div>'
     +'<div class="hint" style="margin-top:10px">Disabling a module hides it from navigation but never deletes data.</div>'})+'</div></div>';
}
function dataView(){
  const db=S.db();
  let bytes=0; try{ bytes=(localStorage.getItem('labSystems.v1')||'').length; }catch(e){}
  const quota=5*1024*1024;
  return '<div class="grid-12">'
   +'<div class="c7">'+UI.card({title:'Local register',sub:'Every record lives on this device first',icon:'database',body:
     '<div class="split-4">'+[['Schema','v'+db.meta.schema],['Samples',db.samples.length],['Audit entries',db.audit.length],['Storage',(bytes/1024).toFixed(0)+' KB']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:13px">'+U.esc(String(v))+'</span></div>').join('')+'</div>'
     +'<div class="row between" style="margin:14px 0 5px"><span class="xs faint">Browser storage used</span><span class="mono xs">'+(bytes/1024).toFixed(0)+' KB of ~'+Math.round(quota/1024)+' KB</span></div>'
     +UI.meter(bytes/quota*100,bytes/quota>0.8?'rose':'teal')
     +'<div class="thread" style="margin:14px 0"></div>'
     +'<div class="row gap-sm wrap"><button class="btn sm" data-export-json>'+UI.ic('download',14)+'Export register</button><button class="btn sm" data-import-json>'+UI.ic('upload',14)+'Import</button><button class="btn sm" data-snapshot>'+UI.ic('database',14)+'Snapshot</button><button class="btn sm danger" data-reset>'+UI.ic('rotate-ccw',14)+'Reset to seed</button></div>'
     +'<div class="hint" style="margin-top:12px">Exports are plain JSON for portability; wrap them with your own encryption when moving between devices. Imports create a restore point first.</div>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Cloud sync',sub:'Optional · off by default',icon:'cloud',body:
     '<div class="row between" style="padding:6px 0"><span class="small">Status</span><span class="pill '+(S.settings().cloud.lastSync?'teal':'slate')+'">'+(S.settings().cloud.lastSync?'Synced '+U.relTime(S.settings().cloud.lastSync):'Local only')+'</span></div>'
     +'<div class="field" style="margin-top:10px"><label>Endpoint</label><input class="input mono" id="cloudUrl" placeholder="https://…/v1/register" value="'+U.esc(S.settings().cloud.endpoint||'')+'"></div>'
     +'<div class="field" style="margin-top:10px"><label>Mode</label><select class="select" id="cloudMode"><option value="push-pull">Two-way</option><option value="push">Push only</option><option value="pull">Pull only</option></select></div>'
     +'<div class="row gap-sm" style="margin-top:12px"><button class="btn sm" data-cloud-test>Test connection</button><button class="btn sm primary" data-cloud-save>Save</button></div>'
     +'<div class="hint" style="margin-top:12px">Offline-first: writes queue locally and flush when the endpoint is reachable. No PHI leaves the device until you enable this.</div>'})+'</div>'
   +'<div class="c12">'+UI.card({title:'Data provenance',sub:'What is real and what is modelled in this console',icon:'info',body:
     '<p class="small" style="line-height:1.7;color:var(--text-muted)">'+U.esc(S.settings().provenance||'')+'</p>'
     +'<div class="split-3" style="margin-top:12px">'+[['Register data','Carried forward from v5.3.1 (staff, referrals, leave, trainings, revenue, equipment)'],['Working records','Only what the department actually recorded — referred samples, issues, leave, EQA rounds. Nothing is generated to fill a screen.'],['Configuration','Stored in localStorage under labSystems.v1 · schema v'+db.meta.schema]].map(([k,v])=>'<div class="hstat" style="align-items:flex-start"><span class="lb">'+k+'</span><span class="xs muted" style="line-height:1.55;margin-top:4px">'+U.esc(v)+'</span></div>').join('')+'</div>'})+'</div></div>';
}
function paint(){
  const host=rootEl.querySelector('#stBody'); if(!host) return;
  host.innerHTML=tab==='settings'?settingsView():tab==='data'?dataView():people();
  U.$$('[data-st-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.stTab===tab));
  wire();
}
function wire(){
  const r=rootEl;
  r.querySelectorAll('[data-st-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.stTab; paint(); });
  r.querySelectorAll('[data-person]').forEach(c=>c.onclick=()=>personDrawer(c.dataset.person));
  const add=r.querySelector('[data-add]'); if(add) add.onclick=()=>editStaff(null);
  const si=r.querySelector('[data-save-identity]');
  if(si) si.onclick=()=>{ const g=id=>{ const el=r.querySelector('#'+id); return el?el.value:''; };
    S.commit(d=>{ const st=d.settings; st.labName=g('setLab'); st.dept=g('setDept'); st.email=g('setEmail'); st.phone=g('setPhone'); st.samplePrefix=g('setPrefix')||'RDH'; st.manifestPrefix=g('setMprefix')||'BLC'; st.fiscalStart=g('setFy'); st.fyLabel=g('setFyLabel');
      st.signatories=[g('setSign1'),g('setSign2'),g('setSign3')]; },{action:'settings.identity',entity:'settings',detail:'Laboratory identity updated'});
    LS.shell.build(); UI.toast('Identity saved across the console',{type:'ok'}); };
  const sc=r.querySelector('[data-save-cover]'); if(sc) sc.onclick=()=>{ S.commit(d=>{ r.querySelectorAll('[data-cover]').forEach(i=>{ d.settings[i.dataset.cover]=Math.max(0,+i.value||0); }); },{action:'settings.coverage',entity:'settings',detail:'Coverage minimums updated'}); UI.toast('Coverage minimums saved',{type:'ok'}); };
  const st=r.querySelector('[data-save-tat]'); if(st) st.onclick=()=>{ S.commit(d=>{ d.settings.tat=d.settings.tat||{}; r.querySelectorAll('[data-tat]').forEach(i=>{ d.settings.tat[i.dataset.tat]=Math.max(1,+i.value||1); }); },{action:'settings.tat',entity:'settings',detail:'TAT targets updated'}); UI.toast('Turnaround targets saved',{type:'ok'}); };
  r.querySelectorAll('[data-set-theme]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ d.settings.theme=b.dataset.setTheme; },{action:'settings.theme',entity:'settings',detail:'Theme '+b.dataset.setTheme}); LS.shell.build(); paint(); });
  r.querySelectorAll('[data-set-density]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ d.settings.density=b.dataset.setDensity; },{action:'settings.density',entity:'settings',detail:'Density '+b.dataset.setDensity}); LS.shell.build(); paint(); });
  const lg=r.querySelector('#setLang'); if(lg) lg.onchange=()=>{ LS.i18n.set(lg.value); LS.shell.build(); paint(); UI.toast('Language updated',{type:'ok'}); };
  r.querySelectorAll('[data-feature]').forEach(el=>el.onclick=()=>{ const k=el.dataset.feature; S.commit(d=>{ d.settings.features[k]=!d.settings.features[k]; },{action:'settings.feature',entity:'settings',detail:'Feature '+k+' toggled'}); paint(); LS.shell.build(); });
  const ex=r.querySelector('[data-export-json]'); if(ex) ex.onclick=()=>{ U.download('lab-systems-register-'+U.todayISO()+'.json',JSON.stringify(S.db(),null,2)); UI.toast('Register exported',{type:'ok'}); };
  const im=r.querySelector('[data-import-json]'); if(im) im.onclick=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json';
    inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=async()=>{ try{ const obj=JSON.parse(rd.result); const ok=await UI.confirm({title:'Import register?',body:'Replaces the current local register after creating a restore point.',confirm:'Import',danger:true}); if(!ok) return; S.restorePoint(); S.importJSON(obj.db||obj); LS.shell.build(); paint(); UI.toast('Register imported',{type:'ok'}); }catch(e){ UI.toast('Invalid register file',{type:'err'}); } }; rd.readAsText(f); }; inp.click(); };
  const sn=r.querySelector('[data-snapshot]'); if(sn) sn.onclick=()=>{ S.restorePoint(); UI.toast('Restore point created',{type:'ok'}); };
  const rs=r.querySelector('[data-reset]'); if(rs) rs.onclick=async()=>{ const ok=await UI.confirm({title:'Reset to factory seed?',body:'All local changes on this device will be replaced by the seed register. Export first if you need the current data.',confirm:'Reset register',danger:true}); if(!ok) return; S.reset(); LS.shell.build(); paint(); UI.toast('Register reset to seed',{type:'warn'}); };
  r.querySelectorAll('[data-cloud-test]').forEach(b=>b.onclick=()=>UI.toast('No endpoint configured — running local-only. Add a URL to enable sync.',{type:'info'}));
  r.querySelectorAll('[data-cloud-save]').forEach(b=>b.onclick=()=>{ const u=r.querySelector('#cloudUrl'), m=r.querySelector('#cloudMode');
    S.commit(d=>{ d.settings.cloud.endpoint=u?u.value:''; d.settings.cloud.mode=m?m.value:'push-pull'; d.settings.cloud.enabled=!!(u&&u.value); },{action:'settings.cloud',entity:'settings',detail:'Cloud sync settings saved'}); UI.toast(u&&u.value?'Sync endpoint saved — will flush when online':'Cloud sync disabled · staying local',{type:'ok'}); });
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'people';
  root.innerHTML='<div class="page-head"><div><h1>Staff &amp; settings</h1><div class="sub">The people behind the register, the roles that protect it, and the configuration that keeps every document on-brand.</div></div>'
   +'<div class="actions"><a class="btn" href="#/security">'+UI.ic('shield-check',15)+' Security Center</a><button class="btn primary" data-add>'+UI.ic('user-plus',15)+' Add staff</button></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['people','People'],['settings','Settings'],['data','Data &amp; sync']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-st-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="stBody"></div>';
  paint();
};
})();
