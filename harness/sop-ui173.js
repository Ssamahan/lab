const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/quality?tab=sops');w.LS.sync.stopLive();await go('#/quality?tab=sops');
 const d=w.document,search=d.querySelector('#registerSearch'),section=d.querySelector('#registerSection'),band=d.querySelector('#registerBand');
 ok(!!search&&!!section&&!!band,'review register offers search, section and review-date filters');
 ok(d.querySelectorAll('[data-register-row]').length===70,'all 70 register records retained');
 ok(!!d.querySelector('[data-source-code="RliDHL-ADM-SOP-063-VERS-001"] a[href*="drive.google.com"]'),'source links retained');
 if(search&&section&&band){
  search.value='bilirubin';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  const visible=[...d.querySelectorAll('[data-register-row]')].filter(r=>!r.hidden);
  ok(visible.length>0&&visible.every(r=>r.textContent.toLowerCase().includes('bilirubin')),'search filters review rows by content');
  ok(!d.querySelector('[data-register-row="14"]').hidden,'matching duplicate-code row stays visible');
  search.value='not-a-real-sop-xyz';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  ok(d.querySelector('#registerResults').textContent.includes('0'), 'empty-result count is shown');
  search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
  section.value='Clinical chemistry';section.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok([...d.querySelectorAll('[data-register-row]')].filter(r=>!r.hidden).every(r=>r.closest('[data-register-section]').dataset.registerSection==='Clinical chemistry'),'section filter does not mix sections');
  section.value='';section.dispatchEvent(new w.Event('change',{bubbles:true}));
  band.value='unknown';band.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok([...d.querySelectorAll('[data-register-row]')].filter(r=>!r.hidden).every(r=>r.dataset.band==='unknown'),'review-date filter selects the requested band');
  band.value='';band.dispatchEvent(new w.Event('change',{bubbles:true}));
  ok([...d.querySelectorAll('[data-register-row]')].every(r=>!r.hidden),'clearing filters restores every row');
 }
 done('sop-ui173');
})().catch(e=>{console.error(e);process.exit(1)});
