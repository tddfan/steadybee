/** Present-day monthly cash flow. Optional user-directed routing is a single-month illustration, not a forecast. */
import { estimateUkTakeHome2026 } from "./uk-pay-estimate.mjs";
import { estimateRepaymentMortgagePayment } from "./mortgage-payment.mjs";

export const INCOME_FIELDS = Object.freeze([
  { key: "pensionIncome", label: "Pension income received now" },
  { key: "otherIncome", label: "Other money received" },
]);

export const SPENDING_FIELDS = Object.freeze([
  { key: "homeBills", label: "Home running costs & bills" },
  { key: "everyday", label: "Everyday living" },
  { key: "transport", label: "Transport" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "other", label: "Other spending" },
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
    savings: { primaryShare: null },
    includeLinkedRent: false,
    includeLinkedMortgage: false,
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
  return {
    pay: { primary: { annualTakeHome: null, annualGross: 146500, annualBonus: 50000, employeePension: 0, employeePensionRate: 7, employerPension: 0, employerPensionRate: 16, endDate: "2045-12" }, partner: { annualTakeHome: null, annualGross: 125000, annualBonus: 0, employeePension: 25000, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "2043-12" } },
    income: { pensionIncome: 0, otherIncome: 0 },
    spending: { homeBills: 400, everyday: 1500, transport: 350, lifestyle: 900, other: 4000 },
    spendingLabels: {},
    customSpending: [],
    asOfMonth: new Date().toISOString().slice(0, 7),
    timelineStartMonth: new Date().toISOString().slice(0, 7),
    datedEntries: [
      { id: "school-fees-1", side: "spending", label: "School fees (current)", amount: 20000, frequency: "yearly", startMonth: new Date().toISOString().slice(0, 7), endMonth: addMonths(new Date().toISOString().slice(0, 7), 24) },
      { id: "school-fees-2", side: "spending", label: "School fees (senior)", amount: 30000, frequency: "yearly", startMonth: addMonths(new Date().toISOString().slice(0, 7), 25), endMonth: addMonths(new Date().toISOString().slice(0, 7), 84) },
    ],
    savings: { primaryShare: null },
    includeLinkedRent: true,
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
    const amountPence = pennies(entry.amount, "Dated amount");
    const monthlyAmount = (entry.frequency === "yearly" ? Math.round(amountPence / 12) : amountPence) / 100;
    const status = entry.startMonth && entry.startMonth > asOfMonth ? "future"
      : ((entry.frequency === "once" && entry.startMonth < asOfMonth) || (entry.endMonth && entry.endMonth < asOfMonth)) ? "ended"
      : "active";
    const detail = { ...entry, monthlyAmount, status };
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
    const estimate = estimateUkTakeHome2026({ baseSalary: pay.annualGross, bonus: pay.annualBonus, employeePensionAmount: pay.employeePension, employeePensionRate: pay.employeePensionRate, employerPensionAmount: pay.employerPension, employerPensionRate: pay.employerPensionRate });
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
      const calculated = entered ? null : estimateRepaymentMortgagePayment({ balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears });
      const endMonth = debt.remainingYears ? addMonths(timelineStartMonth, Math.round(debt.remainingYears * 12)) : null;
      return { id: debt.id, label: debt.label?.trim() || "Mortgage", amount: entered ? pennies(debt.monthlyPayment, "Monthly mortgage payment") / 100 : calculated, estimated: !entered, balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears, endMonth, active: !endMonth || flow.asOfMonth < endMonth };
    }).filter((debt) => debt.amount !== null);
  if (flow.includeLinkedMortgage) {
    for (const mortgage of linkedMortgages) if (mortgage.amount > 0 && mortgage.active)
      uses.push({ key: `mortgage:${mortgage.id}`, label: `${mortgage.label} ${mortgage.estimated ? "estimated " : ""}payment`, amount: mortgage.amount, kind: "mortgage" });
  }
  const entryDetails = summarizeDatedEntries(flow, sources, uses);
  const incomePence = sources.reduce((sum, source) => sum + Math.round(source.amount * 100), 0);
  const spendingPence = uses.reduce((sum, use) => sum + Math.round(use.amount * 100), 0);
  const remainderPence = incomePence - spendingPence;
  if (remainderPence > 0) uses.push({ key: "unallocated", label: "Not assigned to spending", amount: remainderPence / 100, kind: "unallocated" });
  if (remainderPence < 0) sources.push({ key: "gap", label: "Amount not covered", amount: -remainderPence / 100, kind: "gap" });
  return {
    sources, uses, linkedRents, linkedMortgages, payDetails, entryDetails, asOfMonth: flow.asOfMonth,
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
  const sharedIncome = summary.sources.filter((item) => !["primaryPay", "partnerPay", "gap"].includes(item.key)).reduce((sum, item) => sum + item.amount, 0);
  const primaryIncome = summary.payDetails[0].monthlyTakeHome + sharedIncome / 2;
  const partnerIncome = summary.payDetails[1].monthlyTakeHome + sharedIncome / 2;
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
  if (!Number.isInteger(reserveMonths) || reserveMonths < 1 || reserveMonths > 24)
    throw new RangeError("Cash reserve target must be from 1 to 24 months.");
  const allowance = assumptions.isaAllowance ?? ISA_ALLOWANCE_2026_27;
  const usedPrimary = assumptions.isaUsedPrimary ?? 0;
  const usedPartner = assumptions.isaUsedPartner ?? 0;
  for (const [label, value] of [["ISA allowance", allowance], ["ISA used by primary person", usedPrimary], ["ISA used by partner", usedPartner]]) {
    const amount = pennies(value, label);
    if (amount > 100_000 * 100) throw new RangeError(`${label} cannot exceed £100,000.`);
  }
  if (usedPrimary > allowance || usedPartner > allowance)
    throw new RangeError("ISA subscriptions already used cannot exceed the entered annual allowance.");
  const surplusPence = Math.max(0, Math.round(summary.remainder * 100));
  const cashTargetPence = Math.round(summary.spendingTotal * 100) * reserveMonths;
  const currentCashPence = (holdings.assets || []).filter((asset) => asset.kind === "cash")
    .reduce((sum, asset) => sum + pennies(asset.value, "Cash asset value"), 0);
  const cashGapPence = Math.max(0, cashTargetPence - currentCashPence);
  const enabled = assumptions.allocationEnabled === true;
  const hasPartner = Boolean(names.partner?.trim() || holdings.partnerName?.trim());
  const label = typeof assumptions.tradingLabel === "string" ? assumptions.tradingLabel.trim() : "";
  if (label.length > 60) throw new RangeError("Account label must be no longer than 60 characters.");
  const allocations = [];
  if (enabled && surplusPence) {
    let remaining = surplusPence;
    for (const [bucket, title, capacity] of [
      ["cash-reserve", "Cash reserve", cashGapPence],
      ["isa-primary", `${names.primary || "Your"}'s ISA`, Math.round((allowance - usedPrimary) * 100)],
      ...(hasPartner ? [["isa-partner", `${names.partner || "Partner"}'s ISA`, Math.round((allowance - usedPartner) * 100)]] : []),
    ]) {
      const amount = Math.min(remaining, capacity);
      allocations.push({ bucket, label: title, monthlyAmount: amount / 100, capacity: capacity / 100 });
      remaining -= amount;
    }
    allocations.push({ bucket: label ? "trading" : "unallocated", label: label || "Not yet assigned", monthlyAmount: remaining / 100, capacity: null });
  }
  return {
    enabled,
    surplus: surplusPence / 100,
    cashTarget: cashTargetPence / 100,
    currentCash: currentCashPence / 100,
    cashGap: cashGapPence / 100,
    reserveMonths,
    allowance,
    usedPrimary,
    usedPartner,
    hasPartner,
    allocations,
    summary,
  };
}
