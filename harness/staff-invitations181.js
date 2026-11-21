const assert=require('node:assert/strict');
const {invite}=require('../scripts/staff-invitations.cjs');
const ADMIN='11111111-1111-4111-8111-111111111111';
function gateway(role='Admin'){
  const calls=[];
  return {calls,verify:async token=>{calls.push('verify'); return token==='valid'?{id:ADMIN,anonymous:false}:null;},role:async()=>{calls.push('role');return role;},send:async(email,redirect)=>{calls.push('send');return {id:'22222222-2222-4222-8222-222222222222'};},assign:async(id,role,actor)=>{calls.push('assign');return true;}};
}
(async()=>{
  let g=gateway(); let r=await invite({token:'bad',email:'person@example.org',role:'Viewer'},g);
  assert.equal(r.code,'unauthorized');assert.deepEqual(g.calls,['verify']);
  g=gateway('Viewer');r=await invite({token:'valid',email:'person@example.org',role:'Viewer'},g);assert.equal(r.code,'forbidden');assert.deepEqual(g.calls,['verify','role']);
  g=gateway();r=await invite({token:'valid',email:'person@example.org',role:'Admin'},g);assert.equal(r.code,'invalid');assert(!g.calls.includes('send'));
  g=gateway();r=await invite({token:'valid',email:'bad\n@example.org',role:'Viewer'},g);assert.equal(r.code,'invalid');assert(!g.calls.includes('send'));
  g=gateway();r=await invite({token:'valid',email:'Person@Example.org',role:'Reviewer'},g);assert.equal(r.code,'sent');assert.deepEqual(g.calls,['verify','role','send','assign']);
  g=gateway();g.assign=async()=>false;r=await invite({token:'valid',email:'person@example.org',role:'Viewer'},g);assert.equal(r.code,'assignment_failed');
  g=gateway();g.send=async()=>{throw Error('secret');};r=await invite({token:'valid',email:'person@example.org',role:'Viewer'},g);assert.equal(r.code,'send_failed');assert(!JSON.stringify(r).includes('secret'));
  g=gateway();g.verify=async()=>({id:ADMIN,anonymous:true});r=await invite({token:'valid',email:'person@example.org',role:'Viewer'},g);assert.equal(r.code,'unauthorized');assert(!g.calls.includes('send'));
  g=gateway();g.send=async()=>({id:ADMIN});r=await invite({token:'valid',email:'person@example.org',role:'Viewer'},g);assert.equal(r.code,'send_failed');assert(!g.calls.includes('assign'));
  console.log('staff-invitations181: unauthorized, role, validation, send and fail-closed cases passed');
})().catch(e=>{console.error(e);process.exit(1)});
