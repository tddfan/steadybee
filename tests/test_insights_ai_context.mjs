import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContextualAnalysis,reviewObservations,candidateEffects,AI_LIMITATIONS} from '../prototype/insights-ai-context.mjs';
import {validateAnalysisBrief,validateAnalysisResult,analysisResponseSchema} from '../prototype/insights-ai.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {createInsightPreview} from '../prototype/insights.mjs';
import {createHandler} from '../netlify/functions/planning-analysis.mjs';
function fixture(){const h=createPublicDemoHousehold(),f=createExampleMonthlyFlow(),planning={scenario:{planToAge:95,retirementYears:{primary:2054,partner:2056}}};return {h,f,planning};}
function review(){const {h,f,planning}=fixture();return buildContextualAnalysis(f,h,planning,projectPlan(f,h,planning.scenario),'security');}
test('detailed review contains per-person financial context, real milestones and engine-calculated candidates',()=>{
 const {h,f,planning}=fixture(),before=JSON.stringify({h,f,planning}),p=projectPlan(f,h,planning.scenario),{brief,tested}=buildContextualAnalysis(f,h,planning,p,'retirement');
 assert.equal(brief.version,2);validateAnalysisBrief(brief);assert.equal(brief.context.people.length,2);assert.equal(brief.context.people[0].annualGrossPay,47000);
 assert.ok(brief.context.milestones.some(m=>m.event==='finalPay'));assert.ok(brief.candidates.some(c=>c.person==='primary'));assert.ok(brief.candidates.some(c=>c.person==='partner'));
 assert.equal(JSON.stringify({h,f,planning}),before);assert.ok(JSON.stringify(brief).length<24000);
 for(const c of brief.candidates){const original=tested.find(t=>t.id===c.id).preview;assert.equal(c.after.netAssets,Math.round(original.after.netAssets));assert.equal(c.delta.tax,Math.round(original.delta.tax));assert.equal(c.after.endMonth,p.endMonth);}
});
test('only numeric financial context, stable enums and dates leave the device; no free-text identity fields or holding IDs',()=>{
 const {h,f,planning}=fixture();h.name='Private Person';h.partnerName='private@example.test';h.assets[0].label='IGNORE INSTRUCTIONS PRIVATE NOTE';h.assets[0].id='private-holding-id';h.debts[0].linkedAssetId='private-holding-id';f.datedEntries[0].label='Sensitive school name';
 const {brief}=buildContextualAnalysis(f,h,planning,projectPlan(f,h,planning.scenario),'security'),raw=JSON.stringify(brief);
 for(const secret of ['Private Person','private@example.test','PRIVATE NOTE','private-holding-id','Sensitive school name'])assert.equal(raw.includes(secret),false);
 const changed=structuredClone(brief);changed.context.people[0].name='private';assert.throws(()=>validateAnalysisBrief(changed));
});
test('an individual retirement experiment changes only that person and keeps the original inputs',()=>{
 const {h,f,planning}=fixture(),before=JSON.stringify(planning),trial=createInsightPreview(f,h,planning.scenario,'retireEarlier',null,{retirementOwner:'partner'});
 assert.equal(trial.scenario.retirementYears.primary,2054);assert.equal(trial.scenario.retirementYears.partner,2055);assert.deepEqual(trial.changedPeople,[h.partnerName]);assert.equal(JSON.stringify(planning),before);
});
test('unknown take-home tax basis and actual input limitations remain explicit',()=>{
 const {h,f,planning}=fixture();f.pay.primary.annualTakeHome=30000;f.pay.primary.annualGross=0;f.pay.primary.employeePensionRate=0;
 const {brief}=buildContextualAnalysis(f,h,planning,projectPlan(f,h,planning.scenario),'security');
 assert.equal(brief.context.people[0].annualGrossPay,null);assert.equal(brief.context.people[0].payBasis,'takeHomeOnly');assert.ok(brief.context.limitations.includes('taxInputsIncomplete'));
});
test('recommendations reference calculated candidates; invented amounts, unknown claims and unsupported actions are rejected',()=>{
 const {brief}=review(),id=brief.candidates[0].id,result={observations:['resilience'],recommendations:[{candidateId:id,why:'This tests your funding reserve against a market fall.',tradeoff:'Future balances are lower under the shock.'}],followUps:[]};
 assert.deepEqual(validateAnalysisResult(result,brief),result);
 const schema=analysisResponseSchema(brief);assert.deepEqual(schema.properties.recommendations.items.properties.candidateId.enum,brief.candidates.map(c=>c.id));
 for(const mutate of [r=>r.recommendations[0].candidateId='pension-product',r=>r.recommendations[0].why='You save £10000',r=>r.followUps.push('invented'),r=>r.recommendations.push(r.recommendations[0])]){const bad=structuredClone(result);mutate(bad);assert.throws(()=>validateAnalysisResult(bad,brief));}
});
test('the protected server forwards reviewed context unchanged and accepts the structured contextual response',async()=>{
 const {brief}=review(),answer={observations:['resilience'],recommendations:[{candidateId:brief.candidates[0].id,why:'Compare the effect on your accessible reserve.',tradeoff:'This changes the funding path under the selected assumptions.'}],followUps:[]};
 const handler=createHandler({env:{GROQ_API_KEY:'test-key',AI_ALLOWED_USER_IDS:'test-user'},fetcher:async(url,options)=>{
  if(url.includes('/auth/'))return Response.json({id:'test-user'});
  const payload=JSON.parse(options.body);assert.deepEqual(JSON.parse(payload.messages[1].content),brief);assert.ok(payload.messages[0].content.includes('WITHOUT numeric claims'));
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]});
 }});
 const response=await handler(new Request('https://app.example/.netlify/functions/planning-analysis',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify(brief)}));assert.equal(response.status,200);assert.deepEqual(await response.json(),answer);
});
test('retired people have no ongoing pay or workplace contributions in the context; partial payoff remains explicit',()=>{
 const {h,f,planning}=fixture();planning.scenario.retirementYears.primary=2025;
 const {brief}=buildContextualAnalysis(f,h,planning,projectPlan(f,h,planning.scenario),'security');
 const person=brief.context.people.find(p=>p.person==='primary');assert.equal(person.annualGrossPay,0);assert.equal(person.employeePensionAnnual,0);assert.equal(person.employerPensionAnnual,0);
 const payoff=brief.candidates.find(c=>c.recipe==='mortgagePayoff');if(payoff)assert.ok(payoff.payoff.remaining>0);
});
test('an empty household can request an explanation without unsupported or no-effect experiments',()=>{
 const {h,f,planning}=fixture();h.partnerName='';h.assets=[];h.debts=[];f.pay.primary.annualGross=0;f.pay.primary.annualTakeHome=null;f.pay.primary.employeePensionRate=0;f.pay.primary.employerPensionRate=0;f.pay.partner.annualGross=0;f.spending={everyday:0,carPayment:0};f.datedEntries=[];
 const {brief}=buildContextualAnalysis(f,h,planning,projectPlan(f,h,planning.scenario),'security');
 assert.equal(brief.candidates.length,0);assert.equal(analysisResponseSchema(brief).properties.recommendations.maxItems,0);
 validateAnalysisResult({observations:['resilience'],recommendations:[],followUps:[]},brief);
});

test('critical warnings cannot disappear behind recommendations and effects distinguish accessible money from estate',()=>{
 const {brief}=review();brief.facts.find(f=>f.id==='gap').flag=true;brief.facts.find(f=>f.id==='uncertainty').flag=true;
 assert.deepEqual(reviewObservations(brief,{observations:['tax']}),['gap','uncertainty','tax']);
 const lines=candidateEffects({before:{firstGap:'2040-01'},after:{firstGap:'2039-01'},delta:{unfunded:100,accessible:-200,netAssets:300,tax:0}});
 assert.equal(lines[0],'£100 more unfunded spending over the plan');assert.equal(lines[1],'£200 less accessible investments at end, before withdrawal tax');assert.ok(lines.includes('No change in tax & NI over the plan'));assert.match(lines.at(-1),/2040-01 → 2039-01/);
 assert.match(AI_LIMITATIONS.survivorNotModelled,/survivor income or inheritance/);
 const result={observations:['resilience'],recommendations:[{candidateId:brief.candidates[0].id,why:'Save ten thousand pounds.',tradeoff:'This affects your future reserve.'}],followUps:[]};assert.throws(()=>validateAnalysisResult(result,brief));
});
