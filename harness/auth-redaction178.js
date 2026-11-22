/* Auth & visitor redaction — the corrective actions of v6.9.178, exercised in the real
   boot: PBKDF2 sign-in with the rotated credentials, lockout after repeated failures,
   the shared-password refusal, real TOTP enrolment at sign-in, and the redacted
   register a visitor reads. Usage:  cd harness && node auth-redaction178.js */
const {boot, ok, done} = require('./env');
const nodeCrypto = require('crypto');

(async()=>{
  const {w, errors} = await boot('#/dash', {
    seed(win){
      /* jsdom implements getRandomValues but not WebCrypto's subtle interface; the
         password and TOTP paths need it, so the Node runtime's is grafted on. */
      try{
        win.crypto.subtle=nodeCrypto.webcrypto.subtle;
        win.crypto.getRandomValues=nodeCrypto.webcrypto.getRandomValues.bind(nodeCrypto.webcrypto);
      }catch(e){}
    }
  });

  ok(!errors.length || errors.every(e=>/favicon|Not implemented/.test(e)), 'boot without errors', errors.join(' | '));
  ok(!!w.LSC, 'crypto module loaded (assets/js/core/crypto.js)');
  ok(w.eval("LS.auth.users[0].passHash.indexOf('pbkdf2$310000$')===0")===true, 'seeded admin hash is PBKDF2 (310,000 iterations)');
  ok(w.eval("LS.auth.users.every(u=>!u.email)")===true, 'no staff emails ship in the bundle');
  ok(w.eval("LS.auth.users.every(u=>!/^[0-9a-f]{64}$/.test(u.passHash))")===true, 'no legacy single-pass SHA-256 hash is seeded');

  /* ——— sign-in with the rotated password —————————————————————— */
  const login = async(u,p,code)=>JSON.parse(await w.eval(
    `(async()=>JSON.stringify(await LS.auth.login({username:${JSON.stringify(u)},password:${JSON.stringify(p)},code:${JSON.stringify(code||'')}})))()`));
  const res1 = await login('kelvin','gasabo-muyongwe-urwibutaka-24');
  ok(res1.ok===true, 'admin signs in with the rotated password');
  ok(res1.user&&res1.user.role==='Admin', 'session carries the Admin role');

  const res2 = await login('kelvin','wrong-password');
  ok(res2.ok===false && /Incorrect password/.test(res2.reason||''), 'wrong password refused with a reason');

  /* ——— lockout after repeated failures ———————————————————————— */
  await login('aurelie','not-the-password');
  await login('aurelie','not-the-password');
  const res3 = await login('aurelie','not-the-password');
  ok(res3.ok===false && /Too many tries|minute/.test(res3.reason||''), 'third failure starts the escalating lockout', res3.reason);
  const res4 = await login('aurelie','kivu-inyange-coko-67');
  ok(res4.ok===false && /Too many tries/.test(res4.reason||''), 'the real password waits out the lockout too', res4.reason);

  /* ——— one password per account ———————————————————————————————— */
  const shared = JSON.parse(await w.eval(
    `(async()=>JSON.stringify(await LS.auth.setPassword('u2','gasabo-muyongwe-urwibutaka-24')))()`));
  ok(shared.ok===false && /already in use/.test(shared.reason||''), 'a password used by another account is refused', shared.reason);
  const fresh = JSON.parse(await w.eval(
    `(async()=>JSON.stringify(await LS.auth.setPassword('u2','muyongo-wakabaho-31')))()`));
  ok(fresh.ok===true, 'a new unique password is accepted as PBKDF2');

  /* ——— real TOTP enrolment at sign-in ———————————————————————— */
  const je = await login('jeanpaul','intore-rwankuba-teza-59');
  ok(je.needEnroll===true && /^[A-Z2-7]{32}$/.test(je.secret||''), 'two-factor account without a secret is enrolled at sign-in');
  ok((je.otpauth||'').indexOf('otpauth://totp/')===0, 'an otpauth:// URI is offered for the authenticator app');
  const code = await w.eval(`(async()=>window.LSC.totp(${JSON.stringify(je.secret)}))()`);
  const conf = JSON.parse(await w.eval(
    `(async()=>JSON.stringify(await LS.auth.confirmEnrollment({username:'jeanpaul',password:'intore-rwankuba-teza-59',code:${JSON.stringify(String(code))},secret:${JSON.stringify(je.secret)}})))()`));
  ok(conf.ok===true, 'the first live code confirms enrolment and opens the session', (conf||{}).reason);
  ok(w.eval("LS.auth.users[2].twoFactor===true && /^[A-Z2-7]{32}$/.test(LS.auth.users[2].totpSecret||'')")===true, 'the secret is saved with the account record');

  /* ——— the visitor reads a redacted register —————————————————— */
  w.eval("LS.auth.enterAsVisitor()");
  const seen = JSON.parse(await w.eval(`(function(){
    const db=LS.store.db();
    return JSON.stringify({
      staffNames: (db.staff||[]).map(s=>s.name).slice(0,3),
      phones: (db.staff||[]).filter(s=>s.phone).length,
      sampleIds: (db.samples||[]).map(s=>s.sampleId).slice(0,3),
      audit: (db.audit||[]).length,
      loginHistory: (db.loginHistory||[]).length,
      planNames: Object.values(db.workingPlans||{}).flatMap(p=>((p.primary&&p.primary.staff)||[]).map(r=>r.name)).slice(0,3)
    });
  })()`));
  ok(seen.staffNames.every(n=>/^([A-Z]\.\s?)+$/.test(n)), 'staff names are reduced to initials', JSON.stringify(seen.staffNames));
  ok(seen.phones===0, 'staff phone numbers are gone');
  ok(seen.sampleIds.every(id=>/^REF-\d{4}$/.test(id)), 'sample references are opaque', JSON.stringify(seen.sampleIds));
  ok(seen.audit===0 && seen.loginHistory===0, 'the activity feed and sign-in history are dropped');
  ok(seen.planNames.every(n=>/^([A-Z]\.\s?)+$/.test(n)), 'the working plan shows initials only');
  const counts = JSON.parse(await w.eval(`(function(){ const db=LS.store.db(); return JSON.stringify({staff:(db.staff||[]).length, samples:(db.samples||[]).length, eqa:(db.eqa||[]).length}); })()`));
  ok(counts.staff>0 && counts.samples>0, 'counts are untouched — redaction is not invention');

  done('auth-redaction178');
})().catch(e=>{ console.log('  ✗ harness crashed: '+(e&&e.stack||e)); process.exit(1); });
