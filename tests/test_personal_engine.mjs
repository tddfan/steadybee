import assert from "node:assert/strict";
import { test } from "node:test";
import {
  comparePlans,
  projectPlan,
  validatePlan,
} from "../prototype/personal-engine.mjs";

const plan = (changes = {}) => ({
  birthDate: "1973-06-01",
  asOfDate: "2026-10-14",
  retirementAge: 53,
  endAge: 70,
  spendingToday: 40_000,
  cash: 60_000,
  isa: 20_000,
  dc: 500_000,
  annualNetEarnings: 0,
  annualDcContribution: 0,
  statePensionAge: 67,
  annualStatePensionNet: 12_000,
  pensionAccessDate: "2030-06-01",
  pensionAccessConfirmed: true,
  withdrawalPolicy: "cash-first",
  dcWithdrawalTaxRate: 0.15,
  dcTaxAssumptionConfirmed: true,
  inflationRate: 0.025,
  investedReturnRate: 0.05,
  cashReturnRate: 0.02,
  shockRate: -0.2,
  ...changes,
});

const closeTo = (actual, expected, tolerance = 0.02) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("missing critical facts and unconfirmed first-access date block results", () => {
  const missing = validatePlan({ ...plan(), cash: undefined, pensionAccessConfirmed: false });
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((error) => error.field === "cash"));
  assert.ok(missing.errors.some((error) => error.field === "pensionAccessConfirmed"));
  assert.throws(() => projectPlan({ ...plan(), pensionAccessDate: "" }), /pensionAccessDate/);
  assert.throws(() => projectPlan({ ...plan(), withdrawalPolicy: "auto" }), /withdrawalPolicy/);
  assert.throws(() => projectPlan({ ...plan(), dcTaxAssumptionConfirmed: false }), /dcTaxAssumptionConfirmed/);
});

test("a provider-confirmed access date unlocks DC inside its actual age band", () => {
  const result = projectPlan(plan({ spendingToday: 70_000, cash: 10_000, isa: 0 }));
  const before = result.years.find((row) => row.age === 56);
  const access = result.years.find((row) => row.age === 57);
  assert.equal(before.accessStatus, "locked");
  assert.equal(before.withdrawals.dcGross, 0);
  assert.ok(before.uncoveredNominal > 0);
  assert.equal(access.accessStatus, "available");
  assert.ok(access.withdrawals.dcGross > 0);
  assert.equal(result.firstBridgeGapAge, 53);
  assert.ok(result.assumptions.accessRule.includes("provider-confirmed"));
});

test("a midyear access date exposes mixed status and cannot pay earlier spending", () => {
  const base = plan({
    asOfDate: "2030-01-01",
    birthDate: "1973-01-01",
    pensionAccessDate: "2030-07-01",
    cash: 0,
    isa: 0,
    dc: 100_000,
    spendingToday: 12_000,
    statePensionAge: 90,
    annualStatePensionNet: 0,
  });
  const row = projectPlan(base).years[0];
  assert.equal(row.accessStatus, "mixed");
  assert.ok(row.uncoveredNominal > 5_000);
  assert.ok(row.uncoveredNominal < 7_000);
  assert.ok(row.withdrawals.dcGross > 0);
  assert.ok(row.closing.dc > 0);
  assert.equal(row.uncoveredBeforeAccessNominal, row.uncoveredNominal);
  assert.equal(row.uncoveredAfterAccessNominal, 0);
});

test("a mixed access year with a shortfall only after access is a later gap", () => {
  const result = projectPlan(plan({
    asOfDate: "2030-01-01",
    birthDate: "1973-01-01",
    pensionAccessDate: "2030-07-01",
    cash: 6_500,
    isa: 0,
    dc: 2_000,
    spendingToday: 12_000,
    statePensionAge: 90,
    annualStatePensionNet: 0,
  }));
  const row = result.years[0];
  assert.equal(row.accessStatus, "mixed");
  assert.equal(row.uncoveredBeforeAccessNominal, 0);
  assert.ok(row.uncoveredAfterAccessNominal > 0);
  assert.equal(result.firstBridgeGapAge, null);
  assert.equal(result.firstLaterGapAge, 57);
});

test("annual ledger reconciles income, returns, contributions, tax and withdrawals", () => {
  const result = projectPlan(plan({
    retirementAge: 58,
    annualNetEarnings: 55_000,
    annualDcContribution: 6_000,
    pensionAccessDate: "2030-03-01",
    protectedPensionAgeConfirmed: true,
    cash: 500,
    isa: 500,
  }));
  for (const row of result.years) {
    const w = row.withdrawals;
    closeTo(row.spendingNominal, row.incomeUsedNominal + w.cash + w.isa + w.dcNet + row.uncoveredNominal);
    closeTo(w.dcGross, w.dcNet + w.dcTax);
    closeTo(row.closing.cash, row.opening.cash + row.returns.cash + row.netEarningsNominal + row.statePensionNetNominal - row.incomeUsedNominal - w.cash);
    closeTo(row.closing.isa, row.opening.isa + row.returns.isa - w.isa);
    closeTo(row.closing.dc, row.opening.dc + row.returns.dc + row.dcContributionsNominal - w.dcGross);
  }
  assert.ok(result.years.some((row) => row.dcContributionsNominal > 0));
  assert.ok(result.years.some((row) => row.withdrawals.dcTax > 0));
});

test("nominal spending rises with inflation while today's-pound spending stays level", () => {
  const result = projectPlan(plan({
    asOfDate: "2026-06-01",
    spendingToday: 50_000,
    statePensionAge: 90,
    annualStatePensionNet: 0,
  }));
  const first = result.years[0];
  const next = result.years[1];
  closeTo(first.spendingToday, 50_000);
  closeTo(next.spendingToday, 50_000);
  assert.ok(next.spendingNominal > first.spendingNominal * 1.024);
  assert.equal(result.assumptions.inflationRate, 0.025);
  assert.match(result.assumptions.inflationTreatment, /nominal/i);
  closeTo(next.closingToday.isa, next.closing.isa / next.inflationFactor);
  closeTo(next.spendingNominal, next.spendingToday * next.spendingInflationFactor);
});

test("DC access plausibility checks the 2028 transition without claiming eligibility", () => {
  const beforeChange = plan({ birthDate: "1972-04-06", pensionAccessDate: "2028-04-05" });
  assert.equal(validatePlan(beforeChange).valid, true);
  const protectedDate = { ...beforeChange, pensionAccessDate: "2028-04-06" };
  assert.ok(validatePlan(protectedDate).errors.some((error) => error.field === "protectedPensionAgeConfirmed"));
  assert.equal(validatePlan({ ...protectedDate, protectedPensionAgeConfirmed: true }).valid, true);
  const standard = plan({ birthDate: "1971-04-06", pensionAccessDate: "2028-04-06" });
  assert.equal(validatePlan(standard).valid, true);
  const tooEarly = plan({ birthDate: "1974-04-06", pensionAccessDate: "2028-04-06", protectedPensionAgeConfirmed: true });
  assert.ok(validatePlan(tooEarly).errors.some((error) => error.field === "pensionAccessDate"));
});

test("nonzero State Pension requires a plausible user-entered start age", () => {
  assert.ok(validatePlan(plan({ statePensionAge: 18 })).errors.some((error) => error.field === "statePensionAge"));
  assert.equal(validatePlan(plan({ statePensionAge: 67 })).valid, true);
  const excluded = projectPlan(plan({ statePensionAge: 0, annualStatePensionNet: 0 }));
  assert.equal(excluded.assumptions.statePensionDate, null);
  assert.equal(excluded.totals.totalStatePensionNetNominal, 0);
});

test("the explicit withdrawal choice changes which accessible pot is used", () => {
  const input = plan({ cash: 40_000, isa: 40_000, dc: 0, spendingToday: 20_000 });
  const cashFirst = projectPlan(input).years[0];
  const isaFirst = projectPlan({ ...input, withdrawalPolicy: "isa-first" }).years[0];
  assert.ok(cashFirst.withdrawals.cash > cashFirst.withdrawals.isa);
  assert.ok(isaFirst.withdrawals.isa > isaFirst.withdrawals.cash);
  assert.equal(cashFirst.uncoveredNominal, 0);
  assert.equal(isaFirst.uncoveredNominal, 0);
});

test("early and late shocks use the same one-year return set but different timing", () => {
  const input = plan({
    asOfDate: "2026-06-01",
    cash: 0,
    isa: 500_000,
    dc: 0,
    spendingToday: 15_000,
    statePensionAge: 90,
    annualStatePensionNet: 0,
  });
  const early = projectPlan(input, { shockTiming: "early" });
  const late = projectPlan(input, { shockTiming: "late" });
  assert.equal(early.assumptions.shockRate, -0.2);
  assert.equal(late.assumptions.shockRate, -0.2);
  assert.equal(early.assumptions.shockYearsAfterDrawdown, 0);
  assert.equal(late.assumptions.shockYearsAfterDrawdown, 5);
  assert.notEqual(early.years[0].closing.isa, late.years[0].closing.isa);
  assert.notEqual(early.totals.finalBalances.isa, late.totals.finalBalances.isa);
  assert.equal(early.assumptions.shockDurationYears, 1);
  assert.equal(late.assumptions.shockDurationYears, 1);
});

test("early shock waits for invested drawdown after a cash bridge", () => {
  const input = plan({
    asOfDate: "2026-06-01",
    cash: 70_000,
    isa: 300_000,
    dc: 0,
    spendingToday: 20_000,
    statePensionAge: 90,
    annualStatePensionNet: 0,
  });
  const baseline = projectPlan(input);
  const early = projectPlan(input, { shockTiming: "early" });
  const late = projectPlan(input, { shockTiming: "late" });
  assert.ok(early.assumptions.shockStartDate > early.assumptions.retirementDate);
  assert.equal(early.assumptions.shockStartDate, baseline.assumptions.firstInvestedDrawdownDate);
  assert.equal(late.assumptions.shockStartDate.slice(0, 4) - early.assumptions.shockStartDate.slice(0, 4), 5);
  assert.equal(early.years[0].returns.cash, baseline.years[0].returns.cash);
});

test("cash and ISA only plans do not require inapplicable DC access and tax fields", () => {
  const input = plan({ dc: 0, annualDcContribution: 0, pensionAccessDate: undefined,
    pensionAccessConfirmed: undefined, dcWithdrawalTaxRate: undefined,
    dcTaxAssumptionConfirmed: undefined });
  assert.equal(validatePlan(input).valid, true);
  const result = projectPlan(input);
  assert.equal(result.years[0].accessStatus, "not-applicable");
  assert.equal(result.firstBridgeGapAge, null);
  assert.equal(result.assumptions.pensionAccessDate, null);
  assert.match(result.assumptions.dcTaxTreatment, /Not applicable/);
});

test("endpoint includes the whole selected final age year", () => {
  const result = projectPlan(plan({ endAge: 95 }));
  assert.equal(result.years.at(-1).age, 95);
  assert.equal(result.years.at(-1).endDate, "2069-06-01");
  assert.equal(result.assumptions.horizonEndDate, "2069-06-01");
});

test("comparison leaves user input unchanged and changes retirement timing only in alternative", () => {
  const input = plan({ annualNetEarnings: 80_000, annualDcContribution: 10_000 });
  const before = JSON.stringify(input);
  const result = comparePlans(input, { retirementAge: 58 });
  assert.equal(JSON.stringify(input), before);
  assert.equal(result.baseline.assumptions.retirementAge, 53);
  assert.equal(result.alternative.assumptions.retirementAge, 58);
  assert.ok(result.alternative.totals.totalNetEarningsNominal > result.baseline.totals.totalNetEarningsNominal);
});
