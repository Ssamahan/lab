const {boot}=require('./env');
(async()=>{const {w,go}=await boot('#/dash');
const S=w.LS.store;
console.log('meta.pbfRealV67', S.db().meta.pbfRealV67, 'visits', (S.db().pbfVisits||[]).length);
await go('#/pbf'); await new Promise(r=>setTimeout(r,500));
console.log('after render: meta.pbfRealV67', S.db().meta.pbfRealV67, 'visits', (S.db().pbfVisits||[]).length,
 'legacy pbf', (S.db().pbf||[]).length);
console.log('BASELINE centres present in legacy?', (S.db().pbf||[]).map(r=>r.name).join(','));
const v=(S.db().pbfVisits||[]);
console.log(JSON.stringify(v.slice(0,2)));
process.exit(0);})();
