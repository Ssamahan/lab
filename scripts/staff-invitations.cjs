'use strict';

// This orchestration is not an HTTP endpoint: the gateway must verify tokens and
// enforce membership in trusted server-side storage before this can be deployed.
const ROLES=new Set(['Viewer','Reviewer','Technologist','Manager']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
async function invite(input,gateway){
  const token=typeof input?.token==='string'?input.token:'';
  if(!token) return {code:'unauthorized'};
  let actor;
  try{actor=await gateway.verify(token);}catch(_){return {code:'unauthorized'};}
  if(!actor||actor.anonymous||!UUID.test(actor.id||'')) return {code:'unauthorized'};
  let role;
  try{role=await gateway.role(actor.id);}catch(_){return {code:'forbidden'};}
  if(role!=='Admin') return {code:'forbidden'};
  const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
  if(email.length>254||!EMAIL.test(email)||!ROLES.has(input.role)) return {code:'invalid'};
  // An existing administrator cannot be re-invited as another role. Check
  // before sending mail, not after delivery or membership modification.
  if(typeof actor.email==='string'&&actor.email.trim().toLowerCase()===email) return {code:'self_invite'};
  let person;
  try{person=await gateway.send(email);}catch(_){return {code:'send_failed'};}
  if(!person||!UUID.test(person.id||'')||person.id===actor.id) return {code:'send_failed'};
  // Failure here must leave the new identity without access; delivery may already
  // have happened, so the caller must not claim the invitation was fully provisioned.
  try{if(!await gateway.assign(person.id,input.role,actor.id)) return {code:'assignment_failed'};}
  catch(_){return {code:'assignment_failed'};}
  return {code:'sent'};
}
module.exports={invite};
