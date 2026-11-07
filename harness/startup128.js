/* Check the user-confirmed v6.9.121 startup scheduling and script order are restored,
   without rolling back the register, private names, or equipment features. */
const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8'),boot=fs.readFileSync('assets/js/core/boot.js','utf8');
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1].split('?')[0]);
const expected=['assets/js/core/icons.js','assets/js/core/seed.js','assets/data/plan-archive.js','assets/js/core/utils.js','assets/js/core/store.js','assets/js/core/ui.js','assets/js/core/charts.js','assets/js/core/sheets.js','assets/js/core/i18n.js','assets/js/core/auth.js','assets/js/core/landing.js','assets/js/core/shell.js','assets/js/core/shared.js','assets/js/core/sync.js','assets/js/core/private-names.js','assets/js/core/boot.js'];
assert.deepEqual(scripts,expected);assert(!html.includes('__lsStyleGate'));assert(!boot.includes('__lsStyleGate'));
assert(boot.includes("if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,60));"));
assert(!/data-boot-style/.test(html));
console.log('✓ v6.9.121 core script order and direct startup scheduling retained');
console.log('✓ no style-gate promise changes startup or stylesheet attributes');
