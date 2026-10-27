const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const doc=w.document;
doc.querySelector('[data-nav="1"]').click(); await new Promise(r=>setTimeout(r,400));
const rows=[...doc.querySelectorAll('.bal-row')];
console.log('balance rows', rows.length);
console.log(rows.slice(0,4).map(r=>r.textContent.replace(/\s+/g,' ')).join('\n'));
process.exit(0);})();
