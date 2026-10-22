import {INSIGHT_GOALS,INSIGHT_RECIPES,buildInsights,createInsightPreview,insightSourceKey,insightSummary,validateInsightSettings} from './insights.mjs?v=20261022insights1';
import {projectPlan} from './planning.mjs?v=20261022insights1';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
export function mountInsights(root,getInputs,{showSection,applyScenario,undoScenario,saveScenario}){
  let settings={version:1,goal:'security'},cacheKey='',baseline=null,preview=null,applied=null;
  const $=id=>root.querySelector(`#${id}`);
  root.innerHTML=`<div class="estate-heading"><div><h1 id="insights-title" tabindex="-1">Insights</h1><p class="muted">Calculated checks and what-ifs from your plan</p></div><label class="insights-goal">Focus<select id="insights-goal"></select></label></div><p id="insights-error" role="alert" class="form-error" hidden></p><p id="insights-basis" class="muted"></p><div id="insights-cards" class="insights-cards"></div><section class="estate-card insights-experiment"><div><h2>Try a change</h2><p class="muted">Preview first. Your household and Planning stay unchanged until you apply.</p></div><label class="visually-hidden" for="insights-recipe">Choose experiment</label><select id="insights-recipe"></select><button id="insights-preview" class="button button-primary" type="button">Preview</button></section><p id="insights-status" role="status"></p><button id="insights-undo" class="heading-action" type="button" hidden>Undo last applied experiment</button><details class="estate-card estate-details"><summary>How these insights work</summary><p>The existing Planning engine calculates every result using your current household and scenario. Figures are illustrative, with the same return, tax, access and debt assumptions. Missing inputs are shown before experiments. Lower tax alone is not an optimisation goal.</p><p>Previews are temporary. Applying changes Planning assumptions; saving keeps a named scenario that recalculates against your current household. Neither changes the recorded assets, pay or spending inputs. AI analysis is not used.</p></details><dialog id="insights-dialog" class="form-dialog insights-dialog"><div class="estate-section-heading"><h2 id="insights-trial-title">Compare experiment</h2><button id="insights-close" class="heading-action" type="button" aria-label="Close experiment preview">×</button></div><p id="insights-tradeoff" class="muted"></p><p id="insights-trial-basis" class="muted"></p><div id="insights-comparison"></div><p id="insights-trial-warning" class="estate-notice" hidden></p><details class="estate-details"><summary>Assumptions and missing information</summary><ul id="insights-trial-notes"></ul></details><div class="insights-actions"><button id="insights-apply" type="button" class="button button-primary">Apply to Planning</button><button id="insights-save-open" type="button" class="heading-action">Save scenario…</button></div><form id="insights-save-form" hidden><label for="insights-name">Scenario name</label><div class="insights-actions"><input id="insights-name" maxlength="60" required><button type="submit" class="button button-primary">Save without applying</button></div></form><p id="insights-trial-status" role="status"></p></dialog>`;
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
    message('');syncUndo();$('insights-goal').value=settings.goal;
    try{
      const input=source();if(input.key!==cacheKey){baseline=projectPlan(input.flow,input.holdings,input.planning.scenario);cacheKey=input.key;}
      const findings=buildInsights(input.flow,input.holdings,input.planning.scenario,baseline,settings.goal),summary=insightSummary(baseline);
      $('insights-basis').textContent=`Current scenario · through ${summary.endMonth} · today’s money${summary.incomplete ? ' · incomplete inputs' : ''}`;
      const cards=$('insights-cards');cards.replaceChildren();
      for(const item of findings.cards){const card=el('section','estate-card insight-card');card.append(el('span','insight-priority',item.priority),el('h2','',item.title));if(item.amount!=null)card.append(el('strong','insight-amount',money(item.amount)));card.append(el('p','muted',item.detail));const button=el('button','heading-action',item.recipe ? 'Preview experiment' : 'Review inputs');button.type='button';button.addEventListener('click',()=>item.recipe ? openPreview(item.recipe) : showSection(item.section));card.append(button);cards.append(card);}
      const recipes=$('insights-recipe'),previous=recipes.value;recipes.replaceChildren();for(const key of findings.available)recipes.add(new Option(INSIGHT_RECIPES[key].title,key));if(findings.available.includes(previous))recipes.value=previous;$('insights-preview').disabled=!findings.available.length;
    }catch(error){message(error.message);$('insights-cards').replaceChildren();$('insights-basis').textContent='Check the recorded inputs before comparing experiments.';$('insights-preview').disabled=true;}
  }
  function openPreview(recipe){
    message('');
    try{
      const input=source();preview=createInsightPreview(input.flow,input.holdings,input.planning.scenario,recipe,input.key===cacheKey ? baseline : null);
      $('insights-trial-title').textContent=INSIGHT_RECIPES[recipe].title;$('insights-tradeoff').textContent=INSIGHT_RECIPES[recipe].tradeoff;
      $('insights-trial-basis').textContent=`Same household and horizon · through ${preview.after.endMonth} · today’s money. Accessible assets are before withdrawal tax.`;
      const table=el('table','insights-comparison-table'),head=el('tr');for(const label of ['Measure','Current','Experiment','Change'])head.append(el('th','',label));const thead=el('thead');thead.append(head);table.append(thead);const body=el('tbody');
      const row=(label,before,after,delta='—')=>{const line=el('tr');const heading=el('th','',label);heading.scope='row';line.append(heading);for(const [name,value] of [['Current',before],['Experiment',after],['Change',delta]]){const cell=el('td','',value);cell.dataset.label=name;line.append(cell);}body.append(line);};
      row('First spending gap',preview.before.firstGap || 'No recorded gap',preview.after.firstGap || 'No recorded gap');
      for(const [key,label] of [['unfunded','Total unfunded spending'],['tax','Cumulative tax & NI'],['accessible','Accessible assets at end'],['netAssets','Net assets at end'],['cash','Cash at end']])row(label,money(preview.before[key]),money(preview.after[key]),`${preview.delta[key]>0 ? '+' : ''}${money(preview.delta[key])}`);
      table.append(body);$('insights-comparison').replaceChildren(table);
      const warnings=[...preview.warnings];
      if(preview.payoff?.remaining>0)warnings.push(`Mortgage payoff is partial: ${money(preview.payoff.remaining)} remains.`);
      if(preview.stress && !preview.stress.loss)warnings.push('No eligible investment value is affected by the shock in this scenario.');
      $('insights-trial-warning').hidden=!warnings.length;$('insights-trial-warning').textContent=warnings.length ? 'Partial illustration: review missing information before relying on the comparison.' : '';
      $('insights-trial-notes').replaceChildren(...warnings.map(text=>el('li','',text)));
      $('insights-trial-status').textContent='Preview only — nothing applied or saved.';$('insights-save-form').hidden=true;$('insights-name').value=INSIGHT_RECIPES[recipe].title;
      $('insights-dialog').showModal();
    }catch(error){message(error.message);}
  }
  $('insights-preview').addEventListener('click',()=>openPreview($('insights-recipe').value));$('insights-close').addEventListener('click',()=>$('insights-dialog').close());
  $('insights-goal').addEventListener('change',()=>{settings.goal=$('insights-goal').value;refresh();document.dispatchEvent(new Event('picture-updated'));});
  $('insights-apply').addEventListener('click',()=>{
    try{const trial=currentPreview();applyScenario(trial.scenario);applied={sourceKey:source().key};syncUndo();$('insights-dialog').close();$('insights-status').textContent='Experiment applied. You can undo it, or save a named scenario in Planning.';showSection('planning');}catch(error){$('insights-trial-status').textContent=error.message;}
  });
  function undoApplied(){syncUndo();if(!applied)return;undoScenario();applied=null;banner.hidden=true;$('insights-undo').hidden=true;$('insights-status').textContent='Experiment undone.';if(!root.closest('[hidden]'))refresh();}
  undo.addEventListener('click',undoApplied);$('insights-undo').addEventListener('click',undoApplied);
  $('insights-save-open').addEventListener('click',()=>{$('insights-save-form').hidden=false;$('insights-name').focus();});
  $('insights-save-form').addEventListener('submit',event=>{event.preventDefault();try{const trial=currentPreview();saveScenario($('insights-name').value,trial.scenario);$('insights-trial-status').textContent='Named scenario saved. Your current Planning scenario is unchanged.';$('insights-save-form').hidden=true;}catch(error){$('insights-trial-status').textContent=error.message;}});
  document.addEventListener('picture-updated',()=>{if(applied)syncUndo();});
  function restore(value){settings=value ? validateInsightSettings(value) : {version:1,goal:'security'};cacheKey='';preview=null;applied=null;banner.hidden=true;$('insights-dialog').close();if(!root.closest('[hidden]'))refresh();}
  return {refresh,restore,snapshot:()=>structuredClone(settings)};
}
