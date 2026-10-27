const {boot}=require('./env');
(async()=>{const {w}=await boot('#/leave');
const S=w.LS.store, db=S.db();
console.log('FY list', S.leaveFys().join(' '));
(db.leaves||[]).forEach(l=>console.log(l.id, (S.staffById(l.staffId)||{}).name, '|', l.type, l.from,'→',l.to, '| status', l.status, '| fy', l.fy, '| note:', (l.note||'').slice(0,80)));
console.log('\n--- leaveBook for active staff FY 2026/2027 ---');
S.activeStaff().forEach(s=>{ const b=S.leaveBook(s,'2026/2027'); console.log(s.name.padEnd(24), 'ent',b.entitlement.days,'carry',b.carry.days,'taken',b.taken,'planned',b.planned,'bal',b.balance, 'blocks', (b.annual||[]).map(x=>x.from+'..'+x.to).join(',')); });
process.exit(0);})();
