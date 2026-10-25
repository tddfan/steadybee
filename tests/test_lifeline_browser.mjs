// Optional integration suite. All account requests use the synthetic localhost fixture.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {appendBaselineVersion} from '../prototype/baseline-history.mjs';
import {appendTrackingUpdate} from '../prototype/tracking.mjs';
import {createExampleMonthlyFlow,summarizeMonthlyFlow} from '../prototype/monthly-flow.mjs';
const pw=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.STEADYBEE_TEST_ORIGIN||'http://127.0.0.1:8772';
let server,browser;const errors=[];
before(async()=>{
 if(!process.env.STEADYBEE_TEST_ORIGIN){
  server=spawn(process.execPath,['tests/fixtures/account-server.mjs'],{env:{...process.env,STEADYBEE_TEST_PORT:'8772'},stdio:['ignore','pipe','pipe']});
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


async function seedLifeline(){
 const f=await seed();let p=appendBaselineVersion(f.picture,{id:'lifeline-v1',name:'Starting outlook',startDate:'2026-10-01',createdAt:'2026-10-25T12:00:00.000Z'});
 const next=structuredClone(p);next.holdings.assets.find(a=>a.id==='demo-sam-pension').value=55000;
 p=appendTrackingUpdate(p,next,{id:'lifeline-observation',effectiveDate:'2026-10-18',recordedAt:'2026-10-25T12:00:00.000Z',label:'Pension statement',startMonth:'2026-10'});
 p.planning.scenario.inflation=3;p=appendBaselineVersion(p,{id:'lifeline-v2',name:'Reviewed outlook',startDate:'2026-10-20',createdAt:'2026-10-25T12:00:00.000Z'});
 p.planning.scenario.inflation=2;await query({op:'update',filters:[['id',f.id]],value:{picture:p}});return {...f,picture:p};
}
test('default Lifeline compares frozen references, drills into dates, exports and retains existing tools',async()=>{
 const f=await seedLifeline(),p=await page(f.userId);
 await p.goto(`${origin}/app.html?fixture_user=${f.userId}`);await p.waitForFunction(()=>document.querySelector('#picture-save-status').textContent.includes('Default household'));
 assert.equal(new URL(p.url()).hash,'#lifeline');await p.locator('#lifeline-chart svg').waitFor();assert.equal(await p.locator('#lifeline-error').isVisible(),false);
 assert.equal(await p.locator('#lifeline-planning-tools').count(),0);assert.equal(await p.locator('#plan-chart').isVisible(),false);assert.equal(await p.locator('#plan-saved-scenarios').isVisible(),true);
 await p.locator('#lifeline-reference').selectOption('lifeline-v1');const current=await p.locator('.lifeline-kpi strong').allTextContents();
 await p.locator('#lifeline-reference').selectOption('lifeline-v2');assert.deepEqual(await p.locator('.lifeline-kpi strong').allTextContents(),current);
 await p.locator('[data-lifeline-view="year"]').click();await p.locator('#lifeline-month').fill('2027-02');await p.locator('#lifeline-month').dispatchEvent('change');await p.locator('#lifeline-year-basis').selectOption('taxYear');
 assert.match(await p.locator('#lifeline-chart-note').innerText(),/Apr 2026.*Mar 2027/);
 await p.locator('[data-lifeline-view="month"]').click();await p.locator('#lifeline-date').fill('2026-10-18');await p.locator('#lifeline-date').dispatchEvent('change');
 assert.match(await p.locator('#lifeline-records').innerText(),/Pension statement/);assert.match(await p.locator('#lifeline-chart-note').innerText(),/not a daily forecast/);
 await p.locator('#lifeline-info').click();await p.getByRole('heading',{name:'Behind your Lifeline',exact:true}).waitFor();const download=p.waitForEvent('download');await p.locator('#lifeline-export').click();const csvDownload=await download;assert.equal(csvDownload.suggestedFilename(),'steadybee-lifeline-monthly.csv');const csv=await readFile(await csvDownload.path(),'utf8');assert.match(csv,/Tax NI nominal GBP/);assert.match(csv,/2026-10,Frozen baseline,/);assert.match(csv,/2026-10,Current estimate,/);await p.locator('#lifeline-detail-close').click();
 await p.screenshot({path:'test-artifacts/lifeline-desktop.png',fullPage:true});
 // Explicit account saving preserves view settings without modifying either baseline.
 for(let i=0;i<100;i++){const row=await query({op:'select',filters:[['id',f.id]],one:true});if(row.data.picture.lifeline?.view==='month')break;await new Promise(r=>setTimeout(r,100));}
 const data=await query({op:'select',filters:[['id',f.id]],one:true});assert.equal(data.data.picture.lifeline.view,'month');assert.deepEqual(data.data.picture.baselines,f.picture.baselines);
 await p.reload();await p.locator('#lifeline-date-label:not([hidden])').waitFor();assert.equal(await p.locator('#lifeline-date').inputValue(),'2026-10-18');
 await p.locator('#lifeline-edit-month').click();await p.locator('#flow-title').waitFor();await p.locator('#flow-to-planning').click();
 await p.locator('#lifeline-adjust').click();await p.locator('#lifeline-adjustments').waitFor();
 assert.match(await p.locator('#baseline-param-inflation').textContent(),/Baseline 3%.*changed/);
 await p.locator('#lifeline-reference').selectOption('lifeline-v1');assert.match(await p.locator('#baseline-param-inflation').textContent(),/Baseline 2%/);
 await p.locator('#lifeline-reference').selectOption('lifeline-v2');
 await p.getByLabel('Sam retirement age: exact value',{exact:true}).fill('40');
 assert.match(await p.locator('#baseline-param-retirement-primary').textContent(),/Baseline Age 62.*changed/);
 assert.equal(await p.locator('#plan-chart').isVisible(),false);assert.equal(await p.locator('#lifeline-chart').isVisible(),true);
 await p.screenshot({path:'test-artifacts/lifeline-adjustments-desktop.png',fullPage:true});
 await p.locator('#plan-reset').click();assert.doesNotMatch(await p.locator('#baseline-param-retirement-primary').textContent(),/changed/);
 assert.match(await p.locator('#baseline-param-inflation').textContent(),/Baseline 3%/);
 assert.equal(await p.getByLabel('Sam retirement age: exact value',{exact:true}).inputValue(),'62');
 const afterReset=await query({op:'select',filters:[['id',f.id]],one:true});assert.deepEqual(afterReset.data.picture.baselines,f.picture.baselines);
 await p.locator('#plan-sheet-close').click();assert.equal(await p.locator('#lifeline-adjustments').isVisible(),false);
 await p.locator('#lifeline-alternatives > summary').click();await p.locator('#plan-compare-results .withdrawal-comparison-card').first().waitFor();
 await p.locator('#plan-saved-scenarios').click();await p.locator('#experiments-dialog').waitFor();await p.locator('#experiment-name').fill('Baseline assumptions');await p.locator('#experiment-save-form button[type=submit]').click();await p.locator('#experiments-list').getByText('Baseline assumptions',{exact:true}).waitFor();await p.locator('#experiments-close').click();
 await p.locator('#lifeline-info').click();const ledger=p.waitForEvent('download');await p.locator('#lifeline-ledger-export').click();const ledgerText=await readFile(await (await ledger).path(),'utf8');assert.match(ledgerText,/Monthly tax ledger/);assert.match(ledgerText,/Cumulative tax/);await p.locator('#lifeline-detail-close').click();
 assert.equal(await p.locator('#lifeline-error').isVisible(),false);
 await p.locator('#planning-to-assets').click();await p.locator('#canvas-title').waitFor();await p.close();
});
test('375px Lifeline stays readable, keyboard scrubs and event chips inspect recorded dates',async()=>{
 const f=await seedLifeline(),p=await page(f.userId,375);await p.locator('#assets-to-planning').click();await p.locator('#lifeline-chart svg').waitFor();
 await p.locator('.lifeline-event-recorded').click();assert.equal(await p.locator('#lifeline-date').inputValue(),'2026-10-18');
 await p.locator('#lifeline-scrubber').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#lifeline-date').inputValue(),'2026-11-30');
 await p.locator('[data-lifeline-view="year"]').click();await p.locator('#lifeline-metric').selectOption('tax');
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
 const overlap=await p.evaluate(()=>{const input=document.querySelector('#lifeline-month').getBoundingClientRect(),next=document.querySelector('#lifeline-next').getBoundingClientRect();return input.right>next.left+1;});assert.equal(overlap,false,'Date control must not overlap Next');
 await p.screenshot({path:'test-artifacts/lifeline-mobile.png',fullPage:true});
 await p.locator('[data-lifeline-view="life"]').click();await p.screenshot({path:'test-artifacts/lifeline-life-mobile.png',fullPage:true});
 await p.locator('#lifeline-adjust').click();await p.locator('#lifeline-adjustments').waitFor();
 await p.locator('#flow-growth-panel > summary').click();await p.getByLabel('Inflation: exact percentage',{exact:true}).fill('4');
 assert.match(await p.locator('#baseline-param-inflation').textContent(),/Baseline 3%.*changed/);
 const sheet=await p.locator('#lifeline-adjustments').boundingBox();assert.ok(sheet.x>=0&&sheet.x+sheet.width<=376);const chartBox=await p.locator('#lifeline-chart').boundingBox();assert.ok(chartBox.y<sheet.y,'The chart remains above the mobile controls');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.screenshot({path:'test-artifacts/lifeline-adjustments-mobile.png',fullPage:true});await p.locator('#plan-sheet-close').click();await p.close();
});
test('old Planning route opens Lifeline and public example stays distinct from account baseline',async()=>{
 const f=await seedLifeline(),p=await page(f.userId,1280,true);await p.goto(`${origin}/app.html?fixture_user=${f.userId}&example=1#planning`);await p.locator('#lifeline-chart svg').waitFor();
 assert.equal(new URL(p.url()).hash,'#lifeline');assert.match(await p.locator('#lifeline-reference-note').innerText(),/Fictional example/);assert.equal(await p.locator('#lifeline-baseline').isVisible(),false);
 assert.equal(await p.locator('#lifeline-reference option').count(),1);await p.close();
});
