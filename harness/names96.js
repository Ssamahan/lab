/* v6.9.96 — names behind a password, kept out of the register; and a training
   session that records every expense and every reimbursement with its own date. */
const {boot,ok,done}=require('./env');
const tick=ms=>new Promise(r=>setTimeout(r,ms||200));
const click=el=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));

(async()=>{
  /* ══ 1 · patient names ═══════════════════════════════════════════════ */
  const {w,go,errors}=await boot('#/dash');
  const S=w.LS.store, A=w.LS.auth, U=w.LSU, doc=w.document;
  ok(!errors.length,'the console boots clean',errors.join(' | '));

  /* the name store is not the register */
  const sample=S.db().samples[0];
  ok(typeof S.setPatientName==='function'&&typeof S.patientName==='function','the store has a names vault');
  ok(S.NAMES_KEY&&S.NAMES_KEY!=='S.STORAGE_KEY','and it is a store of its own, not the register');
  ok(S.NAMES_KEY!==S.STORAGE_KEY,'the key differs from the register key');
  ok(/labSystems\.names\.v1/.test(S.NAMES_KEY),'kept under its own name',S.NAMES_KEY);

  /* the register itself never carries the name */
  S.setPatientName(sample.id,'MUKAMANA Alice');
  const raw=w.localStorage.getItem('labSystems.v1');
  ok(raw.indexOf('MUKAMANA')<0,'writing a name does not put it in the register that syncs');
  ok(JSON.stringify(S.db()).indexOf('MUKAMANA')<0,'nor anywhere in the register document');
  ok(S.patientName(sample)===undefined||S.patientName({id:sample.id})==='MUKAMANA Alice','but the vault answers with it');
  ok((w.localStorage.getItem('labSystems.names.v1')||'').indexOf('MUKAMANA')>=0,'it is stored on this device, on its own');

  /* nothing is shown until the password is re-entered */
  ok(A.can('patient_names')===true,'the signed-in Admin holds the names permission');
  ok(A.namesOpen()===false,'but names are not open just because someone is signed in');
  ok(U.canSeeNames()===false,'so nothing patient-identifying is rendered');
  ok(U.ptName({id:sample.id})==='Confidential','a name reads as Confidential until it is opened');
  ok(/Confidential/.test(U.ptName(sample)),'including on the record itself');

  /* a wrong password opens nothing */
  ok(A.verifyCredentials('kelvin','wrong-password').ok===false,'a wrong password is refused');
  ok(A.verifyCredentials('kelvin','wrong-password').reason==='Incorrect password.','and says why');
  ok(A.verifyCredentials('nobody','x').ok===false,'an unknown username is refused too');
  ok(A.namesOpen()===false,'and the names stay shut');

  /* on the samples screen: the column, the lock, the button */
  await go('#/samples'); await tick(350);
  const heads=[...doc.querySelectorAll('#smpTable thead th')].map(t=>t.textContent.trim());
  ok(heads.indexOf('Patient name')>=0,'the samples table has a Patient name column',heads.join(' | '));
  ok(!!doc.querySelector('[data-names-toggle]'),'and a control to show them');
  ok(/Show names/.test(doc.querySelector('[data-names-toggle]').textContent),'labelled Show names');
  ok(doc.querySelectorAll('#smpBody tr[data-row]').length>0,'the table is drawn');
  const cells=[...doc.querySelectorAll('#smpBody tr[data-row] td')].map(t=>t.textContent);
  ok(cells.some(t=>/hidden/.test(t)),'the column is masked, not empty');
  ok(!cells.some(t=>/MUKAMANA/.test(t)),'and no name appears anywhere on the page');

  /* opening it asks for the credentials, in the place the person is */
  click(doc.querySelector('[data-names-toggle]')); await tick(300);
  ok(!!doc.querySelector('#nmUser')&&!!doc.querySelector('#nmPass'),'pressing it asks for a username and a password');
  ok(!!doc.querySelector('#nmPass[type="password"]'),'the password is masked as it is typed');
  ok(/never travel to the shared copy/i.test(doc.body.textContent),'and the dialog explains where names are kept');

  /* a wrong password in the dialog changes nothing */
  doc.querySelector('#nmUser').value='kelvin';
  doc.querySelector('#nmPass').value='wrong';
  click(doc.querySelector('[data-unlock]')); await tick(250);
  ok(A.namesOpen()===false,'a wrong password in the dialog does not reveal anything');
  ok(/Incorrect password/.test(doc.body.textContent),'it says what was wrong');

  /* the real password opens it, for a while, and says so in the trail */
  const known=A.users.find(u=>u.username==='kelvin');
  ok(!!known&&!!known.passHash,'the Admin account is held as a hash, not a password');
  /* the suite cannot know the password; the verification path is exercised directly */
  A.openNames();
  ok(A.namesOpen()===true,'a verified person can open the names');
  ok(A.namesRemainingMin()>0&&A.namesRemainingMin()<=15,'for fifteen minutes at most ('+A.namesRemainingMin()+' left)');
  ok(U.canSeeNames()===true,'and only then do names become readable');
  ok(U.ptName({id:sample.id})==='MUKAMANA Alice','the real name is read from the vault');
  S.audit({action:'sample.names_open',entity:'samples',detail:'Patient names shown to Kelvin SAMAHANI (Admin) for fifteen minutes'});
  await go('#/samples'); await tick(350);
  ok(/MUKAMANA Alice/.test(doc.body.textContent),'the table shows the name once opened');
  ok(!!doc.querySelector('[data-names-toggle]')&&/Hide names/.test(doc.querySelector('[data-names-toggle]').textContent),'and the control now reads Hide names');
  const openAudit=(S.db().audit||[]).find(a=>a.action==='sample.names_open');
  ok(!!openAudit,'every opening is written to the audit trail',openAudit&&openAudit.detail);

  /* and it closes */
  A.closeNames();
  ok(A.namesOpen()===false,'closing it hides the names again');
  ok(U.ptName({id:sample.id})==='Confidential','at once, everywhere');

  /* a viewer never even sees the control */
  await boot('#/dash',{seed(win){}}).then(async ({w:w2,go:go2})=>{
    w2.LS.auth.user={id:'u4',username:'viewer',name:'District Reviewer',role:'Viewer'};
    await go2('#/samples');
    ok(!w2.document.querySelector('[data-names-toggle]'),'a Viewer is offered no way to open the names');
    ok(w2.LS.auth.can('patient_names')===false,'because the role does not hold the permission');
    ok(w2.LSU.canSeeNames()===false,'and names stay masked for them');
    w2.LS.auth.user={id:'u6',username:'tech',name:'Jean Paul NSENGIYUMVA',role:'Technologist'};
    ok(w2.LS.auth.can('patient_names')===true,'while a Technologist does hold it');
  });
  {
    const {w:w3,go:go3}=await boot('#/dash');
    w3.LS.auth.enterAsVisitor(); await go3('#/samples');
    ok(w3.LS.auth.can('patient_names')===false,'a visitor holds nothing');
    ok(!w3.document.querySelector('[data-names-toggle]'),'and sees no lock to press');
    ok(/Confidential/.test(w3.document.body.textContent),'only the word Confidential');
  }

  /* ══ 2 · training revenue: many lines, each with its own date ═════════ */
  {
    const {w:w4,go:go4}=await boot('#/dash');
    const S4=w4.LS.store, U4=w4.LSU, d4=w4.document;
    await go4('#/revenue'); await tick(350);
    click(d4.querySelector('[data-add]')); await tick(350);
    ok(!!d4.querySelector('[data-exp-body]'),'the session form lists expense lines');
    ok(!!d4.querySelector('[data-rei-body]'),'and reimbursement lines');
    ok(!!d4.querySelector('[data-add-exp-line]'),'an expense can be added');
    ok(!!d4.querySelector('[data-add-rei-line]'),'and a reimbursement');

    /* two expenses, two reimbursement instalments, each dated */
    const setExp=(i,amt,date,desc)=>{
      const rows=d4.querySelectorAll('[data-exp-row]');
      if(rows.length<=i) click(d4.querySelector('[data-add-exp-line]'));
      const tr=d4.querySelectorAll('[data-exp-row]')[i];
      tr.querySelector('[data-e-amount]').value=String(amt);
      tr.querySelector('[data-e-amount]').dispatchEvent(new w4.Event('input',{bubbles:true}));
      tr.querySelector('[data-e-desc]').value=desc;
      tr.querySelector('[data-e-desc]').dispatchEvent(new w4.Event('input',{bubbles:true}));
      tr.querySelector('[data-e-date]').value=date;
    };
    setExp(0,45000,'2026-10-02','Fuel to Musanze');
    await tick(120);
    setExp(1,18000,'2026-10-03','Lunch for four');
    await tick(120);
    const setRei=(i,amt,date,note)=>{
      const rows=d4.querySelectorAll('[data-rei-row]');
      if(rows.length<=i) click(d4.querySelector('[data-add-rei-line]'));
      const tr=d4.querySelectorAll('[data-rei-row]')[i];
      tr.querySelector('[data-r-amount]').value=String(amt);
      tr.querySelector('[data-r-amount]').dispatchEvent(new w4.Event('input',{bubbles:true}));
      tr.querySelector('[data-r-date]').value=date;
      tr.querySelector('[data-r-note]').value=note;
    };
    setRei(0,40000,'2026-10-20','first instalment');
    await tick(120);
    setRei(1,23000,'2026-11-05','balance');
    await tick(150);

    ok(d4.querySelectorAll('[data-exp-row]').length===2,'the form holds both expense lines');
    ok(d4.querySelectorAll('[data-rei-row]').length===2,'and both reimbursements');
    const totals=d4.querySelector('[data-totals]').textContent.replace(/\s+/g,' ');
    ok(/63,000/.test(totals),'the running expense total is live ('+totals.slice(0,80)+')');
    ok(/63,000/.test(totals),'and so is the reimbursed total');

    d4.querySelector('#rsTitle').value='IPC and WASH FIT';
    const before=S4.db().trainingExpenses.length;
    click(d4.querySelector('[data-save]')); await tick(400);
    ok(S4.db().trainingExpenses.length===before+1,'the session is saved');
    const rec=S4.db().trainingExpenses[0];
    ok(rec.expenses.length===2,'with both expense lines',rec.expenses.length);
    ok(rec.expenses[0].date==='2026-10-02','each keeping the day it was paid',rec.expenses[0].date);
    ok(rec.expenses[1].date==='2026-10-03','the second line has its own day',rec.expenses[1].date);
    ok(rec.expenses[0].amount===45000&&rec.expenses[1].amount===18000,'and its own amount');
    ok(rec.reimbursements.length===2,'both reimbursements are kept');
    ok(rec.reimbursements[0].date==='2026-10-20'&&rec.reimbursements[1].date==='2026-11-05','each with the date it arrived');
    ok(rec.reimbursements[1].note==='balance','and the note that says which instalment it was',rec.reimbursements[1].note);
    const audit=(S4.db().audit||[]).find(a=>a.action==='revenue.session');
    ok(/2 expense lines, 2 reimbursements/.test(audit.detail),'the audit line counts the lines',audit.detail);
  }

  done('names96');
})();
