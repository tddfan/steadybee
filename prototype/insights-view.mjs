import {AI_REASONS,buildAnalysisBrief,validateAnalysisResult} from './insights-ai.mjs?v=20261024persona1';
import {INSIGHT_GOALS,INSIGHT_RECIPES,buildInsights,createInsightPreview,insightSourceKey,insightSummary,validateInsightSettings} from './insights.mjs?v=20261024persona1';
import {projectPlan} from './planning.mjs?v=20261024persona1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
export function mountInsights(root,getInputs,{analysisToken,showSection,applyScenario,undoScenario,saveScenario}){
  let settings={version:1,goal:'security'},cacheKey='',baseline=null,preview=null,applied=null,analysisKey='',analysisRequest=0;
  const $=id=>root.querySelector(`#${id}`);
  root.innerHTML=`<div class="estate-heading"><div><h1 id="insights-title" tabindex="-1">Insights</h1><p class="muted">Calculated checks and what-ifs from your plan</p></div><label class="insights-goal">Focus<select id="insights-goal"></select></label></div><p id="insights-error" role="alert" class="form-error" hidden></p><p id="insights-basis" class="muted"></p><div id="insights-cards" class="insights-cards"></div><details class="estate-card insights-more"><summary>More what-ifs</summary><p class="muted">Preview an experiment before applying it to Planning.</p><div class="insights-more-controls"><label for="insights-recipe">Choose an experiment</label><select id="insights-recipe"></select><button id="insights-preview" class="button button-primary" type="button">Preview selected what-if</button></div></details><p id="insights-status" role="status"></p><button id="insights-undo" class="heading-action" type="button" hidden>Undo last applied experiment</button><details class="estate-card estate-details"><summary>How these insights work</summary><p>The existing Planning engine calculates every result using your current household and scenario. Figures are illustrative, with the same return, tax, access and debt assumptions. Missing inputs are shown before experiments. Lower tax alone is not an optimisation goal.</p><p>Previews are temporary. Applying changes Planning assumptions; saving keeps a named scenario that recalculates against your current household. Neither changes the recorded assets, pay or spending inputs. Optional AI review prioritises these calculated facts and supported experiments. It cannot edit your plan or supply new numbers.</p></details><section class="estate-card insights-ai"><div><h2>AI review</h2><p class="muted">Ranks existing checks and what-ifs. It does not independently validate your plan or create new calculations.</p></div><button id="insights-ai-open" class="heading-action" type="button">Review AI summary</button><div id="insights-ai-results" aria-live="polite"></div></section><dialog id="insights-ai-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2>Review before sending</h2><button id="insights-ai-close" class="heading-action" aria-label="Close AI review" type="button">×</button></div><p>OpenAI receives the rounded household totals and available what-ifs listed below to rank the checks that may need attention. Names, ages, email, account identifiers, individual holdings and detailed pay records are excluded. Your plan stays unchanged.</p><p class="muted">Illustrative prioritisation · only approved pilot accounts can send a review.</p><details><summary>See what will be sent</summary><ul id="insights-ai-payload" class="insights-ai-payload"></ul></details><div class="insights-actions"><button id="insights-ai-send" class="button button-primary" type="button">Send totals to OpenAI</button></div><p id="insights-ai-status" role="status"></p></dialog><dialog id="insights-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2 id="insights-trial-title">Compare experiment</h2><button id="insights-close" class="heading-action" type="button" aria-label="Close experiment preview">×</button></div><p id="insights-trial-basis" class="insights-context"></p><div id="insights-result" class="insights-result"></div><div id="insights-highlights" class="insights-highlights"></div><details class="insights-full-comparison"><summary>Full comparison</summary><div id="insights-comparison"></div></details><p id="insights-tradeoff" class="insights-scope"></p><p id="insights-trial-warning" class="estate-notice" hidden></p><details class="estate-details"><summary>Assumptions and missing information</summary><ul id="insights-trial-notes"></ul></details><div class="insights-actions"><button id="insights-apply" type="button" class="button button-primary">Apply to Planning</button><button id="insights-save-open" type="button" class="heading-action">Save scenario…</button></div><form id="insights-save-form" hidden><label for="insights-name">Scenario name</label><div class="insights-actions"><input id="insights-name" maxlength="60" required><button type="submit" class="button button-primary">Save without applying</button></div></form><p id="insights-trial-status" role="status"></p></dialog>`;
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
  function openPreview(recipe){
    message('');
    try{
      const input=source();preview=createInsightPreview(input.flow,input.holdings,input.planning.scenario,recipe,input.key===cacheKey ? baseline : null);
      $('insights-trial-title').textContent=INSIGHT_RECIPES[recipe].title;$('insights-tradeoff').textContent=INSIGHT_RECIPES[recipe].tradeoff;
      $('insights-trial-basis').textContent=`Through ${preview.after.endMonth} · today’s money`;
      $('insights-result').textContent=preview.changed ? (Math.abs(preview.delta.unfunded)>=1 ? `${money(Math.abs(preview.delta.unfunded))} ${preview.delta.unfunded<0 ? 'less' : 'more'} unfunded spending` : Math.abs(preview.delta.netAssets)>=1 ? `${money(Math.abs(preview.delta.netAssets))} ${preview.delta.netAssets>0 ? 'more' : 'less'} net assets at the end` : 'The monthly funding path changes') : 'No change to this plan';
      if(!preview.changed)$('insights-tradeoff').textContent=preview.noChangeReason;
      else if(preview.recipe==='spendLess'){$('insights-tradeoff').textContent=`From January ${preview.spendingYear}, regular household spending falls by about ${money(preview.monthlySpendingReduction)} a month in today’s money. Debt payments and dated costs stay the same.`;}
      else if(preview.changedPeople?.length){const people=preview.changedPeople.join(' and '),direction=preview.recipe==='retireLater'?'one year later':'one year earlier';$('insights-tradeoff').textContent=`Moves the recorded retirement date ${direction} for ${people}. ${preview.recipe==='retireLater'?'Recorded pay and workplace contributions continue for that extra year.':'Removes a year of their recorded pay and workplace contributions.'}`;}
      const highlights=$('insights-highlights');highlights.replaceChildren();
      for(const [key,label] of [['unfunded','Unfunded spending'],['tax','Total tax & NI over the plan'],['netAssets','Net assets at end']]){const card=el('div','insights-metric');card.append(el('span','muted',label),el('strong','',money(preview.after[key])),el('small','',`${preview.delta[key]>=.5?'+':''}${money(preview.delta[key])} vs current`));highlights.append(card);}
      $('insights-apply').disabled=!preview.changed;$('insights-save-open').disabled=!preview.changed;
      $('insights-dialog').querySelector('.insights-full-comparison').open=false;
      const table=el('table','insights-comparison-table'),head=el('tr');for(const label of ['Measure','Current','Experiment','Change'])head.append(el('th','',label));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
      const row=(label,before,after,delta='—')=>{const line=el('tr');const heading=el('th','',label);heading.scope='row';line.append(heading);for(const [name,value] of [['Current',before],['Experiment',after],['Change',delta]]){const cell=el('td','',value);cell.dataset.label=name;line.append(cell);}body.append(line);};
      row('First spending gap',preview.before.firstGap || 'No recorded gap',preview.after.firstGap || 'No recorded gap');
      for(const [key,label] of [['unfunded','Total unfunded spending'],['tax','Total tax & NI over the plan'],['accessible','Accessible assets at end'],['netAssets','Net assets at end'],['cash','Cash at end']])row(label,money(preview.before[key]),money(preview.after[key]),`${preview.delta[key]>=.5 ? '+' : ''}${money(preview.delta[key])}`);
      table.append(body);$('insights-comparison').replaceChildren(table);
      const warnings=[...preview.warnings];
      if(preview.payoff?.remaining>0)warnings.push(`Mortgage payoff is partial: ${money(preview.payoff.remaining)} remains.`);
      if(preview.stress && !preview.stress.loss)warnings.push('No eligible investment value is affected by the shock in this scenario.');
      $('insights-trial-warning').hidden=!warnings.length;$('insights-trial-warning').textContent=warnings.length ? 'Partial estimate · see assumptions below' : '';
      $('insights-trial-notes').replaceChildren(...warnings.map(text=>el('li','',text)));
      $('insights-trial-status').textContent='Preview only — nothing applied or saved.';$('insights-save-form').hidden=true;$('insights-name').value=INSIGHT_RECIPES[recipe].title;
      $('insights-dialog').showModal();$('insights-close').focus();
    }catch(error){message(error.message);}
  }
  let review=null;
  $('insights-ai-open').addEventListener('click',()=>{
    try{const input=source(),projection=input.key===cacheKey ? baseline : projectPlan(input.flow,input.holdings,input.planning.scenario),available=buildInsights(input.flow,input.holdings,input.planning.scenario,projection,settings.goal).available;
      review={key:input.key+settings.goal,brief:buildAnalysisBrief(insightSummary(projection),settings.goal,available)};
      const facts=review.brief.facts,byId=id=>facts.find(fact=>fact.id===id),labels=[['gap','Total planned spending shortfall'],['tax','Estimated tax & NI over the plan'],['liquidity','Accessible assets at the end · before withdrawal tax'],['resilience','Net assets at the end']];
      const payload=$('insights-ai-payload');payload.replaceChildren(el('li','',`Projection period · through ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(`${review.brief.endMonth}-15T12:00:00`))}`),el('li','',`Focus · ${INSIGHT_GOALS[review.brief.goal]}`));
      for(const [id,label] of labels)payload.append(el('li','',`${label} · ${money(byId(id).value)}`));payload.append(el('li','',byId('uncertainty').flag?'Input check · some tax or planning details are incomplete':'Input check · no known tax or planning limitations'));payload.append(el('li','',`Eligible what-ifs · ${review.brief.recipes.map(key=>INSIGHT_RECIPES[key].title).join('; ') || 'none'}`));$('insights-ai-status').textContent='Nothing sent yet.';$('insights-ai-dialog').showModal();$('insights-ai-close').focus();
    }catch(error){message(error.message);}
  });
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
      const results=$('insights-ai-results');results.replaceChildren(el('h3','','AI-selected checks'));
      for(const id of result.observations){const fact=pending.brief.facts.find(f=>f.id===id);results.append(el('p','',AI_REASONS[id]));if(id!=='uncertainty')results.append(el('strong','',money(fact.value)));}
      for(const recipe of result.experiments){const button=el('button','heading-action',INSIGHT_RECIPES[recipe].title);button.type='button';button.addEventListener('click',()=>openPreview(recipe));results.append(button);}
      results.append(el('p','muted','AI selected the priorities; figures and explanations come from the calculation engine. Review assumptions before acting.'));
      analysisKey=pending.key;$('insights-ai-dialog').close();
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
