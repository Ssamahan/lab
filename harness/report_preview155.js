const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/dash');w.LS.sync.stopLive();await go('#/reports');
 const S=w.LS.store,d=w.document;const pages=w.LS.sheets.reportSheets(S.reportSummary('2026-10'));
 d.querySelector('[data-export]').click();await new Promise(r=>setTimeout(r,200));
 const preview=d.querySelector('.rep-exp-preview');
 ok(!!preview&&preview.querySelectorAll('svg').length===pages.length,'preview contains every page');
 ok(preview.textContent.includes('Page '+pages.length+' of '+pages.length),'last page is labeled');
 ok(preview.textContent.includes('Francois Xavier NTAMUGABUMWE')&&preview.textContent.includes('Kelvin SAMAHANI'),'preview shows both signatories on the last page');
 ok(!!d.querySelector('[data-fmt="pdf"]')&&!!d.querySelector('[data-fmt="png"]'),'PDF and PNG download options remain available');
 done('report_preview155');
})().catch(e=>{console.error(e);process.exit(1)});
