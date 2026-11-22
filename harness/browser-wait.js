'use strict';
// Playwright's waitForFunction internally uses eval, which the production CSP
// correctly rejects. Evaluate the same predicate directly without changing CSP.
async function waitFor(page,predicate){
 const end=Date.now()+30000;let last;
 while(Date.now()<end){
  try{if(await page.evaluate(predicate))return;}catch(e){last=e;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw new Error('Timed out waiting for browser condition'+(last?': '+last.message:''));
}
module.exports={waitFor};
