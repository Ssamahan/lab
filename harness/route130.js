/* Route concurrency with stalled module requests; synthetic data only. */
const {boot,ok,done}=require('./env');
const fs=require('fs');
(async()=>{
 const {w}=await boot('#/dash');
 const head=w.document.head, append=head.appendChild.bind(head); let tags=[];
 head.appendChild=function(el){
   if(el.tagName==='SCRIPT' && /\/pbf\.js\?/.test(el.src)){tags.push(el);return el;}
   return append(el);
 };
 const SH=w.LS.shell;
 w.history.replaceState({},'', '#/pbf');
 let a=SH.route(), b=SH.route();
 ok(tags.length===1,'concurrent requests for the same route share one download');
 w.eval(fs.readFileSync('assets/js/modules/pbf.js','utf8'));
 tags[0].onload(); await Promise.all([a,b]);
 ok(w.document.querySelector('#pageInner') && w.document.getElementById('page').dataset.route==='pbf','newest PBF route renders');
 // Simulate a separate route failure after leaving it.
 let late;
 head.appendChild=function(el){ if(el.tagName==='SCRIPT' && /\/quality\.js\?/.test(el.src)){late=el;return el;} return append(el); };
 w.history.replaceState({},'', '#/quality'); const old=SH.route();
 w.history.replaceState({},'', '#/dash'); await SH.route();
 late.onerror(); await old;
 ok(w.document.getElementById('page').dataset.route==='dash' && !w.document.querySelector('[data-retry]'),'stale failed route cannot cover a newer screen');
 ok(!w.document.getElementById('routeGuard'),'old route cannot leave its guard on the new screen');
 done('route130');
})().catch(e=>{console.error(e);process.exit(1)});
