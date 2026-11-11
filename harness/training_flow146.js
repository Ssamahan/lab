const {boot,ok,done}=require('./env');
(async()=>{
  const {w,go,errors}=await boot('#/dash');
  w.LS.sync.stopLive();
  const S=w.LS.store, before=JSON.stringify({staff:S.db().staff,trainings:S.db().trainings});
  await go('#/training');
  const rows=[...w.document.querySelectorAll('.fifo-flow > .list-row')];
  ok(rows.length===S.activeStaff().length,'each active staff member has a queue row');
  ok(rows.every(r=>r.firstElementChild.matches('.fifo-flow-marker[aria-hidden="true"]')&&r.firstElementChild.textContent.trim()===''),'each row has a decorative dot instead of a number');
  ok(rows[0]?.classList.contains('fifo-next'),'next person remains highlighted');
  ok(JSON.stringify({staff:S.db().staff,trainings:S.db().trainings})===before,'display does not alter staff or training records');
  ok(!errors.length,'no application errors',errors.join(' | '));
  done('training_flow146');
})().catch(e=>{console.error(e);process.exit(1)});
