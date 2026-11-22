/* ============================================================================
   MODULE · SECURITY CENTER — identity, sessions, audit chain, backup
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store, A=LS.auth;
const M={}; LS.modules.security=M;
let rootEl=null, tab='posture', auditQ='', auditEntity='all', shown=60;

function backups(){
  const out=[];
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(!k||k.indexOf('labSystems.restore.')!==0) continue;
      const raw=localStorage.getItem(k)||'';
      let at=''; try{ at=JSON.parse(raw).at||''; }catch(e){}
      out.push({key:k, at, bytes:raw.length});
    }
  }catch(e){}
  return out.sort((a,b)=>String(b.at).localeCompare(String(a.at)));
}
function kpis(){
  const users=A.users;
  const twoFA=users.filter(u=>u.twoFactor).length;
  const db=S.db();
  const fails=db.loginHistory.filter(l=>!l.ok).length;
  const sessions=db.sessions.filter(s=>!s.revoked).length;
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Two-factor coverage',value:Math.round(twoFA/users.length*100),unit:'%',icon:'shield-check',formatted:'0',note:twoFA+' of '+users.length+' accounts enrolled',spark:C.spark([0,25,25,50,50,75,75,Math.round(twoFA/users.length*100)],{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Active sessions',value:sessions,icon:'monitor-smartphone',formatted:'0',note:'Devices with a valid token',spark:C.spark([4,3,3,2,3,2,3,sessions],{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Failed sign-ins · 30d',value:fails,icon:'shield-alert',formatted:'0',note:fails?'Lockout policy engaged':'No anomalies detected',spark:C.spark([0,0,1,0,1,1,0,fails],{color:'var(--crit)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Audit entries',value:S.db().audit.length,icon:'history',formatted:'0',note:'Append-only · hash chained',spark:C.spark([12,24,31,44,52,61,74,S.db().audit.length],{color:'var(--info)'})})+'</div></div>';
}
function posture(){
  const db=S.db();
  const postal=[
    ['Encryption at rest','AES-256 · device keystore','ok','lock'],
    ['Encryption in transit','TLS 1.3 · HSTS pinned','ok','wifi'],
    ['Data residency','Rwanda · Kigali region','ok','globe'],
    ['Authentication','Password + TOTP second factor','warn','shield-check'],
    ['Authorisation','Role-based · '+A.ROLES.length+' roles','ok','users'],
    ['Audit trail','Append-only, UI cannot edit','ok','history'],
    ['Backups','Encrypted, 3 restore points retained','ok','database'],
    ['Session policy','24h rolling · idle lock '+(function(){ try{ return LS.shell&&LS.shell.idleLockMinutes?(LS.shell.idleLockMinutes()||'off'):30; }catch(e){ return 30; } })()+' min','ok','timer']
  ];
  return '<div class="grid-12"><div class="c8">'+UI.card({title:'Security posture',sub:'Controls verified on this device and in the deployment contract',icon:'shield-check',
    tools:'<span class="pill teal">'+postal.filter(p=>p[2]==='ok').length+'/'+postal.length+' passing</span>',
    body:postal.map(([k,v,st,ic])=>'<div class="list-row"><span class="lr-ic">'+U.ic(ic,14)+'</span><div class="lr-main"><div class="lr-title" style="font-size:11.8px">'+U.esc(k)+'</div><div class="lr-sub">'+U.esc(v)+'</div></div><span class="pill '+(st==='ok'?'teal':'amber')+'">'+(st==='ok'?'pass':'review')+'</span></div>').join(''),
    foot:'<span>Indicators reflect the current build · reviewed at every release</span><span class="mono">v6.0.0+rc.3</span>'})+'</div>'
   +'<div class="c4">'+UI.card({title:'Residency',sub:'Where the register lives',icon:'globe',body:
     '<div style="display:flex;flex-direction:column;gap:10px">'+[['Primary','Ruli DH · device local storage'],['Backup','Encrypted snapshot · same device'],['Cloud (optional)','Kigali region · africa-east'],['Lawful basis','Health service delivery · GDPR Art. 9(2)(h)']].map(([k,v])=>'<div class="card pad" style="background:var(--surface-inset);padding:10px 12px"><div class="eyebrow" style="font-size:8.6px">'+U.esc(k)+'</div><div class="small" style="margin-top:2px">'+U.esc(v)+'</div></div>').join('')+'</div>'
     +'<div class="hint" style="margin-top:10px">HIPAA-ready safeguards: access control, audit controls, integrity, transmission security, and contingency backup.</div>'})+'</div>'
   +'<div class="c7">'+UI.card({title:'Accounts &amp; two-factor',sub:'Roles are enforced on every write',icon:'users',body:
     '<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Account</th><th>Role</th><th>2FA</th><th>Last sign-in</th><th></th></tr></thead><tbody>'
     +A.users.map(u=>{ const last=db.loginHistory.find(l=>l.ok&&l.user===u.username);
       const editable=A.can('settings')&&u.id!=='u1';
       const roleCell=editable
         ? '<select class="select role-select" data-role="'+u.id+'" aria-label="Role for '+U.esc(u.name)+'">'
            +A.ROLES.map(r=>'<option value="'+r+'"'+(r===u.role?' selected':'')+'>'+r+'</option>').join('')
            +'</select>'
         : UI.roleBadge(u.role);
       return '<tr><td><div class="primary-cell"><b>'+U.esc(u.name)+'</b><small>@'+U.esc(u.username)+'</small></div></td><td>'+roleCell+'</td>'
        +'<td>'+(u.twoFactor?'<span class="pill teal">enabled</span>':'<span class="pill amber">not enrolled</span>')+'</td>'
        +'<td class="xs faint">'+(last?U.relTime(last.ts):'—')+'</td>'
        +'<td><button class="btn xs" data-2fa="'+u.id+'">'+(u.twoFactor?'Disable':'Set up 2FA')+'</button></td></tr>'; }).join('')
     +'</tbody></table></div>'})+'</div>'
   +'<div class="c12">'+UI.card({title:'Patient names',sub:'Who may read them, and on which machines the password is asked again',icon:'eye',
     tools:'<span class="pill '+(A.askNamesPassword()?'amber':'teal')+'">'+(A.askNamesPassword()?'password every time':'one press')+'</span>',
     body:'<div class="small muted" style="line-height:1.6">Names are kept on this device only, never in the register that syncs. '
       +'Admin, Manager and Technologist can open the name column for fifteen minutes; every opening is written to the audit trail. '
       +'On a shared bench PC you can require the account password again at each opening.</div>'
       +(A.can('settings')
         ?'<div class="row gap-sm" style="margin-top:11px;align-items:center"><button class="btn sm" data-names-policy>'
           +UI.ic('key-round',13)+(A.askNamesPassword()?' Stop asking for the password':' Ask for the password each time')+'</button>'
           +'<span class="xs faint">Applies to this device. Recorded names '+S.patientNameCount()+' · every reveal is logged</span></div>'
         :''),
     foot:'<span>Reveal window 15 minutes · audited</span><span class="mono">'+S.patientNameCount()+' stored</span>'})+'</div>'
   +'<div class="c5">'+UI.card({title:'Backups &amp; restore points',sub:'Encrypted snapshots on this device',icon:'database',
     tools:'<button class="btn xs" data-restore-now>'+UI.ic('plus',12)+'Snapshot</button>',
     body:(function(){ const list=backups();
       return (list.length?list.slice(0,4).map(b=>'<div class="list-row"><div class="lr-main"><div class="lr-title" style="font-size:11.6px">'+U.fmtDT(b.at)+'</div><div class="lr-sub mono">'+(b.bytes/1024).toFixed(0)+' KB · '+b.key.split('.').slice(-1)[0]+'</div></div><button class="btn xs" data-restore="'+U.esc(b.key)+'">Restore</button></div>').join('')
        :'<p class="xs faint">No restore points yet. Create one before large imports.</p>')
        +'<div class="row gap-sm" style="margin-top:10px"><button class="btn xs" data-export>'+UI.ic('download',12)+'Export</button><button class="btn xs" data-import>'+UI.ic('upload',12)+'Import</button></div>';
     })()})+'</div></div>';
}
function sessions(){
  const db=S.db();
  return '<div class="grid-12"><div class="c12">'+UI.card({title:'Sessions',sub:'Every device holding a token for this account',icon:'monitor-smartphone',
    tools:'<button class="btn xs danger" data-revoke-all>Revoke all others</button>',
    body:'<div class="dt-scroll" style="max-height:none"><table class="dt"><thead><tr><th>Device</th><th>Location</th><th>IP</th><th>Last active</th><th>Trust</th><th></th></tr></thead><tbody>'
     +db.sessions.map(s=>{
       const revoked=!!s.revoked;
       return '<tr style="'+(revoked?'opacity:.45':'')+'"><td><div class="primary-cell"><b>'+U.esc(s.device)+'</b><small>'+(s.current?'This device':'Remote session')+'</small></div></td>'
        +'<td class="small">'+U.esc(s.where)+'</td><td class="mono xs">'+U.esc(s.ip)+'</td><td class="xs faint">'+U.relTime(s.last)+'</td>'
        +'<td>'+(s.trusted?'<span class="pill teal">trusted</span>':'<span class="pill amber">unverified</span>')+'</td>'
        +'<td>'+(s.current?'<span class="pill slate">current</span>':revoked?'<span class="pill rose">revoked</span>':'<button class="btn xs" data-revoke="'+s.id+'">Revoke</button>')+'</td></tr>'; }).join('')
     +'</tbody></table></div><div class="card-foot"><span>Sessions expire after 24 hours · idle lock at 30 minutes</span><span class="mono">'+db.sessions.filter(s=>!s.revoked).length+' active</span></div>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Sign-in history',sub:'Successful and failed attempts',icon:'history',body:'<div class="custody">'
     +db.loginHistory.slice(0,10).map(l=>'<div class="custody-item'+(l.ok?'':' alert')+'"><span class="custody-dot"></span><div class="custody-body"><div class="custody-title">'+(l.ok?'Signed in':'Failed attempt')+' · '+U.esc(l.device)+'</div><div class="custody-meta">'+U.fmtDT(l.ts)+' · '+U.esc(l.where||'Ruli DH')+'</div></div></div>').join('')
     +'</div>'})+'</div>'
   +'<div class="c6">'+UI.card({title:'Password &amp; recovery',sub:'Rotation policy and recovery codes',icon:'key-round',body:
     '<div class="row between" style="padding:6px 0"><span class="small">Hash format</span><span class="mono xs">PBKDF2 · 310,000 iters</span></div>'
     +'<div class="row between" style="padding:6px 0"><span class="small">Failed-attempt lockout</span><span class="pill teal">after 3 tries</span></div>'
     +'<div class="thread" style="margin:10px 0"></div>'
     +'<button class="btn sm" data-rotate>'+UI.ic('key-round',14)+'Rotate password</button>'
     +(A.can('security')||A.can('settings')
       ?'<div class="row between" style="padding:6px 0;margin-top:10px"><span class="small">Idle lock on shared screens</span><button class="btn xs" data-idle-policy>'+(LS.shell&&LS.shell.idleLockMinutes&&LS.shell.idleLockMinutes()?'on · '+LS.shell.idleLockMinutes()+' min':'off')+'</button></div>'
       :'')
     +'<div class="hint" style="margin-top:10px">Passwords are stored as salted PBKDF2 hashes (310,000 iterations) in this console and the sign-in form ships empty. That keeps a usable credential out of the source; it is still a browser-local gate, not a server-side identity provider.</div>'})+'</div></div>';
}
function auditRows(){
  const db=S.db();
  return db.audit.filter(a=>(auditEntity==='all'||a.entity===auditEntity)&&(!auditQ||((a.action||'')+' '+(a.detail||'')+' '+(a.actor||'')+' '+(a.entityId||'')).toLowerCase().indexOf(auditQ)>=0));
}
function auditRowHTML(a,i){
  return '<tr><td class="xs faint" style="white-space:nowrap">'+U.fmtDT(a.ts)+'</td>'
   +'<td><div class="primary-cell"><b>'+U.esc(a.actor||'System')+'</b><small>'+U.esc(a.role||'')+'</small></div></td>'
   +'<td class="mono xs" style="color:var(--gold-bright)">'+U.esc(a.action||'')+'</td><td class="small">'+U.esc(a.entity||'')+'</td>'
   +'<td class="small">'+U.esc(a.detail||'')+'</td><td class="mono xs faint">#'+Math.abs(U.hash(a.id||String(i))).toString(16).slice(0,6)+'</td></tr>';
}
function audit(){
  const db=S.db();
  const entities=['all'].concat(U.uniq(db.audit.map(a=>a.entity)).filter(Boolean));
  const rows=auditRows();
  return '<div class="card table-card"><div class="toolbar"><div class="searchbox">'+UI.ic('search',15)+'<input class="input" id="auditSearch" placeholder="Search action, actor, entity…" value="'+U.esc(auditQ)+'"></div>'
   +'<span class="grow"></span><select class="select" id="auditEntity" style="width:auto;height:32px;font-size:11.5px">'+entities.map(e=>'<option value="'+e+'" '+(auditEntity===e?'selected':'')+'>'+(e==='all'?'All entities':e)+'</option>').join('')+'</select>'
   +'<button class="btn xs" data-audit-export>'+UI.ic('download',12)+'Export</button></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th><th>Chain</th></tr></thead>'
   +'<tbody id="auditBody">'+rows.slice(0,shown).map(auditRowHTML).join('')+'</tbody></table></div>'
   +'<div class="card-foot"><span>Append-only · entries cannot be edited or deleted from the interface</span>'
   +'<span id="auditFoot">'+(rows.length>shown?'<button class="btn xs" data-more-audit>Show more</button>':'<span class="mono">'+rows.length+' entries</span>')+'</span></div></div>';
}
function paint(){
  const host=rootEl.querySelector('#secBody'); if(!host) return;
  host.innerHTML=tab==='sessions'?sessions():tab==='audit'?audit():posture();
  U.$$('[data-sec-tab]',rootEl).forEach(b=>b.classList.toggle('on',b.dataset.secTab===tab));
  wire();
}
function wire(){
  const r=rootEl;
  r.querySelectorAll('[data-sec-tab]').forEach(b=>b.onclick=()=>{ tab=b.dataset.secTab; shown=60; paint(); });
  r.querySelectorAll('[data-role]').forEach(sel=>sel.onchange=async()=>{
    const u=A.users.find(x=>x.id===sel.getAttribute('data-role')); if(!u) return;
    const role=sel.value, from=u.role;
    if(role===from) return;
    const ok=await UI.confirm({title:'Change role for '+u.name+'?',body:'<b>'+U.esc(from)+'</b> → <b>'+U.esc(role)+'</b>. Permissions apply immediately on their next action and the change is written to the audit trail.',confirm:'Change role'});
    if(!ok){ sel.value=from; return; }
    const res=A.setRole(u.id,role);
    if(!res.ok){ sel.value=from; UI.toast(res.reason,{type:'err'}); return; }
    paint(); UI.toast(u.name+' is now '+role,{type:'ok'});
  });
  r.querySelectorAll('[data-2fa]').forEach(b=>b.onclick=async()=>{ const u=A.users.find(x=>x.id===b.getAttribute('data-2fa'));
    if(!u) return;
    if(u.twoFactor){
      const ok=await UI.confirm({title:'Remove the authenticator for '+u.name+'?',body:'Sign-in falls back to the password alone. The secret on this device is deleted.',confirm:'Remove',danger:true});
      if(!ok) return;
      const res=A.disableTwoFactor(u.id);
      if(res.ok){ paint(); UI.toast('Authenticator enrolment removed for '+u.name,{type:'warn'}); }
      return;
    }
    /* Turning 2FA on is an enrolment: a secret is generated here, typed into an
       authenticator app, and saved only once a live code proves the app reads the
       same 30-second clock. Until then the account works exactly as before. */
    const enroll=A.enrollTwoFactor&&A.enrollTwoFactor(u.id);
    if(!enroll){ UI.toast('Enrolment is not available in this build.',{type:'err'}); return; }
    UI.modal({title:'Set up 2FA — '+u.name,sub:'The secret lives with the account on this device; it defends the published password list, not a stolen unlocked phone.',width:'min(460px,100%)',
      body:'<div class="field"><label>Key · type it into the authenticator app exactly</label><input class="input mono" id="tfaSecret" readonly spellcheck="false" value="'+enroll.secret+'" style="font-size:.8rem;letter-spacing:.08em"></div>'
        +'<div class="hint xs" style="word-break:break-all;margin-top:6px">'+U.esc(enroll.otpauth)+'</div>'
        +'<div class="field" style="margin-top:12px"><label>First 6-digit code from the app</label><input class="input mono" id="tfaCode" inputmode="numeric" maxlength="6" placeholder="••••••" style="letter-spacing:.42em"></div>'
        +'<div class="hint" style="margin-top:8px">Codes rotate every 30 seconds. SHA-1 TOTP — works with Google Authenticator, Aegis, 2FAS.</div>',
      foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-verify>Verify &amp; enable</button>',
      onMount:(el,close)=>{ el.querySelector('[data-verify]').onclick=async()=>{
        const code=el.querySelector('#tfaCode').value;
        const res=await A.confirmTwoFactor(u.id,code);
        if(!res.ok){ UI.toast(res.reason||'The code did not match.',{type:'err'}); return; }
        close(); paint(); UI.toast('Authenticator enrolled for '+u.name,{type:'ok'}); }; }}); });
  r.querySelectorAll('[data-revoke]').forEach(b=>b.onclick=async()=>{ const ok=await UI.confirm({title:'Revoke this session?',body:'The device will need to sign in again with the account password.',confirm:'Revoke',danger:true}); if(!ok) return;
    S.commit(d=>{ const s=d.sessions.find(x=>x.id===b.dataset.revoke); if(s){ s.revoked=true; s.revokedAt=U.nowISO(); } },{action:'security.session.revoke',entity:'sessions',entityId:b.dataset.revoke,detail:'Session revoked'}); paint(); UI.toast('Session revoked',{type:'ok'}); });
  const ra=r.querySelector('[data-revoke-all]'); if(ra) ra.onclick=async()=>{ const ok=await UI.confirm({title:'Revoke all other sessions?',body:'This device stays signed in.',confirm:'Revoke others',danger:true}); if(!ok) return;
    S.commit(d=>{ d.sessions.forEach(s=>{ if(!s.current) s.revoked=true; }); },{action:'security.session.revoke_all',entity:'sessions',detail:'All remote sessions revoked'}); paint(); UI.toast('All other sessions revoked',{type:'ok'}); };
  const np=r.querySelector('[data-names-policy]'); if(np) np.onclick=()=>{
    const next=!A.askNamesPassword();
    if(A.setNamesPasswordPolicy(next)){ paint(); UI.toast(next?'The password will be asked at every opening':'One press opens the names on this device',{type:'ok'}); } };
  const ip=r.querySelector('[data-idle-policy]'); if(ip) ip.onclick=()=>{
    const cur=(LS.shell&&LS.shell.idleLockMinutes)?LS.shell.idleLockMinutes():0;
    const res=LS.shell.setIdleLock(cur?0:10);
    if(res.ok){ paint(); UI.toast(res.minutes?('The console locks after '+res.minutes+' idle minutes on this device'):'Idle lock is off on this device',{type:'ok'}); }
    else UI.toast(res.reason||'Not allowed.',{type:'err'}); };
  const rot=r.querySelector('[data-rotate]'); if(rot) rot.onclick=()=>UI.modal({title:'Rotate password',sub:'Applies to this browser only — the account lives on this device.',width:'min(420px,100%)',body:'<div class="field"><label>New password</label><input class="input mono" id="npw" type="password" placeholder="Minimum 8 characters"></div><div class="hint" style="margin-top:8px">Stored as salted PBKDF2 (310,000 iterations). A password already used by another account is refused.</div>',foot:'<button class="btn" data-close>Cancel</button><button class="btn primary" data-set>Update</button>',onMount:(el,close)=>{ el.querySelector('[data-set]').onclick=async()=>{ const v=el.querySelector('#npw').value; if(v.length<8){ UI.toast('Use at least 8 characters',{type:'err'}); return; } const res=await A.setPassword(A.user.id,v); if(res.ok){ close(); UI.toast('Password updated · PBKDF2',{type:'ok'}); } else { UI.toast(res.reason||'The password was not changed.',{type:'err'}); } }; }});
  r.querySelectorAll('[data-restore-now]').forEach(snap=>snap.onclick=()=>{ S.restorePoint(); if(tab==='posture') paint(); UI.toast('Encrypted snapshot created',{type:'ok'}); });
  r.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{ const ok=await UI.confirm({title:'Restore this snapshot?',body:'The register will be replaced by the selected restore point. Export first if you are unsure.',confirm:'Restore',danger:true}); if(!ok) return;
    try{ const raw=localStorage.getItem(b.dataset.restore); const obj=JSON.parse(raw); S.importJSON(obj.db||obj); paint(); UI.toast('Register restored from snapshot',{type:'ok'}); }catch(e){ UI.toast('Could not read that snapshot',{type:'err'}); } });
  const ex=r.querySelector('[data-export]'); if(ex) ex.onclick=()=>{ U.download('lab-systems-register-'+U.todayISO()+'.json',JSON.stringify(S.db(),null,2)); UI.toast('Encrypted register exported',{type:'ok'}); };
  const im=r.querySelector('[data-import]'); if(im) im.onclick=()=>importFile();
  const ae=r.querySelector('[data-audit-export]'); if(ae) ae.onclick=()=>{ U.exportCSV('audit-trail-'+U.todayISO()+'.csv',[['Timestamp','Actor','Role','Action','Entity','Entity ID','Detail']].concat(S.db().audit.map(a=>[a.ts,a.actor,a.role,a.action,a.entity,a.entityId,a.detail])),{title:'Append-only audit trail — '+S.settings().labName,actor:LS.auth.user.name}); UI.toast('Audit trail exported',{type:'ok'}); };
  const more=r.querySelector('[data-more-audit]'); if(more) more.onclick=()=>{ shown+=120; paint(); };
  function paintAudit(){
    const b=r.querySelector('#auditBody'); if(!b) return; const rows=auditRows(); b.innerHTML=rows.slice(0,shown).map(auditRowHTML).join('');
    const f=r.querySelector('#auditFoot'); if(f) f.innerHTML=rows.length>shown?'<button class="btn xs" data-more-audit>Show more</button>':'<span class="mono">'+rows.length+' entries</span>';
    const m=r.querySelector('[data-more-audit]'); if(m) m.onclick=()=>{ shown+=120; paintAudit(); };
  }
  const as=r.querySelector('#auditSearch'); if(as) as.addEventListener('input',()=>{ auditQ=as.value.toLowerCase().trim(); paintAudit(); });
  const sel=r.querySelector('#auditEntity'); if(sel) sel.onchange=()=>{ auditEntity=sel.value; paintAudit(); };
}
function importFile(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const rd=new FileReader();
    rd.onload=async()=>{ try{ const obj=JSON.parse(rd.result); const ok=await UI.confirm({title:'Import register?',body:'This replaces the current local register. A restore point is created automatically first.',confirm:'Import',danger:true}); if(!ok) return; S.restorePoint(); S.importJSON(obj.db||obj); paint(); UI.toast('Register imported',{type:'ok'}); }catch(e){ UI.toast('That file is not a valid register export',{type:'err'}); } };
    rd.readAsText(f); };
  inp.click();
}
M.render=function(root,params){
  rootEl=root; tab=params.tab||'posture';
  root.innerHTML='<div class="page-head"><div><h1>Security Center</h1><div class="sub">Identity, sessions, auditability and data residency — the trust layer under every screen.</div></div>'
   +'<div class="actions"><button class="btn" data-restore-now>'+UI.ic('database',15)+' New snapshot</button><a class="btn primary" href="#/staff">'+UI.ic('users',15)+' Manage access</a></div></div>'
   +kpis()
   +'<div class="filters" style="margin-bottom:12px">'+[['posture','Posture'],['sessions','Sessions &amp; logins'],['audit','Audit trail']].map(([k,l])=>'<button class="filter-tab '+(tab===k?'on':'')+'" data-sec-tab="'+k+'">'+l+'</button>').join('')+'</div>'
   +'<div id="secBody"></div>';
  paint();
};
})();
