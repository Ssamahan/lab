const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/#/roster');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.store&&LS.shell);
  const dates=await page.evaluate(()=>{
   LS.sync.stopLive(); LS.auth.user={id:'u1',username:'test',name:'Test manager',role:'Admin'};
   ['auth','landing'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;}); document.getElementById('app').hidden=false;
   const S=LS.store, db=S.db(), dates=S.weekDates(S.weekStart(LSU.todayISO())), people=S.activeStaff();
   const jean=people.find(s=>s.name.includes('Jean Paul')), beatrice=people.find(s=>s.name.includes('Beatrice')), kelvin=people.find(s=>s.name.includes('Kelvin'));
   dates.forEach(day=>{const m=day.slice(0,7), days=dates.filter(d=>d.slice(0,7)===m);db.workingPlans[m]={primary:{dates:days,staff:[jean,beatrice,kelvin].map(s=>({id:s.id,name:s.name,codes:days.map(d=>s.id===jean.id?'D':'OFF')}))}};});
   db.holidays=[{date:dates[2],name:'Test holiday'}]; db.leaves=[];
   db.unitRosters[dates[0]]={weekStart:dates[0],assignments:{[dates[0]]:{Reception:jean.name,Phlebotomy:beatrice.name}}};
   location.hash='#/roster'; LS.shell.route(); return dates;
  });
  await page.locator('[data-view="week"]').click();
  for(const surname of ['NSENGIYUMVA','NGEZEKURE']){
   const name=page.locator('[data-wcell] .weekly-name').filter({hasText:surname}).first();
   const a=await name.locator('.pn-g').boundingBox(), b=await name.locator('.pn-s').boundingBox();
   if(!a||!b||b.y<a.y+a.height-1)throw Error(surname+' not on two lines');
  }
  for(const day of [dates[2],dates[5],dates[6]]){
   const cell=page.locator('[data-unit-duty="'+day+'"]');
   if(await cell.getAttribute('rowspan')!=='7'||!(await cell.innerText()).includes('Jean Paul')||(await cell.innerText()).includes('Kelvin'))throw Error('incorrect merged duty: '+day);
  }
  if(await page.locator('table.cal tfoot').innerText().then(t=>t.includes('Day duty')))throw Error('day count row still shown');
  for(const format of ['xlsx','png','pdf']){
   const promise=page.waitForEvent('download'); await page.locator('[data-week-'+format+']').click();
   const download=await promise; await download.saveAs('/tmp/lab164-week.'+format);
   if(fs.statSync('/tmp/lab164-week.'+format).size<1000)throw Error('empty '+format+' download');
  }
  await page.setViewportSize({width:390,height:844});
  if(!(await page.locator('[data-unit-duty="'+dates[5]+'"]').isVisible()))throw Error('weekend duty hidden on mobile');
  if(errors.length)throw Error(errors.join(' | '));
  console.log('Chromium: two-line names, merged holiday and weekend plan duty, no count row, mobile and XLSX/PNG/PDF downloads passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
