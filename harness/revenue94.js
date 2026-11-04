/* v6.9.93 — a revenue session is chosen from the training roster.
   The ledger used to be typed by hand, which is how a revenue row and its training drifted
   apart, and how the same session ended up recorded twice. A session is now picked from
   the registry, the form fills itself from it, and `linkedTraining` joins the two. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  const {w,go,errors}=await boot('#/dash');
  const S=w.LS.store, U=w.LSU, doc=w.document;
  ok(!errors.length,'the console boots clean',errors.join(' | '));
  await go('#/revenue'); await tick(300);

  const trainings=()=>S.db().trainings||[];
  const ledger=()=>S.db().trainingExpenses||[];
  const rows=()=>doc.querySelectorAll('#revTable tbody tr[data-rev]').length;
  const sumExpTest=t=>(t.expenses||[]).reduce((a,x)=>a+(x.amount||0),0);
  const sumReimbTest=t=>(t.reimbursements||[]).reduce((a,x)=>a+(x.amount||0),0);

  /* ── 1 · the page, and what it counts ───────────────────────────────── */
  ok(rows()===ledger().length,'every ledger session is listed ('+rows()+')');
  const recon=(doc.body.textContent.match(/(\d+) of (\d+) trainings in the roster/g)||[])[0];
  ok(!!recon,'the reconciliation names how much of the roster is accounted for',recon);
  const covered=+recon.split(' ')[0], total=+recon.split(' ')[2];
  ok(total===trainings().length,'against every training in the registry ('+total+')');
  ok(covered<=total,'and never claims more than the roster holds');

  /* ── 2 · logging a session: choose from the roster ──────────────────── */
  click(doc.querySelector('[data-add]')); await tick(300);
  const pick=doc.querySelector('#rsPick');
  ok(!!pick,'the log-session form opens with a roster to choose from');
  const opts=[...pick.querySelectorAll('option')].map(o=>({v:o.value,t:o.textContent,
    group:o.parentElement.tagName,label:o.parentElement.tagName==='OPTGROUP'?(o.parentElement.label||''):''}));
  ok(opts.length>trainings().length,'every training in the registry is offered ('+(opts.length-2)+' of '+trainings().length+')');
  ok(opts.some(o=>o.v==='__new'),'with a way to type a session that is not in the roster');
  ok(opts.some(o=>o.group==='OPTGROUP'&&/Not yet on the ledger/.test(o.label)),'the unlogged ones are grouped first');
  const usedIds=ledger().filter(t=>t.linkedTraining).map(t=>t.linkedTraining);
  ok(opts.filter(o=>/Already carrying/.test(o.label)).length===usedIds.length,
     'and the ones already carrying a revenue line are named as such ('+usedIds.length+')');

  /* choosing one fills the form from the registry */
  const target=trainings().find(t=>usedIds.indexOf(t.id)<0)||trainings()[0];
  ok(!!target,'there is a training to choose');
  pick.value=target.id; pick.dispatchEvent(new w.Event('change',{bubbles:true}));
  await tick(120);
  ok(doc.querySelector('#rsTitle').value===target.title,'choosing it fills the title from the registry',doc.querySelector('#rsTitle').value);
  ok(doc.querySelector('#rsOrg').value===(target.organizer||''),'the organizer too');
  ok(doc.querySelector('#rsLoc').value===(target.location||''),'and the place');
  ok(doc.querySelector('#rsStart').value===target.start,'and the start date');
  ok(doc.querySelector('#rsEnd').value===(target.end||target.start),'and the end date');
  ok(/−|-/.test(doc.querySelector('#rsEnd').value)||/\d/.test(doc.querySelector('#rsEnd').value),'as a date the form can hold');

  /* one expense line and one reimbursement line, as the form now takes */
  const eRow=doc.querySelector('[data-exp-row]');
  eRow.querySelector('[data-e-amount]').value='120000';
  eRow.querySelector('[data-e-amount]').dispatchEvent(new w.Event('input',{bubbles:true}));
  eRow.querySelector('[data-e-desc]').value='Transport';
  const rRow=doc.querySelector('[data-rei-row]');
  rRow.querySelector('[data-r-amount]').value='150000';
  rRow.querySelector('[data-r-amount]').dispatchEvent(new w.Event('input',{bubbles:true}));
  const before=ledger().length;
  click(doc.querySelector('[data-save]')); await tick(500);
  ok(ledger().length===before+1,'the session is logged');
  const rec=ledger()[0];
  ok(rec.linkedTraining===target.id,'and carries the link to the roster training',rec.linkedTraining);
  ok(rec.title===target.title,'its title is the registry title, not a second spelling of it');
  ok(rec.attendees&&rec.attendees.length===(target.attendees||[]).length,'with the attendees the roster records',String((rec.attendees||[]).length));

  /* ── 3 · the ledger now shows the link ──────────────────────────────── */
  await go('#/revenue'); await tick(300);
  const row=doc.querySelector('#revTable tr[data-rev="'+rec.id+'"]');
  ok(!!row,'the new session is on the ledger');
  ok(/roster/.test(row.textContent),'marked as coming from the roster');
  ok(row.textContent.indexOf('150,000')>=0||row.textContent.indexOf('150000')>=0,'with its reimbursement',row.textContent.replace(/\s+/g,' ').slice(0,90));

  /* the reconciliation moved with it */
  const recon2=(doc.body.textContent.match(/(\d+) of (\d+) trainings in the roster/g)||[])[0];
  const covered2=+recon2.split(' ')[0];
  ok(covered2===Math.min(total,covered+1),'and the reconciled count goes up by one ('+covered+' → '+covered2+')');

  /* ── 4 · the drawer: see the roster session, and correct the link ───── */
  click(doc.querySelector('#revTable tr[data-rev="'+rec.id+'"] td')); await tick(400);
  const drawerText=doc.body.textContent;
  ok(/Training in the roster/.test(drawerText),'the ledger row names the roster training behind it');
  ok(/on the training roster/.test(drawerText),'and says so in a chip');
  ok(drawerText.indexOf(target.title)>=0,'naming the training itself');
  const linkSel=doc.querySelector('[data-link-select]');
  ok(!!linkSel,'with a way to correct the link');
  ok(linkSel.value===target.id,'starting on the training already linked');

  const other=trainings().find(t=>t.id!==target.id&&(t.attendees||[]).length);
  linkSel.value=other.id; linkSel.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(350);
  ok((S.db().trainingExpenses||[]).find(t=>t.id===rec.id).linkedTraining===other.id,'changing it relinks the session',other.title);
  const audit=(S.db().audit||[]).find(a=>a.action==='revenue.link');
  ok(!!audit,'and the change is written to the audit trail',audit&&audit.detail);
  ok(/Linked to the training roster/.test(audit.detail),'saying what it was linked to',audit.detail);

  linkSel.value=''; linkSel.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(350);
  ok((S.db().trainingExpenses||[]).find(t=>t.id===rec.id).linkedTraining===null,'and it can be unlinked again');
  /* the drawer is redrawn after a relink, so it is opened again to read what it says */
  w.LS.ui.closeAll(); await tick(200);
  await go('#/revenue'); await tick(300);
  click(doc.querySelector('#revTable tr[data-rev="'+rec.id+'"] td')); await tick(400);
  ok(/not tied to a training/.test(doc.body.textContent),'with the drawer saying so plainly');
  ok(!/on the training roster/.test(doc.body.textContent),'and no longer claiming a link it does not have');

  /* ── 5 · a session typed outside the roster is still possible ───────── */
  w.LS.ui.closeAll&&w.LS.ui.closeAll(); await tick(200);
  await go('#/revenue'); await tick(300);
  click(doc.querySelector('[data-add]')); await tick(300);
  const pick2=doc.querySelector('#rsPick');
  pick2.value='__new'; pick2.dispatchEvent(new w.Event('change',{bubbles:true})); await tick(120);
  ok(doc.querySelector('#rsTitle').value==='','choosing “type a new session” clears the form rather than borrowing a roster title');
  doc.querySelector('#rsTitle').value='Ad-hoc evening bench drill';
  { const er=doc.querySelector('[data-exp-row]'); if(er){ const a=er.querySelector('[data-e-amount]'); a.value='0'; a.dispatchEvent(new w.Event('input',{bubbles:true})); } }
  click(doc.querySelector('[data-save]')); await tick(400);
  const typed=ledger()[0];
  ok(typed.title==='Ad-hoc evening bench drill'&&typed.linkedTraining===null,'and it is logged without a link');
  const recon3=(doc.body.textContent.match(/(\d+) ledger rows? not linked to the roster/g)||[])[0];
  ok(!!recon3,'the page counts the rows that are not tied to the roster');

  /* ── 6 · the money itself, and what a session averages ────────────── */
  await go('#/revenue'); await tick(400);
  const ledgerNow=S.db().trainingExpenses||[];
  const totExp=ledgerNow.reduce((a,t)=>a+(t.expenses||[]).reduce((x,y)=>x+(y.amount||0),0),0);
  const totRei=ledgerNow.reduce((a,t)=>a+(t.reimbursements||[]).reduce((x,y)=>x+(y.amount||0),0),0);
  const txt=doc.body.textContent.replace(/\s+/g,' ');
  ok(txt.indexOf(U.fmtNum(totRei))>=0,'the reimbursed card shows the money itself, all of it ('+U.fmtNum(totRei)+')',txt.slice(0,80));
  ok(txt.indexOf(U.fmtNum(totExp))>=0,'the expenses card too ('+U.fmtNum(totExp)+')');
  ok(txt.indexOf(U.fmtNum(totRei-totExp))>=0,'and the net balance ('+U.fmtNum(totRei-totExp)+')');
  const kpiText=[...doc.querySelectorAll('.kpi')].map(k=>k.textContent.replace(/\s+/g,' ')).join(' | ');
  ok(!/k RWF/.test(kpiText),'no card is divided down to thousands any more',kpiText.slice(0,120));
  ok(/RWF/.test(kpiText),'the cards are in RWF, the currency the ledger is kept in');
  const kpiValues=[...doc.querySelectorAll('.kpi .kpi-value span[data-count]')].map(x=>+x.getAttribute('data-count'));
  ok(kpiValues.indexOf(totRei)>=0,'the card is animated from the exact amount, not a rounded one',kpiValues.join(' '));

  const avgRei=Math.round(totRei/ledgerNow.length), avgExp=Math.round(totExp/ledgerNow.length);
  ok(/Average per session/.test(txt),'an averages card is on the page');
  ok(txt.indexOf(U.fmtNum(avgRei))>=0,'showing the average reimbursed per session ('+U.fmtNum(avgRei)+')');
  ok(txt.indexOf(U.fmtNum(avgExp))>=0,'the average expense ('+U.fmtNum(avgExp)+')');
  ok(/against the \d+ before/.test(txt),'and the trend against the sessions before the latest three',(txt.match(/Last \d+ sessions? against[^.]*/)||[])[0]);

  /* the trend is the change in the average, computed from the record itself */
  const byDate=ledgerNow.slice().sort((a,b)=>String(b.start||'').localeCompare(String(a.start||'')));
  const sumOf=(arr,f)=>arr.reduce((a,t)=>a+f(t),0);
  const reiAvg=k=>{ const a=byDate.slice(0,k); return a.length?sumOf(a,t=>sumReimbTest(t))/a.length:0; };
  const expAvg=k=>{ const a=byDate.slice(0,k); return a.length?sumOf(a,t=>sumExpTest(t))/a.length:0; };
  const last3=byDate.slice(0,3), older=byDate.slice(3);
  const r3=last3.reduce((a,t)=>a+sumReimbTest(t),0)/last3.length;
  const o3=older.length?older.reduce((a,t)=>a+sumReimbTest(t),0)/older.length:0;
  const expect=o3?Math.round((r3-o3)/Math.abs(o3)*1000)/10:null;
  const shown=(txt.match(/([+-]?\d+(?:\.\d+)?)%/g)||[]).map(x=>parseFloat(x));
  ok(expect==null||shown.indexOf(expect)>=0,'the trend figure is the real percentage change ('+expect+'%)',shown.join(' '));
  ok(new RegExp('was '+U.fmtNum(Math.round(o3)).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(txt)||o3===0,'and names what it is being compared with');

  /* a drawer session compares itself with that average */
  click(doc.querySelector('#revTable tbody tr[data-rev] td')); await tick(400);
  ok(/against the average on the record/.test(doc.body.textContent.replace(/\s+/g,' ')),'a session says how it compares with the average');
  w.LS.ui.closeAll(); await tick(150);

  /* ── 7 · the rules are in the source ───────────────────────────────── */
  const fs=require('fs'), path=require('path');
  const src=fs.readFileSync(path.join(__dirname,'..','assets/js/modules/revenue.js'),'utf8');
  ok(/function rosterRows/.test(src),'the roster is read in one place');
  ok(/rosterOptions\(t\.linkedTraining\|\|'',t\.id\)/.test(src),'a row never offers to link itself twice');
  ok(/action:'revenue\.link'/.test(src),'linking is audited');
  ok(/function averages\(\)/.test(src),'the average is worked out in one place');
  ok(/avg\.reimb|averages\(\)\.avg/.test(src),'and read by the cards and the drawer');

  done('revenue94');
})();
