import {enableGroupedNumberInput,groupedNumberValue} from './grouped-number-input.mjs?v=20261027bento1';
import {AI_REASONS,AI_SCENARIO_COPY,validateAnalysisResult} from './insights-ai.mjs?v=20261024context4';
import {INSIGHT_GOALS,INSIGHT_RECIPES,PLAN_GOALS,buildInsights,createInsightPreview,evaluatePlanGoal,insightSourceKey,insightSummary,validateInsightSettings} from './insights.mjs?v=20261024context4';
import {buildContextualAnalysis,AI_FOLLOW_UPS,reviewObservations,candidateEffects,AI_LIMITATIONS} from './insights-ai-context.mjs?v=20261024context4';
import {projectPlan} from './planning.mjs?v=20261024persona1';
import {mountPlanReview} from './plan-review-view.mjs?v=20261025review1';
import {describeGoalCheckpoint} from './plan-review.mjs?v=20261025review1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const money=value=>value==null?'—':new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const shiftUiMonth=(month,offset)=>{const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);};
const localAI=location.port==='8766' && ['localhost','127.0.0.1'].includes(location.hostname);
const analysisEndpoint=localAI?'http://127.0.0.1:8888/.netlify/functions/planning-analysis':'/.netlify/functions/planning-analysis';
export function mountInsights(root,getInputs,{analysisToken,showSection,applyScenario,undoScenario,saveScenario,previewOnLifeline=()=>{},getPicture=()=>null}){
  let settings={version:1,goal:'security'},cacheKey='',baseline=null,preview=null,applied=null,analysisKey='',analysisRequest=0,planReview=null;
  const $=id=>root.querySelector(`#${id}`);
  root.innerHTML=`<div class="estate-heading"><div><h1 id="insights-title" tabindex="-1">Plan</h1><p class="muted">Choose what matters; see what your Lifeline says.</p></div><label class="insights-goal">Guidance focus<select id="insights-goal"></select></label></div><p id="insights-error" role="alert" class="form-error" hidden></p><section class="estate-card plan-goal-card"><div class="plan-goal-heading"><div><h2>Your main goal</h2><p class="muted">One goal keeps the next steps focused. You can change it any time.</p></div><label class="insights-goal" for="plan-goal-type">Goal<select id="plan-goal-type"><option value="">Choose a goal</option></select></label></div><div id="plan-goal-fields"></div><div id="plan-goal-result" class="plan-goal-result" aria-live="polite"></div></section><p id="insights-basis" class="muted"></p><h2 class="plan-section-title">What could you explore?</h2><div id="insights-cards" class="insights-cards"></div><details class="estate-card insights-more"><summary>More what-ifs</summary><p class="muted">Preview a calculated experiment before applying or saving it.</p><div class="insights-more-controls"><label for="insights-recipe">Choose an experiment</label><select id="insights-recipe"></select><button id="insights-preview" class="button button-primary" type="button">Preview selected what-if</button></div></details><p id="insights-status" role="status"></p><button id="insights-undo" class="heading-action" type="button" hidden>Undo last applied experiment</button><details class="estate-card estate-details"><summary>How Plan works</summary><p>The current Lifeline engine calculates results from your household and recorded assumptions. Goal checks are checkpoints, not scores or guarantees. Missing inputs and model limits stay visible.</p><p>Previews are temporary. Applying changes future scenario assumptions; saving keeps a named alternative. Neither changes recorded assets, pay, spending or the frozen baseline. Optional AI review can explain these calculated results and suggest supported experiments; it cannot edit your plan or supply new numbers.</p></details><section class="estate-card insights-ai"><div><h2>AI review</h2><p class="muted">Selects up to three calculated what-ifs for your chosen focus. Review before sharing financial details.</p></div><button id="insights-ai-open" class="heading-action" type="button">Explore with AI</button><div id="insights-ai-results" aria-live="polite"></div></section><dialog id="insights-ai-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2>Review before sending</h2><button id="insights-ai-close" class="heading-action" aria-label="Close AI review" type="button">×</button></div><p>Your reviewed summary passes through Steadybee’s server to Groq. It includes ages, income and pension contributions for each person in your plan, grouped asset balances, loan terms, planned dates and calculated what-if results. Names, email, account identifiers, holding names and notes stay on this device. A couple’s review includes both people’s financial details. The summary also includes your chosen goal type, person, target date and amount, calculated goal checkpoints, reserve assumptions and the baseline difference. Completed review history stays on this device and in your household account. Review the summary below before sending; your plan stays unchanged.</p><p class="muted">Private pilot · financial amounts remain sensitive even without names. Provider retention follows your Groq account settings; this app cannot verify them. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Groq data handling ↗</a></p><details><summary>See what will be sent</summary><div id="insights-ai-payload" class="insights-ai-payload"></div></details><div class="insights-actions"><button id="insights-ai-send" class="button button-primary" type="button">Send financial summary to Groq</button></div><p id="insights-ai-status" role="status"></p></dialog><dialog id="insights-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2 id="insights-trial-title">Compare experiment</h2><button id="insights-close" class="heading-action" type="button" aria-label="Close experiment preview">×</button></div><p id="insights-trial-basis" class="insights-context"></p><div id="insights-result" class="insights-result"></div><div id="insights-highlights" class="insights-highlights"></div><details class="insights-full-comparison"><summary>Full comparison</summary><div id="insights-comparison"></div></details><p id="insights-tradeoff" class="insights-scope"></p><p id="insights-trial-warning" class="estate-notice" hidden></p><details class="estate-details"><summary>Assumptions and missing information</summary><ul id="insights-trial-notes"></ul></details><div class="insights-actions"><button id="insights-apply" type="button" class="button button-primary">Apply to Plan</button><button id="insights-view-lifeline" type="button" class="heading-action">View on Lifeline</button><button id="insights-save-open" type="button" class="heading-action">Save scenario…</button></div><form id="insights-save-form" hidden><label for="insights-name">Scenario name</label><div class="insights-actions"><input id="insights-name" maxlength="60" required><button type="submit" class="button button-primary">Save without applying</button></div></form><p id="insights-trial-status" role="status"></p></dialog>`;
  for(const [value,label] of Object.entries(INSIGHT_GOALS))$('insights-goal').add(new Option(label,value));
  for(const [value,goal] of Object.entries(PLAN_GOALS))$('plan-goal-type').add(new Option(goal.title,value));
  const savedScenarios=el('button','heading-action','Saved scenarios');savedScenarios.type='button';savedScenarios.addEventListener('click',()=>document.querySelector('#plan-saved-scenarios')?.click());root.querySelector('.estate-heading').append(savedScenarios);
  const reviewHost=el('section');reviewHost.id='plan-review';root.querySelector('.plan-goal-card').after(reviewHost);
  const reviewController=mountPlanReview(reviewHost,{getPicture:()=>getPicture()||{...getInputs(),version:1},getProjection:()=>baseline,getSettings:()=>settings,onSettings:value=>{settings=validateInsightSettings(value);document.dispatchEvent(new Event('picture-updated'));},showSection});
  const banner=el('div','insights-applied-banner');banner.id='insights-applied-banner';banner.hidden=true;
  banner.append(el('span','','A Plan experiment is applied. '));const undo=el('button','plan-text-button','Undo experiment');undo.type='button';banner.append(undo);document.querySelector('#planning-content').prepend(banner);
  function message(text){$('insights-error').textContent=text || '';$('insights-error').hidden=!text;}
  function source(){const input=getInputs();return {...input,key:insightSourceKey(input.flow,input.holdings,input.planning.scenario)};}
  function reviewKey(){return source().key+settings.goal+JSON.stringify(settings.planGoal||null)+JSON.stringify(getPicture()?.baselines?.entries.map(b=>[b.id,b.createdAt])||[]);}
  function goalContext(){return planReview?{goal:settings.planGoal||null,basisMonth:planReview.basisMonth,inflation:planReview.inflation,reserveMonths:source().flow.assumptions.cashReserveMonths??6}:null;}
  function currentPreview(){if(!preview)throw new Error('Open an experiment preview first.');if(source().key!==preview.sourceKey)throw new Error('Your inputs or scenario changed. Close this preview and run it again.');return preview;}
  function renderGoalFields(input){
    const host=$('plan-goal-fields'),goal=settings.planGoal;host.replaceChildren();$('plan-goal-result').replaceChildren();$('plan-goal-type').value=goal?.type||'';if(!goal)return;
    const ownerLabel=input.holdings.name||'You',hasPartner=Boolean(input.holdings.partnerName),owner=el('label','insights-goal','Who does this goal apply to?');
    if(goal.type==='retireBy'){
      const select=document.createElement('select');select.id='plan-goal-person';select.add(new Option(ownerLabel,'primary'));if(hasPartner){select.add(new Option(input.holdings.partnerName,'partner'));select.add(new Option('Both people','household'));}select.value=goal.person||'primary';owner.append(select);host.append(owner);
    }
    if(goal.type!=='retireBy'){
      const label=el('label','insights-goal',goal.type==='spending'?'Target monthly household costs':'Target amount');const amount=document.createElement('input');amount.id='plan-goal-amount';amount.type='number';amount.min='0';amount.max='100000000';amount.step='100';amount.inputMode='decimal';amount.value=String(goal.type==='spending'?(goal.targetMonthly??''):(goal.targetAmount??''));amount.setAttribute('aria-label',label.textContent);enableGroupedNumberInput(amount);label.append(amount,el('small','muted',goal.type==='spending'?'£ per month · today’s prices · excluding debt payments':'£ · today’s money'));host.append(label);
    }
    if(goal.type!=='legacy'){
      const label=el('label','insights-goal',goal.type==='retireBy'?'Target date':'When do you need it?'),date=document.createElement('input');date.id='plan-goal-month';date.type='month';date.value=goal.targetMonth||'';label.append(date);host.append(label);
    }else{
      const label=el('label','insights-goal','When should we compare?'),date=document.createElement('input');date.id='plan-goal-month';date.type='month';date.value=goal.targetMonth||'';label.append(date);host.append(label);
    }
    host.querySelectorAll('input,select').forEach(control=>control.addEventListener('change',()=>{
      const next={...settings.planGoal};if(control.id==='plan-goal-person')next.person=control.value;
      if(control.id==='plan-goal-month')next.targetMonth=control.value||null;
      if(control.id==='plan-goal-amount'){if(next.type==='spending')next.targetMonthly=control.value===''?null:groupedNumberValue(control);else next.targetAmount=control.value===''?null:groupedNumberValue(control);}
      try{settings.planGoal=validateInsightSettings({...settings,planGoal:next}).planGoal;refresh();document.dispatchEvent(new Event('picture-updated'));}catch(error){control.setAttribute('aria-invalid','true');message(error.message);}
    }));
    const result=evaluatePlanGoal(goal,input.flow,input.holdings,baseline,goalContext()||{});if(!result)return;
    const heading=el('h3','',result.label),stats=el('div','plan-goal-stats');stats.append(el('div','',result.target),el('div','',`${result.measure}: ${result.value}`));if(result.difference)stats.append(el('div','plan-goal-difference',result.difference));$('plan-goal-result').append(heading,stats,el('p','muted',result.context));if(result.warning)$('plan-goal-result').append(el('p','plan-goal-warning',result.warning));
    if(goal.type==='legacy'){const button=el('button','heading-action','Review inheritance details');button.type='button';button.addEventListener('click',()=>showSection('inheritance'));$('plan-goal-result').append(button);}
  }
  function syncUndo(){
    const same=applied && source().key===applied.sourceKey;
    banner.hidden=!same;$('insights-undo').hidden=!same;
    if(applied && !same)applied=null;
  }
  function refresh(){
    message('');syncUndo();if(analysisKey && analysisKey!==reviewKey()){$('insights-ai-results').replaceChildren();analysisKey='';analysisRequest++;}$('insights-goal').value=settings.goal;
    try{
      const input=source();if(input.key!==cacheKey){baseline=projectPlan(input.flow,input.holdings,input.planning.scenario);cacheKey=input.key;}
      planReview=reviewController.refresh();
      renderGoalFields(input);
      const findings=buildInsights(input.flow,input.holdings,input.planning.scenario,baseline,settings.goal),summary=insightSummary(baseline,goalContext());
      $('insights-basis').textContent=`Current scenario · through ${summary.endMonth} · ${planReview.basisMonth} prices${summary.incomplete ? ' · partial estimate' : ''}`;
      const cards=$('insights-cards');cards.replaceChildren();
      for(const item of findings.cards){const card=el('section','estate-card insight-card');if(item.recipe)card.dataset.recipe=item.recipe;card.append(el('span','insight-priority',item.priority),el('h2','',item.title));if(item.amount!=null)card.append(el('strong','insight-amount',money(item.amount)));card.append(el('p','muted',item.detail));const button=el('button','heading-action',item.recipe ? 'Preview experiment' : 'Review inputs');button.type='button';button.addEventListener('click',()=>item.recipe ? openPreview(item.recipe) : showSection(item.section));card.append(button);cards.append(card);}
      const recipes=$('insights-recipe'),previous=recipes.value,featured=new Set(findings.cards.map(item=>item.recipe).filter(Boolean)),more=findings.available.filter(key=>!featured.has(key));recipes.replaceChildren();for(const key of more)recipes.add(new Option(INSIGHT_RECIPES[key].title,key));if(more.includes(previous))recipes.value=previous;$('insights-preview').disabled=!more.length;$('insights-preview').hidden=!more.length;recipes.disabled=!more.length;root.querySelector('.insights-more').hidden=!more.length;
    }catch(error){message(error.message);$('insights-cards').replaceChildren();$('insights-basis').textContent='Check the recorded inputs before comparing experiments.';$('insights-preview').disabled=true;}
  }
  function openPreview(recipe,options={}){
    message('');
    try{
      const input=source();preview=createInsightPreview(input.flow,input.holdings,input.planning.scenario,recipe,input.key===cacheKey ? baseline : null,options,goalContext());
      $('insights-trial-title').textContent=INSIGHT_RECIPES[recipe].title+(options.retirementOwner?` · ${options.retirementOwner==='primary'?input.holdings.name:input.holdings.partnerName} only`:'');$('insights-tradeoff').textContent=INSIGHT_RECIPES[recipe].tradeoff;
      $('insights-trial-basis').textContent=`Through ${preview.after.endMonth} · today’s money`;
      $('insights-result').textContent=preview.changed ? (Math.abs(preview.delta.unfunded)>=1 ? `${money(Math.abs(preview.delta.unfunded))} ${preview.delta.unfunded<0 ? 'less' : 'more'} unfunded spending` : Math.abs(preview.delta.netAssets)>=1 ? `${money(Math.abs(preview.delta.netAssets))} ${preview.delta.netAssets>0 ? 'more' : 'less'} net assets at the end` : 'The monthly funding path changes') : 'No change to this plan';
      if(!preview.changed)$('insights-tradeoff').textContent=preview.noChangeReason;
      else if(preview.recipe==='spendLess'){$('insights-tradeoff').textContent=`From January ${preview.spendingYear}, regular household spending falls by about ${money(preview.monthlySpendingReduction)} a month in today’s money. Debt payments and dated costs stay the same.`;}
      else if(preview.changedPeople?.length){const people=preview.changedPeople.join(' and '),direction=preview.recipe==='retireLater'?'one year later':'one year earlier';$('insights-tradeoff').textContent=`Moves the recorded retirement date ${direction} for ${people}. ${preview.recipe==='retireLater'?'Recorded pay and workplace contributions continue for that extra year.':'Removes a year of their recorded pay and workplace contributions.'}`;}
      const highlights=$('insights-highlights');highlights.replaceChildren();
      for(const [key,label] of [['unfunded','Unfunded spending'],['tax','Total tax & NI over the plan'],['netAssets','Net assets at end']]){const card=el('div','insights-metric');card.append(el('span','muted',label),el('strong','',money(preview.after[key])),el('small','',`${preview.delta[key]>=.5?'+':''}${money(preview.delta[key])} vs current`));highlights.append(card);}
      if(preview.goalAfter){const card=el('div','insights-metric plan-goal-comparison');card.append(el('span','muted','Your goal checkpoint'),el('strong','',describeGoalCheckpoint(preview.goalAfter)),el('small','',`Current: ${describeGoalCheckpoint(preview.goalBefore)}`));if(preview.goalAfter.reserve!=null)card.append(el('small','',`Cash at goal: ${money(preview.goalBefore.cash)} → ${money(preview.goalAfter.cash)} · reserve assumption ${money(preview.goalAfter.reserve)}`));highlights.prepend(card);}
      $('insights-apply').disabled=!preview.changed;$('insights-save-open').disabled=!preview.changed;$('insights-view-lifeline').disabled=!preview.changed;
      $('insights-dialog').querySelector('.insights-full-comparison').open=false;
      const table=el('table','insights-comparison-table'),head=el('tr');for(const label of ['Measure','Current','Experiment','Change'])head.append(el('th','',label));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
      const row=(label,before,after,delta='—')=>{const line=el('tr');const heading=el('th','',label);heading.scope='row';line.append(heading);for(const [name,value] of [['Current',before],['Experiment',after],['Change',delta]]){const cell=el('td','',value);cell.dataset.label=name;line.append(cell);}body.append(line);};
      row('First spending gap',preview.before.firstGap || 'No recorded gap',preview.after.firstGap || 'No recorded gap');
      for(const [key,label] of [['unfunded','Total unfunded spending'],['tax','Total tax & NI over the plan'],['accessible','Accessible investments at end · before withdrawal tax'],['netAssets','Net assets at end'],['cash','Cash at end']])row(label,money(preview.before[key]),money(preview.after[key]),`${preview.delta[key]>=.5 ? '+' : ''}${money(preview.delta[key])}`);
      table.append(body);$('insights-comparison').replaceChildren(table);
      const warnings=[...preview.warnings];
      if(preview.payoff?.remaining>0)warnings.push(`Mortgage payoff is partial: ${money(preview.payoff.remaining)} remains.`);
      if(preview.stress && !preview.stress.loss)warnings.push('No eligible investment value is affected by the shock in this scenario.');
      $('insights-trial-warning').hidden=!warnings.length;$('insights-trial-warning').textContent=warnings.length ? 'Partial estimate · see assumptions below' : '';
      $('insights-trial-notes').replaceChildren(...warnings.map(text=>el('li','',text)));
      $('insights-trial-status').textContent='Preview only — nothing applied or saved.';$('insights-save-form').hidden=true;$('insights-name').value=$('insights-trial-title').textContent;
      $('insights-dialog').showModal();$('insights-close').focus();
    }catch(error){message(error.message);}
  }
  let review=null;
  $('insights-ai-open').addEventListener('click',async()=>{
    $('insights-ai-open').disabled=true;
    try{
      review=null;$('insights-ai-status').textContent='Checking AI availability…';$('insights-ai-payload').replaceChildren();$('insights-ai-send').disabled=true;$('insights-ai-dialog').showModal();
      const token=await analysisToken();
      const availability=await fetch(analysisEndpoint,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
      if(!availability.headers.get('content-type')?.includes('application/json'))throw Error('AI review needs the Netlify service. Calculated insights remain available locally.');
      const eligibility=await availability.json();if(!availability.ok || !eligibility.available)throw Error(eligibility.error || 'AI review is unavailable for this account.');
      if(!eligibility.supportedVersions?.includes(3))throw Error('The AI service needs the updated goal-review function deployed. Your calculated goal checks and comparisons remain available.');
      if(!$('insights-ai-dialog').open)return;
      $('insights-ai-status').textContent='Calculating comparisons…';
      await new Promise(resolve=>setTimeout(resolve,0));
      const input=source(),projection=input.key===cacheKey ? baseline : projectPlan(input.flow,input.holdings,input.planning.scenario);
      planReview=reviewController.refresh();review={key:reviewKey(),...buildContextualAnalysis(input.flow,input.holdings,input.planning,projection,settings.goal,planReview)};
      renderReviewPayload(review.brief,input.holdings);$('insights-ai-status').textContent='Nothing sent yet.';$('insights-ai-send').disabled=false;$('insights-ai-close').focus();
    }catch(error){$('insights-ai-status').textContent=localAI && error instanceof TypeError?'Start the local AI bridge on port 8888, then try again.':error.message;}
    finally{$('insights-ai-open').disabled=false;}
  });
  function renderReviewPayload(brief,holdings){
    const payload=$('insights-ai-payload'),context=brief.context;
    const section=(title,lines)=>{const box=el('details','insights-payload-section');box.append(el('summary','',title));const list=el('ul');list.append(...lines.map(text=>el('li','',text)));box.append(list);payload.append(box);};
    const who=person=>person==='primary'?'Person A':person==='partner'?'Person B':'Household';
    payload.replaceChildren(el('p','',`${INSIGHT_GOALS[brief.goal]} · ${context.startMonth} to ${brief.endMonth} · rounded pounds. Current pay is annual; opening cash flow is monthly; comparison results use today’s money.`));
    payload.append(el('p','muted',`On this device: Person A is ${holdings.name}${holdings.partnerName?`; Person B is ${holdings.partnerName}`:''}. These names are not sent.`));
    if(brief.review){const r=brief.review;section('Goal, baseline difference and review date',[`${r.asOfDate} · ${r.basisMonth} prices. Goal: ${r.goal?PLAN_GOALS[r.goal.type].title:'not selected'} · person ${r.goal?.person||'household'} · target month ${r.goal?.targetMonth||'not set'} · amount ${r.goal?.targetAmount==null?'not set':money(r.goal.targetAmount)} · monthly target ${r.goal?.targetMonthly==null?'not set':money(r.goal.targetMonthly)}.`,describeGoalCheckpoint(r.checkpoint),`Estimated net assets ${money(r.progress.current)}; frozen baseline ${money(r.progress.baseline)}; difference ${money(r.progress.difference)}. This is not a performance attribution.`,...r.candidateGoals.map(c=>`${c.candidateId}: ${describeGoalCheckpoint(c.checkpoint)}`),...r.isaChecks.map(c=>`${who(c.person)}: ISA record ${c.taxYear} · ${c.status}; recorded ${c.recorded==null?'unknown':money(c.recorded)}, remaining ${c.remaining==null?'not assessed':money(c.remaining)}.`)]);}
    section('People, pay & pensions',context.people.flatMap(p=>[
      `${who(p.person)} · age ${p.age ?? 'unknown'} · final pay ${p.finalPayMonth || 'not recorded'}.`,
      `${who(p.person)} annual pay: ${p.payBasis==='takeHomeOnly'?'gross unknown':money(p.annualGrossPay)+' gross'}; ${money(p.annualTakeHomePay)} take-home.`,
      `${who(p.person)} annual pension contributions: employee ${money(p.employeePensionAnnual)}, employer ${money(p.employerPensionAnnual)}.`,
      `${who(p.person)} pension access ages: ${p.pensionAccessAges.join(', ') || 'not recorded'}; assumed remaining tax-free allowance (check previous lump sums and protections) ${money(p.pensionTaxFreeRemaining)}.`,
      `${who(p.person)} State Pension: ${p.statePensionAnnual===null?'unknown':money(p.statePensionAnnual)+'/year'} from ${p.statePensionStartMonth || 'not recorded'}; ISA subscriptions this year: ${p.isaSubscribedThisYear===null?'not confirmed':money(p.isaSubscribedThisYear)}.`
    ]));
    section('Assets & debt',[...Object.entries(context.assets).map(([owner,group])=>`${owner==='shared'?'Shared':who(owner)}: ${Object.entries(group).map(([kind,value])=>`${kind} ${money(value)}`).join(' · ')}`),...context.debts.map(d=>`${d.kind}: ${money(d.balance)} · rate ${d.annualRate ?? 'unknown'}% · term ${d.remainingYears ?? 'unknown'} years · ${d.mortgageType}`)]);
    section('Monthly budget & assumptions',[`Opening monthly income ${money(context.current.monthlyIncome)}; household and dated spending ${money(context.current.monthlySpending)}; debt payments ${money(context.current.monthlyDebtPayments)}; surplus ${money(context.current.monthlySurplus)}.`,`Inflation ${context.assumptions.inflation}%; pay/rent growth ${context.assumptions.incomeGrowth}%; investment growth ${Object.entries(context.assumptions.growth).map(([kind,rate])=>`${kind} ${rate}%`).join(', ')}.`,`Cash target ${context.assumptions.cashReserveMonths} months; ISA allowance assumed ${money(context.assumptions.isaAllowancePerPerson)} per person; withdrawal order ${context.assumptions.withdrawalOrder}; saving route ${context.assumptions.savingRouting}; retirement shock ${context.assumptions.retirementStress?'on':'off'}.`]);
    section('Dates & funding milestones',[...context.milestones.map(m=>`${who(m.person)} · ${m.event} ${m.month}: net assets ${money(m.netAssets)}, accessible ${money(m.accessible)}, monthly tax ${money(m.monthlyTax)}, monthly spending ${money(m.monthlySpending)}.`),...context.scheduled.map(e=>`${e.side} ${money(e.amount)} ${e.frequency}, from ${e.startMonth || 'opening'} to ${e.endMonth || 'ongoing'}; description excluded.`)]);
    section('Current plan & calculated alternatives',[`Current plan: first gap ${context.baseline.firstGap || 'none recorded'}; total shortfall ${money(context.baseline.unfunded)}, total tax/NI ${money(context.baseline.tax)}, net assets ${money(context.baseline.netAssets)}, accessible ${money(context.baseline.accessible)}, cash ${money(context.baseline.cash)} at the end.`,...brief.candidates.map(c=>`${INSIGHT_RECIPES[c.recipe].title}${c.person==='household'?'':' · '+who(c.person)+' only'}: first gap ${c.after.firstGap || 'none recorded'}, unfunded spending change ${money(c.delta.unfunded)}, total tax change ${money(c.delta.tax)}, ending net assets change ${money(c.delta.netAssets)}, accessible change ${money(c.delta.accessible)}, cash change ${money(c.delta.cash)}; monthly spending reduction ${money(c.monthlySpendingReduction)}${c.spendingYear?' from '+c.spendingYear:''}.${c.payoff?' Mortgage repaid '+money(c.payoff.paid)+'; remaining '+money(c.payoff.remaining)+'; estimated sale tax '+money(c.payoff.tax)+'.':''}`)]);
    section('Limits & questions to investigate',[...context.limitations.map(id=>AI_LIMITATIONS[id]),'Scheduled descriptions are excluded: AI sees amounts and dates, but cannot identify the purpose of a payment.',...brief.opportunities.map(id=>AI_FOLLOW_UPS[id].detail)]);
  }
  $('insights-ai-close').addEventListener('click',()=>$('insights-ai-dialog').close());
  $('insights-ai-send').addEventListener('click',async()=>{
    const pending=review,requestId=++analysisRequest;$('insights-ai-send').disabled=true;
    try{
      if(!pending || pending.key!==reviewKey())throw Error('Your plan changed. Close and reopen the review.');
      const token=await analysisToken();$('insights-ai-status').textContent='Reviewing the summary…';
      const response=await fetch(analysisEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(pending.brief),signal:AbortSignal.timeout(35000)});
      if(response.status===404 || !response.headers.get('content-type')?.includes('application/json'))throw Error('AI review needs the Netlify service. Calculated insights remain available locally.');
      const body=await response.json();if(!response.ok)throw Error(body.error || 'AI review is unavailable.');
      const result=validateAnalysisResult(body,pending.brief);
      if(requestId!==analysisRequest || pending.key!==reviewKey())throw Error('Your plan changed. Run a fresh review.');
      const results=$('insights-ai-results'),heading=el('h3','','Your AI review');heading.tabIndex=-1;results.replaceChildren(heading,el('p','muted',`${INSIGHT_GOALS[pending.brief.goal]} · through ${pending.brief.endMonth} · reviewed ${new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}. Today’s money; same tax rules and assumptions as your current scenario. Accessible investments exclude locked pensions and items needing a sale, and are before withdrawal tax.`));
      for(const id of reviewObservations(pending.brief,result))results.append(el('p',['uncertainty','gap','liquidity'].includes(id)?'estate-notice':'muted',AI_REASONS[id]));
      for(const item of result.recommendations){
        const candidate=pending.tested.find(c=>c.id===item.candidateId),card=el('section','insights-ai-pick'),person=candidate.options.retirementOwner;
        const name=person==='primary'?source().holdings.name:source().holdings.partnerName;
        card.append(el('h4','',INSIGHT_RECIPES[candidate.recipe].title+(person?` · ${name} only`:'')),el('p','',AI_SCENARIO_COPY[candidate.recipe].why));
        const impact=el('ul','insights-ai-impact');for(const text of candidateEffects(candidate.preview))impact.append(el('li','',text));card.append(impact,el('p','muted',AI_SCENARIO_COPY[candidate.recipe].tradeoff));
        if(candidate.preview.goalAfter)card.append(el('p','plan-ai-goal',`Goal checkpoint: ${describeGoalCheckpoint(candidate.preview.goalAfter)}`));
        if(candidate.preview.payoff?.remaining>0)card.append(el('p','estate-notice',`Partial repayment · ${money(candidate.preview.payoff.paid)} paid, ${money(candidate.preview.payoff.remaining)} remains; estimated sale tax ${money(candidate.preview.payoff.tax)}.`));
        const button=el('button','heading-action','Compare this scenario');button.type='button';button.addEventListener('click',()=>openPreview(candidate.recipe,candidate.options));card.append(button);results.append(card);
      }
      for(const id of result.followUps){const idea=AI_FOLLOW_UPS[id],card=el('section','insights-ai-follow-up');card.append(el('h4','',idea.title),el('p','muted',idea.detail),el('small','muted','Question to investigate · no saving calculated'));const button=el('button','heading-action',idea.section==='assets'?'Open Assets & debt':'Open Income & spending');button.type='button';button.addEventListener('click',()=>showSection(idea.section));card.append(button);results.append(card);}
      results.append(el('p','muted','AI selects comparisons from your plan. Descriptions and trade-offs are reviewed templates; figures come from the calculation engine. This is not a search for a guaranteed optimum.'));
      analysisKey=pending.key;$('insights-ai-dialog').close();heading.focus();heading.scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){$('insights-ai-status').textContent=error.name==='TimeoutError' ? 'Review timed out. Try again later.' : localAI && error instanceof TypeError?'The local AI bridge is unavailable. Restart it on port 8888 and try again.':error.message;}
    finally{$('insights-ai-send').disabled=false;}
  });
  $('insights-preview').addEventListener('click',()=>openPreview($('insights-recipe').value));$('insights-close').addEventListener('click',()=>$('insights-dialog').close());
  $('insights-view-lifeline').addEventListener('click',()=>{try{const trial=currentPreview();previewOnLifeline(trial.scenario,$('insights-trial-title').textContent);$('insights-dialog').close();$('insights-status').textContent='Temporary scenario preview opened on Lifeline. Apply it there or discard it.';showSection('planning');}catch(error){$('insights-trial-status').textContent=error.message;}});
  $('insights-goal').addEventListener('change',()=>{settings.goal=$('insights-goal').value;refresh();document.dispatchEvent(new Event('picture-updated'));});
  $('plan-goal-type').addEventListener('change',()=>{
    const type=$('plan-goal-type').value;if(!type){settings.planGoal=null;refresh();document.dispatchEvent(new Event('picture-updated'));return;}
    const input=source(),start=input.flow.timelineStartMonth||input.flow.asOfMonth,projection=input.key===cacheKey?baseline:projectPlan(input.flow,input.holdings,input.planning.scenario),retirementMonth=projection.retirementDates.primary||projection.retirementDates.partner;
    const targetMonth=type==='legacy'?projection.endMonth:type==='event'?shiftUiMonth(start,60):retirementMonth||shiftUiMonth(start,240);
    settings.planGoal=validateInsightSettings({...settings,planGoal:{type,person:type==='retireBy'&&input.holdings.partnerName?'household':'primary',targetMonth,targetAmount:null,targetMonthly:null}}).planGoal;
    if(type==='retireBy')settings.goal='retirement';else if(type==='legacy')settings.goal='legacy';else settings.goal='security';
    refresh();document.dispatchEvent(new Event('picture-updated'));
  });
  $('insights-apply').addEventListener('click',()=>{
    try{const trial=currentPreview();if(!trial.changed)return;applyScenario(trial.scenario);applied={sourceKey:source().key};syncUndo();$('insights-dialog').close();$('insights-status').textContent='Experiment applied. You can undo it, or save a named scenario in Plan.';showSection('planning');}catch(error){$('insights-trial-status').textContent=error.message;}
  });
  function undoApplied(){syncUndo();if(!applied)return;undoScenario();applied=null;banner.hidden=true;$('insights-undo').hidden=true;$('insights-status').textContent='Experiment undone.';if(!root.closest('[hidden]'))refresh();}
  function markApplied(){applied={sourceKey:source().key};syncUndo();}
  undo.addEventListener('click',undoApplied);$('insights-undo').addEventListener('click',undoApplied);
  $('insights-save-open').addEventListener('click',()=>{$('insights-save-form').hidden=false;$('insights-name').focus();});
  $('insights-save-form').addEventListener('submit',event=>{event.preventDefault();try{const trial=currentPreview();if(!trial.changed)return;saveScenario($('insights-name').value,trial.scenario);$('insights-trial-status').textContent='Named scenario saved. Your current plan is unchanged.';$('insights-save-form').hidden=true;}catch(error){$('insights-trial-status').textContent=error.message;}});
  document.addEventListener('picture-updated',()=>{if(applied)syncUndo();if(analysisKey && analysisKey!==reviewKey()){$('insights-ai-results').replaceChildren();analysisKey='';analysisRequest++;}});
  function restore(value){settings=value ? validateInsightSettings(value) : {version:1,goal:'security'};cacheKey='';preview=null;applied=null;analysisRequest++;analysisKey='';$('insights-ai-results').replaceChildren();$('insights-ai-dialog').close();banner.hidden=true;$('insights-dialog').close();if(!root.closest('[hidden]'))refresh();}
  return {refresh,restore,markApplied,snapshot:()=>structuredClone(settings)};
}
