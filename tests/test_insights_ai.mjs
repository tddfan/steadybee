import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalysisBrief,validateAnalysisBrief,validateAnalysisResult} from '../prototype/insights-ai.mjs';
import {createHandler} from '../netlify/functions/planning-analysis.mjs';
const brief=()=>buildAnalysisBrief({endMonth:'2070-12',unfunded:5000,tax:100000,accessible:0,netAssets:400000,firstGap:'2060-01',incomplete:true},'security',['spendLess','stress']);
const request=(body=brief(),auth='Bearer test')=>new Request('https://app.example/.netlify/functions/planning-analysis',{method:'POST',headers:{Authorization:auth},body:JSON.stringify(body)});
const env={GROQ_API_KEY:'server-test-key',AI_ALLOWED_USER_IDS:'test-user'};
const completion=result=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]});
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
 const handler=createHandler({env,fetcher:async()=>Response.json({id:'test-user'})});
 assert.equal((await handler(request(brief(),''))).status,401);assert.equal((await handler(request({email:'private'}))).status,400);
});
test('verified private pilot only, server key stays at provider and output is validated',async()=>{
 const calls=[];const handler=createHandler({env,fetcher:async(url,options)=>{calls.push({url,options});if(url.includes('/auth/'))return Response.json({id:'test-user'});return completion({observations:['gap'],experiments:['stress']});}});
 const response=await handler(request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{observations:['gap'],experiments:['stress']});
 assert.equal(calls[0].options.headers.Authorization,'Bearer test');assert.equal(calls[1].options.headers.Authorization,'Bearer server-test-key');
 const payload=JSON.parse(calls[1].options.body);assert.equal(Object.hasOwn(payload,'store'),false);assert.equal(payload.messages[1].content.includes('test-user'),false);assert.equal(payload.response_format.json_schema.strict,true);assert.equal(calls[1].url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(payload.model,'openai/gpt-oss-120b');assert.equal(payload.messages[1].content.includes('server-test-key'),false);
 assert.equal((await handler(request())).status,200);assert.equal(calls.filter(c=>c.url.includes('api.groq.com')).length,1);
 const changed=brief();changed.goal='retirement';assert.equal((await handler(request(changed))).status,429);
});
test('unknown users and provider failures leave the deterministic path available',async()=>{
 assert.equal((await createHandler({env,fetcher:async()=>Response.json({id:'other'})})(request())).status,403);
 assert.equal((await createHandler({env,fetcher:async()=>new Response('',{status:401})})(request())).status,401);
 const handler=createHandler({env,fetcher:async url=>url.includes('/auth/')?Response.json({id:'test-user'}):completion({observations:['invented'],experiments:[]})});assert.equal((await handler(request())).status,502);
});

test('Groq key alone does not expose the private pilot; anonymous sessions are refused',async()=>{
 assert.equal((await createHandler({env:{GROQ_API_KEY:'test'}})(request())).status,503);
 const calls=[];const handler=createHandler({env,fetcher:async url=>{calls.push(url);return Response.json({id:'test-user',is_anonymous:true});}});
 assert.equal((await handler(request())).status,403);assert.equal(calls.length,1);
});
test('provider limits, refusals and truncated answers fail safely without revealing credentials',async()=>{
 for(const providerReply of [()=>new Response('',{status:429}),()=>Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}),()=>Response.json({choices:[{finish_reason:'stop',message:{refusal:'Cannot review',content:'{}'}}]})]){
  const handler=createHandler({env,fetcher:async url=>url.includes('/auth/') ? Response.json({id:'test-user'}) : providerReply()});
  const response=await handler(request());assert.ok([429,502].includes(response.status));const body=await response.text();assert.equal(body.includes(env.GROQ_API_KEY),false);
 }
});
test('provider request and response remain constrained to the supplied facts and experiments',async()=>{
 const handler=createHandler({env:{...env,GROQ_MODEL:'custom-model'},fetcher:async(url,options)=>{
  if(url.includes('/auth/'))return Response.json({id:'test-user'});
  const payload=JSON.parse(options.body);assert.equal(payload.model,'custom-model');assert.deepEqual(JSON.parse(payload.messages[1].content),brief());
  assert.deepEqual(payload.response_format.json_schema.schema.properties.observations.items.enum,['gap','tax','liquidity','uncertainty','resilience']);
  return completion({observations:['gap'],experiments:['mortgagePayoff']});
 }});assert.equal((await handler(request())).status,502);
});
test('identical reviews reuse a short-lived cache only after user verification',async()=>{
 let time=0,providerCalls=0,authCalls=0,validSession=true;
 const handler=createHandler({env,now:()=>time,fetcher:async url=>{
  if(url.includes('/auth/')){authCalls++;return validSession ? Response.json({id:'test-user'}) : new Response('',{status:401});}
  providerCalls++;return completion({observations:['gap'],experiments:['stress']});
 }});
 assert.equal((await handler(request())).status,200);
 time=59000;assert.equal((await handler(request())).status,200);assert.equal(providerCalls,1);assert.equal(authCalls,2);
 validSession=false;assert.equal((await handler(request())).status,401);assert.equal(providerCalls,1);
 validSession=true;time=300001;assert.equal((await handler(request())).status,200);assert.equal(providerCalls,2);
});

test('availability checks verify pilot eligibility without reading a financial body or contacting Groq',async()=>{
 for(const [id,status] of [['test-user',200],['other',403]]){
  let read=false;const urls=[];
  const handler=createHandler({env,fetcher:async url=>{urls.push(url);return Response.json({id});}});
  const req={method:'GET',headers:new Headers({Authorization:'Bearer test'}),text:async()=>{read=true;throw Error('No body may be read');}};
  const response=await handler(req);assert.equal(response.status,status);assert.equal(read,false);assert.equal(urls.length,1);assert.ok(urls[0].includes('/auth/'));
  if(status===200)assert.deepEqual(await response.json(),{available:true,supportedVersions:[1,2,3,4]});
 }
 let read=false;
 const handler=createHandler({env,fetcher:async()=>Response.json({id:'other'})});
 const response=await handler({method:'POST',headers:new Headers({Authorization:'Bearer test'}),text:async()=>{read=true;return '{}';}});
 assert.equal(response.status,403);assert.equal(read,false);
});
