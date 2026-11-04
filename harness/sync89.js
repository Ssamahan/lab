/* v6.9.89 — requests #59–62: the register is live on every device, the history is kept
   online, and the public page is drawn on paper.
   The cloud is mocked at the fetch boundary — the same three calls the app makes, with
   the same shapes Supabase returns — so what is tested is the app's own behaviour:
   does a device that has never been set up reach the shared register, does it refuse
   to publish the sample copy over it, does a month survive in the vault, does signing
   in pull immediately. */
const {boot,ok,done}=require('./env');
const fs=require('fs'), path=require('path');
const root=path.resolve(__dirname,'..');
const srcSync=fs.readFileSync(path.join(root,'assets/js/core/sync.js'),'utf8');
const srcShared=fs.readFileSync(path.join(root,'assets/js/core/shared.js'),'utf8');
const srcShell=fs.readFileSync(path.join(root,'assets/js/core/shell.js'),'utf8');
const srcRep=fs.readFileSync(path.join(root,'assets/js/modules/report.js'),'utf8');
const cssLand=fs.readFileSync(path.join(root,'assets/css/landing.css'),'utf8');
const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
const schema=fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8');

/* ——— a Supabase stand-in ————————————————————————————— */
function makeCloud(){
  const log=[];
  const cloud={
    register:null,          // the one row the table holds
    months:{},              // the vault
    calls:log,
    failVault:false
  };
  const json=(status,body)=>({ok:status>=200&&status<300,status,
    json:async()=>body, text:async()=>JSON.stringify(body)});
  cloud.fetch=async(url,opts)=>{
    opts=opts||{};
    const method=(opts.method||'GET').toUpperCase();
    const u=String(url);
    log.push(method+' '+u.replace(/^https:\/\/[^/]+/,''));
    if(u.indexOf('/lab_report_months')>=0){
      if(cloud.failVault) return json(404,{code:'PGRST205',message:'Could not find the table'});
      if(method==='GET') return json(200,Object.keys(cloud.months).sort().map(ym=>
        ({ym,data:cloud.months[ym],updated_at:(cloud.monthTimes&&cloud.monthTimes[ym])||new Date().toISOString(),updated_by:'device'})));
      if(method==='DELETE'){
        const m=/ym=eq\.([^&]+)/.exec(u);
        const ym=m?decodeURIComponent(m[1]):null;
        if(ym&&cloud.months[ym]!==undefined){ delete cloud.months[ym]; log.push('vault delete '+ym); return json(204,null); }
        return json(204,null);
      }
      const rows=JSON.parse(opts.body||'[]');
      rows.forEach(r=>{ cloud.months[r.ym]=r.data; });
      return json(201,[]);
    }
    if(u.indexOf('/lab_registers')>=0){
      if(method==='GET'){
        const lean=/select=revision,updated_at/.test(u);
        const row=cloud.register?[lean?{revision:cloud.register.revision,updated_at:cloud.register.updated_at,
          client_id:cloud.register.client_id,updated_by:cloud.register.updated_by}:cloud.register]:[];
        return json(200,row);
      }
      const rows=JSON.parse(opts.body||'[]');
      const r=rows[0]||{};
      cloud.register={id:'ruli-dh', data:r.data, revision:(cloud.register?cloud.register.revision+1:1),
        updated_at:new Date().toISOString(), client_id:r.client_id, updated_by:r.updated_by};
      return json(201,[cloud.register]);
    }
    return json(404,{message:'no such path'});
  };
  return cloud;
}
const tick=n=>new Promise(r=>setTimeout(r,n||120));

(async()=>{
  /* ── 1 · the public page, on paper ───────────────────────────────────── */
  const first=await boot('#/dash');
  {
    const {w}=first, d=w.document;
    const land=d.querySelector('.landing');
    land.hidden=false;
    const cs=w.getComputedStyle(land);
    ok(cs.getPropertyValue('--bg').trim()==='#F7F5EF','the public page is drawn on a light ground',cs.getPropertyValue('--bg'));
    ok(/^#1/.test(cs.getPropertyValue('--text-strong').trim()),'with near-black text on it',cs.getPropertyValue('--text-strong'));
    ok(cs.getPropertyValue('--surface').trim()==='#FFFFFF','and white cards',cs.getPropertyValue('--surface'));
    const gold=cs.getPropertyValue('--gold').trim();
    ok(gold==='#8C6E29','the gold is darkened so it reads on white',gold);
    ok(!/--bg:#F7F5EF/.test(fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8')),
       'and the console behind it keeps its own palette');
    ok(!!d.querySelector('.land-hero .land-lab'),'the empty half of the hero carries the glassware');
    ok(d.querySelectorAll('.land-glass path').length>=18,'the bench is drawn, not a photograph ('+d.querySelectorAll('.land-glass path').length+' paths)');
    ok(d.querySelectorAll('.land-glass circle').length>=8,'flask, round-bottom flask and bubbles');
    ok(/land-bubbles/.test(indexHtml)&&/land-bubbles circle\{animation:labRise/.test(cssLand),'and the bubbles rise');
    ok(/prefers-reduced-motion:reduce\)\{\s*\.land-bubbles circle\{animation:none\}/.test(cssLand),'unless the reader asked for stillness');
    ok(/@media \(max-width:1020px\)[\s\S]{0,220}\.land-lab\{/.test(cssLand),'and on a phone the bench moves above the headline');

    /* ── 2 · the register is configured out of the box ───────────────── */
    const SY=w.LS.sync;
    const c=SY.config();
    ok(SY.configured()===true,'a device with no settings at all is still connected');
    ok(c.source==='deployment','because the deployment carries the project coordinates',c.source);
    ok(c.mode==='push-pull','and a laboratory device both pushes and pulls',c.mode);
    ok(c.live===true,'with the live loop on');
    ok(/supabase\.co$/.test(c.url.replace(/\/$/,'')),'pointed at the project origin, with no path',c.url);
    ok(/^sb_publishable_/.test(c.key),'and the publishable key, never the secret one');
    ok(/device:\s*\{[\s\S]{0,120}mode:\s*'push-pull'/.test(srcShared),'the coordinates are declared in shared.js');
    ok(!/key:\s*'sb_secret_/.test(srcShared)&&!/key:\s*'sb_secret_/.test(srcSync),'no secret key is anywhere in the build');
  }

  /* ── 3 · a fresh device pulls the live register at boot ────────────── */
  const cloud=makeCloud();
  {
    const {w,go}=await boot('#/dash',{seed(win){
      win.fetch=(u,o)=>cloud.fetch(u,o);
    }});
    const S=w.LS.store, SY=w.LS.sync;
    /* the cloud is given a register that is plainly not the sample one */
    const seedDb=JSON.parse(JSON.stringify(w.LS_SEED));
    seedDb.meta=seedDb.meta||{}; seedDb.meta.cloudMarker=true;
    seedDb.settings=seedDb.settings||{}; seedDb.settings.phone='0788 000 111';
    cloud.register={id:'ruli-dh', data:seedDb, revision:7, updated_at:new Date().toISOString(),
      client_id:'dev-other', updated_by:'Kelvin SAMAHANI'};

    const r=await SY.sync({auto:true,quiet:true});
    ok(r.ok&&r.action==='pulled','a device that has never synced takes the cloud copy',JSON.stringify(r));
    ok(S.db().meta.cloudMarker===true,'and it is the register the laboratory actually keeps');
    ok(S.db().settings.phone==='0788 000 111','not the sample one — the phone number came with it');
    ok(cloud.calls.some(x=>/^GET .*lab_registers\?id=eq\.ruli-dh/.test(x)),'the pull asked the table for the row');
    ok(SY.state().lastRevision===7,'and the revision is remembered, so the next check is one small request');

    /* ── 4 · a paid-for change goes up, and comes back down ──────────── */
    await go('#/dash'); await tick(200);
    w.eval("LS.store.commit(db=>{ db.settings.phone='0788 222 333'; },{action:'test.edit',entity:'settings'});");
    const pushed=await SY.sync({auto:true,quiet:true});
    ok(pushed.ok&&(pushed.action==='pushed'||pushed.action==='noop'),'a change on this device is published',JSON.stringify(pushed));
    ok(cloud.register.data.settings.phone==='0788 222 333','the cloud now holds the change');
    ok(cloud.register.updated_by&&cloud.register.updated_by.length>0,'and records who made it',cloud.register.updated_by);

    /* the other device sees it */
    cloud.register.data.settings.phone='0788 999 000';
    cloud.register.revision+=1;
    const back=await SY.sync({auto:true,quiet:true});
    ok(back.action==='pulled','and a change made elsewhere is pulled down',JSON.stringify(back));
    ok(S.db().settings.phone==='0788 999 000','with the value intact');
  }

  /* ── 5 · the sample register is never published over a real cloud ──── */
  {
    const cloud2=makeCloud();
    let reachable=false;                    /* the cloud is out of reach while we boot */
    const {w}=await boot('#/dash',{seed(win){ win.fetch=(u,o)=>reachable?cloud2.fetch(u,o):Promise.reject(new Error('offline')); }});
    const S=w.LS.store, SY=w.LS.sync;
    ok(!SY.state().lastPullAt&&!SY.state().lastPushAt,'a device that has never exchanged anything with the cloud says so');
    reachable=true;
    const seedDb=JSON.parse(JSON.stringify(w.LS_SEED)); seedDb.meta=seedDb.meta||{}; seedDb.meta.cloudMarker=true;
    cloud2.register={id:'ruli-dh',data:seedDb,revision:3,updated_at:new Date().toISOString(),client_id:'x',updated_by:'Kelvin'};
    let threw=null;
    try{ await SY.push(); }catch(e){ threw=e.message; }
    ok(!!threw&&/sample register|never/i.test(threw),'publishing it over the real copy is refused, with a reason',threw);
    ok(cloud2.register.data.meta.cloudMarker===true,'and the cloud copy is untouched');
    /* a real edit endorses the register, and then it may publish */
    w.eval("LS.store.commit(db=>{ db.settings.phone='0788 111 222'; },{action:'test.edit',entity:'settings'});");
    ok(w.LS.store.db().settings.phone==='0788 111 222','and a real edit is kept, not discarded');
  }

  /* ── 6 · the months, kept online for good ─────────────────────────── */
  {
    const cloud3=makeCloud();
    const {w,go}=await boot('#/reports',{seed(win){ win.fetch=(u,o)=>cloud3.fetch(u,o); }});
    const S=w.LS.store, SY=w.LS.sync, d=w.document;
    /* two past months, as the workbook import leaves them */
    w.eval("LS.store.reportImportMonth('2024-10',{'x64':{total:1180}},{meta:{source:'sheet Oct 2024'}});"+
           "LS.store.reportImportMonth('2024-11',{'x64':{total:1240}},{meta:{source:'sheet Nov 2024'}});");
    ok(S.reportMonths().length>=2,'the device holds past months');
    const up=await SY.vaultPushAll();
    ok(up.ok&&up.done===S.reportMonths().length,'every month is written to the vault, one row each',JSON.stringify(up));
    ok(Object.keys(cloud3.months).length===S.reportMonths().length,'and the table holds them all ('+Object.keys(cloud3.months).length+')');
    ok(cloud3.months['2024-10']&&cloud3.months['2024-10'].values.x64.total===1180,'a saved month keeps its figures');
    ok(SY.vaultStatus().months===up.done,'the device remembers how many are online');

    /* a new phone: same cloud, nothing local */
    const fresh=makeCloud();
    fresh.months=JSON.parse(JSON.stringify(cloud3.months));
    fresh.monthTimes={};
    let online=false;
    const {w:w2}=await boot('#/reports',{seed(win){ win.fetch=(u,o)=>online?fresh.fetch(u,o):Promise.reject(new Error('offline')); }});
    const S2=w2.LS.store, SY2=w2.LS.sync;
    ok(S2.reportMonths().indexOf('2024-10')<0,'a new device starts without them');
    online=true;
    const merged=await SY2.vaultMerge();
    ok(merged.ok&&merged.added>=2,'pressing Fetch restores them from the online record',JSON.stringify(merged));
    ok(S2.reportMonths().indexOf('2024-10')>=0&&S2.reportMonths().indexOf('2024-11')>=0,'both months are on the new device');
    ok(S2.reportSummary('2024-10').lines.find(r=>r.id==='x64').total===1180,'with their figures, not a blank form');
    const again=await SY2.vaultMerge();
    ok(again.added===0,'and fetching twice does not duplicate anything');

    /* a month edited here and saved online is not clobbered by an older copy */
    const older=JSON.parse(JSON.stringify(cloud3.months['2024-10']));
    older.values.x64.total=999;
    fresh.months['2024-10']=older;
    fresh.monthTimes['2024-10']=new Date(Date.now()-86400e3).toISOString();
    w2.eval("LS.store.reportImportMonth('2024-10',{'x64':{total:1300}},{});");
    const keep=await SY2.vaultMerge();
    ok(S2.reportMonth('2024-10').values.x64.total===1300,'a newer local month is not replaced by an older online one');
    ok(keep.ok,'and the fetch still reports success');

    /* a vault that does not exist yet says exactly that */
    const missing=makeCloud(); missing.failVault=true;
    const {w:w3}=await boot('#/reports',{seed(win){ win.fetch=(u,o)=>missing.fetch(u,o); }});
    const res=await w3.LS.sync.vaultPushAll();
    ok(res.tableMissing===true,'a missing vault table is named as such, not reported as a generic failure',JSON.stringify(res));
  }

  /* ── 7 · the card on the page ─────────────────────────────────────── */
  {
    const cloud4=makeCloud();
    const {w,go}=await boot('#/reports',{seed(win){ win.fetch=(u,o)=>cloud4.fetch(u,o); }});
    const d=w.document, page=d.querySelector('#app');
    await go('#/reports'); await tick(400);
    page.querySelector('.rep-tab[data-tab="analysis"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    await tick(400);
    const card=page.querySelector('.rep-vault');
    ok(!!card,'the history card is on the analysis tab');
    ok(/Keep the history online/i.test(card.textContent),'it is called what it does');
    ok(!!page.querySelector('[data-vault-save]')&&!!page.querySelector('[data-vault-pull]'),'with Save online and Fetch');
    page.querySelector('[data-vault-save]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    await tick(600);
    ok(Object.keys(cloud4.months).length>=1,'pressing it writes the months to the vault');

    /* and loading a workbook publishes them without being asked */
    ok(/vaultPushAll\(\)\.then/.test(srcRep),'a workbook import publishes the months straight away, once');
  }

  /* ── 8 · signing in is the moment the register arrives ────────────── */
  {
    ok(/SY\.onSession=async function/.test(srcSync),'there is one call that pulls, starts the loop and fetches the months');
    ok(/LS\.sync\.onSession\(\)/.test(srcShell),'and the shell makes it the first thing after sign-in');
    ok(/SY\.startLive\(\);\s*SY\.sync\(\{auto:true, quiet:true\}\)\.then\(\(\)=>SY\.vaultMerge\(\)/.test(srcSync),
       'a tab that is opened also catches up on both, in one go');
    const cloud5=makeCloud();
    const {w}=await boot('#/dash',{seed(win){ win.fetch=(u,o)=>cloud5.fetch(u,o); }});
    const S=w.LS.store;
    const seedDb=JSON.parse(JSON.stringify(w.LS_SEED)); seedDb.meta=seedDb.meta||{}; seedDb.meta.cloudMarker=true;
    cloud5.register={id:'ruli-dh',data:seedDb,revision:11,updated_at:new Date().toISOString(),client_id:'x',updated_by:'Kelvin'};
    cloud5.months['2024-10']={month:'2024-10',meta:{source:'vault'},values:{x64:{total:1180}},blood:{},notes:''};
    const res=await w.LS.sync.onSession();
    ok(res.ok===true,'after sign-in the call succeeds');
    ok(res.sync&&res.sync.action==='pulled','the register is pulled at that moment',JSON.stringify(res.sync));
    ok(res.vault&&res.vault.ok,'and the online months are brought in');
    ok(S.reportMonths().indexOf('2024-10')>=0,'so the month is on the device before the person looks for it');
  }

  /* ── 9 · the schema the app expects is the schema in the repo ─────── */
  {
    ok(/create table if not exists public\.lab_report_months/.test(schema),
       'supabase/schema.sql declares the month vault');
    ok(/lab_register_history/.test(schema)||/keep_lab_register_version/.test(schema),
       'and keeps a version of the register before every write');
  }

  done('sync89');
})();
