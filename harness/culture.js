/* Blood culture carries Cytology and Gram Stain as routine; names follow the session. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||160));

(async()=>{
  const {w,go}=await boot('#/samples');
  const doc=w.document, db=()=>w.LS.store.db();

  const names=db().catalog.tests.map(t=>t.name);
  ok(names.indexOf('Cytology')>=0,'Cytology is in the test menu');
  ok(names.indexOf('Gram Stain')>=0,'Gram Stain is in the test menu');

  click(doc.querySelector('[data-new]')); await tick(320);
  const m=()=>doc.querySelector('.modal');
  const nameField=m().querySelector('#wName');
  ok(!!nameField,'a signed-in user gets the patient name field');
  nameField.value='Uwase Aline';
  m().querySelector('#wPid').value='430129';
  click(m().querySelector('[data-wnext]')); await tick(240);

  const btn=nm=>[...m().querySelectorAll('[data-test]')].find(b=>b.textContent.trim().indexOf(nm)===0);
  const culture=btn('Blood Culture');
  ok(!!culture,'Blood Culture is on the menu');
  click(culture); await tick(90);
  const cyto=btn('Cytology'), gram=btn('Gram Stain');
  ok(cyto.classList.contains('on'),'choosing a blood culture ticks Cytology');
  ok(gram.classList.contains('on'),'and Gram Stain');
  ok(cyto.classList.contains('routine')&&gram.classList.contains('routine'),'both are marked as routine additions');
  ok(/Cytology and Gram Stain added as routine/.test(m().querySelector('#wTestCount').textContent),'the counter says so');
  ok(m().querySelector('#wRoutine').style.display!=='none','the note explains it');

  click(culture); await tick(90);
  ok(!cyto.classList.contains('on')&&!gram.classList.contains('on'),'dropping the culture drops the pair');
  click(culture); await tick(90);
  ok(cyto.classList.contains('on')&&gram.classList.contains('on'),'and re-adding it brings them back');

  click(m().querySelector('[data-wnext]')); await tick(240);
  const pills=[...m().querySelectorAll('.pill')].map(p=>p.textContent.trim());
  ok(pills.some(t=>/3 tests/.test(t)),'step 3 summarises the three tests',pills.join(' | '));
  click(m().querySelector('[data-wnext]')); await tick(320);

  const created=db().samples[db().samples.length-1];
  ok(created.patientName==='Uwase Aline','the name is recorded for a signed-in user');
  ok(created.test==='Blood Culture','the order is a blood culture');
  ok(/^RBC/.test(created.sampleId),'so the ID is built from BC: '+created.sampleId);
  ok(JSON.stringify(created.tests)===JSON.stringify(['Cytology','Gram Stain','Blood Culture']),
     'the record keeps the routine order',JSON.stringify(created.tests));

  w.eval(`(function(){ var id='${created.id}'; LS.store.commit(function(d){
      var s=d.samples.find(function(x){return x.id===id;});
      s.transporter='Jean Paul NSENGIYUMVA';
      d.manifests.unshift({id:'manC',manifestId:'BC2610260011',type:'Referral',title:'Sample Referral Manifest',
        testingHospital:'CHUK',createdAt:'2026-10-26',samples:[id],status:'Generated',createdBy:'Kelvin SAMAHANI'});
    },{action:'test.seed'}); })();`);
  await go('#/samples?tab=manifests');
  const card=[...doc.querySelectorAll('[data-man-card]')].find(c=>c.textContent.includes('BC2610260011'));
  ok(!!card,'the manifest has a card');
  click(card.querySelector('[data-man-view]')); await tick(240);
  const cell=[...doc.querySelector('#manDoc').querySelectorAll('table')[0].querySelectorAll('tbody tr')[0].children][7];
  const listed=[...cell.querySelectorAll('div')].map(d=>d.textContent.trim());
  ok(listed.join(' · ')==='Cytology · Gram Stain · Blood Culture','the manifest lists them in order',listed.join(' · '));
  ok(/Uwase Aline/.test(doc.querySelector('#manDoc').textContent),'and the name, for a signed-in user');
  click(doc.querySelector('.modal [data-close]')); await tick(200);

  w.eval("window.__csv=null; window.Blob=function(parts){ window.__csv=String(parts[0]); return {size:1}; }; URL.createObjectURL=function(){return 'blob:x';}; URL.revokeObjectURL=function(){};");
  await go('#/samples');
  click(doc.querySelector('[data-export]')); await tick(220);
  const csv=w.eval('window.__csv');
  ok(!!csv&&/Cytology · Gram Stain · Blood Culture/.test(csv),'the CSV carries the test list');
  ok(/Uwase Aline/.test(csv),'and the name for a signed-in user');

  w.eval("LS.auth.user=Object.assign({},LS.auth.VISITOR,{visitor:true});");
  await go('#/samples');
  w.eval("window.__csv=null;");
  click(doc.querySelector('[data-export]')); await tick(220);
  const vcsv=w.eval('window.__csv');
  ok(!!vcsv&&!/Uwase Aline/.test(vcsv),'a visitor export never carries a name');
  ok(/Confidential/.test(vcsv),'it reads Confidential instead');
  ok(!/Uwase Aline/.test(doc.querySelector('#smpView').textContent),'and the list shows the mask');

  done('culture');
})().catch(e=>{console.error(e);process.exit(1);});
