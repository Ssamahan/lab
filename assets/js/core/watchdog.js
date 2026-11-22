/* ============================================================================
   LAB SYSTEMS · WATCHDOG — the last line of defence
   ----------------------------------------------------------------------------
   Deliberately dependent on nothing: if the console's own scripts never arrive —
   a cache with half a build in it, a phone that dropped the connection mid-update —
   this still runs, and it says so instead of leaving a splash turning for ever,
   which is indistinguishable from a site that is down.

   It lives in its own file (not inline in index.html) so the Content-Security-Policy
   can keep every script external: one injected tag becomes an executable threat and
   this file refuses to be one.
   ========================================================================== */
(function(){
  window.setTimeout(function(){
    if(window.__lsBooted) return;
    var boot=document.getElementById('boot');
    if(!boot) return;
    boot.innerHTML='<div style="max-width:440px;text-align:center;padding:24px">'
      +'<div style="font-family:Georgia,serif;font-size:1.4rem;color:#EFE7D6;margin-bottom:8px">The console did not load on this device</div>'
      +'<p style="color:#B9AE99;font-size:12.5px;line-height:1.65;margin:0">A required file did not finish loading. The cause is not yet known. Do not clear browser data or reset the register.</p>'
      +'<div style="display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap">'
        +'<a href="check.html" style="padding:9px 14px;border-radius:8px;background:#0F766E;color:#FFFFFF;font-weight:600;font-size:13px;text-decoration:none">Connection check</a>'
        +'<a href="" style="padding:9px 14px;border-radius:8px;color:#EFE7D6;border:1px solid #4A4335;font-size:13px;text-decoration:none">Reload</a>'
      +'</div></div>';
  },10000);
})();
