/* v6.9.67 — four things the department asked for:
     1 · the key says UO and nothing else, so the letter fits its block;
     2 · the sheet is A4 landscape, and a sheet that tall sets its rows, its day
         letters and its names bigger than it used to;
     3 · every number prints the way the department writes one: 07XX-XXX-XXX;
     4 · the rota is fair: December goes easiest on Bernadette, the public holidays
         turn around the bench from the record of the ones already worked, a holiday
         falling Monday to Wednesday never goes to somebody with under six months'
         service, and a newcomer's holiday at the weekend is only written when
         nobody else is covering day and night. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,errors}=await boot('#/roster');
  const S=w.LS.store, U=w.LSU, SH=w.LS.sheets, doc=w.document;

  /* ── 1 · the key is a letter, not a paragraph ──────────────────────── */
  const nov=S.planForMonth('2026-11');
  const svg=SH.monthlySVG(nov);
  const nodes=[...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*font-size="([\d.]+)"[^>]*>([^<]*)</g)]
    .map(m=>({x:+m[1],y:+m[2],size:+m[3],t:m[4]}));
  const at=re=>nodes.filter(n=>re.test(n.t));
  ok(/^UO/.test(SH.styleOf('UO').key),'the key still begins with the letters UO');
  ok(!/[()]/.test(SH.styleOf('UO').key),'and carries no bracketed explanation ('+SH.styleOf('UO').key+')');
  ok(!/worked a day due as rest/i.test(SH.styleOf('UO').key),'the paragraph about the day it earns is gone from the key');
  const uoKey=nodes.filter(n=>/^UO/.test(n.t)&&n.y>1500)[0];
  ok(!!uoKey,'the key prints UO');
  if(uoKey) ok(uoKey.t.length<=26,'and the words beside it are short enough for the block ("'+uoKey.t+'")');
  /* the legend on the console says the same, once */
  const legend=[...doc.querySelectorAll('.key-item, .legend-item, .lg-item')].map(e=>e.textContent.trim());
  if(legend.length) ok(legend.some(t=>/^UO\b/.test(t)&&!/\(/.test(t)),'the on-screen legend reads UO too');

  /* ── 2 · A4 landscape ──────────────────────────────────────────────── */
  const vb=svg.match(/width="(\d+)" height="(\d+)"/);
  const W=+vb[1], H=+vb[2];
  ok(Math.abs(H/W-210/297)<0.005,'the sheet is A4 landscape ('+W+' × '+H+', ratio '+(H/W).toFixed(4)+')');
  ok(H>=2200,'and it is tall — the height the page actually has ('+H+' px)');
  const below=nodes.filter(n=>n.y>H-8);
  ok(below.length===0,'nothing is drawn off the foot of the page'+(below.length?' ('+below.map(n=>n.t).join(' / ')+')':''));
  /* the rows are taller than the old 90 px cap, and the letters grew with them */
  const dayOne=at(/^2$/).filter(n=>n.y<560)[0];
  ok(!!dayOne,'the day numbers are drawn');
  if(dayOne) ok(dayOne.size>=28,'the day numbers set bigger than they used to ('+dayOne.size+' px, was 26)');
  const names=S.activeStaff().map(st=>at(new RegExp('^'+st.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')).filter(n=>n.y>540)[0]).filter(Boolean);
  ok(names.every(n=>n.size>=22),'no name is set below 22 px ('+[...new Set(names.map(n=>n.size.toFixed(1)))].join(', ')+')');
  ok(names.some(n=>n.size>=30),'and a name with room to spare is set large ('+Math.max.apply(null,names.map(n=>n.size).concat([0])).toFixed(1)+' px)');
  ok(names.length>=6,'a row for each member of the bench ('+names.length+')');
  /* the rows really are taller: a name and the post under it do not collide */
  const kelvin=at(/^Kelvin SAMAHANI$/)[0];
  const post=at(/^Laboratory Manager$/)[0];
  ok(kelvin&&post&&post.y-kelvin.y>kelvin.size,'the post still clears the name above it ('+(post&&kelvin?(post.y-kelvin.y).toFixed(1):'—')+' px)');

  /* ── 3 · numbers the way the department writes them ────────────────── */
  const cases=[['0787055121','0787-055-121'],['+250788767548','0788-767-548'],
    ['788767548','0788-767-548'],['0784 063 985','0784-063-985'],['0784063985','0784-063-985']];
  cases.forEach(([inp,out])=>ok(U.fmtPhone(inp)===out,'the number '+inp+' prints '+U.fmtPhone(inp)+' (wanted '+out+')'));
  ok(U.fmtPhone('')==='','an empty field stays empty');
  ok(U.fmtPhone('—')==='—','a dash stays a dash');
  ok(S.db().staff.filter(s=>/^\d{10}$/.test(s.phone||'')).length>0,'the register keeps the digits it stores');
  svgCheck();
  function svgCheck(){
    const oct=SH.monthlySVG(S.planForMonth('2026-10'));
    S.activeStaff().filter(s=>s.phone).forEach(st=>{
      ok(oct.indexOf(U.fmtPhone(st.phone))>=0,st.name.split(' ')[0]+'’s number prints with its dashes');
      ok(oct.indexOf('>'+st.phone+'<')<0,'and never as a bare run of digits');
    });
    const wk=SH.weeklySVG({weekStart:'2026-11-02'});
    const withPhone=S.activeStaff().filter(s=>s.phone)[0];
    if(withPhone) ok(wk.indexOf(U.fmtPhone(withPhone.phone))>=0,'the weekly roster prints them the same way');
  }
  /* the screen: her card carries the dashed form */
  w.location.hash='#/staff'; await tick(300);
  const cards=[...doc.querySelectorAll('*')].map(e=>e.textContent||'');
  const rawLeak=S.activeStaff().filter(s=>s.phone).some(st=>cards.some(t=>t.indexOf('>'+st.phone+'<')>=0));
  ok(!rawLeak,'no screen prints a bare run of digits where a number belongs');
  /* her record says, on the card, which month she is being kept off the nights for */
  const bernId=S.staffByName('Bernadette MUHAWENIMANA').id;
  const card=doc.querySelector('[data-person="'+bernId+'"]');
  ok(!!card,'her card is on the staff page');
  if(card){
    card.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await tick(500);
    ok(/off the December 2026 night rota/.test(doc.body.textContent),'the card says she is off December’s night rota');
  }
  w.location.hash='#/roster'; await tick(300);

  /* ── 4 · fairness: December goes easiest on Bernadette ─────────────── */
  const nightsOf=name=>{ const r=nov.staff.find(x=>x.name===name); return r?(r.codes||[]).filter(c=>c==='N'||c==='DN').length:0; };
  /* the November plan writes the first week of December; that week must not land
     on her either, or the December sheet would inherit it */
  const bern='Bernadette MUHAWENIMANA';
  const decInNov=nov.dates.map((iso,i)=>({iso,i})).filter(d=>d.iso.slice(0,7)==='2026-12');
  ok(decInNov.length>0,'the November plan runs into December ('+decInNov.length+' days)');
  const novRow=nov.staff.find(r=>r.name===bern);
  ok(decInNov.every(d=>!(novRow.codes[d.i]==='N'||novRow.codes[d.i]==='DN')),
     'and gives Bernadette no night there');

  const dec=S.buildPlan('2026-12');
  const decNights=name=>{ const r=dec.staff.find(x=>x.name===name); return r?(r.codes||[]).filter(c=>c==='N'||c==='DN').length:0; };
  ok(decNights(bern)===0,'December gives Bernadette no nights at all ('+decNights(bern)+')');
  ['Dieudonne NIYIDUHABYOSE','Patrick ISHIMWE','Jeanne Claudine UWAYISABA'].forEach(n=>{
    ok(decNights(n)>0,n.split(' ')[0]+' carries the December nights instead ('+decNights(n)+')');
  });
  ok(decNights(bern)<=Math.min(...dec.staff.filter(r=>!/Aurelie|Kelvin|Beatrice|Jean Paul/.test(r.name)).map(r=>decNights(r.name))),
     'she carries the fewest nights of anybody on the weekday bench');
  /* it is a field on her record, not a rule hidden in the generator */
  const bRec=S.staffByName(bern);
  ok(Array.isArray(bRec.lightMonths)&&bRec.lightMonths.indexOf('2026-12')>=0,'her record names the month she is being kept off ('+JSON.stringify(bRec.lightMonths)+')');
  ok(!!bRec.lightReason,'and says why, in words');
  /* the rules still hold around her: no lone night, no block past three */
  ['Dieudonne NIYIDUHABYOSE','Patrick ISHIMWE','Jeanne Claudine UWAYISABA'].forEach(n=>{
    const r=dec.staff.find(x=>x.name===n); let run=0, runs=[];
    r.codes.forEach((c,i)=>{ if(c==='N'){ run++; } else { if(run) runs.push({len:run,at:i-run}); run=0; } });
    if(run) runs.push({len:run,at:r.codes.length-run});
    const last=dec.dates[dec.dates.length-1];
    ok(runs.every(b=>b.len<=3),n.split(' ')[0]+' never works more than three in a row');
    const hol=iso=>['2026-12-25','2026-12-26','2027-01-01','2027-01-02'].indexOf(iso)>=0;
    ok(runs.every(b=>b.len>=2||dec.dates[b.at]===last||hol(dec.dates[b.at])),
       n.split(' ')[0]+'’s blocks are blocks ('+runs.filter(b=>b.len<2&&dec.dates[b.at]!==last&&!hol(dec.dates[b.at])).map(b=>dec.dates[b.at]).join(', ')+')');
  });

  /* ── 4b · a holiday early in the week is never a newcomer's ────────── */
  /* Jeanne Claudine arrived in October 2026: under six months in December */
  const junior=S.activeStaff().filter(s=>{
    const join=s.joinDate||'';
    return join>='2026-07-01' && join<='2026-12-31';
  }).map(s=>s.name);
  ok(junior.length>0,'the bench has somebody under six months in December ('+junior.map(n=>n.split(' ')[0]).join(', ')+')');
  /* write a Tuesday holiday into December and rebuild */
  w.eval("LS.store.commit(d=>{ d.holidays=d.holidays||[]; d.holidays.push({id:'t-tue',date:'2026-12-08',name:'Test Tuesday holiday',official:true}); d.holidays.push({id:'t-thu',date:'2026-12-10',name:'Test Thursday holiday',official:true}); },{action:'test.holiday'});");
  const dec2=S.buildPlan('2026-12');
  const onHoliday=(plan,iso)=>plan.staff.filter(r=>{
    const c=r.codes[plan.dates.indexOf(iso)];
    return c==='D'||c==='N'||c==='DN';
  }).map(r=>r.name);
  /* the day duty is the one the holiday rota decides: the night of a weekday
     holiday is already a night of the ordinary rotation */
  const holidayDay=(plan,iso)=>plan.staff.filter(r=>{
    const c=r.codes[plan.dates.indexOf(iso)];
    return c==='D'||c==='DN';
  }).map(r=>r.name);
  const tue=onHoliday(dec2,'2026-12-08');
  ok(tue.length>0,'the Tuesday holiday is covered ('+tue.map(n=>n.split(' ')[0]).join(', ')+')');
  ok(tue.every(n=>junior.indexOf(n)<0),'and nobody on it has under six months’ service');
  const thu=onHoliday(dec2,'2026-12-10');
  ok(thu.length>0,'the Thursday holiday is covered too');
  /* the record is what the rotation turns on: a holiday already worked sends the
     next one to somebody else */
  ok(typeof S.db().meta==='object','the register is readable for the check below');

  /* ── 4c · the holidays turn around the bench ───────────────────────── */
  w.eval("LS.store.commit(d=>{ d.holidays=d.holidays.filter(h=>['t-tue','t-thu'].indexOf(h.id)<0); d.holidays.push({id:'t-nov',date:'2026-11-17',name:'Test November holiday',official:true}); },{action:'test.holiday'});");
  const novHol=S.buildPlan('2026-11');
  const novHolder=holidayDay(novHol,'2026-11-17')[0];
  ok(!!novHolder,'the November holiday is worked by somebody ('+novHolder+')');
  /* store it as the month's plan, the way the console does when a draft is kept */
  w.eval("LS.store.commit(d=>{ d.workingPlans['2026-11']={primary:LS.store.buildPlan('2026-11'),versions:[]}; },{action:'test.plan'});");
  w.eval("LS.store.commit(d=>{ d.holidays.push({id:'t-dec',date:'2026-12-15',name:'Test December holiday',official:true}); },{action:'test.holiday'});");
  const dec3=S.buildPlan('2026-12');
  const decHolder=holidayDay(dec3,'2026-12-15');
  ok(decHolder.length>0,'the December holiday is covered ('+decHolder.map(n=>n.split(' ')[0]).join(', ')+')');
  ok(decHolder.indexOf(novHolder)<0,'and not by the name who worked the one before it ('+novHolder+' → '+decHolder.join(', ')+')');
  ok(!decHolder.some(n=>/Kelvin/.test(n)),'the manager is never put on a holiday unless he chooses');
  ok(!decHolder.some(n=>junior.indexOf(n)>=0&&U.dow('2026-12-15')<=2),
     'a Tuesday holiday is still not a junior’s');

  /* ── 4d · a newcomer at the weekend only when nobody covers day and night ── */
  ok(U.dow('2026-12-26')===5,'Boxing Day 2026 falls on a Saturday (the calendar counts Monday as day zero)');
  const weekendHol=S.buildPlan('2026-12');
  const sat=weekendHol.staff.filter(r=>{ const c=r.codes[weekendHol.dates.indexOf('2026-12-26')]; return c==='DN'||c==='D'||c==='N'; });
  const newcomerOnSat=sat.filter(r=>junior.indexOf(r.name)>=0);
  if(newcomerOnSat.length){
    const others=sat.filter(r=>junior.indexOf(r.name)<0);
    ok(others.length===0,'a newcomer only takes the weekend holiday when nobody else is on day and night that weekend');
  } else {
    ok(true,'the weekend holiday is not a newcomer’s ('+sat.map(r=>r.name.split(' ')[0]).join(', ')+')');
  }

  ok(errors.length===0,'no console errors during the run');
  done('fairness67');
})();
