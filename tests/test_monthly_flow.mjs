import test from "node:test";
import assert from "node:assert/strict";
import { createBlankMonthlyFlow, createExampleMonthlyFlow, summarizeMonthlyFlow, buildMonthlyFlowDiagram, monthlyFlowEvents, computeAllocationWaterfall } from "../prototype/monthly-flow.mjs";
import { createAlexExample } from "../prototype/asset-ledger.mjs";

test("fictional monthly flow reconciles inputs and linked rent once", () => {
  const summary = summarizeMonthlyFlow(createExampleMonthlyFlow(), createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.incomeTotal, 14962.38);
  assert.equal(summary.spendingTotal, 11191.97);
  assert.equal(summary.remainder, 3770.41);
  assert.equal(summary.sources.find((source) => source.kind === "rent")?.amount, 100);
  assert.equal(summary.uses.find((use) => use.kind === "unallocated")?.amount, 3770.41);
  assert.equal(summary.uses.find((use) => use.kind === "mortgage")?.amount, 2375.30);
  assert.equal(summary.payDetails[0].employerPension, 23440);
  assert.equal(summary.payDetails[0].annualBonus, 50000);
  assert.equal(summary.payDetails[1].employeePension, 25000);
  assert.equal(summary.payDetails[1].annualGross, 125000);
  assert.equal(Math.round(summary.sources.reduce((sum, source) => sum + source.amount * 100, 0)), Math.round(summary.chartTotal * 100));
  assert.equal(Math.round(summary.uses.reduce((sum, use) => sum + use.amount * 100, 0)), Math.round(summary.chartTotal * 100));
});

test("the diagram shows gross pay, estimated payroll deductions and net household spending once", () => {
  const diagram = buildMonthlyFlowDiagram(createExampleMonthlyFlow(), createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(diagram.sources.find((item) => item.key === "primaryPay")?.amount, 16375);
  assert.equal(diagram.deductions.find((item) => item.key === "householdTaxNI")?.amount, 8991.38);
  assert.equal(diagram.deductions.find((item) => item.key === "householdPension")?.amount, 2937.91);
  assert.equal(diagram.incomeTotal, 14962.38);
  assert.equal(Math.round(diagram.sources.reduce((sum, item) => sum + item.amount * 100, 0)), Math.round([...diagram.deductions, ...diagram.uses].reduce((sum, item) => sum + item.amount * 100, 0)));
});

test("the full remainder becomes saving, split by take-home income unless the household changes it", () => {
  const flow = createExampleMonthlyFlow();
  let diagram = buildMonthlyFlowDiagram(flow, createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(diagram.savingsAssigned, 3770.41);
  assert.equal(diagram.uses.filter((item) => item.kind === "saving").reduce((sum, item) => sum + item.amount, 0), 3770.41);
  assert.equal(diagram.uses.some((item) => item.key === "unallocated"), false);
  flow.savings.primaryShare = 60;
  diagram = buildMonthlyFlowDiagram(flow, createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(diagram.uses.find((item) => item.key === "primarySaving")?.amount, 2262.25);
  assert.equal(diagram.uses.find((item) => item.key === "partnerSaving")?.amount, 1508.16);
  assert.equal(Math.round(diagram.sources.reduce((sum, item) => sum + item.amount * 100, 0)), Math.round([...diagram.deductions, ...diagram.uses].reduce((sum, item) => sum + item.amount * 100, 0)));
});

test("future months turn dated income and expenses on, then end pay and the mortgage", () => {
  const flow = createExampleMonthlyFlow();
  flow.timelineStartMonth = "2026-10";
  flow.asOfMonth = "2026-10";
  flow.datedEntries.push({ id: "state-pension", side: "income", label: "State Pension", amount: 1200, frequency: "monthly", startMonth: "2043-01", endMonth: "" });
  const holdings = createAlexExample();
  let summary = summarizeMonthlyFlow(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.uses.some((item) => item.label === "School fees (senior)"), false);
  flow.asOfMonth = "2028-11";
  summary = summarizeMonthlyFlow(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.uses.some((item) => item.label === "School fees (current)"), false);
  assert.equal(summary.uses.some((item) => item.label === "School fees (senior)"), true);
  flow.asOfMonth = "2043-01";
  summary = summarizeMonthlyFlow(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.sources.some((item) => item.label === "State Pension"), true);
  flow.asOfMonth = "2044-01";
  summary = summarizeMonthlyFlow(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.sources.some((item) => item.key === "partnerPay"), false);
  flow.asOfMonth = "2047-10";
  summary = summarizeMonthlyFlow(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.uses.some((item) => item.kind === "mortgage"), false);
  const events = monthlyFlowEvents(flow, holdings, { primary: "Alex", partner: "Gemma" });
  assert.equal(events.some((event) => event.month === "2043-01" && event.label.includes("State Pension")), true);
  assert.equal(events.some((event) => event.month === "2047-10" && event.label.includes("mortgage")), true);
});

test("personal rent waits for inclusion, while pension pots and mortgage balances never become monthly flows", () => {
  const assets = createAlexExample();
  const flow = createBlankMonthlyFlow();
  let summary = summarizeMonthlyFlow(flow, assets);
  assert.equal(summary.incomeTotal, 0);
  assert.equal(summary.linkedRents[0].amount, 100);
  flow.includeLinkedRent = true;
  summary = summarizeMonthlyFlow(flow, assets);
  assert.equal(summary.incomeTotal, 100);
  assert.equal(summary.spendingTotal, 0);
  flow.includeLinkedMortgage = true;
  summary = summarizeMonthlyFlow(flow, assets);
  assert.equal(summary.spendingTotal, 2375.30);
  assert.equal(summary.uses.find((use) => use.kind === "mortgage")?.amount, 2375.30);
});

test("spending above entered income is shown as a gap, not invented income", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 14400;
  flow.spending.homeBills = 1550;
  const summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.remainder, -350);
  assert.equal(summary.sources.find((source) => source.kind === "gap")?.amount, 350);
  assert.equal(summary.chartTotal, 1550);
});

test("monthly amounts reject negative, oversized and fractional penny values", () => {
  const flow = createBlankMonthlyFlow();
  for (const bad of [-1, 100_000_001, 0.001, Number.NaN]) {
    flow.spending.other = bad;
    assert.throws(() => summarizeMonthlyFlow(flow), RangeError);
  }
});

test("annual take-home is monthly cash; gross pay, pension inputs and end date are context only", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary = { annualTakeHome: 30001, annualGross: 42000, employeePension: 3000, employerPension: 2500, endDate: "2040-06" };
  const summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.incomeTotal, 2500.08);
  assert.equal(summary.payDetails[0].employeePension, 3000);
  assert.equal(summary.payDetails[0].endDate, "2040-06");
  assert.equal(summary.sources.length, 1);
});

test("mortgage balance and rate cannot imply a payment", () => {
  const flow = createBlankMonthlyFlow();
  flow.includeLinkedMortgage = true;
  const holdings = createAlexExample();
  delete holdings.debts[0].remainingYears;
  const summary = summarizeMonthlyFlow(flow, holdings);
  assert.equal(summary.linkedMortgages.length, 0);
  assert.equal(summary.spendingTotal, 0);
});

test("entering actual take-home overrides the rough pay estimate without changing pension context", () => {
  const flow = createExampleMonthlyFlow();
  flow.pay.primary.annualTakeHome = 120000;
  const summary = summarizeMonthlyFlow(flow, createAlexExample());
  assert.equal(summary.payDetails[0].enteredTakeHome, true);
  assert.equal(summary.payDetails[0].monthlyTakeHome, 10000);
  assert.equal(summary.payDetails[0].employeePension, 10255);
  assert.equal(summary.incomeTotal, 15771.45);
});

test("entered mortgage payment replaces the calculation", () => {
  const flow = createBlankMonthlyFlow(); flow.includeLinkedMortgage = true;
  const holdings = createAlexExample(); holdings.debts[0].monthlyPayment = 2100;
  const summary = summarizeMonthlyFlow(flow, holdings);
  assert.equal(summary.linkedMortgages[0].estimated, false);
  assert.equal(summary.spendingTotal, 2100);
});

test("dated income and expenses appear only during their inclusive active months", () => {
  const flow = createBlankMonthlyFlow();
  flow.asOfMonth = "2026-10";
  flow.datedEntries = [
    { id: "consulting", side: "income", label: "Consulting", amount: 12000, frequency: "yearly", startMonth: "2026-10", endMonth: "2027-03" },
    { id: "fees", side: "spending", label: "School fees", amount: 300, frequency: "monthly", startMonth: "2026-11", endMonth: "2028-07" },
    { id: "old", side: "spending", label: "Former expense", amount: 100, frequency: "monthly", startMonth: "2025-01", endMonth: "2026-09" },
  ];
  let summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.incomeTotal, 1000);
  assert.equal(summary.spendingTotal, 0);
  assert.deepEqual(summary.entryDetails.map((entry) => entry.status), ["active", "future", "ended"]);
  flow.asOfMonth = "2026-11";
  summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.incomeTotal, 1000);
  assert.equal(summary.spendingTotal, 300);
  flow.asOfMonth = "2027-04";
  summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.incomeTotal, 0);
  assert.equal(summary.spendingTotal, 300);
});

test("dated entries validate month order, amount, frequency, and identity", () => {
  const flow = createBlankMonthlyFlow();
  flow.asOfMonth = "2026-10";
  const entry = { id: "one", side: "spending", label: "Membership", amount: 120, frequency: "yearly", startMonth: "2027-01", endMonth: "2026-12" };
  flow.datedEntries = [entry];
  assert.throws(() => summarizeMonthlyFlow(flow), RangeError);
  entry.endMonth = "2027-12";
  assert.equal(summarizeMonthlyFlow(flow).entryDetails[0].monthlyAmount, 10);
  flow.datedEntries.push({ ...entry });
  assert.throws(() => summarizeMonthlyFlow(flow), RangeError);
});

test("a one-off entry affects only its occurrence month", () => {
  const flow = createBlankMonthlyFlow();
  flow.datedEntries = [{ id: "repair", side: "spending", label: "Roof repair", amount: 4800, frequency: "once", startMonth: "2026-11", endMonth: "" }];
  flow.asOfMonth = "2026-10";
  assert.equal(summarizeMonthlyFlow(flow).entryDetails[0].status, "future");
  flow.asOfMonth = "2026-11";
  assert.equal(summarizeMonthlyFlow(flow).spendingTotal, 4800);
  flow.asOfMonth = "2026-12";
  assert.equal(summarizeMonthlyFlow(flow).entryDetails[0].status, "ended");
  flow.datedEntries[0].endMonth = "2026-12";
  assert.throws(() => summarizeMonthlyFlow(flow), RangeError);
});

test("unassigned money stays unassigned until the person opts into a plan", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 60000;
  flow.spending.homeBills = 2000;
  const result = computeAllocationWaterfall(flow, { assets: [] });
  assert.equal(result.surplus, 3000);
  assert.equal(result.enabled, false);
  assert.equal(result.allocations.length, 0);
  assert.equal(result.cashTarget, 12000);
});

test("an opted-in monthly plan reconciles cash, individual ISA headroom, and remaining money", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 120000;
  flow.spending.homeBills = 1000;
  flow.assumptions.allocationEnabled = true;
  flow.assumptions.isaUsedPrimary = 19000;
  flow.assumptions.isaUsedPartner = 18000;
  const result = computeAllocationWaterfall(flow, { assets: [{ kind: "cash", value: 5000 }], partnerName: "Gemma" }, { primary: "Alex", partner: "Gemma" });
  assert.deepEqual(result.allocations.map((item) => item.monthlyAmount), [1000, 1000, 2000, 5000]);
  assert.equal(result.allocations.reduce((sum, item) => sum + item.monthlyAmount, 0), result.surplus);
  assert.equal(result.cashTarget, 6000);
});

test("a plan cannot claim ISA headroom above the current-year allowance", () => {
  const flow = createBlankMonthlyFlow();
  flow.assumptions.isaUsedPrimary = 20001;
  assert.throws(() => computeAllocationWaterfall(flow), RangeError);
});

test("a single-person plan fills only the cash gap when the monthly remainder is smaller", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 24000;
  flow.spending.homeBills = 1500;
  flow.assumptions.allocationEnabled = true;
  const result = computeAllocationWaterfall(flow);
  assert.equal(result.cashTarget, 9000);
  assert.equal(result.surplus, 500);
  assert.equal(result.hasPartner, false);
  assert.deepEqual(result.allocations.map((item) => item.monthlyAmount), [500, 0, 0]);
});

test("growth and inflation inputs are stored but do not change the current snapshot", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 36000;
  flow.spending.homeBills = 1000;
  const before = summarizeMonthlyFlow(flow);
  flow.assumptions.annualInflation = 2;
  flow.assumptions.incomeGrowthRate = 3;
  flow.assumptions.assetGrowthRates.cash = 4;
  const after = summarizeMonthlyFlow(flow);
  assert.equal(after.remainder, before.remainder);
  assert.equal(after.incomeTotal, before.incomeTotal);
  flow.assumptions.assetGrowthRates.cash = -5;
  assert.equal(summarizeMonthlyFlow(flow).remainder, before.remainder);
  flow.assumptions.assetGrowthRates.cash = -31;
  assert.throws(() => summarizeMonthlyFlow(flow), RangeError);
});
