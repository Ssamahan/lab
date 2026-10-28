const {boot}=require('./env');
(async()=>{const {w}=await boot('#/dash');
const S=w.LS.store;
(S.db().pbf||[]).forEach(r=>console.log(JSON.stringify(r)));
process.exit(0);})();
