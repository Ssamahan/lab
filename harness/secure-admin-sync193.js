'use strict';
const assert=require('node:assert/strict');
const {boot}=require('./env');
(async()=>{
 const {dom,w}=await boot('#/dash');const S=w.LS.store,sy=w.LS.sync;
 sy.stopLive();w.fetch=async()=>{throw Error('unexpected network request');};let writes=0, remote={revision:90,data:JSON.parse(JSON.stringify(S.db())),updated_at:'2026-01-01'};
 let writeResult=91,hook=null;
 w.LSAdminTransport={createAdminTransport:()=>({read:async()=>remote,write:async(token,revision,data)=>{writes++;assert.equal(revision,90);if(hook)hook();return writeResult;}})};
 S.commit(d=>{d.settings.testOffline='unsent';});const pending=S.pendingChanges();
 let result=await sy.secureAdminSync('admin-token');
 assert.equal(result.reason,'needs_reconciliation');assert.equal(S.pendingChanges(),pending);assert.equal(writes,0);assert.equal(S.settings().testOffline,'unsent');
 S.clearPending();remote.data=JSON.parse(JSON.stringify(S.db()));remote.data.settings.remoteOnly='different';
 result=await sy.secureAdminSync('admin-token');assert.equal(result.reason,'needs_reconciliation');assert.equal(S.settings().testOffline,'unsent');assert.equal(sy.state().secureBaseRevision,undefined);
 remote.data=JSON.parse(JSON.stringify(S.db()));
 result=await sy.secureAdminSync('admin-token');assert.equal(result.action,'read');assert.equal(sy.state().secureBaseRevision,90);
 S.commit(d=>{d.settings.testOffline='sent';});
 result=await sy.secureAdminSync('admin-token');assert.equal(result.action,'written');assert.equal(writes,1);assert.equal(S.pendingChanges(),0);assert.equal(sy.state().secureBaseRevision,91);
 // An edit during the request must stay queued; the acknowledged revision is still useful.
 sy.setState({secureBaseRevision:90});S.commit(d=>{d.settings.testOffline='first';});
 hook=()=>S.commit(d=>{d.settings.testOffline='later';});writeResult=91;
 result=await sy.secureAdminSync('admin-token');assert.equal(result.action,'written');assert(S.pendingChanges()>0);assert.equal(S.settings().testOffline,'later');
 // A conflict must not clear work or fall back to the anonymous table.
 w.LSAdminTransport.createAdminTransport=()=>({read:async()=>remote,write:async()=>{const e=Error('conflict');e.code='conflict';throw e;}});
 await assert.rejects(sy.secureAdminSync('admin-token'),e=>e.code==='conflict');assert(S.pendingChanges()>0);assert.equal(S.settings().testOffline,'later');
 dom.window.close();console.log('secure-admin-sync193: pre-cutover work held, CAS writes and concurrent edits preserved');
})().catch(e=>{console.error(e);process.exit(1)});
