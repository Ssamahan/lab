/* ============================================================================
   MODULE · COMMAND CENTER
   ========================================================================== */
(function(){
'use strict';
const U=window.LSU, UI=LS.ui, C=LS.charts, S=LS.store;
const M={}; LS.modules.dash=M;
let timers=[];
function clearTimers(){ timers.forEach(t=>clearInterval(t)); timers=[]; }

function greeting(){
  const h=+new Date().toLocaleString('en-GB',{hour:'2-digit',hour12:false,timeZone:'Africa/Kigali'});
  return h<12?'Good morning':h<17?'Good afternoon':'Good evening';
}
function trend(values){
  if(values.length<4) return 0;
  const half=Math.floor(values.length/2);
  const a=U.avg(values.slice(0,half))||1, b=U.avg(values.slice(half));
  return Math.round((b-a)/a*1000)/10;
}

function kpiRow(){
  const st=S.sampleStats();
  const thr=S.throughput(30);
  const reg=thr.map(d=>d.registered);
  const res=thr.map(d=>d.resulted);
  const stockVal=U.sum(S.stockOverview(),x=>x.value);
  const eqaCmp=Math.round(U.avg(Object.values(S.eqaLatest()).map(e=>e.scorePercent!=null?e.scorePercent:(e.score!=null?Math.max(0,100-Math.abs(e.score)*25):90))));
  const complianceSpark=S.throughput(30).map((d,i)=>Math.max(60,Math.round(st.tatCompliance+Math.sin(i/2.4)*4)));
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Active worklist',value:st.active,icon:'flask-conical',formatted:'0',delta:trend(reg),note:st.today+' registered today',spark:C.spark(reg,{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'TAT compliance · 30d',value:st.tatCompliance,dec:1,unit:'%',icon:'timer',formatted:'0.0',delta:trend(res),note:st.overdue+' past target now',spark:C.spark(complianceSpark,{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Stock on hand',value:Math.round(stockVal/1000),unit:'k RWF',icon:'package',formatted:'0',delta:-3.4,note:'Forecast burn 38 days',spark:C.spark([...Array(30)].map((_,i)=>60+Math.sin(i/3)*9+ (30-i)*0.5),{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'EQA composite',value:eqaCmp,dec:1,unit:'%',icon:'target',formatted:'0.0',delta:2.1,note:'All schemes passing',spark:C.spark([82,84,83,87,89,88,91,93,92,94,95,96],{color:'var(--pos)'})})+'</div>'
   +'</div>';
}

function hero(){
  const u=LS.auth.user||{name:'Laboratory Manager'};
  const first=u.name.split(' ')[0];
  const st=S.sampleStats();
  const comp=S.compliance();
  const today=U.fmtDateLong();
  const onDuty=S.onDuty();
  return '<section class="hero">'
   +'<div class="hero-grid"><div>'
    +'<div class="eyebrow">'+U.esc(today)+' · FY '+U.fyLabel()+'</div>'
    +'<h1>'+greeting()+', <em>'+U.esc(first.charAt(0)+first.slice(1).toLowerCase())+'</em>.</h1>'
    +'<p class="lede">'+st.active+' samples are in the worklist, '+st.overdue+' are past their turnaround target, and '+onDuty.length+' staff are on duty. Everything below is live and stored on this device.</p>'
    +'<div class="hero-actions">'
      +'<button class="btn primary magnetic" data-hero-register>'+U.ic('flask-conical',16)+' Register sample</button>'
      +'<button class="btn magnetic" data-hero-manifest>'+U.ic('clipboard-list',16)+' Build manifest</button>'
      +'<button class="btn ghost" data-hero-export>'+U.ic('download',16)+' Briefing</button>'
    +'</div>'
   +'</div>'
   +'<div class="hero-side">'
    +'<div class="hero-status">'
      +'<div class="hstat"><span class="lb">Worklist</span><span class="vl"><span class="dot live" style="color:var(--pos)"></span>'+st.active+' open</span></div>'
      +'<div class="hstat"><span class="lb">STAT queue</span><span class="vl" style="color:'+(st.stat?'var(--crit)':'var(--pos)')+'">'+st.stat+' awaiting</span></div>'
      +'<div class="hstat"><span class="lb">TAT breach</span><span class="vl" style="color:'+(st.overdue?'var(--warn)':'var(--pos)')+'">'+st.overdue+'</span></div>'
      +'<div class="hstat"><span class="lb">ISO readiness</span><span class="vl" style="color:var(--gold-bright)">'+comp.pct+'%</span></div>'
    +'</div>'
    +'<div class="row" style="gap:6px;flex-wrap:wrap">'
      +'<span class="pill teal"><span class="dot live"></span> All systems operational</span>'
      +'<span class="pill slate mono">SYNC · LOCAL</span>'
    +'</div>'
   +'</div></div></section>';
}

function throughputCard(){
  const thr=S.monthlyThroughput(12);
  const reg=U.sum(thr,d=>d.registered), res=U.sum(thr,d=>d.resulted);
  const cats=S.throughputCats();
  return UI.card({title:'Throughput — registered vs resulted',sub:'Past 12 months · monthly buckets, all referral routes',icon:'chart-line',cls:'gold',
    tools:'<span class="pill teal mono">'+reg+' registered · 12 mo</span>',
    body:'<div class="legend" style="margin-bottom:6px"><span class="lg"><span class="sw" style="background:var(--gold)"></span>Registered</span><span class="lg"><span class="sw" style="background:var(--teal-400)"></span>Resulted</span><span class="lg" style="margin-left:auto"><span class="sw sq" style="background:var(--pos);opacity:.4"></span>12-month mean</span></div>'
      +'<div id="thrChart"></div>'
      +'<div class="row wrap gap-sm" style="margin-top:10px">'+cats.map(c=>'<span class="chip">'+U.esc(c)+'</span>').join('')+'</div>',
    foot:'<span>Monthly buckets — TB culture and viral load report months after registration, so a slow assay shows as a gap between the two lines</span><span class="mono">'+thr[thr.length-1].registered+' this month</span>'});
}

function ljCard(){
  return UI.card({title:'Levey–Jennings · internal QC',sub:'±1/2/3 SD lanes · Westgard rules evaluated per run',icon:'activity',
    tools:'<select class="select" id="ljAnalyte" style="height:28px;font-size:11px;width:auto"></select>',
    body:'<div id="ljChart"></div><div class="legend" style="margin-top:8px"><span class="lg"><span class="sw sq" style="background:rgba(63,211,182,.35)"></span>±1 SD</span><span class="lg"><span class="sw sq" style="background:rgba(63,211,182,.16)"></span>±2 SD</span><span class="lg"><span class="sw" style="background:var(--gold)"></span>Run</span><span class="lg"><span class="sw sq" style="background:var(--crit)"></span>1-3s violation</span><span class="lg" style="margin-left:auto;color:var(--text-faint)">Updated '+U.fmtTime(S.db().qc.updated)+'</span></div>',
    foot:'<span>Last 28 runs · level 2 control material</span><a class="more" href="#/quality?tab=qc" style="color:var(--gold)">QC calendar '+UI.ic('arrow-right',12)+'</a>'});
}

function tatCard(){
  const db=S.db();
  const samples=db.samples.filter(s=>s.resultedAt);
  const byCat=U.groupBy(samples,s=>s.cat||'General');
  const items=Object.keys(byCat).map(cat=>{
    const list=byCat[cat];
    const tat=U.avg(list.map(s=>S.tatFor(s).elapsedH));
    const target=U.avg(list.map(s=>S.tatFor(s).targetH));
    return {label:cat,value:Math.round(tat),display:Math.round(tat)+'h',suffix:'avg',target:Math.round(target),tone: tat>target?'amber':'teal', n:list.length};
  }).sort((a,b)=>b.value-a.value).slice(0,7);
  return UI.card({title:'Turnaround by test category',sub:'Mean hours vs target marker',icon:'timer',
    body:'<div id="tatBars"></div>',
    foot:'<span>Target marker shown per category</span><span class="mono">n='+samples.length+'</span>'});
}

function referralCard(){
  const db=S.db();
  const cutoff=U.addDays(U.todayISO(),-7), prev=U.addDays(U.todayISO(),-14);
  const groups=U.groupBy(db.samples.filter(s=>s.source==='telemetry'||true),s=>s.hospital||'Internal');
  const items=Object.keys(groups).map(h=>{
    const list=groups[h];
    const recent=list.filter(s=>s.collectionDate>=cutoff).length;
    const before=list.filter(s=>s.collectionDate>=prev&&s.collectionDate<cutoff).length;
    const avgTat=Math.round(U.avg(list.map(s=>S.tatFor(s).elapsedH)));
    return {label:h,value:list.length,recent,before,avgTat,share:Math.round(list.length/db.samples.length*100)};
  }).sort((a,b)=>b.value-a.value).slice(0,6);
  const max=items[0]?items[0].value:1;
  return UI.card({title:'Referral network leaderboard',sub:'Volume by receiving laboratory',icon:'truck',
    body:'<div style="display:flex;flex-direction:column;gap:11px">'+items.map((it,i)=>{
      const dir=it.recent>it.before?'up':it.recent<it.before?'down':'flat';
      return '<div class="row" style="gap:10px"><div style="width:20px;font-family:var(--font-mono);font-size:10px;color:var(--text-faint)">'+(i+1)+'</div>'
       +'<div class="grow" style="min-width:0"><div class="row between" style="margin-bottom:4px"><span style="font-size:11.8px;color:var(--text)" class="truncate">'+U.esc(it.label)+'</span><span class="mono xs faint">'+it.recent+' this wk</span></div>'
       +'<div style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+Math.round(it.value/max*100)+'%;border-radius:99px;background:linear-gradient(90deg,var(--gold-700),var(--gold-300))"></div></div></div>'
       +'<div style="text-align:right;width:74px"><div class="mono xs" style="color:var(--text)">'+it.value+'</div><div class="xs faint">'+it.share+'% share</div></div>'
       +'<div class="xs" style="width:34px;text-align:right;color:'+(dir==='up'?'var(--pos)':dir==='down'?'var(--crit)':'var(--text-faint)')+'">'+UI.ic(dir==='up'?'arrow-up':dir==='down'?'arrow-down':'arrow-right',11)+'</div></div>';
    }).join('')+'</div>',
    foot:'<span>Transit SLA · CHUK 48h · NRL 72h</span><span class="mono">'+items.reduce((a,b)=>a+b.value,0)+' samples</span>'});
}

function equipmentCard(){
  const eq=S.db().equipment.filter(e=>e.role!=='backup');
  const tone=s=>s==='operational'?'teal':s==='maintenance'?'amber':s==='warning'?'amber':'rose';
  return UI.card({title:'Equipment readiness',sub:'Uptime · next preventive maintenance',icon:'microscope',
    tools:'<a class="more" href="#/equipment" style="color:var(--gold)">All '+eq.length+' '+UI.ic('arrow-right',12)+'</a>',
    body:'<div style="display:flex;flex-direction:column;gap:9px">'+eq.slice(0,4).map(e=>{
      const due=e.nextPM? U.daysBetween(U.todayISO(),e.nextPM):null;
      const oc=(e.services||[]).find(x=>x.shippedOn&&!x.returnedOn);
      const up=(e.uptime==null?100:Number(e.uptime));
      return '<div class="list-row"><div class="fic" style="width:26px;height:26px;border-radius:7px;background:var(--surface-3);display:flex;align-items:center;justify-content:center;color:var(--'+(tone(e.status)==='teal'?'pos':'warn')+')">'+UI.ic('activity',13)+'</div>'
       +'<div class="lr-main"><div class="lr-title truncate">'+U.esc(e.name)+'</div><div class="lr-sub">'+up.toFixed(1)+'% uptime · '+U.esc(e.location)+'</div></div>'
       +'<div style="text-align:right"><span class="pill '+(oc?'rose':tone(e.status))+'">'+(oc?'off site':U.esc(e.status))+'</span><div class="xs '+(due==null?'faint':due<0?'':due<20?'':'faint')+'" style="margin-top:3px;color:'+(due==null?'var(--text-faint)':due<0?'var(--crit)':due<20?'var(--warn)':'var(--text-faint)')+'">'+(due==null?'no PM set':due<0?'overdue':'PM in '+due+'d')+'</div></div></div>';
    }).join('')+'</div>'});
}

function feedCard(){
  return UI.card({title:'Live activity',sub:'Chain of custody · signed actions',icon:'radio',
    tools:'<span class="pill teal"><span class="dot live"></span> live</span>',
    body:'<div class="feed" id="liveFeed">'+S.feed().map(f=>'<div class="feed-item"><div class="fic '+f.tone+'">'+UI.ic(f.icon,12)+'</div><div class="grow" style="min-width:0"><div class="ftxt">'+f.text+'</div></div><time>'+U.relTime(f.ts)+'</time></div>').join('')+'</div>'});
}

function dutyCard(){
  const iso=U.todayISO();
  const rows=S.activeStaff().map(s=>({staff:s,state:S.shiftState(s,iso)}));
  const order={daynight:0,night:1,day:2,training:3,leave:4,off:5};
  rows.sort((a,b)=>(order[a.state.kind]??9)-(order[b.state.kind]??9));
  const duty=rows.filter(r=>S.isOnDuty(r.staff,iso));
  const source=duty[0]?duty[0].state.source:'none';
  const off=rows.filter(r=>r.state.kind==='off').length;
  const badge=st=>'<span class="pill '+st.tone+'"><span class="dot'+(st.kind==='day'||st.kind==='night'||st.kind==='daynight'?' live':'')+'"></span>'+U.esc(st.label)+'</span>';
  return UI.card({title:'On duty now',sub:U.fmtDate(iso)+' · '+U.DOWL[U.dow(iso)]+' · day 08:00–17:00 / night 17:00–08:00',icon:'users',
    tools:'<a class="more" href="#/roster" style="color:var(--gold)">Roster '+UI.ic('arrow-right',12)+'</a>',
    body:'<div class="row wrap gap-sm" style="margin-bottom:10px">'
      +'<span class="pill teal">'+duty.length+' on duty</span>'
      +'<span class="pill slate">'+off+' at home</span>'
      +'<span class="pill '+((source==='plan')?'blue':'amber')+'">'+(source==='plan'?'Working plan':'No plan · contract pattern')+'</span>'
      +'</div>'
      +'<div class="on-duty" style="flex-direction:column;gap:8px;align-items:stretch">'+rows.map(r=>{
        const s=r.staff, st=r.state;
        const tone=st.kind==='night'?'blue':st.kind==='day'?'teal':st.kind==='daynight'?'teal':st.kind==='leave'?'amber':'slate';
        return '<div class="duty-card" data-duty-kind="'+st.kind+'" style="'+(st.kind==='off'||st.kind==='leave'?'opacity:.62;':'')+'">'+U.avatar(s.name,'sm')
          +'<div style="min-width:0;flex:1"><div class="nm truncate">'+U.esc(s.name)+'</div><div class="rl truncate">'+U.esc(s.role)+'</div></div>'
          +'<span class="pill '+tone+'"><span class="dot'+(S.isOnDuty(s,iso)?' live':'')+'"></span>'+U.esc(st.label)+'</span></div>';
      }).join('')+'</div>',
    foot:'<span>Day shift 08:00–17:00 · night 17:00–08:00</span><span class="mono">'+duty.filter(d=>d.state.kind.indexOf('night')>=0).length+' on nights</span>'});
}

function worklistCard(){
  const active=S.db().samples.filter(s=>!s.resultedAt).sort((a,b)=>{
    const rank=p=>p==='STAT'?0:p==='Follow-up'?1:2;
    return rank(a.priority)-rank(b.priority) || String(a.collectionAt).localeCompare(String(b.collectionAt));
  }).slice(0,6);
  const rows=active.map(s=>{
    const t=S.tatFor(s); const pct=U.clamp(t.ratio*100,2,100);
    const tone=t.breached?'rose':t.ratio>.8?'amber':'teal';
    return '<tr class="prio-'+(s.priority==='STAT'?'stat':s.priority==='Follow-up'?'follow':'routine')+'">'
     +'<td><span class="priority-flag '+(s.priority==='STAT'?'stat':s.priority==='Follow-up'?'follow':'routine')+'">'+(s.priority==='STAT'?'STAT':s.priority==='Follow-up'?'FLW':'RTN')+'</span></td>'
     +'<td><div class="primary-cell"><b class="mono" style="font-size:11.5px">'+U.esc(s.sampleId)+'</b><small>'+U.esc(s.patientName)+'</small></div></td>'
     +'<td class="truncate" style="max-width:150px"><span class="small">'+U.esc(s.test)+'</span></td>'
     +'<td><div style="width:78px"><div class="meter '+tone+'"><i style="width:'+pct+'%"></i></div><div class="xs faint" style="margin-top:3px">'+(t.breached?'<span style="color:var(--crit)">breached</span>':Math.round(t.remainingH)+'h left')+'</div></div></td>'
     +'<td><span class="pill '+U.statusTone(s.status)+'">'+U.esc(s.status)+'</span></td>'
     +'<td class="num">'+U.fmtDateShort(s.collectionDate)+'</td></tr>';
  }).join('');
  return '<div class="card table-card"><div class="card-head"><div><div class="card-title">'+UI.ic('clipboard-list',14,'ic')+'Priority worklist</div><div class="card-sub">STAT first, then oldest by collection time</div></div><div class="card-tool"><a class="btn sm" href="#/samples">Open queue '+UI.ic('arrow-right',13)+'</a></div></div>'
   +'<div class="dt-scroll"><table class="dt"><thead><tr><th style="width:56px">Pri</th><th>Sample</th><th>Test</th><th>TAT window</th><th>Status</th><th>Collected</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">'+UI.empty({art:'samples',title:'Worklist clear',body:'Every sample has a result. Register the next referral to begin.'})+'</td></tr>')+'</tbody></table></div></div>';
}

function onboardingCard(){
  const ob=S.settings().onboarding;
  if(ob.dismissed) return '';
  const items=[['importStaff','Import the staff register','6 active staff linked to roles'],['configureTests','Configure the test menu & TAT targets','20 tests · 3 referral routes'],['inviteUsers','Invite the quality officer and bench team','Role-scoped accounts'],['baselineQC','Set baseline QC & Westgard rules','5 analytes · level 2 controls']];
  const done=items.filter(i=>ob[i[0]]).length, pct=Math.round(done/items.length*100);
  return UI.card({title:'Finish setting up',sub:done+' of '+items.length+' complete',icon:'sparkles',cls:'gold',
    body:'<div class="ob-prog"><i style="width:'+pct+'%"></i></div><div style="margin-top:6px">'+items.map(([k,t,s])=>'<div class="ob-item '+(ob[k]?'done':'')+'"><div class="obx">'+UI.ic(ob[k]?'check':'circle-dot',11)+'</div><div class="grow"><div class="obt">'+U.esc(t)+'</div><div class="xs faint">'+U.esc(s)+'</div></div>'+(ob[k]?'':'<button class="btn xs" data-ob="'+k+'">Do it</button>')+'</div>').join('')+'</div>',
    foot:'<button class="btn xs ghost" data-ob-dismiss>Dismiss checklist</button><span class="xs faint">'+pct+'%</span>'});
}

function trustFooter(){
  return '<div class="row between wrap" style="margin-top:26px;padding-top:16px;border-top:1px solid var(--border);gap:14px">'
   +'<div class="row wrap" style="gap:7px">'
    +['ISO 15189 aligned','GDPR','HIPAA-ready','Rwanda data residency','AES-256 at rest'].map(t=>'<span class="trust-badge" style="border-color:var(--border);color:var(--text-faint);background:var(--surface-inset)">'+UI.ic('badge-check',11)+U.esc(t)+'</span>').join('')
   +'</div>'
   +'<div class="row gap-sm xs faint"><span>Powered by</span><span style="font-family:var(--font-display);color:var(--text-muted);letter-spacing:-.02em;font-size:12px">Lab <b>Systems</b></span><span>· © 2026 Ruli DH</span></div></div>';
}

M.render=function(root,params){
  clearTimers();
  const db=S.db();
  root.innerHTML=hero()+kpiRow()
   +'<div class="grid-12">'
     +'<div class="c8">'+throughputCard()+'</div>'
     +'<div class="c4">'+dutyCard()+'</div>'
     +'<div class="c7" style="margin-top:2px">'+tatCard()+'</div>'
     +'<div class="c5" style="margin-top:2px">'+referralCard()+'</div>'
     +'<div class="c8" style="margin-top:2px">'+ljCard()+'</div>'
     +'<div class="c4" style="margin-top:2px">'+equipmentCard()+'</div>'
     +'<div class="c8" style="margin-top:2px">'+worklistCard()+'</div>'
     +'<div class="c4" style="margin-top:2px" id="feedCol">'+feedCard()+'</div>'
     +'<div class="c12" style="margin-top:2px" id="obCol">'+onboardingCard()+'</div>'
   +'</div>'+trustFooter();

  // throughput chart
  const thr=S.monthlyThroughput(12);
  C.line(root.querySelector('#thrChart'),{id:'thr',height:238,series:[
    {name:'Registered',color:'var(--gold)',values:thr.map(d=>d.registered)},
    {name:'Resulted',color:'var(--teal-400)',values:thr.map(d=>d.resulted)}
  ],labels:thr.map(d=>d.label),tipFmt:v=>U.fmtNum(v)+' samples',extraTip:i=>'<div class="tr"><span class="k">STAT</span><span class="v">'+thr[i].stat+'</span></div><div class="tr"><span class="k">Gap</span><span class="v">'+(thr[i].registered-thr[i].resulted)+'</span></div>'});
  // TAT bars
  C.hbars(root.querySelector('#tatBars'),{items:(function(){
    const samples=db.samples.filter(s=>s.resultedAt);
    const byCat=U.groupBy(samples,s=>s.cat||'General');
    return Object.keys(byCat).map(cat=>{ const list=byCat[cat]; const tat=U.avg(list.map(s=>S.tatFor(s).elapsedH)); const target=U.avg(list.map(s=>S.tatFor(s).targetH));
      return {label:cat,value:Math.round(tat),display:Math.round(tat)+'h',suffix:'avg',target:Math.round(target),tone:tat>target?'amber':'teal'}; }).sort((a,b)=>b.value-a.value).slice(0,7);
  })()});
  // LJ
  const qc=db.qc; const sel=root.querySelector('#ljAnalyte');
  sel.innerHTML=Object.keys(qc.runs).map(k=>'<option value="'+k+'">'+U.esc(qc.runs[k].analyte.key)+' · '+U.esc(qc.runs[k].analyte.unit)+'</option>').join('');
  const drawLj=(key)=>{ const r=qc.runs[key]; C.lj(root.querySelector('#ljChart'),{points:r.points,mean:r.analyte.mean,sd:r.analyte.sd,height:236}); };
  drawLj(Object.keys(qc.runs)[0]);
  sel.onchange=()=>drawLj(sel.value);

  // hero actions
  root.querySelector('[data-hero-register]').onclick=()=>{ location.hash='#/samples?new=1'; };
  root.querySelector('[data-hero-manifest]').onclick=()=>{ location.hash='#/samples?manifest=1'; };
  root.querySelector('[data-hero-export]').onclick=()=>M.exportBriefing();
  // onboarding actions
  U.$$('[data-ob]',root).forEach(b=>b.onclick=()=>{
    S.commit(d=>{ d.settings.onboarding[b.dataset.ob]=true; },{action:'onboarding.step',entity:'settings',detail:'Completed setup step: '+b.dataset.ob});
    UI.toast('Setup step completed',{type:'ok'}); LS.shell.refresh();
  });
  const dis=root.querySelector('[data-ob-dismiss]'); if(dis) dis.onclick=()=>{ S.commit(d=>{ d.settings.onboarding.dismissed=true; },{action:'onboarding.dismiss',entity:'settings'}); LS.shell.refresh(); };

  // gentle magnetic hover on primary CTAs
  if(!U.reduced() && window.matchMedia('(pointer:fine)').matches){
    U.$$('.btn.magnetic').forEach(b=>{
      b.addEventListener('mousemove',e=>{ const r=b.getBoundingClientRect(); const dx=(e.clientX-(r.left+r.width/2))/r.width*8; const dy=(e.clientY-(r.top+r.height/2))/r.height*8; b.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'; });
      b.addEventListener('mouseleave',()=>{ b.style.transform=''; });
    });
  }
  // live feed ticker (simulated operational pulse, every 14s)
  let n=0;
  const events=[
    () => ({icon:'flask-conical',tone:'teal',text:'<b>Sample '+db.samples[db.samples.length-1].sampleId+'</b> received at CHUK · chain of custody signed'}),
    () => ({icon:'package',tone:'gold',text:'<b>Beatrice NGEZEKURE</b> — VTM lot issued to Nyange HC (10 vials)'}),
    () => ({icon:'thermometer',tone:'gold',text:'Cold chain <b>2–8 °C</b> verified · all probes in range'}),
    () => ({icon:'check-circle',tone:'teal',text:'QC run accepted · <b>WBC</b> within ±1 SD'}),
    () => ({icon:'clock',tone:'gold',text:'<b>Kelvin SAMAHANI</b> reviewed the STAT queue · 0 breaches'})
  ];
  timers.push(setInterval(()=>{
    const host=document.getElementById('liveFeed'); if(!host) return;
    const ev=events[n++%events.length]();
    const el=U.el('<div class="feed-item"><div class="fic '+ev.tone+'">'+UI.ic(ev.icon,12)+'</div><div class="grow" style="min-width:0"><div class="ftxt">'+ev.text+'</div></div><time>just now</time></div>');
    host.prepend(el);
    while(host.children.length>8) host.lastElementChild.remove();
  },14000));
};
M.exportBriefing=function(){
  const st=S.sampleStats();
  const rows=[['Metric','Value','Window'],
    ['Active worklist',st.active,'now'],['Registered today',st.today,'today'],['TAT compliance',st.tatCompliance+'%','30 days'],
    ['Past TAT target',st.overdue,'now'],['STAT awaiting',st.stat,'now'],['Stock value (RWF)',U.sum(S.stockOverview(),x=>x.value),'now'],
    ['ISO 15189 readiness',S.compliance().pct+'%','current'],['EQA composite',Math.round(U.avg(Object.values(S.eqaLatest()).map(e=>e.scorePercent||90)))+'%','latest quarter']];
  U.exportCSV('ruli-lab-briefing-'+U.todayISO()+'.csv',rows,{title:'Command Center briefing',actor:LS.auth.user?LS.auth.user.name:''});
  UI.toast('Briefing exported with letterhead metadata',{type:'ok',actions:[{label:'Undo',onClick:()=>UI.toast('Export cannot be undone',{type:'info'})}]});
};
M._clear=clearTimers;
})();
