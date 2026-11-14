const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/#/roster');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'u1',username:'test',name:'Test manager',role:'Admin'};['auth','landing'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});document.getElementById('app').hidden=false;location.hash='#/roster';LS.shell.route();});
  await page.locator('[data-view="week"]').click();
  const row=page.locator('[data-temperature-row]'); await row.waitFor();
  const result=await page.evaluate(()=>{const r=document.querySelector('[data-temperature-row]');const dates=LS.store.weekDates(LS.store.weekStart(LSU.todayISO()));return {next:r.nextElementSibling.textContent,cells:[...r.querySelectorAll('td')].slice(1).map(x=>x.textContent.trim()),duty:dates.map(d=>LS.store.onDuty(d).filter(x=>x.kind==='day'||x.kind==='daynight').map(x=>x.staff.name))};});
  if(!result.next.includes('Night'))throw Error('monitoring row is not directly above night');
  result.cells.forEach((v,i)=>{if(v!=='—'&&!result.duty[i].some(n=>v.includes(n)))throw Error('monitor not on day duty: '+JSON.stringify({v,duty:result.duty[i]}));});
  const xlsx=await page.evaluate(async()=>{const dates=LS.store.weekDates(LS.store.weekStart(LSU.todayISO()));return await LS.sheets.weeklyXLSX({weekStart:dates[0],dates,services:[],alloc:{},night:{},temperature:{[dates[0]]:'Patrick Test'}}).text();});
  if(!xlsx.includes('Temperature monitoring')||xlsx.indexOf('Temperature monitoring')>xlsx.indexOf('Night Shift')||!xlsx.includes('Patrick Test'))throw Error('XLSX monitoring row missing or misplaced');
  await page.setViewportSize({width:390,height:844}); if(!(await row.isVisible()))throw Error('monitoring row hidden on mobile');
  console.log('Chromium: real roster monitor row precedes night, names are on day duty, visible on mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
