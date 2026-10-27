/* v6.9.39 — the register shows every order of all time, the word Confidential belongs to
   the visitor alone, and a device that comes back to the app catches up with the cloud. */
const {boot,ok,done}=require('./env');
const click=(el)=>el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||180));

(async()=>{
  const {w,go}=await boot('#/samples');
  const doc=w.document, db=()=>w.LS.store.db();

  /* ── one name with a value, one record that never had one, and enough orders that
        a paged list would have hidden most of them ─────────────────────── */
  w.eval(`
    LS.store.commit(d=>{
      d.samples[0].patientName='Uwase Aline';
      d.samples[1].patientName='Confidential';
      for(var i=0;i<140;i++){
        d.samples.push({id:'bulk'+i, sampleId:'BC2601'+String(1000+i), patientName:'Confidential',
          patientId:'P'+i, sex:'Female', test:'Blood Culture', testCode:'BC', hospital:'CHUK',
          healthFacility:'Ruli DH', district:'Gakenke', collectionDate:'2026-0'+(1+(i%9))+'-1'+(i%9),
          collectionAt:'2026-0'+(1+(i%9))+'-1'+(i%9)+'T09:00:00', status:'Registered', priority:'Routine',
          tatTargetDays:4, collector:'Kelvin SAMAHANI', source:'register', manifestId:null,
          tests:['Cytology','Gram Stain','Blood Culture']});
      }
    },{action:'test.seed'});
  `);
  await go('#/samples');

  /* ── the whole list is drawn, not the first page of it ─────────────── */
  const total=db().samples.length;
  const rows=()=>doc.querySelectorAll('#smpBody tr[data-row]').length;
  ok(total>140,'the register holds a real number of orders ('+total+')');
  ok(rows()===total,'every order is on the page ('+rows()+'/'+total+')');
  ok(!doc.querySelector('#smpMore [data-more]'),'nothing is held behind a "load more" button');
  const footer=doc.querySelector('#smpMore').textContent;
  ok(/all time/.test(footer),'the footer says all time');
  ok(new RegExp(total+' orders? shown').test(footer),'and counts them',footer.replace(/\s+/g,' ').slice(0,120));
  ok(/Nothing is generated and nothing is hidden/.test(footer),'and says nothing is hidden');
  ok(/\d{4}/.test(footer),'it names the span of dates covered');

  /* ── no Confidential for staff ─────────────────────────────────────── */
  ok(!/Confidential/.test(doc.querySelector('#smpBody').textContent),'no row reads Confidential for a signed-in Admin');
  ok(/Uwase Aline/.test(doc.querySelector('#smpBody').textContent),'the recorded name is shown');

  /* ── the drawer offers to record a missing name ────────────────────── */
  const missing=db().samples.find(s=>s.patientName==='Confidential');
  click([...doc.querySelectorAll('#smpBody tr[data-row]')].find(tr=>tr.dataset.row===missing.id)); await tick(260);
  ok(!!doc.querySelector('.drawer, .modal'),'the record opens');
  const panel=doc.querySelector('.drawer')||doc.querySelector('.modal');
  ok(!/Confidential/.test(panel.textContent),'the record does not say Confidential');
  const addBtn=panel.querySelector('[data-name-add]');
  ok(!!addBtn,'a dash is replaced by "Record a name"');
  click(addBtn); await tick(220);
  const nm=doc.querySelector('#nmVal');
  ok(!!nm,'a name can be typed straight from the record');
  nm.value='Nkurunziza Emmanuel';
  click(doc.querySelector('[data-save-name]')); await tick(500);
  ok(db().samples.find(s=>s.id===missing.id).patientName==='Nkurunziza Emmanuel','the name is stored on the order');
  ok(db().audit[0].action==='sample.name','and written to the audit trail');
  ok([...doc.querySelectorAll('.drawer')].some(d=>/Nkurunziza Emmanuel/.test(d.textContent)),'and shown at once');

  /* ── the visitor still reads the mask ──────────────────────────────── */
  w.eval("LS.auth.user=Object.assign({},LS.auth.VISITOR,{visitor:true});");
  await go('#/samples');
  ok(/Confidential/.test(doc.querySelector('#smpBody').textContent),'a visitor reads Confidential');
  ok(!/Uwase Aline/.test(doc.querySelector('#smpBody').textContent),'and never a name');
  w.eval("LS.auth.user={id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'};");

  /* ── the freshness chip ────────────────────────────────────────────── */
  await go('#/samples');
  w.eval(`
    LS.sync.configured=()=>true;
    LS.sync.freshness=()=>({known:true, ms:180000, text:'3 minutes ago'});
    window.__pulled=0;
    LS.sync.pullLatest=async()=>{ window.__pulled++; return {ok:true, action:'pulled', after:{samples:147}}; };
    LS.sync.refresh=async()=>{ window.__pulled++; return {ok:true, action:'pulled'}; };
  `);
  await go('#/samples');
  const chip=doc.querySelector('[data-refresh]');
  ok(!!chip,'the referral samples screen says how fresh it is');
  ok(/Updated 3 minutes ago/.test(chip.textContent),'naming the last read',chip.textContent.trim());
  click(chip); await tick(300);
  ok(w.eval('window.__pulled')>=1,'pressing it pulls the shared copy');
  ok([...doc.querySelectorAll('.toast')].some(t=>/shared register/i.test(t.textContent)),'and says what it is showing');
  ok(!!doc.querySelector('[data-refresh]'),'and the chip is back afterwards');

  /* ── a pull lands on the screen without a reload ───────────────────── */
  const before=rows();
  w.eval(`
    (function(){
      var copy=JSON.parse(JSON.stringify(LS.store.db()));
      copy.samples.push({id:'smFresh',sampleId:'RBC10269999',patientName:'Mukamana Alice',patientId:'999111',
        sex:'Female',test:'Blood Culture',testCode:'BC',hospital:'CHUK',healthFacility:'Ruli DH',
        district:'Gakenke',collectionDate:'2026-10-27',collectionAt:'2026-10-27T09:00:00',status:'Registered',
        priority:'Routine',tatTargetDays:4,collector:'Kelvin SAMAHANI',source:'register',manifestId:null,
        tests:['Cytology','Gram Stain','Blood Culture']});
      LS.sync.applyRemote({data:copy, revision:99, updated_at:new Date().toISOString(), updated_by:'the PC'});
    })();
  `);
  await tick(500);
  ok(rows()===before+1,'a pulled order appears on the screen by itself ('+before+'→'+rows()+')');
  ok(/RBC10269999/.test(doc.querySelector('#smpBody').textContent),'and it is the order the PC sent');
  ok(/Mukamana Alice/.test(doc.querySelector('#smpBody').textContent),'with its name');

  done('freshness');
})().catch(e=>{console.error(e);process.exit(1);});
