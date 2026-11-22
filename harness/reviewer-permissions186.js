'use strict';
const assert=require('node:assert/strict');
const {boot}=require('./env');
(async()=>{
 const {w,dom}=await boot('#/roster');
 try{
  const auth=w.LS.auth,store=w.LS.store;
  auth.user={id:'review-test',name:'Reviewer',role:'Reviewer'};
  assert.equal(auth.can('edit'),false,'reviewers must not have general edit permission');
  assert.equal(auth.can('approve'),false,'unlisted approvals are denied');
  assert.equal(auth.can('revenue'),false);
  assert.equal(auth.can('security'),false);
  assert.equal(auth.can('roster_generate'),true);
  const before=store.pendingChanges(),old=JSON.stringify(store.db().equipment);
  const denied=store.commit(d=>{d.equipment=[];},{action:'equipment.remove',entity:'equipment'});
  assert.equal(denied,false);assert.equal(JSON.stringify(store.db().equipment),old);
  assert.equal(store.pendingChanges(),before,'denied edits must not enter sync queue');
  const month='2099-01';
  store.commit(d=>{d.workingPlans[month]={primary:{staff:[],dates:[]},versions:[]};},
    {action:'roster.generate',entity:'workingPlans',entityId:month});
  assert(store.db().workingPlans[month],'reviewer can generate a plan locally');
  assert.equal(store.pendingChanges(),before+1);
  const wrong=store.commit(d=>{d.trainingExpenses=[];},{action:'roster.generate',entity:'trainingExpenses'});
  assert.equal(wrong,false,'generation action must name the expected entity');
  auth.user={id:'manager-test',name:'Manager',role:'Manager'};
  assert.equal(auth.can('revenue'),false,'training revenue is admin only');
  console.log('reviewer-permissions186: local reviewer guards restrict edits and allow roster generation');
 }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
