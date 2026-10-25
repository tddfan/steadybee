import {projectPlan} from './planning.mjs';
import {resolveRetirementYears} from './planning-retirement.mjs';
import {monthlyFlowEvents} from './monthly-flow.mjs';
import {eligibleWithdrawalBucket} from './withdrawals.mjs';

const money=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const compact=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',notation:'compact',maximumFractionDigits:1}).format(value);
const monthNumber=month=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
const monthFrom=value=>`${Math.floor(value/12)}-${String(value%12+1).padStart(2,'0')}`;
const monthLabel=month=>new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-15T12:00:00Z`));
const finite=value=>Number.isFinite(value)?value:0;
const node=(tag,cls,text)=>{const result=document.createElement(tag);if(cls)result.className=cls;if(text!=null)result.textContent=text;return result;};
const svgNode=(tag,attrs={},text)=>{const result=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[key,value]of Object.entries(attrs))result.setAttribute(key,String(value));if(text!=null)result.textContent=text;return result;};
const validMonth=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const yearFor=(month,taxYear)=>Number(month.slice(0,4))-(taxYear&&Number(month.slice(5,7))<4?1:0);

/** Calendar/fiscal groups sum flows but retain the last monthly closing balance. */
export function groupLifelineRows(months,{taxYear=false,real=true}={}){
  const groups=new Map();
  for(const month of months){
    const key=yearFor(month.month,taxYear),divisor=real?month.deflator:1;
    if(!groups.has(key))groups.set(key,{key,months:[],income:0,spending:0,withdrawals:0,contributions:0,tax:0,unfunded:0});
    const group=groups.get(key);group.months.push(month);
    for(const[field,source]of [['income','incomeTotal'],['spending','spendingTotal'],['withdrawals','withdrawalNet'],['contributions','pensionContributions'],['tax','taxTotal'],['unfunded','unfunded']])group[field]+=finite(month[source])/divisor;
    group.month=month.month;group.accessible=month.withdrawableAssets/divisor;group.netWorth=(month.assetsTotal-month.debtsTotal)/divisor;
  }
  return [...groups.values()];
}

/** Milestones use the same dates as the monthly engine; no authored financial amounts. */
export function lifelineEvents(flow,holdings,projection){
  const events=[];
  const add=(month,label,type='event')=>{if(validMonth(month)&&month>=projection.startMonth&&month<=projection.endMonth)events.push({month,label,type});};
  for(const[owner,date]of Object.entries(projection.retirementDates||{})){
    const pay=flow.pay?.[owner];if(!pay||!(pay.annualGross||pay.annualTakeHome))continue;
    const person=owner==='primary'?holdings.name||'You':holdings.partnerName||'Partner';
    if(validMonth(date))add(monthFrom(monthNumber(date)+1),`${person} stops working`,'retirement');
  }
  for(const[owner,pension]of Object.entries(projection.statePensions||{}))add(pension.startMonth,`${owner==='primary'?holdings.name||'Your':holdings.partnerName||'Partner'} State Pension`,'pension');
  for(const owner of holdings.partnerName?['primary','partner']:['primary']){
    const age=projection.ages?.[owner];if(!Number.isFinite(age))continue;
    const schemeAges=(holdings.assets||[]).filter(asset=>asset.kind==='dc-pension'&&(asset.owner||'primary')===owner).map(asset=>asset.pensionAccessAge??projection.pensionAccessAge);
    if(schemeAges.length){const accessAge=Math.max(projection.pensionAccessAge,Math.min(...schemeAges));if(accessAge>age)add(monthFrom(monthNumber(projection.startMonth)+(accessAge-age)*12),`${owner==='primary'?holdings.name||'Your':holdings.partnerName||'Partner'} pension access assumption`,'access');}
  }
  if(projection.firstUnfundedMonth)add(projection.firstUnfundedMonth,'First spending shortfall','gap');
  if(projection.stressTest?.month)add(projection.stressTest.month,'Retirement market-fall test','stress');
  try{for(const event of monthlyFlowEvents(flow,holdings))if(event.label!=='Current picture')add(event.month,event.label);}catch{/* Other views surface incomplete entry details. */}
  for(const change of projection.spendingChanges||[])add(`${change.year}-01`,'Household spending changes','spending');
  return [...new Map(events.map(event=>[`${event.month}:${event.label}`,event])).values()].sort((a,b)=>a.month.localeCompare(b.month)||a.label.localeCompare(b.label));
}

export function mountLifeline(root,getInputs,{onExplore=()=>{},onEdit=()=>{},onUpdate=()=>{}}={}){
  let settings={zoom:'life',period:null,taxYear:false,showBaseline:true,metric:'accessible',real:true};
  let projection=null,inputs=null,events=[],cacheKey='',selected=null,selectedObservation=null,chartPoints=[];
  root.classList.add('lifeline');
  root.innerHTML=`
    <div class="lifeline-heading"><div><p class="lifeline-eyebrow">YOUR PLAN, OVER TIME</p><h1 tabindex="-1">Your lifeline</h1><p class="lifeline-subtitle">See the years ahead. Understand the moments that matter.</p></div><button type="button" class="button button-secondary" data-action="update">Update my position</button></div>
    <p class="lifeline-error form-error" role="alert" hidden></p>
    <section class="lifeline-card lifeline-main" aria-label="Explore your lifeline">
      <div class="lifeline-toolbar"><div class="lifeline-segments" role="group" aria-label="Time scale"><button type="button" data-zoom="life" aria-pressed="true">Life</button><button type="button" data-zoom="year" aria-pressed="false">Year</button><button type="button" data-zoom="month" aria-pressed="false">Month</button></div><div class="lifeline-period-picker"><button type="button" data-action="previous" aria-label="Previous period">‹</button><label><span class="visually-hidden">Period to inspect</span><select class="lifeline-period" aria-label="Period to inspect"></select></label><button type="button" data-action="next" aria-label="Next period">›</button></div></div>
      <div class="lifeline-chart-title"><div><h2>Money available for your life</h2><p class="lifeline-basis"></p></div><label class="lifeline-metric-label"><span class="visually-hidden">Balance to show</span><select class="lifeline-metric" aria-label="Balance to show"><option value="accessible">Accessible investments</option><option value="netWorth">Net worth</option></select></label></div>
      <div class="lifeline-legend"><span><i class="lifeline-key lifeline-key-projection"></i>Current projection</span><span class="lifeline-baseline-key"><i class="lifeline-key lifeline-key-baseline"></i>Saved baseline</span><span class="lifeline-observed-key"><i class="lifeline-key lifeline-key-observed"></i>Recorded position</span></div>
      <div class="lifeline-chart-container"><svg class="lifeline-chart" viewBox="0 0 900 320" role="img" aria-label="Your projected accessible investments over time"></svg><p class="lifeline-chart-hint">Select a point, or use the period controls, to see the detail.</p></div>
      <div class="lifeline-chart-options"><label><input class="lifeline-show-baseline" type="checkbox" checked> Compare with baseline</label><label><input class="lifeline-real" type="checkbox" checked> Today’s money</label><label><input class="lifeline-tax-year" type="checkbox"> Tax years</label></div>
      <p class="lifeline-history-note"></p>
    </section>
    <div class="lifeline-detail-grid"><section class="lifeline-card lifeline-inspector" aria-label="Selected period"><div class="lifeline-inspector-heading"><div><p class="lifeline-eyebrow">A CLOSER LOOK</p><h2 class="lifeline-selected-title"></h2><p class="lifeline-selected-ages"></p></div><span class="lifeline-period-kind">Projection</span></div><div class="lifeline-selected-balance"></div><dl class="lifeline-ledger"></dl><p class="lifeline-selected-note"></p><div class="lifeline-inspector-actions"><button type="button" class="button button-primary" data-action="explore">Explore changes</button><button type="button" class="lifeline-text-button" data-action="edit">Edit household</button></div></section><section class="lifeline-card lifeline-events"><p class="lifeline-eyebrow">MOMENTS THAT MATTER</p><h2>Along the way</h2><div class="lifeline-event-list"></div></section></div>
    <details class="lifeline-card lifeline-detail-table"><summary>See the figures and assumptions</summary><p class="lifeline-assumption-note"></p><div class="lifeline-table-wrap"><table><caption class="visually-hidden">Projected lifeline figures</caption><thead><tr><th scope="col">Period</th><th scope="col">Accessible investments</th><th scope="col">Net income</th><th scope="col">Spending</th><th scope="col">Tax & NI</th></tr></thead><tbody></tbody></table></div><p>Accessible investments are before future withdrawal tax. Net income excludes asset withdrawals; tax can also arise on interest and withdrawals, so it is not a deduction from that income figure alone. Pension contributions are shown separately.</p><p>Tax-year views group whole April–March months. The engine does not split April at 6 April or reconcile a full tax return.</p><p>Illustration, not advice. Current rules, subject to change.</p></details>`;
  const $=selector=>root.querySelector(selector);
  const announce=text=>{$('.lifeline-error').textContent=text;$('.lifeline-error').hidden=!text;};
  const baseline=()=>inputs?.journey?.baseline;
  const checkpoints=()=>inputs?.journey?.checkpoints||[];
  const yearLabel=year=>settings.taxYear?`${year}/${String(year+1).slice(-2)} tax year`:String(year);
  function updateControls(){
    for(const button of root.querySelectorAll('[data-zoom]'))button.setAttribute('aria-pressed',String(button.dataset.zoom===settings.zoom));
    $('.lifeline-show-baseline').checked=settings.showBaseline;$('.lifeline-show-baseline').disabled=!baseline();$('.lifeline-show-baseline').closest('label').classList.toggle('lifeline-control-disabled',!baseline());
    $('.lifeline-real').checked=settings.real;$('.lifeline-tax-year').checked=settings.taxYear;$('.lifeline-tax-year').closest('label').hidden=settings.zoom==='month';$('.lifeline-metric').value=settings.metric;
    const options=settings.zoom==='month'?projection.months.map(month=>({value:month.month,label:monthLabel(month.month)})):groupLifelineRows(projection.months,{taxYear:settings.taxYear,real:settings.real}).map(group=>({value:String(group.key),label:yearLabel(group.key)}));
    const requested=settings.zoom==='month'?settings.period:String(yearFor(settings.period||projection.startMonth,settings.taxYear));
    const select=$('.lifeline-period');select.replaceChildren(...options.map(item=>new Option(item.label,item.value)));
    if(options.some(item=>item.value===requested))select.value=requested;
    else if(options.length){select.value=options[0].value;settings.period=settings.zoom==='month'?options[0].value:projection.months.find(month=>String(yearFor(month.month,settings.taxYear))===options[0].value)?.month;}
    $('.lifeline-period-picker').setAttribute('aria-label',settings.zoom==='month'?'Inspect a month':'Inspect a year');
    $('[data-action=previous]').disabled=select.selectedIndex<=0;$('[data-action=next]').disabled=select.selectedIndex>=select.options.length-1;
    $('.lifeline-baseline-key').hidden=!baseline()||!settings.showBaseline||settings.zoom==='month';
    $('.lifeline-observed-key').hidden=!baseline()&&!checkpoints().length;
  }
  function periodRows(){
    if(settings.zoom==='life')return projection.months;
    if(settings.zoom==='month')return projection.months.filter(row=>row.month===settings.period);
    const year=yearFor(settings.period||projection.startMonth,settings.taxYear);
    return projection.months.filter(row=>yearFor(row.month,settings.taxYear)===year);
  }
  function ageLabel(month){
    const elapsed=(monthNumber(month)-monthNumber(projection.startMonth))/12;
    return Object.entries(projection.ages||{}).filter(([owner,age])=>Number.isFinite(age)&&(owner==='primary'||inputs.holdings.partnerName)).map(([owner,age])=>`${owner==='primary'?inputs.holdings.name||'You':inputs.holdings.partnerName} ${Math.floor(age+elapsed)}`).join(' · ');
  }
  function selectedRows(){
    if(settings.zoom==='month')return projection.months.filter(row=>row.month===settings.period);
    const year=yearFor(settings.period||projection.startMonth,settings.taxYear);
    return projection.months.filter(row=>yearFor(row.month,settings.taxYear)===year);
  }
  function currentMoneyMultiplier(month,sourceDeflator=1){
    if(!settings.real)return 1;
    const old=baseline(),oldStart=old?.month||projection.startMonth;
    // A frozen projection's purchasing-power basis is moved to the latest
    // opening month, so old and new paths share one money basis.
    const currentBaselineDeflator=old?.path?.[projection.startMonth]?.deflator;
    const baselineInflation=old?.picture?.planning?.scenario?.inflation??old?.picture?.flow?.assumptions?.annualInflation??projection.assumptions.inflation;
    const baseToCurrent=Number.isFinite(currentBaselineDeflator)?currentBaselineDeflator/(1+baselineInflation/100)**(1/12):(1+baselineInflation/100)**((monthNumber(projection.startMonth)-monthNumber(oldStart))/12);
    return baseToCurrent/sourceDeflator;
  }
  function pathValue(row,frozen=false){
    const amount=frozen?row[settings.metric]:settings.metric==='accessible'?row.withdrawableAssets:row.assetsTotal-row.debtsTotal;
    return finite(amount)*(frozen?currentMoneyMultiplier(row.month,row.deflator||1):settings.real?1/row.deflator:1);
  }
  function observedPoints(){
    const points=[];
    for(const item of [baseline(),...checkpoints()].filter(Boolean)){
      if(!validMonth(item.month)||!Number.isFinite(item.totals?.[settings.metric]))continue;
      const multiplier=settings.real?(1+projection.assumptions.inflation/100)**((monthNumber(projection.startMonth)-monthNumber(item.month))/12):1;
      points.push({month:item.month,date:item.date,label:item.label||item.note||'Recorded update',value:item.totals[settings.metric]*multiplier});
    }
    // Observations are never joined into a fabricated historical return path.
    return points;
  }
  function renderMonthlyChart(svg,rows){
    const row=rows[0];if(!row)return;
    const divisor=settings.real?row.deflator:1;
    const fields=[['Income','incomeTotal','#1F7A68'],['Spending','spendingTotal','#7C5CBF'],['Assets used','withdrawalNet','#C58B3B'],['Tax & NI','taxTotal','#A45650']];
    const max=Math.max(1,...fields.map(([,key])=>row[key]/divisor));
    const width=(root.clientWidth||900)<650?480:900,barStart=width===480?117:168,barWidth=width===480?230:530;
    svg.setAttribute('viewBox',`0 0 ${width} 280`);
    svg.setAttribute('aria-label',`${monthLabel(row.month)} projected monthly income, spending, withdrawals and tax`);
    svg.append(svgNode('title',{},`Monthly projection for ${monthLabel(row.month)}`));
    fields.forEach(([label,key,colour],index)=>{
      const y=28+index*58,value=finite(row[key])/divisor;
      svg.append(svgNode('text',{x:8,y:y+23,class:'lifeline-bar-label'},label));
      svg.append(svgNode('rect',{x:barStart,y,width:Math.max(0,value/max*barWidth),height:33,rx:8,fill:colour,opacity:.93}));
      svg.append(svgNode('text',{x:width-3,y:y+23,'text-anchor':'end',class:'lifeline-bar-value'},money(value)));
    });
    $('.lifeline-chart-hint').textContent='Monthly totals from the projection. Daily movements are not estimated.';
  }
  function renderChart(){
    const svg=$('.lifeline-chart');svg.replaceChildren();chartPoints=[];
    const rows=periodRows();if(!rows.length)return;
    if(settings.zoom==='month'){renderMonthlyChart(svg,rows);return;}
    const canvasWidth=(root.clientWidth||900)<650?480:900;
    svg.setAttribute('viewBox',`0 0 ${canvasWidth} 320`);
    svg.setAttribute('aria-label',`${settings.metric==='accessible'?'Accessible investments':'Net worth'} over ${settings.zoom==='life'?'your projected life':yearLabel(yearFor(settings.period,settings.taxYear))}. Use the period selector for details.`);
    const projected=(settings.zoom==='life'?groupLifelineRows(rows,{taxYear:settings.taxYear,real:settings.real}).map(group=>group.months.at(-1)):rows).map(row=>({month:row.month,value:pathValue(row),x:monthNumber(row.month)+.99,row}));
    const old=baseline(),frozen=old&&settings.showBaseline?Object.entries(old.path||{}).map(([month,row])=>({month,...row})).filter(row=>settings.zoom==='life'||yearFor(row.month,settings.taxYear)===yearFor(settings.period,settings.taxYear)).map(row=>({month:row.month,value:pathValue(row,true),x:monthNumber(row.month)+.99})):[];
    const observations=observedPoints().filter(row=>settings.zoom==='life'||yearFor(row.month,settings.taxYear)===yearFor(settings.period,settings.taxYear)).map(row=>({...row,x:monthNumber(row.month)}));
    const raw=[...projected,...frozen,...observations],start=Math.min(monthNumber(projection.startMonth),...raw.map(row=>row.x)),end=Math.max(start+1,...raw.map(row=>row.x));
    const min=Math.min(0,...raw.map(row=>row.value)),max=Math.max(1,...raw.map(row=>row.value));
    const span=max-min,padding=span*.12,low=min<0?min-padding:0,high=max+padding,left=canvasWidth===480?68:72,right=canvasWidth-16,top=26,bottom=262;
    const x=value=>left+(value-start)/(end-start)*(right-left),y=value=>bottom-(value-low)/(high-low)*(bottom-top);
    const title=svgNode('title',{},'Current projection, frozen baseline and dated recorded positions');svg.append(title);
    for(let i=0;i<4;i++){
      const value=low+(high-low)*i/3,py=y(value);
      svg.append(svgNode('line',{x1:left,y1:py,x2:right,y2:py,stroke:'#E6E9ED','stroke-width':1}));
      svg.append(svgNode('text',{x:left-12,y:py+4,'text-anchor':'end',class:'lifeline-axis'},compact(value)));
    }
    const today=monthNumber(projection.startMonth);
    if(today>start){svg.append(svgNode('rect',{x:left,y:top,width:Math.max(0,x(today)-left),height:bottom-top,fill:'#F2F5F8',opacity:.8}));}
    svg.append(svgNode('line',{x1:x(today),y1:top,x2:x(today),y2:bottom,stroke:'#79838F','stroke-dasharray':'3 5'}));
    svg.append(svgNode('text',{x:Math.min(right-28,x(today)+7),y:16,class:'lifeline-today'},'Today'));
    const d=points=>points.map((point,index)=>`${index?'L':'M'}${x(point.x).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ');
    if(projected.length){
      const fill=d(projected)+` L${x(projected.at(-1).x)},${y(0)} L${x(projected[0].x)},${y(0)} Z`;
      svg.append(svgNode('path',{d:fill,fill:'#1F7A68',opacity:.08}));
    }
    if(frozen.length)svg.append(svgNode('path',{d:d(frozen),fill:'none',stroke:'#8993A1','stroke-width':2,'stroke-dasharray':'6 5','vector-effect':'non-scaling-stroke'}));
    svg.append(svgNode('path',{d:d(projected),fill:'none',stroke:'#1F7A68','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));
    const selectedYear=yearFor(settings.period||projection.startMonth,settings.taxYear);
    const selectedPoint=projected.findLast(point=>settings.zoom==='year'?point.month===settings.period:yearFor(point.month,settings.taxYear)===selectedYear);
    if(selectedPoint){
      svg.append(svgNode('line',{x1:x(selectedPoint.x),y1:top,x2:x(selectedPoint.x),y2:bottom,stroke:'#1F7A68',opacity:.3}));
      svg.append(svgNode('circle',{cx:x(selectedPoint.x),cy:y(selectedPoint.value),r:5,fill:'#1F7A68',stroke:'#fff','stroke-width':2}));
    }
    for(const observation of observations){
      const circle=svgNode('circle',{cx:x(observation.x),cy:y(observation.value),r:6,fill:'#7C5CBF',stroke:'#fff','stroke-width':2,tabindex:0,role:'button','aria-label':`${observation.label}, ${monthLabel(observation.month)}, ${money(observation.value)}. Inspect recorded position.`});
      circle.append(svgNode('title',{},`${observation.label} · ${monthLabel(observation.month)} · ${money(observation.value)}`));
      const inspect=event=>{event.stopPropagation();selectedObservation=observation;renderInspector();};circle.addEventListener('click',inspect);circle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();inspect(event);}});svg.append(circle);
    }
    const important=events.filter(event=>event.type!=='event'&&event.month>=monthFrom(Math.floor(start))&&monthNumber(event.month)<=end);
    const included=important.filter((event,index)=>!important.slice(0,index).some(other=>Math.abs(x(monthNumber(other.month))-x(monthNumber(event.month)))<60)).slice(0,6);
    for(const event of included){
      const px=x(monthNumber(event.month));svg.append(svgNode('circle',{cx:px,cy:bottom+9,r:3.5,fill:event.type==='gap'?'#B3261E':'#7C5CBF'}));
    }
    const tickCount=settings.zoom==='life'?5:4;
    for(let i=0;i<=tickCount;i++){
      const value=start+(end-start)*i/tickCount,month=monthFrom(Math.floor(value));
      svg.append(svgNode('text',{x:x(value),y:bottom+34,'text-anchor':i===0?'start':i===tickCount?'end':'middle',class:'lifeline-axis'},settings.zoom==='life'?month.slice(0,4):new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(`${month}-15T12:00:00Z`))));
    }
    chartPoints=projected.map(point=>({...point,pixel:x(point.x)}));
    $('.lifeline-chart-hint').textContent=settings.zoom==='life'?'Select a year to see the money and milestones behind the line.':'Select a month to inspect its projected money movements.';
  }
  function renderInspector(){
    if(selectedObservation){
      const observation=selectedObservation,record=[baseline(),...checkpoints()].find(item=>item?.date===observation.date&&item?.month===observation.month);
      $('.lifeline-selected-title').textContent=monthLabel(observation.month);$('.lifeline-selected-ages').textContent=record?.date?`Recorded ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${record.date}T12:00:00Z`))}`:'Recorded household position';
      $('.lifeline-period-kind').textContent='Recorded';$('.lifeline-period-kind').dataset.recorded='true';
      $('.lifeline-selected-balance').replaceChildren(node('span','',settings.metric==='accessible'?'Recorded accessible investments':'Recorded net worth'),node('strong','',money(observation.value)));
      const ledger=$('.lifeline-ledger');ledger.replaceChildren();const multiplier=settings.real?(1+projection.assumptions.inflation/100)**((monthNumber(projection.startMonth)-monthNumber(observation.month))/12):1;
      for(const[key,label]of [['assets','Assets'],['debts','Debts'],['netWorth','Net worth']])if(Number.isFinite(record?.totals?.[key]))ledger.append(node('dt','',label),node('dd','',money(record.totals[key]*multiplier)));
      $('.lifeline-selected-note').textContent=`${record?.note||record?.label||'A dated household position.'} ${settings.real?'Earlier values are expressed in today’s money using the current inflation assumption.':''} Income and spending between recorded updates are not inferred.`;
      renderEvents([{month:observation.month}]);return;
    }
    const rows=selectedRows();if(!rows.length)return;
    $('.lifeline-period-kind').textContent='Projection';$('.lifeline-period-kind').dataset.recorded='false';
    const last=rows.at(-1),divisor=settings.real?last.deflator:1;
    const period=settings.zoom==='month'?monthLabel(last.month):yearLabel(yearFor(last.month,settings.taxYear));
    $('.lifeline-selected-title').textContent=period;$('.lifeline-selected-ages').textContent=`Approximate ages · ${ageLabel(last.month)}`;
    const balance=$('.lifeline-selected-balance');balance.replaceChildren(node('span','',settings.metric==='accessible'?'Accessible investments at period end':'Net worth at period end'),node('strong','',money(settings.metric==='accessible'?last.withdrawableAssets/divisor:(last.assetsTotal-last.debtsTotal)/divisor)));
    const sum=key=>rows.reduce((total,row)=>total+finite(row[key])/(settings.real?row.deflator:1),0);
    const ledger=$('.lifeline-ledger');ledger.replaceChildren();
    const values=[['Net income','incomeTotal'],['Spending & repayments','spendingTotal'],['Assets used for spending','withdrawalNet'],['Workplace pension contributions','pensionContributions'],['Modelled tax & NI','taxTotal']];
    if(sum('unfunded')>.005)values.push(['Unfunded spending','unfunded']);
    for(const[label,key]of values){const dt=node('dt','',label),dd=node('dd',key==='unfunded'?'lifeline-shortfall':'',money(sum(key)));ledger.append(dt,dd);}
    $('.lifeline-selected-note').textContent=`${rows.length===1?'One projected month':`${rows.length} projected months`}${settings.real?' · today’s money':' · values at each date'}. ${rows.some(row=>row.taxIncomplete)?'Some tax treatments are incomplete. ':''}${settings.metric==='accessible'?'Property and locked pensions are excluded; future withdrawal tax is not deducted.':'Property and pension balances are included; these may not be available for spending.'}`;
    renderEvents(rows);
  }
  function renderEvents(rows){
    const list=$('.lifeline-event-list');list.replaceChildren();
    let shown=events.filter(event=>event.month>=rows[0].month&&event.month<=rows.at(-1).month);
    if(!shown.length&&settings.zoom==='life')shown=events.filter(event=>event.month>=rows.at(-1).month).slice(0,4);
    if(!shown.length){list.append(node('p','lifeline-empty','No recorded milestones in this period. Add dated income or spending in Household.'));return;}
    for(const event of shown.slice(0,7)){
      const button=node('button',`lifeline-event lifeline-event-${event.type}`);button.type='button';
      const icon=node('span','lifeline-event-dot',event.type==='gap'?'!':event.type==='retirement'?'↗':'•');icon.setAttribute('aria-hidden','true');
      const detail=node('span','');detail.append(node('span','lifeline-event-date',monthLabel(event.month)),node('strong','',event.label));button.append(icon,detail);
      button.addEventListener('click',()=>{selectedObservation=null;settings.period=event.month;settings.zoom='month';render();});list.append(button);
    }
    if(events.length>shown.length&&settings.zoom!=='month'){
      const more=node('button','lifeline-text-button','See all milestones');more.type='button';more.addEventListener('click',()=>{list.replaceChildren();for(const event of events){const line=node('p','lifeline-milestone-line');line.append(node('span','',monthLabel(event.month)),node('strong','',event.label));list.append(line);}});list.append(more);
    }
  }
  function renderTable(){
    const rows=periodRows(),body=$('.lifeline-detail-table tbody');body.replaceChildren();
    const groups=settings.zoom==='life'?groupLifelineRows(rows,{taxYear:settings.taxYear,real:settings.real}):rows.map(row=>({key:row.month,month:row.month,accessible:row.withdrawableAssets/(settings.real?row.deflator:1),income:row.incomeTotal/(settings.real?row.deflator:1),spending:row.spendingTotal/(settings.real?row.deflator:1),tax:row.taxTotal/(settings.real?row.deflator:1)}));
    for(const group of groups){const row=node('tr');const label=node('th','',settings.zoom==='life'?yearLabel(group.key):monthLabel(group.month));label.scope='row';row.append(label);for(const key of ['accessible','income','spending','tax'])row.append(node('td','',money(group[key])));body.append(row);}
    $('.lifeline-assumption-note').textContent=`${settings.real?'Today’s money removes the modelled inflation effect.':'Future values include the modelled inflation effect.'} Inflation ${projection.assumptions.inflation}% a year. Investment returns, retirement dates, access ages and spending follow your current Planning assumptions. The grey baseline preserves the assumptions recorded when you saved it.`;
  }
  function render(){
    if(!projection)return;
    updateControls();
    const label=settings.metric==='accessible'?'Accessible investments':'Net worth';
    $('.lifeline-chart-title h2').textContent=settings.zoom==='month'?'Money moving this month':`${label}, over time`;
    $('.lifeline-basis').textContent=`${settings.real?'Today’s money':'Values at each date'} · ${settings.zoom==='month'?monthLabel(settings.period):settings.zoom==='year'?yearLabel(yearFor(settings.period,settings.taxYear)):`through ${projection.endMonth.slice(0,4)}`}`;
    $('.lifeline-history-note').textContent=baseline()||checkpoints().length?'Purple dots are dated positions you recorded. Gaps between updates are not measured history. The solid line is a projection from your latest position.':'Save a baseline and dated updates to see your recorded progress here. This line illustrates the future from your current inputs.';
    renderChart();renderInspector();renderTable();
  }
  function refresh(){
    announce('');
    try{
      inputs=getInputs();const key=JSON.stringify([inputs.flow,inputs.holdings,inputs.planning?.scenario]);
      if(key!==cacheKey){
        selectedObservation=null;
        const scenario=inputs.planning?.scenario||{};
        projection=projectPlan(inputs.flow,inputs.holdings,{...scenario,retirementYears:resolveRetirementYears(inputs.flow,inputs.holdings,scenario.retirementYears),planToAge:scenario.planToAge??95});
        cacheKey=key;events=lifelineEvents(inputs.flow,inputs.holdings,projection);
      }
      if(!validMonth(settings.period)||settings.period<projection.startMonth||settings.period>projection.endMonth)settings.period=projection.startMonth;
      render();
    }catch(error){announce(`We need a little more information to draw your lifeline. ${error.message}`);$('.lifeline-chart').replaceChildren();$('.lifeline-ledger').replaceChildren();}
  }
  for(const button of root.querySelectorAll('[data-zoom]'))button.addEventListener('click',()=>{selectedObservation=null;settings.zoom=button.dataset.zoom;render();});
  $('.lifeline-period').addEventListener('change',event=>{
    selectedObservation=null;const value=event.target.value;settings.period=settings.zoom==='month'?value:projection.months.find(row=>String(yearFor(row.month,settings.taxYear))===value)?.month||projection.startMonth;render();
  });
  for(const action of ['previous','next'])$(`[data-action=${action}]`).addEventListener('click',()=>{const select=$('.lifeline-period');select.selectedIndex+=action==='previous'?-1:1;select.dispatchEvent(new Event('change'));});
  for(const[selector,key]of [['.lifeline-show-baseline','showBaseline'],['.lifeline-real','real'],['.lifeline-tax-year','taxYear']])$(selector).addEventListener('change',event=>{selectedObservation=null;settings[key]=event.target.checked;render();});
  $('.lifeline-metric').addEventListener('change',event=>{selectedObservation=null;settings.metric=event.target.value;render();});
  $('[data-action=explore]').addEventListener('click',()=>onExplore());$('[data-action=edit]').addEventListener('click',()=>onEdit());$('[data-action=update]').addEventListener('click',()=>onUpdate());
  $('.lifeline-chart').addEventListener('click',event=>{
    if(!chartPoints.length||settings.zoom==='month')return;
    selectedObservation=null;const bounds=event.currentTarget.getBoundingClientRect(),position=(event.clientX-bounds.left)/bounds.width*event.currentTarget.viewBox.baseVal.width;
    selected=chartPoints.reduce((best,point)=>Math.abs(point.pixel-position)<Math.abs(best.pixel-position)?point:best);
    settings.period=selected.month;render();
  });
  function restore(value){
    if(value&&typeof value==='object'){
      settings={zoom:['life','year','month'].includes(value.zoom)?value.zoom:'life',period:validMonth(value.period)?value.period:null,taxYear:value.taxYear===true,showBaseline:value.showBaseline!==false,metric:value.metric==='netWorth'?'netWorth':'accessible',real:value.real!==false};
    }else settings={zoom:'life',period:null,taxYear:false,showBaseline:true,metric:'accessible',real:true};
    cacheKey='';projection=null;selectedObservation=null;
  }
  return {refresh,snapshot:()=>structuredClone(settings),restore};
}
