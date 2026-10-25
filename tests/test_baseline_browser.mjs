// Optional integration suite. All account requests use the synthetic localhost fixture.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow,summarizeMonthlyFlow} from '../prototype/monthly-flow.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.STEADYBEE_TEST_ORIGIN||'http://127.0.0.1:8771';
let server,browser;const errors=[];
before(async()=>{
 if(!process.env.STEADYBEE_TEST_ORIGIN){
  server=spawn(process.execPath,['tests/fixtures/account-server.mjs'],{env:{...process.env,STEADYBEE_TEST_PORT:'8771'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Synthetic server did not start')),15000);server.once('exit',code=>{clearTimeout(timeout);reject(Error(`Synthetic server exited ${code}`));});server.stdout.once('data',()=>{clearTimeout(timeout);resolve();});});
 }
 browser=await pw.chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH,args:['--no-sandbox']});
 await mkdir('test-artifacts',{recursive:true});
});
after(async()=>{await browser?.close();server?.kill();assert.deepEqual(errors,[],'No browser runtime errors');});
async function query(value){return (await fetch(`${origin}/__fixture__/pictures`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:[],orders:[],...value})})).json();}
async function seed({startMonth}={}){
 const id=crypto.randomUUID(),userId=crypto.randomUUID(),picture={version:1,example:false,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:3,retirementYears:{primary:2049,partner:2051}},metric:'income',group:'person',style:'bars',real:true,selectedYear:null}};
 if(startMonth)picture.flow.timelineStartMonth=startMonth;
 await query({op:'insert',value:{id,user_id:userId,name:'Test household',is_main:true,picture,updated_at:'2026-10-25T12:00:00.000Z'}});return {id,userId,picture};
}
async function page(userId,width=1280,example=false){
 const p=await browser.newPage({viewport:{width,height:900}});p.on('pageerror',e=>errors.push(e.message));
 // This suite never contacts a real Supabase account or sends data externally.
 await p.route('**/*',route=>{const url=new URL(route.request().url());return url.origin===origin?route.continue():route.abort();});
 await p.goto(`${origin}/app.html?fixture_user=${userId}${example?'&example=1':''}#assets`);
 await p.locator('#account-button').getByText('Account',{exact:true}).waitFor();
 if(!example)await p.waitForFunction(()=>document.querySelector('#picture-save-status').textContent.includes('Default household'));
 return p;
}
async function saved(p,id,count){
 for(let attempt=0;attempt<100;attempt++){
  const {data}=await query({op:'select',filters:[['id',id]],one:true});
  if(data?.picture.baselines?.entries.length===count)return data.picture;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.fail(`Expected ${count} saved baseline versions; status: ${await p.locator('#picture-save-status').innerText()}`);
}
async function createBaseline(p,name,date){
 await p.locator('#baseline-name').fill(name);await p.locator('#baseline-date').fill(date);await p.locator('#baseline-confirm').check();await p.locator('#baseline-save').click();
 assert.equal(await p.locator('#baseline-error').isVisible(),false);await p.locator('#baseline-saved').waitFor();
}

test('legacy default household gains reviewed baseline versions; current edits and reload preserve frozen history',async()=>{
 const f=await seed(),p=await page(f.userId);assert.equal(await p.locator('#net-worth').innerText(),'£269,500');
 await p.locator('#baseline-manage').click();await createBaseline(p,'Starting plan','2026-10-01');
 assert.match(await p.locator('#baseline-status').innerText(),/v1/);const first=await saved(p,f.id,1),baseline=first.baselines.entries[0];
 await p.locator('#baseline-close').click();
 await p.getByRole('button',{name:'Edit Sam Workplace pension, £48,000',exact:true}).click();
 await p.getByLabel('Current value',{exact:true}).fill('60000');await p.locator('#save-item-button').click();
 await p.waitForFunction(()=>document.querySelector('#net-worth').textContent==='£281,500');
 await p.locator('#baseline-manage').click();await p.locator('#baseline-update').click();await createBaseline(p,'Next review','2027-01-01');
 assert.match(await p.locator('#baseline-version-context').innerText(),/Scheduled/);assert.match(await p.locator('#baseline-status').innerText(),/v1/);
 const second=await saved(p,f.id,2);assert.deepEqual(second.baselines.entries[0],baseline);assert.equal(second.holdings.assets.find(a=>a.id==='demo-sam-pension').value,60000);
 await p.locator('#baseline-close').click();await p.reload();await p.waitForFunction(()=>document.querySelector('#net-worth').textContent==='£281,500');
 await p.locator('#baseline-manage').click();assert.equal(await p.locator('#baseline-version option').count(),2);
 await p.locator('#baseline-version').selectOption(baseline.id);assert.match(await p.locator('#baseline-saved-summary').innerText(),/269,500/);
 await p.getByText('Saved forecast & assumptions',{exact:true}).click();assert.ok(await p.locator('#baseline-forecast-rows tr').count()>0);
 await p.screenshot({path:'test-artifacts/baseline-desktop.png'});await p.locator('#baseline-close').click();assert.equal(await p.locator('#net-worth').innerText(),'£281,500');await p.close();
});
async function trackedSaved(p,id,count){
 for(let attempt=0;attempt<120;attempt++){const {data}=await query({op:'select',filters:[['id',id]],one:true});if(data?.picture.flow.tracking?.entries.length===count)return data.picture;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.fail(`Expected ${count} tracking entries; status: ${await p.locator('#picture-save-status').innerText()}`);
}
test('dated pay, one-month receipts, corrections and balance records survive account reload without changing baseline',async()=>{
 const f=await seed({startMonth:'2026-01'}),p=await page(f.userId);await p.locator('#baseline-manage').click();await createBaseline(p,'Tracking reference','2026-01-01');const initial=await saved(p,f.id,1),reference=initial.baselines.entries[0];await p.locator('#baseline-close').click();
 await p.locator('#step-to-flow').click();await p.getByRole('button',{name:/^Edit Sam's estimated take-home pay/}).click();
 await p.locator('#flow-pay-primary-annualGross').fill('53000');await p.keyboard.press('Escape');
 assert.equal((await query({op:'select',filters:[['id',f.id]],one:true})).data.picture.flow.tracking,undefined);
 await p.getByRole('button',{name:/^Edit Sam's estimated take-home pay/}).click();await p.locator('#flow-change-tracking-date').fill('2026-05-01');await p.locator('#flow-pay-primary-annualGross').fill('55000');await p.locator('#flow-edit-done').click();
 let stored=await trackedSaved(p,f.id,1);assert.equal(stored.flow.pay.primary.annualGross,55000);assert.deepEqual(stored.baselines.entries[0],reference);
 await p.locator('#tracking-history-open').click();await p.locator('#tracking-inspect-month').fill('2026-04');await p.locator('#tracking-inspect-month').dispatchEvent('change');assert.match(await p.locator('#tracking-month-summary').innerText(),/47,000/);
 await p.locator('#tracking-inspect-month').fill('2026-05');await p.locator('#tracking-inspect-month').dispatchEvent('change');assert.match(await p.locator('#tracking-month-summary').innerText(),/55,000/);
 await p.locator('#tracking-history-list').getByRole('button',{name:'Correct',exact:true}).click();await p.locator('[data-correction-index="0"]').fill('56000');await p.locator('#tracking-correction-reason').fill('Corrected salary');await p.locator('#tracking-correction-form').getByRole('button',{name:'Save correction'}).click();
 stored=await trackedSaved(p,f.id,2);assert.equal(stored.flow.pay.primary.annualGross,56000);assert.deepEqual(stored.baselines.entries[0],reference);await p.locator('#tracking-history-close').click();
 await p.getByRole('button',{name:/^Edit Sam's estimated take-home pay/}).click();await p.locator('#flow-change-tracking-mode').selectOption('period');await p.locator('#flow-change-tracking-date').fill('2026-10-01');await p.locator('#flow-tracking-receipt').fill('2000');await p.locator('#flow-edit-done').click();
 stored=await trackedSaved(p,f.id,3);assert.equal(summarizeMonthlyFlow({...stored.flow,asOfMonth:'2026-10'},stored.holdings).payDetails[0].monthlyTakeHome,2000);assert.notEqual(summarizeMonthlyFlow({...stored.flow,asOfMonth:'2026-11'},stored.holdings).payDetails[0].monthlyTakeHome,2000);
 await p.locator('#step-to-assets').click();await p.getByRole('button',{name:'Edit Sam Workplace pension, £48,000',exact:true}).click();await p.locator('#item-tracking-date').fill('2026-06-30');await p.getByLabel('Current value',{exact:true}).fill('90000');await p.locator('#save-item-button').click();stored=await trackedSaved(p,f.id,4);assert.deepEqual(stored.baselines.entries[0],reference);
 await p.reload();await p.waitForFunction(()=>document.querySelector('#net-worth').textContent==='£311,500');await p.locator('#tracking-history-open').click();assert.equal(await p.locator('.tracking-history-entry').count(),4);await p.screenshot({path:'test-artifacts/tracking-desktop.png'});await p.close();
});
test('375px dated spending editor and tracking history fit the screen',async()=>{
 const f=await seed({startMonth:'2026-01'}),p=await page(f.userId,375);await p.locator('#baseline-manage').click();await createBaseline(p,'Phone tracking','2026-01-01');await saved(p,f.id,1);await p.locator('#baseline-close').click();await p.locator('#step-to-flow').click();
 await p.getByRole('button',{name:'Manage categories',exact:true}).click();await p.locator('#flow-change-tracking-date').fill('2026-07-01');await p.locator('#flow-spending-everyday').fill('3100');await p.screenshot({path:'test-artifacts/tracking-mobile-editor.png'});await p.locator('#flow-edit-done').click();await trackedSaved(p,f.id,1);await p.locator('#tracking-history-open').click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await p.locator('#tracking-history-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=375);await p.screenshot({path:'test-artifacts/tracking-mobile.png'});await p.close();
});
test('375px setup, date confirmation and saved-baseline inspection fit; explicit example remains separate',async()=>{
 const f=await seed(),p=await page(f.userId,375);await p.locator('#baseline-manage').click();
 await p.locator('#baseline-save').click();assert.equal(await p.locator('#baseline-form').isVisible(),true);
 await createBaseline(p,'Mobile starting plan','2026-10-01');await saved(p,f.id,1);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await p.locator('#baseline-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=375);
 await p.screenshot({path:'test-artifacts/baseline-mobile.png'});await p.close();
 const sample=await page(f.userId,375,true);assert.equal(await sample.locator('.baseline-bar').isVisible(),false);
 const stored=(await query({op:'select',filters:[['id',f.id]],orders:[],one:true})).data.picture;assert.equal(stored.baselines.entries.length,1);await sample.close();
});
