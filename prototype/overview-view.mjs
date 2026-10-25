import {summarizeDraft} from './asset-ledger.mjs';
import {evaluateGoalOutlook} from './goal-outlook.mjs';
import {compareWithBaseline,recordedTotals} from './journey-state.mjs';

const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number.isFinite(value)?value:0);
const percent=value=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:1}).format(value);
const signedMoney=value=>`${value>0?'+':''}${money(value)}`;
const node=(tag,className,text)=>{const value=document.createElement(tag);if(className)value.className=className;if(text!=null)value.textContent=text;return value;};
const monthLabel=value=>/^\d{4}-\d{2}/.test(value||'')?new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,7)}-15T12:00:00Z`)):'Date not recorded';
const dateLabel=value=>/^\d{4}-\d{2}-\d{2}/.test(value||'')?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):monthLabel(value);
const goals={retirement:'Maintain my retirement lifestyle',independence:'Make work optional earlier',legacy:'Leave money to family'};

/** One useful summary of the recorded household, goal and preserved plan. */
export function mountOverview(root,getInputs,{onGoal,onBaseline,onUpdate,onExplore,onHousehold,onLifeline,onExport,onNewBaseline}={}){
  root.classList.add('journey-overview');
  const callbacks={goal:onGoal,baseline:onBaseline,update:onUpdate,explore:onExplore,lifeline:onLifeline,export:onExport,'new-baseline':onNewBaseline};
  root.addEventListener('click',event=>{const action=event.target.closest('[data-overview-action]');if(!action||!root.contains(action))return;if(action.dataset.overviewAction==='household')onHousehold?.(action.dataset.section||'assets');else callbacks[action.dataset.overviewAction]?.();});
  const action=(label,key,{primary=false,section}={})=>{const button=node('button',primary?'button button-primary journey-primary':'journey-link',label);button.type='button';button.dataset.overviewAction=key;if(section)button.dataset.section=section;return button;};
  const metric=(label,value,caption)=>{const item=node('div','journey-small-metric');item.append(node('span','',label),node('strong','',value));if(caption)item.append(node('small','',caption));return item;};

  function refresh(){
    const openDetails=[...root.querySelectorAll('details[open]')].map(item=>item.dataset.disclosure);
    const picture=getInputs(),journey=picture.journey||{},goal=journey.goal||{},baseline=journey.baseline,checkpoints=journey.checkpoints||[];
    const latest=checkpoints.at(-1)||baseline;
    let outcome,error,summary,recorded;
    try{outcome=evaluateGoalOutlook(picture);}catch(cause){error=cause.message;outcome={status:'incomplete',label:'Outlook incomplete',coveragePercent:null,reasons:[cause.message],warnings:[]};}
    try{summary=summarizeDraft(picture.holdings);}catch{summary=null;}
    try{recorded=recordedTotals(picture);}catch{recorded=null;}
    const workingChanges=Boolean(latest?.picture&&(JSON.stringify(picture.holdings)!==JSON.stringify(latest.picture.holdings)||JSON.stringify(picture.flow)!==JSON.stringify(latest.picture.flow)));
    const header=node('div','journey-heading');
    const headingText=node('div');headingText.append(node('p','journey-eyebrow','YOUR LIVING PLAN'));
    const title=node('h1','','Your plan, today.');title.id='overview-title';title.tabIndex=-1;headingText.append(title,node('p','journey-intro','A clear picture of where you are, and where you’re heading.'));header.append(headingText);
    if(picture.example){const example=node('span','journey-example','Fictional household');example.title='Explore with synthetic example figures. Your own household is separate.';header.append(example);}
    root.replaceChildren(header);

    const hero=node('div','journey-hero');
    const outlook=node('section',`journey-card journey-outlook is-${outcome.status}`);outlook.setAttribute('aria-labelledby','journey-outlook-title');
    const heroTop=node('div','journey-card-heading');heroTop.append(node('p','journey-eyebrow','GOAL OUTLOOK'),action(goal.type?'Edit goal':'Choose a goal','goal'));outlook.append(heroTop);
    const goalLabel=node('p','journey-goal-label',goals[goal.type]||'Choose what you want your money to support');outlook.append(goalLabel);
    const status=node('h2','journey-status',outcome.label||'Outlook incomplete');status.id='journey-outlook-title';const dot=node('span','journey-status-dot');dot.setAttribute('aria-hidden','true');status.prepend(dot);outlook.append(status);
    if(Number.isFinite(outcome.coveragePercent)){
      const score=node('p','journey-score');const figure=node('strong','',percent(outcome.coveragePercent));figure.append(node('span','','%'));score.append(figure,node('span','','of planned spending funded'));outlook.append(score);
      const track=node('div','journey-progress');track.setAttribute('role','img');track.setAttribute('aria-label',`${percent(outcome.coveragePercent)}% of planned spending funded under the selected assumptions`);const fill=node('span');fill.style.width=`${Math.max(0,Math.min(100,outcome.coveragePercent))}%`;track.append(fill);outlook.append(track);
    }else outlook.append(node('p','journey-incomplete-lead','A little more detail will make this picture useful.'));
    const gap=node('div',`journey-gap${outcome.firstGap?' has-gap':''}`);
    if(outcome.firstGap){const age=outcome.firstGap.ages?.primary;gap.append(node('strong','',`First projected shortfall${Number.isFinite(age)?` · age ${age}`:''}`),node('span','',`${monthLabel(outcome.firstGap.month)} · ${money(outcome.firstGap.amount)} unfunded in that month`));}
    else if(outcome.status!=='incomplete')gap.append(node('strong','','No recorded spending shortfall'),node('span','',`Through ${monthLabel(outcome.projection?.endMonth)} under your selected assumptions`));
    else gap.append(node('strong','','Your outlook is not a probability'),node('span','','Confirm your household and goal before relying on a result.'));
    outlook.append(gap);
    const reasons=node('details','journey-reasons');reasons.dataset.disclosure='reasons';reasons.append(node('summary','','See why'));
    const reasonList=node('ul');
    const reasonsText=outcome.reasons?.length?outcome.reasons:[outcome.status==='on-track'?'The selected goal is met in the current illustration and stated downside test.':'The result depends on your entered spending, access dates and assumptions.'];
    for(const reason of reasonsText)reasonList.append(node('li','',typeof reason==='string'?reason:reason.message||reason.text||'Review the calculation assumptions.'));
    reasons.append(reasonList);
    if(outcome.stress?.reason)reasons.append(node('p','journey-note',outcome.stress.reason));
    reasons.append(node('p','journey-note','Coverage measures funded spending across the illustration. A high percentage can still include a shortfall; always check its timing. It is not your chance of success.'));
    if(outcome.warnings?.length){const caveats=node('details','journey-caveats');caveats.append(node('summary','','Assumptions and limits'));const list=node('ul');for(const warning of outcome.warnings)list.append(node('li','',warning));caveats.append(list);reasons.append(caveats);}
    outlook.append(reasons);
    const actions=node('div','journey-actions');actions.append(action(baseline?'Update my position':'Review & save my starting plan',baseline?'update':'baseline',{primary:true}),action('See my Lifeline →','lifeline'));outlook.append(actions,node('p','journey-illustration','Illustration, not advice. Current rules, subject to change.'));hero.append(outlook);

    const position=node('aside','journey-card journey-position');position.setAttribute('aria-label','Your current recorded position');const positionHeader=node('div','journey-card-heading');positionHeader.append(node('h2','','Your recorded position'),action('Edit','household'));position.append(positionHeader);
    if(summary){const positionTotal=node('div','journey-position-total');positionTotal.append(node('span','','Recorded net worth'),node('strong','',money(summary.netWorth)),node('small','','Includes property and pensions'));position.append(positionTotal);
      const grid=node('div','journey-position-grid');grid.append(metric('Accessible now',money(recorded?.accessible??summary.accessTotals?.accessible??0),'Before sale or withdrawal tax'),metric('Recorded debt',money(summary.debtTotal),'Linked to your household'));position.append(grid);}
    const freshness=node('div','journey-freshness');freshness.append(node('span','journey-source-tag','Manually entered'),node('p','',latest?`Figures confirmed ${dateLabel(latest.date)}`:`Entered for ${monthLabel(picture.flow?.asOfMonth)}`),node('small','',workingChanges?'You have changes to confirm in your next update.':'Valuations are supplied by you. Market prices are not refreshed automatically.'));position.append(freshness);
    if(workingChanges)position.append(node('p','journey-working-note','Current edits are not yet part of your recorded history.'));
    const goalFacts=node('dl','journey-goal-facts');
    const fact=(label,value)=>{goalFacts.append(node('dt','',label),node('dd','',value));};
    if(Number.isFinite(goal.retirementAge))fact(goal.type==='independence'?'Work optional from':'Target retirement age',`${goal.retirementAge}`);
    if(Number.isFinite(goal.monthlySpending)&&goal.monthlySpending>0)fact('Monthly spending target',money(goal.monthlySpending));
    if(goal.reserve>0)fact('Minimum accessible reserve',money(goal.reserve));
    if(goal.type==='legacy'){fact('Inheritance target',goal.legacyTarget>0?money(goal.legacyTarget):'Not set');if(Number.isFinite(outcome.legacyAmount))fact('Illustrative inheritance',`${money(outcome.legacyAmount)} after estate tax`);}
    if(goalFacts.childNodes.length)position.append(goalFacts);hero.append(position);root.append(hero);

    if(outcome.status==='incomplete'){
      const checklist=node('section','journey-card journey-checklist');checklist.append(node('div','journey-card-heading'));checklist.firstChild.append(node('h2','','Complete your picture'),node('span','journey-muted','A few details, then a clearer outlook'));
      const steps=node('div','journey-checklist-grid');
      const entry=(number,label,description,button)=>{const row=node('div','journey-checklist-item');row.append(node('span','journey-step-number',number));const copy=node('div');copy.append(node('strong','',label),node('p','',description),button);row.append(copy);steps.append(row);};
      entry('1','Your goal','Set the timing, spending and protections that matter.',action('Choose or review goal','goal'));
      entry('2','What you own and owe','Confirm balances, ownership and access to your money.',action('Review assets & debt','household',{section:'assets'}));
      entry('3','Your money in and out','Add pay, pensions and regular household spending.',action('Review income & spending','household',{section:'flow'}));
      checklist.append(steps);root.append(checklist);
    }

    const lower=node('div','journey-lower-grid');
    const changes=node('section','journey-card journey-change-card');const changesHead=node('div','journey-card-heading');changesHead.append(node('h2','','Since your starting plan'));if(baseline)changesHead.append(node('span','journey-muted',dateLabel(baseline.date)));changes.append(changesHead);
    let comparison=null;
    try{comparison=compareWithBaseline(journey);}catch{}
    if(!baseline){changes.append(node('p','journey-card-lead','Give your plan a point to return to.'),node('p','journey-muted','Save your reviewed starting figures and outlook. Future updates will show what changed without rewriting this first plan.'),action('Review my starting plan →','baseline'));}
    else if(!comparison){changes.append(node('p','journey-card-lead','Your baseline is preserved.'),node('p','journey-muted',`“${baseline.label||'Starting plan'}” captures your figures and assumptions from ${dateLabel(baseline.date)}. Your first confirmed update will start the comparison.`),action('Record an update →','update'));}
    else{
      if(comparison.difference){const difference=comparison.difference.netWorth;changes.append(node('p','journey-change-number',signedMoney(difference)),node('p','journey-change-explainer',`Recorded net worth ${difference<0?'below':difference>0?'above':'matches'} the baseline illustration for ${monthLabel(comparison.month)}.`));const compareGrid=node('div','journey-comparison-grid');compareGrid.append(metric('Baseline illustration',money(comparison.expected.netWorth)),metric('Confirmed update',money(comparison.actual.netWorth)));changes.append(compareGrid);}
      else{changes.append(node('p','journey-change-number',signedMoney(comparison.recordedChange.netWorth)),node('p','journey-change-explainer','Change in recorded net worth since the starting figures. This update has no matching month in the baseline illustration.'));}
      const details=node('ul','journey-change-list');
      if(comparison.changes?.income?.change)details.append(node('li','',`Monthly recorded income ${signedMoney(comparison.changes.income.change)}`));
      if(comparison.changes?.spending?.change)details.append(node('li','',`Monthly recorded spending ${signedMoney(comparison.changes.spending.change)}`));
      const changedItems=(comparison.changes?.assets?.length||0)+(comparison.changes?.debts?.length||0);if(changedItems)details.append(node('li','',`${changedItems} asset or debt ${changedItems===1?'record changed':'records changed'}`));
      if(comparison.changes?.scenarioChanged)details.append(node('li','','Planning assumptions changed; your original illustration is preserved.'));
      if(comparison.changes?.goalChanged)details.append(node('li','','Your goal changed; the original baseline retains its earlier goal.'));
      if(details.childNodes.length)changes.append(details);
      changes.append(node('p','journey-note',comparison.comparisonNote||'Monthly illustrations are compared with the opening month. Balances alone do not establish investment performance.'));
      if(comparison.movements?.net==null)changes.append(node('p','journey-note','Contributions and withdrawals are not fully recorded. This difference is not an investment return.'));
      if(workingChanges)changes.append(node('p','journey-working-note','Confirm your current edits to include them in this comparison.'));
    }
    if(baseline&&(onExport||onNewBaseline)){const options=node('details','journey-baseline-options');options.dataset.disclosure='baseline';options.append(node('summary','','Baseline options'));const controls=node('div','journey-actions');if(onExport)controls.append(action('Download my record','export'));if(onNewBaseline)controls.append(action('Start a new baseline','new-baseline'));options.append(node('p','journey-note','A new baseline preserves the previous one. Updating figures does not replace it.'),controls);changes.append(options);}lower.append(changes);

    const next=node('section','journey-card journey-next');next.append(node('p','journey-eyebrow','A USEFUL NEXT STEP'));
    if(outcome.status==='incomplete'){next.append(node('h2','','Fill the important gaps first.'),node('p','journey-muted','Your outlook can only be as useful as the figures behind it. Review the inputs before exploring changes.'),action('Review my household →','household'));}
    else if(!baseline){next.append(node('h2','','Keep this as your starting point.'),node('p','journey-muted','Review the figures, assumptions and goal. Then preserve a baseline you can compare with future updates.'),action('Review & save baseline →','baseline'));}
    else{next.append(node('h2','','Explore a choice that matters.'),node('p','journey-muted','Compare a change to retirement timing, spending or funding. See the effect on your goal before applying anything.'),action('Explore changes →','explore'));}
    next.append(node('div','journey-next-divider'));const history=node('div','journey-history');history.append(node('h3','','Your review history'));
    if(!baseline)history.append(node('p','journey-note','Your history begins when you confirm your starting plan.'));
    else{
      const records=[{...baseline,baseline:true},...checkpoints].slice(-4).reverse();const list=node('ol','journey-history-list');
      for(const record of records){const item=node('li');const copy=node('div');copy.append(node('strong','',record.baseline?'Starting baseline':record.note||'Position confirmed'),node('span','',dateLabel(record.date)));item.append(copy,node('strong','',money(record.totals?.netWorth)));list.append(item);}history.append(list);
      if(checkpoints.length>3)history.append(node('p','journey-note',`${checkpoints.length} confirmed updates · full record available with your baseline`));
    }
    next.append(history);lower.append(next);root.append(lower);
    const footer=node('p','journey-footer-note','Your baseline stays preserved as life changes. Scenarios change assumptions; updates record your position.');root.append(footer);
    for(const disclosure of root.querySelectorAll('details'))if(openDetails.includes(disclosure.dataset.disclosure))disclosure.open=true;
    if(error)root.dataset.outlookError='true';else delete root.dataset.outlookError;
  }
  return {refresh};
}
