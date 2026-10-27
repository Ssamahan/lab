/* v6.9.41 — the November 2026 plan, built from the department's rules and the
   record of the previous months; the sheet names the post under every name, carries
   the codes the paper plans have always used, and says out loud when it is a draft. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/roster');
  const doc=w.document, S=()=>w.LS.store, db=()=>w.LS.store.db();
  const SH=w.LS.sheets, U=w.LSU;

  /* ── the November plan exists, and is a draft ──────────────────────── */
  const entry=db().workingPlans['2026-11'];
  ok(!!(entry&&entry.primary),'November 2026 has a working plan');
  const p=entry.primary;
  ok(p.dates.length===30,'with all thirty days');
  ok(p.dates[0]==='2026-11-01'&&p.dates[29]==='2026-11-30','from the 1st to the 30th');
  ok(!!p.meta.draft&&!p.meta.official,'marked as a draft, not an official plan');
  ok(/review before publishing/i.test(p.meta.label||''),'and the label says so in words');
  ok(p.staff.length===6,'six staff rows',p.staff.length);
  ok(p.staff.every(r=>(r.codes||[]).length===30),'every row has a code for every day');

  /* ── the manager's carried-over leave is where the register puts it ── */
  const kelvin=p.staff.find(r=>/Kelvin/.test(r.name));
  ok(kelvin.codes[0]==='OFF','the manager is off on 1 November');
  ok(kelvin.codes.slice(1).every(c=>c==='AL'),'and on annual leave from 2 November to the end of the month');

  /* ── the nights follow the rule, not a rotation ────────────────────── */
  const runs=(row)=>{ let best=0,run=0; (row.codes||[]).forEach(c=>{ if(c==='N'||c==='DN'){ run++; best=Math.max(best,run); } else run=0; }); return best; };
  const nights=(row)=>(row.codes||[]).filter(c=>c==='N'||c==='DN').length;
  const three=p.staff.filter(r=>runs(r)>=3).map(r=>r.name);
  ok(three.length>0,'there are three-night blocks in the month');
  ok(three.every(n=>/Patrick ISHIMWE|Jean Paul NSENGIYUMVA/.test(n)),'and only the two who may hold one have them ('+three.join(', ')+')');
  ok(p.staff.every(r=>runs(r)<=3),'nobody runs a fourth night');
  const pat=p.staff.find(r=>/Patrick/.test(r.name)), jp=p.staff.find(r=>/Jean Paul/.test(r.name));
  ok(nights(pat)>nights(jp),'Patrick carries more nights than Jean Paul ('+nights(pat)+' vs '+nights(jp)+')');
  const others=p.staff.filter(r=>!/Patrick|Jean Paul/.test(r.name));
  ok(others.every(r=>runs(r)<=2),'everyone else works two at a time at most');

  /* ── the weekend stays with the weekend technologist ───────────────── */
  const aur=p.staff.find(r=>/Aurelie/.test(r.name));
  const weekendIdx=p.dates.map((iso,i)=>({iso,i,dow:U.dow(iso)})).filter(x=>x.dow>=5);
  const aurWeekend=weekendIdx.filter(x=>aur.codes[x.i]==='DN'||aur.codes[x.i]==='N');
  ok(aurWeekend.length>=6,'the weekend technologist covers the weekends ('+aurWeekend.length+' of '+weekendIdx.length+' nights)');
  ok(!p.staff.some(r=>/Kelvin|Beatrice/.test(r.name)&&(r.codes||[]).some(c=>c==='N'||c==='DN')),
     'the manager and Reception take no nights');

  /* ── the sheet reads like the department's own record ──────────────── */
  const svg=SH.monthlySVG(p);
  ok(/Laboratory Manager/.test(svg),'the post is printed under the manager’s name');
  ok(/Laboratory Technologist/.test(svg)||/Lab Technician/.test(svg),'and under the technologists’ names');
  ok(/DRAFT/.test(svg),'a draft sheet says DRAFT on its face');
  ok(/RBW/.test(svg)&&/AA/.test(svg),'the key carries the codes the paper plans use (RBW, AA)');
  ok(/Off duty \(rest before work\)/.test(svg),'with RBW spelled out');
  ok(/Working Plan — November 2026/.test(svg),'titled like every previous month');
  ok(/Prepared by/.test(svg)&&/Verified by/.test(svg)&&/Approved by/.test(svg),
     'and it keeps the three signature blocks the record has');

  /* ── the new codes are real choices, not decoration ────────────────── */
  ok(SH.codes.indexOf('RBW')>=0&&SH.codes.indexOf('AA')>=0,'the sheet knows both codes');
  const au=db().staff.find(s=>/Aurelie/.test(s.name));
  ok(S().shiftState(au,'2026-11-03').kind!=='night','a weekday off is still off');
  /* a plan cell holding RBW reads as rest before work */
  w.eval(`LS.store.commit(d=>{ const pl=d.workingPlans['2026-11'].primary; const row=pl.staff.find(r=>/Beatrice/.test(r.name)); row.codes[10]='RBW'; row.codes[11]='AA'; },{action:'test.codes'});`);
  const bea=S().staffByName('Beatrice NGEZEKURE');
  ok(S().shiftState(bea,'2026-11-11').label==='Rest before work','RBW reads as rest before work');
  ok(S().shiftState(bea,'2026-11-12').label==='Authorised absence','AA reads as authorised absence');

  /* ── the month is reachable on the roster screen ───────────────────── */
  await go('#/roster'); await tick(300);
  const next=[...doc.querySelectorAll('[data-nav]')].find(b=>b.dataset.nav==='1');
  click(next); await tick(400);
  const head=doc.querySelector('#roHead')?doc.querySelector('#roHead').textContent:doc.body.textContent;
  ok(/November 2026/.test(head),'one press of Next shows November',head.slice(0,90).replace(/\s+/g,' '));
  ok(/Draft/i.test(head),'and the header says the plan is a draft');

  done('plan41');
})().catch(e=>{ console.error(e); process.exit(1); });
