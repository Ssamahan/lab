'use strict';
const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
(async()=>{
 const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:700}});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto('http://127.0.0.1:8000/#/roster');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.store&&LS.shell);
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'u1',name:'Test manager',role:'Admin'};['auth','landing'].forEach(id=>{document.getElementById(id).hidden=true;});document.getElementById('app').hidden=false;LS.shell.route();});
  await page.locator('[data-view="grid"]').click();
  await page.locator('[data-cell]').first().click();
  const modal=page.locator('.modal-scrim').last();
  await modal.locator('[data-code="D"]').click();
  await page.waitForTimeout(250);
  const unlocked=await page.evaluate(()=>!document.documentElement.classList.contains('scroll-lock')&&!document.body.classList.contains('scroll-lock')&&getComputedStyle(document.documentElement).overflow!=='hidden'&&getComputedStyle(document.body).overflow!=='hidden');
  if(!unlocked)throw Error('Scroll remains locked after shift save');
  await page.locator('[data-cell]').first().click();
  const review=page.locator('.modal-scrim').last().locator('[data-off-review]');
  if(await review.isVisible())throw Error('Off review appears before selection');
  await page.locator('.modal-scrim').last().locator('[data-off-run="2"]').click();
  if(!await review.isVisible())throw Error('Off review not visible');
  console.log('Chromium mobile: shift save unlocks scrolling; off review displays only after selection.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
