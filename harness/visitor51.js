/* v6.9.51 — the visitor's read on a phone in incognito. Three things must hold:
   the message names the key that was refused instead of blaming a trailing space,
   the sign-in is retried with the key as the bearer token, and a register that
   answers a key-only GET is read even when every sign-in route is refused. */
const {boot,ok,done}=require('./env');
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||120));

const REGISTER={id:'main',revision:77,updated_at:'2026-10-28T07:00:00Z',updated_by:'Kelvin SAMAHANI',
  data:{meta:{version:6,seeded:true},samples:[{id:'sm1',sampleId:'BC260101001',patientName:'Confidential',
    test:'Blood Culture',hospital:'CHUK',healthFacility:'Ruli DH',status:'Pending'}],pbfVisits:[]}};

function stubFetch(w, plan){
  const calls=[];
  w.fetch=async(url,opts)=>{
    const u=String(url), h=(opts&&opts.headers)||{}, m=(opts&&opts.method)||'GET';
    calls.push({url:u,method:m,headers:Object.assign({},h)});
    const body=plan(u,h,m);
    const text=typeof body==='string'?body:JSON.stringify(body.data);
    return {ok:body.status>=200&&body.status<300, status:body.status, text:async()=>text, json:async()=>JSON.parse(text)};
  };
  return calls;
}
const signupOK={status:200,data:{access_token:'jwt-abc',refresh_token:'r1',expires_in:3600,user:{id:'anon1'}}};
const keyRefused={status:401,data:{message:'Invalid API key',code:'invalid_api_key'}};

(async()=>{
  const {w}=await boot('#/dash');
  const auth=w.LS.auth, sync=w.LS.sync;
  /* a payload the store accepts: the app's own export, with one sample renamed so the
     test can see the register replace the sample copy */
  const payload=JSON.parse(w.LS.store.exportJSON());
  payload.samples=[{id:'sm1',sampleId:'BC260101001',patientName:'Confidential',test:'Blood Culture',
    hospital:'CHUK',healthFacility:'Ruli DH',status:'Pending'}];
  REGISTER.data=payload;

  /* ── 1. every sign-in refused, but the register answers a key-only GET ── */
  const calls=stubFetch(w,(u,h,m)=>{
    if(/\/auth\/v1\/settings/.test(u)) return {status:200,data:{external:{anonymous_users:true}}};
    if(/\/auth\/v1\/signup/.test(u)) return keyRefused;
    if(/\/rest\/v1\/lab_registers/.test(u)) return {status:200,data:[REGISTER]};
    return {status:404,data:{message:'nope'}};
  });
  auth.enterAsVisitor();
  let res=await sync.visitorRead();
  ok(res.ok===true,'the visitor reads the register even when sign-in is refused',JSON.stringify(res.reason||''));
  ok(res.plain===true,'the strip can say it was read with the key alone');
  ok(w.LS.store.db().samples.some(s=>s.sampleId==='BC260101001'),'the real register replaced the sample copy');

  /* the sign-up was tried twice: apikey only, then the key as bearer */
  const signups=calls.filter(c=>/\/auth\/v1\/signup/.test(c.url));
  ok(signups.length===2,'the sign-in is retried once',signups.length);
  ok(!signups[0].headers.Authorization,'the first attempt carries the key in apikey only');
  ok(/^Bearer sb_publishable_/.test(signups[1].headers.Authorization||''),'the retry carries the key as the bearer token');
  ok(signups.every(c=>/^sb_publishable_/.test(c.headers.apikey||'')),'both attempts still send apikey');

  /* ── 2. the refusal speaks about the real key, not about whitespace ── */
  stubFetch(w,(u)=>{
    if(/\/auth\/v1\/settings/.test(u)) return {status:200,data:{external:{anonymous_users:true}}};
    if(/\/auth\/v1\/signup/.test(u)) return keyRefused;
    if(/\/rest\/v1\/lab_registers/.test(u)) return {status:401,data:{message:'JWT expired'}};
    return {status:404,data:{}};
  });
  res=await sync.visitorRead();
  ok(res.ok===false,'nothing is invented when every route refuses');
  const msg=String(res.reason||'');
  ok(!/trailing space|quote/i.test(msg),'the old trailing-space sentence is gone',msg);
  ok(/publishable|key/i.test(msg)&&/401/.test(msg),'it names the 401 and the key',msg.slice(0,90));
  ok(/sb_publishable_….{0,40}\d+ characters|characters\)/.test(msg)||/characters/.test(msg),
    'it describes the key by shape and length so it can be compared', msg.slice(0,140));
  ok(/supabase\.co/.test(msg),'it names the project the key was sent to');
  ok(w.LS.sync.keyFingerprint('sb_publishable_60QVktnGsJo_RPPzFGtITQ_pt3NC')==='sb_publishable…t3NC (43 characters)',
    'the fingerprint helper trims nothing and counts honestly',
    w.LS.sync.keyFingerprint('sb_publishable_60QVktnGsJo_RPPzFGtITQ_pt3NC'));

  /* ── 3. the bearer retry is enough on its own ─────────────────────── */
  stubFetch(w,(u,h,m)=>{
    if(/\/auth\/v1\/settings/.test(u)) return {status:200,data:{external:{anonymous_users:true}}};
    if(/\/auth\/v1\/signup/.test(u)) return (h&&h.Authorization)?signupOK:keyRefused;
    if(/\/rest\/v1\/lab_registers/.test(u)) return {status:200,data:[REGISTER]};
    return {status:404,data:{}};
  });
  res=await sync.visitorRead();
  ok(res.ok===true&&!res.plain,'a session created by the retry reads the register the ordinary way',JSON.stringify(res));
  ok(res.revision===77,'the revision travels back to the strip');

  done('visitor51');
})();
