import {validateAnalysisBrief,validateAnalysisResult} from '../../prototype/insights-ai.mjs';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from '../../prototype/cloud-config.mjs';
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
// Private pilot only. Fail closed until an operator explicitly enables user IDs.
export function createHandler({env=process.env,fetcher=fetch,now=Date.now}={}){
 const recent=new Map();
 return async request=>{
  if(request.method!=='POST')return json(405,{error:'Use POST.'});
  if(!env.OPENAI_API_KEY || !env.OPENAI_MODEL || !env.AI_ALLOWED_USER_IDS)return json(503,{error:'AI review is not enabled yet. Calculated insights remain available.'});
  const auth=request.headers.get('authorization');if(!/^Bearer \S+$/.test(auth || ''))return json(401,{error:'Sign in before requesting AI review.'});
  const raw=await request.text();if(raw.length>4000)return json(413,{error:'Summary is too large.'});
  let brief;try{brief=validateAnalysisBrief(JSON.parse(raw));}catch{return json(400,{error:'Invalid analysis summary.'});}
  try{
   const verified=await fetcher(`${SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:auth,apikey:SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(8000)});
   if(!verified.ok)return json(401,{error:'Sign in again to request AI review.'});
   const user=await verified.json();
   if(!user.id || user.is_anonymous || !env.AI_ALLOWED_USER_IDS.split(',').map(s=>s.trim()).includes(user.id))return json(403,{error:'AI review is currently a private pilot.'});
   const time=now();for(const [id,last] of recent)if(time-last>=60000)recent.delete(id);
   if(recent.has(user.id))return json(429,{error:'Please wait a minute before another review.'});recent.set(user.id,time);
   const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:env.OPENAI_MODEL,store:false,max_output_tokens:600,instructions:'Prioritise supplied calculation facts for a retirement planning review. Return up to three fact IDs with flag=true, placing incomplete inputs and spending gaps first. Choose up to two relevant experiments from the supplied recipe IDs. These are illustrative client-computed facts, not independently verified financial advice. Do not calculate or invent anything. Return only the requested structure.',input:JSON.stringify(brief),text:{format:{type:'json_schema',name:'planning_review',strict:true,schema:{type:'object',additionalProperties:false,required:['observations','experiments'],properties:{observations:{type:'array',items:{type:'string',enum:brief.facts.filter(f=>f.flag).map(f=>f.id)}},experiments:{type:'array',items:{type:'string',enum:['spendLess','retireLater','retireEarlier','stress','withdrawalOrder','mortgagePayoff']}}}}}}})});
   if(!response.ok)return json(502,{error:'AI review is unavailable. Your calculated insights are unchanged.'});
   const body=await response.json();if(body.status!=='completed')throw Error('Incomplete response');
   const text=body.output?.flatMap(item=>item.content || []).find(item=>item.type==='output_text')?.text;
   return json(200,validateAnalysisResult(JSON.parse(text),brief));
  }catch{return json(502,{error:'Could not complete AI review. Try again later; calculated insights remain available.'});}
 };
}
export default createHandler();
