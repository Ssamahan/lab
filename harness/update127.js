/* Simulated worker takeover must not reload a device or disturb unfinished work. */
const {boot,ok,done}=require('./env');let changed;
(async()=>{
 const {w,errors}=await boot('#/dash',{seed(win){
  Object.defineProperty(win.navigator,'serviceWorker',{configurable:true,value:{controller:{postMessage(){}},addEventListener(name,fn){if(name==='controllerchange')changed=fn;},register:async()=>({update(){},addEventListener(){}})}});
 }});
 const S=w.LS.store;S.commit(d=>{d.settings.testUpdate='kept';},{action:'test',entity:'settings',entityId:'synthetic'});
 const pending=S.pendingChanges();
 w.LS.ui.modal({title:'Unfinished form',body:'<input id="unsaved" value="still here">'});
 changed();await new Promise(r=>setTimeout(r,1000));
 ok(w.document.querySelector('#unsaved').value==='still here','worker takeover leaves unfinished form intact');
 ok(S.pendingChanges()===pending&&S.db().settings.testUpdate==='kept','worker takeover preserves local data and pending count');
 ok(!errors.length,'worker takeover produces no browser error',errors.join(' | '));
 done('update127');
})().catch(e=>{console.error(e);process.exit(1)});
