const {boot}=require('./env');
(async()=>{const {w}=await boot('#/leave');
const S=w.LS.store;
const p=S.activeStaff().find(s=>/Patrick/.test(s.name));
console.log('rowsFor 2025/2026', S.leaveRowsFor(p,'2025/2026').map(l=>[l.id,l.type,l.from,l.to]));
console.log('carry', JSON.stringify(S.leaveCarryOver(p,'2026/2027')));
console.log('ent', JSON.stringify(S.leaveEntitlement(p,'2025/2026')));
process.exit(0);})();
