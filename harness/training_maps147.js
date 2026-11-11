const fs=require('fs');const {boot,ok,done}=require('./env');const wait=(n=400)=>new Promise(r=>setTimeout(r,n));const click=e=>e.dispatchEvent(new e.ownerDocument.defaultView.MouseEvent('click',{bubbles:true,cancelable:true}));
(async()=>{
 const {w,go,errors}=await boot('#/dash');w.LS.sync.stopLive();const U=w.LSU,S=w.LS.store,d=w.document;
 const geometry=JSON.parse(fs.readFileSync('assets/data/rwanda-districts.geojson','utf8'));
 w.fetch=async url=>{if(String(url).includes('rwanda-districts.geojson'))return {ok:true,json:async()=>geometry};throw Error('Offline');};
 await go('#/training');let btn=d.querySelector('[data-flow-download]');ok(!!btn,'flow has download action');ok(!d.querySelector('[data-training-map]'),'venue map moved from training');
 click(btn);await wait(40);let saved;U.download=(name,blob)=>{saved={name,blob};};click(d.querySelector('[data-flow-format="svg"]'));await wait(50);ok(saved&&saved.name.endsWith('.svg'),'SVG flow downloads');const svg=await new Promise(resolve=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.readAsText(saved.blob);});ok(svg.includes('Training queue')&&svg.includes('Patrick')&&svg.includes('<circle'),'download contains flow and queue names');
 await go('#/revenue');await wait(500);ok(!!d.querySelector('[data-training-map]'),'venue map appears in Training Revenue');ok(!!d.querySelector('[data-district-map] svg'),'district map appears in Training Revenue');
 const map=w.LS.trainingMaps;const summary=map.districtSummary([
 {location:'Kigali',start:'2020-01-01'}, {location:'Gasabo District',start:'2020-01-01'}, {location:'Nyamata',start:'2020-01-01'}, {location:'Bugesera District',start:'2020-01-01'}, {location:'Ruli DH',start:'2020-01-01'}, {location:'Unknown',start:'2020-01-01'}, {location:'Musanze',start:'2099-01-01'}, {location:'Gakenke and Musanze',start:'2020-01-01'}, {location:'Kigali'}], '2026-10-20');
 ok(summary.counts.Kigali===2&&summary.counts.Bugesera===2&&summary.counts.Gakenke===1,'groups Kigali, Nyamata and Ruli correctly');ok(summary.unknown.length===3&&summary.upcoming===1,'ambiguous or missing locations and dates remain unassigned; future excluded');
 const graphic=map.districtSVG(geometry,summary);ok(geometry.features.length===30&&graphic.includes('marker-end="url(#district-arrow)"')&&graphic.includes('Kigali: 2'),'districts and one-way arrows render with counts');
 const before=JSON.stringify(S.db().trainings);await go('#/revenue');await wait();ok(JSON.stringify(S.db().trainings)===before,'map does not modify training records');ok(!errors.length,'no application errors',errors.join(' | '));done('training_maps147');
})().catch(e=>{console.error(e);process.exit(1)});
