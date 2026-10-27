const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const doc=w.document;
doc.querySelector('[data-nav="1"]').click(); await new Promise(r=>setTimeout(r,300));
const low=[...doc.querySelectorAll('.cov-cell.low')].map(x=>x.getAttribute('data-tip'));
console.log(low.length); low.slice(0,15).forEach(x=>console.log(' ',x));
process.exit(0);})();
