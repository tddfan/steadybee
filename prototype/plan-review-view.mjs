import {buildPlanReview,completePlanReview,validateReviewHistory} from './plan-review.mjs?v=20261025review1';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const money=n=>n==null?'—':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(n);
const date=d=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`));
export function mountPlanReview(host,{getPicture,getProjection,getSettings,onSettings,showSection}){
 host.className='estate-card plan-review';host.innerHTML=`<div class="plan-review-heading"><div><h2>Your review</h2><p id="plan-review-due" class="muted"></p></div><div class="plan-review-actions"><label>Review cycle<select id="plan-review-cadence"><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></label><button id="plan-review-complete" class="button button-secondary" type="button">Mark reviewed</button></div></div><p id="plan-review-error" class="form-error" role="alert" hidden></p><div id="plan-review-progress" class="plan-review-progress"></div><p id="plan-review-change" class="muted" role="status"></p><details class="plan-review-checks"><summary>Tax-year and input checks</summary><div id="plan-review-checks"></div></details>`;
 const $=id=>host.querySelector(`#${id}`);let review=null;
 function refresh(){
  const picture={...getPicture(),insights:getSettings()};review=buildPlanReview(picture,{projection:getProjection()});const {progress,lastReview}=review;
  $('plan-review-cadence').value=review.cadence;
  $('plan-review-due').textContent=lastReview?`Last reviewed ${date(lastReview.date)} · next ${date(review.dueDate)}`:'No completed review yet';
  $('plan-review-complete').disabled=Boolean(lastReview&&lastReview.date===review.asOfDate&&!review.inputsChanged);$('plan-review-complete').textContent=$('plan-review-complete').disabled?'Reviewed today':'Mark reviewed';
  const stats=$('plan-review-progress');stats.replaceChildren();
  for(const [label,value,note] of [['Estimated net assets',money(progress.current),`${progress.month} month end · ${review.basisMonth} prices`],['Difference from baseline',money(progress.difference),progress.baselineNumber?`Same month · frozen v${progress.baselineNumber}`:'Set a baseline in Lifeline'],['Dated updates',String(review.recordedUpdates),'Recorded inputs; other values are estimated']]){const card=el('div');card.append(el('span','muted',label),el('strong','',value),el('small','muted',note));stats.append(card);}
  $('plan-review-change').textContent=(review.inputsChanged?'Your financial inputs, goal or assumptions changed since the last review. ':lastReview?'No input changes since the last completed review. ':'Review your goal, current figures and assumptions, then mark this check-in complete. ')+(review.firstGap?`First modelled funding gap: ${review.firstGap}.`:'');
  const checks=$('plan-review-checks');checks.replaceChildren();
  for(const item of review.isaChecks){const name=item.person==='primary'?(picture.holdings.name||'You'):(picture.holdings.partnerName||'Partner'),row=el('div','plan-review-check');row.append(el('strong','',`${name} · overall ISA subscriptions`));
   const status=item.status==='recorded'?`${money(item.recorded)} entered · ${money(item.remaining)} of the overall limit remains in this record`:item.status==='over'?`${money(item.recorded)} entered exceeds the recorded-year overall limit. Check provider records.`:item.status==='stale'?`Recorded subscriptions belong to ${item.taxYear}; update records for the current tax year.`:item.status==='unsupported'?'The recorded tax year is outside this check’s verified rules.':'Subscriptions across all providers are not confirmed. No remaining amount is assumed.';
   row.append(el('p','',status),el('small','muted',`Opening record: ${item.sourceMonth} · tax year ${item.taxYear}. Eligibility, flexible replacements and ISA subtype limits are not assessed.`));checks.append(row);
  }
  const source=el('a','','GOV.UK · ISA rules');source.href='https://www.gov.uk/individual-savings-accounts/how-isas-work';source.target='_blank';source.rel='noopener noreferrer';checks.append(source,el('p','muted','Unused subscription capacity is not a calculated tax saving. Current rules, subject to change.'));
  checks.append(el('h3','','Checks still needing fuller information'),el('p','muted','Pension annual allowance, taper, MPAA and carry-forward, dividend tax and realised gain/loss allowance use are not assessed. No unused allowance or saving is inferred.'));
  if(review.incomplete)checks.append(el('p','plan-goal-warning','The projection also has incomplete tax inputs or debt schedules. Review those before relying on the comparison.'));
  const open=el('button','heading-action','Review income, saving and assumptions');open.type='button';open.addEventListener('click',()=>showSection('flow'));checks.append(open);
  const history=el('details','plan-review-history'),summary=el('summary','',`Completed reviews (${getSettings().review?.entries.length||0})`);history.append(summary);for(const r of [...(getSettings().review?.entries||[])].reverse())history.append(el('p','muted',`${date(r.date)} · recorded ${date(r.recordedAt.slice(0,10))}`));checks.append(history);
  return review;
 }
 $('plan-review-cadence').addEventListener('change',()=>{const settings=getSettings(),history=validateReviewHistory({...settings.review||{entries:[]},cadence:$('plan-review-cadence').value});onSettings({...settings,review:history});refresh();});
 $('plan-review-complete').addEventListener('click',()=>{try{$('plan-review-error').hidden=true;const current=refresh(),settings=getSettings();onSettings({...settings,review:completePlanReview(settings.review,current)});refresh();}catch(e){$('plan-review-error').hidden=false;$('plan-review-error').textContent=e.message;}});
 return {refresh};
}
