const {chromium}=require('playwright-core');
const binary=require('@sparticuz/chromium');
const {mkdtempSync,readFileSync,rmSync}=require('fs');
const {join,resolve,extname}=require('path');
const {tmpdir}=require('os');
const {spawnSync}=require('child_process');
const http=require('http');
(async()=>{
 const root=resolve(__dirname,'..'),dir=mkdtempSync(join(tmpdir(),'lab-preview-browser-'));
 const result=spawnSync(process.execPath,[join(root,'scripts/build-lab-preview.mjs'),dir],{cwd:root,encoding:'utf8'});
 if(result.status!==0)throw Error(result.stderr);
 const policy=readFileSync(join(dir,'_headers'),'utf8').match(/Content-Security-Policy: (.+)/)[1];
 const server=http.createServer((req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname), target=resolve(dir,'.'+(path==='/'?'/index.html':path));
  if(!target.startsWith(dir+'/')){res.writeHead(403).end();return;}
  try{const data=readFileSync(target),type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[extname(target)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Security-Policy':policy});res.end(data);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); let browser;
 try{
  browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args,headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900}}); let external=0;
  await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='127.0.0.1'){external++;return route.abort();}return route.continue();});
  await page.goto('http://127.0.0.1:'+server.address().port+'/#/roster');
  await page.waitForFunction(()=>window.__lsBooted&&window.LS&&LS.store&&LS.shell);
  if(!(await page.locator('[role="status"]').innerText()).includes('live services are blocked'))throw Error('preview warning missing');
  const blocked=await page.evaluate(async()=>{
   const violations=[];document.addEventListener('securitypolicyviolation',e=>violations.push(e.effectiveDirective));
   let rejected=false;try{await fetch('https://lkjwztvhmzhasclmlocx.supabase.co/rest/v1/lab_registers',{method:'POST',body:'{}'});}catch{rejected=true;}
   let workerRejected=false;try{await navigator.serviceWorker.register('/assets/js/core/boot.js');}catch{workerRejected=true;}
   const image=document.createElement('img');image.src='https://lkjwztvhmzhasclmlocx.supabase.co/test';document.body.appendChild(image);
   await new Promise(r=>setTimeout(r,200));return {rejected,workerRejected,violations};
  });
  if(!blocked.rejected||!blocked.workerRejected||!['connect-src','worker-src','img-src'].every(x=>blocked.violations.includes(x))||external)throw Error('preview isolation failed: '+JSON.stringify({blocked,external}));
  await page.evaluate(()=>{LS.sync.stopLive();LS.auth.user={id:'test',username:'test',name:'Test',role:'Admin'};['auth','landing'].forEach(id=>{const e=document.getElementById(id);if(e)e.hidden=true;});document.getElementById('app').hidden=false;LS.shell.route();});
  await page.locator('[data-view="week"]').click();
  if(!await page.locator('[data-temperature-row]').isVisible())throw Error('weekly roster missing');
  await page.setViewportSize({width:390,height:844}); if(!await page.locator('[data-temperature-row]').isVisible())throw Error('weekly roster missing on mobile');
  console.log('Chromium: preview boots, shows warning and roster, and CSP blocks live-database writes, external images and service-worker registration.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
