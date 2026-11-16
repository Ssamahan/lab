const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  await page.goto('http://127.0.0.1:8000/');await page.waitForFunction(()=>window.__lsBooted);await page.locator('#landEnter').click();await page.waitForFunction(()=>window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{
   LS.sync.stopLive();LS.auth.user={id:'test',name:'Test manager',role:'Admin'};
   const db=LS.store.db();db.incidents=[{id:'old',ref:'NC-2026-041',title:'Edited system example',severity:'Major',status:'Open',evidence:'metadata'},{id:'real',ref:'NC-2026-046',title:'Real test finding',severity:'Minor',status:'Open',opened:'2026-10-01',due:'2026-11-01'}];
   db.sops=[{id:'old',code:'SOP-LAB-001',title:'Edited system SOP',history:[{}]},{id:'real',code:'RliDHL-ADM-SOP-002',title:'Real test SOP',review:'2027-04-12'}];location.hash='#/quality?tab=incidents';
  });
  await page.getByText('Real test finding').waitFor();if(await page.getByText('Edited system example').count())throw Error('Example incident visible');
  await page.evaluate(()=>{location.hash='#/quality?tab=sops';});await page.getByText('Real test SOP').waitFor();
  if(await page.getByText('Edited system SOP').count())throw Error('Example SOP visible');
  if(await page.locator('[data-register-row]').count()!==70)throw Error('Drive register missing');
  const intact=await page.evaluate(()=>LS.store.db().incidents.length===2&&LS.store.db().sops.length===2);if(!intact)throw Error('Underlying records removed');
  console.log('Chromium: identified examples hidden, real records and Drive register retained; editor role simulated.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
