const {boot}=require('./env');
(async()=>{const {w}=await boot('#/leave');
const d=w.document;
const rows=[...d.querySelectorAll('.table-card tbody tr')];
rows.slice(0,9).forEach((tr,i)=>{
  const name=tr.querySelector('td')?tr.querySelector('td').textContent.trim().split('\n')[0]:'';
  const chips=[...tr.querySelectorAll('.block-chip')].map(c=>c.textContent.replace(/\s+/g,' ').trim()+' ['+c.dataset.state+']');
  console.log(String(i+1).padStart(2), name.padEnd(26), chips.join('  ||  ')||'—');
});
console.log('\ncarry pills:', [...d.querySelectorAll('.table-card tbody .pill.gold')].map(e=>e.textContent).join(', '));
// timeline tab
const tl=[...d.querySelectorAll('[data-lv-tab]')].find(b=>b.dataset.lvTab==='timeline'); tl.click();
await new Promise(r=>setTimeout(r,300));
console.log('timeline order:', [...d.querySelectorAll('.gantt-label')].map(e=>e.textContent.trim()).join(' | '));
process.exit(0);})();
