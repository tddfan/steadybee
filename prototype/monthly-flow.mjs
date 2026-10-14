/** Present-day monthly cash flow with an optional annualised pay estimate. No forecast or pension-pot withdrawals. */
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

export function createBlankMonthlyFlow() {
  return {
    pay: { primary: { annualTakeHome: null, annualGross: 0, annualBonus: 0, employeePension: 0, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "" }, partner: { annualTakeHome: null, annualGross: 0, annualBonus: 0, employeePension: 0, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "" } },
    income: Object.fromEntries(INCOME_FIELDS.map(({ key }) => [key, 0])),
    spending: Object.fromEntries(SPENDING_FIELDS.map(({ key }) => [key, 0])),
    asOfMonth: new Date().toISOString().slice(0, 7),
    datedEntries: [],
    includeLinkedRent: false,
    includeLinkedMortgage: false,
    assumptions: { annualInflation: null },
  };
}

export function createExampleMonthlyFlow() {
  return {
    pay: { primary: { annualTakeHome: null, annualGross: 146500, annualBonus: 50000, employeePension: 0, employeePensionRate: 7, employerPension: 0, employerPensionRate: 16, endDate: "2045-12" }, partner: { annualTakeHome: null, annualGross: 125000, annualBonus: 0, employeePension: 25000, employeePensionRate: 0, employerPension: 0, employerPensionRate: 0, endDate: "2043-12" } },
    income: { pensionIncome: 0, otherIncome: 0 },
    spending: { homeBills: 400, everyday: 1500, transport: 600, lifestyle: 900, other: 400 },
    asOfMonth: new Date().toISOString().slice(0, 7),
    datedEntries: [],
    includeLinkedRent: true,
    includeLinkedMortgage: true,
    assumptions: { annualInflation: null },
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
  if (flow.assumptions?.annualInflation !== null && flow.assumptions?.annualInflation !== undefined) {
    const inflation = flow.assumptions.annualInflation;
    if (typeof inflation !== "number" || !Number.isFinite(inflation) || inflation < 0 || inflation > 30) throw new RangeError("Annual inflation assumption must be from 0% to 30%.");
  }
  const sources = [];
  const uses = [];
  const payDetails = [];
  for (const owner of ["primary", "partner"]) {
    const pay = flow.pay[owner];
    const estimate = estimateUkTakeHome2026({ baseSalary: pay.annualGross, bonus: pay.annualBonus, employeePensionAmount: pay.employeePension, employeePensionRate: pay.employeePensionRate, employerPensionAmount: pay.employerPension, employerPensionRate: pay.employerPensionRate });
    const enteredTakeHome = pay.annualTakeHome !== null && pay.annualTakeHome !== undefined;
    const annualTakeHome = enteredTakeHome ? pennies(pay.annualTakeHome, "Annual take-home pay") / 100 : estimate.takeHome;
    if (pay.endDate && !/^\d{4}-(0[1-9]|1[0-2])$/.test(pay.endDate)) throw new RangeError("Pay end date must be a valid month and year.");
    const person = names[owner] || (owner === "primary" ? "Your" : "Partner");
    const monthlyTakeHome = Math.round(annualTakeHome * 100 / 12) / 100;
    payDetails.push({ owner, person, annualTakeHome, annualGross: estimate.grossPay, annualBonus: pay.annualBonus, employeePension: estimate.employeePension, employerPension: estimate.employerPension, endDate: pay.endDate, monthlyTakeHome, enteredTakeHome, estimate });
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
    if (amount) uses.push({ key, label, amount: amount / 100, kind: "spending" });
  }
  const linkedMortgages = debts.filter((debt) => debt.kind === "mortgage")
    .map((debt) => {
      const entered = debt.monthlyPayment !== undefined;
      const calculated = entered ? null : estimateRepaymentMortgagePayment({ balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears });
      return { id: debt.id, label: debt.label?.trim() || "Mortgage", amount: entered ? pennies(debt.monthlyPayment, "Monthly mortgage payment") / 100 : calculated, estimated: !entered, balance: debt.balance, annualRate: debt.interestRate, remainingYears: debt.remainingYears };
    }).filter((debt) => debt.amount !== null);
  if (flow.includeLinkedMortgage) {
    for (const mortgage of linkedMortgages) if (mortgage.amount > 0)
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
