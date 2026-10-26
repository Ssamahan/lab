/* Boot the real app in jsdom and hand back a window we can drive.
   Usage:  cd harness && npm i && node sheet.js */
const fs=require('fs'), path=require('path');
const {JSDOM, ResourceLoader, VirtualConsole}=require('jsdom');
const ROOT=path.resolve(__dirname,'..');

class Loader extends ResourceLoader{
  fetch(url){
    const clean=url.replace(/^https?:\/\/[^/]+\//,'').replace(/^\/?lab\//,'').split('?')[0];
    const f=path.join(ROOT, clean);
    return Promise.resolve(fs.existsSync(f)?fs.readFileSync(f):Buffer.from(''));
  }
}
async function boot(hash){
  const errors=[]; const vc=new VirtualConsole();
  vc.on('jsdomError',e=>{ if(!/Not implemented: (navigation|window.scrollTo|window.scroll|window.open)/.test(e.message)) errors.push('jsdom: '+e.message); });
  vc.on('error',(...a)=>errors.push('console.error: '+a.join(' ')));
  const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),{
    url:'http://localhost/'+(hash||''), runScripts:'dangerously', resources:new Loader(),
    pretendToBeVisual:true, virtualConsole:vc });
  const w=dom.window;
  w.matchMedia=w.matchMedia||(()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}));
  w.ResizeObserver=w.ResizeObserver||class{observe(){} unobserve(){} disconnect(){}};
  await new Promise(r=>setTimeout(r,700));
  const ready=()=>w.LSU&&w.LS&&w.LS.auth&&w.LS.shell&&w.document.querySelector('#app h1, #app .page-head h1');
  for(let i=0;i<120 && !ready();i++) await new Promise(r=>setTimeout(r,100));
  if(!ready()) throw new Error('app did not boot: '+errors.join(' | '));
  /* the tests exercise the console, not the sign-in form */
  w.eval("LS.auth.user={id:'u1',username:'kelvin',name:'Kelvin SAMAHANI',role:'Admin'};");
  ['auth','landing'].forEach(id=>{const e=w.document.getElementById(id); if(e) e.hidden=true;});
  const app=w.document.getElementById('app'); if(app) app.hidden=false;
  w.LS.shell.route();
  await new Promise(r=>setTimeout(r,250));
  return {dom,w,errors,go:async(h)=>{ w.location.hash=h; w.LS.shell.route(); await new Promise(r=>setTimeout(r,350)); }};
}
let pass=0, fail=0; const fails=[];
function ok(cond,label,extra){ if(cond){ pass++; console.log('  ✓ '+label); } else { fail++; fails.push(label); console.log('  ✗ '+label+(extra!==undefined?'  → '+extra:'')); } }
function done(name){ console.log('\n'+name+': '+pass+' passed, '+fail+' failed'+(fail?'\n  failed: '+fails.join(' | '):'')); process.exit(fail?1:0); }
module.exports={boot,ok,done};
