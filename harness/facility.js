/* v6.9.38 — Ruli DH is the sending laboratory, and a manifest code ends in four
   alphanumeric characters (A001, A002 … A00A), never a run of digits. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));
const DB_KEY='labSystems.v1';
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../assets/js/core/seed.js'),'utf8');
const SEED=JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}')+1));

(async()=>{
  /* ── the code itself ────────────────────────────────────────────────── */
  const {w,go}=await boot('#/samples');
  const doc=w.document, db=()=>w.LS.store.db();

  const tail=n=>w.LS.store.manifestTail(n);
  ok(/^[A-Z0-9]{4}$/.test(tail(1)),'the tail is four alphanumeric characters');
  ok(tail(1)==='A001','the first is A001',tail(1));
  ok(tail(9)==='A009','the ninth is A009',tail(9));
  ok(tail(10)==='A00A','the tenth rolls into a letter',tail(10));
  ok(tail(37)==='A011','and it keeps counting',tail(37));
  ok([1,2,3,50,300].every(n=>/[A-Z]/.test(tail(n))),'a letter is always in there');

  const id=w.LS.store.manifestId('Blood Culture','2026-10-27');
  ok(/^BC261027[A-Z0-9]{4}$/.test(id),'the code is BC + YYMMDD + four: '+id);
  ok(/[A-Z]/.test(id.slice(-4)),'and the tail is alphanumeric');
  ok(id.length===12,'twelve characters, nothing missing',id.length);

  /* ── the origin is Ruli DH ─────────────────────────────────────────── */
  click(doc.querySelector('[data-new]')); await tick(320);
  const m=()=>doc.querySelector('.modal');
  m().querySelector('#wPid').value='430129';
  click(m().querySelector('[data-wnext]')); await tick(240);
  const menu=[...m().querySelectorAll('[data-test]')];
  menu.find(b=>b.textContent.trim().indexOf('Blood Culture')===0).click(); await tick(80);
  click(m().querySelector('[data-wnext]')); await tick(240);
  const origin=m().querySelector('#wOrigin');
  ok(origin.options[0].value==='Ruli DH','Ruli DH is the first origin on the list',origin.options[0].value);
  ok(origin.value==='Ruli DH','and it is the one selected');
  ok([...origin.options].some(o=>o.value.endsWith(' HC')),'the health centres stay available');
  click(m().querySelector('[data-wnext]')); await tick(340);

  const created=db().samples[db().samples.length-1];
  ok(created.healthFacility==='Ruli DH','the order records Ruli DH, not a health centre',created.healthFacility);

  /* ── the sheet shows the hospital ──────────────────────────────────── */
  w.eval(`(function(){ var id='${created.id}'; LS.store.commit(function(d){
      d.manifests.unshift({id:'manF',manifestId:'',type:'Referral',title:'Sample Referral Manifest',
        testingHospital:'NRL',createdAt:'2026-10-26',samples:[id],status:'Generated',createdBy:'Kelvin SAMAHANI'});
      var man=d.manifests[0];
      man.manifestId=LS.store.takeManifestId('Blood Culture', man.createdAt, d);
    },{action:'test.seed'}); })();`);
  await go('#/samples?tab=manifests');
  const made=db().manifests[0];
  ok(/^BC\d{6}[A-Z0-9]{4}$/.test(made.manifestId),'the generated manifest carries the full code',made.manifestId);
  const card=[...doc.querySelectorAll('[data-man-card]')].find(c=>c.textContent.includes(made.manifestId));
  ok(!!card,'its card is listed');
  click(card.querySelector('[data-man-view]')); await tick(260);
  const row=doc.querySelector('#manDoc').querySelectorAll('table')[0].querySelectorAll('tbody tr')[0];
  ok(/Ruli DH/.test(row.children[2].textContent),'the Health facility column reads Ruli DH',row.children[2].textContent.trim());
  ok(!/Ruli HC/.test(row.children[2].textContent),'and never Ruli HC');
  click(doc.querySelector('.modal [data-close]')); await tick(200);

  /* ── an old register is corrected on load ──────────────────────────── */
  const older=await boot('#/dash',{seed(window){
    const seed=JSON.parse(JSON.stringify(SEED));
    seed.samples[0].source='register'; seed.samples[0].healthFacility='Ruli HC';
    seed.manifests=[{id:'legacy1',manifestId:'BC2610260001',title:'Sample Referral Manifest',
      testingHospital:'NRL',createdAt:'2026-10-26',samples:[seed.samples[0].id],status:'Generated'}];
    seed.meta={...seed.meta};
    delete seed.meta.manifestCodesV6938; delete seed.meta.originRuliDhV6938;
    window.localStorage.setItem(DB_KEY, JSON.stringify(seed));
  }});
  const db2=older.w.LS.store.db();
  ok(db2.samples[0].healthFacility==='Ruli DH','a console-borne order filed under Ruli HC is corrected on load',db2.samples[0].healthFacility);
  ok(/[A-Z]/.test(db2.manifests[0].manifestId.slice(-4)),'an all-digit tail is rewritten with letters',db2.manifests[0].manifestId);
  ok(/^[A-Z]{2,3}261026[A-Z0-9]{4}$/.test(db2.manifests[0].manifestId),'keeping its day and the test on it',db2.manifests[0].manifestId);
  ok(db2.manifests[0].manifestId.length===13,'and its full length (three-letter code + day + four)');

  done('facility');
})().catch(e=>{console.error(e);process.exit(1);});
