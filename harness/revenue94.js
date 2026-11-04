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

  doc.querySelector('#rsExp').value='120000';
  doc.querySelector('#rsRei').value='150000';
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
  doc.querySelector('#rsExp').value='0';
  click(doc.querySelector('[data-save]')); await tick(400);
  const typed=ledger()[0];
  ok(typed.title==='Ad-hoc evening bench drill'&&typed.linkedTraining===null,'and it is logged without a link');
  const recon3=(doc.body.textContent.match(/(\d+) ledger rows? not linked to the roster/g)||[])[0];
  ok(!!recon3,'the page counts the rows that are not tied to the roster');

  /* ── 6 · the rules are in the source ───────────────────────────────── */
  const fs=require('fs'), path=require('path');
  const src=fs.readFileSync(path.join(__dirname,'..','assets/js/modules/revenue.js'),'utf8');
  ok(/function rosterRows/.test(src),'the roster is read in one place');
  ok(/rosterOptions\(t\.linkedTraining\|\|'',t\.id\)/.test(src),'a row never offers to link itself twice');
  ok(/action:'revenue\.link'/.test(src),'linking is audited');

  done('revenue94');
})();
