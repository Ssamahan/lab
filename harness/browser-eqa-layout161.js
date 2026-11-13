const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/#/dash');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.store&&LS.shell);
  await page.waitForTimeout(100);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'u1',username:'test',name:'Test manager',role:'Admin'};['auth','landing'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});document.getElementById('app').hidden=false;LS.store.commit(db=>{db.eqa=[{id:'x',program:'Hematology',code:'Q3 2025/26',scoring:'SD',analytes:{WBC:-1}},{id:'p',program:'Hematology',code:'Q1 2026/27',scoring:'SD',stage:'awaiting',analytes:{}}];},{action:'test'});location.hash='#/eqa?tab=sd';LS.shell.route();});
  const chart=page.locator('.sd-trend-chart'),table=page.locator('.sd-trend-results');await chart.waitFor();await page.waitForTimeout(500);
  let a=await chart.boundingBox(),b=await table.boundingBox();if(!(b.x>=a.x+a.width-1&&Math.abs(a.y-b.y)<2))throw Error('table is not to the right on desktop: '+JSON.stringify({a,b,layout:await page.locator('.sd-trend-layout').evaluate(e=>({width:e.clientWidth,columns:getComputedStyle(e).gridTemplateColumns}))}));
  if(!(await table.innerText()).includes('-1.00'))throw Error('recorded result missing');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);a=await chart.boundingBox();b=await table.boundingBox();if(!a||!b)throw Error('layout hidden after resize: '+JSON.stringify(await page.evaluate(()=>{const el=document.querySelector('.sd-trend-layout');return {appHidden:document.querySelector('#app').hidden,authHidden:document.querySelector('#auth').hidden,html:el&&el.closest('.page').outerHTML.slice(0,200),hash:location.hash};})));if(!(b.y>=a.y+a.height-1))throw Error('table does not stack on narrow screens');
  console.log('Chromium: table is right of graph on desktop, readable result present, and stacks on mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
