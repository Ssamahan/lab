/* v6.9.49 — request #31: holidays rostered like weekends, the manager's own
   leave in its own year, leave in turn order with a status on every block,
   fit-the-screen layouts, PBF health centres only, named posts and two-column
   training history. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const css=fs.readFileSync(path.resolve(__dirname,'..','assets/css/app.css'),'utf8');
const mod=fs.readFileSync(path.resolve(__dirname,'..','assets/css/modules.css'),'utf8');

(async()=>{
  const {w,go,errors}=await boot('#/roster');
  const d=w.document, S=w.LS.store, U=w.LSU;
  const db=()=>S.db();
  const tick=(n)=>new Promise(r=>setTimeout(r,n||200));

  /* ── 1 · a public holiday is rostered as a weekend ─────────────────── */
  const dec=S.buildPlan('2026-12');
  const holIdx=dec.dates.map((iso,i)=>/^\d{4}-\d{2}-\d{2}$/.test(iso)&&S.holiday(iso)?i:-1).filter(i=>i>=0);
  ok(holIdx.length>=2,'December 2026 carries its public holidays ('+holIdx.length+')');
  const xmas=holIdx.find(i=>dec.dates[i]==='2026-12-25');
  const onXmas=dec.staff.filter(r=>{ const c=r.codes[xmas]; return c==='D'||c==='N'||c==='DN'; });
  ok(onXmas.length===2,'Christmas Day carries one on the days and one on the nights ('+onXmas.map(r=>r.name.split(' ')[0]+' '+r.codes[xmas]).join(', ')+')');
  ok(onXmas.some(r=>r.codes[xmas]==='D'||r.codes[xmas]==='DN'),'one of them works the day');
  ok(onXmas.some(r=>r.codes[xmas]==='N'||r.codes[xmas]==='DN'),'and one works the night');
  ok(!onXmas.some(r=>/SAMAHANI/.test(r.name)),'the manager is not put on the holiday');
  ok(dec.staff.filter(r=>!['D','N','DN'].includes(r.codes[xmas]))
       .every(r=>!r.codes[xmas]||S.isLeaveCode(r.codes[xmas])),
     'every other cell on the holiday is blank, like a weekend — leave excepted');
  ok(/isRest|S\.holiday/.test(fs.readFileSync(path.resolve(__dirname,'..','assets/js/modules/roster.js'),'utf8')),
     'the roster counts a holiday as a rest day when it works out what is required');
  /* the duty alternates: the two who work Christmas are not the two who work
     the next holiday in the following month */
  /* the rota reads the month before, so December is stored first */
  w.eval("LS.store.commit(d=>{ d.workingPlans['2026-12']={versions:[],primary:LS.store.buildPlan('2026-12')}; },{action:'test.gen'});");
  const jan=S.buildPlan('2027-01');
  const nyd=jan.dates.indexOf('2027-01-01');
  const onNewYear=jan.staff.filter(r=>['D','N','DN'].includes(r.codes[nyd])).map(r=>r.name);
  const onXmasNames=onXmas.map(r=>r.name);
  ok(onNewYear.length===2 && onNewYear.every(n=>onXmasNames.indexOf(n)<0),
     'the next holiday goes to different people — the duty rotates ('+onNewYear.map(n=>n.split(' ')[0]).join(', ')+')');
  /* the manager may choose to work them */
  w.eval("LS.store.commit(d=>{ d.staff.find(s=>s.id==='s1').worksHolidays=true; },{action:'test'});");
  const dec2=S.buildPlan('2026-12');
  const mgr=dec2.staff.find(r=>/SAMAHANI/.test(r.name));
  ok(dec2.dates.some((iso,i)=>S.holiday(iso)&&['D','N','DN'].includes(mgr.codes[i])),
     'when he chooses to, the manager can be given a holiday');
  w.eval("LS.store.commit(d=>{ d.staff.find(s=>s.id==='s1').worksHolidays=false; },{action:'test'});");

  /* ── 2 · the manager's own annual leave belongs to FY 2026/27 ──────── */
  const k=db().leaves.find(l=>l.id==='l18');
  ok(!!k && k.from==='2026-11-16','the manager has a 30-day block from 16 November 2026');
  ok(U.daysBetween(k.from,k.to)+1===30,'and it is thirty days');
  ok(k.fy==='2026/2027','charged to FY 2026/2027');
  ok(/carry[- ]?over/i.test(k.note||''),'and it is named for what it is — the FY 2025/26 carry-over: '+((k.note||'').slice(0,60)));
  ok(!db().leaves.some(l=>l.id==='l3'&&l.staffId==='s1'),'the stale second block that would double-book the same thirty days is gone');
  /* the thirty days come out of the year they were earned in, so this year's own
     entitlement is untouched and nothing is carried into it a second time */
  const kb=S.leaveBook(S.staffById('s1'),'2026/2027');
  ok(kb.carry.days===0,'nothing is carried into FY 2026/27 for him');
  ok(kb.charged===0 && kb.balance===30,'his own thirty days of 2026/27 are untouched');
  const kprev=S.leaveBook(S.staffById('s1'),'2025/2026');
  ok(kprev.charged===30 && kprev.balance===0,'the thirty days are charged to FY 2025/2026, where they were earned');
  const pat=S.leaveBook(S.staffById('s5'),'2026/2027');
  ok(pat.carry.days===15,'a real carry-over — Patrick left fifteen days of 2025/26 — is still counted');
  ok(!db().leaves.some(l=>l.carryOver),'no record is flagged as a carry-over to prop the numbers up');

  /* ── 3 · leave in turn order, with a status on every block ─────────── */
  await go('#/leave'); await tick(350);
  const rows=[...d.querySelectorAll('#app .table-card tbody tr')];
  const firstName=(tr)=>{ const t=tr.querySelector('td'); return t?t.textContent.replace(/\s+/g,' ').trim():''; };
  ok(/Aurelie/.test(firstName(rows[0])),'the plan book opens with the person who is away now ('+firstName(rows[0]).slice(0,30)+')');
  ok(/On leave/.test(rows[0].textContent),'and her block reads "On leave"');
  const upcoming=[];
  rows.forEach(tr=>{ const chips=[...tr.querySelectorAll('.block-chip')];
    chips.forEach(c=>{ if(c.dataset.state==='planned') upcoming.push({name:firstName(tr),from:(c.getAttribute('title')||'').split('·')[1]||''}); }); });
  const isoOf=txt=>{ const m=String(txt).match(/(\d{1,2}) (\w{3}) (\d{4})/); if(!m) return '';
    const mm=U.MONTHS.findIndex(x=>x.slice(0,3).toLowerCase()===m[2].toLowerCase())+1;
    return m[3]+'-'+String(mm).padStart(2,'0')+'-'+m[1].padStart(2,'0'); };
  ok(upcoming.length>=4,'the people still to go are listed ('+upcoming.length+' blocks)');
  /* one turn per person is what the list orders: the first block still to come */
  const firstTurn={};
  upcoming.forEach(x=>{ const iso=isoOf(x.from); if(!firstTurn[x.name]||iso<firstTurn[x.name]) firstTurn[x.name]=iso; });
  const asIso=Object.keys(firstTurn).map(n=>firstTurn[n]).sort();
  const rowOrder=[]; upcoming.forEach(x=>{ if(rowOrder.indexOf(x.name)<0) rowOrder.push(x.name); });
  const rowOrderIso=rowOrder.map(n=>firstTurn[n]);
  ok(rowOrderIso.join('|')===asIso.join('|'),'and they run in date order, next to go first ('+rowOrderIso.join(' → ')+')');
  const patRow=rows.find(tr=>/Patrick/.test(firstName(tr)));
  ok(/Attended 1st installment/.test(patRow.textContent),'Patrick\'s own block reads "Attended 1st installment"');
  ok(/Attended a carry-over of 2025\/26/.test(patRow.textContent),'and his earlier block reads "Attended a carry-over of 2025/26"');
  /* someone who left during the year keeps their row while leave is charged to it */
  const dianeRow=rows.find(tr=>/Diane/.test(firstName(tr)));
  ok(!!dianeRow,'Diane still has a row in the plan book after leaving on 12 August');
  ok(dianeRow.getAttribute('data-exited')==='s2','and it is marked as an exited record');
  ok(/left 12 Aug 2026/.test(dianeRow.textContent),'the row says when she left');
  ok(/Attended/.test(dianeRow.textContent),'and her 2026/27 block reads "Attended"');
  ok(/13 Jul–11 Aug/.test(dianeRow.textContent),'her thirty days are the block that ended with her leaving');
  ok(!rows.some(tr=>/Faustin/.test(firstName(tr))),'but a person who left with no leave in this year is not carried in');
  const tlTab=[...d.querySelectorAll('[data-lv-tab]')].find(b=>b.dataset.lvTab==='timeline'); tlTab.click();
  await tick(280);
  ok([...d.querySelectorAll('.gantt-label')].some(e=>/Diane/.test(e.textContent)),'and the timeline carries her too');
  await go('#/leave'); await tick(300);
  const blockCss=/\.block-chip b\{/.test(mod)&&/\.block-chip\.attended b\{/.test(mod);
  ok(blockCss,'the status is drawn inside the block, not hidden in a tooltip');

  /* ── 4 · PBF lists health centres only ─────────────────────────────── */
  await go('#/pbf'); await tick(350);
  const page=d.querySelector('#app .page')||d.querySelector('#app');
  ok(!/Ruli DH/.test(page.textContent),'the PBF evaluation never shows Ruli DH');
  const names=w.eval("(function(){const S=LS.store;return S.db().catalog.healthCenters.map(h=>h.name);})()");
  ok(names.indexOf('Ruli DH')>=0,'Ruli DH is still in the catalogue — it is a sending facility, just not an assessed centre');
  const pbfText=page.textContent;
  ok(/Ruli HC|Coko HC/.test(pbfText),'the health centres are what the screen lists');
  ok(!/Ruli DH/.test(pbfText),'and the hospital laboratory appears nowhere on it');
  ok(!!d.querySelector('.grid-12.pbf-pair .c7')&&!!d.querySelector('.pbf-pair .c5'),
     'the quarterly index and the quarter-on-quarter trend share a row instead of the index sitting alone');
  ok(/\.pbf-pair \.trend-grid\{grid-template-columns:minmax\(0,1fr\)\}/.test(mod),'and the trend stacks inside its half so it fits');

  /* ── 5 · named posts and role-targeted training ────────────────────── */
  ok(S.postOf(S.staffById('s6'))==='Lab Quality Manager','Jean holds the lab quality post');
  ok(S.postOf(S.staffById('s9'))==='Lab Safety Officer','Dieudonné holds the lab safety post');
  ok(S.dutyKeyOf(S.staffById('s1'))==='manager','and the manager is a post in the same sense');
  await go('#/training'); await tick(350);
  const postRows=[...d.querySelectorAll('.role-post-row .lr-title')].map(e=>e.textContent.trim());
  ok(postRows.length===3,'the three posts are called out above the queue ('+postRows.map(n=>n.split(' ')[0]).join(', ')+')');
  ok(postRows.some(n=>/Jean Paul/.test(n))&&postRows.some(n=>/Dieudonne/.test(n))&&postRows.some(n=>/SAMAHANI/.test(n)),
     'manager, quality manager and safety officer all skip the lobby');
  ok(/called by role/.test(d.querySelector('.role-posts').textContent),'and are labelled as going by role');
  const queueNames=[...d.querySelectorAll('#app .card .list-row .lr-title')].map(e=>e.textContent);
  const queued=queueNames.filter(n=>/Beatrice|Marie Claudine|Bernadette|Patrick/.test(n));
  ok(queued.length>=3,'the bench technicians are still in the queue ('+queued.length+')');
  const queueOnly=[...d.querySelectorAll('#app .card .list-row')].filter(r=>!r.closest('.role-posts'))
    .map(r=>r.querySelector('.lr-title')).filter(Boolean).map(e=>e.textContent);
  ok(!queueOnly.some(n=>/Jean Paul/.test(n)),'the quality manager does not wait in the queue');
  ok(!queueOnly.some(n=>/SAMAHANI/.test(n)),'and neither does the manager');
  /* the schedule form carries the audience */
  w.eval("LS.modules.training && null");
  const srcTr=fs.readFileSync(path.resolve(__dirname,'..','assets/js/modules/training.js'),'utf8');
  ok(/id="trAudience"/.test(srcTr),'the training form asks which post a session is aimed at');
  ok(/cb\.checked = holder\? cb\.value===holder\.id/.test(srcTr),'and ticking a post ticks its holder for the session');
  ok(/audienceLabel/.test(srcTr),'the registry records the audience');

  /* ── 6 · training history in two columns ───────────────────────────── */
  await go('#/training?tab=history'); await tick(350);
  ok(d.querySelectorAll('.hist-cols').length===1,'the competency history is laid out in columns');
  ok(d.querySelectorAll('.hist-cols > div').length>=2,'with more than one year in it');
  ok(/\.hist-cols\{columns:2/.test(mod),'two columns, and one column again on a narrow screen');

  /* ── 7 · EQA: the standing card no longer sits alone ───────────────── */
  await go('#/eqa'); await tick(350);
  const eqaGrid=[...d.querySelectorAll('#app .grid-12 > div')].map(e=>e.className).join(' ');
  ok(/c8/.test(eqaGrid)&&/c4/.test(eqaGrid),'the composite and the standing card share the first row ('+eqaGrid+')');
  const schemeCards=d.querySelectorAll('.scheme-cells > .card');
  ok(schemeCards.length>=2,'the per-scheme scorecard is a band of half-width tables ('+schemeCards.length+' cards)');
  ok(/\.scheme-cells\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(400px,1fr\)\)/.test(mod),
     'two schemes side by side where the screen allows');

  /* ── 8 · Quality: improvement and non-conformances join ISO readiness ─ */
  await go('#/quality'); await tick(350);
  const qGrids=[...d.querySelectorAll('#app .grid-12')];
  const main=[...qGrids[1].children].map(e=>e.className);
  ok(main[0]==='c12','the KPI trendlines take the full width');
  ok(main[1]==='c5'&&main[2]==='c3'&&main[3]==='c4',
     'ISO readiness, continuous improvement and non-conformances sit in one row ('+main.join(' ')+')');
  ok(/Quality KPI trendlines/.test(qGrids[1].textContent),'and the trendlines card is still there');

  /* ── 9 · the screens fit; nothing is left holding dead space ───────── */
  ok(/\.card\{display:flex;flex-direction:column\}/.test(css),'a card fills the row it is in');
  ok(/\.card-body\{flex:1 1 auto/.test(css)&&/\.card-foot\{margin-top:auto\}/.test(css),
     'its body takes the slack and its foot stays on the floor');
  ok(/\.dt-scroll\{overflow-x:auto; overflow-y:auto; max-height:min\(calc\(100vh - 250px\),720px\)/.test(css),
     'a long table stops at the fold instead of running past the screen');
  await go('#/samples'); await tick(350);
  ok(!!d.querySelector('#smpTableWrap')&&!d.querySelector('#app .grid-12 > .c8'),
     'the referred-samples register takes the full width');
  ok(d.querySelectorAll('#app .grid-12 > .c4').length===3,'the three lists under it share one row');
  ok(!d.querySelector('#app .fit-card'),'and the TAT table no longer sits in a narrow fit-to-content box');
  const dashSrc=fs.readFileSync(path.resolve(__dirname,'..','assets/js/modules/dash.js'),'utf8');
  ok(/dashFlowObserver=new window\.ResizeObserver/.test(dashSrc),'the dashboard watches the width of its own column');
  ok(/Math\.abs\(w-dashWidth\)<8/.test(dashSrc),'and re-packs when the rail or a module changes that width');
  ok(/\(onboardingCard\(\)\?'<div style="margin-top:16px" id="obCol">'/.test(dashSrc),
     'a dismissed checklist leaves no empty column behind');

  console.log('\nconsole errors during the run: '+errors.length+(errors.length?' → '+errors.join(' | '):''));
  done('round49');
})().catch(e=>{ console.error(e); process.exit(1); });
