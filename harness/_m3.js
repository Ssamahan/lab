const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const doc=w.document;
doc.querySelector('[data-nav="1"]').click(); await new Promise(r=>setTimeout(r,250));
for(const v of ['sheet','grid','week','services','fairness']){
  const b=doc.querySelector('[data-view="'+v+'"]'); if(b) b.click(); await new Promise(r=>setTimeout(r,300));
  const app=doc.getElementById('app');
  const html=app.innerHTML;
  const count=s=>(html.match(new RegExp(s,'g'))||[]).length;
  const tbls=doc.querySelectorAll('table').length;
  console.log(v.padEnd(9),'tables',tbls,'| Kelvin',count('Kelvin SAMAHANI'),'| Aurelie',count('Aurelie YANSONEYE'),'| KelvinU',count('Kelvin UWASE'));
  const staffCells=[...doc.querySelectorAll('td.staff-cell .nm')].map(x=>x.textContent);
  if(staffCells.length) console.log('   staff cells:',staffCells.length, JSON.stringify(staffCells));
}
process.exit(0);})();
