import { retirementDemo, scenarioOverrides, fundingFacts, displayNames, scenarioDefinitions, scenarioInputs } from './retirement-demo.mjs';

const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
const root = document.querySelector('#demo');
if (root) {
  const $ = (id) => document.getElementById(id);
  const put = (id, text) => { if ($(id)) $(id).textContent = text; };
  let overrides = {}, stage = 'situation', mode = 'assets', selectedScenario = null, model = retirementDemo();
  const stages = ['situation', 'choices', 'tracking'];
  const headings = { situation: 'Your money, together.', picture: 'See the years ahead.', choices: 'Explore your retirement plan.', tracking: 'Keep your plan moving.' };
  const setStage = (value, userTriggered = false) => {
    if (!stages.includes(value)) return;
    stage = value; root.dataset.stage = stage;
    root.querySelectorAll('[data-stage]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.stage === stage)));
    root.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== stage; });
    put('step-label', `${stages.indexOf(stage) + 1} of 3`); put('stage-heading', headings[stage]);
    if(stage === 'picture' || stage === 'choices') drawChart();
    put('demo-status', `${headings[stage]}. Step ${stages.indexOf(stage) + 1} of 3.`);
    root.querySelectorAll('[data-step]').forEach((button) => { button.disabled = button.dataset.step === 'prev' ? stage === stages[0] : stage === stages.at(-1); });
    if (userTriggered) { $('stage-heading')?.focus({preventScroll:true}); root.scrollIntoView({behavior:'instant',block:'start'}); }
  };
  function inputsText() {
    const p = model.current.profile;
    return `Alex steps back at ${p.primary.retirementAge}; Jemma at ${p.partner.retirementAge}. Spending ${money(p.monthlySpending)} a month. ${p.partTimeAnnual ? `Alex has ${money(p.partTimeAnnual)} annual part-time income until age ${p.partTimeEndAge}.` : 'No part-time income.'}`;
  }
  function drawChart() {
    let svg = $('demo-chart'); if (!svg) return;
    const ns = 'http://www.w3.org/2000/svg';
    if (svg.namespaceURI !== ns) {
      const container = svg;
      svg = document.createElementNS(ns, 'svg');
      container.replaceChildren(svg);
    }
    const width = Math.max(220, svg.parentElement.clientWidth || 720);
    const left = 60, top = 46, plotW = width - left - 22, plotH = 250, height = 350;
    const current = model.current.rows, baseline = model.baseline.rows;
    const all = [...current, ...baseline];
    const rawMax = Math.max(1, mode === 'assets' ? model.legacyTarget : 0, ...all.map((r) => mode === 'assets' ? r.closingTotal : fundingFacts(r).need));
    const unit = 10 ** Math.floor(Math.log10(rawMax));
    const max = Math.ceil(rawMax / unit) * unit;
    const x = (i) => left + i / (current.length - 1) * plotW;
    const y = (v) => top + plotH - v / max * plotH;
    const path = (rows, get) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(get(r)).toFixed(2)}`).join(' ');
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-labelledby', 'calculated-chart-title calculated-chart-description');
    function node(name, attrs, text) { const n = document.createElementNS(ns, name); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,String(v)); if (text) n.textContent=text; svg.append(n); return n; }
    const title = mode === 'assets' ? 'Money through retirement' : 'Spending and funding';
    const stateStart = model.current.events.find(event => event.type === 'income-start' && event.owner === 'primary' && event.label.includes('State Pension'));
    const retirement = model.current.events.find(event => event.type === 'retirement' && event.owner === 'primary');
    const partnerRetirement = model.current.events.find(event => event.type === 'retirement' && event.owner === 'partner');
    const annotations = [
      retirement && {icon:'icon-sun',year:retirement.year,age:retirement.primaryAge,label:`Retire ${retirement.primaryAge}`,context:`Alex retires at ${retirement.primaryAge} in ${retirement.year}.`},
      stateStart && {icon:'icon-pension',year:stateStart.year,age:stateStart.primaryAge,label:`State Pension ${stateStart.primaryAge}`,context:`Alex’s fictional State Pension starts at ${stateStart.primaryAge} in ${stateStart.year}.`},
      {icon:'icon-plan',year:current.at(-1).year,age:current.at(-1).primaryAge,label:`Age ${current.at(-1).primaryAge}`,context:`Illustration ends at Alex age ${current.at(-1).primaryAge} in ${current.at(-1).year}; this is a modelling horizon, not a lifespan or guarantee.`},
    ].filter(Boolean);
    node('title', {id:'calculated-chart-title'}, title);
    node('desc', {id:'calculated-chart-description'}, `${title}, from Alex age ${current[0].primaryAge} to ${current.at(-1).primaryAge}, in today’s pounds. Dashed line shows the starting example; teal line shows the current scenario. ${mode === 'funding' ? 'Grey shows annual spending; gold shading marks unpaid spending. Earlier gaps remain unpaid even when later years are covered.' : 'Gold markers below the chart identify years with unpaid spending. Closing assets can remain positive despite earlier unpaid spending.'} ${model.legacyTarget > 0 && mode === 'assets' ? `Dotted plum line is the ${money(model.legacyTarget)} end-horizon target, not a withdrawal or reserved asset.` : ''} ${annotations.map(event=>event.context).join(' ')} ${partnerRetirement ? displayNames(partnerRetirement.label) + ` in ${partnerRetirement.year}; Alex is ${partnerRetirement.primaryAge}.` : ''} Use Look at a year for the calculated values.`);
    node('text',{x:0,y:top-13,fill:'#536568','font-size':16},'Today’s £');
    for (let tick=0; tick<=4; tick++) {
      const value=max*tick/4;
      node('line',{x1:left,x2:width-22,y1:y(value),y2:y(value),stroke:'#d7dfda','stroke-width':1});
      node('text',{x:left-8,y:y(value)+5,fill:'#536568','font-size':16,'text-anchor':'end'},new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1}).format(value));
    }
    const tickCount=width < 420 ? 3 : 5;
    for(let tick=0;tick<tickCount;tick++) {
      const index=Math.round(tick/(tickCount-1)*(current.length-1));
      node('text',{x:x(index),y:height-27,fill:'#536568','font-size':16,'text-anchor':'middle'},String(current[index].primaryAge));
    }
    node('text',{x:left+plotW/2,y:height-4,fill:'#536568','font-size':16,'text-anchor':'middle'},'Alex’s age');
    current.forEach((row,i) => {
      if (row.annualGap <= 0) return;
      const barWidth = Math.max(2, plotW / current.length);
      const barX = Math.min(width - 22 - barWidth, Math.max(left, x(i) - barWidth / 2));
      node('rect',{x:barX,y:mode === 'funding' ? y(fundingFacts(row).need) : top + plotH + 4,width:barWidth,height:mode === 'funding' ? Math.max(1,y(fundingFacts(row).covered)-y(fundingFacts(row).need)) : 6,fill:'#dfbe72'});
    });
    if (partnerRetirement) {
      const index=current.findIndex(row=>row.year===partnerRetirement.year);
      if(index>=0) {
        const guide=node('line',{x1:x(index),x2:x(index),y1:top,y2:top+plotH,stroke:'#b5cfc2','stroke-width':1,'stroke-dasharray':'2 5'});
        const title=document.createElementNS(ns,'title');title.textContent=displayNames(partnerRetirement.label);guide.append(title);
      }
    }
    if (mode === 'assets' && model.legacyTarget > 0) {
      node('line', {x1:left,x2:width-22,y1:y(model.legacyTarget),y2:y(model.legacyTarget),stroke:'#79548b','stroke-width':2,'stroke-dasharray':'3 4'});
      node('text', {x:left+8,y:y(model.legacyTarget)-8,fill:'#79548b','font-size':16}, 'Legacy target');
    }
    node('path',{d:path(baseline,r=>mode==='assets'?r.closingTotal:fundingFacts(r).covered),fill:'none',stroke:'#536568','stroke-width':3,'stroke-dasharray':'7 5'});
    if (mode==='funding') node('path',{d:path(current,r=>fundingFacts(r).need),fill:'none',stroke:'#536568','stroke-width':2});
    node('path',{d:path(current,r=>mode==='assets'?r.closingTotal:fundingFacts(r).covered),fill:'none',stroke:'#14665f','stroke-width':4});
    const annotationPoints = annotations.map(event=>{
      const index=current.findIndex(row=>row.year===event.year);
      return {event,index,px:x(index),py:index>=0 ? y(mode==='assets' ? current[index].closingTotal : fundingFacts(current[index]).covered) : 0};
    }).filter(point=>point.index>=0);
    const placedBadges=[];
    const labelBoxes=[];
    const offsets=[[0,0],[0,-36],[0,36],[-36,0],[36,0],[-36,-36],[36,-36],[-36,36],[36,36],[0,-72],[0,72],[-72,0],[72,0]];
    annotationPoints.forEach(point=>{
      const {event,px,py}=point;
      const candidates=offsets.map(([dx,dy])=>({x:Math.max(14,Math.min(width-14,px+dx)),y:Math.max(16,Math.min(top+plotH-18,py+dy))}));
      const position=candidates.find(candidate=>placedBadges.every(other=>Math.hypot(candidate.x-other.x,candidate.y-other.y)>=34)) ?? candidates.at(-1);
      placedBadges.push(position);point.badge=position;
    });
    annotationPoints.forEach(point=>{
      const {event,px,py,badge:position}=point;
      const badgeX=position.x,badgeY=position.y;
      node('line',{x1:px,x2:px,y1:py,y2:top+plotH,stroke:'#b5cfc2','stroke-width':1,'stroke-dasharray':'2 5'});
      node('circle',{cx:px,cy:py,r:2.5,fill:'#14665f'});
      if(Math.hypot(badgeX-px,badgeY-py)>1)node('line',{x1:px,x2:badgeX,y1:py,y2:badgeY,stroke:'#536568','stroke-width':1});
      const badge=node('g',{role:'group','aria-label':event.context});
      const title=document.createElementNS(ns,'title');title.textContent=event.context;badge.append(title);
      const circle=document.createElementNS(ns,'circle');for(const [k,v] of Object.entries({cx:badgeX,cy:badgeY,r:13,fill:'#fff',stroke:'#d7dfda'}))circle.setAttribute(k,v);badge.append(circle);
      const icon=document.createElementNS(ns,'svg');for(const [k,v] of Object.entries({class:'chart-event-icon',x:badgeX-9,y:badgeY-9,width:18,height:18,viewBox:'0 0 32 32',fill:'none',stroke:'#536568','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))icon.setAttribute(k,v);
      const use=document.createElementNS(ns,'use');use.setAttribute('href',`#${event.icon}`);icon.append(use);badge.append(icon);
      const labelCandidates=[[0,-24],[0,30],[30,5],[-30,5],[0,-43],[0,49]].map(([dx,dy])=>({x:Math.max(16,Math.min(width-16,badgeX+dx)),y:Math.max(18,Math.min(top+plotH-2,badgeY+dy))}));
      const labelPosition=labelCandidates.find(label=>{
        const box={left:label.x-12,right:label.x+12,top:label.y-15,bottom:label.y+3};
        const clearBadges=placedBadges.every(other=>{
          const closestX=Math.max(box.left,Math.min(other.x,box.right));
          const closestY=Math.max(box.top,Math.min(other.y,box.bottom));
          return Math.hypot(other.x-closestX,other.y-closestY)>15;
        });
        const clearLabels=labelBoxes.every(other=>box.left>other.right+3 || box.right+3<other.left || box.top>other.bottom+3 || box.bottom+3<other.top);
        return clearBadges && clearLabels;
      }) ?? labelCandidates.at(-1);
      labelBoxes.push({left:labelPosition.x-12,right:labelPosition.x+12,top:labelPosition.y-15,bottom:labelPosition.y+3});
      node('text',{x:labelPosition.x,y:labelPosition.y,fill:'#182e32','font-size':16,'text-anchor':'middle'},String(event.age));
    });
    put('chart-title', title);
    put('chart-caption', 'Today’s pounds. Fixed real growth except any selected one-off market loss; price stress changes real spending. Earlier gaps remain unpaid.');
    const legend=$('chart-legend');if(legend) {
      const unchangedOutlook = stage === 'picture' && Object.keys(overrides).length === 0;
      const lines = unchangedOutlook ? [['current',mode === 'assets' ? 'Money remaining' : 'Spending covered']] : [['original','Original'],['current','What if']];
      const keys = [...(mode === 'assets' && model.legacyTarget > 0 ? [['legacy', 'Legacy target']] : []),...(mode==='funding' ? [['need','Spending']] : []),...lines,...(current.some(row=>row.annualGap>0) ? [['gap','Gap']] : [])];
      legend.replaceChildren(...keys.map(([type,label])=>{ const key=document.createElement('span');key.className='legend-key';const swatch=document.createElement('span');swatch.className=`legend-swatch ${type}`;swatch.setAttribute('aria-hidden','true');key.append(swatch,document.createTextNode(label));return key;}));
    }
    root.querySelectorAll('[data-chart]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.chart===mode)));
  }
  function renderYear() {
    const row = model.current.rows.find(r=>r.year === Number($('year-select')?.value)) || model.current.rows[0];
    const summary=$('year-summary'); if(!summary) return;
    const facts=[['Year / ages',`${row.year} / Alex ${row.primaryAge}, Jemma ${row.partnerAge}`],['Income',money(row.income)],['Spending',money(row.spending)],['Savings withdrawals',money(row.withdrawalsAccessible)],['Pension withdrawals',money(row.withdrawalsPension)],['One-off cost',money(row.majorCost)],['Pension market loss',money(row.pensionMarketLoss ?? 0)],['Cash mortgage payoff',money(row.mortgagePayoff)],['Net home-sale cash',money(row.homeCashReleased)],['Unpaid spending',money(row.annualGap)],['Earlier and current unpaid spending',money(row.cumulativeGap)],['Locked pension money',money(row.closingLockedPension)],['Money remaining',money(row.closingTotal)]];
    const dl=document.createElement('dl');
    for(const [label,value] of facts) { const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd); }
    summary.replaceChildren(dl);
  }
  function announce() {
    put('demo-status', `Example updated. ${model.firstGap ? `First spending gap at Alex age ${model.firstGap.primaryAge}.` : `Spending covered through Alex age ${model.current.profile.horizonAge}.`}`);
  }
  function render(shouldAnnounce = true) {
    try { model = retirementDemo(overrides); } catch (error) { put('demo-error', `${error.message} The graph still shows the last valid calculation.`); $('demo-error').hidden=false; return; }
    if ($('demo-error')) $('demo-error').hidden=true;
    const p = model.current.profile;
    $('monthly-spending').max = selectedScenario === 'save-more' ? model.baseline.profile.monthlySpending : 10000;
    for (const [id,value] of [['retirement-age',p.primary.retirementAge],['partner-age',p.partner.retirementAge],['monthly-spending',p.monthlySpending]]) if ($(id)) $(id).value=value;
    for (const input of $('scenario-fields').querySelectorAll('input')) {
      const value = input.name === 'retirementAge' ? p.primary.retirementAge : input.name === 'partnerRetirementAge' ? p.partner.retirementAge : input.name === 'savingReduction' ? model.baseline.profile.monthlySpending - p.monthlySpending : input.name === 'extraInflationPercent' ? p.extraRealSpendingRate * 100 : input.name === 'legacyTarget' ? model.legacyTarget : p[input.name];
      if (value !== undefined) input.value = value;
    }
    put('retirement-output',p.primary.retirementAge); put('partner-output',p.partner.retirementAge); put('spending-output',money(p.monthlySpending));
    const effect = p.partTimeAnnual
      ? `Alex has ${money(p.partTimeAnnual)} annual net-assumed part-time income from age ${p.primary.retirementAge} until the beginning of age ${p.partTimeEndAge}.`
      : selectedScenario === 'income-stops'
        ? 'Alex permanently stops work now at 57: employment income and pension contributions end immediately.'
        : selectedScenario === 'spend-less'
          ? `Monthly spending falls from ${money(model.baseline.profile.monthlySpending)} to ${money(p.monthlySpending)}: ${money(model.baseline.profile.monthlySpending - p.monthlySpending)} less each month.`
          : p.primary.retirementAge !== model.baseline.profile.primary.retirementAge || p.partner.retirementAge !== model.baseline.profile.partner.retirementAge
            ? `Alex stops work at ${p.primary.retirementAge}; Jemma at ${p.partner.retirementAge}, compared with ${model.baseline.profile.primary.retirementAge} and ${model.baseline.profile.partner.retirementAge} originally. Employment income and contributions end at those dates.`
            : 'Explore a change to compare with the starting example.';
    put('scenario-context', selectedScenario ? scenarioDefinitions[selectedScenario].description : p.partTimeAnnual ? effect : 'DB and State Pension start ages stay fixed.');
    put('result-value',model.firstGap ? `Age ${model.firstGap.primaryAge}` : `Through age ${p.horizonAge}`);
    put('result-label',model.firstGap ? 'First spending gap' : 'Spending covered');
    put('result-context', model.firstGap ? `First gap in ${model.firstGap.year}; earlier gaps remain unpaid.` : 'No spending gap under these example assumptions.');
    const diff = model.finalMoney-model.baseline.summary.finalTotal;
    put('scenario-impact', `${selectedScenario ? scenarioDefinitions[selectedScenario].title + ': ' : Object.keys(overrides).length ? effect + ' ' : ''}${model.firstGap ? `Spending first falls short at Alex age ${model.firstGap.primaryAge} (${model.firstGap.year}): ${money(model.firstGap.annualGap)} unpaid that year. Earlier gaps remain unpaid.` : `Spending is covered through Alex age ${p.horizonAge} under these assumptions.`}`);
    put('comparison-copy', `${diff === 0 ? 'Same money as the original' : `${money(Math.abs(diff))} ${diff<0?'less':'more'} than the original`} at age ${p.horizonAge}. ${money(model.finalMoney)} remaining${model.firstGap ? '; this does not erase unpaid spending' : ''}.`);
    if (model.legacyTarget > 0) {
      const difference = model.finalMoney - model.legacyTarget;
      put('comparison-copy', `${money(model.finalMoney)} remaining at Alex age ${p.horizonAge}: ${money(Math.abs(difference))} ${difference >= 0 ? 'above' : 'below'} your ${money(model.legacyTarget)} target. ${model.firstGap ? 'Unpaid spending means this is not a funded legacy.' : 'Illustrative assets only; inheritance tax and death benefits are not modelled.'}`);
    }
    const pensionTotal = p.primary.pensionPot + p.partner.pensionPot;
    const savingsTotal = p.primary.savings + p.partner.savings;
    const openingTotal = pensionTotal + savingsTotal;
    const base = model.baseline.profile;
    put('household-story', `Alex (${base.primary.age}) and Jemma (${base.partner.age}) are exploring retirement at ${base.primary.retirementAge} and ${base.partner.retirementAge}, with ${money(base.monthlySpending)} monthly household spending.`);
    put('pension-breakdown', `${money(pensionTotal)} · ${Math.round(pensionTotal / openingTotal * 100)}%`);
    put('savings-breakdown', `${money(savingsTotal)} · ${Math.round(savingsTotal / openingTotal * 100)}%`);
    put('current-total',money(openingTotal));put('current-pension',money(pensionTotal));put('current-savings',money(savingsTotal));
    const donut=$('wealth-donut');if(donut) {const percent=pensionTotal/openingTotal*100;donut.style.background=`conic-gradient(#14665f 0% ${percent}%, #b5cfc2 ${percent}% 100%)`;donut.setAttribute('aria-label',`Opening financial assets ${money(openingTotal)}: pension pots ${money(pensionTotal)}; savings ${money(savingsTotal)}.`);}
    put('current-caption','Pensions and savings only; other values aren’t entered.');
    const inputDetails = `${inputsText()} Opening pension pots: Alex ${money(p.primary.pensionPot)}, Jemma ${money(p.partner.pensionPot)}. Opening accessible savings: Alex ${money(p.primary.savings)}, Jemma ${money(p.partner.savings)}. Annual employment income while working: Alex ${money(p.primary.employmentAnnualNet)}, Jemma ${money(p.partner.employmentAnnualNet)}. Monthly pension contributions while working: Alex ${money(p.primary.monthlyContributions)}, Jemma ${money(p.partner.monthlyContributions)}.`;
    put('input-summary',inputDetails);
    root.querySelectorAll('[data-scenario]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scenario===selectedScenario)));
    const incomeText = p.incomeStreams.map(stream => `${displayNames(stream.label)}: ${money(stream.annualNet)} annual net-assumed income, starts at ${stream.owner === 'primary' ? 'Alex' : 'Jemma'} age ${stream.startAge}${stream.endAge === null ? ', no end age supplied' : `, ends at age ${stream.endAge}`}.`).join(' ');
    const assumptionRows = [
      ['Work and spending', inputsText()],
      ['Opening pension pots', `Alex ${money(p.primary.pensionPot)}; Jemma ${money(p.partner.pensionPot)}.`],
      ['Opening accessible savings', `Alex ${money(p.primary.savings)}; Jemma ${money(p.partner.savings)}.`],
      ['Employment income', `Annual net-assumed income: Alex ${money(p.primary.employmentAnnualNet)}; Jemma ${money(p.partner.employmentAnnualNet)}. Ends at each person’s work-end age.`],
      ['Pension contributions', `Monthly while working: Alex ${money(p.primary.monthlyContributions)}; Jemma ${money(p.partner.monthlyContributions)}.`],
      ['Pension access', `Alex age ${p.primary.pensionAccessAge}; Jemma age ${p.partner.pensionAccessAge}. Authored example dates.`],
      ['Fixed real growth', `Savings ${p.realAccessibleReturn * 100}% a year; pension pots ${p.realPensionReturn * 100}% a year. Authored assumptions, not forecasts.`],
      ['DB and State Pension income', incomeText],
      ['Purchasing power and tax', 'Today’s pounds. Income is assumed spendable; UK tax is not calculated.'],
      ['Scenario assumptions', selectedScenario ? scenarioDefinitions[selectedScenario].description : 'Original fictional household unless adjusted.'],
      ['Extra real spending growth', `${p.extraRealSpendingRate * 100}% per year from year two.`],
      ['Market loss', `${p.pensionLossPercent}% of pension pots once at Alex age ${p.pensionLossAge}.`],
      ['Planning horizon', `Alex age ${p.horizonAge}. A modelling endpoint, not a lifespan or guarantee.`],
    ];
    const assumptions = $('assumption-inputs');
    if (assumptions) {
      const dl = document.createElement('dl'); dl.className = 'assumptions-table';
      for (const [label, value] of assumptionRows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; dl.append(dt, dd); }
      assumptions.replaceChildren(dl);
    }
    put('fixture-source',`Source: existing mixed-household fictional ledger, version ${model.current.provenance.fixtureVersion}, source date ${model.current.provenance.sourceDate}. Alex (57) is Morgan and Jemma (55) is Sam in the underlying fixture. Display aliases only; original fixture inputs are retained. Selected overrides and stress assumptions are calculated by model ${model.current.provenance.modelVersion}.`);
    const list=$('assumption-list'); if(list) { list.replaceChildren(...model.assumptions.map(text=>{const li=document.createElement('li');li.textContent=text;return li;})); }
    const select=$('year-select'); if(select) { const value=select.value; select.replaceChildren(...model.current.rows.map(row=>{const option=document.createElement('option');option.value=row.year;option.textContent=`${row.year} — Alex ${row.primaryAge}, Jemma ${row.partnerAge}`;return option;})); if(value) select.value=value; if(!select.value) select.selectedIndex=0; }
    put('choice-status','No scenario kept yet. Kept for this visit only.'); put('review-choice','No scenario chosen for this visit.');
    drawChart();renderYear();if(shouldAnnounce) announce();
  }
  root.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>setStage(b.dataset.stage,true)));
  root.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>setStage(stages[Math.max(0,Math.min(stages.length-1,stages.indexOf(stage)+(b.dataset.step==='next'?1:-1)))],true)));
  const shortcuts = $('scenario-shortcuts');
  for (const [id, definition] of Object.entries(scenarioDefinitions)) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.scenario = id; button.dataset.group = definition.group; button.setAttribute('aria-pressed','false');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(icon.namespaceURI, 'use'); use.setAttribute('href', `#icon-${definition.icon}`); icon.append(use);
    button.append(icon, document.createTextNode(definition.title)); shortcuts.append(button);
    button.addEventListener('click', () => {
      selectedScenario = id; mode = 'assets'; overrides = {...scenarioOverrides[id]};
      const editor = $('scenario-editor'); editor.hidden = false;
      put('scenario-editor-title', definition.title); put('scenario-editor-note', definition.description);
      const fields = $('scenario-fields'); fields.replaceChildren();
      for (const [key, label, value, min, max, step] of definition.fields) {
        const wrapper = document.createElement('div'); wrapper.className = 'scenario-field';
        const caption = document.createElement('label'); caption.htmlFor = `scenario-${key}`; caption.textContent = label;
        const input = document.createElement('input'); input.id = `scenario-${key}`; input.name = key; input.type = 'number'; input.value = value; input.min = min; input.max = max; input.step = step; input.required = true;
        wrapper.append(caption, input); fields.append(wrapper);
      }
      render();
    });
  }
  $('scenario-editor').addEventListener('submit', event => {
    event.preventDefault(); if (!selectedScenario) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    overrides = {...overrides, ...scenarioInputs(selectedScenario, Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Number(value)])))};
    render();
  });
  for(const [id,key] of [['retirement-age','retirementAge'],['partner-age','partnerRetirementAge'],['monthly-spending','monthlySpending']]) $(id)?.addEventListener('input',()=>{overrides[key]=Number($(id).value);if(overrides.partTimeAnnual && key === 'retirementAge') overrides.partTimeEndAge=Math.max(65,(overrides.retirementAge??60)+3);render(false);});
  $('reset-demo')?.addEventListener('click',()=>{selectedScenario=null;mode='assets';overrides={};$('scenario-editor').hidden=true;render();});
  for(const id of ['retirement-age','partner-age','monthly-spending']) $(id)?.addEventListener('change',announce);
  window.addEventListener('resize',drawChart);
  root.querySelectorAll('[data-chart]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.chart;drawChart();}));
  root.querySelectorAll('[data-open-scenario]').forEach(button => button.addEventListener('click', () => { setStage('choices', true); root.querySelector(`[data-scenario="${button.dataset.openScenario}"]`).click(); $('scenario-editor-title').scrollIntoView({block:'center',behavior:'instant'}); $('scenario-fields').querySelector('input')?.focus({preventScroll:true}); }));
  $('tracking-nav').addEventListener('click', event => { event.preventDefault(); setStage('tracking', true); });
  $('year-select')?.addEventListener('change',renderYear);
  $('keep-scenario')?.addEventListener('click',()=>{const text=`Chosen for this visit: ${inputsText()} This records an illustrative choice in this page only; no financial action has taken place.`;put('choice-status',text);put('review-choice',text);put('demo-status','Scenario chosen for this visit.');});
  setStage(stage);render();
}
