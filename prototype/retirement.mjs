import { householdExample, simulateHousehold, openingPicture } from './retirement-household.mjs';
const $=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const compact=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value);
let input=householdExample(),actions={},current=null,baseline=null,stressed=null,screen='today',selectedYear=2026,sequence=0;
const icons={cash:'savings',investment:'investment',pension:'pension',property:'home',car:'work',bonds:'coins'};
const definitions={
 early:{title:'Stop work earlier',icon:'sun',group:'work',note:'Salary stops at each work-end age. DB and State Pension dates stay separate.',fields:[['earlyPrimary','Alex stops at',57,100,1],['earlyPartner','Jemma stops at',55,100,1]]},
 job:{title:'Income interruption',icon:'pause',group:'work',note:'Alex’s salaries stop for this period, then resume their declared growth path. No benefits are invented.',fields:[['jobAge','Alex age at interruption',57,100,1],['jobYears','Years without salary',1,20,1]]},
 parttime:{title:'Part-time work',icon:'work',group:'work',note:'Alex’s combined salary is capped at the entered annual amount from the step-back age until work ends.',fields:[['earlyPrimary','Alex steps back at',57,100,1],['partTimeAnnual','Spendable pay / year (£)',0,100000,1000]]},
 downsize:{title:'Downsize',icon:'home',group:'home',note:'Sell the modelled home, buy a replacement, settle the mortgage and pay costs. Only the remainder becomes cash.',fields:[['downsizeAge','Move at Alex age',57,100,1],['replacementPercent','Replacement / sale value (%)',0,100,5],['movingCosts','Moving / transaction costs (£)',0,1000000,1000]]},
 lease:{title:'Lower car costs',icon:'work',group:'home',note:'Caps declared lease costs; car finance is still modelled separately.',fields:[['leaseMonthly','Lease budget / month (£)',0,10000,50]]},
 payoff:{title:'Repay mortgage',icon:'mortgage',group:'home',note:'Uses accessible assets to repay the modelled balance including that year’s interest. This is not a lender payoff quote.',fields:[['payoffAge','Pay off at Alex age',57,100,1]]},
 spend:{title:'Spend less',icon:'spending',group:'money',note:'Reduces regular spending. Debt payments, one-offs and saving goals remain separate.',fields:[['spendPercent','Regular spending reduction (%)',0,100,5]]},
 pension:{title:'Save into pension',icon:'pension',group:'money',note:'Adds a pension-saving goal funded only from surplus income while Alex works. It is an internal transfer, not new wealth; tax relief is not calculated.',fields:[['pensionMonthly','Extra saving / month (£)',0,10000,100]]},
 withdraw:{title:'One-off spending',icon:'family',group:'family',note:'A budget for school fees, family help or another dated cost. Income funds it first, then available assets; any remaining gap is explicit.',fields:[['withdrawAge','Spend at Alex age',57,100,1],['withdrawAmount','One-off budget (£)',0,10000000,1000]]},
 growth:{title:'Change growth',icon:'investment',group:'stress',note:'A hypothetical increase to the trading-account return assumption, not an allocation recommendation or expected return. Compare the stress path too.',fields:[['growthExtra','Extra assumed growth / year (%)',0,10,.5]]},
 fixed:{title:'Fixed-income mix',icon:'coins',group:'stress',note:'Moves a chosen part of trading assets into the declared fixed-income account. This does not guarantee safety; the stress path includes a bond loss.',fields:[['fixedAge','Change mix at Alex age',57,100,1],['fixedPercent','Trading assets moved (%)',0,100,5]]},
 market:{title:'Market setback',icon:'investment',group:'stress',note:'One loss across trading and pension assets; bonds lose 5%. Returns resume on reduced balances. Cash and property are unchanged.',fields:[['marketAge','Loss at Alex age',57,100,1],['marketPercent','Trading / pension loss (%)',0,100,5]]},
 inflation:{title:'Higher costs',icon:'inflation',group:'stress',note:'Adds two percentage points to declared expense growth. Income growth is unchanged. This is a price stress, not a complete inflation model.',fields:[]},
 legacy:{title:'Resources left',icon:'legacy',group:'family',note:'Compare remaining net wealth with a target. Property may not be spendable; inheritance tax and death benefits are not calculated.',fields:[['legacyTarget','End-horizon target (£)',0,100000000,10000]]},
};
function node(tag,attributes={},children=[]) {const element=document.createElement(tag);for(const [key,value] of Object.entries(attributes)){if(key==='text')element.textContent=value;else if(key==='class')element.className=value;else if(key==='checked')element.checked=value;else element.setAttribute(key,value);}for(const child of children)element.append(typeof child==='string'?document.createTextNode(child):child);return element;}
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href',`#icon-${name}`);svg.append(use);return svg;}
function numberField(label,object,key,{min=0,max=1e8,step=100,range=false,change}={}) {
 const control=node('input',{type:range?'range':'number',min,max,step,value:object[key],'aria-label':label});
 const caption=node('span',{text:label});const output=range?node('output',{text:object[key]}):null;
 control.addEventListener('input',()=>{object[key]=control.value===''?NaN:Number(control.value);if(output)output.textContent=object[key];change?.();calculate();});
 return node('label',{class:range?'range-field':'number-field'},[caption,...(output?[output]:[]),control]);
}
function selectField(label,object,key,choices,onChange) {
 const control=node('select',{'aria-label':label});for(const [value,text] of choices)control.append(node('option',{value,text}));control.value=object[key];
 control.addEventListener('change',()=>{object[key]=control.value;onChange?.();calculate();});return node('label',{class:'select-field'},[node('span',{text:label}),control]);
}
function owners(){return input.people.map(p=>[p.id,p.name]);}
function show(next) {screen=next;document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.screen===next)));for(const id of ['today','flows','plan'])$('screen-'+id).hidden=id!==next;if(next==='plan')drawCharts();$('demo').scrollIntoView({block:'start',behavior:'instant'});}
function renderPeople() {
 $('people-fields').replaceChildren(...input.people.map(person=>{
  const change=()=>{for(const stream of input.incomes.filter(r=>r.type==='state'&&r.owner===person.id))stream.startAge=person.stateAge;renderStreams();renderPlanPeople();};
  return node('div',{class:'person-card'},[node('strong',{text:person.name}),numberField('Age now',person,'age',{min:18,max:85,step:1,change}),numberField('State Pension age',person,'stateAge',{min:50,max:100,step:1,change:()=>{person.retireAge=person.stateAge;change();}})]);
 }));
}
function renderAssets() {
 $('asset-cards').replaceChildren(...input.assets.map(asset=>{
  const edit=node('details',{class:'asset-edit'});edit.append(node('summary',{},[icon(icons[asset.type]),node('span',{text:asset.label}),node('strong',{'data-asset-total':asset.id,text:money(asset.balance)})]));
  const fields=node('div',{class:'asset-edit-fields'},[...(!['cash','bonds'].includes(asset.id)?[selectField('Asset type',asset,'type',[['cash','Savings'],['investment','Trading / ISA'],['pension','Pension pot'],['property','Property'],['car','Vehicle'],['bonds','Fixed income']],()=>renderAssets())]:[]),numberField('Balance / value (£)',asset,'balance'),numberField(asset.type==='car'?'Value change / year (%)':'Net total growth / year (%)',asset,'rate',{min:-50,max:30,step:.5}),selectField('Owner',asset,'owner',[...owners(),['joint','Household']])]);
  if(asset.type==='pension')fields.append(numberField('Access at owner age',asset,'accessAge',{min:18,max:100,step:1}));
  if(!['cash','bonds'].includes(asset.type)){const remove=node('button',{type:'button',class:'remove-row',text:'Remove asset'});remove.addEventListener('click',()=>{input.assets=input.assets.filter(a=>a!==asset);renderAssets();calculate();});fields.append(remove);}
  edit.append(fields);return edit;
 }));
}
function renderDebts() {
 $('debt-cards').replaceChildren(...input.debts.map(debt=>{
  const remove=node('button',{type:'button',class:'remove-row','aria-label':`Remove ${debt.label}`,text:'Remove'});remove.addEventListener('click',()=>{input.debts=input.debts.filter(d=>d!==debt);renderDebts();calculate();});
  return node('div',{class:'debt-card'},[node('strong',{text:debt.label}),selectField('Debt type',debt,'type',[['mortgage','Mortgage'],['loan','Loan / credit']]),numberField('Balance (£)',debt,'balance'),numberField('Interest / year (%)',debt,'rate',{max:50,step:.5}),numberField('Payment / month (£)',debt,'payment',{step:50}),remove]);
 }));
}
function streamRow(row,list) {
 const title=node('input',{type:'text',value:row.label,'aria-label':`${list==='incomes'?'Income':'Expense'} name`,maxlength:70});title.addEventListener('input',()=>{row.label=title.value;});
 const previousFrequency=row.frequency;
 const frequency=selectField('Frequency',row,'frequency',[['month','Monthly'],['year','Yearly'],...(list==='expenses'?[['once','One-off']]:[])],()=>{if(previousFrequency!=='once'&&row.frequency!=='once')row.amount*= (previousFrequency==='month'?12:1)/(row.frequency==='month'?12:1);if(row.frequency==='once')row.endAge=row.startAge;else if(row.endAge<=row.startAge)row.endAge=row.startAge+1;renderStreams();});
 const timing=node('details',{class:'stream-timing'});const timingText=node('span',{'data-timing':row.id,text:timingLabel(row)});timing.append(node('summary',{},[timingText]));
 const timingFields=node('div',{class:'timing-fields'});
 const startChange=()=>{if(row.type==='state'){const person=input.people.find(p=>p.id===row.owner);person.stateAge=row.startAge;renderPeople();renderPlanPeople();}if(row.frequency==='once')row.endAge=row.startAge;};
 timingFields.append(numberField('Starts at owner age',row,'startAge',{min:18,max:105,step:1,range:true,change:startChange}));
 if(row.frequency!=='once')timingFields.append(numberField('Ends before owner age',row,'endAge',{min:18,max:110,step:1,range:true}));
 if(row.type==='salary'||row.type==='saving')timingFields.append(node('p',{class:'small',text:'The work-end age can end this stream sooner.'}));
 timingFields.append(numberField(list==='expenses'&&['regular','oneoff'].includes(row.type)?'Growth above inflation (%)':'Annual growth (%)',row,'growth',{min:-20,max:20,step:.5}));timing.append(timingFields);
 const copy=node('button',{type:'button',class:'row-icon','aria-label':`Copy ${row.label}`,text:'＋'});copy.addEventListener('click',()=>{input[list].push({...row,id:`copy-${++sequence}`,label:row.label+' copy'});renderStreams();calculate();});
 const remove=node('button',{type:'button',class:'row-icon','aria-label':`Remove ${row.label}`,text:'×'});remove.addEventListener('click',()=>{input[list]=input[list].filter(r=>r!==row);renderStreams();calculate();});
 const rowIcon=row.type==='salary'?'work':['state','pension','saving'].includes(row.type)?'pension':['dividend','sale'].includes(row.type)?'investment':row.frequency==='once'?'family':'spending';
 return node('div',{class:'stream-row'},[icon(rowIcon),title,numberField('Amount (£)',row,'amount',{step:100}),frequency,selectField('Owner',row,'owner',owners(),()=>{if(row.type==='state'){row.startAge=personForRow(row).stateAge;renderStreams();}}),timing,node('div',{class:'row-actions'},[copy,remove])]);
}
function personForRow(row){return input.people.find(p=>p.id===row.owner);}
function timingLabel(row) {const end=row.type==='salary'||row.type==='saving'?Math.min(row.endAge,personForRow(row).retireAge):row.endAge;return row.frequency==='once'?`Once · age ${row.startAge}`:`Age ${row.type==='state'?personForRow(row).stateAge:row.startAge}–${end}`;}
function renderStreams() {$('income-rows').replaceChildren(...input.incomes.map(r=>streamRow(r,'incomes')));$('expense-rows').replaceChildren(...input.expenses.map(r=>streamRow(r,'expenses')));}
function renderPlanPeople() {
 $('plan-people').replaceChildren(...input.people.map(person=>node('div',{class:'plan-person'},[node('strong',{text:person.name}),numberField('Stop work at',person,'retireAge',{min:18,max:100,step:1,range:true}),numberField('Plan until age',person,'horizonAge',{min:person.age,max:105,step:1})])),numberField('Inflation assumption (%)',input,'inflation',{max:15,step:.5}));
}
function renderActions() {
 $('household-actions').replaceChildren(...Object.entries(definitions).map(([key,definition])=>{
  const button=node('button',{type:'button','data-action':key,'data-group':definition.group,'aria-pressed':String(Boolean(actions[key]))},[icon(definition.icon),definition.title]);
  button.addEventListener('click',()=>{actions[key]=!actions[key];renderActions();calculate();});return button;
 }));
 $('action-editors').replaceChildren(...Object.entries(definitions).filter(([key])=>actions[key]).map(([key,definition])=>{
  const note=node('details',{class:'scenario-note'},[node('summary',{text:'Assumptions'}),node('p',{text:definition.note})]);
  return node('div',{class:'action-editor','data-editor':key},[node('h4',{text:definition.title}),node('div',{class:'action-fields'},definition.fields.map(([field,label,min,max,step])=>numberField(label,input.settings,field,{min:max<=1e6?min:0,max,step}))),note]);
 }));
}
function calculate() {
 try{
  baseline=simulateHousehold(input);current=simulateHousehold(input,actions);stressed=simulateHousehold(input,actions,true);
  $('household-error').hidden=true;document.querySelector('.two-charts').hidden=false;
  const opening=openingPicture(input);$('net-total').textContent=money(opening.net);$('accessible-total').textContent=money(opening.accessible);$('opening-equation').textContent=`${compact(opening.assets)} assets − ${compact(opening.debt)} debts`;
  for(const asset of input.assets){const display=document.querySelector(`[data-asset-total="${asset.id}"]`);if(display)display.textContent=money(asset.balance);}
  for(const row of [...input.incomes,...input.expenses]){const label=document.querySelector(`[data-timing="${row.id}"]`);if(label)label.textContent=timingLabel(row);}
  const now=baseline.rows[0];$('income-now').textContent=money(now.income/12)+'/mo';$('spending-now').textContent=money(now.spending/12)+'/mo';$('surplus-now').textContent=money(Math.max(0,now.income-now.spending)/12)+'/mo';$('saving-goal-warning').textContent=now.unfundedSaving>0.01?`${money(now.unfundedSaving/12)}/mo of the pension-saving goals is not funded by the current surplus.`:'';
  const result=current.firstGap?`First funding gap at Alex age ${current.firstGap.primaryAge} · ${money(current.firstGap.gap)} that year.`:`Spending covered through Alex age ${current.final.primaryAge} under these assumptions.`;
  $('plan-result').replaceChildren(node('strong',{text:result}),...(stressed.firstGap?[node('span',{class:'stress-warning',text:`Stress path: first unpaid spending at Alex age ${stressed.firstGap.primaryAge}. Property is not automatically sold to cover a gap.`})]:[]),node('span',{text:`${compact(current.final.netWealth)} net wealth at Alex ${current.final.primaryAge} / Jemma ${current.final.partnerAge}${actions.legacy?` · ${compact(Math.abs(current.final.netWealth-input.settings.legacyTarget))} ${current.final.netWealth>=input.settings.legacyTarget?'above':'below'} target`:''}${current.firstGap?' · earlier gaps remain unpaid':''}.`}));
  const select=$('inspect-year');const values=current.rows.map(row=>node('option',{value:row.year,text:`${row.year} · Alex ${row.primaryAge}, Jemma ${row.partnerAge}`}));select.replaceChildren(...values);if(!current.rows.some(r=>r.year===selectedYear))selectedYear=current.rows[0].year;select.value=selectedYear;
  renderYear();if(screen==='plan')drawCharts();$('household-status').textContent='Example recalculated. '+result;
 }catch(error){current=null;baseline=null;stressed=null;$('household-year-details').replaceChildren();$('inspect-year').replaceChildren();$('household-error').textContent=error.message+' Complete the figures to run this illustration.';$('household-error').hidden=false;document.querySelector('.two-charts').hidden=true;$('plan-result').textContent='Check the highlighted message before using the plan.';$('saving-goal-warning').textContent='';for(const id of ['net-total','accessible-total','income-now','spending-now','surplus-now','year-income','year-withdrawals'])$(id).textContent='—';}
}
const ns='http://www.w3.org/2000/svg';
function svgNode(svg,name,attributes,text){const e=document.createElementNS(ns,name);for(const [key,value]of Object.entries(attributes))e.setAttribute(key,String(value));if(text)e.textContent=text;svg.append(e);return e;}
function chartFrame(id,title,max,min=0) {
 const svg=$(id);svg.replaceChildren();const width=Math.max(260,svg.parentElement.clientWidth),height=400,left=64,right=16,top=120,bottom=342;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-labelledby',id+'-title '+id+'-desc');svgNode(svg,'title',{id:id+'-title'},title);svgNode(svg,'desc',{id:id+'-desc'},title+'. Fictional annual model, future pounds. Use the year inspector for all calculated figures.');
 const x=i=>left+(width-left-right)*i/(current.rows.length-1),y=v=>bottom-(v-min)/(max-min||1)*(bottom-top);
 for(let i=0;i<5;i++){const value=min+(max-min)*i/4;svgNode(svg,'line',{x1:left,x2:width-right,y1:y(value),y2:y(value),stroke:'#d7dfda','stroke-width':1});svgNode(svg,'text',{x:left-7,y:y(value)+5,'text-anchor':'end',fill:'#536568','font-size':16},compact(value));}
 for(let i=0;i<4;i++){const index=Math.round(i/3*(current.rows.length-1));svgNode(svg,'text',{x:x(index),y:369,'text-anchor':'middle',fill:'#536568','font-size':16},String(current.rows[index].primaryAge));}
 svgNode(svg,'text',{x:(width+left-right)/2,y:394,'text-anchor':'middle',fill:'#536568','font-size':16},'Alex’s age');
 return {svg,width,height,x,y,left,right,top,bottom};
}
const funding=[['salary','Work','#4775ac'],['rent','Rent','#ad863c'],['support','Support','#856399'],['pension','DB / pension','#548579'],['state','State Pension','#2b675e'],['other','Other','#85959c'],['assetRelease','Dividends / sales','#a080b3'],['withdrawals','Savings / pots','#d5ac60'],['gap','Unfunded','#b4563b']];
function drawCharts() {
 if(!current||!$('household-error').hidden)return;
 const values=[...baseline.rows,...current.rows,...stressed.rows].map(r=>r.netWealth);const max=Math.max(1,actions.legacy?input.settings.legacyTarget:0,...values)*1.08,min=Math.min(0,...values);
 const frame=chartFrame('wealth-chart','Net household wealth: baseline, chosen scenario and stress path',max,min);const {svg,x,y,width}=frame;
 for(const [model,colour,dash] of [[stressed,'#ad633d','3 4'],[baseline,'#7b898b','7 5'],[current,'#14665f','']]){const path=model.rows.map((r,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(r.netWealth).toFixed(2)}`).join(' ');svgNode(svg,'path',{d:path,stroke:colour,'stroke-width':model===current?3.5:2.5,'stroke-dasharray':dash,fill:'none'});}
 const eventList=current.events.filter(e=>e.age>=current.rows[0].primaryAge&&e.age<=current.final.primaryAge);const ordered=[...eventList.filter(e=>!e.label.includes('Alex')&&!e.label.includes('Jemma')),...eventList.filter(e=>e.label.includes('Alex')||e.label.includes('Jemma'))];const visible=width<420?ordered.filter(e=>!e.label.includes('Jemma')).slice(0,4):ordered.slice(0,6);
 visible.forEach((event,i)=>{const index=event.age-current.rows[0].primaryAge,px=x(index);svgNode(svg,'line',{x1:px,x2:px,y1:120,y2:342,stroke:'#c3d7ce','stroke-width':1,'stroke-dasharray':'2 5'});const label=event.label.replace('State Pension','State').replace('stops work','work ends')+' · '+event.age;const labelWidth=Math.min(width-16,label.length*7.7);svgNode(svg,'text',{x:Math.max(labelWidth/2+5,Math.min(width-labelWidth/2-5,px)),y:18+i*19,'text-anchor':'middle',fill:'#536568','font-size':16},label);});
 if(actions.legacy){const target=input.settings.legacyTarget;if(target<=max&&target>=min)svgNode(svg,'line',{x1:64,x2:width-16,y1:y(target),y2:y(target),stroke:'#79548b','stroke-width':2,'stroke-dasharray':'2 4'});}
 const fundingMax=Math.max(1,...current.rows.map(r=>Math.max(r.spending+r.payoff,r.income+r.releasedFromInvestments+r.sources.withdrawals+r.payoff+r.gap)))*1.08;const bar=chartFrame('income-chart','Annual income and asset withdrawals against spending, with unpaid gaps',fundingMax);
 const barWidth=Math.max(2,(bar.width-80)/current.rows.length*.8);
 current.rows.forEach((row,index)=>{let used=0;for(const [key,,color]of funding){let amount=key==='gap'?row.gap:key==='assetRelease'?row.releasedFromInvestments:(row.sources[key]??0)+(key==='withdrawals'?row.payoff:0);if(amount<=0)continue;const top=bar.y(used+amount),height=bar.y(used)-top;const rect=svgNode(bar.svg,'rect',{x:bar.x(index)-barWidth/2,y:top,width:barWidth,height:Math.max(0,height),fill:color});const title=document.createElementNS(ns,'title');title.textContent=`${row.year}: ${key} ${money(amount)}`;rect.append(title);rect.addEventListener('click',()=>{selectedYear=row.year;$('inspect-year').value=selectedYear;renderYear();});used+=amount;}});
 const expensePath=current.rows.map((r,i)=>`${i?'L':'M'}${bar.x(i)},${bar.y(r.spending+r.payoff)}`).join(' ');svgNode(bar.svg,'path',{d:expensePath,fill:'none',stroke:'#182e32','stroke-width':1.5});
 $('income-legend').replaceChildren(...funding.filter(([key])=>current.rows.some(row=>key==='gap'?row.gap>0:key==='assetRelease'?row.releasedFromInvestments>0:(row.sources[key]??0)+(key==='withdrawals'?row.payoff:0)>0)).map(([,label,color])=>node('span',{},[node('i',{class:'funding-swatch',style:`background:${color}`}),label])),node('span',{},['— Spending']));
}
function renderYear() {
 if(!current)return;const row=current.rows.find(r=>r.year===selectedYear)??current.rows[0];$('year-income').textContent=`${money(row.income)} income`;$('year-withdrawals').textContent=`${money(row.withdrawals)} from assets`;
 const facts=[['Net wealth',row.netWealth],['Accessible assets',row.accessible],['Property',row.propertyValue],['Debt remaining',row.closingDebt],['New income (excluding asset sales)',row.income],['Internal dividends / sale releases',row.releasedFromInvestments],['Spending & scheduled debt payments',row.spending],['Cash mortgage payoff',row.payoff],['Added to financial assets',row.additions],['Withdrawn from assets',row.withdrawals],['Growth / value change',row.growth],['Market loss',row.marketLoss],['Debt interest',row.debtInterest],['Debt repaid',row.debtPaid+row.settlement],['Alex pension saving funded',row.pensionSavingByOwner.primary],['Jemma pension saving funded',row.pensionSavingByOwner.partner],['Saving goal not funded',row.unfundedSaving],['Unpaid spending',row.gap],['Earlier + current unpaid spending',row.cumulativeGap]];
 $('household-year-details').replaceChildren(node('dl',{class:'assumptions-table'},facts.flatMap(([label,value])=>[node('dt',{text:label}),node('dd',{text:money(value)})])));
}
function addStream(list,type) {const person=input.people[0];const label={salary:'New salary',rent:'Rent after costs',support:'Support',pension:'Pension income',state:'State Pension',dividend:'Dividend distribution',sale:'Investment sale proceeds',other:'Other income',regular:'Regular spending',lease:'Car lease',oneoff:'One-off cost',saving:'Pension saving'}[type];input[list].push({id:`row-${++sequence}`,label,type,owner:'primary',amount:0,frequency:type==='oneoff'?'once':'month',startAge:type==='state'?person.stateAge:person.age,endAge:type==='oneoff'?person.age:101,growth:0});renderStreams();calculate();}
$('add-income').addEventListener('click',()=>addStream('incomes',$('income-type').value));$('add-expense').addEventListener('click',()=>addStream('expenses',$('expense-type').value));
$('add-debt').addEventListener('click',()=>{input.debts.push({id:`debt-${++sequence}`,label:'Additional debt',type:'loan',balance:0,rate:6,payment:0});renderDebts();calculate();});
$('add-asset').addEventListener('click',()=>{input.assets.push({id:`asset-${++sequence}`,label:'Additional investment',type:'investment',owner:'joint',balance:0,rate:5,accessAge:0});renderAssets();calculate();});
$('reset-household').addEventListener('click',()=>{input=householdExample();actions={};sequence=0;initialise();});$('reset-actions').addEventListener('click',()=>{actions={};renderActions();calculate();});
$('run-plan').addEventListener('click',()=>{calculate();if($('household-error').hidden)show('plan');});
$('inspect-year').addEventListener('change',()=>{selectedYear=Number($('inspect-year').value);renderYear();});
for(const button of document.querySelectorAll('[data-screen],[data-next]'))button.addEventListener('click',()=>show(button.dataset.screen??button.dataset.next));
window.addEventListener('resize',()=>{if(screen==='plan')drawCharts();});
function initialise(){renderPeople();renderAssets();renderDebts();renderStreams();renderPlanPeople();renderActions();calculate();}
initialise();
