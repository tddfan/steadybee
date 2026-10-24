import {validateAnalysisBrief,validateAnalysisResult} from '../../prototype/insights-ai.mjs';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../../prototype/cloud-config.mjs';
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const instructions='Prioritise supplied calculation facts for a retirement planning review. Return one to three fact IDs with flag=true, placing incomplete inputs and spending gaps first. Choose up to two relevant experiments from the supplied recipe IDs, considering the goal. These are illustrative client-computed facts, not independently verified financial advice. Do not calculate or invent anything. Return only the requested structure.';
// Private pilot only. Keys, user verification and permission checks stay on the server.
export function createHandler({env=process.env,fetcher=fetch,now=Date.now}={}){
 const recent=new Map(),reviews=new Map();
 return async request=>{
  if(request.method!=='POST')return json(405,{error:'Use POST.'});
  if(!env.GROQ_API_KEY || !env.AI_ALLOWED_USER_IDS)return json(503,{error:'AI review is not enabled for this deployment yet. Calculated insights remain available.'});
  const auth=request.headers.get('authorization');if(!/^Bearer \S+$/.test(auth || ''))return json(401,{error:'Sign in before requesting AI review.'});
  const raw=await request.text();if(raw.length>4000)return json(413,{error:'Summary is too large.'});
  let brief;try{brief=validateAnalysisBrief(JSON.parse(raw));}catch{return json(400,{error:'Invalid analysis summary.'});}
  try{
   const verified=await fetcher(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:auth,apikey:SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(8000)});
   if(!verified.ok)return json(401,{error:'Sign in again to request AI review.'});
   const user=await verified.json();
   if(!user.id || user.is_anonymous || !env.AI_ALLOWED_USER_IDS.split(',').map(s=>s.trim()).includes(user.id))return json(403,{error:'AI review is currently a private pilot. Your account has not been enabled yet.'});
   const time=now();for(const [id,last] of recent)if(time-last>=60000)recent.delete(id);
   for(const [id,last] of reviews)if(time-last.time>=300000)reviews.delete(id);
   const key=JSON.stringify(brief),cached=reviews.get(user.id);if(cached?.key===key)return json(200,cached.result);
   if(recent.has(user.id))return json(429,{error:'Please wait a minute before another review.'});recent.set(user.id,time);
   const schema={type:'object',additionalProperties:false,required:['observations','experiments'],properties:{observations:{type:'array',minItems:1,maxItems:3,items:{type:'string',enum:brief.facts.filter(f=>f.flag).map(f=>f.id)}},experiments:{type:'array',maxItems:Math.min(2,brief.recipes.length),items:{type:'string',enum:brief.recipes.length ? brief.recipes : ['spendLess','retireLater','retireEarlier','stress','withdrawalOrder','mortgagePayoff']}}}};
   const response=await fetcher('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.GROQ_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:env.GROQ_MODEL || 'openai/gpt-oss-120b',max_completion_tokens:2048,reasoning_effort:'low',messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify(brief)}],response_format:{type:'json_schema',json_schema:{name:'planning_review',strict:true,schema}}})});
   if(response.status===429)return json(429,{error:'The AI service has reached its usage limit. Try again later; calculated insights remain available.'});
   if(!response.ok)return json(502,{error:'AI review is unavailable. Your calculated insights are unchanged.'});
   const body=await response.json(),choice=body.choices?.[0];
   if(choice?.finish_reason!=='stop' || choice.message?.refusal || typeof choice.message?.content!=='string')throw Error('Incomplete response');
   const result=validateAnalysisResult(JSON.parse(choice.message.content),brief);reviews.set(user.id,{key,time:now(),result});
   return json(200,result);
  }catch{return json(502,{error:'Could not complete AI review. Try again later; calculated insights remain available.'});}
 };
}
export default createHandler();
