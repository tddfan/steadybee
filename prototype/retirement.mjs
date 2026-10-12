import { householdExample, simulateHousehold, openingPicture, convertStreamFrequency, paymentForDebtEnd, monthlyDebtPayment } from './retirement-household.mjs';
import { householdBaseExample } from './retirement-example.mjs';
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const compact=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value);
let input=householdBaseExample(),actions={},current=null,baseline=null,stressed=null,screen='today',selectedYear=2026,sequence=0,savedScenarios=[];
const icons={cash:'savings',investment:'investment',pension:'pension',property:'home',car:'work',bonds:'coins'};
const definitions={
 jobPartner:{title:'Jemma redundancy',icon:'pause',group:'work',note:'Stops Jemma’s employment-linked pay and bonus at the entered month. Severance is paid once; future employment is optional.',fields:[]},
 allocate:{title:'Cash / investment mix',icon:'investment',group:'stress',note:'A user-chosen transfer between owned accounts. Investment returns are editable assumptions, with losses in the stress path. This is not an allocation recommendation.',fields:[]},
 parttimePartner:{title:'Jemma part-time',icon:'work',group:'work',note:'Salary and bonus scale with chosen days out of five. Retirement and redundancy still stop employment pay.',fields:[['partTimePartnerAge','Jemma steps back at',18,100,1],['partTimeDaysPartner','Jemma days / week (from 5)',0,5,1]]},
 early:{title:'Stop work earlier',icon:'sun',group:'work',note:'Salary stops at each work-end age. DB and State Pension dates stay separate.',fields:[['earlyPrimary','Alex stops at',18,100,1],['earlyPartner','Jemma stops at',18,100,1]]},
 job:{title:'Alex redundancy',icon:'pause',group:'work',note:'Salary is prorated by employment months. Bonus is paid only if employed in its payment month. No benefits or tax entitlements are invented.',fields:[['jobAge','Alex age at interruption',18,100,1],['jobYears','Years without salary',1,20,1]]},
 parttime:{title:'Alex part-time',icon:'work',group:'work',note:'Salary and bonus scale with chosen days out of five. Retirement and redundancy still stop employment pay.',fields:[['earlyPrimary','Alex steps back at',18,100,1],['partTimeDaysPrimary','Alex days / week (from 5)',0,5,1]]},
 downsize:{title:'Downsize',icon:'home',group:'home',note:'Sell the modelled home, buy a replacement, settle the mortgage and pay costs. Only the remainder becomes cash.',fields:[['downsizeAge','Move at Alex age',18,100,1],['replacementPercent','Replacement / sale value (%)',0,100,5],['movingCosts','Moving / transaction costs (£)',0,1000000,1000]]},
 lease:{title:'Lower car costs',icon:'work',group:'home',note:'Caps declared lease costs; car finance is still modelled separately.',fields:[['leaseMonthly','Lease budget / month (£)',0,10000,50]]},
 payoff:{title:'Repay mortgage',icon:'mortgage',group:'home',note:'Repays the linked home mortgage using your selected withdrawal owner, order and ceiling, including deduction estimates. Locked pensions remain unavailable. This is not a lender payoff quote.',fields:[['payoffAge','Pay off at Alex age',18,100,1]]},
 spend:{title:'Spend less',icon:'spending',group:'money',note:'Reduces regular spending. Debt payments, one-offs and saving goals remain separate.',fields:[['spendPercent','Regular spending reduction (%)',0,100,5]]},
 pension:{title:'Save into pension',icon:'pension',group:'money',note:'Adds a pension-saving goal funded only from surplus income while Alex works. It is an internal transfer, not new wealth; tax relief is not calculated.',fields:[['pensionMonthly','Extra saving / month (£)',0,10000,100]]},
 withdraw:{title:'One-off spending',icon:'family',group:'family',note:'A budget for school fees, family help or another dated cost. Income funds it first, then available assets; any remaining gap is explicit.',fields:[['withdrawAge','Spend at Alex age',18,100,1],['withdrawAmount','One-off budget (£)',0,10000000,1000]]},
 growth:{title:'Change growth',icon:'investment',group:'stress',note:'A hypothetical increase to the trading-account return assumption, not an allocation recommendation or expected return. Compare the stress path too.',fields:[['growthExtra','Extra assumed growth / year (%)',0,10,.5]]},
 fixed:{title:'Fixed-income mix',icon:'coins',group:'stress',note:'Moves a chosen part of trading assets into the declared fixed-income account. This does not guarantee safety; the stress path includes a bond loss.',fields:[['fixedAge','Change mix at Alex age',18,100,1],['fixedPercent','Trading assets moved (%)',0,100,5]]},
 market:{title:'Market setback',icon:'investment',group:'stress',note:'One loss across trading and pension assets; bonds lose 5%. Returns resume on reduced balances. Cash and property are unchanged.',fields:[['marketAge','Loss at Alex age',18,100,1],['marketPercent','Trading / pension loss (%)',0,100,5]]},
 inflation:{title:'Higher costs',icon:'inflation',group:'stress',note:'Adds two percentage points to declared expense growth. Income growth is unchanged. This is a price stress, not a complete inflation model.',fields:[]},
 legacy:{title:'Resources left',icon:'legacy',group:'family',note:'Compare remaining net wealth with a target. Property may not be spendable; inheritance tax and death benefits are not calculated.',fields:[['legacyTarget','End-horizon target (£)',0,100000000,10000]]},
};
function node(tag,attributes={},children=[]) {const element=document.createElement(tag);for(const [key,value] of Object.entries(attributes)){if(key==='text')element.textContent=value;else if(key==='class')element.className=value;else if(key==='checked')element.checked=value;else element.setAttribute(key,value);}for(const child of children)element.append(typeof child==='string'?document.createTextNode(child):child);return element;}
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href',`#icon-${name}`);svg.append(use);return svg;}
function numberField(label,object,key,{min=0,max=1e8,step=100,range=false,change,formatOutput}={}) {
 const control=node('input',{type:range?'range':'number',min,max,step,value:object[key],'aria-label':label});
 const caption=node('span',{text:label});const output=range?node('output',{text:formatOutput?formatOutput(object[key]):object[key]}):null;
 control.addEventListener('input',()=>{object[key]=control.value===''?NaN:Number(control.value);if(output)output.textContent=formatOutput?formatOutput(object[key]):object[key];change?.();calculate();});
 return node('label',{class:range?'range-field':'number-field'},[caption,...(output?[output]:[]),control]);
}
function selectField(label,object,key,choices,onChange) {
 const control=node('select',{'aria-label':label});for(const [value,text] of choices)control.append(node('option',{value,text}));control.value=object[key];
 control.addEventListener('change',()=>{object[key]=control.value;onChange?.();calculate();});return node('label',{class:'select-field'},[node('span',{text:label}),control]);
}
function taxFields(object,{withdrawal=false,returns=false}={}){
 const key=withdrawal?'withdrawalTaxBasis':'taxBasis',rateKey=withdrawal?'withdrawalTaxRate':'taxRate';object[key]??='net';object[rateKey]??=0;
 const rate=numberField(`${object.label??personForRow(object)?.name??'Severance'} ${withdrawal?'withdrawal':returns?'return':'income'} deduction (%)`,object,rateKey,{max:withdrawal?99:100,step:1});rate.hidden=object[key]!=='estimate';
 const basis=selectField(withdrawal?'Withdrawal tax':returns?'Return assumption':'Amount entered',object,key,[['net',withdrawal?'No further tax assumed':returns?'After tax / charges':'After tax (take-home)'],['excluded','Tax not included'],['estimate','Before tax + my deduction estimate']],()=>{rate.hidden=object[key]!=='estimate';});
 return [basis,rate,node('p',{class:'small',text:'A deduction estimate is your assumption, not a calculation of tax rules. Tax excluded uses the full amount and can overstate spendable money.'})];
}
function taxBadge(row){return row.taxBasis==='excluded'?'Tax excluded':row.taxBasis==='estimate'?'Est. net':'After tax';}
function defaultScenarioSettings(){return householdBaseExample().settings;}
function owners(){return input.people.map(p=>[p.id,p.name]);}
function show(next) {screen=next;document.body.dataset.workspaceScreen=next;document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===next)));for(const id of ['today','flows','plan'])$('screen-'+id).hidden=id!==next;if(next==='plan')drawCharts();$('demo').scrollIntoView({block:'start',behavior:'instant'});}
const dialog=$('quick-editor');
let restoreTarget=null;
function openEditor(title,fields,buttons=[]) {
 restoreTarget=document.activeElement;
 $('quick-editor-title').textContent=title;
 $('quick-editor-fields').replaceChildren(...fields);
 $('quick-editor-actions').replaceChildren(...buttons);
 dialog.showModal();
 $('quick-editor-error').hidden=$('household-error').hidden;$('quick-editor-error').textContent=$('household-error').textContent;
 $('quick-editor-fields').querySelector('input,select')?.focus();
}
$('close-editor').addEventListener('click',()=>dialog.close());
$('done-editor').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{const rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();});
dialog.addEventListener('close',()=>{if(restoreTarget?.isConnected)restoreTarget.focus({preventScroll:true});else {const data=restoreTarget?.dataset??{};const target=data.assetButton?document.querySelector(`[data-asset-button="${data.assetButton}"]`):data.editRow?document.querySelector(`[data-edit-row="${data.editRow}"]`):data.timing?document.querySelector(`[data-timing="${data.timing}"]`):null;(target??document.querySelector(`[data-screen="${screen}"]`))?.focus({preventScroll:true});}});
function inlineAmount(label,object,key,unit='') {
 const field=numberField(label,object,key,{step:.01});field.classList.add('inline-number');field.querySelector('input').value=String(Math.round(object[key]*100)/100);
 const wrapper=node('div',{class:'ledger-amount'},[node('span',{class:'currency-mark',text:'£'}),field]);
 if(unit)wrapper.append(node('button',{type:'button',class:'amount-unit',text:unit,'aria-label':'Change frequency'}));
 return wrapper;
}
function renderPeople() {
 $('people-fields').replaceChildren(...input.people.map(person=>{
  const chip=node('button',{type:'button',class:'person-chip','data-person-chip':person.id,text:`${person.name} · ${person.age}`});
  chip.addEventListener('click',()=>{
   let oldStateAge=person.stateAge;
   const sync=()=>{for(const stream of input.incomes.filter(r=>r.type==='state'&&r.owner===person.id))stream.startAge=person.stateAge;renderStreams();renderPlanPeople();};
   openEditor(person.name,[...(person.niYears!==undefined?[numberField('NI qualifying years (record only)',person,'niYears',{min:0,max:60,step:1})]:[]),numberField('Age now',person,'age',{min:18,max:100,step:1,change:sync}),numberField('State Pension age',person,'stateAge',{min:50,max:100,step:1,change:()=>{if(person.retireAge===oldStateAge)person.retireAge=person.stateAge;oldStateAge=person.stateAge;sync();}})]);
  });return chip;
 }));
}
function renderAssets() {
 $('asset-cards').replaceChildren(...input.assets.map(asset=>{
  const button=node('button',{type:'button',class:'asset-tile','data-asset-button':asset.id},[icon(icons[asset.type]),node('span',{text:asset.label}),node('strong',{'data-asset-total':asset.id,text:money(asset.balance)}),node('small',{'data-asset-rate':asset.id,text:`${asset.rate}% / year${asset.availableYear?` · available ${asset.availableYear}`:''}`})]);
  button.addEventListener('click',()=>{
   asset.availableYear??=input.year;asset.wrapper??=asset.type==='pension'?'pension':'taxable';
   const fields=[numberField('Balance / value (£)',asset,'balance'),numberField(asset.type==='car'?'Value change / year (%)':'Total return assumption / year (%)',asset,'rate',{min:-50,max:30,step:.5})];
   const more=node('details',{class:'quick-more'},[node('summary',{text:'More settings'})]);
   const advanced=[...taxFields(asset,{returns:true}),selectField('Account / holding',asset,'wrapper',[['taxable','Taxable account'],['isa','ISA'],['pension','Pension'],['property','Property'],['other','Other']]),...taxFields(asset,{withdrawal:true}),numberField('Available from year',asset,'availableYear',{min:input.year,max:input.year+80,step:1}),selectField('Owner',asset,'owner',asset.type==='pension'?owners():[...owners(),['joint','Household']])];
   if(!['cash','bonds'].includes(asset.id))advanced.push(selectField('Asset type',asset,'type',[['cash','Savings'],['investment','Trading / ISA'],['pension','Pension pot'],['property','Property'],['car','Vehicle'],['bonds','Fixed income']],()=>{if(asset.type==='pension'&&asset.owner==='joint')asset.owner='primary';dialog.close();renderAssets();}));
   if(asset.type==='pension')advanced.push(numberField('Access at owner age',asset,'accessAge',{min:18,max:100,step:1}));
   more.append(node('div',{class:'quick-fields'},advanced));fields.push(more);
   const buttons=[];
   if(!['cash','bonds'].includes(asset.id)){const remove=node('button',{type:'button',class:'remove-row',text:'Remove asset'});remove.addEventListener('click',()=>{dialog.close();input.assets=input.assets.filter(a=>a!==asset);renderAssets();calculate();});buttons.push(remove);}
   openEditor(asset.label,fields,buttons);
  });return button;
 }));
}
function renderDebts() {
 $('debt-cards').replaceChildren(...input.debts.map(debt=>{
  const meta=node('button',{type:'button',class:'debt-meta','data-debt-meta':debt.id,text:`${debt.rate}% · ${money(debt.payment)}/mo`});
  const edit=()=>{
   const remove=node('button',{type:'button',class:'remove-row',text:'Remove debt'});remove.addEventListener('click',()=>{dialog.close();input.debts=input.debts.filter(d=>d!==debt);renderDebts();calculate();});
   const projected=baseline?.rows.find(r=>r.debtBalances[debt.id]<.01);
   const target={year:projected?.year??input.year+9,mode:'payment'};
   const payment=numberField('Payment / month (£)',debt,'payment',{step:.01});
   const end=numberField('Target end year (payment adjusts)',target,'year',{min:input.year,max:input.year+80,step:1,change:()=>{if(target.mode==='end')syncPayment();}});end.hidden=true;
   function syncPayment(){try{debt.payment=debt.monthly?monthlyDebtPayment(debt.balance,debt.rate,(target.year-input.year+1)*12):paymentForDebtEnd(debt.balance,debt.rate,target.year-input.year+1);payment.querySelector('input').value=debt.payment.toFixed(2);}catch{debt.payment=NaN;}}
   const mode=selectField('Set by',target,'mode',[['payment','Monthly payment'],['end','End year']],()=>{end.hidden=target.mode!=='end';payment.querySelector('input').readOnly=target.mode==='end';if(target.mode==='end')syncPayment();});
   openEditor(debt.label,[mode,numberField('Interest / year (%)',debt,'rate',{max:50,step:.5,change:()=>{if(target.mode==='end')syncPayment();}}),payment,end,selectField('Debt type',debt,'type',[['mortgage','Mortgage'],['loan','Loan / credit']]),node('p',{class:'small',text:'End year adjusts the payment. Home mortgage interest compounds monthly; cash funding is annual. Unfunded balances remain. Fees, rate changes and balloon payments are not calculated.'})],[remove]);
  };
  meta.addEventListener('click',edit);
  const timing=node('button',{type:'button',class:'timing-chip','data-debt-timing':debt.id,text:'Estimated end'});timing.addEventListener('click',edit);
  const more=node('button',{type:'button',class:'more-button','aria-label':`More settings for ${debt.label}`,text:'⋯'});more.addEventListener('click',edit);
  return node('div',{class:'debt-row'},[node('strong',{text:debt.label}),inlineAmount(`${debt.label} balance (£)`,debt,'balance'),meta,timing,more]);
 }));
}
function streamRow(row,list) {
 const title=node('input',{type:'text',class:'stream-title',value:row.label,title:row.label,'aria-label':`${list==='incomes'?'Income':'Expense'} name`,maxlength:70});title.addEventListener('input',()=>{row.label=title.value;});
 const amount=inlineAmount(`${row.label} amount (£ per ${row.frequency==='month'?'month':row.frequency==='year'?'year':'one-off'})`,row,'amount',row.frequency==='month'?'/mo':row.frequency==='year'?'/yr':'once');
 if(list==='incomes'){const basis=node('button',{type:'button',class:'tax-chip','data-tax-badge':row.id,text:taxBadge(row),'aria-label':`Tax basis for ${row.label}`});basis.addEventListener('click',()=>openEditor(row.label+' · tax',taxFields(row)));amount.append(basis);}
 const startChange=()=>{if(row.type==='state'){const person=personForRow(row),previous=person.stateAge;person.stateAge=row.startAge;if(person.retireAge===previous)person.retireAge=person.stateAge;renderPeople();renderPlanPeople();}if(row.frequency==='once')row.endAge=row.startAge;};
 const timing=node('button',{type:'button',class:'timing-chip','data-timing':row.id,text:timingLabel(row),'aria-label':`Timing for ${row.label}`});
 timing.addEventListener('click',()=>{
  const person=personForRow(row);
  const fields=[selectField('Age belongs to',row,'owner',owners(),()=>{if(row.type==='state')row.startAge=personForRow(row).stateAge;dialog.close();renderStreams();document.querySelector(`[data-timing="${row.id}"]`)?.click();}),numberField(`Starts at ${person.name}’s age`,row,'startAge',{min:18,max:105,step:1,range:true,formatOutput:age=>`${age} · ${input.year+age-person.age}`,change:startChange})];
  if(row.frequency!=='once'){
   const choice={duration:row.ongoing?'ongoing':'until'};
   const end=numberField(`Ends at start of ${person.name}’s age`,row,'endAge',{min:18,max:110,step:1,range:true,formatOutput:age=>`${age} · ${input.year+age-person.age}`});end.hidden=Boolean(row.ongoing);
   fields.push(selectField('Duration',choice,'duration',[['ongoing','Ongoing'],['until','Until age…']],()=>{row.ongoing=choice.duration==='ongoing';end.hidden=row.ongoing;}),end);
   if(list==='expenses'&&row.type!=='saving'){
    const changes=node('div',{class:'budget-changes'});
    const render=()=>{changes.replaceChildren(...(row.changes??[]).map((change,index)=>{
     const remove=node('button',{type:'button',class:'quiet-button',text:'Remove change'});remove.addEventListener('click',()=>{row.changes.splice(index,1);render();calculate();});
     return node('div',{class:'budget-step'},[numberField(`Changes at ${person.name}’s age`,change,'age',{min:row.startAge,max:105,step:1,range:true,formatOutput:age=>`${age} · ${input.year+age-person.age}`}),numberField(`New budget (£/${row.frequency==='month'?'month':'year'}, ${row.priceBasis==='future'?'quoted prices':'today’s prices'})`,change,'amount',{step:50}),remove]);
    }));};render();
    const add=node('button',{type:'button',class:'quiet-button',text:'+ Change later'});add.addEventListener('click',()=>{(row.changes??=[]).push({age:Math.min(105,Math.max(row.startAge,personForRow(row).retireAge)),amount:row.amount});render();calculate();});
    fields.push(changes,add);
   }
  }
  fields.push(node('p',{class:'small',text:`${person.name} turns ${row.startAge} in ${input.year+row.startAge-person.age}. ${['salary','bonus','saving'].includes(row.type)?'This stream also ends when they stop work.':'End ages exclude that year.'}`}));
  openEditor(row.label+' · timing',fields);
 });
 const more=node('button',{type:'button',class:'more-button','data-edit-row':row.id,'aria-label':`More settings for ${row.label}`,text:'⋯'});
 more.addEventListener('click',()=>{
  let previousFrequency=row.frequency;
  const frequency=selectField('Frequency',row,'frequency',[['month','Monthly'],['year','Yearly'],['once','One-off']],()=>{
   const next=row.frequency;row.frequency=previousFrequency;convertStreamFrequency(row,next);
   previousFrequency=row.frequency;
   if(row.frequency==='once')row.endAge=row.startAge;else if(row.endAge<=row.startAge)row.endAge=row.startAge+1;
   renderStreams();
  });
  const owner=selectField('Owner',row,'owner',owners(),()=>{if(row.type==='state')row.startAge=personForRow(row).stateAge;renderStreams();});
  const copy=node('button',{type:'button',class:'quiet-button',text:'Duplicate'});copy.addEventListener('click',()=>{dialog.close();input[list].push({...structuredClone(row),id:`copy-${++sequence}`,label:row.label+' copy'});renderStreams();calculate();});
  const remove=node('button',{type:'button',class:'remove-row',text:'Remove'});remove.addEventListener('click',()=>{dialog.close();input[list]=input[list].filter(r=>r!==row);renderStreams();calculate();});
  const extras=[];if(list==='incomes'){extras.push(...taxFields(row));if(row.type==='bonus'||row.frequency==='once'){row.paymentMonth??=1;extras.push(numberField('Payment month (1–12)',row,'paymentMonth',{min:1,max:12,step:1}));}if(['dividend','sale'].includes(row.type)){row.assetId??=input.assets.find(a=>a.type==='investment'&&a.owner===row.owner)?.id;extras.push(selectField('Release from account',row,'assetId',input.assets.filter(a=>a.type==='investment').map(a=>[a.id,a.label])));}}else{row.priceBasis??='today';extras.push(selectField('Budget prices',row,'priceBasis',[['today','Today’s prices + inflation'],['future','Quoted future prices']]));if(row.type==='vehicle'){row.assetId??='car';extras.push(selectField('Vehicle purchased',row,'assetId',input.assets.filter(a=>a.type==='car').map(a=>[a.id,a.label])));}}
  openEditor(row.label,[frequency,owner,...extras,numberField(list==='expenses'&&row.priceBasis!=='future'&&['regular','oneoff','education','vehicle'].includes(row.type)?'Growth above inflation (%)':'Annual growth (%)',row,'growth',{min:-20,max:20,step:.5})],[copy,remove]);
 });
 const unit=amount.querySelector('.amount-unit');
 if(unit){unit.setAttribute('aria-label',`Change frequency for ${row.label}`);unit.title='Switch monthly / yearly';unit.addEventListener('click',()=>{
  if(row.frequency==='once'){more.click();return;}
  convertStreamFrequency(row,row.frequency==='year'?'month':'year');renderStreams();calculate();document.querySelector(`[data-stream="${row.id}"] .amount-unit`)?.focus({preventScroll:true});
 });}

 const rowIcon=row.type==='salary'?'work':['state','pension','saving'].includes(row.type)?'pension':['dividend','sale'].includes(row.type)?'investment':row.frequency==='once'?'family':'spending';
 return node('div',{class:'ledger-row','data-stream':row.id},[icon(rowIcon),title,amount,timing,more]);
}
function personForRow(row){return input.people.find(p=>p.id===row.owner);}
function timingLabel(row) {
 const person=personForRow(row),start=row.type==='state'?person.stateAge:row.startAge;
 const end=['salary','bonus','saving'].includes(row.type)?Math.min(row.ongoing?Infinity:row.endAge,person.retireAge):(row.ongoing?Infinity:row.endAge);
 if(row.frequency==='once')return start===person.age?'Once · now':`At ${start}`;
 if(row.changes?.length)return `${person.name} · changes ${Math.min(...row.changes.map(c=>c.age))}`;
 if(start>person.age)return `From ${person.name} ${start}`;
 return (['salary','bonus','saving'].includes(row.type))&&end===person.retireAge?`Until ${person.name} stops work`:end===Infinity?'Ongoing':`Until ${person.name} ${end}`;
}
function renderStreams() {$('income-rows').replaceChildren(...input.incomes.map(r=>streamRow(r,'incomes')));$('expense-rows').replaceChildren(...input.expenses.map(r=>streamRow(r,'expenses')));}
function renderPlanPeople() {
 $('plan-people').replaceChildren(...input.people.map(person=>{
  const button=node('button',{type:'button',class:'person-chip','data-plan-person':person.id,text:`${person.name} · work ends ${person.retireAge}`});
  button.addEventListener('click',()=>openEditor(person.name+' · baseline dates',[numberField('Stop work at',person,'retireAge',{min:18,max:100,step:1,range:true}),numberField('Plan until age',person,'horizonAge',{min:person.age,max:105,step:1})]));return button;
 }),node('button',{type:'button',class:'person-chip',id:'inflation-chip',text:`Inflation ${input.inflation}%`}));
 $('inflation-chip').addEventListener('click',()=>openEditor('Inflation assumption',[numberField('Inflation assumption (%)',input,'inflation',{max:15,step:.5}),node('p',{class:'small',text:'An editable illustration, not a live market forecast.'})]));
}
function renderActions() {
 $('household-actions').replaceChildren();$('more-actions').replaceChildren();
 Object.entries(definitions).forEach(([key,definition])=>{
  const button=node('button',{type:'button','data-action':key,'data-group':definition.group,'aria-pressed':String(Boolean(actions[key]))},[icon(definition.icon),definition.title]);
  button.addEventListener('click',()=>{actions[key]=!actions[key];renderActions();calculate();document.querySelector(`[data-action="${key}"]`)?.focus({preventScroll:true});});$('early job spend pension'.split(' ').includes(key)?'household-actions':'more-actions').append(button);
 });
 $('action-editors').replaceChildren(...Object.entries(definitions).filter(([key])=>actions[key]).map(([key,definition])=>{
  const note=node('details',{class:'scenario-note'},[node('summary',{text:'Assumptions'}),node('p',{text:definition.note})]);
  const profile=input.employment?.find(e=>e.owner===(key==='job'?'primary':key==='jobPartner'?'partner':null));
  const fields=key==='allocate'?[selectField('Cash account',input.allocation,'fromId',input.assets.filter(a=>a.type==='cash').map(a=>[a.id,a.label])),selectField('Investment account',input.allocation,'toId',input.assets.filter(a=>a.type==='investment').map(a=>[a.id,a.label])),numberField('Change in year',input.allocation,'year',{min:input.year,max:input.year+80,step:1}),numberField('Cash transferred (%)',input.allocation,'percent',{max:100,step:5})]:profile?[numberField('Redundancy year',profile,'year',{min:input.year,max:input.year+80,step:1}),numberField('Month (1–12)',profile,'month',{min:1,max:12,step:1}),numberField('Severance amount (£)',profile,'severance',{step:1000}),...taxFields(profile),numberField('Years until new job (0 = no return)',profile,'returnYears',{min:0,max:40,step:1}),numberField('New job pay (% of previous pay)',profile,'returnPayPercent',{min:0,max:200,step:5})]:definition.fields.map(([field,label,min,max,step])=>numberField(label,input.settings,field,{min:(field.includes('Age')||['earlyPrimary','earlyPartner'].includes(field))?input.people[field==='earlyPartner'||field==='partTimePartnerAge'?1:0].age:min,max,step}));
  return node('div',{class:'action-editor','data-editor':key},[node('h4',{text:definition.title}),node('div',{class:'action-fields'},fields),note]);
 }));
}
function calculate() {
 try{
  baseline=simulateHousehold(input);current=simulateHousehold(input,actions);stressed=simulateHousehold(input,actions,true);
  $('household-error').hidden=true;$('quick-editor-error').hidden=true;for(const id of ['wealth-chart','income-chart'])$(id).style.display='';
  $('tax-warning').textContent=current.warnings.some(w=>w.includes('tax excluded'))?'Tax excluded in some figures · check the example assumptions.':'';
  $('example-notes').replaceChildren(node('summary',{text:'Starting example & tax assumptions'}),...(input.assumptionNotes??[]).map(text=>node('p',{class:'small',text})),node('p',{class:'small',text:current.warnings.join(' ')}));
  const opening=openingPicture(input);$('net-total').textContent=money(opening.net);$('accessible-total').textContent=money(opening.accessible);$('opening-equation').textContent=`${compact(opening.assets)} assets − ${compact(opening.debt)} debts`;
  for(const asset of input.assets){const display=document.querySelector(`[data-asset-total="${asset.id}"]`);if(display)display.textContent=money(asset.balance);const rate=document.querySelector(`[data-asset-rate="${asset.id}"]`);if(rate)rate.textContent=`${asset.rate}% / year${asset.availableYear&&asset.availableYear>input.year?` · available ${asset.availableYear}`:''}`;}
  for(const person of input.people){const chip=document.querySelector(`[data-person-chip="${person.id}"]`);if(chip)chip.textContent=`${person.name} · ${person.age}`;const planChip=document.querySelector(`[data-plan-person="${person.id}"]`);if(planChip)planChip.textContent=`${person.name} · work ends ${person.retireAge}`;}
  if($('inflation-chip'))$('inflation-chip').textContent=`Inflation ${input.inflation}%`;
  for(const debt of input.debts){const meta=document.querySelector(`[data-debt-meta="${debt.id}"]`);if(meta)meta.textContent=`${debt.rate}% · ${money(debt.payment)}/mo`;const timing=document.querySelector(`[data-debt-timing="${debt.id}"]`);const end=baseline.rows.find(r=>r.debtBalances[debt.id]<.01);if(timing)timing.textContent=debt.balance===0?'Paid off':end?`Ends ~${end.year}`:'Beyond plan';}
  for(const row of input.incomes){const badge=document.querySelector(`[data-tax-badge="${row.id}"]`);if(badge)badge.textContent=taxBadge(row);}
  for(const row of [...input.incomes,...input.expenses]){const label=document.querySelector(`[data-timing="${row.id}"]`);if(label)label.textContent=timingLabel(row);}
  const now=baseline.rows[0];$('income-now').textContent=money(now.income/12)+'/mo';$('spending-now').textContent=money(now.spending/12)+'/mo';$('surplus-now').textContent=money(Math.max(0,now.income-now.spending)/12)+'/mo';$('saving-goal-warning').textContent=now.unfundedSaving>0.01?`${money(now.unfundedSaving/12)}/mo of the pension-saving goals is not funded by the current surplus.`:'';
  const result=current.firstGap?`First funding gap at Alex age ${current.firstGap.primaryAge} · ${money(current.firstGap.gap)} that year.`:`Spending covered to Alex ${current.final.primaryAge} · illustration`;
  $('plan-result').replaceChildren(node('strong',{text:result}),...(stressed.firstGap?[node('span',{class:'stress-warning',text:`Stress path: first unpaid spending at Alex age ${stressed.firstGap.primaryAge}. Property is not automatically sold to cover a gap.`})]:[]),node('span',{text:`Remaining estate ${compact(current.final.netWealth)} · Alex ${current.final.primaryAge} / Jemma ${current.final.partnerAge}${actions.legacy?` · ${compact(Math.abs(current.final.netWealth-input.settings.legacyTarget))} ${current.final.netWealth>=input.settings.legacyTarget?'above':'below'} target`:''}${current.firstGap?' · earlier gaps remain unpaid':''}.`}));
  $('estate-composition').replaceChildren(node('summary',{text:`Financial assets ${compact(current.final.financialAssets)} · Property ${compact(current.final.propertyValue)}`}),node('p',{class:'small',text:`Vehicle ${money(current.final.vehicleValue)} · Debt ${money(current.final.closingDebt)}. Estate includes property; it is not all available for spending.`}));
  const delta=current.final.netWealth-baseline.final.netWealth;const accessAge=input.people[0].retireAge;const c=current.rows.find(r=>r.primaryAge===accessAge)??current.final,b=baseline.rows.find(r=>r.primaryAge===c.primaryAge);
  $('scenario-feedback').textContent=Object.values(actions).some(Boolean)?`${result} · ${delta>=0?'+':'−'}${compact(Math.abs(delta))} end estate vs baseline · ${money(c.accessible-b.accessible)} change in accessible assets at Alex ${c.primaryAge}.`:'Choose a change to compare with the baseline.';
  const select=$('inspect-year');const values=current.rows.map(row=>node('option',{value:row.year,text:`${row.year} · Alex ${row.primaryAge}, Jemma ${row.partnerAge}`}));select.replaceChildren(...values);if(!current.rows.some(r=>r.year===selectedYear))selectedYear=current.rows[0].year;select.value=selectedYear;
  renderYear();if(screen==='plan')drawCharts();$('household-status').textContent='Example recalculated. '+result;
 }catch(error){$('quick-editor-error').textContent=error.message;$('quick-editor-error').hidden=!dialog.open;current=null;baseline=null;stressed=null;$('selected-milestone').textContent='';$('household-year-details').replaceChildren();$('inspect-year').replaceChildren();$('household-error').textContent=error.message+' Complete the figures to run this illustration.';$('household-error').hidden=false;for(const id of ['wealth-chart','income-chart'])$(id).style.display='none';$('wealth-events').replaceChildren();$('income-legend').replaceChildren();$('plan-result').textContent='Check the highlighted message before using the plan.';$('saving-goal-warning').textContent='';$('tax-warning').textContent='';$('scenario-feedback').textContent='Complete the figures to compare.';$('estate-composition').replaceChildren();for(const id of ['net-total','accessible-total','income-now','spending-now','surplus-now','year-income','year-withdrawals'])$(id).textContent='—';}
}
const ns='http://www.w3.org/2000/svg';
function svgNode(svg,name,attributes,text){const e=document.createElementNS(ns,name);for(const [key,value]of Object.entries(attributes))e.setAttribute(key,String(value));if(text)e.textContent=text;svg.append(e);return e;}
function chartFrame(id,title,max,min=0) {
 const svg=$(id);svg.replaceChildren();const width=Math.max(260,svg.parentElement.clientWidth),height=400,left=64,right=16,top=36,bottom=342;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-labelledby',id+'-title '+id+'-desc');svgNode(svg,'title',{id:id+'-title'},title);svgNode(svg,'desc',{id:id+'-desc'},title+'. Fictional annual model, future pounds. Use the year inspector for all calculated figures.');
 const x=i=>left+(width-left-right)*i/Math.max(1,current.rows.length-1),y=v=>bottom-(v-min)/(max-min||1)*(bottom-top);
 for(let i=0;i<5;i++){const value=min+(max-min)*i/4;svgNode(svg,'line',{x1:left,x2:width-right,y1:y(value),y2:y(value),stroke:'#d7dfda','stroke-width':1});svgNode(svg,'text',{x:left-7,y:y(value)+5,'text-anchor':'end',fill:'#536568','font-size':16},compact(value));}
 for(let i=0;i<4;i++){const index=Math.round(i/3*(current.rows.length-1));svgNode(svg,'text',{x:x(index),y:369,'text-anchor':'middle',fill:'#536568','font-size':16},String(current.rows[index].primaryAge));}
 svgNode(svg,'text',{x:(width+left-right)/2,y:394,'text-anchor':'middle',fill:'#536568','font-size':16},'Alex’s age');
 return {svg,width,height,x,y,left,right,top,bottom};
}
const funding=[['bonus','Bonus','#687bb6'],['severance','Severance','#92764a'],['inheritance','Inheritance','#926899'],['salary','Work','#4775ac'],['rent','Rent','#ad863c'],['support','Support','#856399'],['pension','DB / pension','#548579'],['state','State Pension','#2b675e'],['other','Other','#85959c'],['assetRelease','Dividends / sales','#a080b3'],['withdrawals','Savings / pots','#d5ac60'],['gap','Unfunded','#b4563b']];
function drawCharts() {
 if(!current||!$('household-error').hidden)return;
 const values=[...baseline.rows,...current.rows,...stressed.rows].map(r=>r.netWealth);const max=Math.max(1,actions.legacy?input.settings.legacyTarget:0,...values)*1.08,min=Math.min(0,...values);
 const frame=chartFrame('wealth-chart','Net household wealth: baseline, chosen scenario and stress path',max,min);const {svg,x,y,width}=frame;
 for(const [model,colour,dash] of [[stressed,'#ad633d','3 4'],[baseline,'#7b898b','7 5'],[current,'#14665f','']]){const path=model.rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(r.netWealth).toFixed(2)}`).join(' ');svgNode(svg,'path',{d:path,stroke:colour,'stroke-width':model===current?3.5:2.5,'stroke-dasharray':dash,fill:'none'});}
 const groups=new Map();for(const event of current.events){if(event.age<current.rows[0].primaryAge||event.age>current.final.primaryAge)continue;groups.set(event.age,[...(groups.get(event.age)??[]),event.label]);}
 const ordered=[...groups].sort((a,b)=>a[0]-b[0]);
 const priority=ordered.filter(([,labels])=>labels.some(l=>l.includes('stops work')||l.includes('State Pension')||l==='Planning horizon'));
 for(const [age,labels]of ordered){
  const index=age-current.rows[0].primaryAge,px=x(index),py=y(current.rows[index].netWealth);
  const inspect=()=>{selectedYear=input.year+age-input.people[0].age;$('inspect-year').value=selectedYear;renderYear();$('selected-milestone').textContent=`${input.year+index} · Alex ${age} / Jemma ${current.rows[index].partnerAge} · ${labels.join(' / ').replaceAll('stops work','retires')}`;};
  const marker=svgNode(svg,'g',{role:'button',tabindex:0,'aria-label':`Inspect Alex age ${age}, Jemma age ${current.rows[index].partnerAge}: ${labels.join(', ')}`,class:'milestone-marker'});svgNode(marker,'circle',{cx:px,cy:py,r:22,fill:'transparent'});svgNode(marker,'circle',{cx:px,cy:py,r:5,fill:'#14665f',stroke:'#fff','stroke-width':2});svgNode(marker,'title',{},`${age}: ${labels.join(', ')}`);marker.addEventListener('click',inspect);marker.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect();}});
  const rank=priority.findIndex(([a])=>a===age);if(rank>=0){const personLabel=labels.find(l=>l.includes('stops work'))?.replace('stops work','retires');const state=labels.find(l=>l.includes('State Pension'));const label=personLabel?(state?personLabel+' + State':personLabel):state??'Horizon';const tx=Math.max(110,Math.min(width-65,px));svgNode(svg,'text',{x:tx,y:Math.max(18,py-26-(rank%2)*22),'text-anchor':'middle',fill:'#536568','font-size':12},`${label} · ${personLabel?.startsWith('Jemma')||(!personLabel&&state?.startsWith('Jemma'))?current.rows[index].partnerAge:age}`);}
 }
 $('wealth-events').replaceChildren(...[...groups].sort((a,b)=>a[0]-b[0]).map(([age,labels])=>{const button=node('button',{type:'button',class:'event-chip',text:`${input.year+age-input.people[0].age} · ${labels.join(' / ').replaceAll('stops work','retires')}`});button.addEventListener('click',()=>{selectedYear=input.year+age-input.people[0].age;$('inspect-year').value=selectedYear;renderYear();$('selected-milestone').textContent=button.textContent;});return button;}));
 if(actions.legacy){const target=input.settings.legacyTarget;if(target<=max&&target>=min)svgNode(svg,'line',{x1:64,x2:width-16,y1:y(target),y2:y(target),stroke:'#79548b','stroke-width':2,'stroke-dasharray':'2 4'});}
 const fundingMax=Math.max(1,...current.rows.map(r=>Math.max(r.spending+r.payoff,r.income+r.releasedFromInvestments+r.sources.withdrawals+r.payoff+r.gap)))*1.08;const bar=chartFrame('income-chart','Annual income and asset withdrawals against spending, with unpaid gaps',fundingMax);
 const barWidth=Math.max(2,(bar.width-80)/current.rows.length*.8);
 current.rows.forEach((row,index)=>{let used=0;for(const [key,,color]of funding){let amount=key==='gap'?row.gap:key==='assetRelease'?row.releasedFromInvestments:(row.sources[key]??0)+(key==='withdrawals'?row.payoff:0);if(amount<=0)continue;const top=bar.y(used+amount),height=bar.y(used)-top;const rect=svgNode(bar.svg,'rect',{x:bar.x(index)-barWidth/2,y:top,width:barWidth,height:Math.max(0,height),fill:color});const title=document.createElementNS(ns,'title');title.textContent=`${row.year}: ${key} ${money(amount)}`;rect.append(title);rect.addEventListener('click',()=>{selectedYear=row.year;$('inspect-year').value=selectedYear;renderYear();});used+=amount;}});
 const expensePath=current.rows.map((r,i)=>`${i?'L':'M'}${bar.x(i)},${bar.y(r.spending+r.payoff)}`).join(' ');svgNode(bar.svg,'path',{d:expensePath,fill:'none',stroke:'#182e32','stroke-width':1.5});
 $('income-legend').replaceChildren(...funding.filter(([key])=>current.rows.some(row=>key==='gap'?row.gap>0:key==='assetRelease'?row.releasedFromInvestments>0:(row.sources[key]??0)+(key==='withdrawals'?row.payoff:0)>0)).map(([,label,color])=>node('span',{},[node('i',{class:'funding-swatch',style:`background:${color}`}),label])),node('span',{},['— Spending']));
}
function renderYear() {
 if(!current)return;const row=current.rows.find(r=>r.year===selectedYear)??current.rows[0];$('year-income').textContent=`${money(row.income)} income`;$('year-withdrawals').textContent=`${money(row.withdrawals)} from assets`;
 const facts=[['Net wealth',row.netWealth],['Accessible assets',row.accessible],['Property',row.propertyValue],['Debt remaining',row.closingDebt],['New income (excluding asset sales)',row.income],['Internal dividends / sale releases',row.releasedFromInvestments],['Spending & scheduled debt payments',row.spending],['Cash mortgage payoff',row.payoff],['Income deduction estimates',row.incomeTax],['Return deduction estimates',row.growthTax],['Withdrawal deduction estimates',row.withdrawalTax],['Vehicle value purchased',row.assetPurchased],['Alex accounts withdrawn (gross)',row.withdrawalsByOwner.primary],['Jemma accounts withdrawn (gross)',row.withdrawalsByOwner.partner],['Joint accounts withdrawn (gross)',row.withdrawalsByOwner.joint],['Added to financial assets',row.additions],['Withdrawn from assets',row.withdrawals],['Growth / value change',row.growth],['Market loss',row.marketLoss],['Debt interest',row.debtInterest],['Debt repaid',row.debtPaid+row.settlement],['Alex pension saving funded',row.pensionSavingByOwner.primary],['Jemma pension saving funded',row.pensionSavingByOwner.partner],['Saving goal not funded',row.unfundedSaving],['Unpaid spending',row.gap],['Earlier + current unpaid spending',row.cumulativeGap]];
 $('household-year-details').replaceChildren(node('dl',{class:'assumptions-table'},[...facts,...Object.entries(row.withdrawalsByAccount).map(([id,value])=>[`${row.accountLabels[id]??id} withdrawn (gross)`,value])].flatMap(([label,value])=>[node('dt',{text:label}),node('dd',{text:money(value)})])));
}
function addStream(list,type) {const person=input.people[0];const label={salary:'New salary',bonus:'Employment bonus',inheritance:'Inheritance / gift',education:'Education fees',vehicle:'Vehicle purchase',rent:'Rent after costs',support:'Support',pension:'Pension income',state:'State Pension',dividend:'Dividend distribution',sale:'Investment sale proceeds',other:'Other income',regular:'Regular spending',lease:'Car lease',oneoff:'One-off cost',saving:'Pension saving'}[type];input[list].push({id:`row-${++sequence}`,label,type,owner:'primary',amount:0,frequency:['oneoff','inheritance','vehicle'].includes(type)?'once':['bonus','education'].includes(type)?'year':'month',startAge:type==='state'?person.stateAge:person.age,endAge:['oneoff','inheritance','vehicle'].includes(type)?person.age:110,ongoing:!['oneoff','inheritance','vehicle'].includes(type),growth:0,taxBasis:'net',taxRate:0,assetId:type==='vehicle'?'car':undefined,priceBasis:'today'});renderStreams();calculate();}
function openStreamPicker(list){
 const types=list==='incomes'?[['salary','Salary / self-employment'],['bonus','Employment bonus'],['inheritance','Inheritance / gift'],['rent','Rent, after costs'],['support','Benefits / support'],['pension','DB / other pension income'],['state','State Pension'],['dividend','Dividend from investments'],['sale','Investment sale'],['other','Other income']]:[['regular','Regular spending'],['education','Education fees'],['lease','Car lease'],['vehicle','Vehicle purchase'],['oneoff','One-off cost'],['saving','Pension saving from income']];
 const choice={type:types[0][0]},add=node('button',{type:'button',class:'quiet-button',text:'Add row'});
 add.addEventListener('click',()=>{dialog.close();addStream(list,choice.type);const row=input[list].at(-1);document.querySelector(`[data-stream="${row.id}"] .stream-title`)?.focus();});
 openEditor(list==='incomes'?'Add income':'Add spending',[selectField('Type',choice,'type',types)],[add]);
}
$('add-income').addEventListener('click',()=>openStreamPicker('incomes'));$('add-expense').addEventListener('click',()=>openStreamPicker('expenses'));
$('add-debt').addEventListener('click',()=>{input.debts.push({id:`debt-${++sequence}`,label:'Additional debt',type:'loan',balance:0,rate:6,payment:0});renderDebts();calculate();});
$('add-asset').addEventListener('click',()=>{input.assets.push({id:`asset-${++sequence}`,label:'Additional investment',type:'investment',owner:'joint',balance:0,rate:5,accessAge:0});renderAssets();calculate();});
$('reset-household').addEventListener('click',()=>{input=householdBaseExample();actions={};sequence=0;savedScenarios=[];renderSavedScenarios();initialise();});$('reset-actions').addEventListener('click',()=>{actions={};input.settings=defaultScenarioSettings();input.employment=householdBaseExample().employment;input.withdrawal=householdBaseExample().withdrawal;input.allocation=householdBaseExample().allocation;$('scenario-preset').value='continue';renderWithdrawal();renderActions();calculate();});
$('run-plan').addEventListener('click',()=>{calculate();if($('household-error').hidden)show('plan');});
$('inspect-year').addEventListener('change',()=>{selectedYear=Number($('inspect-year').value);renderYear();});
for(const button of document.querySelectorAll('[data-screen],[data-next]'))button.addEventListener('click',()=>show(button.dataset.screen??button.dataset.next));
window.addEventListener('resize',()=>{if(screen==='plan')drawCharts();});
function renderWithdrawal(){
 const policy=input.withdrawal;
 $('withdrawal-policy').replaceChildren(selectField('Use accounts belonging to',policy,'owner',[['household','Both people'],...owners()]),selectField('Withdrawal order',policy,'order',[['cash-first','Cash → investments → pensions'],['investments-first','Investments → cash → pensions'],['pension-first','Accessible pensions → cash → investments']]),numberField('Annual net withdrawal ceiling (%)',policy,'maxPercent',{min:0,max:100,step:1}),node('p',{class:'small',text:'100% permits funding the entered costs. A lower ceiling limits net withdrawals to that percentage of accessible assets at the start of each year; unmet costs remain visible. This is a comparison, not a recommended withdrawal strategy.'}));
}
function renderSavedScenarios(){const select=$('scenario-preset');select.replaceChildren(...[['continue','Continue working'],['redundancy','Both redundancies'],['alex','Alex redundancy only'],['jemma','Jemma redundancy only'],...savedScenarios.map((s,i)=>['saved-'+i,s.name])].map(([value,text])=>node('option',{value,text})));}
$('scenario-preset').addEventListener('change',()=>{const value=$('scenario-preset').value;if(value.startsWith('saved-')){const saved=savedScenarios[Number(value.slice(6))];input=structuredClone(saved.input);actions=structuredClone(saved.actions);initialise();}else{actions=value==='redundancy'?{job:true,jobPartner:true}:value==='alex'?{job:true}:value==='jemma'?{jobPartner:true}:{};renderActions();calculate();}});
$('save-scenario').addEventListener('click',()=>{const name=node('input',{type:'text',value:`Scenario ${savedScenarios.length+1}`,'aria-label':'Scenario name',maxlength:60});const save=node('button',{type:'button',class:'quiet-button',text:'Save copy'});save.addEventListener('click',()=>{savedScenarios.push({name:name.value.trim()||`Scenario ${savedScenarios.length+1}`,input:structuredClone(input),actions:structuredClone(actions)});dialog.close();renderSavedScenarios();$('scenario-preset').value='saved-'+(savedScenarios.length-1);});openEditor('Save scenario',[node('label',{class:'number-field'},[node('span',{text:'Name'}),name]),node('p',{class:'small',text:'Saved for this page session only. Reloading clears these copies.'})],[save]);});
function initialise(){renderWithdrawal();renderPeople();renderAssets();renderDebts();renderStreams();renderPlanPeople();renderActions();calculate();}
document.body.dataset.workspaceScreen=screen;
renderSavedScenarios();initialise();
