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
  const cover=S.stockCover();
  const covTrend=S.stockTrend();
  const eqaRows=S.eqaSeries('__all');
  const eqaCmp=eqaRows.length?Math.round(U.avg(eqaRows.map(x=>x.score))*10)/10:null;
  const complianceSpark=st.tatCompliance==null?[0,0,0,0,0,0,0,0]:S.throughput(30).map(()=>Math.round(st.tatCompliance));
  return '<div class="grid-12 stagger" style="margin-bottom:16px">'
   +'<div class="c3">'+UI.stat({label:'Active worklist',value:st.active,icon:'flask-conical',formatted:'0',delta:trend(reg),note:st.today+' registered today',spark:C.spark(reg,{color:'var(--gold)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'TAT compliance · '+st.tatWindow+'d',value:st.tatCompliance==null?0:st.tatCompliance,dec:1,unit:'%',icon:'timer',formatted:'0.0',delta:trend(res),
      note:st.tatCompliance==null?'No result on the register yet':st.overdue+' past target now',spark:C.spark(complianceSpark,{color:'var(--pos)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'Days of stock cover',value:cover.median===null?0:cover.median,unit:'median days',icon:'package',formatted:'0',
      note:cover.soonest?cover.soonest.name.split(' ')[0]+' in '+cover.soonest.daysLeft+'d':'No consumption logged yet',
      spark:C.spark(covTrend.filter(x=>x.daysLeft!=null).map(x=>Math.min(x.daysLeft,180)).slice(0,14),{color:'var(--amber)'})})+'</div>'
   +'<div class="c3">'+UI.stat({label:'EQA composite',value:eqaCmp===null?0:eqaCmp,dec:1,unit:'%',icon:'target',formatted:'0.0',
      note:eqaRows.length?eqaRows.length+' PT rounds scored':'No PT round scored yet',
      spark:eqaRows.length?C.spark(eqaRows.map(x=>x.score),{color:'var(--pos)'}):C.spark([0,0,0,0,0,0],{color:'var(--pos)'})})+'</div>'
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

function eqaCard(){
  const progs=S.eqaPrograms();
  const rows=S.eqaSeries('__all');
  const latest=U.avg(rows.map(x=>x.score));
  return UI.card({title:'EQA performance',sub:'External quality assessment · minimum acceptable '+S.EQA_MIN+'%',icon:'award',
    tools:'<select class="select" id="eqaProgram" style="height:28px;font-size:11px;width:auto"><option value="__all" selected>All PTs</option>'
      +progs.map(p=>'<option value="'+U.esc(p)+'">'+U.esc(p)+'</option>').join('')+'</select>',
    body:'<div id="eqaChart"></div>'
      +'<div class="legend" style="margin-top:8px"><span class="lg"><span class="sw" style="background:var(--gold)"></span>PT score</span>'
      +'<span class="lg"><span class="sw sq" style="background:var(--pos-soft)"></span>≥ '+S.EQA_MIN+' % acceptable</span>'
      +'<span class="lg" style="margin-left:auto;color:var(--text-faint)">'+(rows.length?rows.length+' round'+(rows.length===1?'':'s')+' scored':'No scored round yet')+'</span></div>',
    foot:'<span>'+(rows.length?'Mean score '+(Math.round(latest*10)/10)+'% across '+progs.length+' scheme'+(progs.length===1?'':'s'):'Scores appear as soon as a PT round is reported')+'</span><a class="more" href="#/eqa" style="color:var(--gold)">EQA workspace '+UI.ic('arrow-right',12)+'</a>'});
}

/* Category always comes from the referral catalogue, never from a roster or from
   a stale field on an old record: the test name is looked up in
   catalog.tests and the category is whatever the referral module says it is. */
function referralCat(name){
  const t=(S.db().catalog.tests||[]).find(x=>x.name===name);
  return (t&&t.cat)||'Referral';
}
function tatCard(){
  /* Only referred samples count: in-house bench work is not a referral, so it has
     no place in a referral turnaround card. */
  const samples=S.referredSamples().filter(s=>s.resultedAt);
  const byCat=U.groupBy(samples,s=>referralCat(s.test));
  const items=Object.keys(byCat).map(cat=>{
    const list=byCat[cat];
    const tat=U.avg(list.map(s=>S.tatFor(s).elapsedH));
    const target=U.avg(list.map(s=>S.tatFor(s).targetH));
    return {label:cat,value:Math.round(tat),display:Math.round(tat)+'h',suffix:'avg',target:Math.round(target),tone: tat>target?'amber':'teal', n:list.length};
  }).sort((a,b)=>b.value-a.value).slice(0,7);
  return UI.card({title:'Turnaround by test category',sub:'Referred samples only · category from the referral catalogue',icon:'timer',
    body:'<div id="tatBars"></div>',
    foot:'<span>Target marker shown per category</span><span class="mono">n='+samples.length+'</span>'});
}

function referralCard(){
  const rows=S.referralTAT(12);
  const max=rows.length?rows[0].registered:1;
  const total=U.sum(rows,r=>r.registered);
  return UI.card({title:'Referral network',sub:'Who we refer to · registered vs resulted · last 12 months',icon:'truck',
    body:rows.length?'<div style="display:flex;flex-direction:column;gap:11px">'+rows.map((r,i)=>{
      const tone=r.compliance==null?'slate':r.compliance>=90?'teal':r.compliance>=70?'amber':'rose';
      return '<div class="row" style="gap:10px"><div style="width:20px;font-family:var(--font-mono);font-size:10px;color:var(--text-faint)">'+(i+1)+'</div>'
       +'<div class="grow" style="min-width:0"><div class="row between" style="margin-bottom:4px"><span style="font-size:11.8px;color:var(--text)" class="truncate">'+U.esc(r.lab)+'</span>'
       +'<span class="mono xs faint">'+r.registered+' sent · '+r.resulted+' back</span></div>'
       +'<div style="height:5px;border-radius:99px;background:var(--surface-3)"><div style="height:100%;width:'+Math.round(r.registered/max*100)+'%;border-radius:99px;background:linear-gradient(90deg,var(--gold-700),var(--gold-300))"></div></div></div>'
       +'<div style="text-align:right;width:62px"><span class="pill '+tone+' mono">'+(r.compliance==null?'—':r.compliance+'%')+'</span><div class="xs faint" style="margin-top:3px">'+(r.avgH!=null?r.avgH+'h avg':'no result')+'</div></div></div>';
    }).join('')+'</div>':'<div class="chart-empty">No referred sample on the register yet</div>',
    foot:'<span>Compliance = result inside the test target · NRL 72h · CHUK 48h</span><span class="mono">'+total+' referrals</span>'});
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
  return UI.card({title:'Live activity',sub:'Registered and resulted, side by side',icon:'radio',
    tools:'<span class="pill teal"><span class="dot live"></span> live</span>',
    body:'<div class="feed feed-fill" id="liveFeed">'+S.feed().map(f=>'<div class="feed-item"><div class="fic '+f.tone+'">'+UI.ic(f.icon,12)+'</div><div class="grow" style="min-width:0"><div class="ftxt">'+f.text+'</div></div><time>'+U.relTime(f.ts)+'</time></div>').join('')+'</div>'});
}

/* Shift language: no times on the card. During daylight a person on the day
   shift is simply "On day duty"; someone whose night block is tonight is
   "Coming for a night". After 17:00 the night crew reads "On night duty".
   Night first, then the day shift, then authorised leave and people at home. */
function kigaliHour(){ return +new Date().toLocaleString('en-GB',{hour:'2-digit',hour12:false,timeZone:'Africa/Kigali'}); }
function dutyLabel(state,hour,isNight){
  if(state.kind==='leave') return {label:state.label,tone:'amber',rank:3};
  if(state.kind==='training') return {label:'In training',tone:'gold',rank:2};
  if(state.kind==='off') return {label:'At home',tone:'slate',rank:4};
  if(state.kind==='exited') return {label:'Exited',tone:'slate',rank:5};
  const night=state.kind==='night'||state.kind==='daynight';
  if(night) return isNight?{label:'On night duty',tone:'blue',rank:0}:{label:'Coming for a night',tone:'blue',rank:0};
  if(isNight) return {label:'On day duty · back tomorrow',tone:'teal',rank:2};
  return {label:'On day duty',tone:'teal',rank:1};
}
function dutyCard(){
  const iso=U.todayISO();
  const hour=kigaliHour();
  const isNight=hour>=17||hour<8;
  const rows=S.activeStaff().map(s=>{
    let state=S.shiftState(s,iso);
    /* A guessed day off is not evidence: when no working plan covers today the
       contract pattern cannot say someone is at home, so they read as on duty. */
    if(state.kind==='off'&&state.source==='pattern') state={code:'D',kind:'day',label:'On day duty',tone:'teal',source:'pattern'};
    return {staff:s,state,sh:Object.assign({kind:state.kind},dutyLabel(state,hour,isNight))};
  });
  rows.sort((a,b)=>a.sh.rank-b.sh.rank || a.staff.name.localeCompare(b.staff.name));
  const working=rows.filter(r=>r.sh.rank<=2);
  const away=rows.filter(r=>r.sh.rank>=3);
  const nights=rows.filter(r=>r.sh.label.indexOf('night')>=0).length;
  const source=S.planCovers(iso)?'Working plan':'Contract pattern';
  const row=r=>'<div class="duty-card" data-duty-kind="'+r.state.kind+'">'+U.avatar(r.staff.name,'sm')
    +'<div style="min-width:0;flex:1"><div class="nm truncate">'+U.esc(r.staff.name)+'</div><div class="rl truncate">'+U.esc(r.staff.role)+'</div></div>'
    +'<span class="pill '+r.sh.tone+'"><span class="dot'+(r.sh.rank<=1?' live':'')+'"></span>'+U.esc(r.sh.label)+'</span></div>';
  return UI.card({title:'On duty now',sub:U.fmtDate(iso)+' · '+U.DOWL[U.dow(iso)]+' · '+(isNight?'night':'day')+' · '+source,icon:'users',
    tools:'<a class="more" href="#/roster" style="color:var(--gold)">Roster '+UI.ic('arrow-right',12)+'</a>',
    body:'<div class="row wrap gap-sm" style="margin-bottom:10px">'
      +'<span class="pill teal">'+working.length+' on duty</span>'
      +'<span class="pill blue">'+nights+' on nights</span>'
      +'<span class="pill slate">'+away.length+' away</span>'
      +'</div>'
      +'<div class="on-duty duty-fill" style="align-items:stretch">'+working.map(row).join('')
      +(away.length?'<div class="thread" style="margin:4px 0"></div>'+away.map(row).join(''):'')+'</div>',
    foot:'<span>Night shift is 17:00–08:00 the next day; the day crew is 08:00–17:00.</span><span class="mono">'+working.length+' of '+rows.length+' on duty</span>'});
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
  if(!LS.auth.can('edit')) return '';
  return '<div class="row between wrap" style="margin-top:26px;padding-top:16px;border-top:1px solid var(--border);gap:14px">'
   +'<div class="row wrap" style="gap:7px">'
    +['ISO 15189 aligned','GDPR','HIPAA-ready','Rwanda data residency','AES-256 at rest'].map(t=>'<span class="trust-badge" style="border-color:var(--border);color:var(--text-faint);background:var(--surface-inset)">'+UI.ic('badge-check',11)+U.esc(t)+'</span>').join('')
   +'</div>'
   +'<div class="row gap-sm xs faint"><span>Powered by</span><span style="font-family:var(--font-display);color:var(--text-muted);letter-spacing:-.02em;font-size:12px">Lab <b>Systems</b></span><span>· © 2026 Ruli DH</span></div></div>';
}

/* ——— Masonry layout ————————————————————————————————
   Cards are laid into as many columns as the screen can carry and packed into the
   first free slot, so the page ends level instead of leaving a column of nothing.
   Heights are measured after the cards are in place, then converted into a row
   span on an 8 px row grid; the gap between cards is part of the span. */
let dashOnResize=null, dashRaf=0, dashObserver=null;
function layoutDash(root){
  const flow=root&&root.querySelector('#dashFlow'); if(!flow) return;
  const cards=Array.prototype.slice.call(flow.children).filter(el=>el.classList.contains('dash-card'));
  if(!cards.length) return;
  const width=flow.clientWidth||root.clientWidth||window.innerWidth||1100;
  /* Three columns need ~430 px each to stay readable; below 880 px one column is
     the honest layout, not a squeezed pair. */
  const cols=width>=1320?3:width>=880?2:1;
  flow.style.setProperty('--dash-cols',String(cols));
  flow.dataset.cols=String(cols);
  const unit=8, gap=16;
  // 1. column spans first, so every card is measured at its final width
  cards.forEach(card=>{
    const pref=card.getAttribute('data-span')||'';
    /* 'wide' takes two columns on a medium screen; 'table' takes the full width
       only when the screen cannot give it two, because a six-column register needs
       the room. */
    const span=pref==='full'?cols:pref==='table'?(cols>=3?2:cols):pref==='wide'?Math.min(cols,2):1;
    card.style.gridColumn='span '+span;
    card.style.gridRowEnd='auto';
  });
  // 2. one read pass (no thrash), then one write pass
  const heights=cards.map(c=>c.getBoundingClientRect().height||c.offsetHeight||320);
  cards.forEach((card,i)=>{
    const rows=Math.max(2,Math.ceil((heights[i]+gap)/unit));
    card.style.gridRowEnd='span '+rows;
  });
  flow.dataset.height=String(Math.max.apply(null,heights));
}
function watchDashLayout(root){
  if(dashOnResize) window.removeEventListener('resize',dashOnResize);
  dashOnResize=()=>{
    cancelAnimationFrame(dashRaf);
    dashRaf=requestAnimationFrame(()=>{ if(document.body.contains(root)) layoutDash(root); });
  };
  window.addEventListener('resize',dashOnResize);
  // fonts and the first chart paint can change heights after render
  setTimeout(()=>{ if(document.body.contains(root)) layoutDash(root); },180);
  setTimeout(()=>{ if(document.body.contains(root)) layoutDash(root); },900);
  /* If a card grows afterwards — a chart redrawn, a list expanded — re-pack, so the
     row span never falls behind the content and lets cards overlap. */
  if(window.ResizeObserver){
    if(dashObserver) dashObserver.disconnect();
    dashObserver=new window.ResizeObserver(()=>{
      cancelAnimationFrame(dashRaf);
      dashRaf=requestAnimationFrame(()=>{ if(document.body.contains(root)) layoutDash(root); });
    });
    const flow=root.querySelector('#dashFlow');
    if(flow) Array.prototype.forEach.call(flow.children,c=>dashObserver.observe(c));
  }
}
M.layout=layoutDash;

M.render=function(root,params){
  clearTimers();
  if(dashOnResize){ window.removeEventListener('resize',dashOnResize); dashOnResize=null; }
  const db=S.db();
  /* Cards go in reading order into one packed grid. `data-span` says how much
     room a card earns: the throughput chart and the activity feed take two
     columns, the worklist table takes the whole width because it is a table. */
  root.innerHTML=hero()+kpiRow()
   +'<div class="dash-flow" id="dashFlow">'
     +'<div class="dash-card" data-span="wide">'+throughputCard()+'</div>'
     +'<div class="dash-card">'+dutyCard()+'</div>'
     +'<div class="dash-card">'+tatCard()+'</div>'
     +'<div class="dash-card">'+referralCard()+'</div>'
     +'<div class="dash-card">'+eqaCard()+'</div>'
     +'<div class="dash-card">'+equipmentCard()+'</div>'
     +'<div class="dash-card" data-span="table">'+worklistCard()+'</div>'
     +'<div class="dash-card" data-span="full" id="feedCol">'+feedCard()+'</div>'
   +'</div>'
   +'<div style="margin-top:16px" id="obCol">'+onboardingCard()+'</div>'
   +trustFooter();

  // throughput chart
  const thr=S.monthlyThroughput(12);
  C.line(root.querySelector('#thrChart'),{id:'thr',height:238,series:[
    {name:'Registered',color:'var(--gold)',values:thr.map(d=>d.registered)},
    {name:'Resulted',color:'var(--teal-400)',values:thr.map(d=>d.resulted)}
  ],labels:thr.map(d=>d.label),tipFmt:v=>U.fmtNum(v)+' samples',extraTip:i=>'<div class="tr"><span class="k">STAT</span><span class="v">'+thr[i].stat+'</span></div><div class="tr"><span class="k">Gap</span><span class="v">'+(thr[i].registered-thr[i].resulted)+'</span></div>'});
  // TAT bars
  C.hbars(root.querySelector('#tatBars'),{items:(function(){
    const samples=S.referredSamples().filter(s=>s.resultedAt);
    const byCat=U.groupBy(samples,s=>referralCat(s.test));
    return Object.keys(byCat).map(cat=>{ const list=byCat[cat]; const tat=U.avg(list.map(s=>S.tatFor(s).elapsedH)); const target=U.avg(list.map(s=>S.tatFor(s).targetH));
      return {label:cat,value:Math.round(tat),display:Math.round(tat)+'h',suffix:'avg',target:Math.round(target),tone:tat>target?'amber':'teal'}; }).sort((a,b)=>b.value-a.value).slice(0,7);
  })()});
  // EQA — an external-quality score chart, all PTs by default
  const eqaSel=root.querySelector('#eqaProgram');
  const drawEqa=(prog)=>{
    const rows=S.eqaSeries(prog||'__all');
    const host=root.querySelector('#eqaChart'); if(!host) return;
    if(!rows.length){
      host.innerHTML='<div class="chart-empty">No PT round has been scored yet. Record a round in the EQA workspace and its score appears here.</div>';
      return;
    }
    C.line(host,{id:'eqa',height:236,labels:rows.map(x=>x.code),yFmt:v=>Math.round(v)+'%',
      series:[{name:'PT score',color:'var(--gold)',values:rows.map(x=>x.score)}],
      bands:[{from:0,to:S.EQA_MIN,color:'rgba(226,109,109,.08)'}],
      min:0,max:100,target:{value:S.EQA_MIN,label:S.EQA_MIN+' % minimum'},
      tipFmt:v=>v+'%',extraTip:i=>'<div class="tr"><span class="k">Scheme</span><span class="v">'+U.esc(rows[i].program)+'</span></div><div class="tr"><span class="k">Reported</span><span class="v">'+U.fmtDate(String(rows[i].at||'').slice(0,10))+'</span></div>'});
  };
  if(eqaSel){ eqaSel.value='__all'; eqaSel.onchange=()=>drawEqa(eqaSel.value); }
  drawEqa('__all');

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

  // pack the cards once the charts have painted, then keep them packed on resize
  layoutDash(root);
  watchDashLayout(root);

  // gentle magnetic hover on primary CTAs
  if(!U.reduced() && window.matchMedia('(pointer:fine)').matches){
    U.$$('.btn.magnetic').forEach(b=>{
      b.addEventListener('mousemove',e=>{ const r=b.getBoundingClientRect(); const dx=(e.clientX-(r.left+r.width/2))/r.width*8; const dy=(e.clientY-(r.top+r.height/2))/r.height*8; b.style.transform='translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'; });
      b.addEventListener('mouseleave',()=>{ b.style.transform=''; });
    });
  }
};
M.exportBriefing=function(){
  const st=S.sampleStats();
  const rows=[['Metric','Value','Window'],
    ['Active worklist',st.active,'now'],['Registered today',st.today,'today'],['TAT compliance',st.tatCompliance==null?'no result on the register yet':st.tatCompliance+'%',st.tatWindow+' days'],
    ['Past TAT target',st.overdue,'now'],['STAT awaiting',st.stat,'now'],
    ['Median days of stock cover',S.stockCover().median===null?'no consumption logged':S.stockCover().median,'now'],
    ['ISO 15189 readiness',S.compliance().pct+'%','current'],
    ['EQA composite',(function(){ const r=S.eqaSeries('__all'); return r.length?Math.round(U.avg(r.map(x=>x.score)))+'%':'no PT round scored'; })(),'all PT rounds']];
  U.exportCSV('ruli-lab-briefing-'+U.todayISO()+'.csv',rows,{title:'Command Center briefing',actor:LS.auth.user?LS.auth.user.name:''});
  UI.toast('Briefing exported with letterhead metadata',{type:'ok',actions:[{label:'Undo',onClick:()=>UI.toast('Export cannot be undone',{type:'info'})}]});
};
M._clear=clearTimers;
})();
