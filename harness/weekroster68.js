/* v6.9.68 — the weekly roster reads the working plan of every day in the week.
   The week of 26 October 2026 turns the month: Monday to Friday belong to the
   October plan, Saturday and Sunday to November's. The console used to read both
   plans through one month, so the weekend showed nobody, and the service grid
   carried seven benches into a Saturday and a Sunday that the department works as
   one duty. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||220));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,errors}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, doc=w.document, SH=w.LS.sheets;
  click(doc.querySelector('[data-rtab="week"],[data-view="week"]')); await tick(450);
  const START='2026-10-26';

  /* ── 1 · the week is the week the manager navigated to ─────────────── */
  ok(S.weekStart(START)===START,'the week of '+START+' is a Monday ('+S.weekStart(START)+')');
  const dates=S.weekDates(START);
  ok(dates.length===7&&dates[6]==='2026-11-01','it runs Monday 26 October to Sunday 1 November ('+dates[0]+' → '+dates[6]+')');

  /* ── 2 · the plan is read day by day, across the month boundary ────── */
  const octP=S.planForMonth('2026-10'), novP=S.planForMonth('2026-11');
  ok(!!octP&&!!novP,'both plans are on the register');
  const sun='2026-11-01', sat='2026-10-31';
  const novRow=novP.staff.map(r=>r.name+':'+(r.codes[novP.dates.indexOf(sun)]||'')).filter(x=>/:.+/.test(x));
  ok(novRow.length>0,'the November plan has codes on 1 November ('+novRow.join(' ')+')');
  const onSun=S.onDuty(sun);
  ok(onSun.length>0,'the console puts somebody on duty on Sunday 1 November ('+onSun.map(x=>x.staff.name.split(' ')[0]+':'+x.kind).join(' ')+')');
  ok(onSun.some(x=>x.kind==='day'||x.kind==='daynight'),'and somebody on the day, not only the night');
  ok(S.planCovers(sat)&&S.planCovers(sun),'the weekend is covered by a plan even though it belongs to another month');

  /* ── 3 · a newcomer is not invented into the weekend ───────────────── */
  /* Jeanne Claudine arrived on 6 October 2026. The plan leaves her off the weekend,
     so the roster must not show her name against a Saturday or a Sunday. */
  const jeanne='Jeanne Claudine UWAYISABA';
  ok((S.shiftState(jeanne,sat)||{}).kind!=='day','the plan keeps her at home on Saturday 31 October ('+S.shiftState(jeanne,sat).label+')');
  ok((S.shiftState(jeanne,sun)||{}).kind!=='day','and on Sunday 1 November ('+S.shiftState(jeanne,sun).label+')');
  const sundayNames=S.onDuty(sun).map(x=>x.staff.name);
  ok(sundayNames.indexOf(jeanne)<0,'so she is not on duty on the Sunday ('+sundayNames.map(n=>n.split(' ')[0]).join(', ')+')');

  /* ── 4 · the weekend is one duty, not seven benches ────────────────── */
  click(doc.querySelector('[data-auto-week]')); await tick(800);
  const alloc=(S.db().unitRosters[START]||{}).assignments||{};
  ok(Object.keys(alloc[sat]||{}).length===0,'Saturday 31 October carries no bench allocation');
  ok(Object.keys(alloc[sun]||{}).length===0,'nor does Sunday 1 November');
  const weekdays=dates.slice(0,5);
  weekdays.forEach(iso=>{
    const filled=S.services().filter(sv=>(alloc[iso]||{})[sv.name]).map(sv=>sv.name);
    ok(filled.length===S.services().length,U.DOWL[U.dow(iso)]+' '+U.parseISO(iso).getDate()+' fills every service ('+filled.length+'/'+S.services().length+')');
  });
  /* and every name written into a weekday cell is on duty that day */
  let outside=0;
  weekdays.forEach(iso=>Object.keys(alloc[iso]||{}).forEach(b=>{
    const n=alloc[iso][b]; const st=S.shiftState(n,iso);
    if(st.kind!=='day'&&st.kind!=='daynight') outside++;
  }));
  ok(outside===0,'nobody is rostered on a day the plan has them at home ('+outside+')');

  /* ── 5 · the grid prints it that way ──────────────────────────────── */
  const cal=doc.querySelector('table.cal');
  ok(!!cal,'the week grid is drawn');
  const foot=[...cal.querySelectorAll('tfoot tr')].map(r=>r.textContent.replace(/\s+/g,' '));
  ok(foot.some(t=>/Day duty/.test(t)),'the grid carries a day-duty row read from the plan');
  ok(foot.some(t=>/Night/.test(t)),'and the night row');
  const dayRow=[...cal.querySelectorAll('tfoot tr')].find(r=>/Day duty/.test(r.textContent));
  const cells=[...dayRow.children].slice(1).map(c=>c.textContent.replace(/\s+/g,' ').trim());
  ok(cells[5]&&cells[5]!=='—','Saturday names the duty ('+cells[5]+')');
  ok(cells[6]&&cells[6]!=='—','Sunday names the duty ('+cells[6]+')');
  ok(/Beatrice/.test(cells[6]),'and it is the name the plan puts there ('+cells[6]+')');
  ok(!/Jeanne/.test(cells[6]),'not the newcomer the manager saw');
  const heads=[...cal.querySelectorAll('thead th')].slice(1).map(c=>c.textContent.replace(/\s+/g,' ').trim());
  ok(/unit duty/i.test(heads[5])&&/unit duty/i.test(heads[6]),'the weekend columns say they are one unit duty ('+heads.slice(5).join(' / ')+')');
  /* the empty-slot count does not count the weekend benches as empty */
  const pills=[...doc.querySelectorAll('.pill')].map(e=>e.textContent.trim());
  ok(pills.some(t=>/^0 empty slots$/.test(t)),'the weekend is not counted as empty slots ('+pills.filter(t=>/slot/.test(t)).join(' · ')+')');

  /* ── 6 · clicking a weekend cell names the day instead of filling it ── */
  const satCell=[...cal.querySelectorAll('tbody tr')][0].children[6];
  click(satCell); await tick(350);
  const modal=doc.querySelector('.modal');
  ok(!modal,'a weekend bench does not open the allocator');
  const allocAfter=(S.db().unitRosters[START]||{}).assignments||{};
  ok(Object.keys(allocAfter[sat]||{}).length===0,'and leaves the Saturday empty');
  /* a weekday cell still opens it */
  const monCell=[...cal.querySelectorAll('tbody tr')][0].children[1];
  click(monCell); await tick(350);
  ok(!!doc.querySelector('.modal'),'a weekday bench still opens the allocator');
  const opts=[...(doc.querySelectorAll('.modal select option')||[])].map(o=>o.textContent);
  ok(opts.some(t=>/at home/i.test(t)),'and the people the plan has at home are named as such ('+(opts.find(t=>/at home/i.test(t))||'—')+')');
  const close=doc.querySelector('.modal [data-close]'); if(close) click(close); await tick(250);

  /* ── 7 · the printed week carries the same facts ──────────────────── */
  const svg=SH.weeklySVG({weekStart:START,dates,services:S.services(),alloc,night:{},
    dayDuty:{'2026-11-01':[ 'Beatrice NGEZEKURE' ]},weekend:{'2026-10-31':'Saturday','2026-11-01':'Sunday'},
    planLabel:'October 2026 + November 2026'});
  ok(/Day duty/.test(svg),'the printed week has the day-duty row');
  ok(/SATURDAY/.test(svg)&&/SUNDAY/.test(svg),'the weekend columns are labelled');
  ok(/Beatrice NGEZEKURE/.test(svg),'Sunday names the duty');
  ok(/plan: October 2026 \+ November 2026/.test(svg),'and the foot says which plans were read');

  ok(errors.length===0,'no console errors during the run');
  done('weekroster68');
})();
