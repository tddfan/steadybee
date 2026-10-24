/** Deterministic monthly scenario. Rates are editable illustrations, not forecasts. */
import {TAX_COMPONENTS,taxYearFor,forecastTaxYear} from './planning-tax.mjs?v=20261024persona1';
import { computeAllocationWaterfall } from './monthly-flow.mjs?v=20261024persona1';
import { estimateStatePension, resolveStatePensionInput } from './state-pension.mjs?v=20261024persona1';
import { createWithdrawalState, withdrawForSpending, WITHDRAWAL_ORDERS, eligibleWithdrawalBucket } from './withdrawals.mjs?v=20261024persona1';
import { planHorizon } from './coverage.mjs?v=20261015coverage6';
import { savingsTax, capitalGainsTax } from './investment-tax.mjs?v=20261015coverage6';
import { estimateRepaymentMortgagePayment } from './mortgage-payment.mjs?v=20261022cashflow2';

export const PLANNING_DEFAULTS = Object.freeze({inflation:2,incomeGrowth:2,growth:Object.freeze({cash:2,isa:4,pension:4,property:2,shares:4}),years:30});
const round = value => Math.round(value*100)/100;
const add = (target,key,value) => { target[key]=round((target[key] || 0)+value); };
const monthAt = (start,index) => {const [y,m]=start.split('-').map(Number);return new Date(Date.UTC(y,m-1+index,1)).toISOString().slice(0,7);};
const ownerOf = item => ['primary','partner','shared'].includes(item.owner) ? item.owner : 'primary';
export const assetGroup = kind => ({'dc-pension':'pension',home:'property','other-property':'property',general:'general',shares:'shares',cash:'cash',isa:'isa'}[kind] || 'other');
function rate(value,label) {if(!Number.isFinite(value) || value < -30 || value > 30) throw new RangeError(`${label} must be from -30% to 30%.`);return value;}
function totals(items,valueKey,keyFor) {const result={};for(const item of items)add(result,keyFor(item),item[valueKey]);return result;}
function deposit(assets,owner,kind,value) {
  if(value<=0)return;
  let asset=assets.find(item=>item.kind===kind && ownerOf(item)===owner);
  if(!asset){asset={id:`planning-${owner}-${kind}`,kind,owner,value:0};assets.push(asset);}
  asset.value=round(asset.value+value);
  if(kind==='general')asset.costBasis=round((asset.costBasis || 0)+value);
  return asset;
}

export function projectPlan(flow, holdings, options = {}) {
  const startMonth=flow.timelineStartMonth || flow.asOfMonth;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth))throw new RangeError('Choose a valid opening month.');
  const years=options.planToAge!=null ? planHorizon(holdings,options).years : options.years ?? PLANNING_DEFAULTS.years;
  if(!Number.isInteger(years)||years<1||years>100)throw new RangeError('Choose a horizon from 1 to 100 years.');
  const inflation=rate(options.inflation ?? flow.assumptions?.annualInflation ?? PLANNING_DEFAULTS.inflation,'Inflation');
  const incomeGrowth=rate(options.incomeGrowth ?? flow.assumptions?.incomeGrowthRate ?? PLANNING_DEFAULTS.incomeGrowth,'Pay growth');
  const growth=Object.fromEntries(Object.keys(PLANNING_DEFAULTS.growth).map(key=>[key,rate(options.growth?.[key] ?? flow.assumptions?.assetGrowthRates?.[key] ?? PLANNING_DEFAULTS.growth[key],`${key} growth`)]));
  const investmentReturns=options.investmentReturns;
  if(investmentReturns!=null){
    if(typeof investmentReturns!=='object' || Array.isArray(investmentReturns))throw new RangeError('Investment returns must be annual paths.');
    for(const [key,values] of Object.entries(investmentReturns))if(!['isa','pension','shares'].includes(key)||!Array.isArray(values)||values.length!==years||values.some(value=>!Number.isFinite(value)||value<=-100))throw new RangeError('Investment return paths need one finite return above −100% for each year.');
  }
  if(options.mortgagePayoffSource!=null && !['automatic','cashShares'].includes(options.mortgagePayoffSource))throw new RangeError('Choose a valid mortgage payoff source.');
  if(options.savingsDestination!=null && !['existing','general'].includes(options.savingsDestination))throw new RangeError('Choose a valid savings destination.');
  if(options.retirementStress!=null && typeof options.retirementStress!=='boolean')throw new RangeError('Retirement stress must be a switch.');
  const earlier=options.mortgageYearsEarlier ?? 0;
  if(options.mortgageTermYears!=null && (!Number.isInteger(options.mortgageTermYears)||options.mortgageTermYears<1||options.mortgageTermYears>50))throw new RangeError('Mortgage repayment term must be from 1 to 50 years.');
  if(!Number.isInteger(earlier)||earlier<0||earlier>10)throw new RangeError('Mortgage term reduction must be from 0 to 10 years.');
  if(options.mortgageRate!=null && (!Number.isFinite(options.mortgageRate)||options.mortgageRate<0||options.mortgageRate>30))throw new RangeError('Mortgage rate must be from 0% to 30%.');
  const oneOff=options.oneOff;
  if(oneOff && (!Number.isFinite(oneOff.amount)||oneOff.amount<0||oneOff.amount>10000000||!/^\d{4}-(0[1-9]|1[0-2])$/.test(oneOff.month)))throw new RangeError('Enter a valid one-off month and an amount up to £10 million.');
  const pensionAccessAge=options.pensionAccessAge ?? 55,statePensionAge=options.statePensionAge ?? 67;
  for(const [label,value,min] of [['Personal pension access age',pensionAccessAge,55],['State Pension scenario age',statePensionAge,67]])if(!Number.isInteger(value)||value<min||value>75)throw new RangeError(`${label} must be from ${min} to 75.`);
  const ages={primary:options.ages?.primary ?? holdings.age,partner:options.ages?.partner ?? holdings.partnerAge};
  for(const age of Object.values(ages))if(age!=null && (!Number.isInteger(age)||age<18||age>120))throw new RangeError('Enter current ages as whole years from 18 to 120.');
  const spendingChanges=structuredClone(options.spendingChanges ?? (options.spendingChange ? [options.spendingChange] : [])).sort((a,b)=>a.year-b.year);
  const seenYears=new Set();
  for(const change of spendingChanges) {
    if(!Number.isInteger(change.year)||change.year<Number(startMonth.slice(0,4))||!Number.isFinite(change.percent)||change.percent<0||change.percent>200)throw new RangeError('Spending changes need a future year and a percentage from 0% to 200%.');
    if(seenYears.has(change.year))throw new RangeError('Use one household spending change per year.');seenYears.add(change.year);
  }
  const source=structuredClone(flow), balances=structuredClone(holdings);
  balances.assets ||= []; balances.debts ||= [];
  for(const owner of ['primary','partner']) {
    const year=options.retirementYears?.[owner];
    if(year!=null) {
      if(!Number.isInteger(year)||year<Number(startMonth.slice(0,4))-1||year>Number(startMonth.slice(0,4))+60)throw new RangeError('Choose a valid final working year.');
      source.pay[owner].endDate=`${year}-${source.pay[owner].endDate?.slice(5) || '12'}`;
    }
  }
  const warnings=['Tax estimates use 2026–27 England/Wales/NI rates and thresholds, held fixed in future years. Recurring pay and State Pension tax use a forecast tax year when their basis is known; pension withdrawals and earned cash interest accumulate across that year. This is not a full tax return. General-account growth is capital appreciation only; dividends, capital losses and rental-income tax are not modelled.'];
  if(Object.values(source.pay).some(pay=>pay.annualTakeHome>0 && !pay.annualGross))warnings.push('Take-home-only pay has no known gross taxable income: tax estimates exclude that pay. Enter gross pay for income-band estimates.');
  const statePensions={};
  source.statePensions ||= {};
  for(const owner of holdings.partnerName ? ['primary','partner'] : ['primary']) {
    const input=resolveStatePensionInput(source.statePensions[owner],source,holdings,owner),age=ages[owner];
    if(!Number.isFinite(age))warnings.push(`${owner==='primary' ? holdings.name || 'Your' : holdings.partnerName} age is missing; personal pension access cannot be assumed.`);
    if(!input || (!Number.isFinite(age) && (!input.startMonth || input.mode==='record'))) {warnings.push('State Pension needs a current age and NI record, or an official forecast and start month.');continue;}
    const eligibility=Number.isFinite(age) ? monthAt(startMonth,Math.max(0,(statePensionAge-age)*12)) : input.startMonth;
    const start=input.startMonth && input.startMonth>eligibility ? input.startMonth : eligibility;
    const employed=(source.pay[owner].annualGross || source.pay[owner].annualTakeHome || 0)>0;
    const until=options.futureNI!==false && input.assumeFutureYears!==false ? input.qualifyingUntil || (employed ? (source.pay[owner].endDate && source.pay[owner].endDate<start ? source.pay[owner].endDate : start) : '') : '';
    const basis={...input,mode:input.mode==='official' ? 'official' : 'simplified',startMonth:start,qualifyingUntil:until};
    const estimate=estimateStatePension(basis,input.assessmentMonth || startMonth);
    statePensions[owner]={...estimate,totalYears:basis.mode==='simplified' ? Math.min(35,estimate.totalYears) : estimate.totalYears,projectedNIYears:estimate.totalYears,approximateAge:age};
    source.statePensions[owner]=basis;
  }
  const retirementEnds=(holdings.partnerName ? ['primary','partner'] : ['primary']).map(owner=>source.pay[owner].endDate).filter(date=>/^\d{4}-(0[1-9]|1[0-2])$/.test(date || '')).sort();
  const stressMonth=retirementEnds.length ? [startMonth,monthAt(retirementEnds[0],1)].sort().at(-1) : null;
  const stressTest=options.retirementStress ? {month:null,scheduledMonth:stressMonth,loss:0,percent:20} : null;
  if(stressTest && !stressMonth)warnings.push('Stress test not applied: no recorded final-pay date. Set a retirement date to test the shock.');
  const withdrawalState=createWithdrawalState(balances.assets,{taxFreeRemaining:options.taxFreeRemaining,openingGainPercent:options.openingGainPercent ?? 100});
  if(balances.assets.some(asset=>asset.kind==='shares' && asset.accessBucket!=='accessible'))warnings.push('Shares marked Check access are excluded. Needs-sale shares are sold only in an explicitly selected cash-and-shares mortgage payoff. Property and possessions are not sold.');
  const mortgageStates=balances.debts.filter(item=>item.kind==='mortgage').map(debt=>{
    const annualRate=options.mortgageRate ?? debt.interestRate;
    const term=options.mortgageTermYears ?? (debt.remainingYears ? Math.max(1/12,debt.remainingYears-earlier) : null);
    const payment=earlier || options.mortgageTermYears!=null || options.mortgageRate!=null ? estimateRepaymentMortgagePayment({balance:debt.balance,annualRate,remainingYears:term ?? undefined,mortgageType:debt.mortgageType}) : debt.monthlyPayment ?? estimateRepaymentMortgagePayment({balance:debt.balance,annualRate,remainingYears:term ?? undefined,mortgageType:debt.mortgageType});
    const modelled=flow.includeLinkedMortgage && payment!=null && annualRate!=null;
    if(!modelled)warnings.push(`${debt.label || 'Mortgage'} balance is held unchanged: include payments and supply a rate and payment/term to model repayment.`);
    return {debt,payment,annualRate,termMonths:term ? Math.round(term*12) : null,modelled};
  });
  const otherDebtStates=balances.debts.filter(item=>item.kind!=='mortgage').map(debt=>{
    const input=options.debtPayments?.[debt.id],annualRate=input?.annualRate ?? debt.interestRate,payment=input?.monthlyPayment;
    if(input && (!Number.isFinite(payment)||payment<0||payment>1000000||!Number.isFinite(annualRate)||annualRate<0||annualRate>100))throw new RangeError('Debt payments need a non-negative monthly amount and rate from 0% to 100%.');
    const modelled=payment!=null && annualRate!=null;
    if(!modelled)warnings.push(`${debt.label || debt.kind} balance is held unchanged until a planning repayment and rate are entered.`);
    return {debt,payment,annualRate,modelled};
  });
  const opening={assetsTotal:round(balances.assets.reduce((sum,item)=>sum+item.value,0)),debtsTotal:round(balances.debts.reduce((sum,item)=>sum+item.balance,0))};
  const initialUsed={primary:flow.assumptions?.isaUsedPrimary ?? 0,partner:flow.assumptions?.isaUsedPartner ?? 0};
  const used={...initialUsed}, months=[];let firstUnfundedMonth=null,cumulativeUnfunded=0;
  let mortgagePayoff=null;
  function annualTaxableFor(summary,current) {
    return Object.fromEntries(['primary','partner'].map(owner=>{
      const pay=summary.payDetails.find(item=>item.owner===owner),pension=summary.statePensionDetails.find(item=>item.owner===owner);
      return [owner,Math.max(0,pay?.active ? pay.annualGross-pay.employeePension : 0)+(pension?.active ? pension.annualGross : 0)+(source.statePensions?.[owner]?.otherTaxableIncome || 0)+(current.income.pensionIncome || 0)*12/(holdings.partnerName ? 2 : 1)];
    }));
  }
  function cashInterestByOwner() {
    const result={primary:0,partner:0};
    for(const asset of balances.assets.filter(item=>item.kind==='cash')) {
      const interest=Math.max(0,round(asset.value*((1+growth.cash/100)**(1/12)-1)));
      const owner=ownerOf(asset);
      if(owner==='shared'){add(result,'primary',round(interest/2));add(result,'partner',round(interest-round(interest/2)));}
      else add(result,owner,interest);
    }
    return result;
  }
  const taxForecasts=new Map();source.hasPartner=Boolean(holdings.partnerName);
  let interestTaxYear=null,yearInterest={primary:0,partner:0};
  const forecastFor=month=>{const year=taxYearFor(month);if(!taxForecasts.has(year))taxForecasts.set(year,forecastTaxYear(source,statePensions,startMonth,year,{incomeGrowth,inflation,statePensionUprating:options.statePensionUprating!==false}));return taxForecasts.get(year);};
  const taxLimitations=[];
  if(Object.values(source.pay).some(pay=>pay.annualTakeHome>0))taxLimitations.push('Tax paid within entered take-home pay is unknown and excluded from the reported tax total.');
  if(source.income.pensionIncome>0)taxLimitations.push('Regular private pension income has no recorded person/gross-net basis; its tax is not included.');
  if(source.income.otherIncome>0 || source.datedEntries.some(item=>item.side==='income') || (source.includeLinkedRent && holdings.assets.some(asset=>asset.monthlyRent>0)))taxLimitations.push('Tax on other income, dated income, dividends and rent is not modelled.');
  if(Object.values(source.statePensions || {}).some(input=>input?.otherTaxableIncome>0))taxLimitations.push('Other taxable income affects tax bands but its own tax is not included.');
  if(!startMonth.endsWith('-04'))taxLimitations.push('Opening tax year: earlier recurring income is assumed at the opening rate. Prior tax paid and earlier interest, withdrawals and gains are unknown.');
  if((holdings.partnerName ? ['primary','partner'] : ['primary']).some(owner=>!Number.isFinite(ages[owner])))taxLimitations.push('NI exemption timing is unknown where age is missing.');
  warnings.push('Pension drawdown and cash-interest tax use cumulative amounts in each April–March tax year, with forecast recurring income. Tax is reserved when the modelled liability increases, rather than predicting future interest. Tax-year boundaries use whole months. NI age inferred from age is approximate; an entered NI exemption month takes precedence.',...taxLimitations);
  for(let index=0;index<years*12;index++) {
    const month=monthAt(startMonth,index), elapsed=index/12, deflator=(1+inflation/100)**((index+1)/12);
    if(interestTaxYear!==taxYearFor(month)){interestTaxYear=taxYearFor(month);yearInterest={primary:0,partner:0};}
    if(stressTest && month===stressMonth){
      for(const asset of balances.assets.filter(item=>['isa','general','shares','dc-pension'].includes(item.kind))){const loss=round(asset.value*.2);asset.value=round(asset.value-loss);stressTest.loss=round(stressTest.loss+loss);}
      stressTest.month=month;
    }
    const incomeFactor=(1+incomeGrowth/100)**elapsed, expenseFactor=(1+inflation/100)**elapsed;
    if(index>0 && month.endsWith('-04')) {used.primary=0;used.partner=0;withdrawalState.gains={primary:0,partner:0};}
    const current=structuredClone(source);current.asOfMonth=month;current.includeLinkedMortgage=false;
    current.assumptions.isaUsedPrimary=used.primary;current.assumptions.isaUsedPartner=used.partner;
    for(const pay of Object.values(current.pay))for(const key of ['annualGross','annualBonus','employeePension','employerPension','annualTakeHome'])if(pay[key]!=null)pay[key]=round(pay[key]*incomeFactor);
    const activeSpending=spendingChanges.filter(change=>change.year<=Number(month.slice(0,4))).at(-1);
    const householdFactor=activeSpending ? activeSpending.percent/100 : 1;
    for(const key of Object.keys(current.spending))current.spending[key]=round(current.spending[key]*expenseFactor*householdFactor);
    current.customSpending=(current.customSpending || []).map(item=>({...item,amount:round(item.amount*expenseFactor*householdFactor)}));
    // Dated future entries are supplied in today's pounds; pensions stay at their entered nominal rate.
    current.datedEntries=(current.datedEntries || []).map(item=>({...item,amount:round(item.amount*(item.side==='spending' ? expenseFactor : incomeFactor))}));
    if(oneOff?.amount>0)current.datedEntries.push({id:'planning-one-off',side:'spending',label:'Scenario one-off cost',amount:round(oneOff.amount*expenseFactor),frequency:'once',startMonth:oneOff.month,endMonth:''});
    for(const [owner,pension] of Object.entries(statePensions))current.statePensions[owner]={...current.statePensions[owner],mode:'official',weeklyForecast:round(pension.annualGross/52*(options.statePensionUprating===false ? 1 : expenseFactor))};
    const taxForecast=forecastFor(month);current.taxOverrides={};
    for(const owner of ['primary','partner']){
      const pay=current.pay[owner],budget=taxForecast[owner];
      if(source.income.pensionIncome || source.statePensions?.[owner]?.otherTaxableIncome)continue;
      const gross=pay.annualGross+pay.annualBonus,employeePension=pay.employeePensionRate ? pay.annualGross*pay.employeePensionRate/100 : pay.employeePension;
      current.taxOverrides[owner]={employmentTax:budget.employment ? round(budget.employmentTax*Math.max(0,gross-employeePension)/12/budget.employment) : 0};
      const pension=current.statePensions[owner];
      if(pension && month>=pension.startMonth)current.taxOverrides[owner].statePensionTax=budget.state ? round(budget.statePensionTax*pension.weeklyForecast*52/12/budget.state) : 0;
    }
    const withdrawalContext={month,taxYearIncome:Object.fromEntries(Object.entries(taxForecast).map(([owner,value])=>[owner,value.taxableIncome])),ages:Object.fromEntries(Object.entries(ages).map(([owner,age])=>[owner,Number.isFinite(age) ? age+elapsed : null])),pensionAccessAge,order:WITHDRAWAL_ORDERS[options.withdrawalOrder || 'generalFirst']};
    let payoffDraw={gross:0,net:0,tax:0,items:[]};
    if(index===0 && options.mortgagePayoffNow) {
      const requested=round(mortgageStates.reduce((sum,state)=>sum+state.debt.balance,0));
      const openingSummary=computeAllocationWaterfall(current,{...balances,age:ages.primary,partnerAge:ages.partner,debts:[]},{primary:holdings.name,partner:holdings.partnerName}).summary;
      const cashShares=options.mortgagePayoffSource==='cashShares';
      const payoffAssets=cashShares ? balances.assets.filter(asset=>asset.kind==='cash'||asset.kind==='shares') : balances.assets;
      payoffDraw=withdrawForSpending(payoffAssets,requested,withdrawalState,{...withdrawalContext,...(cashShares ? {order:WITHDRAWAL_ORDERS.generalFirst,saleAssetIds:payoffAssets.filter(asset=>asset.kind==='shares' && asset.accessBucket==='illiquid').map(asset=>asset.id)} : {}),annualTaxableIncome:annualTaxableFor(openingSummary,current),annualInterest:{...yearInterest}});
      let available=payoffDraw.net;
      for(const state of mortgageStates){const repayment=Math.min(state.debt.balance,available);state.debt.balance=round(state.debt.balance-repayment);available=round(available-repayment);}
      mortgagePayoff={requested,paid:payoffDraw.net,remaining:round(requested-payoffDraw.net),gross:payoffDraw.gross,tax:payoffDraw.tax,items:payoffDraw.items};
    }
    const workingHoldings={...balances,age:ages.primary,partnerAge:ages.partner,assets:balances.assets.map(asset=>asset.monthlyRent!=null ? {...asset,monthlyRent:round(asset.monthlyRent*incomeFactor)} : asset),debts:[]};
    let mortgagePayment=0;const debtInstallments=[];
    for(const state of mortgageStates) {
      if(!state.modelled || state.debt.balance<=0)continue;
      const owed=round(state.debt.balance*(1+state.annualRate/1200));
      const payment=state.termMonths && index===state.termMonths-1 ? owed : Math.min(owed,state.payment);
      state.debt.balance=round(owed-payment);mortgagePayment=round(mortgagePayment+payment);debtInstallments.push({debt:state.debt,payment});
    }
    let otherDebtPayment=0;
    for(const state of otherDebtStates){if(!state.modelled || state.debt.balance<=0)continue;const owed=round(state.debt.balance*(1+state.annualRate/1200)),payment=Math.min(owed,state.payment);state.debt.balance=round(owed-payment);otherDebtPayment=round(otherDebtPayment+payment);debtInstallments.push({debt:state.debt,payment});}
    const debtPayment=round(mortgagePayment+otherDebtPayment);
    current.customSpending.push({id:'planning-mortgage',label:'Debt payments',amount:debtPayment});
    const plan=computeAllocationWaterfall(current,workingHoldings,{primary:holdings.name,partner:holdings.partnerName});
    const summary=plan.summary;
    const incomeByPerson={},incomeByType={};
    for(const item of summary.sources.filter(item=>item.kind!=='gap')) {
      const owner=item.key==='primaryPay' ? 'primary' : item.key==='partnerPay' ? 'partner' : item.owner || 'shared';
      add(incomeByPerson,owner,item.amount);
      const type=item.key.endsWith('Pay') ? 'pay' : item.kind==='statePension' ? 'statePension' : item.kind==='rent' ? 'rent' : item.key==='pensionIncome' ? 'pensionIncome' : 'other';
      add(incomeByType,type,item.amount);
    }
    const interestByOwner=cashInterestByOwner(),annualIncome=annualTaxableFor(summary,current);
    // Both interest and pension draws consume the same person's annual bands.
    // Charge only the change caused by newly earned interest. Pension quotes
    // then use this accrued interest, so their extra tax is not charged twice.
    const interestCapitalTaxByOwner={primary:0,partner:0};
    const interestTaxByOwner=Object.fromEntries(Object.entries(interestByOwner).map(([owner,value])=>{
      const pensionIncome=withdrawalState.incomeTaxYear===interestTaxYear ? withdrawalState.yearTaxable?.[owner] || 0 : 0;
      const base=taxForecast[owner].taxableIncome+pensionIncome,previous=yearInterest[owner];
      yearInterest[owner]=round(previous+value);
      // Later interest may also move this year's earlier realised gains into
      // the higher CGT band. Reserve that adjustment separately from Income Tax.
      const gains=withdrawalState.gains[owner] || 0;
      interestCapitalTaxByOwner[owner]=round(capitalGainsTax(gains,base+yearInterest[owner])-capitalGainsTax(gains,base+previous));
      return [owner,round(savingsTax(base,yearInterest[owner])-savingsTax(base,previous))];
    }));
    const annualInterest={...yearInterest};
    const cashInterestGross=round(Object.values(interestByOwner).reduce((sum,value)=>sum+value,0));
    const cashInterestTax=round(Object.values(interestTaxByOwner).reduce((sum,value)=>sum+value,0));
    const cashCapitalGainsTax=round(Object.values(interestCapitalTaxByOwner).reduce((sum,value)=>sum+value,0));
    // Allocate each person's tax to their own interest-bearing cash accounts.
    // Joint interest and its tax are split equally; round each person's final
    // account as the residual, not the household's final account.
    const cashAssets=balances.assets.filter(item=>item.kind==='cash' && item.value>0),cashTaxByAsset=new Map();
    for(const owner of ['primary','partner']){
      const accounts=cashAssets.filter(asset=>ownerOf(asset)===owner || ownerOf(asset)==='shared');
      const weight=asset=>asset.value/(ownerOf(asset)==='shared' ? 2 : 1),total=accounts.reduce((sum,asset)=>sum+weight(asset),0);
      const liability=round(interestTaxByOwner[owner]+interestCapitalTaxByOwner[owner]);let reserved=0;
      for(const [i,asset] of accounts.entries()){
        const tax=i===accounts.length-1 ? round(liability-reserved) : round(liability*weight(asset)/total);
        reserved=round(reserved+tax);cashTaxByAsset.set(asset,round((cashTaxByAsset.get(asset) || 0)+tax));
      }
    }
    for(const asset of balances.assets) {
      const group=assetGroup(asset.kind), key=group==='general' ? 'shares' : group;
      const annual=investmentReturns?.[key]?.[Math.floor(index/12)] ?? growth[key] ?? 0,openingValue=asset.value;
      asset.value=round(asset.value*(1+annual/100)**(1/12));
      if(group==='cash' && openingValue>0){
        asset.value=round(Math.max(0,asset.value-(cashTaxByAsset.get(asset) || 0)));
      }
    }
    let pensionContributions=0;
    for(const pay of summary.payDetails.filter(item=>item.active)) {
      const contribution=round((pay.employeePension+pay.employerPension)/12);
      deposit(balances.assets,pay.owner,'dc-pension',contribution);pensionContributions=round(pensionContributions+contribution);
    }
    const savingByType={},savingByPerson={};
    if(summary.remainder>0)for(const person of plan.people) {
      const amounts=options.savingsDestination==='general' ? {cash:0,isa:0,general:person.monthlySaving} : plan.enabled ? {cash:person.cash,isa:person.isa,general:person.general} : {cash:person.monthlySaving,isa:0,general:0};
      for(const [kind,amount] of Object.entries(amounts)) {const target=deposit(balances.assets,person.owner,kind,amount);if(kind==='general' && target)withdrawalState.basis[target.id]=round((withdrawalState.basis[target.id] || 0)+amount);add(savingByType,kind,amount);}
      add(savingByPerson,person.owner,person.monthlySaving);used[person.owner]=round(used[person.owner]+amounts.isa);
    }
    const draw=withdrawForSpending(balances.assets,Math.max(0,-summary.remainder),withdrawalState,{...withdrawalContext,annualTaxableIncome:annualIncome,annualInterest});
    const withdrawals=[...payoffDraw.items,...draw.items];
    const withdrawalNet=round(draw.net+payoffDraw.net),withdrawalGross=round(draw.gross+payoffDraw.gross),withdrawalTax=round(draw.tax+payoffDraw.tax);
    const cashDrawn=withdrawals.filter(item=>item.bucket==='cash').reduce((sum,item)=>round(sum+item.net),0),unfunded=draw.unfunded;
    // Debt service is funded first. Unpaid installments stay in the outstanding balance.
    let unpaidDebt=Math.max(0,round(unfunded-(summary.spendingTotal-debtPayment)));
    for(const installment of [...debtInstallments].reverse()){const restored=Math.min(installment.payment,unpaidDebt);installment.debt.balance=round(installment.debt.balance+restored);unpaidDebt=round(unpaidDebt-restored);}
    for(const item of withdrawals) {add(incomeByPerson,item.owner,item.net);add(incomeByType,({cash:'withdrawCash',general:'withdrawGeneral',isa:'withdrawIsa',pension:'withdrawPension'})[item.bucket],item.net);}
    if(unfunded>0 && !firstUnfundedMonth)firstUnfundedMonth=month;
    cumulativeUnfunded=round(cumulativeUnfunded+unfunded);
    const assetsByType=totals(balances.assets,'value',item=>assetGroup(item.kind)),assetsByPerson=totals(balances.assets,'value',ownerOf);
    const debtsByType=totals(balances.debts,'balance',item=>item.kind==='mortgage' ? 'mortgage' : 'otherDebt'),debtsByPerson=totals(balances.debts,'balance',ownerOf);
    const assetsTotal=round(Object.values(assetsByType).reduce((sum,value)=>sum+value,0)),debtsTotal=round(Object.values(debtsByType).reduce((sum,value)=>sum+value,0));
    const closingContext={month,pensionAccessAge,ages:Object.fromEntries(Object.entries(ages).map(([owner,age])=>[owner,Number.isFinite(age) ? age+(index+1)/12 : null]))};
    const withdrawableAssets=round(balances.assets.filter(asset=>eligibleWithdrawalBucket(asset,closingContext)).reduce((sum,asset)=>sum+asset.value,0));
    const lockedPensions=round(balances.assets.filter(asset=>asset.kind==='dc-pension' && !eligibleWithdrawalBucket(asset,closingContext)).reduce((sum,asset)=>sum+asset.value,0));
    const otherAssets=round(assetsTotal-withdrawableAssets-lockedPensions);
    const taxByType=Object.fromEntries(Object.keys(TAX_COMPONENTS).map(key=>[key,0])),taxByPerson={primary:0,partner:0};
    for(const pay of summary.payDetails.filter(item=>item.active && !item.enteredTakeHome)){
      const incomeTax=round(pay.estimate.incomeTax/12),ni=round(pay.estimate.employeeNI/12);
      add(taxByType,'employmentTax',incomeTax);add(taxByType,'employeeNI',ni);add(taxByPerson,pay.owner,incomeTax+ni);
    }
    for(const pension of summary.statePensionDetails.filter(item=>item.active)){const tax=round(pension.annualTax/12);add(taxByType,'statePensionTax',tax);add(taxByPerson,pension.owner,tax);}
    add(taxByType,'savingsInterestTax',cashInterestTax);
    add(taxByType,'capitalGainsTax',cashCapitalGainsTax);
    for(const [owner,value] of Object.entries(interestTaxByOwner))add(taxByPerson,owner,value+interestCapitalTaxByOwner[owner]);
    for(const item of withdrawals){add(taxByType,'capitalGainsTax',item.bucket==='general' ? item.tax : item.capitalTax || 0);if(item.bucket==='pension')add(taxByType,'pensionDrawdownTax',item.pensionTax ?? item.tax);add(taxByPerson,item.owner,item.tax);}
    const taxTotal=round(Object.values(taxByType).reduce((sum,value)=>sum+value,0));
    const estateBalances=options.captureEstateBalances ? {estateAssets:balances.assets.map(({id,kind,owner,label,value})=>({id,kind,owner,label,value})),estateDebts:balances.debts.map(({id,kind,owner,label,balance,linkedAssetId})=>({id,kind,owner,label,balance,linkedAssetId}))} : {};
    months.push({...estateBalances,taxByType,taxByPerson,taxTotal,taxIncomplete:taxLimitations.length>0,month,deflator,withdrawableAssets,lockedPensions,otherAssets,incomeTotal:summary.incomeTotal,spendingTotal:round(summary.spendingTotal+payoffDraw.net),remainder:summary.remainder,householdSpending:round(summary.spendingTotal-debtPayment),cashInterestGross,cashInterestTax,cashCapitalGainsTax,withdrawalNet,withdrawalGross,withdrawalTax,withdrawals,withdrawn:withdrawalNet,incomeByPerson,incomeByType,savingByPerson,savingByType,cashDrawn,unfunded,cumulativeUnfunded,pensionContributions,mortgagePayment,debtPayment:round(debtPayment+payoffDraw.net),assetsTotal,debtsTotal,assetsByType,assetsByPerson,debtsByType,debtsByPerson});
  }
  return {taxLimitations,startMonth,endMonth:months.at(-1).month,stressTest,unmodelledDebt:round([...mortgageStates,...otherDebtStates].filter(state=>!state.modelled).reduce((sum,state)=>sum+state.debt.balance,0)),opening,months,firstUnfundedMonth,mortgagePayoff,spendingChanges,warnings:[...new Set(warnings)],statePensions,pensionAccessAge,statePensionAge,ages,assumptions:{inflation,incomeGrowth,growth,years},retirementDates:Object.fromEntries(Object.entries(source.pay).map(([owner,pay])=>[owner,pay.endDate]))};
}

/** Calendar-year totals for flows; last monthly balance for stocks. Real flows discount each month. */
export function annualPlanView(projection, metric='income', group='person', real=true) {
  const annual=new Map();
  for(const month of projection.months) {
    const year=month.month.slice(0,4);
    if(!annual.has(year))annual.set(year,{year,months:0,values:{},income:0,spending:0,cashDrawn:0,unfunded:0,withdrawn:0,withdrawalTax:0,cashInterestGross:0,cashInterestTax:0,cashCapitalGainsTax:0,householdSpending:0,mortgagePayment:0,debtPayment:0,withdrawals:[],valid:true});
    const row=annual.get(year);row.months++;
    const divisor=real ? month.deflator : 1;
    row.income+=month.incomeTotal/divisor;row.spending+=month.spendingTotal/divisor;row.cashDrawn+=month.cashDrawn/divisor;row.unfunded+=month.unfunded/divisor;
    row.cashInterestGross+=month.cashInterestGross/divisor;row.cashInterestTax+=month.cashInterestTax/divisor;row.cashCapitalGainsTax+=(month.cashCapitalGainsTax || 0)/divisor;row.withdrawn+=month.withdrawalNet/divisor;row.withdrawalTax+=month.withdrawalTax/divisor;row.householdSpending+=month.householdSpending/divisor;row.mortgagePayment+=month.mortgagePayment/divisor;row.debtPayment+=month.debtPayment/divisor;
    for(const item of month.withdrawals) {
      let combined=row.withdrawals.find(value=>value.owner===item.owner && value.bucket===item.bucket);
      if(!combined){combined={owner:item.owner,bucket:item.bucket,gross:0,net:0,tax:0};row.withdrawals.push(combined);}
      for(const key of ['gross','net','tax'])combined[key]+=item[key]/divisor;
    }
    const field=`${metric}By${group==='person' ? 'Person' : 'Type'}`;
    const values=month[field];
    if(metric==='tax') {for(const [key,value] of Object.entries((group==='person' ? month.taxByPerson : month.taxByType) || {}))row.values[key]=(row.values[key] || 0)+value/divisor;}
    else if(metric==='netWorth') {row.values={netWorth:(month.assetsTotal-month.debtsTotal)/divisor};}
    else if(metric==='assets' || metric==='debts') {
      row.valid=values!==null;row.values=values ? Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value/divisor])) : {};
    } else {for(const [key,value] of Object.entries(values || {}))row.values[key]=(row.values[key] || 0)+value/divisor;}
  }
  return [...annual.values()].map(row=>({...row,total:Object.values(row.values).reduce((sum,value)=>sum+value,0)}));
}
