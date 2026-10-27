const {boot}=require('./env');
(async()=>{const {w}=await boot('#/roster');
const db=w.LS.store.db();
db.staff.forEach(s=>console.log(s.id, JSON.stringify(s.name), '| role:',JSON.stringify(s.role),'| status',s.status,'| join',s.joinDate,'| exit',s.exitDate));
process.exit(0);})();
