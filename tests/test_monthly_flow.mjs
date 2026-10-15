import test from "node:test";
import assert from "node:assert/strict";
import { createBlankMonthlyFlow, createExampleMonthlyFlow, summarizeMonthlyFlow, buildMonthlyFlowDiagram, monthlyFlowEvents, computeAllocationWaterfall } from "../prototype/monthly-flow.mjs";
import { createAlexExample } from "../prototype/asset-ledger.mjs";

test("fictional monthly flow reconciles inputs and linked rent once", () => {
  const summary = summarizeMonthlyFlow(createExampleMonthlyFlow(), createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(summary.incomeTotal, 14962.38);
  assert.equal(summary.spendingTotal, 8441.97);
  assert.deepEqual(summary.uses.filter((item)=>item.kind === "spending").map(({key,amount})=>({key,amount})), [{key:"everyday",amount:4000},{key:"carPayment",amount:400}]);
  assert.equal(summary.remainder, 6520.41);
  assert.equal(summary.sources.find((source) => source.kind === "rent")?.amount, 100);
  assert.equal(summary.uses.find((use) => use.kind === "unallocated")?.amount, 6520.41);
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
  assert.equal(diagram.savingsAssigned, 6520.41);
  assert.equal(diagram.uses.filter((item) => item.kind === "saving").reduce((sum, item) => sum + item.amount, 0), 6520.41);
  assert.equal(diagram.uses.some((item) => item.key === "unallocated"), false);
  flow.savings.primaryShare = 60;
  diagram = buildMonthlyFlowDiagram(flow, createAlexExample(), { primary: "Alex", partner: "Gemma" });
  assert.equal(diagram.uses.find((item) => item.key === "primarySaving")?.amount, 3912.25);
  assert.equal(diagram.uses.find((item) => item.key === "partnerSaving")?.amount, 2608.16);
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
  flow.spending.everyday = 1550;
  const summary = summarizeMonthlyFlow(flow);
  assert.equal(summary.remainder, -350);
  assert.equal(summary.sources.find((source) => source.kind === "gap")?.amount, 350);
  assert.equal(summary.chartTotal, 1550);
});

test("monthly amounts reject negative, oversized and fractional penny values", () => {
  const flow = createBlankMonthlyFlow();
  for (const bad of [-1, 100_000_001, 0.001, Number.NaN]) {
    flow.spending.everyday = bad;
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
  flow.spending.everyday = 2000;
  const result = computeAllocationWaterfall(flow, { assets: [] });
  assert.equal(result.surplus, 3000);
  assert.equal(result.enabled, false);
  assert.equal(result.allocations.length, 0);
  assert.equal(result.cashTarget, 12000);
});

test("an opted-in monthly plan reconciles cash, individual ISA headroom, and remaining money", () => {
  const flow = createBlankMonthlyFlow();
  flow.pay.primary.annualTakeHome = 120000;
  flow.spending.everyday = 1000;
  flow.assumptions.allocationEnabled = true;
  flow.assumptions.isaUsedPrimary = 19000;
  flow.assumptions.isaUsedPartner = 18000;
  const result = computeAllocationWaterfall(flow, { assets: [{ kind: "cash", value: 5000 }], partnerName: "Gemma" }, { primary: "Alex", partner: "Gemma" });
  assert.deepEqual(result.allocations.map((item) => item.monthlyAmount), [1000, 1000, 0, 7000]);
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
  flow.spending.everyday = 1500;
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
  flow.spending.everyday = 1000;
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

test('a future spending phase replaces the original amount only during its dates',()=>{
 const flow=createBlankMonthlyFlow(); flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';flow.spending.everyday=4000;
 flow.datedEntries=[{id:'retirement-spending',side:'spending',label:'Retirement living',amount:2500,frequency:'monthly',startMonth:'2045-01',endMonth:'2046-12',replacesKey:'everyday'}];
 assert.equal(summarizeMonthlyFlow(flow).spendingTotal,4000);
 flow.asOfMonth='2045-01';assert.equal(summarizeMonthlyFlow(flow).spendingTotal,2500);
 flow.asOfMonth='2047-01';assert.equal(summarizeMonthlyFlow(flow).spendingTotal,4000);
});
test('cash reserve, own ISA and own general account are routed independently by income share',()=>{
 const flow=createBlankMonthlyFlow();flow.pay.primary.annualTakeHome=72000;flow.pay.partner.annualTakeHome=48000;flow.spending.everyday=4000;
 flow.assumptions.allocationEnabled=true;flow.assumptions.tradingLabel='General investment account';
 let plan=computeAllocationWaterfall(flow,{partnerName:'Gemma',assets:[]},{primary:'Alex',partner:'Gemma'});
 assert.equal(plan.people[0].reserveTarget,14400);assert.equal(plan.people[1].reserveTarget,9600);
 assert.equal(plan.people[0].cash,3600);assert.equal(plan.people[1].cash,2400);
 flow.assumptions.isaUsedPrimary=19500;flow.assumptions.isaUsedPartner=19000;
 plan=computeAllocationWaterfall(flow,{partnerName:'Gemma',assets:[{kind:'cash',value:24000,owner:'shared'}]},{primary:'Alex',partner:'Gemma'});
 assert.deepEqual(plan.people.map(p=>[p.cash,p.isa,p.general]),[[0,500,3100],[0,1000,1400]]);
 assert.equal(plan.people.flatMap(p=>[p.cash,p.isa,p.general]).reduce((a,b)=>a+b,0),plan.surplus);
});
test('one-off costs affect the selected month but are not multiplied into a recurring cash reserve',()=>{
 const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';flow.spending.everyday=1000;
 flow.datedEntries=[{id:'car',side:'spending',label:'Car purchase',amount:15000,frequency:'once',startMonth:'2026-10',endMonth:''}];
 assert.equal(computeAllocationWaterfall(flow).cashTarget,6000);
});

test('overlapping future replacement phases are rejected before navigating to them',()=>{
 const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';
 flow.datedEntries=[{id:'phase-1',side:'spending',label:'Phase 1',amount:2000,frequency:'monthly',startMonth:'2040-01',endMonth:'2045-12',replacesKey:'everyday'},{id:'phase-2',side:'spending',label:'Phase 2',amount:1000,frequency:'monthly',startMonth:'2045-01',endMonth:'',replacesKey:'everyday'}];
 assert.throws(()=>summarizeMonthlyFlow(flow),/overlap/);
});
test('State Pension records feed dated net income and timeline without invented records',()=>{
 const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';
 flow.statePensions.primary={qualifyingYears:20,assessmentMonth:'2026-10',startMonth:'2050-10',qualifyingUntil:'2045-10',mode:'simplified',otherTaxableIncome:0};
 assert.equal(summarizeMonthlyFlow(flow).incomeTotal,0);
 assert.ok(monthlyFlowEvents(flow).some(event=>event.month === '2050-10' && /State Pension/.test(event.label)));
 flow.asOfMonth='2050-10'; const summary=summarizeMonthlyFlow(flow);
 assert.equal(summary.incomeTotal,1045.63);assert.equal(summary.statePensionDetails[0].futureYears,19);
 assert.equal(summary.statePensionDetails[0].annualTax,0);
 assert.equal(summary.statePensionDetails.some(item=>item.owner === 'partner'),false);
});

 test('upcoming pension preview uses employment at its start date rather than today',()=>{
 const flow=createExampleMonthlyFlow();flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';flow.statePensions.primary={qualifyingYears:20,assessmentMonth:'2026-10',startMonth:'2051-10',qualifyingUntil:'2045-12',mode:'simplified',otherTaxableIncome:0};
 assert.equal(summarizeMonthlyFlow(flow).statePensionDetails[0].monthlyNet,1045.63);
 });

test('a one-off windfall does not change the recurring-income saving split or reserve ownership',()=>{
 const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-10';flow.timelineStartMonth='2026-10';flow.pay.primary.annualTakeHome=72000;flow.pay.partner.annualTakeHome=48000;flow.spending.everyday=4000;
 flow.datedEntries=[{id:'gift',side:'income',label:'Gift',amount:100000,frequency:'once',startMonth:'2026-10',endMonth:''}];
 const holdings={partnerName:'Gemma',assets:[]};
 assert.equal(computeAllocationWaterfall(flow,holdings).primaryShare,60);
 assert.equal(buildMonthlyFlowDiagram(flow,holdings,{primary:'Alex',partner:'Gemma'}).primaryShare,60);
});

test('tax-year routing carries cash and ISA subscriptions across months without mutating inputs', async () => {
  const { projectTaxYearSaving } = await import('../prototype/monthly-flow.mjs');
  const flow=createBlankMonthlyFlow(); flow.asOfMonth='2026-10'; flow.pay.primary.annualTakeHome=48000;
  flow.assumptions.allocationEnabled=true; flow.assumptions.isaUsedPrimary=18000;
  const before=JSON.stringify(flow);
  const result=projectTaxYearSaving(flow, {assets:[],name:'Alex'});
  assert.equal(result.months.length,6);
  assert.equal(result.endMonth,'2027-03');
  assert.equal(result.people[0].isa,2000);
  assert.equal(result.people[0].general,22000);
  assert.equal(result.people[0].isaTotal,20000);
  assert.equal(JSON.stringify(flow),before);
});

test('tax-year routing stops reserve top-ups once funded and honours future costs', async () => {
  const { projectTaxYearSaving }=await import('../prototype/monthly-flow.mjs');
  const flow=createBlankMonthlyFlow();flow.asOfMonth='2026-12';flow.pay.primary.annualTakeHome=36000;flow.spending.everyday=1000;
  flow.assumptions.allocationEnabled=true;flow.assumptions.cashReserveMonths=1;
  flow.datedEntries=[{id:'trip',side:'spending',label:'Trip',amount:1000,frequency:'once',startMonth:'2027-01',endMonth:''}];
  const result=projectTaxYearSaving(flow,{assets:[]});
  assert.equal(result.people[0].cash,1000);
  assert.equal(result.months[1].people[0].cash,0);
  assert.equal(result.people[0].isa,6000);
  assert.equal(result.people[0].general,0);
});
