/* ============================================================================
   MODULE · STAFF & SETTINGS — registry, roles, branding, data governance
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store, A=LS.auth, SY=LS.sync;
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
function ageOf(s){
  if(!s.dob) return null;
  const b=U.parseISO(s.dob), t=U.parseISO(U.todayISO());
  let a=t.getFullYear()-b.getFullYear();
  const m=t.getMonth()-b.getMonth();
  if(m<0||(m===0&&t.getDate()<b.getDate())) a--;
  return a;
}
function tenureYears(s){
  if(!s.joinDate) return null;
  const end=(s.status!=='active'&&s.exitDate)?s.exitDate:U.todayISO();
  return Math.max(0,Math.round(U.daysBetween(s.joinDate,end)/365.25*10)/10);
}
function exitForecast(months){
  const horizon=U.addDays(U.todayISO(),Math.round(months*30.4));
  return staff().filter(s=>s.exitDate&&s.exitDate>=U.todayISO()&&s.exitDate<=horizon)
    .sort((a,b)=>String(a.exitDate).localeCompare(String(b.exitDate)));
}
function workforce(){
  const a=active();
  const ages=a.map(ageOf).filter(v=>v!=null);
  const bands=[['Under 30',ages.filter(v=>v<30).length],['30–39',ages.filter(v=>v>=30&&v<40).length],['40–49',ages.filter(v=>v>=40&&v<50).length],['50 and over',ages.filter(v=>v>=50).length]];
  const female=a.filter(s=>/^f/i.test(s.sex||'')).length, male=a.length-female;
  const forecast=exitForecast(12);
  return '<div class="section-head" style="margin-top:18px"><h2>Workforce profile</h2><span class="more">Read from birth dates, join dates and exit dates on the staff records</span></div>'
   +'<div class="grid-12 stagger">'
   +'<div class="c4">'+UI.card({title:'Age distribution',sub:a.length+' active staff · '+ages.length+' with a birth date',icon:'cake',body:'<div id="staffAge"></div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Sex ratio',sub:female+' female · '+male+' male',icon:'users',body:'<div id="staffSex"></div>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Tenure',sub:'Measured to exit date, or to today',icon:'hourglass',body:'<div id="staffTenure"></div>'})+'</div>'
   +'<div class="c12">'+UI.card({title:'Exit forecast · next 12 months',sub:forecast.length+' recorded exit'+(forecast.length===1?'':'s')+' in the window',icon:'calendar-x',
      body:forecast.length?'<div class="dt-scroll"><table class="dt"><thead><tr><th>Name</th><th>Role</th><th>Exit date</th><th>Tenure</th><th>In</th></tr></thead><tbody>'
        +forecast.map(s=>'<tr><td class="strong">'+U.esc(s.name)+'</td><td class="small">'+U.esc(s.role)+'</td><td class="num mono xs">'+U.fmtDate(s.exitDate)+'</td><td class="num mono xs">'+tenureYears(s)+' yrs</td><td class="num xs">'+U.daysBetween(U.todayISO(),s.exitDate)+' days</td></tr>').join('')
        +'</tbody></table></div>':'<p class="xs faint" style="margin:0">No exit dates recorded in the next 12 months.</p>',
      foot:'<span>Set an exit date on a staff record to bring it into this forecast.</span><span class="mono">'+a.length+' active</span>'})+'</div>'
   +'</div>';
}
function paintWorkforceCharts(){
  const a=active();
  const ages=a.map(ageOf).filter(v=>v!=null);
  const el=rootEl.querySelector('#staffAge');
  if(el) C.hbars(el,{items:[['Under 30',ages.filter(v=>v<30).length,'teal'],['30–39',ages.filter(v=>v>=30&&v<40).length,'gold'],['40–49',ages.filter(v=>v>=40&&v<50).length,'blue'],['50 and over',ages.filter(v=>v>=50).length,'rose']].map(([label,value,tone])=>({label,value,display:value+'',tone}))});
  const sx=rootEl.querySelector('#staffSex');
  if(sx){ const female=a.filter(s=>/^f/i.test(s.sex||'')).length, male=a.length-female;
    C.hbars(sx,{items:[{label:'Female',value:female,display:female+' · '+Math.round(female/(a.length||1)*100)+'%',tone:'gold'},{label:'Male',value:male,display:male+' · '+Math.round(male/(a.length||1)*100)+'%',tone:'teal'}]}); }
  const tn=rootEl.querySelector('#staffTenure');
  if(tn){ const t=a.map(tenureYears).filter(x=>x!=null);
    C.hbars(tn,{items:[{label:'Under 2 years',value:t.filter(x=>x<2).length,tone:'blue'},{label:'2–4 years',value:t.filter(x=>x>=2&&x<4).length,tone:'teal'},{label:'4–6 years',value:t.filter(x=>x>=4&&x<6).length,tone:'gold'},{label:'6 years and over',value:t.filter(x=>x>=6).length,tone:'rose'}].map(i=>Object.assign(i,{display:i.value+''}))}); }
}

function kpis(){
  const a=active(); const leave=onLeaveNow();
  const exp=A.users.filter(u=>!u.twoFactor).length;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Active staff',value:a.length,icon:'users',formatted:'0',note:staff().length-a.length+' archived · '+S.db().staff.filter(s=>s.weekendOnly).length+' weekend-only',spark:C.spark([7,7,8,8,9,9,9,a.length],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'On authorised leave',value:leave.length,icon:'plane-takeoff',formatted:'0',note:leave.length?leave.map(s=>s.name.split(' ')[0]).join(', '):'Everyone on the plan today',spark:C.spark([0,1,0,1,1,0,1,leave.length],{color:'var(--info)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Contract mix',value:a.filter(x=>S.contractOf(x)==='statute').length,icon:'file-signature',formatted:'0',note:a.filter(x=>S.contractOf(x)==='statute').length+' under statute · '+a.filter(x=>S.contractOf(x)==='contractual').length+' contractual',spark:C.spark(a.map(x=>S.contractOf(x)==='statute'?1:0),{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'2FA not enrolled',value:exp,icon:'shield-alert',formatted:'0',note:exp?A.users.filter(u=>!u.twoFactor).map(u=>u.name.split(' ')[0]).join(', '):'Every account enrolled',spark:C.spark([4,4,3,3,2,2,1,exp],{color:'var(--amber)'})})+'</div></div>';
}
function people(){
  return '<div class="grid-12 stagger">'+staff().map(s=>{
    const shift=S.shiftState(s);
    const book=S.leaveBook(s,U.fyLabel());
    return '<div class="c4"><div class="card hover pad" data-person="'+s.id+'" style="cursor:pointer">'
      +'<div class="row gap-sm" style="align-items:flex-start;margin-bottom:10px">'+U.avatar(s.name,'lg')
      +'<div style="min-width:0"><div class="card-title truncate">'+U.esc(s.name)+'</div><div class="card-sub truncate">'+U.esc(s.role)+'</div>'
      +'<div class="row gap-xs wrap" style="margin-top:5px">'+UI.roleBadge(roleFor(s))+'<span class="pill '+shift.tone+'"><span class="dot '+((shift.kind==='day'||shift.kind==='night'||shift.kind==='daynight')?'live':'')+'"></span>'+U.esc(shift.label)+'</span>'+(s.status!=='active'?'<span class="pill slate">'+UI.ic('log-out',9)+' archived</span>':'')+'</div></div></div>'
      +'<div class="thread" style="margin:10px 0"></div>'
      +'<div class="row between"><span class="xs faint">Annual leave · FY '+U.esc(book.fy)+'</span><span class="mono xs">'+book.charged+' of '+book.pool+' days</span></div>'
      +UI.meter(book.pool?U.clamp(book.charged/book.pool*100,0,100):0,book.over?'rose':book.balance>5?'teal':'amber')
      +'<div class="row between" style="margin-top:7px"><span class="xs faint">Balance</span><span class="pill '+(book.balance>0?'teal':'slate')+'">'+book.balance+' days left'+(book.carry.days?' · '+book.carry.days+' carried':'')+'</span></div>'
      +'<div class="row between" style="margin-top:9px"><span class="xs faint">'+U.esc(S.leaveEntitlement(s).label)+(s.sponsor?' · '+U.esc(s.sponsor):'')+'</span><span class="xs faint mono">'+U.esc(s.phone||'')+'</span></div>'
      +'</div></div>';
  }).join('')+'</div>'+workforce();
}

function personDrawer(id){
  const s=staff().find(x=>x.id===id); if(!s) return;
  const book=S.leaveBook(s,U.fyLabel());
  const leaves=S.db().leaves.filter(l=>l.staffId===s.id);
  const roster=S.db().workingPlans[U.monthKey()];
  const row=roster&&roster.primary?roster.primary.staff.find(x=>x.id===s.id):null;
  const shift=S.shiftState(s);
  const user=A.users.find(u=>u.staffId===s.id);
  UI.drawer({title:s.name,eyebrow:'Staff record',sub:s.role+' · since '+U.fmtDate(s.joinDate||'2019-01-01'),wide:true,body:
    '<div class="row gap-lg" style="align-items:center;margin-bottom:16px"><div style="position:relative;flex:0 0 auto">'+U.avatar(s.name,'xl')
    +'<button class="icon-btn" data-photo-upload title="Upload a profile photo" style="position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;background:var(--gold);color:#241A06;border:2px solid var(--surface)">'+UI.ic('camera',12)+'</button></div>'
    +'<div><div class="row gap-xs wrap">'+UI.roleBadge(roleFor(s))+'<span class="pill '+(s.status==='active'?'teal':'slate')+'">'+U.esc(s.status)+'</span><span class="pill '+shift.tone+'">'+U.esc(shift.label)+'</span>'+(s.weekendOnly?'<span class="pill blue">weekend only</span>':'')+'</div>'
    +(shift.note?'<div class="xs faint" style="margin-top:5px">'+U.esc(shift.note)+'</div>':'')
    +'<div class="small muted" style="margin-top:8px">'+U.esc(s.email||'')+' · '+U.esc(s.phone||'')+'</div>'
    +'<div class="row gap-xs" style="margin-top:6px"><button class="btn xs" data-photo-upload>'+UI.ic('camera',11)+(s.photo?'Replace photo':'Add a photo')+'</button>'
    +(s.photo?'<button class="btn xs" data-photo-clear>'+UI.ic('x',11)+'Remove</button>':'')+'</div></div></div>'
    +'<div class="split-4">'+[['Joined',U.fmtDateShort(s.joinDate)],['Pattern',s.pattern||'—'],['Max nights',(s.maxNights||0)+'/mo'],['Contract',S.leaveEntitlement(s).label]].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="split-3" style="margin-top:12px">'+[['Sponsor',S.leaveEntitlement(s).sponsor],['Leave entitlement',S.leaveEntitlement(s).days+(S.contractOf(s)==='contractual'?' weekdays':' days')],['Leave taken',S.leaveUsed(s).days+' days']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="section-head"><h2>This month</h2><span class="more">'+(row?row.codes.filter(c=>c==='D'||c==='N'||c==='DN').length:0)+' shifts</span></div>'
    +(row?'<div class="row wrap gap-xs">'+row.codes.map(c=>'<span class="shift-code '+(c||'OFF')+'" data-tip="'+U.fmtDateShort(roster.primary.dates[row.codes.indexOf(c)])+'">'+(c||'·')+'</span>').join('')+'</div>':'<p class="xs faint">No working plan for this month yet.</p>')
    +'<div class="section-head"><h2>Annual leave · FY '+U.esc(book.fy)+'</h2><span class="more">'+book.charged+' of '+book.pool+' days charged</span></div>'
    +'<div class="split-4">'+[['Balance',book.balance+' days'],['Carried in',book.carry.days+' days'+(book.carry.prevFy?' from '+book.carry.prevFy:'')],['Booked ahead',book.planned+' days'],['Entitlement',book.entitlement.days+' days']].map(([k,v])=>'<div class="hstat"><span class="lb">'+k+'</span><span class="vl" style="font-size:11.5px">'+U.esc(v)+'</span></div>').join('')+'</div>'
    +'<div class="section-head"><h2>Leave history</h2></div>'
    +leaves.slice(-5).reverse().map(l=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.esc(S.leaveTypeLabel(l.type))+' · '+U.daysBetween(l.from,l.to)+1+' days</div><div class="lr-sub">'+U.fmtDate(l.from)+' → '+U.fmtDate(l.to)+'</div></div><span class="pill '+(l.status==='Approved'?'teal':l.status==='Pending'?'amber':'slate')+'">'+U.esc(l.status||'—')+'</span></div>').join('')
    ||'<p class="xs faint">No leave recorded.</p>',
    foot:'<button class="btn" data-close>Close</button><button class="btn" data-edit-person>'+UI.ic('pencil',15)+'Edit</button>',
    onMount:(panel,close)=>{
      const b=panel.querySelector('[data-edit-person]'); if(b) b.onclick=()=>{ close(); editStaff(s.id); };
      U.$$('[data-photo-upload]',panel).forEach(x=>x.onclick=()=>uploadPhoto(s.id));
      const c=panel.querySelector('[data-photo-clear]');
      if(c) c.onclick=async()=>{
        const ok=await UI.confirm({title:'Remove the profile photo?',body:'The record goes back to initials on every screen.',confirm:'Remove photo',danger:true});
        if(!ok) return;
        S.commit(d=>{ const p=d.staff.find(x=>x.id===s.id); if(p) delete p.photo; },{action:'staff.photo.clear',entity:'staff',entityId:s.id,detail:s.name+' profile photo removed'});
        UI.closeAll(); UI.toast('Profile photo removed',{type:'warn'}); LS.shell.refresh();
      };
    }});
}
/* Photo upload: the chosen image is cropped square, scaled to 256 px and stored as
   a JPEG on the staff record, so it survives offline and never bloats the register. */
function uploadPhoto(staffId){
  if(!A.guard('staff')) return;
  const input=document.createElement('input');
  input.type='file'; input.accept='image/*';
  input.onchange=()=>{
    const f=input.files&&input.files[0]; if(!f) return;
    if(f.size>8*1024*1024) return UI.toast('Choose an image smaller than 8 MB',{type:'warn'});
    const fr=new FileReader();
    fr.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const box=document.createElement('canvas'); box.width=256; box.height=256;
        const ctx=box.getContext&&box.getContext('2d');
        if(!ctx) return UI.toast('This browser cannot process the image',{type:'warn'});
        const m=Math.min(img.width,img.height);
        ctx.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,256,256);
        const data=box.toDataURL('image/jpeg',0.82);
        const who=(S.db().staff.find(x=>x.id===staffId)||{}).name||'Staff member';
        S.commit(d=>{ const p=d.staff.find(x=>x.id===staffId); if(p) p.photo=data; },
          {action:'staff.photo',entity:'staff',entityId:staffId,detail:who+' profile photo updated'});
        UI.toast('Profile photo updated',{type:'ok'});
        UI.closeAll(); LS.shell.refresh(); personDrawer(staffId);
      };
      img.onerror=()=>UI.toast('That file could not be read as an image',{type:'warn'});
      img.src=fr.result;
    };
    fr.readAsDataURL(f);
  };
  input.click();
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
     +'<div class="field"><label>Date of birth</label><input class="input" type="date" id="sfDob" value="'+(s.dob||'')+'"></div>'
     +'<div class="field"><label>Orientation begins</label><input class="input" type="date" id="sfOrient" value="'+(s.orientationStart||s.joinDate||U.todayISO())+'"><div class="xs faint" style="margin-top:4px">Thirty days on the four-week rotation, then the assessment</div></div>'
     +'<div class="field"><label>Exit date</label><input class="input" type="date" id="sfExit" value="'+(s.exitDate||'')+'"><div class="xs faint" style="margin-top:4px">Drives tenure and the exit forecast</div></div>'
     +'<div class="field"><label>Max nights / month</label><input class="input" type="number" id="sfNights" min="0" max="20" value="'+(s.maxNights==null?8:s.maxNights)+'"></div>'
     +'<div class="field"><label>Status</label><select class="select" id="sfStatus"><option value="active">Active</option><option value="exited"'+(s.status==='exited'?' selected':'')+'>Exited</option></select></div></div>'
     +'<div class="hint" style="margin-top:8px">Annual leave follows the contract: <b>under statute 30 calendar days</b>, <b>contractual 21 working days</b> (Mon–Fri). The sponsor records who funds the post — Global Fund, own revenue, MoH/RBC or a partner.</div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save record</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#sfName').value.trim(); if(!name){ UI.toast('Name is required',{type:'err'}); return; }
        const rec={name, role:el.querySelector('#sfRole').value, sex:el.querySelector('#sfSex').value, phone:el.querySelector('#sfPhone').value, email:el.querySelector('#sfEmail').value,
          pattern:el.querySelector('#sfPattern').value, contract:el.querySelector('#sfContract').value, sponsor:el.querySelector('#sfSponsor').value,
          joinDate:el.querySelector('#sfJoin').value, dob:el.querySelector('#sfDob').value,
          orientationStart:el.querySelector('#sfOrient').value||el.querySelector('#sfJoin').value,
          exitDate:el.querySelector('#sfExit').value||'', maxNights:+el.querySelector('#sfNights').value, status:el.querySelector('#sfStatus').value};
        S.commit(d=>{ if(id){ Object.assign(d.staff.find(x=>x.id===id),rec); } else { d.staff.push(Object.assign({id:U.uid('s'), maxConsecN:2, nightPref:'neutral'},rec)); } },
          {action:id?'staff.update':'staff.create',entity:'staff',entityId:id||name,detail:(id?'Updated ':'Created ')+name});
        close(); LS.shell.refresh(); UI.toast(id?'Staff record updated':'Staff member added',{type:'ok'});
      };
    }});
}
/* ——— settings ————————————————————— */
/* ——— Test menu ————————————————————————————————
   Which examinations this laboratory actually offers. Every row is confirmed or
   switched off here; anything that is not performed can be removed for good, one
   at a time or in bulk, and it disappears from the sample wizard, the TAT table
   and every picker while the samples that already reference it keep their name. */
function testMenuCard(){
  const all=S.allTests();
  const activeCount=all.filter(t=>t.active!==false).length;
  const groups=U.groupBy(all,t=>t.cat||'General');
  return UI.card({title:'Test menu',sub:activeCount+' of '+all.length+' examinations confirmed on this bench',icon:'list-checks',
    tools:'<button class="btn xs" data-add-test>'+UI.ic('plus',12)+'Add examination</button>',
    body:'<div class="row between gap-sm" style="padding:2px 0 8px;border-bottom:1px solid var(--border);flex-wrap:wrap">'
      +'<label class="row gap-sm" style="cursor:pointer"><input type="checkbox" data-test-all style="accent-color:var(--gold)"><span class="small">Select all '+all.length+'</span></label>'
      +'<span class="grow"></span><span class="pill slate mono" id="testSel">0 selected</span>'
      +'<button class="btn xs danger" data-del-tests disabled>'+UI.ic('trash-2',12)+'Delete selected</button>'
      +'<button class="btn xs" data-save-tat>'+UI.ic('check',12)+'Save TAT</button></div>'
      +Object.keys(groups).map(cat=>'<div style="margin-top:9px"><div class="eyebrow">'+U.esc(cat)+' · '+groups[cat].length+'</div>'
        +groups[cat].map(t=>'<div class="list-row" style="padding:5px 0">'
          +'<input type="checkbox" data-test-sel="'+t.id+'" style="accent-color:var(--gold);margin-right:7px">'
          +'<label class="row gap-xs" style="cursor:pointer;min-width:76px"><input type="checkbox" data-test-active="'+t.id+'" style="accent-color:var(--gold)"'+(t.active!==false?' checked':'')+'><span class="xs '+(t.active!==false?'':'faint')+'">'+(t.active!==false?'on menu':'off menu')+'</span></label>'
          +'<div class="lr-main"><div class="lr-title" style="font-size:11.6px;'+(t.active!==false?'':'opacity:.55')+'">'+U.esc(t.name)+'</div>'
            +'<div class="lr-sub">'+U.esc(t.code||'—')+' · '+U.esc(t.cat||'General')+'</div></div>'
          +'<span class="row gap-xs" style="align-items:center"><input class="input mono" type="number" min="1" max="60" style="width:54px;height:26px" data-tat="'+U.esc(t.name)+'" value="'+(S.tatTarget(t.name)||t.tat||3)+'" title="Target turnaround in days"><span class="xs faint">d</span></span>'
          +'<button class="icon-btn" style="width:24px;height:24px" data-del-test="'+t.id+'" title="Delete this examination">'+UI.ic('trash-2',12)+'</button>'
        +'</div>').join('')+'</div>').join('')
      +(!all.length?'<p class="xs faint" style="margin:0">No examinations on the menu yet.</p>':'')
      +'<div class="xs faint" style="margin-top:9px;border-top:1px solid var(--border);padding-top:7px">“On menu” means the examination is confirmed and appears in the sample wizard and every picker. Switching it off keeps it out of the way without losing history; deleting removes it from the catalogue altogether — samples already registered keep the name they were recorded with.</div>',
    foot:'<span>Turnaround targets are set per examination here too.</span><span class="mono">'+activeCount+' active · '+all.length+' total</span>'});
}
function deleteTests(ids){
  if(!ids.length) return;
  const all=S.allTests();
  const names=all.filter(t=>ids.indexOf(t.id)>=0).map(t=>t.name);
  if(!names.length) return;
  const used=(S.db().samples||[]).filter(s=>names.indexOf(s.test)>=0).length;
  S.commit(d=>{ d.catalog.tests=(d.catalog.tests||[]).filter(t=>ids.indexOf(t.id)<0); },
    {action:'settings.test.delete',entity:'catalog',detail:names.length+' examinations removed · '+names.join(' | ').slice(0,140)});
  LS.shell.refresh(); paint();
  UI.toast(names.length+' examination'+(names.length===1?'':'s')+' deleted'+(used?' · '+used+' earlier samples keep their recorded test':''),{type:'ok'});
}
function addTestModal(){
  if(!A.guard('staff')) return;
  const cats=U.uniq(S.allTests().map(t=>t.cat||'General'));
  UI.modal({title:'Add an examination',sub:'It joins the menu immediately and can be confirmed or removed at any time.',width:'min(520px,100%)',
    body:'<div class="form-grid"><div class="field span2"><label>Name</label><input class="input" id="newTestName" placeholder="e.g. Sputum AFB"></div>'
      +'<div class="field"><label>Code</label><input class="input mono" id="newTestCode" placeholder="AFB" maxlength="6"></div>'
      +'<div class="field"><label>Category</label><input class="input" id="newTestCat" list="testCats" value="'+(cats[0]||'General')+'"><datalist id="testCats">'+cats.map(c=>'<option>'+U.esc(c)+'</option>').join('')+'</datalist></div>'
      +'<div class="field"><label>Target turnaround (days)</label><input class="input mono" type="number" min="1" max="60" id="newTestTat" value="3"></div></div>',
    foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>'+UI.ic('check',15)+'Add to menu</button>',
    onMount:(el,close)=>{
      el.querySelector('[data-save]').onclick=()=>{
        const name=el.querySelector('#newTestName').value.trim();
        if(!name) return UI.toast('Give the examination a name',{type:'warn'});
        if(S.allTests().some(t=>t.name.toLowerCase()===name.toLowerCase())) return UI.toast('That examination is already on the menu',{type:'warn'});
        const rec={id:U.uid('t'),name,code:(el.querySelector('#newTestCode').value||name.slice(0,3)).toUpperCase(),cat:el.querySelector('#newTestCat').value.trim()||'General',tat:Math.max(1,+el.querySelector('#newTestTat').value||3),active:true};
        S.commit(d=>{ d.catalog.tests=d.catalog.tests||[]; d.catalog.tests.push(rec); },{action:'settings.test.add',entity:'catalog',entityId:rec.id,detail:name});
        close(); paint(); UI.toast('Examination added to the menu',{type:'ok'});
      };
    }});
}
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
     '<div class="field" style="margin-bottom:12px"><label>Theme · <span class="faint" style="text-transform:none;letter-spacing:0">Auto follows the device and reads light on a computer</span></label><div class="seg" style="width:100%">'+[['auto','Auto'],['porcelain','Light'],['ink','Dark']].map(([k,l])=>'<button style="flex:1" class="'+(st.theme===k?'on':'')+'" data-set-theme="'+k+'">'+l+'</button>').join('')+'</div></div>'
     +'<div class="field" style="margin-bottom:12px"><label>Density</label><div class="seg" style="width:100%">'+[['comfortable','Comfortable'],['compact','Compact']].map(([k,l])=>'<button style="flex:1" class="'+(st.density===k?'on':'')+'" data-set-density="'+k+'">'+l+'</button>').join('')+'</div></div>'
     +'<div class="field"><label>Language</label><select class="select" id="setLang">'+LS.i18n.languages.map(l=>'<option value="'+l.code+'" '+(st.lang===l.code?'selected':'')+'>'+l.native+' — '+l.label+'</option>').join('')+'</select></div>'
     ,foot:'<span>Preference is stored on this device</span>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Coverage minimums',sub:'Drives roster & leave conflict warnings',icon:'calendar-check',body:
     [['coverWeekdayDay','Weekday · day'],['coverWeekdayNight','Weekday · night'],['coverWeekendDay','Weekend · day'],['coverWeekendNight','Weekend · night']].map(([k,l])=>
       '<div class="row between" style="padding:7px 0"><span class="small">'+l+'</span><input class="input mono" type="number" min="0" max="12" style="width:64px;height:30px" data-cover="'+k+'" value="'+(st[k]||0)+'"></div>').join('')
     ,foot:'<button class="btn sm" data-save-cover>Save minimums</button>'})+'</div>'
   +'<div class="c7">'+testMenuCard()+'</div>'
   +'<div class="c12">'+UI.card({title:'Modules',sub:'Enable or hide optional surfaces',icon:'layers',body:
     '<div class="row wrap gap-sm">'+[['qc','QC & EQA'],['pbf','PBF evaluation'],['equipment','Equipment'],['cloud','Cloud sync']].map(([k,l])=>
       '<label class="choice '+(st.features[k]?'on':'')+'" data-feature="'+k+'" style="width:auto;min-width:150px"><span class="ct">'+l+'</span><span class="switch" style="margin-left:auto"></span></label>').join('')+'</div>'
     +'<div class="hint" style="margin-top:10px">Disabling a module hides it from navigation but never deletes data.</div>'})+'</div></div>';
}
function dataView(){
  const db=S.db();
  const cl=S.settings().cloud||{};
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
   +'<div class="c5">'+UI.card({title:'Cloud sync',sub:'Supabase · shared register across devices · publishable key',icon:'cloud',
     tools:'<span class="pill '+(SY.configured()?'teal':'slate')+'">'+U.esc(SY.statusText())+'</span>',
     body:
     '<div class="field" style="margin-top:2px"><label>Supabase project URL</label><input class="input mono" id="cloudUrl" type="url" placeholder="https://xxxxxxxx.supabase.co" value="'+U.esc(cl.endpoint||'')+'" spellcheck="false" autocomplete="off"><div class="xs faint" style="margin-top:4px">Only <span class="mono">https://&lt;project&gt;.supabase.co</span> — no <span class="mono">/rest/v1</span> on the end. A path there makes Supabase answer <span class="mono">404 PGRST125</span>.</div></div>'
     +'<div class="field" style="margin-top:10px"><label>API key · publishable</label><input class="input mono" id="cloudKey" type="text" placeholder="sb_publishable_…" value="'+U.esc(cl.anonKey||'')+'" spellcheck="false" autocomplete="off"><div class="xs faint" style="margin-top:4px">Settings → API Keys → <b>Publishable key</b>. The legacy anon key (<span class="mono">eyJ…</span>) still works. Never the secret key.</div></div>'
     +'<div class="hint" style="margin:10px 0 0;padding:9px 11px;border-radius:8px;background:var(--surface-inset)"><b>This is not your supabase.com login.</b> How you signed into the dashboard — GitHub, Google, email — does not matter here. The console needs a <i>user of the project</i>: dashboard → <b>Authentication → Users → Add user</b>, email + password, tick <b>Auto confirm</b>. Or skip it with the anonymous option below.</div>'
     +'<div class="field" style="margin-top:10px"><label>Project user · email</label><input class="input mono" id="cloudEmail" type="email" placeholder="lab@rulidh.rw" value="'+U.esc(cl.email||'')+'" spellcheck="false" autocomplete="username"></div>'
     +'<div class="field" style="margin-top:10px"><label>Project user · password</label><input class="input mono" id="cloudPass" type="password" placeholder="the user from Authentication → Users" value="'+U.esc(cl.password||'')+'" autocomplete="current-password"></div>'
     +'<div class="field" style="margin-top:10px"><label>No password instead?</label>'
       +'<label class="choice '+(cl.anonAuth?'on':'')+'" style="width:auto"><input type="checkbox" id="cloudAnon" '+(cl.anonAuth?'checked':'')+' style="margin-right:8px"><span class="ct">Anonymous session</span></label>'
       +'<div class="xs faint" style="margin-top:5px">Needs one toggle in Supabase: <b>Authentication → Sign In / Providers → Allow anonymous sign-ins</b>. Anyone holding the publishable key could then create such a session, so use it only while you are setting up, or with the patient fields kept empty.</div></div>'
     +'<div class="field" style="margin-top:10px"><label>Mode</label><select class="select" id="cloudMode">'
       +[['push-pull','Two-way · pull then push'],['push','Push only — this device is the source'],['pull','Pull only — read the shared copy']].map(([v,l])=>'<option value="'+v+'"'+(cl.mode===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'
     +'<div class="row gap-sm wrap" style="margin-top:12px"><button class="btn sm" data-cloud-test>'+UI.ic('plug',13)+'Test connection</button><button class="btn sm primary" data-cloud-save>Save</button><button class="btn sm" data-cloud-check>'+UI.ic('shield-question',13)+'Check setup</button><button class="btn sm" data-cloud-sync>'+UI.ic('refresh-cw',13)+'Sync now</button></div>'
     +'<div class="row between" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)"><span class="xs faint">Pending local changes</span><span class="mono xs">'+(S.pendingChanges?S.pendingChanges():0)+'</span></div>'
     +'<div class="row between" style="padding:4px 0"><span class="xs faint">Last push</span><span class="mono xs">'+(SY.state().lastPushAt?U.relTime(SY.state().lastPushAt):'never')+'</span></div>'
     +'<div class="row between" style="padding:4px 0"><span class="xs faint">Last pull</span><span class="mono xs">'+(SY.state().lastPullAt?U.relTime(SY.state().lastPullAt):'never')+'</span></div>'
     +(SY.state().lastError?'<div class="hint" style="margin-top:8px;color:var(--crit)">'+U.esc(SY.state().lastError)+'</div>':'')
     +'<div class="hint" style="margin-top:12px">Every edit is still saved on this device first. The shared copy is what lets your phone see what you typed on the PC. Setup steps are in the <a href="docs/supabase-setup.html" target="_blank" rel="noopener">step-by-step guide</a>; the table SQL is <span class="mono">supabase/schema.sql</span>. No patient data leaves the device until the fields are filled. The login is stored on this device only.</div>'})+'</div>'
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
  if(tab==='people') paintWorkforceCharts();
  const add=r.querySelector('[data-add]'); if(add) add.onclick=()=>editStaff(null);
  const si=r.querySelector('[data-save-identity]');
  if(si) si.onclick=()=>{ const g=id=>{ const el=r.querySelector('#'+id); return el?el.value:''; };
    S.commit(d=>{ const st=d.settings; st.labName=g('setLab'); st.dept=g('setDept'); st.email=g('setEmail'); st.phone=g('setPhone'); st.samplePrefix=g('setPrefix')||'RDH'; st.manifestPrefix=g('setMprefix')||'BLC'; st.fiscalStart=g('setFy'); st.fyLabel=g('setFyLabel');
      st.signatories=[g('setSign1'),g('setSign2'),g('setSign3')]; },{action:'settings.identity',entity:'settings',detail:'Laboratory identity updated'});
    LS.shell.build(); UI.toast('Identity saved across the console',{type:'ok'}); };
  const sc=r.querySelector('[data-save-cover]'); if(sc) sc.onclick=()=>{ S.commit(d=>{ r.querySelectorAll('[data-cover]').forEach(i=>{ d.settings[i.dataset.cover]=Math.max(0,+i.value||0); }); },{action:'settings.coverage',entity:'settings',detail:'Coverage minimums updated'}); UI.toast('Coverage minimums saved',{type:'ok'}); };
  /* test menu: confirm / switch off / delete / add */
  const testSelState=()=>U.$$('[data-test-sel]',r).filter(c=>c.checked).map(c=>c.dataset.testSel);
  const refreshTestSel=()=>{
    const ids=testSelState();
    const pill=r.querySelector('#testSel'); if(pill) pill.textContent=ids.length+' selected';
    const del=r.querySelector('[data-del-tests]'); if(del) del.disabled=!ids.length;
    const all=r.querySelector('[data-test-all]');
    if(all){ const boxes=U.$$('[data-test-sel]',r); all.checked=boxes.length>0&&ids.length===boxes.length; all.indeterminate=ids.length>0&&ids.length<boxes.length; }
  };
  U.$$('[data-test-sel]',r).forEach(c=>c.onclick=()=>refreshTestSel());
  const testAll=r.querySelector('[data-test-all]');
  if(testAll) testAll.onclick=()=>{ U.$$('[data-test-sel]',r).forEach(c=>{ c.checked=testAll.checked; }); refreshTestSel(); };
  const delTests=r.querySelector('[data-del-tests]');
  if(delTests) delTests.onclick=async()=>{
    const ids=testSelState(); if(!ids.length) return;
    const names=S.allTests().filter(t=>ids.indexOf(t.id)>=0).map(t=>t.name);
    const ok=await UI.confirm({title:'Delete '+names.length+' examination'+(names.length===1?'':'s')+'?',
      body:names.slice(0,8).map(U.esc).join(' · ')+(names.length>8?' and '+(names.length-8)+' more':'')
        +'<div style="margin-top:8px">They leave the menu, the sample wizard and every picker. Samples already registered keep the test name they were recorded with.</div>',
      confirm:'Delete from menu',danger:true});
    if(!ok) return;
    deleteTests(ids);
  };
  U.$$('[data-del-test]',r).forEach(b=>b.onclick=async()=>{
    const t=S.allTests().find(x=>x.id===b.dataset.delTest); if(!t) return;
    const ok=await UI.confirm({title:'Delete '+t.name+'?',body:'It leaves the test menu, the sample wizard and every picker. Registered samples keep the name they were recorded with.',confirm:'Delete examination',danger:true});
    if(ok) deleteTests([t.id]);
  });
  U.$$('[data-test-active]',r).forEach(c=>c.onclick=()=>{
    const id=c.dataset.testActive;
    S.commit(d=>{ const t=(d.catalog.tests||[]).find(x=>x.id===id); if(t){ t.active=!c.checked?false:true; if(t.active) delete t.deleted; } },
      {action:'settings.test.confirm',entity:'catalog',entityId:id,detail:(c.checked?'Confirmed on menu':'Switched off menu')});
    paint();
  });
  const addTest=r.querySelector('[data-add-test]'); if(addTest) addTest.onclick=addTestModal;
  refreshTestSel();
  const st=r.querySelector('[data-save-tat]'); if(st) st.onclick=()=>{ S.commit(d=>{ d.settings.tat=d.settings.tat||{}; r.querySelectorAll('[data-tat]').forEach(i=>{ d.settings.tat[i.dataset.tat]=Math.max(1,+i.value||1); }); },{action:'settings.tat',entity:'settings',detail:'TAT targets updated'}); UI.toast('Turnaround targets saved',{type:'ok'}); };
  r.querySelectorAll('[data-set-theme]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ d.settings.theme=b.dataset.setTheme; d.meta.themeChosen=true; },{action:'settings.theme',entity:'settings',detail:'Theme '+b.dataset.setTheme}); LS.shell.build(); paint(); });
  r.querySelectorAll('[data-set-density]').forEach(b=>b.onclick=()=>{ S.commit(d=>{ d.settings.density=b.dataset.setDensity; },{action:'settings.density',entity:'settings',detail:'Density '+b.dataset.setDensity}); LS.shell.build(); paint(); });
  const lg=r.querySelector('#setLang'); if(lg) lg.onchange=()=>{ LS.i18n.set(lg.value); LS.shell.build(); paint(); UI.toast('Language updated',{type:'ok'}); };
  r.querySelectorAll('[data-feature]').forEach(el=>el.onclick=()=>{ const k=el.dataset.feature; S.commit(d=>{ d.settings.features[k]=!d.settings.features[k]; },{action:'settings.feature',entity:'settings',detail:'Feature '+k+' toggled'}); paint(); LS.shell.build(); });
  const ex=r.querySelector('[data-export-json]'); if(ex) ex.onclick=()=>{ U.download('lab-systems-register-'+U.todayISO()+'.json',JSON.stringify(S.db(),null,2)); UI.toast('Register exported',{type:'ok'}); };
  const im=r.querySelector('[data-import-json]'); if(im) im.onclick=()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json';
    inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=async()=>{ try{ const obj=JSON.parse(rd.result); const ok=await UI.confirm({title:'Import register?',body:'Replaces the current local register after creating a restore point.',confirm:'Import',danger:true}); if(!ok) return; S.restorePoint(); S.importJSON(obj.db||obj); LS.shell.build(); paint(); UI.toast('Register imported',{type:'ok'}); }catch(e){ UI.toast('Invalid register file',{type:'err'}); } }; rd.readAsText(f); }; inp.click(); };
  const sn=r.querySelector('[data-snapshot]'); if(sn) sn.onclick=()=>{ S.restorePoint(); UI.toast('Restore point created',{type:'ok'}); };
  const rs=r.querySelector('[data-reset]'); if(rs) rs.onclick=async()=>{ const ok=await UI.confirm({title:'Reset to factory seed?',body:'All local changes on this device will be replaced by the seed register. Export first if you need the current data.',confirm:'Reset register',danger:true}); if(!ok) return; S.reset(); LS.shell.build(); paint(); UI.toast('Register reset to seed',{type:'warn'}); };
  r.querySelectorAll('[data-cloud-test]').forEach(b=>b.onclick=async()=>{
    const u=r.querySelector('#cloudUrl'), k=r.querySelector('#cloudKey'), m=r.querySelector('#cloudMode');
    const em=r.querySelector('#cloudEmail'), pw=r.querySelector('#cloudPass');
    if(k && LS.sync.keyKind(k.value.trim())==='secret'){ UI.toast('That is the secret key — it bypasses every access rule and must never be in a browser. Copy the publishable key instead.',{type:'err',duration:9000}); return; }
    if(u) S.settings().cloud.endpoint=LS.sync.baseUrl(u.value);
    if(k) S.settings().cloud.anonKey=k.value.trim();
    if(m) S.settings().cloud.mode=m.value;
    const an=r.querySelector('#cloudAnon');
    if(em) S.settings().cloud.email=em.value.trim();
    if(pw) S.settings().cloud.password=pw.value;
    if(an) S.settings().cloud.anonAuth=!!an.checked;
    UI.toast('Testing the Supabase project…',{type:'info'});
    const res=await SY.ping();
    UI.toast(res.ok?'Connected to Supabase — '+(res.remote?'shared register found':'ready for the first push'):res.reason,{type:res.ok?'ok':'err',duration:res.ok?4000:8000});
    if(res.ok) paint();
  });
  r.querySelectorAll('[data-cloud-save]').forEach(b=>b.onclick=()=>{ const u=r.querySelector('#cloudUrl'), k=r.querySelector('#cloudKey'), m=r.querySelector('#cloudMode');
    const em=r.querySelector('#cloudEmail'), pw=r.querySelector('#cloudPass'), an=r.querySelector('#cloudAnon');
    if(k && LS.sync.keyKind(k.value.trim())==='secret'){ UI.toast('Not saved: that is the secret key. Use the publishable key (sb_publishable_…) — the secret one bypasses row-level security.',{type:'err',duration:9000}); return; }
    S.commit(d=>{ d.settings.cloud.endpoint=u?LS.sync.baseUrl(u.value):''; d.settings.cloud.anonKey=(k?k.value:'').trim();
      d.settings.cloud.email=(em?em.value:'').trim(); d.settings.cloud.password=(pw?pw.value:'');
      d.settings.cloud.anonAuth=!!(an&&an.checked);
      d.settings.cloud.mode=m?m.value:'push-pull'; d.settings.cloud.enabled=!!(u&&u.value&&k&&k.value); },
      {action:'settings.cloud',entity:'settings',detail:'Cloud sync settings saved'});
    const on=SY.configured();
    UI.toast(on?'Sync configured — press Sync now to publish this register':'Cloud sync disabled · staying local',{type:'ok'});
    if(on){ SY.sync().then(res=>{ UI.toast(res.ok?'Cloud sync: '+res.action:(res.reason||'Sync did not finish'),{type:res.ok?'ok':'warn',duration:6000}); paint(); }); }
  });
  r.querySelectorAll('[data-cloud-check]').forEach(b=>b.onclick=async()=>{
    b.disabled=true; const old=b.innerHTML; b.textContent='Checking…';
    let rows=[];
    try{ rows=await SY.diagnose(); }catch(e){ rows=[{label:'The check could not run',ok:false,detail:e.message}]; }
    b.disabled=false; b.innerHTML=old;
    const bad=rows.filter(x=>!x.ok).length;
    UI.modal({title:'Cloud sync setup check', sub:bad?bad+' thing'+(bad>1?'s':'')+' to fix':'Everything checks out',
      body:'<div class="stack" style="gap:9px">'+rows.map(x=>
        '<div class="row" style="gap:10px;align-items:flex-start;padding:9px 11px;border-radius:9px;background:var(--surface-inset)">'
        +'<span style="color:'+(x.ok?'var(--ok)':'var(--crit)')+';flex:none;margin-top:1px">'+UI.ic(x.ok?'circle-check':'circle-x',15)+'</span>'
        +'<div><div class="small strong">'+U.esc(x.label)+'</div>'
        +(x.detail?'<div class="xs muted" style="margin-top:2px;line-height:1.55">'+U.esc(x.detail)+'</div>':'')
        +'</div></div>').join('')+'</div>'
        +'<div class="hint" style="margin-top:12px">This asked your project four things: is the address right, does the key work, can a session be created, and does the table answer. No patient data was read.</div>',
      foot:'<button class="btn primary" data-close>Close</button>'});
  });
  r.querySelectorAll('[data-cloud-sync]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;
    const res=await SY.sync({force:false});
    b.disabled=false;
    UI.toast(res.ok?'Sync complete · '+res.action:(res.reason||'Sync did not finish'),{type:res.ok?'ok':'warn',duration:6000});
    paint();
  });
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
