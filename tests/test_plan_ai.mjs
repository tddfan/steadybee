import test from 'node:test';
import assert from 'node:assert/strict';
import {buildContextualAnalysis} from '../prototype/insights-ai-context.mjs';
import {validateAnalysisBrief,validateAnalysisResult,AI_SCENARIO_COPY} from '../prototype/insights-ai.mjs';
import {buildPlanReview,goalCheckpoint} from '../prototype/plan-review.mjs';
import {createPublicDemoHousehold} from '../prototype/asset-ledger.mjs';
import {createExampleMonthlyFlow} from '../prototype/monthly-flow.mjs';
import {projectPlan} from '../prototype/planning.mjs';
import {createHandler} from '../netlify/functions/planning-analysis.mjs';
function fixture(){const picture={version:1,holdings:createPublicDemoHousehold(),flow:createExampleMonthlyFlow(),planning:{scenario:{years:4,retirementYears:{primary:2028,partner:2029}}},insights:{version:1,goal:'security',planGoal:{type:'event',person:'household',targetMonth:'2028-06',targetAmount:25000}}};const p=projectPlan(picture.flow,picture.holdings,picture.planning.scenario),review=buildPlanReview(picture,{today:'2026-10-25',projection:p});return {picture,p,review,...buildContextualAnalysis(picture.flow,picture.holdings,picture.planning,p,'security',review)};}
test('goal-aware brief contains exact target and engine checkpoint without identity or review history',()=>{
 const {brief,tested,picture}=fixture();assert.equal(brief.version,3);validateAnalysisBrief(brief);assert.equal(brief.review.goal.targetAmount,25000);assert.equal(brief.review.goal.targetMonth,'2028-06');assert.equal(brief.review.basisMonth,'2026-10');assert.equal(brief.review.candidateGoals.length,tested.length);
 assert.equal(Object.hasOwn(brief.review,'key'),false);assert.equal(Object.hasOwn(brief.review,'lastReview'),false);assert.equal(JSON.stringify(brief).includes(picture.holdings.name),false);
 for(const candidate of tested){const after=projectPlan(picture.flow,picture.holdings,candidate.preview.scenario),expected=goalCheckpoint(picture.insights.planGoal,after,{basisMonth:'2026-10',inflation:after.assumptions.inflation,reserveMonths:picture.flow.assumptions.cashReserveMonths});assert.deepEqual(brief.review.candidateGoals.find(c=>c.candidateId===candidate.id).checkpoint,expected);}
});
test('goal and review allowlists reject injected names, untested candidates, nonfinite values and unsupported claims',()=>{
 const {brief}=fixture();for(const mutate of [b=>b.review.goal.name='Private',b=>b.review.checkpoint.value=Infinity,b=>b.review.candidateGoals[0].candidateId='buy-fund',b=>b.review.progress.privateNote='Private',b=>b.review.isaChecks[0].status='guaranteed',b=>b.review.candidateGoals.pop()]){const bad=structuredClone(brief);mutate(bad);assert.throws(()=>validateAnalysisBrief(bad));}
});
test('server forwards reviewed goal and keeps response restricted to tested IDs and reviewed language',async()=>{
 const {brief}=fixture(),candidate=brief.candidates[0],answer={observations:['resilience'],recommendations:[{candidateId:candidate.id,why:'Compare the target checkpoint and spending path.',tradeoff:'The reserve may change.'}],followUps:[]};validateAnalysisResult(answer,brief);
 let calls=0;const handler=createHandler({env:{GROQ_API_KEY:'server-only-fixture',AI_ALLOWED_USER_IDS:'fixture-user'},fetcher:async(url,options)=>{if(url.includes('/auth/'))return Response.json({id:'fixture-user'});calls++;const body=JSON.parse(options.body);assert.deepEqual(JSON.parse(body.messages[1].content),brief);assert.match(body.messages[0].content,/goal checkpoint/i);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]});}});
 const response=await handler(new Request('https://fixture.invalid/',{method:'POST',headers:{Authorization:'Bearer fixture'},body:JSON.stringify(brief)}));assert.equal(response.status,200);const result=await response.json();assert.equal(calls,1);assert.deepEqual(result.recommendations[0],{candidateId:candidate.id,...AI_SCENARIO_COPY[candidate.recipe]});
});
