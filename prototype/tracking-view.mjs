import {activeTrackingEntries,correctTrackingUpdate,trackedInputsAt,recordedPayReceipts} from './tracking.mjs?v=20261025tracking1';
import {activeBaseline} from './baseline-history.mjs?v=20261025baseline1';
import {enableGroupedNumberInput,groupedNumberValue} from './grouped-number-input.mjs?v=20261022grouped1';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(n);
export const trackingToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const names={annualGross:'Yearly base pay · £',annualBonus:'Yearly bonus · £',annualTakeHome:'Yearly take-home equivalent · £',employeePension:'Employee pension · £/year',employeePensionRate:'Employee pension · %',employerPension:'Employer pension · £/year',employerPensionRate:'Employer pension · %',endDate:'Final pay month',niExemptFrom:'NI exemption month',everyday:'Everyday living',carPayment:'Car payment',pensionIncome:'Pension income',otherIncome:'Other income'};
const isReceipt=(c,e)=>e.mode==='period'&&c.target.kind==='pay'&&c.target.field==='annualTakeHome';
const heading=(c,e)=>isReceipt(c,e)?'Take-home received this month · £':['asset','debt','custom','dated'].includes(c.target.kind)?`${(c.value||c.before)?.label||c.target.kind}${c.target.kind==='dated'&&(c.value||c.before)?.frequency==='once'?` · occurs ${(c.value||c.before).startMonth}`:''}`:`${c.target.kind==='pay'?(c.target.id==='primary'?'First person':'Partner')+' · ':''}${names[c.target.field]||names[c.target.id]||c.target.id}`;
function display(c,value,e){if(value===null)return 'Not recorded / removed';if(typeof value==='object')return money(value.value??value.balance??value.amount);if(typeof value==='number')return c.target.field.endsWith('Rate')?`${value}%`:money(isReceipt(c,e)?value/12:value);return value||'Not set';}

export function trackingControls(container,id,{balance=false,allowPeriod=true}={}){
 const root=el('div');root.id=`${id}-tracking`;root.className='tracking-controls';root.hidden=true;
 root.innerHTML=`<div class="tracking-control-grid"><label for="${id}-tracking-date">${balance?'Statement date':'Applies from'}<input id="${id}-tracking-date" type="date" required /></label><label for="${id}-tracking-mode">Update type<select id="${id}-tracking-mode"><option value="change">${balance?'Recorded balance':'Ongoing change'}</option>${!balance&&allowPeriod?'<option value="period">This month only</option>':''}</select></label></div><p class="field-help">${balance?'Statement values replace the estimate at the end of this month.':'Changes apply for the selected month; earlier amounts stay in history.'}</p>`;
 container.prepend(root);const date=root.querySelector('input'),mode=root.querySelector('select');
 return {root,date,mode,reset({enabled,startMonth}){root.hidden=!enabled;date.disabled=!enabled;mode.disabled=!enabled;date.value=trackingToday();date.min=`${startMonth}-01`;date.max=balance?trackingToday():'2200-12-31';mode.value='change';},read(){if(!date.reportValidity())throw new Error('Choose a valid update date.');return {effectiveDate:date.value,mode:mode.value};}};
}
export function mountTrackingHistory({getPicture,commitFlow,announce}){
 const button=el('button','History');button.id='tracking-history-open';button.type='button';button.className='text-button';document.querySelector('.baseline-bar').append(button);
 const dialog=el('dialog');dialog.id='tracking-history-dialog';dialog.className='form-dialog baseline-dialog tracking-history-dialog';dialog.setAttribute('aria-labelledby','tracking-history-title');
 dialog.innerHTML='<div class="dialog-heading"><h2 id="tracking-history-title">Tracking history</h2><button id="tracking-history-close" type="button" class="icon-button" aria-label="Close tracking history">×</button></div><p class="field-help">Updates change your current figures. Baseline versions stay fixed.</p><label for="tracking-inspect-month">Inspect a month<input id="tracking-inspect-month" type="month" /></label><div id="tracking-month-summary" class="tracking-month-summary"></div><p id="tracking-empty" class="field-help">Log an update in an asset, debt, income or spending editor to start your history.</p><div id="tracking-history-list"></div>';
 const correction=el('dialog');correction.id='tracking-correction-dialog';correction.className='form-dialog baseline-dialog';correction.setAttribute('aria-labelledby','tracking-correction-title');
 correction.innerHTML='<div class="dialog-heading"><h2 id="tracking-correction-title">Correct an update</h2><button id="tracking-correction-close" type="button" class="icon-button" aria-label="Cancel correction">×</button></div><form id="tracking-correction-form"><p class="field-help">The original entry stays in history, marked corrected.</p><label for="tracking-correction-date">Effective date<input id="tracking-correction-date" type="date" required /></label><div id="tracking-correction-values" class="tracking-correction-values"></div><label for="tracking-correction-reason">Reason <span class="optional">Optional</span><input id="tracking-correction-reason" maxlength="200" /></label><p id="tracking-correction-error" class="form-error" role="alert" hidden></p><button type="submit" class="button button-primary">Save correction</button></form>';
 document.body.append(dialog,correction);const $=id=>document.getElementById(id);let correcting=null,sourceKey='',internalCommit=false;
 function monthSummary(){
  const p=getPicture(),month=$('tracking-inspect-month').value;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
  const current=trackedInputsAt(p.flow,p.holdings,month),lastDay=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10),b=activeBaseline(p.baselines,lastDay),rows=[];
  for(const owner of p.holdings.partnerName?['primary','partner']:['primary']){
   const person=owner==='primary'?p.holdings.name:p.holdings.partnerName,pay=current.flow.pay[owner];
   const elapsed=b?Math.max(0,(Number(month.slice(0,4))-Number(b.forecast.startMonth.slice(0,4)))*12+Number(month.slice(5))-Number(b.forecast.startMonth.slice(5)))/12:0;
   const expected=b?b.inputs.flow.pay[owner].annualGross*(1+b.forecast.assumptions.incomeGrowth/100)**elapsed:null;
   const row=el('div');row.append(el('strong',`${person} · annual gross rate`),el('span',`${b?`Baseline v${b.number}: ${money(expected)}`:'No baseline for this date'} · Recorded rate: ${money(pay.annualGross)}`));
   const relevant=activeTrackingEntries(p.flow.tracking).filter(e=>e.effectiveDate.slice(0,7)<=month&&(e.mode!=='period'||e.effectiveDate.startsWith(month))&&e.changes.some(c=>c.target.kind==='pay'&&c.target.id===owner));
   row.append(el('small',relevant.length?`Applies from ${relevant.at(-1).effectiveDate} · based on recorded rates, not verified payslips`:'Starting rate · later pay changes have not been confirmed'));
   const receipts=recordedPayReceipts(p.flow.tracking,month);if(Object.hasOwn(receipts,owner))row.append(el('span',`Recorded take-home receipt: ${money(receipts[owner])} for this month`));else if(pay.annualTakeHome!=null)row.append(el('span',`Entered annual take-home rate: ${money(pay.annualTakeHome)}`));rows.push(row);
  }
  $('tracking-month-summary').replaceChildren(...rows);
 }
 function render(force=false){
  const p=getPicture(),all=p.flow.tracking?.entries||[],active=new Set(activeTrackingEntries(p.flow.tracking).map(e=>e.id));
  button.hidden=p.example||!p.baselines?.entries.length&&!all.length;button.textContent=all.length?`History (${all.length})`:'History';
  if(!force&&!dialog.open)return;
  $('tracking-empty').hidden=Boolean(all.length);$('tracking-inspect-month').min=p.flow.tracking?.startMonth||p.flow.timelineStartMonth;
  $('tracking-history-list').replaceChildren(...[...all].reverse().map(e=>{
   const item=el('article');item.className='tracking-history-entry';item.append(el('h3',e.label),el('p',`Effective ${e.effectiveDate} · recorded ${e.recordedAt.slice(0,10)}${e.mode==='period'?' · this month only':''}${!active.has(e.id)?' · corrected':e.corrects?' · correction':''}`));
   const dl=el('dl');for(const c of e.changes){dl.append(el('dt',heading(c,e)),el('dd',`${display(c,c.before,e)} → ${display(c,c.value,e)}`));}item.append(dl);if(e.reason)item.append(el('p',e.reason));
   if(active.has(e.id)){const edit=el('button','Correct');edit.type='button';edit.className='text-button';edit.addEventListener('click',()=>openCorrection(e));item.append(edit);}return item;
  }));monthSummary();
 }
 function openCorrection(entry){
  correcting=entry;sourceKey=JSON.stringify(getPicture());$('tracking-correction-date').value=entry.effectiveDate;$('tracking-correction-date').min=`${getPicture().flow.tracking.startMonth}-01`;$('tracking-correction-date').max=entry.changes.some(c=>['asset','debt'].includes(c.target.kind))?trackingToday():'2200-12-31';$('tracking-correction-reason').value='';$('tracking-correction-error').hidden=true;
  $('tracking-correction-values').replaceChildren(...entry.changes.map((c,index)=>{
   const label=el('label',heading(c,entry)),input=el('input');input.dataset.correctionIndex=index;
   if(c.value===null){label.append(el('span','This entry removes or clears a value. Correct its effective date here.'));return label;}
   if(typeof c.value==='string'){input.type='month';input.value=c.value;}
   else {input.type='number';input.min=0;input.max=c.target.field.endsWith('Rate')?100:100_000_000;input.step='.01';input.required=true;enableGroupedNumberInput(input);input.value=typeof c.value==='object'?c.value.value??c.value.balance??c.value.amount:isReceipt(c,entry)?c.value/12:c.value;}
   label.append(input);return label;
  }));correction.showModal();
 }
 $('tracking-correction-form').addEventListener('submit',event=>{
  event.preventDefault();if(!event.currentTarget.reportValidity())return;
  try{
   if(JSON.stringify(getPicture())!==sourceKey)throw new Error('The household changed. Reopen this correction.');
   const values=correcting.changes.map((c,index)=>{const input=correction.querySelector(`[data-correction-index="${index}"]`);if(!input)return c.value;if(typeof c.value==='string')return input.value;const value=groupedNumberValue(input);if(typeof c.value==='object')return {...c.value,[c.target.kind==='asset'?'value':c.target.kind==='debt'?'balance':'amount']:value};return isReceipt(c,correcting)?Math.round(value*1200)/100:value;});
   internalCommit=true;try{commitFlow(correctTrackingUpdate(getPicture().flow,correcting.id,values,{effectiveDate:$('tracking-correction-date').value,reason:$('tracking-correction-reason').value}));}finally{internalCommit=false;}correction.close();render(true);announce('Correction saved. The original entry remains in history.');
  }catch(e){$('tracking-correction-error').textContent=e.message;$('tracking-correction-error').hidden=false;}
 });
 button.addEventListener('click',()=>{$('tracking-inspect-month').value=getPicture().flow.asOfMonth;render(true);dialog.showModal();});$('tracking-history-close').addEventListener('click',()=>dialog.close());$('tracking-correction-close').addEventListener('click',()=>correction.close());$('tracking-inspect-month').addEventListener('change',monthSummary);
 document.addEventListener('picture-updated',()=>{if(!internalCommit){if(correction.open&&JSON.stringify(getPicture())!==sourceKey)correction.close();if(dialog.open)dialog.close();}render();});render();
}
