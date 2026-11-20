const {boot,ok,done}=require('./env');
(async()=>{
 const {w,go}=await boot('#/samples');w.LS.sync.stopLive();
 const S=w.LS.store, old=S.tatFor;
 S.db().samples=[{id:'a',resultedAt:null},{id:'b',resultedAt:null},{id:'c',resultedAt:null}];
 S.tatFor=s=>s.id==='a'?{started:true,ratio:1.2}:s.id==='b'?{started:true,ratio:.5}:{started:false,ratio:1.5};
 await go('#/samples');
 const chart=w.document.querySelector('#smpPressure');
 ok(!!chart&&chart.querySelectorAll('[data-bar]').length===4,'pressure chart shows all four TAT bands');
 ok(!!chart&&Array.from(chart.querySelectorAll('.reveal')).every(e=>e.classList.contains('in')),'TAT bands are visible after rendering');
 const rows=Array.from(chart.querySelectorAll('.reveal')).map(e=>e.textContent);
 ok(rows[0].includes('1')&&rows[2].includes('1')&&chart.textContent.includes('1 active sample not classified'),'started samples are counted in the correct bands; awaiting reception is not a breach');
 S.tatFor=old;
 done('tat-pressure176');
})().catch(e=>{console.error(e);process.exit(1)});
