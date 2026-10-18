import { summarizeMonthlyFlow } from './monthly-flow.mjs?v=20261017demo6';
import { mountExperiments } from './experiments-view.mjs?v=20261018journey2';
import {startingPictureKey} from './planning-review.mjs?v=20261017review1';
import { mountOutcomes } from './planning-outcomes-view.mjs?v=20261017save3';
import { projectPlan, annualPlanView, PLANNING_DEFAULTS } from './planning.mjs?v=20261017save3';
import { planHorizon, summarizeCoverage, agesAt } from './coverage.mjs?v=20261016layout2';
import { WITHDRAWAL_ORDERS } from './withdrawals.mjs?v=20261016layout2';

const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
const currency=value=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(value);
const compact=value=>new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value);
const colours={netWorth:'#007AFF',primary:'#1F7A68',partner:'#7C5CBF',shared:'#C58B3B',pay:'#1F7A68',statePension:'#7C5CBF',pensionIncome:'#ad5682',rent:'#C58B3B',other:'#C58B3B',cash:'#1F7A68',isa:'#007AFF',pension:'#7C5CBF',property:'#C58B3B',shares:'#ad5682',general:'#b56a30',mortgage:'#FF3B30',otherDebt:'#CC6600',withdrawCash:'#1F7A68',withdrawGeneral:'#b56a30',withdrawIsa:'#007AFF',withdrawPension:'#7C5CBF',withdrawn:'#b56a30',cashDrawn:'#C58B3B',unfunded:'#b3261e',spending:'#1C1C1E'};
const labels={netWorth:'Your scenario',pay:'Take-home pay',statePension:'State Pension',pensionIncome:'Other pension income',rent:'Rent',other:'Other',cash:'Cash',isa:'ISA',pension:'DC pensions',property:'Property',shares:'Shares',general:'General account',mortgage:'Mortgage',otherDebt:'Other debt',withdrawCash:'Cash withdrawal',withdrawGeneral:'General account withdrawal',withdrawIsa:'ISA withdrawal',withdrawPension:'Personal pension withdrawal',withdrawn:'Assets used',cashDrawn:'Cash used',unfunded:'Unfunded'};
const metrics={netWorth:{title:'Net worth',note:'What you own minus what you owe, including property and pension pots. Compare your scenario with your recorded current plan.',balance:true},income:{title:'Income & funding',note:'Income plus net withdrawals used for spending. Withdrawals reduce your assets; growth remains in asset balances.',balance:false},saving:{title:'Saving',note:'Deposits after spending; workplace pensions appear in Assets. Asset withdrawals and unfunded costs appear below zero.',balance:false},assets:{title:'Assets',note:'Total assets before debt, including DC pensions and property. Net worth after debt is shown in the year details.',balance:true},debts:{title:'Debt',note:'Balances at each year end after modelled mortgage payments.',balance:true}};
function svgNode(tag,attrs={},text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(text!=null)node.textContent=text;return node;}

export function mountPlanning(root,getInputs) {
  let metric='income',group='person',style='bars',real=true,selectedYear=null,projection=null,confirmedKey=null;
  let scenario={years:30,planToAge:95,retirementYears:{},mortgageYearsEarlier:0};
  let restoredNeedsReview=false,showBaseline=false,experiments=[],comparisonCacheKey='',comparisonCache=new Map();
  const reviewedKeyStorage='steadybee.planning.reviewed-inputs.v1';
  function cachedReviewKey(){try{return window.localStorage.getItem(reviewedKeyStorage);}catch{return null;}}
  function rememberReviewKey(key){try{window.localStorage.setItem(reviewedKeyStorage,key);}catch{}}
  let chartRows=[],chartKeys=[],chartBaselineRows=[],baseline=null,baselineKey='',baselineOptions={},history=[],lastSnapshot=null,editGroup=0,lastHistoryGroup=-1;
  root.addEventListener('focusin',event=>{if(event.target.matches('input,select'))editGroup++;});
  root.addEventListener('pointerdown',event=>{if(event.target.matches('input[type=range]'))editGroup++;});
  root.classList.add('plan-root');
  const growthPanel=document.getElementById('flow-growth-panel');
  root.innerHTML=`
    <div class="plan-source"><span id="plan-source-text"></span><div><button type="button" id="plan-undo" class="plan-text-button" disabled>Undo</button><button type="button" id="plan-reset" class="plan-text-button">Reset scenario</button></div></div>
    <div class="plan-introduction"><div class="plan-context-line"><span id="plan-context" class="plan-context"></span><details class="plan-timing-note"><summary>Retirement dates</summary><p id="plan-question-detail" class="plan-question-detail"></p></details></div></div>
    <div id="plan-confirm" class="plan-confirm" hidden><h2>Check your starting picture</h2><p>Review these details before exploring the illustration. Missing amounts are not automatically estimated.</p><ul id="plan-readiness" class="plan-readiness"></ul><div class="plan-review-actions"><button type="button" id="plan-check-assets" class="button button-secondary">Review assets & debt</button><button type="button" id="plan-check-flow" class="button button-secondary">Review income & spending</button></div><button type="button" id="plan-confirm-button" class="button button-primary">I’ve checked my starting figures</button></div>
    <p id="plan-error" class="form-error" role="alert" hidden></p>
    <section id="plan-comparison" class="plan-comparison" aria-label="Current plan and scenario comparison"></section><div id="plan-key-assumptions" class="plan-key-assumptions"></div><div class="plan-adjust-row"><button type="button" id="plan-adjust" class="button button-primary" aria-expanded="false" aria-controls="plan-controls">Adjust scenario</button><span id="plan-live-result" class="plan-live-result" aria-live="polite"></span><details id="plan-changes"><summary>What changed?</summary><ul id="plan-changes-list"></ul></details></div><div id="plan-workspace" class="plan-workspace">
      <section class="plan-chart-card" aria-label="Your illustration over time">
        <div class="plan-metrics" role="group" aria-label="What to explore"><button type="button" data-metric="income" aria-pressed="true"><span class="metric-label-long">Income & spending</span><span class="metric-label-short">Income</span></button><button type="button" data-metric="netWorth" aria-pressed="false">Net worth</button><button type="button" data-metric="saving" aria-pressed="false">Saving</button><button type="button" data-metric="assets" aria-pressed="false">Assets</button><button type="button" data-metric="debts" aria-pressed="false">Debt</button></div>
        <select id="plan-metric-select" class="plan-metric-select" aria-label="What to explore"><option value="income">Income & spending over time</option><option value="netWorth">Net worth over time</option><option value="saving">Saving over time</option><option value="assets">Assets over time</option><option value="debts">Debt over time</option></select><div class="plan-chart-heading"><div><h2 id="plan-result-title">Income over time</h2></div><div class="plan-money-toggle" role="group" aria-label="Value of money"><button type="button" data-money="real" aria-pressed="true">Today’s money</button><button type="button" data-money="nominal" aria-pressed="false">Future value</button></div></div>
        <div class="plan-chart-controls"><details class="plan-display-options"><summary>Chart options</summary><div class="plan-display-options-body"><div data-chart-group role="group" aria-label="Group the chart"><button type="button" data-group="person" aria-pressed="true">Person</button><button type="button" data-group="type" aria-pressed="false">Type</button></div><div data-chart-group role="group" aria-label="Chart style"><button type="button" data-style="bars" aria-pressed="true">Bars</button><button type="button" data-style="lines" aria-pressed="false">Lines</button></div></div></details></div>
        <div id="plan-legend" class="plan-legend"></div>
        <div class="plan-chart-wrap"><svg id="plan-chart" viewBox="0 0 1000 500" role="group" aria-label="Annual projection chart; drag horizontally to inspect a year"></svg><div id="plan-chart-tooltip" class="plan-chart-tooltip" role="tooltip" hidden></div></div>
        <details class="plan-figure-notes"><summary>How to read these figures</summary><p id="plan-pension-note" class="plan-pension-note"></p><p id="plan-chart-note"></p><p id="plan-money-explainer" class="plan-money-explainer"></p></details><div class="plan-year-control"><label for="plan-compare-year" class="visually-hidden">Explore a year</label><select id="plan-compare-year" aria-label="Explore a year"></select><output id="plan-selected-year" hidden></output><input aria-label="Year on chart" id="plan-year" type="range" min="0" max="30" step="1" value="1" hidden /><button id="plan-year-mode" class="date-mode-button" type="button" aria-expanded="false" aria-controls="plan-year">Timeline</button></div>
        <div id="plan-events" class="plan-events" aria-label="Changes on your timeline"></div>
        <section id="plan-retirement-snapshot" class="plan-retirement-snapshot" aria-label="First retirement month funding"></section>
        <div class="plan-year-detail"><div><p id="plan-detail-label"></p><strong id="plan-detail-total"></strong><span id="plan-detail-period"></span></div><dl id="plan-detail-values"></dl></div>
        <div id="plan-withdrawal-detail" class="plan-withdrawal-detail" hidden></div><p id="plan-gap" class="plan-gap" hidden></p><section id="plan-compare" class="plan-compare"><h2>Compare withdrawal orders</h2><div id="plan-compare-results"></div></section>
      </section>
      <aside id="plan-controls" class="plan-controls" aria-label="Scenario assumptions">
        <div class="plan-sheet-handle" role="separator" tabindex="0" aria-label="Resize scenario panel" aria-orientation="horizontal" aria-valuemin="35" aria-valuemax="80" aria-valuenow="55"></div><div class="plan-controls-heading"><h2>Your scenario</h2><button id="plan-sheet-close" type="button" class="plan-text-button">Done</button></div><details class="plan-control-card plan-timing" open><summary>Retirement ages</summary><div id="plan-retirement"></div><div id="plan-horizon"></div></details>
        <details class="plan-control-card plan-spending-card"><summary>Household budget</summary><div class="plan-spending-heading"><button id="plan-add-spending" type="button" aria-label="Add a household spending change" title="Add spending change">+</button></div><div id="plan-spending-controls"></div><p id="plan-spending-budget" class="plan-control-help"></p><details class="plan-inline-help"><summary>How changes work</summary><p>Each percentage replaces the original household budget, in today’s money. Debt and scheduled costs keep their own amounts and dates.</p></details></details>
        <div id="plan-growth-slot"></div>
        <details id="plan-pension-assumptions" class="plan-control-card"><summary>Ages & pensions</summary><div id="plan-age-inputs" class="plan-ages"></div><div id="plan-pension-controls"></div><label class="plan-check"><input id="plan-future-ni" type="checkbox" checked /> Assume qualifying NI years while working</label><label class="plan-check"><input id="plan-state-uprating" type="checkbox" checked /> State Pension keeps pace with inflation</label><div id="plan-state-summary"></div></details>
        <details class="plan-control-card"><summary>Saving destinations</summary><div class="plan-one-off"><label for="plan-savings-destination">Invest future surplus in</label><select id="plan-savings-destination"><option value="existing">Existing cash → ISA → general plan</option><option value="general">General account only</option></select></div></details><details class="plan-control-card"><summary>Funding shortfalls</summary><div class="plan-one-off"><label for="plan-withdrawal-order">Use accounts in this order</label><select id="plan-withdrawal-order"><option value="generalFirst">Cash → general → ISA → pension</option><option value="pensionFirst">Cash → pension → general → ISA</option><option value="isaFirst">Cash → ISA → general → pension</option></select><p class="plan-control-help">Eligible accounts only. Within each bucket, lower estimated immediate tax is used first. This does not establish a lifetime optimum.</p></div></details><details class="plan-control-card"><summary>Tax assumptions</summary><div class="plan-one-off"><p class="plan-control-help">2026–27 rules, held fixed: CGT uses 18% / 24% bands and a £3,000 annual gain allowance per person. Cash interest uses savings allowances and 20% / 40% / 45% rates. Cash principal and ISA withdrawals are tax-free.</p><div id="plan-gain-slider"></div><div id="plan-tax-free-inputs" class="plan-ages"></div><p class="plan-control-help">Estimates use annualised monthly income and interest, not a complete tax-year calculation. England/Wales/NI rules. Capital growth only: dividend tax and rental-income tax are excluded. Opening investment cost is assumed by the gain-share slider; enter your own assumption. No other gains or losses. Current rules, subject to change.</p></div></details>
        <details class="plan-control-card plan-mortgage"><summary>Mortgage & debt</summary><div id="plan-mortgage-controls"></div><div id="plan-other-debt-controls" class="plan-other-debts"></div></details><details class="plan-control-card"><summary>Future one-off cost</summary><p class="plan-control-help">This scenario only. Recorded costs already carry through from Income & spending; add a cost here only if it is extra.</p><div class="plan-one-off"><label for="plan-cost">Extra cost (£, today’s pounds)</label><input id="plan-cost" type="number" min="0" max="10000000" step="100" placeholder="0" /><label for="plan-cost-month">When</label><input id="plan-cost-month" type="month" /></div></details>
      </aside>
    </div>
    <div class="plan-method"><button type="button" id="plan-method-open" class="plan-info-button" aria-label="How calculations work and export" title="Calculation details and export"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg></button><dialog id="plan-method-dialog" class="plan-method-dialog" aria-labelledby="plan-method-title"><div class="plan-dialog-heading"><div><h2 id="plan-method-title">How this plan is calculated</h2><p>See the method or export the current scenario for Excel.</p></div><button type="button" class="plan-dialog-close" aria-label="Close calculation details">×</button></div><div class="plan-method-content"><p class="plan-facts-note">Recorded inputs stay unchanged. Adjustments apply only to your scenario.</p><div class="plan-method-context"></div><div id="plan-method-body"></div></div><div class="plan-dialog-actions"><button type="button" id="plan-export-calculations" class="button button-secondary" disabled>Download spreadsheet for Excel (.csv)</button><span id="plan-export-status" role="status" aria-live="polite"></span></div></dialog></div>
    <p class="plan-disclaimer">Illustration, not advice. Current rules, subject to change.</p>`;
  const $=id=>root.querySelector(`#${id}`);
  function revealControl(section) {
    if(!root.classList.contains('plan-controls-open'))$('plan-adjust').click();
    section.open=true;section.scrollIntoView({block:'start'});section.querySelector('summary')?.focus({preventScroll:true});
  }
  const toolbar=el('div','plan-toolbar');
  toolbar.append(document.querySelector('.planning-heading'),root.querySelector('.plan-source'));
  root.prepend(toolbar);
  root.querySelector('.plan-chart-controls').append(root.querySelector('.plan-money-toggle'));
  root.querySelector('.plan-chart-heading').append(el('span','plan-chart-unit','£ per year'));
  const chartToolbar=el('div','plan-chart-toolbar');
  chartToolbar.append(root.querySelector('.plan-chart-heading'),root.querySelector('.plan-chart-controls'));
  $('plan-legend').before(chartToolbar);
  const resultToolbar=el('div','plan-result-toolbar');
  $('plan-comparison').before(resultToolbar);resultToolbar.append($('plan-comparison'),root.querySelector('.plan-adjust-row'));
  const method=root.querySelector('.plan-method');
  method.querySelector('.plan-method-context').append(root.querySelector('.plan-introduction'),$('plan-source-text'),$('plan-key-assumptions'),root.querySelector('.plan-timing-note'),$('plan-changes'));
  const methodDialog=$('plan-method-dialog');
  $('plan-method-open').addEventListener('click',()=>methodDialog.showModal());
  method.querySelector('.plan-dialog-close').addEventListener('click',()=>methodDialog.close());
  methodDialog.addEventListener('click',event=>{if(event.target===methodDialog)methodDialog.close();});
  $('plan-export-calculations').addEventListener('click',exportCalculations);
  function exportCalculations(){
    if(!projection)return;
    const records=[];
    const add=(section,year,item,value,units='£',notes='')=>records.push([section,year,item,value,units,notes]);
    add('Scenario','','Starting month',projection.startMonth,'month');
    add('Scenario','','End month',projection.endMonth,'month');
    add('Scenario','','Value basis',real ? 'Today’s money' : 'Future value','');
    add('Scenario','','Inflation',projection.assumptions.inflation,'%');
    add('Scenario','','Pay and rent growth',projection.assumptions.incomeGrowth,'%');
    for(const [key,value] of Object.entries(projection.assumptions.growth || {}))add('Scenario','',`${key} growth`,value,'%');
    add('Scenario','','Withdrawal order',scenario.withdrawalOrder || 'generalFirst','');
    add('Scenario','','Saving destination',scenario.savingsDestination || 'existing','');
    add('Starting picture','','Assets',projection.opening.assetsTotal);
    add('Starting picture','','Debt',projection.opening.debtsTotal);
    const rows=annualPlanView(projection,'income','type',real);
    for(const row of rows){
      const months=projection.months.filter(item=>item.month.startsWith(row.year));
      const last=months.at(-1),deflator=real ? last.deflator : 1;
      const year=String(row.year), period=`${row.months} months`;
      add('Annual results',year,'Income',row.income,'£',period);
      add('Annual results',year,'Spending and debt costs',row.spending,'£',period);
      add('Annual results',year,'Net asset withdrawals',row.withdrawn,'£',period);
      add('Annual results',year,'Estimated withdrawal tax',row.withdrawalTax,'£',period);
      add('Annual results',year,'Cash interest earned',row.cashInterestGross,'£',period);
      add('Annual results',year,'Estimated tax on cash interest',row.cashInterestTax,'£',period);
      add('Annual results',year,'Unfunded spending',row.unfunded,'£',period);
      add('Year-end balances',year,'Assets',last.assetsTotal/deflator,'£',`${last.month} closing balance`);
      add('Year-end balances',year,'Debt',last.debtsTotal/deflator,'£',`${last.month} closing balance`);
      add('Year-end balances',year,'Net worth',(last.assetsTotal-last.debtsTotal)/deflator,'£',`${last.month} closing balance`);
      for(const item of row.withdrawals){
        const label=`${item.owner} · ${item.bucket}`;
        add('Withdrawals by account',year,`${label} gross`,item.gross,'£',period);
        add('Withdrawals by account',year,`${label} net`,item.net,'£',period);
        add('Withdrawals by account',year,`${label} estimated tax`,item.tax,'£',period);
      }
    }
    add('Method','','Calculation notes','Illustration based on recorded inputs and selected scenario; not a tax-year reconciliation or forecast.','','See the app’s calculation details for full assumptions and exclusions.');
    add('Method','','Tax year','2026–27 rates held fixed for future years.','','Tax estimates are simplified; actual tax may differ.');
    const escape=value=>`"${String(value ?? '').replaceAll('"','""')}"`;
    const csv='\uFEFF'+[['Section','Year','Calculation','Value','Units','Notes'],...records].map(row=>row.map(escape).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=el('a');
    link.href=url;link.download=`steadybee-planning-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('plan-export-status').textContent='Downloaded. Open the CSV file in Excel.';
  }
  const yearDetails=el('details','plan-detail-panel');yearDetails.append(el('summary','','Year details'));
  root.querySelector('.plan-year-control').after(yearDetails);
  for(const selector of ['#plan-events','#plan-retirement-snapshot','.plan-year-detail','#plan-withdrawal-detail','#plan-gap','#plan-compare','.plan-figure-notes'])yearDetails.append(root.querySelector(selector));
  const baselineLabel=el('label','plan-baseline-toggle'),baselineInput=el('input');baselineInput.type='checkbox';baselineInput.id='plan-show-baseline';baselineLabel.append(baselineInput,document.createTextNode('Show current plan'));
  root.querySelector('.plan-display-options-body').append(baselineLabel);
  baselineInput.addEventListener('change',()=>{showBaseline=baselineInput.checked;renderChart(getInputs().holdings);});
  $('plan-controls').addEventListener('toggle',event=>{if(!event.target.open)return;const active=event.target;if(!active.matches('.plan-control-card,.flow-growth-panel'))return;for(const other of $('plan-controls').querySelectorAll('details.plan-control-card,details.flow-growth-panel'))if(other!==active)other.open=false;},true);
  const scenarioHero=el('section','scenario-hero');scenarioHero.setAttribute('aria-label','Scenario overview');toolbar.before(scenarioHero);scenarioHero.append(toolbar,resultToolbar);
  const chartCard=root.querySelector('.plan-chart-card'),mainColumn=el('div','plan-main-column');chartCard.before(mainColumn);mainColumn.append(chartCard);
  const inspector=el('section','plan-year-inspector');inspector.setAttribute('aria-label','Year inspector');inspector.append(el('h2','','Year inspector'),$('plan-events'),root.querySelector('.plan-year-control'));
  const inspectorGrid=el('div','plan-inspector-grid');inspectorGrid.append($('plan-retirement-snapshot'),root.querySelector('.plan-year-detail'));inspector.append(inspectorGrid,yearDetails);yearDetails.querySelector('summary').textContent='Funding & calculation details';mainColumn.append(inspector);
  const fundingComparison=el('section','plan-funding-comparison');fundingComparison.setAttribute('aria-label','Compare withdrawal orders');mainColumn.append(fundingComparison);fundingComparison.append($('plan-compare'));
  const outcomes=mountOutcomes(mainColumn,inspector,()=>{const {flow,holdings}=getInputs();return {flow,holdings,options:scenario};});
  const savedExperiments=mountExperiments(root,{getState:workingState,loadState:state=>restore({...state,experiments},{review:false}),getEntries:()=>experiments,setEntries:entries=>{experiments=entries;},getInputs});
  toolbar.append(method);
  const sheetBackdrop=el('div','plan-sheet-backdrop');sheetBackdrop.setAttribute('aria-hidden','true');root.append(sheetBackdrop);
  const sheet=$('plan-controls'),handle=root.querySelector('.plan-sheet-handle');
  function syncSheetSemantics(){const modal=matchMedia('(max-width:767px)').matches && root.classList.contains('plan-controls-open');if(modal){sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','Your scenario');sheet.setAttribute('aria-modal','true');}else{sheet.removeAttribute('role');sheet.removeAttribute('aria-modal');}}
  $('plan-sheet-close').addEventListener('click',()=>$('plan-adjust').click());sheetBackdrop.addEventListener('click',()=>$('plan-adjust').click());
  root.addEventListener('keydown',event=>{
    if(!root.classList.contains('plan-controls-open'))return;
    if(event.key==='Escape'){event.preventDefault();$('plan-adjust').click();return;}
    if(event.key!=='Tab' || !matchMedia('(max-width:767px)').matches)return;
    const focusable=[...sheet.querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')].filter(node=>!node.disabled && node.getClientRects().length);
    if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });
  let drag=null;
  function setSheetHeight(percent){const next=Math.max(35,Math.min(80,percent));sheet.style.setProperty('--sheet-height',`${next}vh`);handle.setAttribute('aria-valuenow',String(Math.round(next)));}
  handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={y:event.clientY,height:sheet.getBoundingClientRect().height};handle.setPointerCapture(event.pointerId);});
  handle.addEventListener('pointermove',event=>{if(drag)setSheetHeight((drag.height+drag.y-event.clientY)/innerHeight*100);});
  for(const event of ['pointerup','pointercancel'])handle.addEventListener(event,()=>{drag=null;});
  handle.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const current=Number(handle.getAttribute('aria-valuenow'));setSheetHeight(event.key==='Home' ? 35 : event.key==='End' ? 80 : current+(event.key==='ArrowUp' ? 5 : -5));});
  window.addEventListener('resize',syncSheetSemantics);
  $('plan-growth-slot').append(growthPanel);
  growthPanel.open=false;
  growthPanel.querySelector('summary').textContent='Growth & inflation';
  growthPanel.querySelector('.flow-growth-body > p').textContent='All rates are nominal, before inflation. Today’s money removes inflation.';
  growthPanel.querySelector('.flow-growth-body > p:last-child').remove();
  growthPanel.querySelector('.flow-growth-body').append(el('p','plan-control-help'));growthPanel.querySelector('.flow-growth-body > p:last-child').id='plan-real-growth';
  const stressLabel=el('label','plan-check plan-stress-switch'),stressInput=el('input');stressInput.id='plan-stress-test';stressInput.type='checkbox';stressLabel.append(stressInput,document.createTextNode('Stress test · −20% investment shock'));
  const stressHelp=el('details','plan-stress-help');stressHelp.append(el('summary','','What is tested?'),el('p','','One drop at the first recorded retirement month, before growth and withdrawals. ISA, general, shares and DC pension values fall together; cash, property and pension income do not. Investment allocation is unknown. Usual growth resumes afterwards. One illustration, not a worst case or a probability of success.'));
  const stressStatus=el('p','plan-control-help');stressStatus.id='plan-stress-status';growthPanel.querySelector('.flow-growth-body').append(stressLabel,stressHelp,stressStatus);
  stressInput.addEventListener('change',()=>{scenario.retirementStress=stressInput.checked;refresh();});
  const fundingOrder=el('details','plan-funding-order');fundingOrder.id='plan-funding-order';fundingOrder.append(el('summary'),el('p','','Income pays spending first; any gap uses eligible accounts in this order. Pension access is checked separately for each person. Within a bucket, estimated immediate tax sets priority; this is not a lifetime tax optimum. Property and unconfirmed shares are excluded. Change the order in Adjust scenario → Funding shortfalls.'));$('plan-legend').after(fundingOrder);
  const stressBadge=el('p','plan-stress-badge');stressBadge.id='plan-stress-badge';stressBadge.hidden=true;fundingOrder.after(stressBadge);

  const rateControls=[['flow-inflation-rate','inflation','Inflation',0,10],['flow-income-growth','incomeGrowth','Pay & rent growth',-5,10],...Object.keys(PLANNING_DEFAULTS.growth).map(key=>[`flow-growth-${key}`,key,({cash:'Cash return',isa:'ISA growth',pension:'DC pension growth',property:'Property growth',shares:'Shares & general account'})[key],-10,12])];
  for(const [id,key,title,min,max] of rateControls) {
    const input=document.getElementById(id),label=input.closest('label');
    label.replaceChildren();label.className='plan-slider';
    const line=el('span','plan-slider-label',title),out=el('output');out.htmlFor=id;line.append(out);label.append(line,input);
    input.type='range';input.min=min;input.max=max;input.step='.1';input.removeAttribute('placeholder');input.dataset.planRate=key;
    const exact=el('input','plan-exact');exact.type='number';exact.step='.1';exact.min=min;exact.max=max;exact.setAttribute('aria-label',`${title}: exact percentage`);label.append(exact);exact.addEventListener('input',()=>{if(exact.value==='' || !exact.checkValidity())return;const value=Number(exact.value);if(['inflation','incomeGrowth'].includes(key))scenario[key]=value;else{scenario.growth ||= {};scenario.growth[key]=value;}refresh();});
    input.addEventListener('input',event=>{event.stopImmediatePropagation();const value=Number(input.value);if(['inflation','incomeGrowth'].includes(key))scenario[key]=value;else{scenario.growth ||= {};scenario.growth[key]=value;}out.textContent=`${value}%`;refresh();},true);
  }
  let controlsKey='';
  function slider(target,id,title,min,max,value,callback,suffix='') {
    const label=el('label','plan-slider');label.htmlFor=id;
    const line=el('span','plan-slider-label',title),out=el('output','',`${value}${suffix}`);out.htmlFor=id;line.append(out);
    const input=el('input');input.id=id;input.type='range';input.min=min;input.max=max;input.step=suffix==='%' ? '.1' : '1';input.value=value;
    input.addEventListener('input',()=>{out.textContent=`${input.value}${suffix}`;if(label.querySelector('.plan-exact'))label.querySelector('.plan-exact').value=input.value;callback(Number(input.value));refresh();});const exact=el('input','plan-exact');exact.type='number';exact.min=min;exact.max=max;exact.step=input.step;exact.value=value;exact.setAttribute('aria-label',`${title}: exact value${suffix ? ` (${suffix.trim()})` : ''}`);exact.addEventListener('input',()=>{if(exact.value==='' || !exact.checkValidity())return;const next=Number(exact.value);input.value=next;out.textContent=`${next}${suffix}`;callback(next);refresh();});input.addEventListener('input',()=>{exact.value=input.value;});label.append(line,input,exact);target.append(label);
  }
  function buildControls(flow,holdings) {
    const startMonth=flow.timelineStartMonth || flow.asOfMonth,startYear=Number(startMonth.slice(0,4));
    const key=JSON.stringify([startMonth,holdings.name,holdings.partnerName,flow.pay.primary.endDate,flow.pay.partner.endDate,holdings.debts,holdings.age,holdings.partnerAge,scenario.ages]);
    if(key===controlsKey)return;controlsKey=key;
    $('plan-age-inputs').replaceChildren();$('plan-pension-controls').replaceChildren();$('plan-spending-controls').replaceChildren();$('plan-gain-slider').replaceChildren();$('plan-tax-free-inputs').replaceChildren();
    $('plan-retirement').replaceChildren();$('plan-horizon').replaceChildren();$('plan-mortgage-controls').replaceChildren();
    for(const owner of holdings.partnerName ? ['primary','partner'] : ['primary']) {
      const name=owner==='primary' ? holdings.name || 'You' : holdings.partnerName;
      const finalYear=Number(flow.pay[owner].endDate?.slice(0,4)) || startYear+20;
      const age=scenario.ages?.[owner] ?? (owner==='primary' ? holdings.age : holdings.partnerAge);
      const knownAge=Number.isFinite(age),year=scenario.retirementYears[owner] ?? finalYear;
      // The engine's approximate birth month is the opening month. A final pay
      // month before that anniversary belongs to the previous age.
      const ageOffset=Number(flow.pay[owner].endDate?.slice(5) || 12)<Number(startMonth.slice(5)) ? 1 : 0;
      slider($('plan-retirement'),`plan-retire-${owner}`,knownAge ? `${name} retirement age` : `${name} final working year`,knownAge ? age-1 : startYear-1,knownAge ? age+45 : startYear+45,knownAge ? age+year-startYear-ageOffset : year,value=>scenario.retirementYears[owner]=knownAge ? startYear+value-age+ageOffset : value);
      $(`plan-retire-${owner}`).dataset.retirementBasis=knownAge ? 'age' : 'year';
      const timing=el('p','plan-retirement-date');timing.id=`plan-retirement-date-${owner}`;$('plan-retirement').append(timing);
    }
    slider($('plan-horizon'),'plan-horizon-slider','Plan to age',70,120,scenario.planToAge ?? 95,value=>scenario.planToAge=value);
    const lastWorkYear=Math.max(...['primary',...(holdings.partnerName ? ['partner'] : [])].map(owner=>scenario.retirementYears[owner] ?? (Number(flow.pay[owner].endDate?.slice(0,4)) || startYear+20)));
    scenario.spendingChanges ??= [{year:lastWorkYear+1,percent:100}];
    renderSpendingChanges(flow);
    slider($('plan-pension-controls'),'plan-state-age','State Pension scenario age',67,70,scenario.statePensionAge ?? 67,value=>scenario.statePensionAge=value);
    slider($('plan-pension-controls'),'plan-personal-age','Personal pension access age',57,65,scenario.pensionAccessAge ?? 57,value=>scenario.pensionAccessAge=value);
    slider($('plan-gain-slider'),'plan-opening-gain','Unknown opening cost: gain share',0,100,scenario.openingGainPercent ?? 100,value=>scenario.openingGainPercent=value,'%');
    for(const owner of holdings.partnerName ? ['primary','partner'] : ['primary']) {
      const label=el('label','',`${owner==='primary' ? holdings.name || 'Your' : holdings.partnerName} current age`),input=el('input');
      input.type='number';input.min=18;input.max=100;input.value=scenario.ages?.[owner] ?? (owner==='primary' ? holdings.age ?? '' : holdings.partnerAge ?? '');input.setAttribute('aria-label',label.textContent);
      input.addEventListener('change',()=>{scenario.ages ||= {};scenario.ages[owner]=input.value==='' ? null : Number(input.value);refresh();});label.append(input);$('plan-age-inputs').append(label);
      const freeLabel=el('label','',`${owner==='primary' ? holdings.name || 'Your' : holdings.partnerName} remaining pension tax-free allowance (£)`),free=el('input');free.type='number';free.min=0;free.max=268275;free.value=scenario.taxFreeRemaining?.[owner] ?? 268275;free.setAttribute('aria-label',freeLabel.textContent);
      free.addEventListener('change',()=>{scenario.taxFreeRemaining ||= {};scenario.taxFreeRemaining[owner]=Number(free.value);refresh();});freeLabel.append(free);$('plan-tax-free-inputs').append(freeLabel);
    }
    $('plan-other-debt-controls').replaceChildren();
    for(const debt of (holdings.debts || []).filter(item=>item.kind!=='mortgage')) {
      const card=el('div','plan-other-debt');card.append(el('h3','',debt.label || debt.kind));
      for(const [key,title,initial] of [['monthlyPayment','Monthly repayment (£)',scenario.debtPayments?.[debt.id]?.monthlyPayment],['annualRate','Interest rate (%)',scenario.debtPayments?.[debt.id]?.annualRate ?? debt.interestRate]]) {
        const label=el('label','',title),input=el('input');input.type='number';input.min=0;input.max=key==='annualRate' ? 100 : 1000000;input.step='.01';input.value=initial ?? '';input.setAttribute('aria-label',`${debt.label || debt.kind} ${title}`);label.append(input);card.append(label);
        input.addEventListener('change',()=>{scenario.debtPayments ||= {};scenario.debtPayments[debt.id] ||= {};scenario.debtPayments[debt.id][key]=input.value==='' ? undefined : Number(input.value);refresh();});
      }
      card.append(el('p','plan-control-help','Enter both figures. Avoid also recording this repayment as household spending.'));$('plan-other-debt-controls').append(card);
    }
    const mortgage=holdings.debts?.find(item=>item.kind==='mortgage');
    if(mortgage) {
      slider($('plan-mortgage-controls'),'plan-mortgage-rate','Mortgage interest',0,15,scenario.mortgageRate ?? mortgage.interestRate ?? 0,value=>scenario.mortgageRate=value,'%');
      slider($('plan-mortgage-controls'),'plan-mortgage-term','Repay remaining balance over',1,Math.ceil(mortgage.remainingYears || 30),scenario.mortgageTermYears ?? Math.ceil(mortgage.remainingYears || 30),value=>scenario.mortgageTermYears=value,' years');
      const payoffLabel=el('label','plan-check'),payoff=el('input');payoff.id='plan-payoff-now';payoff.type='checkbox';payoff.checked=Boolean(scenario.mortgagePayoffNow);payoff.addEventListener('change',()=>{scenario.mortgagePayoffNow=payoff.checked;refresh();});payoffLabel.append(payoff,document.createTextNode('Repay mortgage now'));$('plan-mortgage-controls').append(payoffLabel,el('div','plan-control-help'));$('plan-mortgage-controls').lastElementChild.id='plan-payoff-summary';
      const sourceLabel=el('label','plan-payoff-source','Payoff source'),source=el('select');source.id='plan-payoff-source';
      for(const [value,title] of [['automatic','Use withdrawal order'],['cashShares','Cash + shares · preserve ISA']]){const option=el('option','',title);option.value=value;source.append(option);}
      source.value=scenario.mortgagePayoffSource || 'automatic';source.addEventListener('change',()=>{scenario.mortgagePayoffSource=source.value;refresh();});sourceLabel.append(source);$('plan-mortgage-controls').insertBefore(sourceLabel,payoffLabel);$('plan-mortgage-controls').append(el('p','plan-control-help','Cash + shares explicitly assumes shares marked Needs sale can be sold now. Check access shares remain excluded. Standard CGT is estimated; employee-scheme tax relief and employment tax are not modelled.'));
      $('plan-mortgage-controls').append(el('p','plan-control-help','Changes recalculate the monthly payment for included repayment mortgages. No lender charges are modelled.'));
    } else $('plan-mortgage-controls').append(el('p','plan-control-help','Add a mortgage in Assets & debt to explore repayments.'));
  }
  function renderSpendingChanges(flow) {
    const list=$('plan-spending-controls');list.replaceChildren();
    const base=Object.values(flow.spending).reduce((sum,value)=>sum+value,0)+(flow.customSpending || []).reduce((sum,item)=>sum+item.amount,0);
    for(const [index,change] of (scenario.spendingChanges || []).entries()) {
      const row=el('div','plan-spending-change');
      for(const [key,title,min,max] of [['year','From year',Number(flow.timelineStartMonth.slice(0,4)),Number(flow.timelineStartMonth.slice(0,4))+50],['percent','% of now',0,200]]) {
        const label=el('label','',title),input=el('input');input.type='number';input.min=min;input.max=max;input.step=key==='percent' ? '.1' : '1';input.value=key==='percent' ? Math.round(change[key]*10)/10 : change[key];input.setAttribute('aria-label',`Spending change ${index+1}: ${title}`);input.addEventListener('change',()=>{change[key]=Number(input.value);if(row.querySelector('.plan-budget-amount input'))row.querySelector('.plan-budget-amount input').value=Math.round(base*change.percent/100);row.querySelector('output').textContent=`${currency(base*change.percent/100)}/month`;refresh();});label.append(input);row.append(label);
      }
      const remove=el('button','','×');remove.type='button';remove.setAttribute('aria-label',`Remove spending change ${index+1}`);remove.addEventListener('click',()=>{scenario.spendingChanges.splice(index,1);renderSpendingChanges(flow);refresh();});const amountLabel=el('label','plan-budget-amount','£ / month'),amount=el('input');amount.type='number';amount.min=0;amount.max=base*2;amount.step='1';amount.value=Math.round(base*change.percent/100);amount.setAttribute('aria-label',`Spending change ${index+1}: monthly amount`);amount.addEventListener('change',()=>{change.percent=base>0 ? Number(amount.value)/base*100 : 100;renderSpendingChanges(flow);refresh();});amountLabel.append(amount);row.append(remove,el('output','',`${currency(base*change.percent/100)}/month`),amountLabel);list.append(row);
    }
    if(!scenario.spendingChanges?.length)list.append(el('p','plan-control-help','No changes; household costs keep their current level.'));
  }
  function name(key,holdings) {return key==='primary' ? holdings.name || 'You' : key==='partner' ? holdings.partnerName || 'Partner' : key==='shared' ? 'Shared / other' : labels[key] || key;}
  function ageLabel(month,holdings,closing=true,source=projection) {return Object.entries(agesAt(source,month,{closing})).filter(([owner])=>owner==='primary'||holdings.partnerName).map(([owner,age])=>`${name(owner,holdings)} ${age}`).join(' · ');}
  function renderChart(holdings) {
    if(!projection)return;
    const rows=annualPlanView(projection,metric,group,real),meta=metrics[metric];
    const selected=Math.max(0,rows.findIndex(row=>row.year===selectedYear));selectedYear=rows[selected].year;
    const baseRows=annualPlanView(baseline || projection,metric,group,real);
    const keys=[...new Set(rows.flatMap(row=>Object.keys(row.values)))].filter(key=>rows.some(row=>row.values[key]!==0));
    if(group==='person')keys.sort((a,b)=>(['primary','partner','shared'].indexOf(a)<0 ? 3 : ['primary','partner','shared'].indexOf(a))-(['primary','partner','shared'].indexOf(b)<0 ? 3 : ['primary','partner','shared'].indexOf(b)));
    chartRows=rows;chartBaselineRows=baseRows;
    renderOutcome(rows[selected].year,holdings);
    for(const controls of root.querySelectorAll('[data-chart-group]'))controls.hidden=metric==='netWorth';
    root.querySelector('.plan-display-options').hidden=false;
    const negatives=metric==='saving' ? ['withdrawn','unfunded'].filter(key=>rows.some(row=>row[key]>0)) : [];
    chartKeys=[...keys,...negatives];$('plan-chart-tooltip').hidden=true;
    $('plan-chart-note').textContent=meta.note;
    $('plan-metric-select').value=metric;
    const realRate=((1+projection.assumptions.incomeGrowth/100)/(1+projection.assumptions.inflation/100)-1)*100;
    $('plan-money-explainer').textContent=`${real ? 'Today’s money removes inflation.' : 'Future value includes inflation.'} Pay/rent ${projection.assumptions.incomeGrowth}% nominal with ${projection.assumptions.inflation}% inflation = ${Math.abs(realRate)<.005 ? '0' : realRate.toFixed(1)}% real growth before tax.`;
    for(const button of root.querySelectorAll('[data-money]'))button.setAttribute('aria-pressed',String(button.dataset.money===(real ? 'real' : 'nominal')));
    const pensionNote=$('plan-pension-note');pensionNote.replaceChildren();pensionNote.hidden=metric!=='income';
    if(metric==='income') {
      pensionNote.append(document.createTextNode(`State Pension scenario age ${projection.statePensionAge}; personal pension access ${projection.pensionAccessAge}. `));
      const edit=el('button','plan-text-button','Review pension assumptions');edit.type='button';edit.addEventListener('click',()=>revealControl($('plan-pension-assumptions')));pensionNote.append(edit);
    }
    root.querySelector('.plan-chart-unit').textContent=meta.balance ? '£ · year end' : '£ per year';
    $('plan-result-title').textContent=`${meta.balance ? '' : 'Annual '}${meta.title}`;
    for(const button of root.querySelectorAll('[data-metric]'))button.setAttribute('aria-pressed',String(button.dataset.metric===metric));
    for(const button of root.querySelectorAll('[data-group]'))button.setAttribute('aria-pressed',String(button.dataset.group===group));
    for(const button of root.querySelectorAll('[data-style]'))button.setAttribute('aria-pressed',String(button.dataset.style===style));
    $('plan-legend').replaceChildren();
    for(const key of [...keys,...negatives,...(metric==='income' ? ['spending'] : []),...(showBaseline ? ['baseline'] : [])]) {
      const item=el('span'),swatch=el('i');if(['baseline','spending'].includes(key))swatch.className='plan-line-key';swatch.style.background=key==='baseline' ? '#64758b' : colours[key] || '#ae725c';item.append(swatch,document.createTextNode(key==='baseline' ? 'Current plan' : key==='spending' ? 'Spending' : name(key,holdings)));$('plan-legend').append(item);
    }
    const svg=$('plan-chart');svg.replaceChildren(svgNode('title',{},`${meta.title} by ${group}, ${real ? 'today’s' : 'future'} pounds. Use the year slider for exact values.`));
    const W=Math.max(240,Math.min(1000,Math.round(svg.parentElement.clientWidth))),H=W<600 ? 330 : 460,left=74,right=12,top=16,bottom=38,width=W-left-right;
    svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const maximum=Math.max(1,...(showBaseline ? baseRows.map(row=>row.total) : []),...rows.map(row=>style==='lines' ? Math.max(...Object.values(row.values),metric==='income' ? row.spending : 0) : Math.max(row.total,metric==='income' ? row.spending : 0)));
    const minimum=Math.min(0,...(showBaseline ? baseRows.map(row=>row.total) : []),...rows.map(row=>metric==='saving' ? -row.withdrawn-row.unfunded : row.total));
    const hi=maximum*1.1,lo=minimum*1.1,plotHeight=H-top-bottom;
    const y=value=>top+(hi-value)/(hi-lo)*plotHeight,step=width/rows.length,x=index=>left+(index+.5)*step;
    for(let i=0;i<=4;i++){const value=lo+(hi-lo)*i/4;svg.append(svgNode('line',{x1:left,x2:W-right,y1:y(value),y2:y(value),stroke:'#e8eaed'}),svgNode('text',{x:left-12,y:y(value)+5,'text-anchor':'end',class:'plan-axis'},`£${compact(value)}`));}
    svg.append(svgNode('rect',{x:left+selected*step,y:top,width:step,height:plotHeight,fill:'#e8f0fe',opacity:'.8'}));
    svg.append(svgNode('line',{x1:left,x2:W-right,y1:y(0),y2:y(0),stroke:'#bdc1c6'}));
    const points=key=>rows.map((row,index)=>!row.valid ? null : [x(index),y(row.values[key] || 0)]);
    function pathFor(points) {let path='',open=false;for(const point of points){if(!point){open=false;continue;}path+=`${open ? 'L' : 'M'}${point[0]},${point[1]} `;open=true;}return path;}
    if(style==='bars' && metric!=='netWorth')for(let index=0;index<rows.length;index++) {
      const row=rows[index];let sum=0;
      if(row.valid)for(const key of keys){const value=row.values[key] || 0;if(value<=0)continue;const rect=svgNode('rect',{x:left+index*step+step*.15,y:y(sum+value),width:Math.max(2,step*.7),height:Math.max(.5,y(sum)-y(sum+value)),fill:colours[key],rx:3,stroke:'#fff','stroke-width':'1.3'});rect.append(svgNode('title',{},`${row.year} · ${name(key,holdings)} ${currency(value)}`));svg.append(rect);sum+=value;}
      let below=0;for(const key of negatives){const value=row[key];svg.append(svgNode('rect',{x:left+index*step+step*.15,y:y(-below),width:Math.max(2,step*.7),height:y(-below-value)-y(-below),fill:colours[key],rx:3,stroke:'#fff','stroke-width':'1.3'}));below+=value;}
    } else {
      for(const key of keys)svg.append(svgNode('path',{d:pathFor(points(key)),fill:'none',stroke:colours[key],'stroke-width':2.5}));
      for(const key of negatives)svg.append(svgNode('path',{d:pathFor(rows.map((row,index)=>[x(index),y(-row[key])])),fill:'none',stroke:colours[key],'stroke-width':2.5}));
    }
    if(showBaseline)svg.append(svgNode('path',{d:pathFor(baseRows.map((row,index)=>[x(index),y(row.total)])),fill:'none',stroke:'#64758b','stroke-width':2,'stroke-dasharray':'6 5'}));
    if(metric==='income'){const d=pathFor(rows.map((row,index)=>[x(index),y(row.spending)]));svg.append(svgNode('path',{d,fill:'none',stroke:'#fff','stroke-width':5,'stroke-linejoin':'round'}),svgNode('path',{d,fill:'none',stroke:colours.spending,'stroke-width':2.5,'stroke-dasharray':'7 5','stroke-linejoin':'round'}));}
    for(let index=0;index<rows.length;index++) {
      if(index===0 || index===rows.length-1 || (Number(rows[index].year)%(W<600 ? 10 : 5)===0 && index>(W<600 ? 5 : 1) && index<rows.length-(W<600 ? Math.ceil(60/step) : 2)))svg.append(svgNode('text',{x:index===rows.length-1 ? W-right : x(index),y:H-10,'text-anchor':index===rows.length-1 ? 'end' : 'middle',class:'plan-axis'},rows[index].year));
      const hit=svgNode('rect',{x:left+index*step,y:top,width:step,height:plotHeight,fill:'transparent','data-year':rows[index].year,role:'button',tabindex:index===selected ? '0' : '-1','aria-label':`Explore ${rows[index].year}`});svg.append(hit);
    }
    $('plan-year').max=rows.length-1;$('plan-year').value=selected;const yearPicker=$('plan-compare-year');yearPicker.replaceChildren();for(const item of rows){const last=projection.months.filter(month=>month.month.startsWith(item.year)).at(-1);const option=el('option','',`${item.year} · ${ageLabel(last.month,holdings)}`);option.value=item.year;yearPicker.append(option);}yearPicker.value=selectedYear;for(const range of root.querySelectorAll('input[type=range]'))range.style.setProperty('--range-progress',`${Math.max(0,Math.min(100,(Number(range.value)-Number(range.min))/(Number(range.max)-Number(range.min) || 1)*100))}%`);$('plan-selected-year').textContent=yearPicker.selectedOptions[0]?.textContent || selectedYear;
    const row=rows[selected];
    $('plan-detail-label').textContent=`${meta.title} · ${row.year}`;
    $('plan-detail-total').textContent=row.valid ? currency(row.total) : 'Unfunded';
    $('plan-detail-period').textContent=`${meta.balance ? `Balance at ${projection.months.filter(month=>month.month.startsWith(row.year)).at(-1).month}` : `${row.months} months in this calendar year`} · ${real ? 'today’s' : 'future'} pounds · ${ageLabel(projection.months.filter(month=>month.month.startsWith(row.year)).at(-1).month,holdings)}`;
    const detail=$('plan-detail-values');detail.replaceChildren();if(metric==='income')detail.append(el('dt','inspector-group','Income & funding'));
    for(const key of keys)if(key!=='netWorth' && row.values[key]>0)detail.append(el('dt','',name(key,holdings)),el('dd','',currency(row.values[key])));
    if(metric==='assets'||metric==='netWorth'){const end=projection.months.filter(month=>month.month.startsWith(row.year)).at(-1),divisor=real ? end.deflator : 1;detail.append(el('dt','','Total assets'),el('dd','',currency(end.assetsTotal/divisor)),el('dt','','Debt remaining'),el('dd','',currency(end.debtsTotal/divisor)));}
    if(metric==='income')detail.append(el('dt','inspector-group','Spending'),el('dt','','Household & scheduled costs'),el('dd','',currency(row.householdSpending)),el('dt','','Debt payments'),el('dd','',currency(row.debtPayment)));
    if(metric==='saving')for(const key of negatives)if(row[key]>0)detail.append(el('dt','',name(key,holdings)),el('dd','',currency(row[key])));
    if(row.cashInterestGross>0)detail.append(el('dt','','Cash interest earned'),el('dd','',currency(row.cashInterestGross)),el('dt','','Est. interest tax (from cash)'),el('dd','',currency(row.cashInterestTax)));
    if(row.unfunded>0)detail.append(el('dt','','Unfunded spending'),el('dd','',currency(row.unfunded)));
    else if(!detail.children.length)detail.append(el('dt','',metric==='debts' ? 'No modelled debt remains in this year.' : 'No recorded amounts in this year.'));
    $('plan-gap').hidden=!projection.firstUnfundedMonth;
    $('plan-gap').textContent=`Funding gaps start ${projection.firstUnfundedMonth}. Balances remain visible, including pensions before access. Unmet spending in ${row.year}: ${currency(row.unfunded)}. Earlier gaps are not assumed to be settled by later income; unpaid debt installments remain in the debt balance.`;
    const funding=$('plan-withdrawal-detail');funding.replaceChildren();funding.hidden=!row.withdrawals.length;
    if(row.withdrawals.length) {
      funding.append(el('h3','',`Where withdrawals come from · ${row.year}`));const table=el('table');
      const header=el('tr');for(const title of ['Source','From assets','Est. tax','For spending'])header.append(el('th','',title));table.append(header);
      for(const draw of row.withdrawals){const line=el('tr');line.append(el('td','',`${name(draw.owner,holdings)} · ${labels[draw.bucket] || draw.bucket}`),el('td','',currency(draw.gross)),el('td','',currency(draw.tax)),el('td','',currency(draw.net)));table.append(line);}funding.append(table);
    }
    renderComparison(holdings);
    $('plan-events').replaceChildren();
    const events=Object.entries(projection.retirementDates).filter(([,date])=>date).map(([owner,date])=>({year:date.slice(0,4),label:`${name(owner,holdings)} work ends ${date.slice(0,4)}`}));
    if(getInputs().flow.includeLinkedMortgage && getInputs().holdings.debts.some(item=>item.kind==='mortgage' && item.balance>0)) {
      const payoff=projection.months.find(item=>item.debtsByType && item.debtsByType.mortgage===0);
      if(payoff)events.push({year:payoff.month.slice(0,4),label:`Mortgage paid ${payoff.month.slice(0,4)}`});
    }
    for(const [owner,pension] of Object.entries(projection.statePensions))events.push({year:pension.startMonth.slice(0,4),label:`${name(owner,holdings)} State Pension ${pension.startMonth.slice(0,4)}`});
    if(scenario.oneOff?.amount>0 && scenario.oneOff.month)events.push({year:scenario.oneOff.month.slice(0,4),label:`One-off cost ${scenario.oneOff.month.slice(0,4)}`});
    if(projection.firstUnfundedMonth)events.push({year:projection.firstUnfundedMonth.slice(0,4),label:`Cash gap ${projection.firstUnfundedMonth.slice(0,4)}`});
    if(projection.stressTest?.month)events.push({year:projection.stressTest.month.slice(0,4),label:`Investment shock ${projection.stressTest.month.slice(0,4)}`});
    for(const event of events.filter(event=>rows.some(row=>row.year===event.year))) {const button=el('button','',event.label);button.type='button';button.setAttribute('aria-pressed',String(event.year===selectedYear));button.addEventListener('click',()=>{selectedYear=event.year;renderChart(holdings);});$('plan-events').append(button);}
    document.dispatchEvent(new Event('picture-updated'));
  }
  const monthLabel=month=>new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  function renderReadiness(flow,holdings) {
    const owners=holdings.partnerName ? ['primary','partner'] : ['primary'];
    const budget=summarizeMonthlyFlow(flow,holdings).spendingTotal;
    const checks=[
      ['People',owners.map(owner=>`${name(owner,holdings)}${Number.isFinite(owner==='primary' ? holdings.age : holdings.partnerAge) ? `, ${owner==='primary' ? holdings.age : holdings.partnerAge}` : ' · age missing'}`).join(' / ')],
      ['Assets & debt',`${holdings.assets.length} asset${holdings.assets.length===1?'':'s'} · ${holdings.debts.length} debt${holdings.debts.length===1?'':'s'}. Check balances, ownership and repayments.`],
      ['Spending',budget>0 ? `${currency(budget)} in ${monthLabel(flow.asOfMonth)}, including active entries and linked payments.` : `No spending entered for ${monthLabel(flow.asOfMonth)}. Check whether this is intentional.`],
      ['Pay & pension income','Check amounts, start/end dates and whether each figure is before or after tax.'],
      ['Pension access',holdings.assets.some(asset=>asset.kind==='dc-pension' && !asset.pensionAccessAge)?`${holdings.assets.filter(asset=>asset.kind==='dc-pension' && !asset.pensionAccessAge).length} pension pots without a recorded access age.`:holdings.assets.some(asset=>asset.kind==='dc-pension')?'Access ages recorded for all pension pots.':'No pension pots entered.']
    ];
    $('plan-readiness').replaceChildren(...checks.map(([title,text])=>{const item=el('li');item.append(el('strong','',title),el('span','',text));return item;}));
  }
  function renderRetirementSnapshot(holdings) {
    const owners=holdings.partnerName ? ['primary','partner'] : ['primary'];
    const dates=owners.map(owner=>({owner,date:projection.retirementDates[owner]})).filter(item=>item.date && item.date>=projection.startMonth && item.date<projection.endMonth).sort((a,b)=>a.date.localeCompare(b.date));
    const month=dates.length ? projection.months.find(item=>item.month>dates[0].date) : null;
    const panel=$('plan-retirement-snapshot');panel.replaceChildren();panel.hidden=!month;
    if(!month)return;
    const divisor=real ? month.deflator : 1;
    const heading=el('div','plan-snapshot-heading');heading.append(el('h3','',`${name(dates[0].owner,holdings)}’s first month after work · ${monthLabel(month.month)}`),el('span','',real ? 'Today’s money' : 'Future pounds'));panel.append(heading);
    const figures=el('dl','plan-funding-figures');
    for(const [label,amount] of [['Spending',month.spendingTotal],['Household income',month.incomeTotal],['Savings withdrawn',month.withdrawalNet],...(month.remainder>0 ? [['Saved after spending',month.remainder]] : []),...(month.unfunded>0 ? [['Unmet spending',month.unfunded]] : [])])figures.append(el('dt','',label),el('dd',label==='Unmet spending' && amount>0 ? 'coverage-gap' : label==='Spending' ? 'inspector-outflow' : 'inspector-inflow',currency(amount/divisor)));
    panel.append(figures);
  }
  function renderOutcome(year,holdings) {
    const current=summarizeCoverage(baseline,{real}),value=summarizeCoverage(projection,{real});
    const output=$('plan-comparison'),wasOpen=$('plan-baseline-comparison')?.open;output.replaceChildren();
    const caption=el('div',`plan-comparison-caption ${value.covered ? 'is-covered' : 'is-gap'}`);
    caption.title='Illustration under your entered assumptions';
    caption.append(el('strong',value.covered ? '' : 'coverage-gap',value.covered ? (Object.values(value.endAges).length ? `✓ Covered to age ${Math.min(...Object.values(value.endAges))}` : '✓ Spending covered') : `Gap from ${monthLabel(value.firstGap.month)}`),el('small','',value.covered ? `to ${monthLabel(value.endMonth)} · under assumptions` : `${currency(value.firstGap.amount)} unmet spending · under assumptions`));output.append(caption);
    const comparison=el('details','plan-baseline-comparison');comparison.id='plan-baseline-comparison';comparison.open=Boolean(wasOpen);comparison.append(el('summary','','Compare plan'));output.append(comparison);
    const figures=el('div','plan-comparison-figures');
    for(const [label,result] of [['Current plan',current],['Your scenario',value]]) {
      const box=el('div'),status=result.covered ? 'Covered' : `Gap from ${new Date(`${result.firstGap.month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}`;
      box.append(el('span','',label),el('strong',result.covered ? '' : 'coverage-gap',status),el('small','',result.covered ? `To ${ageLabel(result.endMonth,holdings,true,label==='Current plan' ? baseline : projection)}` : ageLabel(result.firstGap.month,holdings,false,label==='Current plan' ? baseline : projection)));figures.append(box);
    }
    const available=el('div');available.append(el('span','',`Accessible investments · ${monthLabel(value.endMonth)}`),el('strong','',currency(value.accessibleAtEnd)),el('small','',Math.round(value.accessibleAtEnd)===Math.round(current.accessibleAtEnd) ? `${real ? 'Today’s money' : 'Future value'} · before withdrawal tax` : `Current plan ${currency(current.accessibleAtEnd)} · before withdrawal tax`));figures.append(available);comparison.append(figures);
    const note=el('details','plan-coverage-note');note.append(el('summary','','What counts?'),el('p','',`End ages: ${ageLabel(value.endMonth,holdings,true)}. Coverage includes recorded spending and included debt payments under these assumptions. Accessible assets are closing investments before withdrawal tax, in ${real ? 'today’s money' : 'future pounds'}. Property, possessions, unconfirmed shares and pensions before access are excluded.`));comparison.append(note);
    if(value.unmodelledDebt>0)output.append(el('p','plan-gap',`${currency(value.unmodelledDebt)} of debt has no modelled repayments. Add payment details before relying on spending coverage.`));
    if(value.firstGap)comparison.append(el('p','plan-gap',`First unmet spending: ${currency(value.firstGap.amount)} in ${new Date(`${value.firstGap.month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}. Later income does not erase an earlier shortfall.`));
    const horizon=planHorizon(holdings,scenario);if(horizon.missingOwners.length)output.append(el('p','plan-gap','An age is missing. The horizon uses known ages, or 30 years if none are recorded. Add ages in People or Ages & pensions.'));
    const owners=holdings.partnerName ? ['primary','partner'] : ['primary'];
    const timing=owners.map(owner=>{const date=projection.retirementDates[owner],age=date ? agesAt(projection,date)[owner] : null;return {owner,date,age};});
    const first=timing[0];
    document.getElementById('planning-title').textContent=first.date && Number.isFinite(first.age) ? `What if ${name(first.owner,holdings)} retires at ${first.age}?` : 'How could your retirement look?';
    $('plan-question-detail').textContent=timing.filter(item=>item.date).map(item=>`${name(item.owner,holdings)}’s final pay: ${monthLabel(item.date)}${Number.isFinite(item.age) ? ` (about ${item.age})` : ''}`).join(' · ') || 'Explore when you stop work and what you spend.';
    const {flow}=getInputs(),budget=Object.values(flow.spending).reduce((sum,amount)=>sum+amount,0)+(flow.customSpending || []).reduce((sum,item)=>sum+item.amount,0);
    const assumptions=$('plan-key-assumptions');assumptions.replaceChildren();
    assumptions.append(el('span','',`Base budget ${currency(budget)}/month`),el('span','',`Inflation ${projection.assumptions.inflation}%`),el('span','',`Pension growth ${projection.assumptions.growth.pension}%`),el('span','',real ? 'In today’s spending power' : 'Includes future inflation'));
    const edit=el('button','plan-text-button','Review assumptions');edit.type='button';edit.addEventListener('click',()=>revealControl(growthPanel));assumptions.append(edit);
    const liveResult=value.covered ? 'Spending covered under these assumptions' : `First gap: ${monthLabel(value.firstGap.month)}`;
    if($('plan-live-result').textContent!==liveResult)$('plan-live-result').textContent=liveResult;
    $('plan-funding-order').querySelector('summary').textContent=`Funding order · ${WITHDRAWAL_ORDERS[scenario.withdrawalOrder || 'generalFirst'].map(key=>labels[key]).join(' → ')}`;
    const stress=projection.stressTest,stressText=stress ? stress.month ? `Stress applied ${monthLabel(stress.month)} · ${currency(stress.loss)} investment-value drop` : stress.scheduledMonth ? `Stress scheduled ${monthLabel(stress.scheduledMonth)} · outside this illustration` : 'Set a final-pay date to apply the stress test' : '';
    $('plan-stress-test').checked=Boolean(stress);$('plan-stress-status').textContent=stressText;$('plan-stress-status').hidden=!stress;$('plan-stress-badge').textContent=stressText;$('plan-stress-badge').hidden=!stress;
    renderRetirementSnapshot(holdings);
    const changes=[];
    for(const owner of holdings.partnerName ? ['primary','partner'] : ['primary'])if(scenario.retirementYears?.[owner]!=null && scenario.retirementYears[owner]!==Number(getInputs().flow.pay[owner].endDate?.slice(0,4)))changes.push(`${name(owner,holdings)} final working year: ${scenario.retirementYears[owner]}`);
    if(scenario.retirementStress)changes.push('Stress test: −20% investment shock at first retirement');
    if(scenario.mortgagePayoffNow)changes.push(`Mortgage paid at start · ${scenario.mortgagePayoffSource==='cashShares' ? 'cash and shares, preserving ISA' : 'selected withdrawal order'}`);
    if(scenario.mortgageRate!=null)changes.push(`Mortgage rate: ${scenario.mortgageRate}%`);
    if(scenario.mortgageTermYears!=null)changes.push(`Mortgage term: ${scenario.mortgageTermYears} years`);
    if(scenario.savingsDestination==='general')changes.push('Future surplus: general account only');
    for(const change of scenario.spendingChanges || [])if(change.percent!==100)changes.push(`Household budget from ${change.year}: ${Math.round(change.percent*10)/10}% of now`);
    for(const key of ['inflation','incomeGrowth'])if(scenario[key]!=null && scenario[key]!==baselineOptions[key])changes.push(`${key==='inflation' ? 'Inflation' : 'Pay and rent growth'}: ${scenario[key]}%`);
    for(const [key,value] of Object.entries(scenario.growth || {}))if(value!==baselineOptions.growth[key])changes.push(`${labels[key] || key} growth: ${value}%`);
    for(const [key,title] of [['statePensionAge','State Pension age'],['pensionAccessAge','Personal pension access age'],['openingGainPercent','Unknown cost: assumed gain share']])if(scenario[key]!=null)changes.push(`${title}: ${scenario[key]}${key==='openingGainPercent' ? '%' : ''}`);
    if(scenario.futureNI===false)changes.push('No future qualifying NI years assumed');
    if(scenario.statePensionUprating===false)changes.push('State Pension held at nominal value');
    if(scenario.withdrawalOrder && scenario.withdrawalOrder!=='generalFirst')changes.push(`Shortfall funding: ${WITHDRAWAL_ORDERS[scenario.withdrawalOrder].map(key=>labels[key]).join(' → ')}`);
    if(scenario.oneOff?.amount>0)changes.push(`One-off cost: ${currency(scenario.oneOff.amount)} in ${scenario.oneOff.month}`);
    if(scenario.taxFreeRemaining)changes.push('Remaining pension tax-free allowance changed');
    if(scenario.ages)changes.push('Scenario ages changed');
    if(scenario.planToAge!==95)changes.push(`Plan to age ${scenario.planToAge}`);
    if(scenario.debtPayments)changes.push('Other debt repayments changed');
    const list=$('plan-changes-list');list.replaceChildren(...(changes.length ? changes : ['No changes yet. Adjust a scenario to compare it with your current plan.']).map(text=>el('li','',text)));
    $('plan-changes').hidden=!changes.length;$('plan-reset').hidden=!changes.length;
    $('plan-changes').querySelector('summary').textContent=`What changed?${changes.length ? ` (${changes.length})` : ''}`;
  }
  function syncControls() {
    controlsKey='';buildControls(getInputs().flow,getInputs().holdings);
    for(const [id,key] of [['plan-future-ni','futureNI'],['plan-state-uprating','statePensionUprating']])$(id).checked=scenario[key]!==false;
    $('plan-stress-test').checked=Boolean(scenario.retirementStress);
    $('plan-savings-destination').value=scenario.savingsDestination || 'existing';$('plan-withdrawal-order').value=scenario.withdrawalOrder || 'generalFirst';
    $('plan-cost').value=scenario.oneOff?.amount || '';$('plan-cost-month').value=scenario.oneOff?.month || '';
  }
  function renderComparison(holdings) {
    const output=$('plan-compare-results');output.replaceChildren();const cards=el('div','withdrawal-comparison-grid');
    const comparisonInputs=getInputs(),cacheKey=JSON.stringify([comparisonInputs.flow,holdings,scenario]);if(cacheKey!==comparisonCacheKey){comparisonCacheKey=cacheKey;comparisonCache=new Map(Object.keys(WITHDRAWAL_ORDERS).map(key=>[key,key===(scenario.withdrawalOrder || 'generalFirst')?projection:projectPlan(comparisonInputs.flow,holdings,{...scenario,withdrawalOrder:key})]));}
    for(const [key,order] of Object.entries(WITHDRAWAL_ORDERS)) {
      const candidate=comparisonCache.get(key);
      const last=candidate.months.at(-1),divisor=real ? last.deflator : 1,tax=candidate.months.reduce((sum,month)=>sum+(month.withdrawalTax+month.cashInterestTax)/(real ? month.deflator : 1),0);
      const card=el('section','withdrawal-comparison-card');if(key===(scenario.withdrawalOrder || 'generalFirst')){card.classList.add('is-selected');card.append(el('span','comparison-selected','Selected order'));}
      card.append(el('h3','',order.map(item=>labels[item]).join(' → ')),el('p',candidate.firstUnfundedMonth ? 'comparison-gap' : 'comparison-covered',candidate.firstUnfundedMonth ? `First gap · ${monthLabel(candidate.firstUnfundedMonth)}` : 'All spending covered · under assumptions'));
      const figures=el('dl');for(const [label,value] of [[`Net worth · ${candidate.endMonth.slice(0,4)}`,currency((last.assetsTotal-last.debtsTotal)/divisor)],['Interest & withdrawal tax',currency(tax)]])figures.append(el('dt','',label),el('dd','',value));card.append(figures);cards.append(card);
    }
    const basis=el('details','comparison-basis');basis.append(el('summary','','What the comparison includes'),el('p','',`${real ? 'Today’s' : 'Future'} pounds; net worth includes property and pension pots. Spending coverage requires no earlier funding gaps. Same scenario and return assumptions, different eligible account orders; tax estimates are not a lifetime optimum.`));output.append(cards,basis);
  }

  function refresh() {
    const {flow,holdings,mode}=getInputs();buildControls(flow,holdings);
    const sourceKey=JSON.stringify([holdings,flow.pay,flow.income,flow.spending,flow.customSpending,flow.datedEntries,flow.statePensions,flow.includeLinkedRent,flow.includeLinkedMortgage]);
    const reviewKey=startingPictureKey(holdings,flow);
    if(!confirmedKey && cachedReviewKey()===reviewKey)confirmedKey=reviewKey;
    $('plan-source-text').textContent=`From ${new Date(`${flow.timelineStartMonth || flow.asOfMonth}-01T12:00:00`).toLocaleDateString('en-GB',{month:'short',year:'numeric'})}`;
    $('plan-comparison').hidden=(mode!=='example' || restoredNeedsReview) && confirmedKey!==reviewKey;
    const needsConfirmation=(mode!=='example' || restoredNeedsReview) && confirmedKey!==reviewKey;
    $('plan-confirm').hidden=!needsConfirmation;$('plan-workspace').hidden=needsConfirmation;root.querySelector('.plan-adjust-row').hidden=needsConfirmation;
    $('plan-key-assumptions').hidden=needsConfirmation;
    root.querySelector('.plan-timing-note').hidden=needsConfirmation;
    $('plan-context').textContent=mode==='example' ? `Fictional example · ${holdings.name}${holdings.partnerName ? ` & ${holdings.partnerName}` : ''}` : 'Your household · illustration';
    if(needsConfirmation){renderReadiness(flow,holdings);document.getElementById('planning-title').textContent='Your retirement picture';$('plan-question-detail').textContent='A few checks now make the illustration more useful.';}
    $('plan-confirm-button').onclick=()=>{confirmedKey=reviewKey;rememberReviewKey(reviewKey);restoredNeedsReview=false;refresh();document.dispatchEvent(new Event('picture-updated'));};
    $('plan-export-calculations').disabled=needsConfirmation || !projection;
    if(needsConfirmation){outcomes.update(false);return;}
    for(const [id,key] of rateControls) {
      const input=document.getElementById(id),value=key==='inflation' ? scenario.inflation ?? flow.assumptions.annualInflation ?? PLANNING_DEFAULTS.inflation : key==='incomeGrowth' ? scenario.incomeGrowth ?? flow.assumptions.incomeGrowthRate ?? PLANNING_DEFAULTS.incomeGrowth : scenario.growth?.[key] ?? flow.assumptions.assetGrowthRates?.[key] ?? PLANNING_DEFAULTS.growth[key];
      input.min=Math.min(Number(input.min),value);input.max=Math.max(Number(input.max),value);input.value=value;input.closest('label').querySelector('output').textContent=`${value}%`;input.closest('label').querySelector('.plan-exact').value=value;
    }
    try {
      if(sourceKey!==baselineKey){baselineKey=sourceKey;baselineOptions={inflation:flow.assumptions.annualInflation ?? PLANNING_DEFAULTS.inflation,incomeGrowth:flow.assumptions.incomeGrowthRate ?? PLANNING_DEFAULTS.incomeGrowth,growth:Object.fromEntries(Object.keys(PLANNING_DEFAULTS.growth).map(key=>[key,flow.assumptions.assetGrowthRates?.[key] ?? PLANNING_DEFAULTS.growth[key]]))};history=[];lastSnapshot=null;}
      scenario.years=planHorizon(holdings,scenario).years;
      baseline=projectPlan(flow,holdings,{...baselineOptions,years:scenario.years});
      projection=projectPlan(flow,holdings,scenario);$('plan-export-calculations').disabled=false;outcomes.update(true);
      const snapshot=JSON.stringify(scenario);
      if(lastSnapshot && snapshot!==lastSnapshot){if(lastHistoryGroup!==editGroup){history.push(lastSnapshot);if(history.length>40)history.shift();lastHistoryGroup=editGroup;}}
      lastSnapshot=snapshot;$('plan-undo').disabled=!history.length;$('plan-undo').hidden=!history.length;$('plan-error').hidden=true;
      if(!selectedYear || !projection.months.some(month=>month.month.startsWith(selectedYear))){const retirement=Object.values(projection.retirementDates).filter(date=>date>=projection.startMonth && date<projection.endMonth).sort()[0];selectedYear=(retirement || projection.startMonth).slice(0,4);}
      for(const owner of ['primary','partner']){const input=$(`plan-retire-${owner}`);if(!input)continue;input.closest('label').querySelector('output').textContent=input.dataset.retirementBasis==='age' ? `Age ${input.value}` : 'Final year';$(`plan-retirement-date-${owner}`).textContent=projection.retirementDates[owner] ? `Final pay: ${monthLabel(projection.retirementDates[owner])}` : 'Set the expected pay end month in Income & spending.';}
      const baseHousehold=Object.values(flow.spending).reduce((sum,value)=>sum+value,0)+(flow.customSpending || []).reduce((sum,item)=>sum+item.amount,0);
      $('plan-spending-budget').textContent=`Now: ${currency(baseHousehold)}/month · today’s money`;
      const realPay=((1+projection.assumptions.incomeGrowth/100)/(1+projection.assumptions.inflation/100)-1)*100;
      $('plan-real-growth').textContent=`Pay/rent: ${projection.assumptions.incomeGrowth}% nominal → ${Math.abs(realPay)<.005 ? 0 : realPay.toFixed(1)}% real at ${projection.assumptions.inflation}% inflation, before tax. Tax thresholds stay fixed.`;
      if($('plan-payoff-summary')){
        const payoff=projection.mortgagePayoff,box=$('plan-payoff-summary');box.replaceChildren();
        if(payoff){const list=el('dl','plan-payoff-figures');for(const [label,value] of [...payoff.items.map(item=>[item.label,item.gross]),['Estimated tax',payoff.tax],['Mortgage repaid',payoff.paid],['Debt remaining',payoff.remaining]])list.append(el('dt','',label),el('dd','',currency(value)));box.append(list,el('span','','Repaid capital reduces assets and debt equally. Tax reduces net worth.'));}
        else box.textContent='Choose a funding source, then switch on repayment to see the breakdown.';
      }
      $('plan-state-summary').replaceChildren();
      for(const [owner,pension] of Object.entries(projection.statePensions))$('plan-state-summary').append(el('p','plan-control-help',`${name(owner,holdings)}: ${pension.qualifyingYears} recorded + ${pension.futureYears} assumed NI years; ${pension.totalYears} used. ${currency(pension.annualGross)}/year in today’s terms from ${pension.startMonth} (${pension.mode==='official' ? 'entered forecast' : 'simplified 35-year estimate'}).`));
      renderChart(holdings);
      const method=$('plan-method-body');method.replaceChildren();
      const end=projection.months.at(-1);
      const methodNotes=[`Opening assets ${currency(projection.opening.assetsTotal)}; opening debt ${currency(projection.opening.debtsTotal)}. Monthly calculations run from ${projection.startMonth} to ${projection.endMonth}.`, 'Pay and rent rise with the pay-growth assumption; spending and dated future costs rise with inflation. State Pension keeps pace with inflation unless switched off; this is an assumption rather than a triple-lock forecast. Other fixed pension receipts stay nominal. Household spending changes affect regular categories; debt, one-off and separately scheduled costs retain their own schedules. Today’s pounds discount future values using the inflation slider.', 'Growth is compounded monthly before new deposits. Investment fees are not deducted. Cash return is treated as taxable interest; estimated interest tax is reserved from cash monthly. Other investment growth is capital appreciation, not dividend income. DC pension contributions stop with pay. Spending gaps use the selected account order, with pension access tested separately for each person. Income charts distinguish asset withdrawals from recurring income.', `Saving destination: ${scenario.savingsDestination==='general' ? 'all future surplus to general accounts, keeping the existing owner split' : 'existing cash → own ISA → general order when enabled; otherwise cash'}. ISA allowance resets in April, without splitting the month at 6 April. Existing ISA subscriptions are counted in the opening tax year; the entered allowance is held constant in future years.`, 'Mortgage rates and payment terms stay constant unless changed here. Dividend tax, pension contribution limits and rental income tax are not calculated. Drawdown tax is an annualised estimate using recorded pay/pension income and the State Pension input’s other taxable income. Pension withdrawals use up to 25% tax-free with the entered remaining lump-sum allowance. General-account realised gains use 18% / 24% bands based on annualised current income and interest after the £3,000 annual allowance; new deposits track their cost, while the opening gain percentage is assumed. Cash interest uses the Personal Allowance, savings starting rate and Personal Savings Allowance across all cash accounts per person; joint interest is split equally. These monthly estimates annualise current income and interest, rather than reconcile the full tax year. Income changes and later pension withdrawals can change the actual tax due. Current tax rates and thresholds are held fixed for all future years. No other gains/losses or pension protections are modelled. Any balance remaining at the mortgage term is paid in its final month. Other debt balances use the repayment and rate entered in the planning debt controls. Excluded mortgages and debts without repayment details stay unchanged. Balances continue through funding gaps, including inaccessible pensions. Unmet household spending is reported separately, not assumed borrowed or paid later. Debt servicing is funded first; any unpaid installment remains in the debt balance. Mortgage payoff now uses the selected opening assets. Cash + shares preserves ISAs and pensions, and explicitly permits sale of needs-sale shares for this payoff only. Standard CGT applies to assumed gains; employee-scheme relief, employment tax and lender charges are excluded. Partial repayment leaves the remainder outstanding.', 'State Pension starts at the selected scenario age, or a later recorded start month. The simplified estimate uses NI years/35 with a ten-year minimum and assumed future qualifying years while working. Records before 2016 can differ: a GOV.UK forecast is preferable. Ages imply an approximate birth month matching the opening month; these are not verified eligibility dates.', ...projection.warnings, `End of period: ${end.assetsTotal===null ? 'unavailable' : `${currency(end.assetsTotal)} assets and ${currency(end.debtsTotal)} debt before inflation adjustment`}.`];
      const addTopic=(title,notes)=>{const topic=el('details','plan-method-topic');topic.append(el('summary','',title));for(const text of notes){for(const paragraph of text.split(/(?<=\.) (?=[A-Z])/))topic.append(el('p','',paragraph));}method.append(topic);return topic;};
      addTopic('Starting & closing figures',[methodNotes[0],methodNotes.at(-1)]);
      addTopic('Income, spending & inflation',[methodNotes[1]]);
      addTopic('Investment growth & funding',[methodNotes[2],projection.stressTest ? projection.stressTest.month ? `Selected stress: a 20% investment-value drop in ${monthLabel(projection.stressTest.month)} before growth and withdrawals. Cash, property and fixed pension income are excluded.` : 'Stress selected but not applied within this horizon; check its timing in Growth & inflation.' : 'The main chart uses constant growth assumptions. Outcome ranges separately vary investment returns when you run the simulation.']);
      addTopic('Saving & ISA allowances',[methodNotes[3]]);
      const mortgageLead='Mortgage rates and payment terms stay constant unless changed here. ',debtSplit=methodNotes[4].indexOf('Any balance remaining');
      addTopic('Tax estimates & exclusions',[methodNotes[4].slice(mortgageLead.length,debtSplit)]);
      addTopic('Mortgages & other debt',[mortgageLead+methodNotes[4].slice(debtSplit)]);
      addTopic('State Pension & access',[methodNotes[5]]);
      if(projection.warnings.length)addTopic(`Checks & exclusions (${projection.warnings.length})`,projection.warnings);
      const sources=el('p');sources.innerHTML='Pay tax uses the existing <a href="https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027" target="_blank" rel="noopener">2026–27 rules</a>, held constant. <a href="https://www.gov.uk/individual-savings-accounts" target="_blank" rel="noopener">ISA rules</a> and the <a href="https://www.bankofengland.co.uk/monetary-policy" target="_blank" rel="noopener">Bank of England inflation target</a> are context. <a href="https://www.gov.uk/new-state-pension/what-youll-get" target="_blank" rel="noopener">State Pension estimates</a>, <a href="https://www.gov.uk/personal-pensions-your-rights/how-you-can-take-pension" target="_blank" rel="noopener">pension tax</a> and <a href="https://www.gov.uk/capital-gains-tax/rates" target="_blank" rel="noopener">CGT rates</a> use current rules. <a href="https://www.gov.uk/apply-tax-free-interest-on-savings/how-much-is-tax-free" target="_blank" rel="noopener">Savings interest allowances</a> use current rules. Return defaults are illustration inputs, not forecasts.';addTopic('Sources & rules',[]).append(sources);
    } catch(error) {outcomes.update(false);$('plan-error').textContent=error.message;$('plan-error').hidden=false;}
    document.dispatchEvent(new Event('picture-updated'));
  }
  root.addEventListener('click',event=>{const button=event.target.closest('[data-metric],[data-group],[data-style]');if(!button)return;if(button.dataset.metric)metric=button.dataset.metric;if(button.dataset.group)group=button.dataset.group;if(button.dataset.style)style=button.dataset.style;renderChart(getInputs().holdings);});
  root.addEventListener('click',event=>{const button=event.target.closest('[data-money]');if(button){real=button.dataset.money==='real';renderChart(getInputs().holdings);}});
  function showChartTooltip(year,event) {
    const row=chartRows.find(item=>item.year===year);if(!row)return;
    const tip=$('plan-chart-tooltip');tip.replaceChildren(el('strong','',`${year} · ${real ? 'today’s money' : 'future value'}`));
    const list=el('dl');
    for(const key of chartKeys){const value=row.values[key] ?? row[key] ?? 0;if(value<=0)continue;const label=el('dt'),swatch=el('i');swatch.style.background=colours[key];label.append(swatch,document.createTextNode(name(key,getInputs().holdings)));list.append(label,el('dd','',currency(value)));}
    const reference=chartBaselineRows.find(item=>item.year===year);if(showBaseline && reference)list.append(el('dt','','Current plan'),el('dd','',currency(reference.total)),el('dt','','Difference'),el('dd','',currency(row.total-reference.total)));
    if(metric==='income')list.append(el('dt','','Spending'),el('dd','',currency(row.spending)));
    if(row.unfunded>0 && !chartKeys.includes('unfunded'))list.append(el('dt','','Unfunded'),el('dd','',currency(row.unfunded)));
    tip.append(el('p','',ageLabel(projection.months.filter(month=>month.month.startsWith(year)).at(-1).month,getInputs().holdings)),list);tip.hidden=false;
    const box=$('plan-chart').getBoundingClientRect();const x=event.clientX || box.left+box.width/2,y=event.clientY || box.top+20;
    tip.style.left=`${Math.max(10,Math.min(window.innerWidth-tip.offsetWidth-10,x+14))}px`;tip.style.top=`${Math.max(10,Math.min(window.innerHeight-tip.offsetHeight-10,y+16))}px`;
  }
  let chartDrag=false,scrubFrame=0,pendingScrub=null;
  function scrubChart(event){
    const svg=$('plan-chart'),matrix=svg.getScreenCTM();if(!matrix)return;
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse());
    const bars=[...svg.querySelectorAll('[data-year]')],hit=bars.find(node=>local.x>=Number(node.getAttribute('x')) && local.x<Number(node.getAttribute('x'))+Number(node.getAttribute('width')));
    const year=hit?.dataset.year;if(!year)return;pendingScrub={year,clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType};
    if(!scrubFrame)scrubFrame=requestAnimationFrame(()=>{scrubFrame=0;const next=pendingScrub;if(!next)return;if(selectedYear!==next.year){selectedYear=next.year;renderChart(getInputs().holdings);}if(!chartDrag && next.pointerType==='mouse')showChartTooltip(next.year,next);});
  }
  $('plan-chart').addEventListener('pointerdown',event=>{if(event.button!==0)return;chartDrag=true;$('plan-chart').setPointerCapture(event.pointerId);scrubChart(event);});
  $('plan-chart').addEventListener('pointermove',event=>{if(event.pointerType==='mouse' || chartDrag)scrubChart(event);});
  for(const type of ['pointerup','pointercancel'])$('plan-chart').addEventListener(type,event=>{chartDrag=false;if($('plan-chart').hasPointerCapture(event.pointerId))$('plan-chart').releasePointerCapture(event.pointerId);$('plan-chart-tooltip').hidden=true;});
  $('plan-chart').addEventListener('pointerleave',()=>{if(!chartDrag && scrubFrame){cancelAnimationFrame(scrubFrame);scrubFrame=0;pendingScrub=null;}$('plan-chart-tooltip').hidden=true;});
  $('plan-chart').addEventListener('focusin',event=>{const year=event.target.closest('[data-year]')?.dataset.year;if(year){if(selectedYear!==year){selectedYear=year;renderChart(getInputs().holdings);$('plan-chart').querySelector(`[data-year="${year}"]`)?.focus();}showChartTooltip(year,event);}});
  $('plan-chart').addEventListener('focusout',()=>{$('plan-chart-tooltip').hidden=true;});
  $('plan-add-spending').addEventListener('click',()=>{const changes=scenario.spendingChanges ||= [];const year=changes.length ? Math.max(...changes.map(change=>change.year))+5 : Number(getInputs().flow.timelineStartMonth.slice(0,4))+5;changes.push({year,percent:changes.at(-1)?.percent ?? 100});renderSpendingChanges(getInputs().flow);refresh();});
  $('plan-year-mode').addEventListener('click',()=>{const timeline=$('plan-year-mode').getAttribute('aria-expanded')!=='true';$('plan-year-mode').setAttribute('aria-expanded',String(timeline));$('plan-year-mode').textContent=timeline ? 'Year picker' : 'Timeline';$('plan-compare-year').hidden=timeline;$('plan-selected-year').hidden=!timeline;$('plan-year').hidden=!timeline;root.querySelector('.plan-year-control').classList.toggle('is-timeline',timeline);});
  $('plan-compare-year').addEventListener('change',event=>{selectedYear=event.target.value;renderChart(getInputs().holdings);document.dispatchEvent(new Event('picture-updated'));});
  $('plan-metric-select').addEventListener('change',event=>{metric=event.target.value;renderChart(getInputs().holdings);});
  $('plan-year').addEventListener('input',event=>{selectedYear=annualPlanView(projection)[Number(event.target.value)].year;renderChart(getInputs().holdings);});
  $('plan-chart').addEventListener('click',event=>{const year=event.target.closest('[data-year]')?.dataset.year;if(year){selectedYear=year;renderChart(getInputs().holdings);}});
  $('plan-chart').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;event.preventDefault();const rows=annualPlanView(projection);const index=rows.findIndex(row=>row.year===selectedYear);selectedYear=rows[Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowRight' ? 1 : event.key==='ArrowLeft' ? -1 : 0)))].year;renderChart(getInputs().holdings);$("plan-chart").querySelector(`[data-year="${selectedYear}"]`)?.focus();});
  for(const id of ['plan-cost','plan-cost-month'])$(id).addEventListener('change',()=>{const amount=Number($('plan-cost').value);scenario.oneOff=amount ? {amount,month:$('plan-cost-month').value} : null;refresh();});
  $('plan-check-assets').addEventListener('click',()=>document.getElementById('planning-to-assets').click());
  $('plan-check-flow').addEventListener('click',()=>document.getElementById('planning-to-flow').click());
  for(const [id,key] of [['plan-future-ni','futureNI'],['plan-state-uprating','statePensionUprating']])$(id).addEventListener('change',event=>{scenario[key]=event.target.checked;refresh();});
  $('plan-savings-destination').addEventListener('change',event=>{scenario.savingsDestination=event.target.value;refresh();});
  $('plan-withdrawal-order').addEventListener('change',event=>{scenario.withdrawalOrder=event.target.value;refresh();});
  $('plan-adjust').addEventListener('click',()=>{const open=root.classList.toggle('plan-controls-open');$('plan-adjust').setAttribute('aria-expanded',String(open));$('plan-adjust').textContent=open ? 'Done' : 'Adjust scenario';syncSheetSemantics();renderChart(getInputs().holdings);if(open){if(matchMedia('(max-width:767px)').matches)window.scrollTo({top:window.scrollY+$('plan-chart').getBoundingClientRect().top-150,behavior:'instant'});else $('plan-controls').scrollIntoView({block:'nearest'});$('plan-controls').querySelector('input')?.focus({preventScroll:true});}else{$('plan-comparison').scrollIntoView({block:'nearest'});$('plan-adjust').focus({preventScroll:true});}});
  $('plan-undo').addEventListener('click',()=>{if(!history.length)return;scenario=JSON.parse(history.pop());lastSnapshot=JSON.stringify(scenario);lastHistoryGroup=-1;syncControls();refresh();});
  $('plan-reset').addEventListener('click',()=>{editGroup++;scenario={years:scenario.years,planToAge:scenario.planToAge ?? 95,retirementYears:{},mortgageYearsEarlier:0};syncControls();refresh();});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(projection && !root.closest('[hidden]'))renderChart(getInputs().holdings);},100);});
  function workingState(){return structuredClone({scenario,metric,group,style,real,selectedYear,reviewedInputs:confirmedKey,outcomes:outcomes.snapshot()});}
  function snapshot(){return {...workingState(),experiments:structuredClone(experiments)};}
  function restore(value,{review=true}={}){experiments=structuredClone(value?.experiments || []);outcomes.restore(value?.outcomes);savedExperiments.refresh();showBaseline=false;$('plan-show-baseline').checked=false;root.classList.remove('plan-controls-open');syncSheetSemantics();$('plan-adjust').setAttribute('aria-expanded','false');$('plan-adjust').textContent='Adjust scenario';restoredNeedsReview=Boolean(value)&&review;scenario=structuredClone(value?.scenario || {years:30,planToAge:95,retirementYears:{},mortgageYearsEarlier:0});metric=value?.metric || 'income';group=value?.group || 'person';style=value?.style || 'bars';real=value?.real ?? true;selectedYear=value?.selectedYear ?? null;confirmedKey=review?(value?.reviewedInputs||null):confirmedKey;baselineKey='';history=[];lastSnapshot=null;syncControls();refresh();}
  return {refresh,snapshot,restore};
}
