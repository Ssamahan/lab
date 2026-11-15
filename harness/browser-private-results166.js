const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8000/#/dash');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.shell);
  await page.evaluate(()=>{
   LS.sync.stopLive(); LS.auth.user={id:'u1',name:'Test manager',role:'Admin'};
   ['auth','landing'].forEach(id=>document.getElementById(id).hidden=true);
   document.getElementById('app').hidden=false;
   window.__privateTestConnected=true;
   LS.privateNames.connected=()=>window.__privateTestConnected;
   LS.privateNames.referralResults=async()=>[{sample_id:'SYNTHETIC-1',report:{patient_name:'Synthetic Patient',result:'<img src=x onerror=alert(1)>',source:'Test report'}}];
   location.hash='#/samples';
  });
  await page.locator('[data-private-results-open]').click();
  const modal=page.locator('[data-private-results]');
  await modal.getByText('Synthetic Patient',{exact:false}).waitFor();
  if(await modal.locator('img').count())throw Error('Result text was interpreted as HTML');
  if(!(await modal.innerText()).includes('<img src=x onerror=alert(1)>'))throw Error('Result text was not preserved');
  const stored=await page.evaluate(()=>JSON.stringify(localStorage));
  if(stored.includes('Synthetic Patient')||stored.includes('SYNTHETIC-1'))throw Error('Protected result entered local storage');
  await page.evaluate(()=>{window.__privateTestConnected=false;});
  await modal.getByText('Private session ended.',{exact:false}).waitFor();
  if((await modal.innerText()).includes('Synthetic Patient'))throw Error('Expired session still exposes results');
  console.log('Chromium: protected report view escapes data, avoids local storage and clears on session expiry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
