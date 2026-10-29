/* v6.9.56 — one month, one row per person.
   The plan in force could end up holding several copies of every name: an older
   build pushed each archived version's rows into the plan itself, so a month that
   had been regenerated a few times showed each member of staff five times over.
   This suite plants exactly that damage and checks the console puts it right —
   in the stored plan, on the working plan, on the sheet, and in a reopened session. */
const fs=require('fs'), path=require('path');
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms));
const ROOT=path.resolve(__dirname,'..');

(async()=>{
  /* ── a register carrying the damage the old build could leave behind ──
     A live register is taken as it stands, then the month is wrecked the way the
     old build wrecked it: five copies of the whole roster, and every date twice. */
  const first=await boot('#/roster');
  const base=JSON.parse(first.w.localStorage.getItem('labSystems.v1'));
  first.w.close();
  const names=['Kelvin SAMAHANI','Beatrice NGEZEKURE','Aurelie YANSONEYE','Patrick ISHIMWE',
    'Jean Paul NSENGIYUMVA','Dieudonne NIYIDUHABYOSE','Bernadette MUHAWENIMANA'];
  const dates=[]; for(let i=0;i<10;i++) dates.push('2026-11-'+String(i+1).padStart(2,'0'));
  const row=name=>({name, codes:dates.map((_,i)=>i%7===0?'N':'D')});
  const doubled=[];
  for(let copy=0;copy<5;copy++) names.forEach(n=>doubled.push(row(n)));
  const damaged={
    primary:{
      label:'November 2026', dates:dates.concat(dates),
      staff:doubled.map(r=>({name:r.name, codes:r.codes.concat(r.codes)})),
      meta:{period:'November 2026', date:'2026-10-01', fy:'2026/2027', generated:true, draft:true}
    },
    versions:[{ label:'November 2026', dates:dates.slice(),
      staff:names.map(n=>({name:n, codes:dates.map(()=>'D')})),
      meta:{period:'November 2026', generated:true, draft:true} }]
  };
  base.workingPlans['2026-11']=damaged;

  const {w,errors,go}=await boot('#/roster',{seed(win){ win.localStorage.setItem('labSystems.v1',JSON.stringify(base)); }});
  const S=w.LS.store, U=w.LSU, doc=w.document;
  const p=S.planForMonth('2026-11');
  ok(!!p,'the damaged month still opens');
  ok(p.staff.length===names.length,'it is put back to one row per person ('+p.staff.length+' rows)');
  ok(p.dates.length===10,'and one column per day ('+p.dates.length+')');
  const counts={}; p.staff.forEach(r=>counts[r.name]=(counts[r.name]||0)+1);
  ok(Object.keys(counts).every(n=>counts[n]===1),'no name appears twice on the plan');
  ok(p.staff.every(r=>r.codes.length===p.dates.length),'every row is one cell per day');
  ok(p.staff[0].name===names[0],'the row that stays is the one that was in force, in its own order');
  ok(new Set(p.dates).size===p.dates.length,'the repeated dates are gone too');
  ok(p.staff[0].codes.slice(0,10).join(',')==='N,D,D,D,D,D,D,N,D,D',
     'and its shifts are exactly the ones that row already had ('+p.staff[0].codes.slice(0,10).join(',')+')');
  const vers=(S.db().workingPlans['2026-11'].versions||[]);
  ok(vers.every(v=>new Set((v.staff||[]).map(r=>r.name)).size===(v.staff||[]).length),
     'the archived versions are de-duplicated the same way');

  /* the repair is idempotent: a second load changes nothing */
  const before=JSON.stringify(S.db().workingPlans['2026-11'].primary.staff.map(r=>r.name));
  w.eval('LS.store.commit(d=>{}, {action:"test.noop"});');
  const after=JSON.stringify(S.planForMonth('2026-11').staff.map(r=>r.name));
  ok(before===after,'a commit on the repaired month does not duplicate anything again');

  /* ── the screen ────────────────────────────────────────────────────── */
  await go('#/roster'); await tick(300);
  doc.querySelector('[data-view="grid"]').click(); await tick(350);
  [...doc.querySelectorAll('[data-nav]')].filter(b=>b.dataset.nav==='1')[0].click(); await tick(400);
  /* the calendar itself: the rest-owed table under it has rows of its own */
  const trs=[...doc.querySelectorAll('#roBody table.cal tbody tr')];
  ok(trs.length===names.length,'the grid draws one row per person ('+trs.length+')');
  const cells=trs.map(tr=>tr.querySelector('.staff-cell').textContent.replace(/\s+/g,' ').trim());
  ok(new Set(cells.map(t=>t.split(' ')[0]+t.split(' ').pop())).size===trs.length,'and no row repeats a name');
  const head=[...doc.querySelectorAll('#roBody table.cal thead th')].length-1;
  ok(head===10,'the columns are the ten days of the month, not twenty ('+head+')');
  const namesShown=cells.map(t=>t.replace(/Laboratory Manager|Laboratory Technician|Laboratory Technologist|Lab Technician|HIV Lab Quality Corp/g,'').replace(/Service requisition · acting|Service requisition/g,'').trim());
  ok(namesShown[0]==='Kelvin SAMAHANI','the manager is still the first row');

  /* ── the printed sheet reads the same rows ─────────────────────────── */
  const svg=w.LS.sheets.monthlySVG(S.planForMonth('2026-11'));
  const blocks=(svg.match(/STAFF/g)||[]).length;
  ok(blocks===1,'the sheet has one table, not one per copy');
  /* the body rows sit between the date band and the key; count the name blocks there */
  const bodyYs=[...svg.matchAll(/<text[^>]*x="120"[^>]*y="([\d.]+)"[^>]*>([^<]+)</g)]
    .filter(m=>+m[1]>600 && +m[1]<1100).map(m=>m[2].trim());
  /* a long name is drawn on two lines, so the block is counted by its given name */
  const given=names.map(n=>U.givenName?U.givenName(n):n.split(' ')[0]);
  const drawn=given.map(g=>bodyYs.filter(t=>t.indexOf(g)===0).length);
  ok(drawn.every(c=>c<=1),'each member of staff is drawn once on the sheet body ('+names.map((n,i)=>given[i]+' '+drawn[i]).join(', ')+')');

  /* ── the plan book is untouched by the repair ─────────────────────── */
  const leaveBefore=S.db().leaves.length;
  ok(leaveBefore>0,'the leave register is still there ('+leaveBefore+' blocks)');

  ok(errors.length===0,'no console errors during the run'+(errors.length?': '+errors.join(' | '):''));
  done('dupes56');
})().catch(e=>{ console.error(e); process.exit(1); });
