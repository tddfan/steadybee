/** Present-day monthly cash flow. Optional user-directed routing is a single-month illustration, not a forecast. */
import { estimateStatePension, resolveStatePensionInput } from "./state-pension.mjs?v=20261022insights1";
import { employeeNIExempt } from "./planning-tax.mjs?v=20261022insights1";
import { estimateUkTakeHome2026 } from "./uk-pay-estimate.mjs?v=20261022insights1";
import { estimateRepaymentMortgagePayment } from "./mortgage-payment.mjs?v=20261022cashflow2";

export const INCOME_FIELDS = Object.freeze([
  { key: "pensionIncome", label: "Pension income received now" },
  { key: "otherIncome", label: "Other money received" },
]);

export const SPENDING_FIELDS = Object.freeze([
  { key: "everyday", label: "Everyday living" },
  { key: "carPayment", label: "Car payment" },
]);

// 2026–27 overall ISA subscription limit. Recheck when the tax year changes.
export const ISA_ALLOWANCE_2026_27 = 20_000;
export const DEFAULT_RESERVE_MONTHS = 6;

function addMonths(monthStr, count) {
  if (!monthStr || !count) return null;
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 1 + count, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function createBlankMonthlyFlow() {
  return {
    pay: { primary: { annualTakeHome: null, annualGross: 0, annualBonus: 0, employeePension: 0, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "" }, partner: { annualTakeHome: null, annualGross: 0, annualBonus: 0, employeePension: 0, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "" } },
    income: Object.fromEntries(INCOME_FIELDS.map(({ key }) => [key, 0])),
    spending: Object.fromEntries(SPENDING_FIELDS.map(({ key }) => [key, 0])),
    spendingLabels: {},
    customSpending: [],
    asOfMonth: new Date().toISOString().slice(0, 7),
    timelineStartMonth: new Date().toISOString().slice(0, 7),
    datedEntries: [],
    statePensions: { primary: null, partner: null },
    savings: { primaryShare: null },
    includeLinkedRent: false,
    includeLinkedMortgage: true,
    assumptions: {
      annualInflation: null,
      incomeGrowthRate: null,
      assetGrowthRates: { cash: null, isa: null, pension: null, property: null, shares: null },
      cashReserveMonths: null,
      isaAllowance: null,
      isaUsedPrimary: null,
      isaUsedPartner: null,
      allocationEnabled: false,
      tradingLabel: "",
    },
  };
}

export function createExampleMonthlyFlow() {
  return createPublicDemoMonthlyFlow();
}

/** Fictional, moderate-income UK household flow used by public product previews. */
export function createPublicDemoMonthlyFlow() {
  const flow = createBlankMonthlyFlow();
  const [year, month] = flow.asOfMonth.split("-").map(Number);
  const monthLabel = flow.asOfMonth;
  const fiveYearsLater = `${year + 5}-${String(month).padStart(2, "0")}`;
  const completedYear = year - (month < 4 ? 1 : 0);
  flow.pay = {
    primary: { annualTakeHome: null, annualGross: 47_000, annualBonus: 0, employeePension: 0, employeePensionRate: 5, employerPension: 0, employerPensionRate: 5, endDate: `${year + 28}-12` },
    partner: { annualTakeHome: null, annualGross: 34_000, annualBonus: 0, employeePension: 0, employeePensionRate: 4, employerPension: 0, employerPensionRate: 4, endDate: `${year + 30}-12` },
  };
  flow.spending = { everyday: 2_900, carPayment: 250 };
  flow.datedEntries = [{ id: "demo-childcare", side: "spending", label: "Childcare", amount: 550, frequency: "monthly", startMonth: monthLabel, endMonth: fiveYearsLater }];
  flow.statePensions = {
    primary: { qualifyingYears: Math.max(0, completedYear - (year - 21)), contributionStartYear: year - 21, qualifyingYearsEstimated: true, assessmentMonth: monthLabel, startMonth: "", qualifyingUntil: "", mode: "record", weeklyForecast: null, otherTaxableIncome: 0 },
    partner: { qualifyingYears: Math.max(0, completedYear - (year - 19)), contributionStartYear: year - 19, qualifyingYearsEstimated: true, assessmentMonth: monthLabel, startMonth: "", qualifyingUntil: "", mode: "record", weeklyForecast: null, otherTaxableIncome: 0 },
  };
  flow.includeLinkedMortgage = true;
  flow.assumptions.allocationEnabled = true;
  flow.assumptions.tradingLabel = "General investment account";
  return flow;
}

function pennies(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001)
    throw new RangeError(`${label} must be an amount from £0 to £100,000,000, with at most two decimal places.`);
  return Math.round(value * 100);
}

const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
function summarizeDatedEntries(flow, sources, uses) {
  const asOfMonth = flow.asOfMonth;
  if (!validMonth(asOfMonth)) throw new RangeError("The snapshot month must be a valid month and year.");
  if (!Array.isArray(flow.datedEntries)) throw new RangeError("Dated entries must be a list.");
  const seen = new Set();
  const replaced = new Set();
  const replaceable = new Set([...SPENDING_FIELDS.map(item=>item.key), ...(flow.customSpending || []).map(item=>`custom:${item.id}`)]);
  const phases=flow.datedEntries.filter(entry=>entry?.replacesKey);
  for(let i=0;i<phases.length;i++) for(let j=i+1;j<phases.length;j++) {
    const left=phases[i],right=phases[j];
    if(left.replacesKey === right.replacesKey && (left.startMonth || "0000-01") <= (right.endMonth || "9999-12") && (right.startMonth || "0000-01") <= (left.endMonth || "9999-12")) throw new RangeError("Two spending changes overlap for the same category.");
  }
  return flow.datedEntries.map((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id || seen.has(entry.id)) throw new RangeError("Each dated entry needs a unique ID.");
    seen.add(entry.id);
    if (!["income", "spending"].includes(entry.side)) throw new RangeError("Choose income or spending for a dated entry.");
    if (typeof entry.label !== "string" || !entry.label.trim() || entry.label.length > 80) throw new RangeError("Give each dated entry a name of up to 80 characters.");
    if (!["monthly", "yearly", "once"].includes(entry.frequency)) throw new RangeError("Choose a monthly, yearly, or one-off amount.");
    if ((entry.startMonth && !validMonth(entry.startMonth)) || (entry.endMonth && !validMonth(entry.endMonth)) ||
        (entry.startMonth && entry.endMonth && entry.startMonth > entry.endMonth))
      throw new RangeError("Enter valid start and end months, with the end no earlier than the start.");
    if (entry.frequency === "once" && (!entry.startMonth || entry.endMonth)) throw new RangeError("A one-off entry needs an occurrence month and no end month.");
    if(entry.replacesKey && (entry.side !== "spending" || entry.frequency !== "monthly" || !replaceable.has(entry.replacesKey))) throw new RangeError("A spending change must replace a recorded monthly category.");
    const amountPence = pennies(entry.amount, "Dated amount");
    const monthlyAmount = (entry.frequency === "yearly" ? Math.round(amountPence / 12) : amountPence) / 100;
    const status = entry.startMonth && entry.startMonth > asOfMonth ? "future"
      : ((entry.frequency === "once" && entry.startMonth < asOfMonth) || (entry.endMonth && entry.endMonth < asOfMonth)) ? "ended"
      : "active";
    const detail = { ...entry, monthlyAmount, status };
    if(status === "active" && entry.replacesKey) {
      if(replaced.has(entry.replacesKey)) throw new RangeError("Two spending changes overlap for the same category in this month.");
      replaced.add(entry.replacesKey);
      const index = uses.findIndex(item=>item.key === entry.replacesKey); if(index >= 0) uses.splice(index,1);
    }
    if (status === "active" && monthlyAmount > 0) {
      (entry.side === "income" ? sources : uses).push({ key: `entry:${entry.id}`, label: entry.label.trim(), amount: monthlyAmount, kind: entry.side === "income" ? "datedIncome" : "datedSpending" });
    }
    return detail;
  });
}

export function summarizeMonthlyFlow(flow, holdings = {}, names = {}) {
  const { assets = [], debts = [] } = holdings;
  for (const [label, rate] of [["Annual inflation", flow.assumptions?.annualInflation], ["Income growth", flow.assumptions?.incomeGrowthRate], ...Object.entries(flow.assumptions?.assetGrowthRates || {}).map(([kind, value]) => [`${kind} growth`, value])]) {
    if (rate !== null && rate !== undefined && (typeof rate !== "number" || !Number.isFinite(rate) || rate < -30 || rate > 30))
      throw new RangeError(`${label} assumption must be from -30% to 30%.`);
  }
  const sources = [];
  const uses = [];
  const payDetails = [];
  const timelineStartMonth = flow.timelineStartMonth || flow.asOfMonth;
  for (const owner of ["primary", "partner"]) {
    const pay = flow.pay[owner];
    const estimate = estimateUkTakeHome2026({ baseSalary: pay.annualGross, bonus: pay.annualBonus, employeePensionAmount: pay.employeePension, employeePensionRate: pay.employeePensionRate, employerPensionAmount: pay.employerPension, employerPensionRate: pay.employerPensionRate, employeeNIExempt: employeeNIExempt(flow,holdings,owner,flow.asOfMonth) });
    if (flow.taxOverrides?.[owner]?.employmentTax !== undefined) {
      estimate.incomeTax = Math.round(flow.taxOverrides[owner].employmentTax * 1200) / 100;
      estimate.takeHome = Math.round((estimate.grossPay-estimate.employeePension-estimate.incomeTax-estimate.employeeNI)*100)/100;
    }
    const enteredTakeHome = pay.annualTakeHome !== null && pay.annualTakeHome !== undefined;
    const annualTakeHome = enteredTakeHome ? pennies(pay.annualTakeHome, "Annual take-home pay") / 100 : estimate.takeHome;
    if (pay.endDate && !/^\d{4}-(0[1-9]|1[0-2])$/.test(pay.endDate)) throw new RangeError("Pay end date must be a valid month and year.");
    const person = names[owner] || (owner === "primary" ? "Your" : "Partner");
    const active = !pay.endDate || flow.asOfMonth <= pay.endDate;
    const monthlyTakeHome = active ? Math.round(annualTakeHome * 100 / 12) / 100 : 0;
    payDetails.push({ owner, person, annualTakeHome, annualGross: estimate.grossPay, annualBonus: pay.annualBonus, employeePension: estimate.employeePension, employerPension: estimate.employerPension, endDate: pay.endDate, active, monthlyTakeHome, enteredTakeHome, estimate });
    if (monthlyTakeHome) sources.push({ key: `${owner}Pay`, label: `${person}'s ${enteredTakeHome ? "pay received" : "estimated take-home pay"}`, amount: monthlyTakeHome, kind: "income" });
  }
  for (const { key, label } of INCOME_FIELDS) {
    const amount = pennies(flow.income[key], label);
    if (!amount) continue;
    sources.push({ key, label, amount: amount / 100, kind: "income" });
  }
  const linkedRents = assets.filter((asset) => ["home", "other-property"].includes(asset.kind) && asset.monthlyRent !== undefined)
    .map((asset) => ({ id: asset.id, label: asset.label?.trim() || (asset.kind === "home" ? "Home" : "Other property"), amount: pennies(asset.monthlyRent, "Monthly rent") / 100 }));
  if (flow.includeLinkedRent) {
    for (const rent of linkedRents) if (rent.amount > 0)
      sources.push({ key: `rent:${rent.id}`, label: `${rent.label} rent`, amount: rent.amount, kind: "rent" });
  }
  for (const { key, label } of SPENDING_FIELDS) {
    const amount = pennies(flow.spending[key], label);
    const displayLabel = flow.spendingLabels?.[key]?.trim() || label;
    if (displayLabel.length > 48) throw new RangeError("Spending category names must be 48 characters or fewer.");
    if (amount) uses.push({ key, label: displayLabel, amount: amount / 100, kind: "spending" });
  }
  const customSpending = flow.customSpending || [];
  if (!Array.isArray(customSpending)) throw new RangeError("Custom spending categories must be a list.");
  const spendingIds = new Set();
  for (const category of customSpending) {
    if (!category || typeof category.id !== "string" || !category.id || spendingIds.has(category.id)) throw new RangeError("Each custom spending category needs a unique ID.");
    spendingIds.add(category.id);
    if (typeof category.label !== "string" || !category.label.trim() || category.label.trim().length > 48) throw new RangeError("Give each spending category a name of up to 48 characters.");
    const amount = pennies(category.amount, `Monthly ${category.label.trim()}`);
    if (amount) uses.push({ key: `custom:${category.id}`, label: category.label.trim(), amount: amount / 100, kind: "spending" });
  }
  const linkedMortgages = debts.filter((debt) => debt.kind === "mortgage")
    .map((debt) => {
      const entered = debt.monthlyPayment !== undefined;
      const calculated = entered ? null : estimateRepaymentMortgagePayment({ balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears, mortgageType: debt.mortgageType });
      const endMonth = debt.remainingYears ? addMonths(timelineStartMonth, Math.round(debt.remainingYears * 12)) : null;
      return { id: debt.id, label: debt.label?.trim() || "Mortgage", amount: entered ? pennies(debt.monthlyPayment, "Monthly mortgage payment") / 100 : calculated, estimated: !entered, balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears, endMonth, active: !endMonth || flow.asOfMonth < endMonth };
    }).filter((debt) => debt.amount !== null);
  if (flow.includeLinkedMortgage) {
    for (const mortgage of linkedMortgages) if (mortgage.amount > 0 && mortgage.active)
      uses.push({ key: `mortgage:${mortgage.id}`, label: `${mortgage.label} ${mortgage.estimated ? "estimated " : ""}payment`, amount: mortgage.amount, kind: "mortgage" });
  }
  const statePensionDetails = [];
  for(const owner of ["primary","partner"]) {
    const input=resolveStatePensionInput(flow.statePensions?.[owner], flow, holdings, owner); if(!input) continue;
    const pay=payDetails.find(item=>item.owner === owner);
    const basisMonth=input.startMonth && flow.asOfMonth < input.startMonth ? input.startMonth : flow.asOfMonth;
    const taxablePay=pay && (!pay.endDate || basisMonth <= pay.endDate) ? Math.max(0,pay.annualGross-pay.employeePension) : 0;
    const detail=estimateStatePension(input,input.assessmentMonth || timelineStartMonth,taxablePay);
    if(flow.taxOverrides?.[owner]?.statePensionTax !== undefined && detail.annualGross !== null){detail.annualTax=Math.round(flow.taxOverrides[owner].statePensionTax*1200)/100;detail.monthlyNet=Math.round((detail.annualGross-detail.annualTax)/12*100)/100;}
    detail.owner=owner;detail.person=names[owner] || (owner === "primary" ? "Your" : "Partner");
    detail.active=Boolean(detail.startMonth && flow.asOfMonth >= detail.startMonth && detail.monthlyNet !== null);
    statePensionDetails.push(detail);
    if(detail.active && detail.monthlyNet>0) sources.push({key:`state-pension:${owner}`,label:`${detail.person} State Pension · estimated net`,amount:detail.monthlyNet,kind:"statePension",owner});
  }
  const entryDetails = summarizeDatedEntries(flow, sources, uses);
  const incomePence = sources.reduce((sum, source) => sum + Math.round(source.amount * 100), 0);
  const spendingPence = uses.reduce((sum, use) => sum + Math.round(use.amount * 100), 0);
  const remainderPence = incomePence - spendingPence;
  if (remainderPence > 0) uses.push({ key: "unallocated", label: "Not assigned to spending", amount: remainderPence / 100, kind: "unallocated" });
  if (remainderPence < 0) sources.push({ key: "gap", label: "Amount not covered", amount: -remainderPence / 100, kind: "gap" });
  return {
    sources, uses, linkedRents, linkedMortgages, payDetails, entryDetails, statePensionDetails, asOfMonth: flow.asOfMonth,
    incomeTotal: incomePence / 100,
    spendingTotal: spendingPence / 100,
    remainder: remainderPence / 100,
    chartTotal: Math.max(incomePence, spendingPence) / 100,
    hasEntries: incomePence > 0 || spendingPence > 0,
  };
}

/** Dated changes to the current-money picture; markers are navigation, not a forecast. */
export function monthlyFlowEvents(flow, holdings = {}, names = {}) {
  const start = flow.timelineStartMonth || flow.asOfMonth;
  if (!validMonth(start)) throw new RangeError("The timeline start must be a valid month and year.");
  const events = [{ month: start, label: "Current picture" }];
  const add = (month, label) => { if (month && month >= start) events.push({ month, label }); };
  for (const entry of flow.datedEntries || []) {
    const label = entry.label?.trim() || "Entry";
    add(entry.startMonth, `${label} begins`);
    if (entry.endMonth) add(addMonths(entry.endMonth, 1), `${label} ends`);
    else if (entry.frequency === "once" && entry.startMonth) add(addMonths(entry.startMonth, 1), `${label} ends`);
  }
  for (const owner of ["primary", "partner"]) {
    const pay = flow.pay[owner];
    if(flow.statePensions?.[owner]?.startMonth) add(flow.statePensions[owner].startMonth,`${names[owner] || owner} State Pension begins`);
    if (pay.endDate && (pay.annualGross || pay.annualTakeHome)) add(addMonths(pay.endDate, 1), `${names[owner] || (owner === "primary" ? "Your" : "Partner")} pay ends`);
  }
  for (const debt of holdings.debts || []) {
    if (debt.kind === "mortgage" && debt.remainingYears && flow.includeLinkedMortgage)
      add(addMonths(start, Math.round(debt.remainingYears * 12)), `${debt.label?.trim() || "Mortgage"} payment ends`);
  }
  return events.sort((a, b) => a.month.localeCompare(b.month) || a.label.localeCompare(b.label));
}

/** Reconciled gross-to-destination view. Entered take-home pay stays net because its deductions are unknown. */
export function buildMonthlyFlowDiagram(flow, holdings = {}, names = {}) {
  const summary = summarizeMonthlyFlow(flow, holdings, names);
  const sources = summary.sources.map((item) => ({ ...item }));
  const uses = summary.uses.filter((item) => item.kind !== "unallocated").map((item) => ({ ...item }));
  const payrollPieces = [];
  let payrollEstimated = false;
  for (const detail of summary.payDetails) {
    if (detail.enteredTakeHome || !detail.annualGross) continue;
    const source = sources.find((item) => item.key === `${detail.owner}Pay`);
    if (!source) continue;
    payrollEstimated = true;
    const grossPence = Math.round(detail.annualGross * 100 / 12);
    const netPence = Math.round(detail.monthlyTakeHome * 100);
    const pensionPence = Math.round(detail.employeePension * 100 / 12);
    const niPence = Math.round(detail.estimate.employeeNI * 100 / 12);
    const taxPence = grossPence - netPence - pensionPence - niPence;
    source.label = `${detail.person}'s estimated gross pay`;
    source.amount = grossPence / 100;
    for (const [key, label, amount, kind] of [
      ["TaxNI", "Income Tax & NI", taxPence + niPence, "tax"],
      ["Pension", "employee pension", pensionPence, "pensionContribution"],
    ]) if (amount > 0) payrollPieces.push({ key: `${detail.owner}${key}`, label: `${detail.person} ${label}`, amount: amount / 100, kind });
  }
  const deductions = [
    { key: "householdTaxNI", label: "Income Tax & NI", kind: "tax", amount: payrollPieces.filter((item) => item.kind === "tax").reduce((sum, item) => sum + item.amount, 0) },
    { key: "householdPension", label: "Employee pensions", kind: "pensionContribution", amount: payrollPieces.filter((item) => item.kind === "pensionContribution").reduce((sum, item) => sum + item.amount, 0) },
  ].filter((item) => item.amount > 0);
  const availablePence = Math.max(0, Math.round(summary.remainder * 100));
  const hasPartner = Boolean(names.partner?.trim() || holdings.partnerName?.trim());
  const oneOffIncome = new Set(summary.entryDetails.filter(item=>item.side === "income" && item.frequency === "once").map(item=>`entry:${item.id}`));
  const sharedIncome = summary.sources.filter((item) => !["primaryPay", "partnerPay", "gap"].includes(item.key) && !item.owner && !oneOffIncome.has(item.key)).reduce((sum, item) => sum + item.amount, 0);
  const primaryIncome = summary.payDetails[0].monthlyTakeHome + summary.sources.filter(item=>item.owner === "primary").reduce((sum,item)=>sum+item.amount,0) + sharedIncome / 2;
  const partnerIncome = summary.payDetails[1].monthlyTakeHome + summary.sources.filter(item=>item.owner === "partner").reduce((sum,item)=>sum+item.amount,0) + sharedIncome / 2;
  const enteredShare = flow.savings?.primaryShare;
  if (enteredShare !== null && enteredShare !== undefined && (!Number.isFinite(Number(enteredShare)) || Number(enteredShare) < 0 || Number(enteredShare) > 100)) throw new RangeError("Saving split must be between 0% and 100%.");
  const primaryShare = !hasPartner ? 100 : enteredShare !== null && enteredShare !== undefined ? Number(enteredShare) : primaryIncome + partnerIncome > 0 ? primaryIncome / (primaryIncome + partnerIncome) * 100 : 50;
  const primaryPence = Math.round(availablePence * primaryShare / 100);
  const partnerPence = availablePence - primaryPence;
  if (primaryPence) uses.push({ key: "primarySaving", label: `${names.primary || "Your"} savings`, amount: primaryPence / 100, kind: "saving" });
  if (partnerPence) uses.push({ key: "partnerSaving", label: `${names.partner || "Partner"} savings`, amount: partnerPence / 100, kind: "saving" });
  const netSources = summary.sources.map((item) => ({ ...item }));
  const chartTotal = sources.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
  return {
    ...summary, sources, uses, deductions, netSources, chartTotal, payrollEstimated,
    savingsAvailable: availablePence / 100,
    savingsAssigned: (primaryPence + partnerPence) / 100,
    primaryShare, hasPartner,
  };
}

/** One-month arithmetic for a routing order the user has explicitly chosen. */
export function computeAllocationWaterfall(flow, holdings = {}, names = {}) {
  const summary = summarizeMonthlyFlow(flow, holdings, names);
  const assumptions = flow.assumptions || {};
  const reserveMonths = assumptions.cashReserveMonths ?? DEFAULT_RESERVE_MONTHS;
  if (!Number.isInteger(reserveMonths) || reserveMonths < 1 || reserveMonths > 24) throw new RangeError("Cash reserve target must be from 1 to 24 months.");
  const allowance = assumptions.isaAllowance ?? ISA_ALLOWANCE_2026_27;
  const usedPrimary = assumptions.isaUsedPrimary ?? 0, usedPartner = assumptions.isaUsedPartner ?? 0;
  for (const [label, value] of [["ISA allowance",allowance],["ISA used by primary person",usedPrimary],["ISA used by partner",usedPartner]]) if(pennies(value,label)>10000000) throw new RangeError(`${label} cannot exceed £100,000.`);
  if(usedPrimary>allowance || usedPartner>allowance) throw new RangeError("ISA subscriptions already used cannot exceed the entered annual allowance.");
  const hasPartner=Boolean(names.partner?.trim() || holdings.partnerName?.trim());
  const netByOwner={primary:0,partner:0};
  const oneOffIncome=new Set(summary.entryDetails.filter(item=>item.side === "income" && item.frequency === "once").map(item=>`entry:${item.id}`));
  for(const item of summary.sources.filter(item=>item.kind!=="gap" && !oneOffIncome.has(item.key))) {
    if(item.key === "primaryPay" || item.owner === "primary") netByOwner.primary+=item.amount;
    else if(item.key === "partnerPay" || item.owner === "partner") netByOwner.partner+=item.amount;
    else { netByOwner.primary+=hasPartner ? item.amount/2 : item.amount; if(hasPartner)netByOwner.partner+=item.amount/2; }
  }
  const enteredShare=flow.savings?.primaryShare;
  if(enteredShare !== null && enteredShare !== undefined && (!Number.isFinite(enteredShare) || enteredShare<0 || enteredShare>100)) throw new RangeError("Saving split must be between 0% and 100%.");
  const incomeSum=netByOwner.primary+netByOwner.partner;
  const primaryShare=!hasPartner ? 1 : enteredShare !== null && enteredShare !== undefined ? enteredShare/100 : incomeSum>0 ? netByOwner.primary/incomeSum : .5;
  const oneOffCosts=summary.entryDetails.filter(item=>item.status === "active" && item.side === "spending" && item.frequency === "once").reduce((sum,item)=>sum+Math.round(item.monthlyAmount*100),0);
  const recurringPence=Math.max(0,Math.round(summary.spendingTotal*100)-oneOffCosts);
  const target=recurringPence*reserveMonths, surplus=Math.max(0,Math.round(summary.remainder*100));
  const primaryTarget=Math.round(target*primaryShare), primarySurplus=Math.round(surplus*primaryShare);
  const cash={primary:0,partner:0};
  for(const asset of (holdings.assets || []).filter(asset=>asset.kind === "cash")) {
    const value=pennies(asset.value,"Cash asset value");
    if(asset.owner === "shared") {const first=hasPartner ? Math.round(value*primaryShare) : value;cash.primary+=first;cash.partner+=value-first;}
    else if(asset.owner === "partner" && hasPartner) cash.partner+=value;
    else cash.primary+=value;
  }
  const enabled=assumptions.allocationEnabled === true;
  const label=typeof assumptions.tradingLabel === "string" ? assumptions.tradingLabel.trim() : "";
  if(label.length>60) throw new RangeError("Account label must be no longer than 60 characters.");
  const people=(hasPartner ? ["primary","partner"] : ["primary"]).map(owner=>{
    const first=owner === "primary", reserveTarget=first ? primaryTarget : target-primaryTarget, monthlySaving=first ? primarySurplus : surplus-primarySurplus;
    const gap=Math.max(0,reserveTarget-cash[owner]), headroom=Math.round((allowance-(first ? usedPrimary : usedPartner))*100);
    const toCash=enabled ? Math.min(monthlySaving,gap) : 0, toIsa=enabled ? Math.min(monthlySaving-toCash,headroom) : 0;
    return {owner,person:names[owner] || (first ? holdings.name || "You" : holdings.partnerName || "Partner"),share:(first ? primaryShare : 1-primaryShare)*100,monthlySaving:monthlySaving/100,reserveTarget:reserveTarget/100,currentCash:cash[owner]/100,reserveGap:gap/100,cash:toCash/100,isa:toIsa/100,general:enabled ? (monthlySaving-toCash-toIsa)/100 : 0,isaHeadroom:headroom/100};
  });
  const allocations=[];
  if(enabled && surplus) {
    allocations.push({bucket:"cash-reserve",label:"Cash reserve",monthlyAmount:people.reduce((sum,p)=>sum+Math.round(p.cash*100),0)/100,capacity:people.reduce((sum,p)=>sum+Math.round(p.reserveGap*100),0)/100});
    for(const person of people) allocations.push({bucket:`isa-${person.owner}`,label:`${person.person}'s ISA`,monthlyAmount:person.isa,capacity:person.isaHeadroom});
    allocations.push({bucket:label ? "trading":"unallocated",label:label || "Not yet assigned",monthlyAmount:people.reduce((sum,p)=>sum+Math.round(p.general*100),0)/100,capacity:null});
  }
  return {enabled,surplus:surplus/100,cashTarget:target/100,currentCash:(cash.primary+cash.partner)/100,cashGap:people.reduce((sum,p)=>sum+Math.round(p.reserveGap*100),0)/100,reserveMonths,recurringSpending:recurringPence/100,allowance,usedPrimary,usedPartner,hasPartner,people,primaryShare:primaryShare*100,allocations,summary};
}

/** Monthly approximation from the selected month through March. Deposits only; no asset growth or withdrawals. */
export function projectTaxYearSaving(flow, holdings = {}, names = {}) {
  const [year, month] = flow.asOfMonth.split('-').map(Number);
  const endYear = month >= 4 ? year + 1 : year;
  const endMonth = `${endYear}-03`;
  const workingFlow = structuredClone(flow), workingHoldings = structuredClone(holdings);
  workingHoldings.assets ||= [];
  const months = [], totals = new Map();
  for (let current = flow.asOfMonth; current <= endMonth; current = addMonths(current, 1)) {
    workingFlow.asOfMonth = current;
    const plan = computeAllocationWaterfall(workingFlow, workingHoldings, names);
    months.push({month:current, people:plan.people, shortfall:Math.max(0,-plan.summary.remainder)});
    for (const person of plan.people) {
      if (!totals.has(person.owner)) totals.set(person.owner,{owner:person.owner,person:person.person,cash:0,isa:0,general:0,isaUsed:person.owner === 'primary' ? plan.usedPrimary : plan.usedPartner,isaFilledMonth:null});
      const total=totals.get(person.owner);
      for (const key of ['cash','isa','general']) total[key]=Math.round((total[key]+person[key])*100)/100;
      const usedKey=person.owner === 'primary' ? 'isaUsedPrimary' : 'isaUsedPartner';
      workingFlow.assumptions[usedKey]=Math.round(((workingFlow.assumptions[usedKey] || 0)+person.isa)*100)/100;
      if (!total.isaFilledMonth && person.isa>0 && workingFlow.assumptions[usedKey]>=plan.allowance) total.isaFilledMonth=current;
      workingHoldings.assets.push({kind:'cash',owner:person.owner,value:person.cash});
    }
  }
  return {startMonth:flow.asOfMonth,endMonth,taxYear:`${endYear-1}–${String(endYear).slice(2)}`,months,people:[...totals.values()].map(person=>({...person,isaTotal:Math.round((person.isaUsed+person.isa)*100)/100}))};
}
