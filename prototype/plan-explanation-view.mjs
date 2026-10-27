/** Compact calculated explanations plus explicitly requested, evidence-linked AI wording. */
import {EVIDENCE_LABELS,evidenceFact} from './plan-evidence.mjs?v=20261027explain1';
import {validateExplanationResult} from './explanation-ai.mjs?v=20261027explain1';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const money=n=>n==null?'Not available':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const month=m=>m?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${m}-15T12:00:00Z`)):'None modelled';
const value=f=>f.amount===null?month(f.month):`${f.id.startsWith('delta')&&f.amount>0?'+':''}${money(f.amount)}`;
const endpoint=()=>['localhost','127.0.0.1'].includes(location.hostname)&&location.port==='8766'?'http://127.0.0.1:8888/.netlify/functions/planning-analysis':'/.netlify/functions/planning-analysis';
const limitationText={taxIncomplete:'Some tax inputs or opening-year history are incomplete.',debtIncomplete:'Some debt repayments are missing; cost coverage is incomplete.',coverageDiffers:'The forecast periods differ. A like-for-like change cannot be calculated.'};
export function mountPlanExplanation(host,{analysisToken=async()=>{throw Error('Sign in to request AI wording.');},onJump=()=>{},onExplore=()=>{},onAdjust=()=>{}}={}){
 let report=null,key='',generation=0,abort=null;
 host.classList.add('plan-explanation');
 const heading=el('h3'),scope=el('p',null,'explanation-scope'),story=el('ul',null,'explanation-story'),warnings=el('div',null,'explanation-warnings'),actions=el('div',null,'explanation-actions');
 const evidence=el('details',null,'explanation-evidence');evidence.append(el('summary','Show calculated evidence'));const dl=el('dl');evidence.append(dl);
 const ai=el('details',null,'explanation-ai');ai.append(el('summary','Explain with AI'));const consent=el('p','Only the calculated amounts, dates and comparison type below go through Steadybee to Groq. Names, entry labels and account details stay here. Amounts are still sensitive; provider retention follows your Groq settings.','lifeline-caption'),payload=el('details');payload.append(el('summary','Review the exact summary'));const pre=el('pre');payload.append(pre);
 const send=el('button','Send this summary to Groq','heading-action');send.type='button';send.dataset.explanationAi='send';const status=el('p',null,'lifeline-caption');status.setAttribute('role','status');const notes=el('div',null,'explanation-ai-notes');notes.setAttribute('aria-live','polite');ai.append(consent,payload,send,status,notes);host.append(heading,scope,story,warnings,actions,evidence,ai);
 function line(text){story.append(el('li',text));}
 function action(label,callback){const b=el('button',label,'heading-action');b.type='button';b.addEventListener('click',callback);actions.append(b);}
 function render(){
  host.hidden=!report||report.empty;if(host.hidden)return;const b=report.brief,f=id=>evidenceFact(report,id),n=id=>f(id)?.amount||0;
  heading.textContent=b.task==='period'?'Why this period?':'What this scenario changes';scope.textContent=`${b.path==='preview'?'Scenario preview':'Current outlook'} · ${month(b.startMonth)}${b.endMonth!==b.startMonth?' – '+month(b.endMonth):''} · ${b.moneyBasis==='today'?month(b.basisMonth)+' prices':'future pounds'}`;
  story.replaceChildren();warnings.replaceChildren();actions.replaceChildren();dl.replaceChildren();pre.textContent=JSON.stringify(b,null,2);
  if(b.task==='period'){
   if(report.comparable){const change=n('deltaIncome'),cost=n('deltaCosts');line(`Compared with ${month(b.comparisonStartMonth)}${b.comparisonEndMonth!==b.comparisonStartMonth?' – '+month(b.comparisonEndMonth):''}: income ${Math.abs(change)<.5?'is unchanged':`${change<0?'fell':'rose'} by ${money(Math.abs(change))}`}; costs ${Math.abs(cost)<.5?'are unchanged':`${cost<0?'fell':'rose'} by ${money(Math.abs(cost))}`}.`);
    const components=['deltaPay','deltaStatePension','deltaRent','deltaOtherIncome','deltaPensionIncome'].map(id=>f(id)).filter(x=>x&&Math.abs(x.amount)>=.5).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));if(components.length)story.lastElementChild.append(document.createTextNode(` Largest source change: ${EVIDENCE_LABELS[components[0].id].toLowerCase()} ${value(components[0])}.`));
   }else line('No matching earlier period is available for comparison.');
   line(`${money(n('income'))} income and ${money(n('withdrawals'))} from assets cover ${money(n('paid'))} of ${money(n('costs'))} costs${n('unpaid')>.01?`; ${money(n('unpaid'))} remains unpaid`:'.'}`);
   if(n('pensionTax')>.01)line(`Pension withdrawals are ${money(n('pensionGross'))} before tax; their tax is ${money(n('pensionTax'))}. Total tax & NI is ${money(n('tax'))}, already accounted for.`);
   else if(n('unpaid')>.01||n('withdrawals')>.01)line(`At close: ${money(n('accessible'))} accessible before withdrawal tax; ${money(n('locked'))} in locked pensions.`);
   if(f('periodGap')?.month&&b.startMonth!==b.endMonth)action(`Inspect unpaid month · ${month(f('periodGap').month)}`,()=>onJump(f('periodGap').month));action('Explore what-ifs',onExplore);action('Review assumptions',onAdjust);
  }else if(report.comparable){
   line(`Unpaid costs over the plan: ${money(n('currentUnpaid'))} → ${money(n('scenarioUnpaid'))}. First unpaid month: ${month(f('currentGap')?.month)} → ${month(f('scenarioGap')?.month)}.`);
   const income=n('deltaIncome'),cost=n('deltaCosts'),tax=n('deltaTax');
   if(Math.abs(income)>=.5)line(`Income received over the plan ${income<0?'falls':'rises'} by ${money(Math.abs(income))}${Math.abs(tax)>=.5?`; tax & NI ${tax<0?'falls':'rises'} by ${money(Math.abs(tax))}`:''}.${tax<-.5?' Lower tax must be weighed against income and unpaid costs.':''}`);
   else if(Math.abs(cost)>=.5)line(`Costs over the plan ${cost<0?'fall':'rise'} by ${money(Math.abs(cost))}.${b.recipe==='spendLess'?' This scenario uses a lower regular household budget.':''}${Math.abs(tax)>=.5?` Tax & NI changes by ${value(f('deltaTax'))}.`:''}`);
   else line(`Recurring income and costs stay unchanged.${Math.abs(tax)>=.5?` Tax & NI changes by ${value(f('deltaTax'))}.`:''}${tax<-.5?' Lower tax alone does not establish an improvement.':''}`);
   if(n('currentAccessible')<.5&&n('scenarioAccessible')<.5)line(`Accessible investments at the end stay at ${money(0)}. Net assets: ${money(n('currentNetAssets'))} → ${money(n('scenarioNetAssets'))}, including property and locked pensions.`);
   else line(`Accessible investments at the end, before withdrawal tax: ${money(n('currentAccessible'))} → ${money(n('scenarioAccessible'))}. Net assets include property and locked pensions.`);
   const first=f('firstChange')?.month;if(first)action(`Inspect first change · ${month(first)}`,()=>onJump(first));
  }
  for(const limit of b.limitations)warnings.append(el('p',limitationText[limit],'bento-warning'));
  for(const fact of b.facts){const row=el('div');row.append(el('dt',EVIDENCE_LABELS[fact.id]),el('dd',value(fact)));dl.append(row);}
  ai.hidden=!b.facts.length||!report.comparable&&b.task==='scenario';
 }
 send.addEventListener('click',async()=>{
  if(!report)return;const pending=structuredClone(report.brief),expected=key,requestId=++generation;send.disabled=true;status.textContent='Checking AI availability…';notes.replaceChildren();abort?.abort();abort=new AbortController();
  try{
   const token=await analysisToken();if(!token)throw Error('Sign in to request AI wording.');
   const available=await fetch(endpoint(),{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([abort.signal,AbortSignal.timeout(12000)])});const capability=await available.json();if(!available.ok)throw Error(capability.error||'AI is unavailable.');
   if(!capability.supportedVersions?.includes(4))throw Error('AI wording needs the updated explanation function deployed. Your calculated explanation is available above.');
   if(expected!==key||requestId!==generation)return;status.textContent='Explaining the reviewed evidence…';
   const response=await fetch(endpoint(),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(pending),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(35000)])});const body=await response.json();if(!response.ok)throw Error(body.error||'AI wording is unavailable.');
   const result=validateExplanationResult(body,pending);if(expected!==key||requestId!==generation)return;
   for(const note of result.notes){const item=el('section');item.append(el('p',note.text));const backing=el('ul');for(const id of note.factIds){const fact=pending.facts.find(f=>f.id===id);backing.append(el('li',`${EVIDENCE_LABELS[id]}: ${value(fact)}`));}item.append(backing);notes.append(item);}status.textContent='AI wording · check it against the calculated evidence. No changes applied.';
  }catch(error){if(expected===key&&requestId===generation)status.textContent=(error.name==='TimeoutError'?'AI request timed out.':error instanceof TypeError?'AI service is unavailable.':error.message)+' Calculated evidence stays available.';}
  finally{if(requestId===generation)send.disabled=false;}
 });
 return {update(next){if(report?.brief.path!==next?.brief.path){evidence.open=false;ai.open=false;payload.open=false;}const nextKey=next?JSON.stringify(next.brief):'';if(nextKey!==key){generation++;abort?.abort();key=nextKey;notes.replaceChildren();status.textContent='';send.disabled=false;}report=next;render();}};
}
