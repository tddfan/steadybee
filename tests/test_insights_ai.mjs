import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalysisBrief,validateAnalysisBrief,validateAnalysisResult} from '../prototype/insights-ai.mjs';
import {createHandler} from '../netlify/functions/planning-analysis.mjs';
const brief=()=>buildAnalysisBrief({endMonth:'2070-12',unfunded:5000,tax:100000,accessible:0,netAssets:400000,firstGap:'2060-01',incomplete:true},'security',['spendLess','stress']);
const request=(body=brief(),auth='Bearer test')=>new Request('https://app.example/.netlify/functions/planning-analysis',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)});
const env={OPENAI_API_KEY:'server-test-key',OPENAI_MODEL:'test-model',AI_ALLOWED_USER_IDS:'test-user'};
test('summary allowlist drops identifying fields and rejects unexpected input',()=>{
 const b=brief();assert.deepEqual(validateAnalysisBrief(b),b);assert.equal(JSON.stringify(b).includes('email'),false);
 assert.throws(()=>validateAnalysisBrief({...b,name:'Private'}));assert.throws(()=>validateAnalysisBrief({...b,recipes:['invented']}));b.facts[0].value=Infinity;assert.throws(()=>validateAnalysisBrief(b));
});
test('model may only select available facts and supported experiments, without adding claims',()=>{
 const b=brief();assert.deepEqual(validateAnalysisResult({observations:['gap','uncertainty'],experiments:['spendLess']},b),{observations:['gap','uncertainty'],experiments:['spendLess']});
 for(const result of [{observations:['guaranteed'],experiments:[]},{observations:['gap'],experiments:['mortgagePayoff']},{observations:['gap'],experiments:[],savings:1000},{observations:['gap','gap'],experiments:[]}])assert.throws(()=>validateAnalysisResult(result,b));
 b.facts[0].flag=false;assert.throws(()=>validateAnalysisResult({observations:['gap'],experiments:[]},b));
});
test('service fails closed before configuration and rejects unauthenticated or invalid summaries',async()=>{
 assert.equal((await createHandler({env:{}})(request())).status,503);
 const handler=createHandler({env,fetcher:()=>{throw Error('must not call');}});
 assert.equal((await handler(request(brief(),''))).status,401);assert.equal((await handler(request({email:'private'}))).status,400);
});
test('verified private pilot only, server key stays at provider and output is validated',async()=>{
 const calls=[];const handler=createHandler({env,fetcher:async(url,options)=>{calls.push({url,options});if(url.includes('/auth/'))return Response.json({id:'test-user'});return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({observations:['gap'],experiments:['stress']})}]}]});}});
 const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{observations:['gap'],experiments:['stress']});
 assert.equal(calls[0].options.headers.Authorization,'Bearer test');assert.equal(calls[1].options.headers.Authorization,'Bearer server-test-key');
 const payload=JSON.parse(calls[1].options.body);assert.equal(payload.store,false);assert.equal(payload.input.includes('test-user'),false);assert.equal(payload.text.format.strict,true);
 assert.equal((await handler(request())).status,429);
});
test('unknown users and provider failures leave the deterministic path available',async()=>{
 assert.equal((await createHandler({env,fetcher:async()=>Response.json({id:'other'})})(request())).status,403);
 assert.equal((await createHandler({env,fetcher:async()=>new Response('',{status:401})})(request())).status,401);
 const handler=createHandler({env,fetcher:async url=>url.includes('/auth/')?Response.json({id:'test-user'}):Response.json({status:'completed',output:[{content:[{type:'output_text',text:'{"observations":["invented"],"experiments":[]}'}]}]})});assert.equal((await handler(request())).status,502);
});
