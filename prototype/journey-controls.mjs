/** Explicit goal, baseline and manually confirmed update journeys. No account writes. */
import {createJourney,createGoal,validateGoal,saveBaseline,saveCheckpoint,recordedTotals,GOAL_TYPES} from './journey-state.mjs';
import {goalScenario,evaluateGoalOutlook,regularMonthlySpending} from './goal-outlook.mjs';
import {projectPlan} from './planning.mjs';

const copy=value=>structuredClone(value);
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const today=()=>new Date().toISOString().slice(0,10);
const monthIndex=month=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
const validMonth=month=>typeof month==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(`${date}T12:00:00Z`))&&new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date;

/** Advance the position's anchor, keeping absolute event and final-pay dates intact. */
export function rebasePictureMonth(picture,month,{ages={}}={}){
  const result=copy(picture),source=result.flow.timelineStartMonth||result.flow.asOfMonth;
  if(!validMonth(source)||!validMonth(month)||month<source)throw new Error('An update cannot precede your current position.');
  const elapsed=monthIndex(month)-monthIndex(source),scenario=result.planning.scenario;
  scenario.ages={...(scenario.ages||{})};
  for(const owner of result.holdings.partnerName?['primary','partner']:['primary']){
    const key=owner==='primary'?'age':'partnerAge',age=scenario.ages[owner]??result.holdings[key];
    if(ages[owner]!=null){
      if(!Number.isInteger(ages[owner])||ages[owner]<18||ages[owner]>120)throw new Error('Enter each current age as a whole number from 18 to 120.');
      scenario.ages[owner]=ages[owner];result.holdings[key]=ages[owner];
    }else if(Number.isFinite(age)){
      const advanced=age+elapsed/12;
      if(advanced>120)throw new Error('The updated age is outside the supported range.');
      scenario.ages[owner]=advanced;result.holdings[key]=Math.floor(advanced);
    }
  }
  for(const debt of result.holdings.debts||[]){
    if(debt.kind==='mortgage'&&Number.isFinite(debt.remainingYears))debt.remainingYears=Math.max(1/12,debt.remainingYears-elapsed/12);
  }
  result.flow.timelineStartMonth=month;result.flow.asOfMonth=month;
  return result;
}

/** Preserve category proportions when the user explicitly updates a total budget. */
export function setRegularBudget(flow,amount){
  if(!Number.isFinite(amount)||amount<0||amount>1e8||Math.abs(amount*100-Math.round(amount*100))>.001)throw new Error('Enter a monthly budget from £0 to £100 million, to the penny.');
  const result=copy(flow),items=[...Object.keys(result.spending).map(key=>({get:()=>result.spending[key],set:value=>{result.spending[key]=value;}})),...(result.customSpending||[]).map(item=>({get:()=>item.amount,set:value=>{item.amount=value;}}))];
  const total=regularMonthlySpending(result),target=Math.round(amount*100);
  if(!total){for(const item of items)item.set(0);result.spending.everyday=amount;return result;}
  let assigned=0;items.forEach((item,index)=>{const cents=index===items.length-1?target-assigned:Math.min(target-assigned,Math.round(item.get()/total*target));item.set(cents/100);assigned+=cents;});
  return result;
}

function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
function field(label,{type='number',value='',min=0,max=1e8,step='.01',required=false,id}={}){
  const shell=element('label','journey-form-field'),input=element('input');shell.append(element('span','',label),input);
  input.type=type;if(id)input.id=id;if(type==='number'){input.min=min;input.max=max;input.step=step;input.inputMode=step==='1'?'numeric':'decimal';}input.value=value??'';input.required=required;return {shell,input};
}

export function mountJourneyControls({getPicture,setJourney,applyScenario,replacePicture,showSection,onChange=()=>{}}){
  let lastTrigger=null,pendingUpdate=null,updateSource='';
  const dialogs=[];
  function dialog(title,id){
    const root=element('dialog','journey-dialog'),heading=element('div','journey-dialog-heading'),h=element('h2','',title),close=element('button','heading-action','×');
    root.id=id;h.id=`${id}-title`;root.setAttribute('aria-labelledby',h.id);close.type='button';close.setAttribute('aria-label',`Close ${title.toLowerCase()}`);heading.append(h,close);root.append(heading);document.body.append(root);dialogs.push(root);
    close.addEventListener('click',()=>root.close());root.addEventListener('close',()=>{if(lastTrigger?.isConnected&&lastTrigger.getClientRects().length)lastTrigger.focus();});return root;
  }
  function open(root){lastTrigger=document.activeElement;for(const d of dialogs)if(d.open)d.close();root.showModal();root.querySelector('form input,form select,form button')?.focus();}
  function message(root,text){const error=root.querySelector('[data-journey-error]');error.textContent=text||'';error.hidden=!text;}
  function errorBox(root){const error=element('p','journey-error');error.dataset.journeyError='';error.hidden=true;error.setAttribute('role','alert');root.append(error);}
  function changed(){onChange();}
  function minimumDate(picture){const journey=picture.journey;return [journey?.baseline?.date,...(journey?.checkpoints||[]).map(item=>item.date),`${picture.flow.timelineStartMonth||picture.flow.asOfMonth}-01`].filter(Boolean).sort().at(-1);}
  function assertUpdateDate(date,picture){if(!validDate(date))throw new Error('Choose a valid date.');if(date<minimumDate(picture))throw new Error('Choose a date on or after your latest recorded position.');if(date>today())throw new Error('Updates record what has happened. Future events belong in the Lifeline.');}

  const goalDialog=dialog('What matters most?','journey-goal-dialog'),goalForm=element('form'),goalGrid=element('div','journey-dialog-grid');
  goalDialog.append(element('p','','Choose a priority and the things you want to protect. You can change these later; your original baseline stays intact.'));
  const goalType=element('select');goalType.id='journey-goal-type';for(const [key,label]of Object.entries(GOAL_TYPES))goalType.add(new Option(label,key));
  const goalTypeShell=element('label','journey-form-field');goalTypeShell.append(element('span','','Your main priority'),goalType);goalForm.append(goalTypeShell);
  const ageField=field('Make work optional by age',{min:18,max:100,step:'1',id:'journey-goal-age'}),spendingField=field('Minimum monthly household spending (£)',{id:'journey-goal-spending'}),reserveField=field('Minimum accessible reserve (£)',{id:'journey-goal-reserve'}),legacyField=field('Inheritance target in today’s money (£)',{id:'journey-goal-legacy'});
  goalGrid.append(ageField.shell,spendingField.shell,reserveField.shell,legacyField.shell);goalForm.append(goalGrid,element('p','field-help','Spending excludes separate debt payments and dated costs. The reserve is the minimum accessible balance across the plan. Inheritance is assessed at the end of the plan, after estimated estate tax.'));
  const goalAction=element('button','button button-primary','Save goal and review my outlook');goalAction.type='submit';goalForm.append(goalAction);goalDialog.append(goalForm);errorBox(goalDialog);
  goalType.addEventListener('change',()=>{legacyField.shell.hidden=goalType.value!=='legacy';});
  function openGoal(){
    const picture=getPicture(),goal=picture.journey?.goal||createGoal();goalType.value=goal.type;ageField.input.value=goal.retirementAge??'';spendingField.input.value=goal.monthlySpending??regularMonthlySpending(picture.flow);reserveField.input.value=goal.reserve;legacyField.input.value=goal.legacyTarget;legacyField.shell.hidden=goal.type!=='legacy';message(goalDialog,'');open(goalDialog);
  }
  goalForm.addEventListener('submit',event=>{
    event.preventDefault();if(!goalForm.reportValidity())return;
    try{
      const picture=getPicture(),goal=validateGoal({type:goalType.value,retirementAge:ageField.input.value===''?null:Number(ageField.input.value),monthlySpending:spendingField.input.value===''?null:Number(spendingField.input.value),reserve:Number(reserveField.input.value||0),legacyTarget:goalType.value==='legacy'?Number(legacyField.input.value||0):0}),scenario=goalScenario(picture,goal);
      projectPlan(picture.flow,picture.holdings,scenario);
      setJourney({...copy(picture.journey||createJourney()),goal});applyScenario(scenario);goalDialog.close();changed();
    }catch(error){message(goalDialog,error.message);}
  });

  const baselineDialog=dialog('Review your starting plan','journey-baseline-dialog'),baselineForm=element('form'),baselineFields=element('div','journey-dialog-grid'),baselineDate=field('Valuations as of',{type:'date',required:true,id:'journey-baseline-date'}),baselineLabel=field('Name this baseline',{type:'text',id:'journey-baseline-label'}),baselineReview=element('div','journey-review');
  baselineLabel.input.maxLength=60;baselineFields.append(baselineDate.shell,baselineLabel.shell);baselineForm.append(baselineFields,baselineReview);
  const baselineConfirm=element('label','journey-confirmation'),baselineCheck=element('input');baselineCheck.type='checkbox';baselineCheck.required=true;baselineConfirm.append(baselineCheck,document.createTextNode(' I have reviewed my balances, regular spending and goal. These are the starting figures I want to compare against.'));baselineForm.append(baselineConfirm);
  const baselineSave=element('button','button button-primary','Save starting plan');baselineSave.type='submit';baselineForm.append(baselineSave);baselineDialog.append(element('p','','This freezes your starting figures and illustration. Future updates are separate records. You can adopt a new baseline later and retain this one.'),baselineForm);errorBox(baselineDialog);
  let replacingBaseline=false;
  function openBaseline({replace=false}={}){
    const picture=getPicture();replacingBaseline=replace||Boolean(picture.journey?.baseline);baselineDialog.querySelector('h2').textContent=replacingBaseline?'Review a new baseline':'Review your starting plan';baselineSave.textContent=replacingBaseline?'Adopt new baseline':'Save starting plan';baselineDate.input.value=today();baselineDate.input.min=minimumDate(picture);baselineDate.input.max=today();baselineLabel.input.value=replacingBaseline?'Updated plan':'My starting plan';baselineCheck.checked=false;baselineReview.replaceChildren();
    const totals=recordedTotals(picture);baselineReview.append(element('p','',`${money(totals.assets)} assets · ${money(totals.debts)} debt · ${money(totals.netWorth)} net worth`));
    try{const result=evaluateGoalOutlook(picture,{includeStress:false});baselineReview.append(element('p','',`Goal outlook: ${result.label}`));for(const reason of result.incompleteReasons||[])baselineReview.append(element('p','field-help',reason));}catch(error){baselineReview.append(element('p','field-help',error.message));}
    if(replacingBaseline)baselineReview.append(element('p','field-help','Your previous baseline remains available in your history. This is an explicit new comparison point.'));message(baselineDialog,'');open(baselineDialog);
  }
  baselineForm.addEventListener('submit',event=>{
    event.preventDefault();if(!baselineForm.reportValidity())return;
    try{
      const original=getPicture();assertUpdateDate(baselineDate.input.value,original);
      if(!original.holdings.name?.trim()||!Number.isFinite(original.holdings.age))throw new Error('Add your household name and age before saving the baseline.');
      const picture=rebasePictureMonth(original,baselineDate.input.value.slice(0,7)),projection=projectPlan(picture.flow,picture.holdings,picture.planning.scenario),journey=saveBaseline(picture.journey||createJourney(),picture,projection,{date:baselineDate.input.value,label:baselineLabel.input.value.trim()});
      picture.journey=journey;replacePicture(picture);baselineDialog.close();changed();
    }catch(error){message(baselineDialog,error.message);}
  });

  const updateDialog=dialog('Update your position','journey-update-dialog'),updateForm=element('form'),updateFields=element('div'),updateGrid=element('div','journey-dialog-grid'),updateDate=field('Position as of',{type:'date',required:true,id:'journey-update-date'}),agesGrid=element('div','journey-dialog-grid'),assetRows=element('div'),debtRows=element('div'),payRows=element('div','journey-dialog-grid'),budget=field('Recorded regular budget (£ / month)',{id:'journey-update-budget'}),contributions=field('Money added since your last confirmed update (£)',{id:'journey-update-contributions'}),withdrawals=field('Money removed since your last confirmed update (£)',{id:'journey-update-withdrawals'}),updateNote=field('What changed? Optional note',{type:'text',id:'journey-update-note'});
  updateNote.input.maxLength=280;updateFields.append(element('p','','Enter current balances. These updates are manual; no prices or account holdings are fetched. Changes stay temporary until you confirm them.'));updateGrid.append(updateDate.shell);updateFields.append(updateGrid,agesGrid,element('h3','','Assets'),assetRows,element('h3','','Debt'),debtRows);
  const detailed=element('details');detailed.append(element('summary','','Pay, regular budget and actual movements'),payRows,budget.shell,element('p','field-help','The recorded budget excludes mortgage repayments and separately scheduled costs. Existing scenario spending phases still apply. For detailed categories, pension contributions or events, use Household.'),contributions.shell,withdrawals.shell,element('p','field-help','Money added or removed means movements into or out of the household’s assets. Transfers between your accounts are excluded. Leave blank when unknown; balance changes alone are not investment returns.'),updateNote.shell);
  updateFields.append(detailed);const editHousehold=element('button','heading-action','Edit detailed household inputs');editHousehold.type='button';editHousehold.addEventListener('click',()=>{updateDialog.close();showSection('assets');});updateFields.append(editHousehold);
  const reviewAction=element('button','button button-primary','Review update');reviewAction.type='submit';updateFields.append(reviewAction);
  const updateReview=element('section','journey-review');updateReview.hidden=true;updateReview.setAttribute('aria-live','polite');
  const reviewActions=element('div','journey-actions'),backAction=element('button','button button-secondary','Back to edit'),confirmUpdate=element('button','button button-primary','Confirm and save update');backAction.type='button';confirmUpdate.type='button';reviewActions.append(backAction,confirmUpdate);reviewActions.hidden=true;updateForm.append(updateFields,updateReview,reviewActions);updateDialog.append(updateForm);errorBox(updateDialog);
  let ageInputs={},payInputs={};
  function moneyRow(item,type){const row=element('label','journey-update-row'),input=element('input');row.append(element('span','',item.label||item.kind),input);input.type='number';input.inputMode='decimal';input.min=0;input.max=1e11;input.step='.01';input.required=true;input.value=type==='asset'?item.value:item.balance;input.dataset[type==='asset'?'updateAsset':'updateDebt']=item.id;input.setAttribute('aria-label',`${item.label||item.kind} ${type==='asset'?'value':'balance owed'} in pounds`);return row;}
  function openUpdate(){
    const picture=getPicture();if(!picture.journey?.baseline){openBaseline();return;}
    pendingUpdate=null;updateSource=JSON.stringify(picture);updateDate.input.value=today();updateDate.input.min=minimumDate(picture);updateDate.input.max=today();updateFields.hidden=false;updateReview.hidden=true;reviewActions.hidden=true;assetRows.replaceChildren(...picture.holdings.assets.map(item=>moneyRow(item,'asset')));debtRows.replaceChildren(...picture.holdings.debts.map(item=>moneyRow(item,'debt')));if(!picture.holdings.assets.length)assetRows.append(element('p','field-help','No assets recorded. Add them in Household.'));if(!picture.holdings.debts.length)debtRows.append(element('p','field-help','No debts recorded.'));
    agesGrid.replaceChildren();payRows.replaceChildren();ageInputs={};payInputs={};
    for(const owner of picture.holdings.partnerName?['primary','partner']:['primary']){
      const name=owner==='primary'?picture.holdings.name:picture.holdings.partnerName,currentAge=owner==='primary'?picture.holdings.age:picture.holdings.partnerAge;
      const age=field(`${name||'Your'} age at this update`,{value:currentAge,min:18,max:120,step:'1',required:owner==='primary'});ageInputs[owner]=age.input;agesGrid.append(age.shell);
      const pay=picture.flow.pay[owner],net=pay.annualTakeHome!=null,payField=field(`${name||'Your'} annual ${net?'take-home':'gross'} pay (£)`,{value:net?pay.annualTakeHome:pay.annualGross});payInputs[owner]={input:payField.input,key:net?'annualTakeHome':'annualGross'};payRows.append(payField.shell);
    }
    budget.input.value=regularMonthlySpending(picture.flow);contributions.input.value='';withdrawals.input.value='';updateNote.input.value='';message(updateDialog,'');open(updateDialog);
  }
  updateForm.addEventListener('submit',event=>{
    event.preventDefault();if(!updateForm.reportValidity())return;
    try{
      const original=getPicture();if(JSON.stringify(original)!==updateSource)throw new Error('Your household or scenario changed. Close this update and start again.');assertUpdateDate(updateDate.input.value,original);
      const ages=Object.fromEntries(Object.entries(ageInputs).filter(([,input])=>input.value!=='').map(([owner,input])=>[owner,Number(input.value)])),picture=rebasePictureMonth(original,updateDate.input.value.slice(0,7),{ages});
      for(const input of assetRows.querySelectorAll('[data-update-asset]'))picture.holdings.assets.find(item=>item.id===input.dataset.updateAsset).value=Number(input.value);
      for(const input of debtRows.querySelectorAll('[data-update-debt]'))picture.holdings.debts.find(item=>item.id===input.dataset.updateDebt).balance=Number(input.value);
      for(const [owner,{input,key}]of Object.entries(payInputs))picture.flow.pay[owner][key]=Number(input.value||0);
      picture.flow=setRegularBudget(picture.flow,Number(budget.input.value||0));
      const projection=projectPlan(picture.flow,picture.holdings,picture.planning.scenario),options={date:updateDate.input.value,note:updateNote.input.value.trim(),contributions:contributions.input.value===''?null:Number(contributions.input.value),withdrawals:withdrawals.input.value===''?null:Number(withdrawals.input.value)},journey=saveCheckpoint(picture.journey,picture,projection,options);picture.journey=journey;pendingUpdate=picture;
      const previous=recordedTotals(original),next=recordedTotals(picture),outlook=evaluateGoalOutlook(picture,{projection,includeStress:false});updateReview.replaceChildren(element('h3','','Review your update'),element('p','',`Position as of ${options.date}`),element('p','',`Assets: ${money(previous.assets)} → ${money(next.assets)}`),element('p','',`Debt: ${money(previous.debts)} → ${money(next.debts)}`),element('p','',`Net worth: ${money(previous.netWorth)} → ${money(next.netWorth)}`),element('p','',`Goal outlook: ${outlook.label}`),element('p','field-help','The difference includes your entered changes. It is not a measure of investment return. Your starting baseline is preserved.'),element('p','field-help','Saving this update records the figures and date shown. Account saving or an encrypted backup keeps it beyond this tab.'));updateFields.hidden=true;updateReview.hidden=false;reviewActions.hidden=false;message(updateDialog,'');confirmUpdate.focus();
    }catch(error){message(updateDialog,error.message);}
  });
  backAction.addEventListener('click',()=>{pendingUpdate=null;updateFields.hidden=false;updateReview.hidden=true;reviewActions.hidden=true;updateDate.input.focus();});
  confirmUpdate.addEventListener('click',()=>{
    try{if(!pendingUpdate)throw new Error('Review an update first.');if(JSON.stringify(getPicture())!==updateSource)throw new Error('Your household or scenario changed. Close this update and start again.');replacePicture(pendingUpdate);pendingUpdate=null;updateDialog.close();changed();}catch(error){message(updateDialog,error.message);}
  });
  return {openGoal,openBaseline,openUpdate};
}
