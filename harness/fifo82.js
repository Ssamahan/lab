/* v6.9.82 — request #55: the training queue is read from the history, honestly.
   Aurelie and Beatrice attended the weekly skills training in Musanze on
   20–24/07/2026, so the next turns belong to Bernadette and Jeanne Claudine;
   Bernadette joined on 14 September 2026, not 2024. Somebody who is already
   booked for a session stands at the foot of the list until that session is over
   — which is why the manager, booked for Monday, is last. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const srcTr=fs.readFileSync(path.join(root,'assets/js/modules/training.js'),'utf8');
const srcSt=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');

(async()=>{
  const {w,go,errors}=await boot('#/training');
  const d=w.document, S=w.LS.store, U=w.LSU, db=()=>S.db();
  const tick=n=>new Promise(r=>setTimeout(r,n||200));
  const queue=()=>[...d.querySelectorAll('#app .card .list-row')]
    .filter(r=>r.querySelector('.lr-sub')&&r.querySelector('.mono.xs'))
    .map(r=>({name:r.querySelector('.lr-title').textContent.replace(/\s+/g,' ').replace(/next|post|booked.*$/gi,'').trim(),
      days:r.querySelector('.mono.xs').textContent.trim(),
      post:[...r.querySelectorAll('.pill')].some(p=>p.textContent.trim()==='post'),
      booked:[...r.querySelectorAll('.pill')].some(p=>/^booked /.test(p.textContent.trim())),
      next:/next/.test(r.querySelector('.lr-title').textContent)}));
  ok(!errors.length,'the console boots without console errors',errors.join(' | '));

  /* ── 1 · the two facts that were wrong ───────────────────────────────── */
  const bern=S.staffById('s10'), jeanne=S.staffById('s11');
  ok(bern.joinDate==='2026-09-14','Bernadette joined on 14 September 2026',bern.joinDate);
  ok(jeanne.joinDate==='2026-10-06','and Jeanne Claudine on 6 October 2026',jeanne.joinDate);
  const july=db().trainings.filter(t=>/Aurelie/.test((t.attendees||[]).map(a=>(S.staffById(a)||{}).name).join()+' '+t.title)
    && /2026-07/.test(String(t.start)) && String(t.start)>='2026-07-01' && String(t.start)<='2026-07-31');
  ok(july.length===1,'the July session is on file once, not twice ('+july.length+')',july.map(t=>t.id+' '+t.start).join(', '));
  ok(/musanze/i.test(july[0].location||''),'and was held in Musanze, not at Ruli DH',july[0].location);
  ok(july[0].attendees.slice().sort().join(',')==='s3,s4','with Aurelie and Beatrice as its attendees');

  /* the guard: the migration only rewrites the exact old values */
  ok(/trainingTruth81/.test(srcSt)&&/joinDate==='2024-02-12'/.test(srcSt),
     'the correction is guarded — a register that already holds the truth is not touched');
  ok(/trry96hq/.test(srcSt),'and the leave-planner fragment of the same session is folded in once');

  /* ── 2 · what that does to their waiting time ────────────────────────── */
  const a=(id)=>db().trainings.filter(t=>(t.attendees||[]).includes(id));
  const lastCounted=id=>a(id).filter(t=>!/ruli/i.test(t.location||'')&&U.daysBetween(t.start,t.end||t.start)+1>=3)
    .sort((x,y)=>String(y.end||y.start).localeCompare(String(x.end||x.start)))[0];
  ok(String(lastCounted('s4').end)==='2026-07-24','Aurelie\u2019s last counting training is the July session');
  ok(String(lastCounted('s3').end)==='2026-07-24','and so is Beatrice\u2019s');
  const today=U.todayISO();
  const expect=U.daysBetween('2026-07-24',today);
  ok(expect===99,'99 days have passed since it ('+expect+')');

  /* ── 3 · the queue as it now reads ───────────────────────────────────── */
  await go('#/training'); await tick(320);
  let q=queue();
  const order=q.map(x=>x.name);
  const byName=n=>q.find(x=>new RegExp(n).test(x.name));
  ok(order.length===8,'all eight active staff stand in one queue ('+order.length+')');
  ok(q.filter(x=>x.post).length===3,'the three post holders are marked, not held out above it');
  ok(!d.querySelector('.role-posts'),'nothing is parked above the queue any more');
  ok(/Aurelie/.test(order[4])&&/Beatrice/.test(order[5]),
     'Aurelie and Beatrice sit together, behind those who have waited longer ('+order.slice(3,6).join(', ')+')');
  ok(byName('Aurelie').days===expect+'d'&&byName('Beatrice').days===expect+'d',
     'both count their wait from 24 July 2026 ('+byName('Aurelie').days+')');
  ok(/Bernadette/.test(order[6])&&/Jeanne Claudine/.test(order[7]),
     'and are followed by Bernadette and then Jeanne Claudine ('+order.slice(6).join(', ')+')');
  ok(order.findIndex(x=>/Bernadette/.test(x))<order.findIndex(x=>/Jeanne/.test(x)),
     'the two who have never been trained are in the order they joined');
  ok(byName('Bernadette').days===U.daysBetween('2026-09-14',today)+'d','Bernadette waits from her joining date',byName('Bernadette').days);
  ok(q[0].next,'the top of the queue carries the “next” marker');
  ok(q.slice(1).every(x=>!x.next),'and only the top of it');
  const waits=q.filter(x=>x.days!=='—').map(x=>parseInt(x.days,10));
  ok(waits.every((v,i)=>i===0||waits[i-1]>=v),'the queue descends by days served waiting ('+waits.join(', ')+')');

  /* ── 4 · two people from one session: the shorter earlier wait goes first ─ */
  ok(order.findIndex(x=>/Aurelie/.test(x))<order.findIndex(x=>/Beatrice/.test(x)),
     'Aurelie goes before Beatrice — she had waited fewer days to reach the July session');
  ok(/previousGap|fewer days/.test(srcTr),'the rule is written down where it is applied');
  const gap=(id)=>{ const last=lastCounted(id);
    const prev=a(id).filter(t=>!/ruli/i.test(t.location||'')&&U.daysBetween(t.start,t.end||t.start)+1>=3 && String(t.start)<String(last.start))
      .sort((x,y)=>String(y.start).localeCompare(String(x.start)))[0];
    return U.daysBetween(prev?(prev.end||prev.start):(S.staffById(id).joinDate),last.start); };
  ok(gap('s4')<gap('s3'),'her earlier wait was the shorter of the two ('+gap('s4')+' vs '+gap('s3')+' days)');

  /* ── 5 · a booked session puts that person last ──────────────────────── */
  const mon=U.addDays(U.todayISO(),2);
  w.eval(`LS.store.commit(x=>{ x.trainings.unshift({id:'trMonday',title:'Training booked for Monday',organizer:'RBC',location:'Kigali',
    start:'${mon}',end:'${U.addDays(U.todayISO(),6)}',attendees:['s1'],status:'scheduled'}); },{action:'test.book'});`);
  await go('#/training'); await tick(320);
  q=queue();
  ok(q[q.length-1].name==='Kelvin SAMAHANI','the manager, booked for a session, is last on the list',q[q.length-1].name);
  ok(q[q.length-1].booked,'his row says the session is booked');
  ok(q.filter(x=>x.booked).length===1,'nobody else is marked booked');
  ok(/booked/.test(srcTr)&&/U\.todayISO\(\)/.test(srcTr),'a booked session is one still ahead of today');

  /* ── 6 · what does not count is still said plainly ───────────────────── */
  w.eval("LS.store.commit(x=>{ x.trainings.unshift({id:'trInHouse',title:'In-house bench briefing',organizer:'Ruli DH',location:'Ruli DH',start:'"+U.addDays(U.todayISO(),-3)+"',end:'"+U.addDays(U.todayISO(),-3)+"',attendees:['s10'],status:'completed'}); },{action:'test.inhouse'});");
  await go('#/training'); await tick(320);
  const b2=queue().find(x=>/Bernadette/.test(x.name));
  ok(b2&&b2.days===U.daysBetween('2026-09-14',today)+'d','an in-house briefing does not move Bernadette\u2019s place',b2&&b2.days);
  ok(/does not count/.test(d.querySelector('#app').textContent),'and the row says why it did not count');

  ok(!errors.length,'still no console errors',errors.join(' | '));
  done('fifo82');
})().catch(e=>{ console.log('  ✗ harness threw: '+e.message+'\n'+e.stack); process.exit(1); });
