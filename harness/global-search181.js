const {boot,ok,done}=require('./env');
(async()=>{
  const {w}=await boot('#/training');
  w.LS.store.db().trainings.push({id:'search-vhf-181',title:'VHF preparedness',organizer:'Example',fundingPartner:'UniquePartner181',location:'Kigali',start:'2026-01-01',end:'2026-01-02',attendees:[]});
  w.LS.shell.openPalette();
  const input=w.document.querySelector('#palInput'); input.value='vhf'; input.dispatchEvent(new w.Event('input',{bubbles:true}));
  let found=[...w.document.querySelectorAll('.palette-item')].find(x=>x.textContent.includes('VHF preparedness'));
  ok(!!found,'global search finds an individual training by title');
  if(found){ found.click(); await new Promise(r=>setTimeout(r,800)); ok(w.location.hash.includes('training')&&w.document.querySelector('#trBody').textContent.includes('VHF preparedness'),'training result opens the matching registry'); }
  else ok(false,'training result opens the matching registry');
  w.LS.shell.openPalette(); const input2=w.document.querySelector('#palInput'); input2.value='UniquePartner181'; input2.dispatchEvent(new w.Event('input',{bubbles:true}));
  found=[...w.document.querySelectorAll('.palette-item')].find(x=>x.textContent.includes('VHF preparedness'));
  ok(!!found,'global search finds training funding partner');
  if(found){found.click();await new Promise(r=>setTimeout(r,800));ok(w.document.querySelector('#trBody').textContent.includes('VHF preparedness'),'partner match opens the matching training');}else ok(false,'partner match opens the matching training');
  done('global-search181');
})().catch(e=>{console.error(e);process.exit(1)});
