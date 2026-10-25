import {appendBaselineVersion,activeBaseline,baselineAnnualView,validBaselineDate} from './baseline-history.mjs?v=20261025baseline1';
import {validatePicture} from './picture-storage.mjs?v=20261025baseline1';
import {summarizeMonthlyFlow} from './monthly-flow.mjs?v=20261024persona1';

const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const dateLabel=value=>new Date(`${value}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};

/** Baseline management is read-only until an explicit, reviewed version is created. */
export function mountBaselines({getPicture,commitHistory,announce}){
 const bar=document.createElement('section');bar.className='baseline-bar';bar.hidden=true;bar.setAttribute('aria-label','Household baseline');
 bar.innerHTML='<span id="baseline-status"></span><button id="baseline-manage" class="text-button" type="button">Set baseline</button>';
 document.querySelector('main').prepend(bar);
 const dialog=document.createElement('dialog');dialog.id='baseline-dialog';dialog.className='form-dialog baseline-dialog';dialog.setAttribute('aria-labelledby','baseline-title');
 dialog.innerHTML=`<div class="dialog-heading"><h2 id="baseline-title">Your baseline</h2><button id="baseline-close" type="button" class="icon-button" aria-label="Close baseline options">×</button></div>
 <p id="baseline-error" class="form-error" role="alert" hidden></p>
 <div id="baseline-saved"><label for="baseline-version">View a baseline<select id="baseline-version"></select></label><p id="baseline-version-context" class="field-help"></p><div id="baseline-saved-summary" class="baseline-summary"></div>
 <details class="baseline-frozen-details"><summary>Saved forecast &amp; assumptions</summary><p id="baseline-forecast-note" class="field-help"></p><div class="baseline-table-scroll" role="region" aria-label="Saved annual forecast" tabindex="0"><table><caption>Frozen forecast · future pounds · calendar years</caption><thead><tr><th scope="col">Year</th><th scope="col">Net assets</th><th scope="col">Income</th><th scope="col">Spending</th><th scope="col">Tax &amp; NI</th></tr></thead><tbody id="baseline-forecast-rows"></tbody></table></div><ul id="baseline-assumptions" class="field-help"></ul><details><summary>Calculation limits</summary><ul id="baseline-limits" class="field-help"></ul></details><p class="field-help">Illustration, not advice. Current rules, subject to change.</p></details>
 <p class="field-help">Viewing a baseline leaves your current figures unchanged.</p><button id="baseline-update" class="button button-secondary" type="button">Update baseline…</button></div>
 <form id="baseline-form" hidden><p id="baseline-form-intro"></p><div class="baseline-fields"><label for="baseline-name">Name <span class="optional">Optional</span><input id="baseline-name" type="text" maxlength="60" placeholder="Starting plan" /></label><label for="baseline-date">Start date<input id="baseline-date" type="date" min="1900-01-01" max="2200-12-31" required /></label></div>
 <div id="baseline-current-summary" class="baseline-summary"></div>
 <details class="baseline-date-help"><summary>About the starting date</summary><p class="field-help">The figures and ages currently entered become the opening inputs for the selected month. This does not reconstruct historical balances or move the dates in your current household. The forecast uses whole months; the exact date labels your baseline.</p></details>
 <label class="baseline-confirm"><input id="baseline-confirm" type="checkbox" required /><span>I’ve checked the assets, income, spending and assumptions for this start date.</span></label>
 <p id="baseline-save-note" class="field-help"></p><div class="baseline-actions"><button id="baseline-save" type="submit" class="button button-primary">Set baseline</button><button id="baseline-cancel" type="button" class="button button-secondary">Cancel</button></div></form>`;
 document.body.append(dialog);
 const $=id=>dialog.querySelector(`#${id}`);let source=null,sourceKey='',selectedId=null;
 function entries(){return getPicture().baselines?.entries||[];}
 function error(message=''){$('baseline-error').textContent=message;$('baseline-error').hidden=!message;}
 function summary(target,picture){
  const h=picture.holdings,assets=h.assets.reduce((s,a)=>s+a.value,0),debts=h.debts.reduce((s,d)=>s+d.balance,0),flow=summarizeMonthlyFlow(picture.flow,h,{primary:h.name,partner:h.partnerName});
  target.replaceChildren();
  for(const [label,value] of [['People',[h.name&&`${h.name}, ${h.age}`,h.partnerName&&`${h.partnerName}${h.partnerAge!=null?`, ${h.partnerAge}`:''}`].filter(Boolean).join(' · ')],['Opening net assets',money(assets-debts)],['Income · per month',money(flow.incomeTotal)],['Spending · per month',money(flow.spendingTotal)]]){
   const item=node('div');item.append(node('span',label),node('strong',value));target.append(item);
  }
 }
 function showSelected(){
  const b=entries().find(b=>b.id===$('baseline-version').value);if(!b)return;
  selectedId=b.id;const active=activeBaseline(getPicture().baselines,today());
  $('baseline-version-context').textContent=`v${b.number} · starts ${dateLabel(b.startDate)} · ${b.startDate>today()?'Scheduled':b.id===active?.id?'Current reference':'Earlier reference'} · created ${dateLabel(b.createdAt.slice(0,10))}`;
  summary($('baseline-saved-summary'),b.inputs);
  const f=b.forecast;$('baseline-forecast-note').textContent=`${f.startMonth} to ${f.endMonth} · ${f.engineVersion} · monthly results saved when this version was created. Income is after modelled deductions; tax is shown separately and must not be subtracted again.`;
  $('baseline-forecast-rows').replaceChildren(...baselineAnnualView(b).map(row=>{
   const tr=node('tr'),heading=node('th',row.months===12?row.year:`${row.year} · ${row.months} months`);heading.scope='row';tr.append(heading,...[row.assetsTotal-row.debtsTotal,row.incomeTotal,row.spendingTotal,row.taxTotal].map(value=>node('td',money(value))));return tr;
  }));
  const a=f.assumptions;$('baseline-assumptions').replaceChildren(...[`Inflation ${a.inflation}% · pay growth ${a.incomeGrowth}%`,`Annual growth: ${Object.entries(a.growth).map(([key,value])=>`${key} ${value}%`).join(' · ')}`,`Retirement final-pay years: ${Object.entries(b.inputs.planning.scenario.retirementYears).map(([owner,year])=>`${owner==='primary'?b.inputs.holdings.name:b.inputs.holdings.partnerName} ${year}`).join(' · ')}`].map(text=>node('li',text)));
  $('baseline-limits').replaceChildren(...[...new Set([...f.warnings,...f.taxLimitations,...(f.unmodelledDebt>0?[`${money(f.unmodelledDebt)} of debt has unmodelled repayments.`]:[])])].map(text=>node('li',text)));
 }
 function showLibrary(){
  error();sourceKey=JSON.stringify(getPicture());$('baseline-title').textContent='Your baseline';$('baseline-form').hidden=true;$('baseline-saved').hidden=false;
  const list=entries();$('baseline-version').replaceChildren(...list.map(b=>new Option(`${b.name} · v${b.number} · ${dateLabel(b.startDate)}`,b.id)));
  $('baseline-version').value=selectedId||activeBaseline(getPicture().baselines,today())?.id||list.at(-1)?.id;
  if(!$('baseline-version').value)$('baseline-version').value=list.at(-1)?.id;showSelected();
 }
 function showForm(){
  try{
   error();source=validatePicture(getPicture());sourceKey=JSON.stringify(source);const hasBaseline=Boolean(entries().length);
   $('baseline-title').textContent=hasBaseline?'Update baseline':'Set your starting baseline';$('baseline-form-intro').textContent=hasBaseline?'Save the figures and Planning assumptions currently entered as a new baseline version. Earlier versions stay unchanged.':'These are your starting figures. Once saved, this baseline stays fixed when you change your current household.';
   $('baseline-saved').hidden=true;$('baseline-form').hidden=false;$('baseline-name').value='';$('baseline-name').placeholder=hasBaseline?'e.g. Annual review':'Starting plan';
   $('baseline-date').value=hasBaseline?today():source.flow.timelineStartMonth?`${source.flow.timelineStartMonth}-01`:today();$('baseline-confirm').checked=false;
   $('baseline-save').textContent=hasBaseline?'Save new baseline':'Set baseline';$('baseline-save-note').textContent='Saved with your household. Without account saving, it lasts only in this tab.';
   previewOpening();
  }catch(e){error(e.message);}
 }
 function previewOpening(){
  if(!source||!validBaselineDate($('baseline-date').value))return;
  try{const month=$('baseline-date').value.slice(0,7);summary($('baseline-current-summary'),{...source,flow:{...source.flow,asOfMonth:month,timelineStartMonth:month}});}
  catch(e){error(e.message);}
 }
 function open(){selectedId=null;if(entries().length)showLibrary();else showForm();dialog.showModal();}
 function refresh(){
  const p=getPicture();bar.hidden=p.example||!p.holdings.name?.trim()||!Number.isInteger(p.holdings.age);
  const active=activeBaseline(p.baselines,today()),list=p.baselines?.entries||[];
  bar.querySelector('#baseline-status').textContent=active?`Baseline v${active.number} · ${dateLabel(active.startDate)}`:list.length?`Baseline scheduled · ${dateLabel([...list].sort((a,b)=>a.startDate.localeCompare(b.startDate))[0].startDate)}`:'Set your starting baseline when your figures are ready.';
  bar.querySelector('button').textContent=list.length?'View baseline':'Set baseline';
  // A household switch must never leave the old household's modal open.
  if(dialog.open&&sourceKey&&JSON.stringify(getPicture())!==sourceKey){dialog.close();source=null;sourceKey='';}
 }
 bar.querySelector('button').addEventListener('click',open);
 $('baseline-close').addEventListener('click',()=>dialog.close());$('baseline-version').addEventListener('change',showSelected);$('baseline-update').addEventListener('click',showForm);
 $('baseline-date').addEventListener('change',previewOpening);
 $('baseline-cancel').addEventListener('click',()=>{if(entries().length){sourceKey='';showLibrary();}else dialog.close();});
 $('baseline-form').addEventListener('submit',event=>{
  event.preventDefault();if(!event.currentTarget.reportValidity())return;error();
  try{
   if(JSON.stringify(getPicture())!==sourceKey)throw new Error('Your household changed. Close and reopen baseline options to review the latest figures.');
   const candidate=validatePicture(appendBaselineVersion(source,{name:$('baseline-name').value,startDate:$('baseline-date').value}));
   sourceKey='';commitHistory(candidate.baselines);selectedId=candidate.baselines.entries.at(-1).id;showLibrary();refresh();announce('Baseline saved with your household. Earlier versions are unchanged.');
  }catch(e){error(e.message);}
 });
 dialog.addEventListener('close',()=>{source=null;sourceKey='';if(!bar.hidden)bar.querySelector('button').focus({preventScroll:true});});
 document.addEventListener('picture-updated',refresh);refresh();return {refresh};
}
