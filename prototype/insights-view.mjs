import {evaluateGoalOutlook} from './goal-outlook.mjs';
import {AI_REASONS,validateAnalysisResult} from './insights-ai.mjs?v=20261024context4';
import {INSIGHT_GOALS,INSIGHT_RECIPES,buildInsights,createInsightPreview,insightSourceKey,insightSummary,validateInsightSettings} from './insights.mjs?v=20261024context4';
import {buildContextualAnalysis,AI_FOLLOW_UPS,reviewObservations,candidateEffects,AI_LIMITATIONS} from './insights-ai-context.mjs?v=20261024context4';
import {projectPlan} from './planning.mjs?v=20261024persona1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
export function mountInsights(root,getInputs,{analysisToken,showSection,applyScenario,undoScenario,saveScenario}){
  let goalType='',settings={version:1,goal:'security'},cacheKey='',baseline=null,preview=null,applied=null,analysisKey='',analysisRequest=0;
  const $=id=>root.querySelector(`#${id}`);
  root.innerHTML=`<div class="estate-heading"><div><h1 id="insights-title" tabindex="-1">Explore changes</h1><p class="muted">Choices to explore for your goal</p></div><label class="insights-goal">Focus<select id="insights-goal"></select></label></div><p id="insights-error" role="alert" class="form-error" hidden></p><p id="insights-basis" class="muted"></p><div id="insights-cards" class="insights-cards"></div><details class="estate-card insights-more"><summary>More what-ifs</summary><p class="muted">Preview an experiment before applying it to Planning.</p><div class="insights-more-controls"><label for="insights-recipe">Choose an experiment</label><select id="insights-recipe"></select><button id="insights-preview" class="button button-primary" type="button">Preview selected what-if</button></div></details><p id="insights-status" role="status"></p><button id="insights-undo" class="heading-action" type="button" hidden>Undo last applied experiment</button><details class="estate-card estate-details"><summary>How these insights work</summary><p>The existing Planning engine calculates every result using your current household and scenario. Figures are illustrative, with the same return, tax, access and debt assumptions. Missing inputs are shown before experiments. Lower tax alone is not an optimisation goal.</p><p>Previews are temporary. Applying changes Planning assumptions; saving keeps a named scenario that recalculates against your current household. Neither changes the recorded assets, pay or spending inputs. Optional AI review prioritises these calculated facts and supported experiments. It cannot edit your plan or supply new numbers.</p></details><section class="estate-card insights-ai"><div><h2>AI review</h2><p class="muted">Explains up to three calculated what-ifs for your selected focus. Preview any change before applying it.</p></div><button id="insights-ai-open" class="heading-action" type="button">Explore with AI</button><div id="insights-ai-results" aria-live="polite"></div></section><dialog id="insights-ai-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2>Review before sending</h2><button id="insights-ai-close" class="heading-action" aria-label="Close AI review" type="button">×</button></div><p>Your reviewed summary passes through Steadybee’s server to Groq. It includes ages, income and pension contributions for each person in your plan, grouped asset balances, loan terms, planned dates and calculated what-if results. Names, email, account identifiers, holding names and notes stay on this device. A couple’s review includes both people’s financial details. Review the summary below before sending; your plan stays unchanged.</p><p class="muted">Private pilot · financial amounts remain sensitive even without names. Provider retention follows your Groq account settings; this app cannot verify them. <a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Groq data handling ↗</a></p><details><summary>See what will be sent</summary><div id="insights-ai-payload" class="insights-ai-payload"></div></details><div class="insights-actions"><button id="insights-ai-send" class="button button-primary" type="button">Send financial summary to Groq</button></div><p id="insights-ai-status" role="status"></p></dialog><dialog id="insights-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2 id="insights-trial-title">Compare experiment</h2><button id="insights-close" class="heading-action" type="button" aria-label="Close experiment preview">×</button></div><p id="insights-trial-basis" class="insights-context"></p><div id="insights-result" class="insights-result"></div><div id="insights-highlights" class="insights-highlights"></div><details class="insights-full-comparison"><summary>Full comparison</summary><div id="insights-comparison"></div></details><p id="insights-tradeoff" class="insights-scope"></p><p id="insights-trial-warning" class="estate-notice" hidden></p><details class="estate-details"><summary>Assumptions and missing information</summary><ul id="insights-trial-notes"></ul></details><div class="insights-actions"><button id="insights-apply" type="button" class="button button-primary">Apply to my plan</button><button id="insights-save-open" type="button" class="heading-action">Save scenario…</button></div><form id="insights-save-form" hidden><label for="insights-name">Scenario name</label><div class="insights-actions"><input id="insights-name" maxlength="60" required><button type="submit" class="button button-primary">Save without applying</button></div></form><p id="insights-trial-status" role="status"></p></dialog>`;
  for(const [value,label] of Object.entries(INSIGHT_GOALS))$('insights-goal').add(new Option(label,value));
  const banner=el('div','insights-applied-banner');banner.id='insights-applied-banner';banner.hidden=true;
  banner.append(el('span','','An Insights experiment is applied. '));const undo=el('button','plan-text-button','Undo experiment');undo.type='button';banner.append(undo);document.querySelector('#planning-content').prepend(banner);
  function message(text){$('insights-error').textContent=text || '';$('insights-error').hidden=!text;}
  function source(){const input=getInputs();return {...input,key:insightSourceKey(input.flow,input.holdings,input.planning.scenario)};}
  function currentPreview(){if(!preview)throw new Error('Open an experiment preview first.');if(source().key!==preview.sourceKey)throw new Error('Your inputs or scenario changed. Close this preview and run it again.');return preview;}
  function syncUndo(){
    const same=applied && source().key===applied.sourceKey;
    banner.hidden=!same;$('insights-undo').hidden=!same;
    if(applied && !same)applied=null;
  }
  function refresh(){
    const type=getInputs().journey?.goal?.type;if(type && type!==goalType){goalType=type;settings.goal=type==='legacy'?'legacy':type==='independence'?'retirement':'security';}
    message('');syncUndo();if(analysisKey && analysisKey!==source().key+settings.goal){$('insights-ai-results').replaceChildren();analysisKey='';analysisRequest++;}$('insights-goal').value=settings.goal;
    try{
      const input=source();if(input.key!==cacheKey){baseline=projectPlan(input.flow,input.holdings,input.planning.scenario);cacheKey=input.key;}
      const findings=buildInsights(input.flow,input.holdings,input.planning.scenario,baseline,settings.goal),summary=insightSummary(baseline);
      $('insights-basis').textContent=`Current scenario · through ${summary.endMonth} · today’s money${summary.incomplete ? ' · incomplete inputs' : ''}`;
      const cards=$('insights-cards');cards.replaceChildren();
      for(const item of findings.cards){const card=el('section','estate-card insight-card');card.append(el('span','insight-priority',item.priority),el('h2','',item.title));if(item.amount!=null)card.append(el('strong','insight-amount',money(item.amount)));card.append(el('p','muted',item.detail));const button=el('button','heading-action',item.recipe ? 'Preview experiment' : 'Review inputs');button.type='button';button.addEventListener('click',()=>item.recipe ? openPreview(item.recipe) : showSection(item.section));card.append(button);cards.append(card);}
      const recipes=$('insights-recipe'),previous=recipes.value,featured=new Set(findings.cards.map(item=>item.recipe).filter(Boolean)),more=findings.available.filter(key=>!featured.has(key));recipes.replaceChildren();for(const key of more)recipes.add(new Option(INSIGHT_RECIPES[key].title,key));if(more.includes(previous))recipes.value=previous;$('insights-preview').disabled=!more.length;$('insights-preview').hidden=!more.length;recipes.disabled=!more.length;root.querySelector('.insights-more').hidden=!more.length;
    }catch(error){message(error.message);$('insights-cards').replaceChildren();$('insights-basis').textContent='Check the recorded inputs before comparing experiments.';$('insights-preview').disabled=true;}
  }
  function openPreview(recipe,options={}){
    message('');
    try{
      const input=source();preview=createInsightPreview(input.flow,input.holdings,input.planning.scenario,recipe,input.key===cacheKey ? baseline : null,options);
      $('insights-trial-title').textContent=INSIGHT_RECIPES[recipe].title+(options.retirementOwner?` · ${options.retirementOwner==='primary'?input.holdings.name:input.holdings.partnerName} only`:'');$('insights-tradeoff').textContent=INSIGHT_RECIPES[recipe].tradeoff;
      $('insights-trial-basis').textContent=`Through ${preview.after.endMonth} · today’s money`;
      $('insights-result').textContent=preview.changed ? (Math.abs(preview.delta.unfunded)>=1 ? `${money(Math.abs(preview.delta.unfunded))} ${preview.delta.unfunded<0 ? 'less' : 'more'} unfunded spending` : Math.abs(preview.delta.netAssets)>=1 ? `${money(Math.abs(preview.delta.netAssets))} ${preview.delta.netAssets>0 ? 'more' : 'less'} net assets at the end` : 'The monthly funding path changes') : 'No change to this plan';
      if(!preview.changed)$('insights-tradeoff').textContent=preview.noChangeReason;
      else if(preview.recipe==='spendLess'){$('insights-tradeoff').textContent=`From January ${preview.spendingYear}, regular household spending falls by about ${money(preview.monthlySpendingReduction)} a month in today’s money. Debt payments and dated costs stay the same.`;}
      else if(preview.changedPeople?.length){const people=preview.changedPeople.join(' and '),direction=preview.recipe==='retireLater'?'one year later':'one year earlier';$('insights-tradeoff').textContent=`Moves the recorded retirement date ${direction} for ${people}. ${preview.recipe==='retireLater'?'Recorded pay and workplace contributions continue for that extra year.':'Removes a year of their recorded pay and workplace contributions.'}`;}
      const highlights=$('insights-highlights');highlights.replaceChildren();
      const beforeGoal=evaluateGoalOutlook(input,{includeStress:false}),afterGoal=evaluateGoalOutlook({...input,planning:{...input.planning,scenario:preview.scenario}},{includeStress:false});
      const goalEffect=el('p','insights-context',`Goal outlook: ${beforeGoal.label} → ${afterGoal.label}. Spending funded: ${beforeGoal.coveragePercent.toFixed(1)}% → ${afterGoal.coveragePercent.toFixed(1)}%. ${afterGoal.firstGap ? 'First shortfall: '+afterGoal.firstGap.month+'. ' : ''}${afterGoal.reasons[0] || ''}`);highlights.append(goalEffect);
      for(const [key,label] of [['unfunded','Unfunded spending'],['tax','Total tax & NI over the plan'],['netAssets','Net assets at end']]){const card=el('div','insights-metric');card.append(el('span','muted',label),el('strong','',money(preview.after[key])),el('small','',`${preview.delta[key]>=.5?'+':''}${money(preview.delta[key])} vs current`));highlights.append(card);}
      $('insights-apply').disabled=!preview.changed;$('insights-save-open').disabled=!preview.changed;
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
      const availability=await fetch('/.netlify/functions/planning-analysis',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(12000)});
      if(!availability.headers.get('content-type')?.includes('application/json'))throw Error('AI review needs the Netlify service. Calculated insights remain available locally.');
      const eligibility=await availability.json();if(!availability.ok || !eligibility.available)throw Error(eligibility.error || 'AI review is unavailable for this account.');
      if(!$('insights-ai-dialog').open)return;
      $('insights-ai-status').textContent='Calculating comparisons…';
      await new Promise(resolve=>setTimeout(resolve,0));
      const input=source(),projection=input.key===cacheKey ? baseline : projectPlan(input.flow,input.holdings,input.planning.scenario);
      review={key:input.key+settings.goal,...buildContextualAnalysis(input.flow,input.holdings,input.planning,projection,settings.goal)};
      renderReviewPayload(review.brief,input.holdings);$('insights-ai-status').textContent='Nothing sent yet.';$('insights-ai-send').disabled=false;$('insights-ai-close').focus();
    }catch(error){$('insights-ai-status').textContent=error.message;}
    finally{$('insights-ai-open').disabled=false;}
  });
  function renderReviewPayload(brief,holdings){
    const payload=$('insights-ai-payload'),context=brief.context;
    const section=(title,lines)=>{const box=el('details','insights-payload-section');box.append(el('summary','',title));const list=el('ul');list.append(...lines.map(text=>el('li','',text)));box.append(list);payload.append(box);};
    const who=person=>person==='primary'?'Person A':person==='partner'?'Person B':'Household';
    payload.replaceChildren(el('p','',`${INSIGHT_GOALS[brief.goal]} · ${context.startMonth} to ${brief.endMonth} · rounded pounds. Current pay is annual; opening cash flow is monthly; comparison results use today’s money.`));
    payload.append(el('p','muted',`On this device: Person A is ${holdings.name}${holdings.partnerName?`; Person B is ${holdings.partnerName}`:''}. These names are not sent.`));
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
      if(!pending || pending.key!==source().key+settings.goal)throw Error('Your plan changed. Close and reopen the review.');
      const token=await analysisToken();$('insights-ai-status').textContent='Reviewing the summary…';
      const response=await fetch('/.netlify/functions/planning-analysis',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(pending.brief),signal:AbortSignal.timeout(35000)});
      if(response.status===404 || !response.headers.get('content-type')?.includes('application/json'))throw Error('AI review needs the Netlify service. Calculated insights remain available locally.');
      const body=await response.json();if(!response.ok)throw Error(body.error || 'AI review is unavailable.');
      const result=validateAnalysisResult(body,pending.brief);
      if(requestId!==analysisRequest || pending.key!==source().key+settings.goal)throw Error('Your plan changed. Run a fresh review.');
      const results=$('insights-ai-results'),heading=el('h3','','Your AI review');heading.tabIndex=-1;results.replaceChildren(heading,el('p','muted',`${INSIGHT_GOALS[pending.brief.goal]} · through ${pending.brief.endMonth} · reviewed ${new Date().toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}. Today’s money; same tax rules and assumptions as your current scenario. Accessible investments exclude locked pensions and items needing a sale, and are before withdrawal tax.`));
      for(const id of reviewObservations(pending.brief,result))results.append(el('p',['uncertainty','gap','liquidity'].includes(id)?'estate-notice':'muted',AI_REASONS[id]));
      for(const item of result.recommendations){
        const candidate=pending.tested.find(c=>c.id===item.candidateId),card=el('section','insights-ai-pick'),person=candidate.options.retirementOwner;
        const name=person==='primary'?source().holdings.name:source().holdings.partnerName;
        card.append(el('h4','',INSIGHT_RECIPES[candidate.recipe].title+(person?` · ${name} only`:'')),el('p','',item.why));
        const impact=el('ul','insights-ai-impact');for(const text of candidateEffects(candidate.preview))impact.append(el('li','',text));card.append(impact,el('p','muted',item.tradeoff));
        if(candidate.preview.payoff?.remaining>0)card.append(el('p','estate-notice',`Partial repayment · ${money(candidate.preview.payoff.paid)} paid, ${money(candidate.preview.payoff.remaining)} remains; estimated sale tax ${money(candidate.preview.payoff.tax)}.`));
        const button=el('button','heading-action','Compare this scenario');button.type='button';button.addEventListener('click',()=>openPreview(candidate.recipe,candidate.options));card.append(button);results.append(card);
      }
      for(const id of result.followUps){const idea=AI_FOLLOW_UPS[id],card=el('section','insights-ai-follow-up');card.append(el('h4','',idea.title),el('p','muted',idea.detail),el('small','muted','Question to investigate · no saving calculated'));const button=el('button','heading-action',idea.section==='assets'?'Open Assets & debt':'Open Income & spending');button.type='button';button.addEventListener('click',()=>showSection(idea.section));card.append(button);results.append(card);}
      results.append(el('p','muted','AI explains and prioritises. Figures come from calculated scenarios using the same assumptions; this is not a search for a guaranteed optimum.'));
      analysisKey=pending.key;$('insights-ai-dialog').close();heading.focus();heading.scrollIntoView({block:'start',behavior:'smooth'});
    }catch(error){$('insights-ai-status').textContent=error.name==='TimeoutError' ? 'Review timed out. Try again later.' : error.message;}
    finally{$('insights-ai-send').disabled=false;}
  });
  $('insights-preview').addEventListener('click',()=>openPreview($('insights-recipe').value));$('insights-close').addEventListener('click',()=>$('insights-dialog').close());
  $('insights-goal').addEventListener('change',()=>{settings.goal=$('insights-goal').value;refresh();document.dispatchEvent(new Event('picture-updated'));});
  $('insights-apply').addEventListener('click',()=>{
    try{const trial=currentPreview();if(!trial.changed)return;applyScenario(trial.scenario);applied={sourceKey:source().key};syncUndo();$('insights-dialog').close();$('insights-status').textContent='Experiment applied. You can undo it, or save a named scenario in Planning.';showSection('planning');}catch(error){$('insights-trial-status').textContent=error.message;}
  });
  function undoApplied(){syncUndo();if(!applied)return;undoScenario();applied=null;banner.hidden=true;$('insights-undo').hidden=true;$('insights-status').textContent='Experiment undone.';if(!root.closest('[hidden]'))refresh();}
  undo.addEventListener('click',undoApplied);$('insights-undo').addEventListener('click',undoApplied);
  $('insights-save-open').addEventListener('click',()=>{$('insights-save-form').hidden=false;$('insights-name').focus();});
  $('insights-save-form').addEventListener('submit',event=>{event.preventDefault();try{const trial=currentPreview();if(!trial.changed)return;saveScenario($('insights-name').value,trial.scenario);$('insights-trial-status').textContent='Named scenario saved. Your current Planning scenario is unchanged.';$('insights-save-form').hidden=true;}catch(error){$('insights-trial-status').textContent=error.message;}});
  document.addEventListener('picture-updated',()=>{if(applied)syncUndo();if(analysisKey && analysisKey!==source().key+settings.goal){$('insights-ai-results').replaceChildren();analysisKey='';analysisRequest++;}});
  function restore(value){settings=value ? validateInsightSettings(value) : {version:1,goal:'security'};cacheKey='';preview=null;applied=null;analysisRequest++;analysisKey='';$('insights-ai-results').replaceChildren();$('insights-ai-dialog').close();banner.hidden=true;$('insights-dialog').close();if(!root.closest('[hidden]'))refresh();}
  return {refresh,restore,snapshot:()=>structuredClone(settings)};
}
