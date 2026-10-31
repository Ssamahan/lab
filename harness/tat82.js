/* v6.9.81 — request #54: the TAT target belongs to the examination.
   Blood culture is seven days, a viral haemorrhagic fever three, TB culture
   twenty-one; the figure is saved on the test and every sample carrying that
   test inherits it, so nobody types a target when registering a specimen.
   Several tests on one sample take the longest of them. A deliberate figure on
   one sample is remembered as an override and is never quietly overwritten. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const samplesSrc=fs.readFileSync(path.join(root,'assets/js/modules/samples.js'),'utf8');
const staffSrc=fs.readFileSync(path.join(root,'assets/js/modules/staff.js'),'utf8');
const storeSrc=fs.readFileSync(path.join(root,'assets/js/core/store.js'),'utf8');

(async()=>{
  const {w,go,errors}=await boot('#/samples');
  const d=w.document, S=w.LS.store, U=w.LSU, db=()=>S.db();
  const tick=n=>new Promise(r=>setTimeout(r,n||200));
  const click=el=>{ if(!el) throw new Error('nothing to click'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); };
  const pick=(names)=>{ // open wizard, choose tests by name, return the step-2 card text
    S.modules; return names;
  };
  ok(!errors.length,'the console boots without console errors',errors.join(' | '));

  /* ── 1 · the standard itself ─────────────────────────────────────────── */
  ok(S.standardTAT('Blood Culture')===7,'blood culture carries a seven-day standard',S.standardTAT('Blood Culture'));
  ok(S.standardTAT('TB Culture')===21,'TB culture carries twenty-one days',S.standardTAT('TB Culture'));
  ok(S.standardTAT('Marburg')===3,'a viral haemorrhagic fever carries three days',S.standardTAT('Marburg'));
  ok(S.standardTAT('PCR Rift Valley')===3,'and so does Rift Valley fever',S.standardTAT('PCR Rift Valley'));
  ok(S.standardTAT('Hepatitis (HEP)')===7,'hepatitis carries seven',S.standardTAT('Hepatitis (HEP)'));
  ok(S.standardTAT('Some Examination Nobody Has Heard Of')===null,
     'the table only names the examinations it knows');
  ok(S.tatTarget('Some Examination Nobody Has Heard Of')===3,
     'anything outside the table falls back to a three-day target');
  const bc=db().catalog.tests.find(t=>t.name==='Blood Culture');
  ok(bc && bc.tat===7,'the standard is written on the catalogue test, not only in code',bc&&bc.tat);
  ok(!db().settings.tat || !Object.keys(db().settings.tat).length,
     'no settings-level shadow is left to override the test',JSON.stringify(db().settings.tat||{}));

  /* ── 2 · every existing sample was re-read ───────────────────────────── */
  const seeded=db().samples.filter(s=>/Blood Culture/.test(String(s.tests||s.test)));
  ok(seeded.length>0,'the register still holds its blood cultures ('+seeded.length+')');
  ok(seeded.every(s=>s.tatManual || s.tatTargetDays===7),
     'each of them now carries the seven-day target',seeded.map(s=>s.sampleId+':'+s.tatTargetDays).join(', '));
  const vhf=db().samples.filter(s=>/Marburg|Ebola|Lassa|Rift Valley|Yellow Fever|Crimean/i.test(String(s.tests||'')));
  ok(vhf.every(s=>s.tatManual || s.tatTargetDays===3),
     'the haemorrhagic-fever samples carry three days',vhf.map(s=>s.tests+'='+s.tatTargetDays).join(', '));

  /* ── 3 · registering: the target appears as the tests are chosen ─────── */
  await go('#/samples'); await tick(200);
  click([...d.querySelectorAll('[data-new]')][0]); await tick(260);
  ok(!!d.querySelector('#wPid'),'the register wizard opens on the patient step');
  d.querySelector('#wPid').value='88213';
  click(d.querySelector('[data-wnext]')); await tick(200);
  const tgt0=d.querySelector('#wTarget');
  ok(!!tgt0,'the test step states the target in place');
  ok(/Pick a test/i.test(tgt0.textContent),'and says nothing yet when no test is chosen',tgt0.textContent.trim());
  ok(!/type=\\?"number/i.test(d.querySelector('#wBody').innerHTML) &&
     !/\bwTat\b/.test(d.querySelector('#wBody').innerHTML),
     'there is no target field to type on this step');
  const buttons=[...d.querySelectorAll('[data-test]')];
  const byName=n=>buttons.find(b=>b.querySelector('.ct') && b.querySelector('.ct').textContent===n);
  const bBC=byName('Blood Culture');
  ok(!!bBC,'the menu lists Blood Culture');
  ok(/TAT 7d/.test(bBC.textContent),'the menu row itself shows the seven-day target',bBC.textContent.replace(/\s+/g,' '));
  click(bBC); await tick(120);
  ok(/Target TAT\s*7 days/i.test(d.querySelector('#wTarget').textContent),
     'choosing blood culture states seven days at once',d.querySelector('#wTarget').textContent.replace(/\s+/g,' '));
  ok(/saved with the sample/i.test(d.querySelector('#wTarget').textContent),
     'and says the figure is saved with the sample');
  ok(d.querySelectorAll('#wTarget .pill').length>=1,'the chosen test is listed with its own target');
  const bMRB=byName('Marburg');
  ok(!!bMRB,'the menu lists Marburg');
  click(bMRB); await tick(120);
  const both=d.querySelector('#wTarget').textContent.replace(/\s+/g,' ');
  ok(/Target TAT\s*7 days/i.test(both),'two tests take the longest — still seven days',both);
  ok(/longest of the 4/i.test(both),'and the card says the figure is the longest on the sample',both);
  ok(/CYT · 7d/.test(both)&&/MRB · 3d/.test(both),'each examination is shown beside its own days',both);
  ok(d.querySelectorAll('#wTarget .pill').length>=2,'both examinations are listed with their own days');
  click(bMRB); await tick(120);
  ok(/Target TAT\s*7 days/i.test(d.querySelector('#wTarget').textContent),'dropping Marburg goes back to seven days alone');
  click(bMRB); await tick(100);
  click(d.querySelector('[data-wnext]')); await tick(240);
  const routing=d.querySelector('#wBody').textContent.replace(/\s+/g,' ');
  ok(/Target TAT\s*7 days/i.test(routing),'the routing step repeats the target before the sample is made',routing.slice(0,400));
  const before=db().samples.length;
  click(d.querySelector('[data-wnext]')); await tick(500);
  const made=db().samples[db().samples.length-1];
  ok(db().samples.length===before+1,'the sample is created');
  ok(made.tatTargetDays===7,'and is saved with the seven-day target without anyone typing it',made.tatTargetDays);
  ok(!made.tatManual,'the figure came from the tests, not from a person',made.tatManual);

  /* ── 4 · the target follows the examination, and a hand-set figure stays ─ */
  w.eval("LS.store.commit(x=>{ const t=x.catalog.tests.find(y=>y.name==='Blood Culture'); t.tat=6; t.tatManual=true; LS.store.reapplyTAT(); },{action:'test.tat'});");
  ok(S.tatTarget('Blood Culture')===6,'a changed standard is read back at once',S.tatTarget('Blood Culture'));
  const fresh=()=>db().samples.find(s=>s.id===made.id);
  /* the new sample also carries Cytology (7) and Gram Stain (4), so its own
     figure is the longest — the point is that it is re-read, not typed */
  ok(fresh().tatTargetDays===7,'the new sample re-reads the longest of the tests it carries',fresh().tatTargetDays);
  const plain=db().samples.find(s=>S.testNamesOf(s).length===1 && S.testNamesOf(s)[0]==='Blood Culture');
  ok(plain && plain.tatTargetDays===6,'a sample carrying only blood culture follows the menu at once',plain&&plain.tatTargetDays);
  w.eval("LS.store.commit(x=>{ const s=x.samples.find(y=>y.id==='"+made.id+"'); s.tatTargetDays=9; s.tatManual=true; },{action:'test.manual'});");
  w.eval("LS.store.reapplyTAT();");
  ok(fresh().tatTargetDays===9,'a figure set by hand on the sample is left alone by the change',fresh().tatTargetDays);
  w.eval("LS.store.commit(x=>{ const s=x.samples.find(y=>y.id==='"+made.id+"'); s.tatTargetDays=6; s.tatManual=false; },{action:'test.plain'});");
  ok(S.testNamesOf(fresh()).length>1,'the new sample carries several examinations');
  w.eval("LS.store.commit(x=>{ const s=x.samples.find(y=>y.id==='"+made.id+"'); s.tatTargetDays=9; s.tatManual=true; },{action:'test.manual'});");
  w.eval("LS.store.reapplyTAT();");
  ok(db().samples.find(s=>s.id===made.id).tatTargetDays===9,
     'a figure set by hand on one sample is not overwritten by a later standard');
  w.eval("LS.store.commit(x=>{ const t=x.catalog.tests.find(y=>y.name==='Blood Culture'); t.tat=7; LS.store.reapplyTAT(); },{action:'test.tat'});");
  ok(S.tatTarget('Blood Culture')===7,'the standard can be put back');
  ok(db().samples.find(s=>s.id===made.id).tatTargetDays===9,'the hand-set sample still keeps its own figure');

  /* ── 5 · the settings test menu is where it is set ───────────────────── */
  ok(/data-save-tat/.test(staffSrc),'one Save TAT button in Settings → Test menu');
  ok(/d\.catalog\.tests/.test(staffSrc) && /reapplyTAT/.test(staffSrc),
     'and saving writes the figure onto the catalogue tests, then re-reads every sample');
  ok(/tatManual=true/.test(staffSrc),'a figure typed in Settings is remembered as deliberate');
  ok(/tat target in days|target turnaround in days/i.test(staffSrc),
     'the menu explains that the number beside each row is the target in days');

  /* ── 6 · the record itself says where the number came from ───────────── */
  ok(/from the test/i.test(samplesSrc),'the record editor labels the target as coming from the test');
  ok(/tatManual/.test(samplesSrc),'and remembers an override on a single sample');
  ok(/S\.tatTargetForTests/.test(samplesSrc),'registration takes the longest of the tests carried');
  ok(/wizardTargetLine/.test(samplesSrc) && /selectionTargets/.test(samplesSrc),
     'the wizard states the target on both the test step and the routing card');

  ok(!errors.length,'still no console errors after registering a sample',errors.join(' | '));
  done('tat82');
})().catch(e=>{ console.log('  ✗ harness threw: '+e.message+'\n'+e.stack); process.exit(1); });
