const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash');w.LS.sync.stopLive();await go('#/dash');
 const d=w.document,hero=d.querySelector('.hero');
 ok(!!hero&&hero.textContent.includes('Dashboard')&&hero.textContent.includes('FY '),'dashboard shows operational header and fiscal year');
 ok(!!hero&&!/Good (morning|afternoon|evening)|All systems operational/.test(hero.textContent),'dashboard avoids greeting and unverified system status');
 ok(['register','manifest','report'].every(k=>hero.querySelector('[data-hero-'+k+']')),'dashboard toolbar retains all actions');
 await go('#/stock');
 ok(!!d.querySelector('#stkTable')&&!!d.querySelector('[data-pr]')&&!!d.querySelector('[data-receive]'),'stock register and actions remain available');
 ok(d.querySelector('#stockBody').textContent.includes('reconcile'),'stock reconciliation warning remains visible');
 done('design174');
})().catch(e=>{console.error(e);process.exit(1)});
