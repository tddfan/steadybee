import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleInsights } from "../prototype/example-insights.mjs";
import {
  SCHEMA_VERSION,
  createDraft,
  createScenario,
  field,
  getNextDetail,
  normaliseOverrides,
  parseSaved,
  serialise,
  summariseDraft,
  updateBaseline,
  validateDraft,
} from "../prototype/state.mjs";
import { evaluateExample, examples } from "../prototype/fixtures.mjs";

function filled(route = "dc", scope = "individual") {
  const draft = createDraft(route, scope);
  Object.assign(draft.profile, {
    age: field(52),
    targetRetirementAge: field(route === "retired" ? 50 : 55),
    pensionTotal: field(400_000),
    nonPensionTotal: field(70_000),
    monthlySpending: field(3_000),
  });
  return draft;
}

test("access shortfalls and later depletion remain separate, unrepaid periods", () => {
  const r = evaluateExample("early-dc"),
    facts = exampleInsights(r);
  assert.equal(facts.firstGap.year, 2031);
  assert.equal(facts.firstGap.primaryAge, 57);
  assert.equal(facts.yearsFromStart, 5);
  assert.equal(facts.yearsAfterRetirement, 2);
  assert.equal(facts.firstGap.annualGap, 34777.19);
  assert.equal(facts.firstGap.closingLockedPension, 473848.56);
  assert.equal(facts.firstGap.closingAvailablePension, 0);
  assert.deepEqual(
    facts.gapPeriods.map((p) => [p.start.year, p.end.year]),
    [
      [2031, 2033],
      [2055, 2064],
    ],
  );
  assert.equal(facts.gapPeriods[0].total, 106777.19);
  assert.equal(facts.gapPeriods[0].nextCovered.year, 2034);
  assert.equal(facts.gapPeriods[0].nextCovered.cumulativeGap, 106777.19);
  assert.match(r.summary.statement, /first/);
  assert.doesNotMatch(r.summary.statement, /amount from/);
});

test("a covered pension-access period does not imply coverage for the whole illustration", () => {
  const r = evaluateExample("early-dc", { retirementAge: 58 }),
    facts = exampleInsights(r);
  assert.equal(r.summary.bridgeGapTotal, 0);
  assert.equal(facts.firstGap.primaryAge, 83);
  assert.equal(facts.gapPeriods.length, 1);
  assert.equal(facts.gapPeriods[0].kind, "later");
  assert.ok(r.summary.totalGap > 0);
});

test("positive final assets do not erase an earlier access shortfall", () => {
  const r = evaluateExample("early-dc", { monthlySpending: 2400 }),
    facts = exampleInsights(r);
  assert.equal(r.summary.finalTotal, 55381.04);
  assert.equal(r.summary.bridgeGapTotal, 47987.51);
  assert.equal(facts.firstGap.year, 2032);
  assert.equal(facts.gapPeriods[0].end.year, 2033);
});

test("zero savings outside pensions does not mean pension money or spending coverage is exhausted", () => {
  for (const id of ["already-retired", "mixed-household"]) {
    const r = evaluateExample(id),
      facts = exampleInsights(r);
    const depletedSavings = r.rows.find((row) => row.closingAccessible === 0);
    assert.ok(depletedSavings.closingAvailablePension > 0);
    assert.equal(depletedSavings.annualGap, 0);
    assert.equal(facts.firstGap, null);
    assert.deepEqual(facts.gapPeriods, []);
  }
  assert.equal(
    exampleInsights(evaluateExample("already-retired")).yearsAfterRetirement,
    null,
  );
});

test("pension accessibility splits reconcile with the pension total for every example year", () => {
  for (const e of examples)
    for (const row of evaluateExample(e.id).rows) {
      assert.ok(
        Math.abs(
          row.closingAvailablePension +
            row.closingLockedPension -
            row.closingPension,
        ) < 0.02,
      );
    }
});

test("an additional cost outside the illustrated years cannot silently disappear", () => {
  assert.throws(
    () => evaluateExample("early-dc", { majorCost: 500000, majorCostAge: 100 }),
    /outside.*horizon/i,
  );
});

test("the default horizon preserves every existing age-90 numeric result", () => {
  const expected = {
    "early-dc": { finalTotal: 0, totalGap: 335863.92, bridgeGapTotal: 106777.19 },
    "mixed-household": { finalTotal: 1129796.71, totalGap: 0, bridgeGapTotal: 0 },
    "already-retired": { finalTotal: 200189.4, totalGap: 0, bridgeGapTotal: 0 },
  };
  for (const example of examples) {
    const baseline = evaluateExample(example.id);
    const explicit = evaluateExample(example.id, { horizonAge: 90 });
    assert.equal(baseline.summary.horizonAge, 90);
    assert.deepEqual(explicit.rows, baseline.rows);
    assert.deepEqual(explicit.summary, baseline.summary);
    assert.deepEqual(explicit.changes, []);
    for (const [key, value] of Object.entries(expected[example.id]))
      assert.equal(baseline.summary[key], value);
  }
});

test("extending the horizon appends years without changing the existing annual ledger", () => {
  for (const example of examples) {
    const baseline = evaluateExample(example.id);
    for (const horizonAge of [95, 100]) {
      const extended = evaluateExample(example.id, { horizonAge });
      assert.deepEqual(extended.rows.slice(0, baseline.rows.length), baseline.rows);
      assert.equal(extended.rows.length - baseline.rows.length, horizonAge - 90);
      assert.equal(extended.rows.at(-1).primaryAge, horizonAge);
      assert.equal(extended.rows.at(-1).year, example.profile.startYear + horizonAge - example.profile.primary.age);
      assert.equal(extended.rows.at(-1).partnerAge, example.profile.partner ? example.profile.partner.age + horizonAge - example.profile.primary.age : null);
    }
  }
});

test("extra Alex years expose additional unpaid spending without changing earlier shortfalls", () => {
  const baseline = evaluateExample("early-dc");
  for (const horizonAge of [95, 100]) {
    const extended = evaluateExample("early-dc", { horizonAge });
    assert.equal(extended.summary.firstGapYear, baseline.summary.firstGapYear);
    assert.equal(extended.summary.bridgeGapTotal, baseline.summary.bridgeGapTotal);
    assert.equal(Math.round((extended.summary.totalGap - baseline.summary.totalGap) * 100), (horizonAge - 90) * 24000 * 100);
    assert.equal(exampleInsights(extended).gapPeriods.at(-1).end.primaryAge, horizonAge);
    for (const row of extended.rows.filter((row) => row.primaryAge > 90)) {
      assert.equal(row.income, 12000);
      assert.equal(row.spending, 36000);
      assert.equal(row.annualGap, 24000);
      assert.equal(row.closingPension, 0);
    }
  }
});

test("horizon selection preserves source fixtures and records version, assumptions and actual changes", () => {
  const before = JSON.stringify(examples);
  const result = evaluateExample("early-dc", { horizonAge: 100 });
  assert.equal(JSON.stringify(examples), before);
  assert.equal(examples.find((e) => e.id === "early-dc").profile.horizonAge, 90);
  assert.equal(result.profile.horizonAge, 100);
  assert.equal(result.provenance.fixtureVersion, "2026-10-10.1");
  assert.equal(result.provenance.overrides.horizonAge, 100);
  assert.deepEqual(result.changes.find((c) => c.key === "horizonAge"), { key: "horizonAge", label: "Illustrated horizon (primary age)", from: 90, to: 100 });
  assert.ok(result.assumptions.some((a) => a.includes("end of primary age 100")));
});

test("only whole illustrated horizons of 90, 95 and 100 can be evaluated or restored", () => {
  for (const horizonAge of [85, 89, 91, 94, 96, 99, 101, 90.5, NaN, Infinity, "95", null]) {
    assert.throws(() => normaliseOverrides({ horizonAge }), /horizon/i);
    assert.throws(() => evaluateExample("early-dc", { horizonAge }), /horizon/i);
  }
  const draft = filled();
  draft.scenarios.push(createScenario(draft, "Look through age 100", { horizonAge: 100 }));
  const restored = parseSaved(serialise(draft));
  assert.equal(restored.ok, true);
  assert.equal(restored.draft.scenarios[0].overrides.horizonAge, 100);
  restored.draft.scenarios[0].overrides.horizonAge = 96;
  assert.equal(parseSaved(JSON.stringify(restored.draft)).ok, false);
});

test("a late cost is applied exactly once inside the selected horizon and remains invalid outside it", () => {
  const baseline = evaluateExample("already-retired", { horizonAge: 95 });
  const withCost = evaluateExample("already-retired", { horizonAge: 95, majorCost: 50000, majorCostAge: 95 });
  assert.deepEqual(withCost.rows.slice(0, -1), baseline.rows.slice(0, -1));
  assert.equal(withCost.rows.at(-1).majorCost, 50000);
  assert.equal(withCost.rows.filter((r) => r.majorCost > 0).length, 1);
  assert.equal(withCost.summary.totalGap, 0);
  assert.ok(Math.abs(baseline.summary.finalTotal - withCost.summary.finalTotal - 50000) < 0.02);
  assert.throws(() => evaluateExample("already-retired", { majorCost: 50000, majorCostAge: 95 }), /outside.*horizon/i);
  assert.throws(() => evaluateExample("early-dc", { retirementAge: 95 }), /outside.*horizon/i);
  assert.equal(evaluateExample("early-dc", { horizonAge: 95, retirementAge: 95 }).rows.at(-1).primaryAge, 95);
});

function incomeStream(owner = "primary", amount = 20_000, startAge = 65) {
  return {
    id: `stream-${owner}`,
    owner,
    type: "db",
    label: "Entered DB income",
    annualAmount: field(amount),
    startAge: field(startAge),
    endAge: field(null),
    incomeBasis: "net",
  };
}

test("a new personal draft contains unknown money, no sample amounts and no income-to-pot conversion", () => {
  const draft = createDraft("income", "household");
  assert.equal(draft.schemaVersion, SCHEMA_VERSION);
  assert.equal(draft.profile.pensionTotal.value, null);
  assert.equal(draft.profile.annualPensionIncome.value, null);
  assert.equal(draft.householdStatus, "pending");
  assert.equal(draft.partner, null);
  draft.profile.annualPensionIncome = field(12_000, "estimated");
  assert.equal(summariseDraft(draft).totals.pension, null);
  assert.equal(summariseDraft(draft).totals.annualPensionIncome, 12_000);
  assert.equal(summariseDraft(draft).totals.pensionComplete, false);
  assert.equal(validateDraft(draft).valid, true);
});

test("unknown, estimated and deliberately supplied zero survive export and restore", () => {
  const draft = createDraft();
  draft.profile.pensionTotal = field(0);
  draft.profile.nonPensionTotal = field(12_345, "estimated");
  draft.consent.deviceSave = true;
  const restored = parseSaved(serialise(draft));
  assert.equal(restored.ok, true);
  assert.deepEqual(restored.draft.profile.pensionTotal, field(0));
  assert.deepEqual(
    restored.draft.profile.nonPensionTotal,
    field(12_345, "estimated"),
  );
  assert.equal(restored.draft.profile.monthlySpending.value, null);
  assert.equal(restored.draft.consent.deviceSave, true);
});

test("malformed, unsupported and hostile saved states are rejected without discarding an original draft", () => {
  assert.equal(parseSaved("{bad json").ok, false);
  assert.equal(parseSaved(JSON.stringify({ schemaVersion: 999 })).ok, false);
  assert.equal(
    parseSaved('{"schemaVersion":1,"__proto__":{"polluted":true}}').ok,
    false,
  );
  const draft = filled();
  draft.profile.pensionTotal = { value: null, status: "provided" };
  assert.equal(parseSaved(JSON.stringify(draft)).ok, false);
  assert.equal({}.polluted, undefined);
});

test("validation preserves unknown while rejecting impossible dates and non-finite or negative amounts", () => {
  const draft = filled();
  draft.profile.targetRetirementAge = field(51);
  assert.equal(validateDraft(draft).valid, false);
  draft.profile.retirementStatus = "already-retired";
  assert.equal(validateDraft(draft).valid, true);
  draft.profile.nonPensionTotal = field(-1);
  assert.equal(validateDraft(draft).valid, false);
  draft.profile.nonPensionTotal = { value: Infinity, status: "provided" };
  assert.equal(validateDraft(draft).valid, false);
  draft.profile.nonPensionTotal = field(null);
  assert.equal(validateDraft(draft).valid, true);
});

test("next detail responds to household, DB income, an inaccessible bridge and retired context", () => {
  const household = filled("dc", "household");
  assert.equal(getNextDetail(household).id, "partner");
  const income = filled("income");
  assert.equal(getNextDetail(income).id, "income");
  const early = filled();
  early.details.pensionAccessAge = field(60);
  assert.equal(getNextDetail(early).id, "access");
  const retired = filled("retired");
  assert.equal(getNextDetail(retired).id, "income");
  retired.profile.annualPensionIncome = field(20_000);
  assert.equal(getNextDetail(retired).id, "income");
  retired.details.incomeStreams = [incomeStream()];
  retired.details.pensionAccessAge = field(50);
  assert.equal(getNextDetail(retired).id, "costs");
});

test("dated income sends the next question to the access editor rather than repeating the income editor", () => {
  const draft = filled();
  draft.details.monthlyContributions = field(700);
  assert.equal(getNextDetail(draft).group, "income");
  draft.details.incomeStreams = [incomeStream()];
  assert.equal(getNextDetail(draft).group, "access");
  draft.ui.dismissedDetailIds = ["access"];
  assert.equal(getNextDetail(draft), null);
  assert.equal(draft.details.pensionAccessAge.value, null);
});

test("income dates remain owner-specific, and retired DB users do not get an irrelevant pot-access question", () => {
  const draft = filled();
  draft.details.monthlyContributions = field(700);
  draft.details.incomeStreams = [incomeStream("partner")];
  assert.equal(getNextDetail(draft).group, "income");
  const retired = filled("retired");
  retired.profile.pensionTotal = field(null);
  retired.profile.annualPensionIncome = field(20_000);
  assert.equal(getNextDetail(retired).group, "income");
  retired.details.incomeStreams = [incomeStream()];
  assert.equal(getNextDetail(retired).group, "costs");
});

test("a confirmed partner object with unknown required inputs still leaves the household incomplete", () => {
  const draft = filled("dc", "household");
  draft.partner = createDraft().profile;
  draft.householdStatus = "confirmed";
  const partial = summariseDraft(draft);
  assert.equal(partial.householdIncomplete, true);
  assert.equal(partial.totals.nonPensionComplete, false);
  assert.equal(getNextDetail(draft).group, "partner");
  assert.equal(validateDraft(draft).valid, true);
  draft.partner = filled().profile;
  assert.equal(summariseDraft(draft).householdIncomplete, false);
  assert.equal(summariseDraft(draft).totals.nonPensionComplete, true);
  draft.partner.targetRetirementAge = field(null);
  assert.equal(summariseDraft(draft).householdIncomplete, true);
  draft.partner.retirementStatus = "already-retired";
  assert.equal(summariseDraft(draft).householdIncomplete, false);
});

test("dismissing the current detail ends that card rather than immediately cascading", () => {
  const draft = filled();
  assert.equal(getNextDetail(draft).id, "contributions");
  draft.ui.dismissedDetailIds = ["contributions"];
  assert.equal(getNextDetail(draft), null);
  assert.equal(draft.details.monthlyContributions.value, null);
});

test("shared account totals count each account once and reconcile instead of adding to aggregates", () => {
  const draft = filled("dc", "household");
  draft.partner = filled().profile;
  draft.partner.pensionTotal = field(100_000);
  draft.partner.nonPensionTotal = field(30_000);
  draft.accounts = [
    {
      id: "a",
      name: "Joint cash",
      owner: "joint",
      type: "cash",
      balance: field(100_000),
    },
    {
      id: "b",
      name: "Primary pension",
      owner: "primary",
      type: "pension",
      balance: field(400_000),
    },
    {
      id: "c",
      name: "Partner pension",
      owner: "partner",
      type: "pension",
      balance: field(100_000),
    },
  ];
  const summary = summariseDraft(draft);
  assert.equal(summary.totals.nonPension, 100_000);
  assert.equal(summary.accountTotals.nonPension, 100_000);
  assert.equal(summary.totals.combined, 600_000);
  assert.equal(
    summary.reconciliation.find((row) => row.group === "nonPension").difference,
    0,
  );
  draft.accounts.push({ ...draft.accounts[0] });
  assert.equal(validateDraft(draft).valid, false);
});

test("inactive partner accounts remain recoverable without affecting active reconciliation", () => {
  const draft = filled();
  draft.partner = filled().profile;
  draft.partner.pensionTotal = field(100_000);
  draft.partner.nonPensionTotal = field(30_000);
  draft.accounts = [
    {
      id: "primary-savings",
      name: "Primary cash",
      owner: "primary",
      type: "cash",
      balance: field(70_000),
    },
    {
      id: "partner-savings",
      name: "Partner cash",
      owner: "partner",
      type: "cash",
      balance: field(30_000),
    },
    {
      id: "partner-pension",
      name: "Partner pension",
      owner: "partner",
      type: "pension",
      balance: field(100_000),
    },
  ];
  const solo = summariseDraft(draft);
  assert.equal(solo.accountTotals.nonPension, 70_000);
  assert.equal(solo.accountTotals.pension, null);
  assert.equal(solo.reconciliation[0].difference, 0);
  assert.equal(draft.accounts.length, 3);
  draft.planningScope = "household";
  draft.spendingBasis = "household";
  draft.householdStatus = "confirmed";
  assert.equal(summariseDraft(draft).accountTotals.nonPension, 100_000);
  draft.partner = null;
  draft.householdStatus = "pending";
  const withoutPartner = summariseDraft(draft);
  assert.equal(withoutPartner.accountTotals.nonPension, 70_000);
  assert.equal(withoutPartner.accountTotals.pension, null);
  assert.equal(withoutPartner.reconciliation[0].difference, 0);
  assert.equal(draft.accounts.length, 3);
});

test("two alternatives preserve complete overrides and a changed baseline flags saved comparisons", () => {
  let draft = filled();
  const overrides = {
    retirementAge: 56,
    monthlySpending: 2_800,
    partTimeAnnual: 8_000,
    partTimeEndAge: 60,
  };
  const first = createScenario(draft, "Reduce work", overrides);
  draft.scenarios.push(first);
  draft.scenarios.push(
    createScenario(draft, "Spend less", { monthlySpending: 2_600 }),
  );
  assert.throws(
    () => createScenario(draft, "A third alternative", {}),
    /two alternatives/i,
  );
  assert.deepEqual(first.overrides, overrides);
  const oldRevision = draft.revision;
  draft = updateBaseline(draft, { profile: { monthlySpending: field(3_200) } });
  assert.equal(draft.revision, oldRevision + 1);
  assert.equal(draft.profile.age.value, 52);
  assert.equal(
    draft.scenarios.every(
      (item) => item.stale && item.baseRevision === oldRevision,
    ),
    true,
  );
  assert.deepEqual(draft.scenarios[0].overrides, overrides);
  assert.equal(draft.reviewHistory.at(-1).profile.monthlySpending.value, 3_000);
  assert.equal(draft.reviewHistory.at(-1).details.housingIncluded, null);
  assert.equal(parseSaved(serialise(draft)).ok, true);
});

test("a scenario rejects unsupported keys or invalid compound timing instead of inventing a result", () => {
  const draft = filled();
  assert.throws(
    () => createScenario(draft, "Allocation", { recommendedFund: "anything" }),
    /unsupported/i,
  );
  assert.throws(
    () => evaluateExample("mixed-household", { retirementAge: 56 }),
    /retirement/i,
  );
  assert.throws(
    () =>
      evaluateExample("mixed-household", {
        partTimeAnnual: 8_000,
        partTimeEndAge: 59,
        retirementAge: 60,
      }),
    /part.time/i,
  );
});

test("named fictional examples are deterministic and never become a personal forecast", () => {
  assert.equal(examples.length, 3);
  const a = evaluateExample("early-dc");
  const b = evaluateExample("early-dc");
  assert.deepEqual(a, b);
  assert.equal(a.provenance.mode, "fictional-example");
  assert.match(a.assumptions.join(" "), /no UK tax engine/i);
  assert.equal("rows" in summariseDraft(filled()), false);
});

test("first mixed-household year reconciles independently specified flows in today’s pounds", () => {
  const row = evaluateExample("mixed-household").rows[0];
  // £130k accessible + 1% real growth + (£66k income - £45.6k spending).
  assert.equal(row.closingAccessible, 151_700);
  // £640k pensions + 2% real growth + (£700 + £350) × 12 contributions.
  assert.equal(row.closingPension, 665_400);
  assert.equal(row.closingTotal, 817_100);
  assert.equal(row.annualGap, 0);
  assert.equal(row.primaryAge, 57);
  assert.equal(row.partnerAge, 55);
});

test("early retirement exposes inaccessible pension money despite a large total pot", () => {
  const result = evaluateExample("early-dc");
  const gap = result.rows.find((row) => row.bridgeGap > 0);
  assert.ok(gap);
  assert.ok(gap.primaryAge < 60);
  assert.ok(gap.closingPension > 400_000);
  assert.equal(gap.closingAccessible, 0);
  assert.equal(gap.withdrawalsPension, 0);
  assert.ok(
    evaluateExample("early-dc", { retirementAge: 58 }).summary.bridgeGapTotal <
      result.summary.bridgeGapTotal,
  );
});

test("compound household changes preserve both dates, income end, spending and major cost", () => {
  const overrides = {
    retirementAge: 59,
    partnerRetirementAge: 61,
    monthlySpending: 3_500,
    monthlyContributions: 800,
    partTimeAnnual: 12_000,
    partTimeEndAge: 64,
    majorCost: 15_000,
    majorCostAge: 63,
  };
  const result = evaluateExample("mixed-household", overrides);
  assert.equal(result.changes.length, Object.keys(overrides).length);
  assert.equal(result.summary.retirementAge, 59);
  assert.equal(result.summary.partnerRetirementAge, 61);
  assert.equal(
    result.rows.find((row) => row.primaryAge === 59).incomeBreakdown.partTime,
    12_000,
  );
  assert.equal(
    result.rows.find((row) => row.primaryAge === 64).incomeBreakdown.partTime,
    0,
  );
  assert.equal(
    result.rows.find((row) => row.primaryAge === 63).majorCost,
    15_000,
  );
  assert.equal(
    result.rows.every((row) => row.spending === 42_000),
    true,
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.owner === "partner" &&
        event.type === "retirement" &&
        event.year === 2032,
    ),
  );
  assert.ok(
    result.events.some(
      (event) => event.type === "income-start" && event.label.includes("DB"),
    ),
  );
});

test("every fixture annual ledger reconciles without negative assets or hidden costs", () => {
  for (const example of examples) {
    const result = evaluateExample(example.id);
    for (const row of result.rows) {
      const accessible =
        row.openingAccessible +
        row.accessibleGrowth +
        Math.max(0, row.income - row.spending - row.majorCost) -
        row.withdrawalsAccessible;
      const pension =
        row.openingPension +
        row.pensionGrowth +
        row.contributions -
        row.withdrawalsPension;
      assert.ok(Math.abs(row.closingAccessible - accessible) < 0.03);
      assert.ok(Math.abs(row.closingPension - pension) < 0.03);
      const use =
        row.income +
        row.withdrawalsAccessible +
        row.withdrawalsPension +
        row.annualGap;
      assert.ok(
        Math.abs(Math.max(use, row.spending + row.majorCost) - use) < 0.03,
      );
      assert.ok(row.closingAccessible >= 0 && row.closingPension >= 0);
    }
  }
});


test("mortgage is inside stated spending and stops at the beginning of its end age", () => {
  const result = evaluateExample("early-dc", { mortgageMonthly: 900, mortgageEndAge: 60 });
  assert.equal(result.rows.find((r) => r.primaryAge === 59).spending, 36000);
  assert.equal(result.rows.find((r) => r.primaryAge === 59).mortgagePayment, 10800);
  assert.equal(result.rows.find((r) => r.primaryAge === 60).spending, 25200);
  assert.equal(result.rows.find((r) => r.primaryAge === 60).mortgagePayment, 0);
  assert.equal(result.events.filter((e) => e.type === "mortgage-end").length, 1);
  assert.throws(() => evaluateExample("early-dc", { mortgageMonthly: 3001 }), /cannot exceed/);
});

test("cash mortgage payoff debits accessible money once and removes monthly payments once", () => {
  const result = evaluateExample("early-dc", { mortgageMonthly: 1000, mortgageEndAge: 65, mortgagePayoffAmount: 30000, mortgagePayoffAge: 53 });
  const row = result.rows.find((r) => r.primaryAge === 53);
  assert.equal(row.mortgagePayoff, 30000);
  assert.equal(row.spending, 24000);
  assert.equal(row.mortgagePayment, 0);
  assert.equal(result.rows.reduce((sum, r) => sum + r.mortgagePayoff, 0), 30000);
  assert.equal(row.closingAccessible, 53407);
  assert.equal(result.rows.find((r) => r.primaryAge === 65).spending, 24000);
  assert.throws(() => evaluateExample("early-dc", { mortgagePayoffAmount: 80000, mortgagePayoffAge: 52 }), /exceeds accessible/);
});

test("home move releases only net cash and settlement stops payments without double counting home equity", () => {
  const result = evaluateExample("early-dc", { homeSaleAmount: 400000, replacementHomeCost: 250000, mortgageSettlement: 100000, movingCosts: 10000, downsizeAge: 55, mortgageMonthly: 800, mortgageEndAge: 65 });
  const row = result.rows.find((r) => r.primaryAge === 55);
  assert.equal(result.rows[0].openingAccessible, 70000);
  assert.equal(row.homeCashReleased, 40000);
  assert.equal(row.spending, 26400);
  assert.equal(row.mortgagePayment, 0);
  assert.equal(result.rows.reduce((sum, r) => sum + r.homeCashReleased, 0), 40000);
  assert.equal(result.rows.find((r) => r.primaryAge === 65).spending, 26400);
  const noSettlement = evaluateExample("early-dc", { homeSaleAmount: 300000, replacementHomeCost: 250000, downsizeAge: 55, mortgageMonthly: 800, mortgageEndAge: 65 });
  assert.equal(noSettlement.rows.find((r) => r.primaryAge === 55).spending, 36000);
  assert.throws(() => evaluateExample("early-dc", { homeSaleAmount: 100000, replacementHomeCost: 110000, downsizeAge: 55 }), /Home sale must cover/);
  assert.throws(() => evaluateExample("early-dc", { homeSaleAmount: 300000, mortgageSettlement: 20000, mortgagePayoffAmount: 20000, mortgagePayoffAge: 55, downsizeAge: 55 }), /not both/);
});

test("State Pension override changes only primary dated income and never adds to pension assets", () => {
  const base = evaluateExample("mixed-household");
  const result = evaluateExample("mixed-household", { statePensionAnnual: 14000, statePensionAge: 67 });
  assert.equal(result.rows.find((r) => r.primaryAge === 66).statePensionIncome, 0);
  assert.equal(result.rows.find((r) => r.primaryAge === 67).statePensionIncome, 14000);
  assert.equal(result.rows.find((r) => r.primaryAge === 67).incomeBreakdown.state, 14000);
  assert.equal(result.rows.find((r) => r.primaryAge === 70).incomeBreakdown.state, 24000);
  assert.equal(result.profile.incomeStreams.find((s) => s.owner === "partner" && s.type === "state").annualNet, 10000);
  assert.deepEqual(result.rows.filter((r) => r.primaryAge < 67), base.rows.filter((r) => r.primaryAge < 67));
  assert.equal(result.changes.find((c) => c.key === "statePensionAnnual").from, 10000);
  assert.ok(result.events.some((e) => e.type === "income-start" && e.owner === "primary" && e.label.includes("State Pension") && e.primaryAge === 67));
  const zero = evaluateExample("early-dc", { statePensionAnnual: 0 });
  assert.ok(zero.rows.every((r) => r.statePensionIncome === 0));
  assert.ok(!zero.events.some((e) => e.label.includes("State Pension")));
});

test("active decisions reject invalid timing but zero amounts create no fake events", () => {
  for (const change of [
    { mortgageMonthly: 900, mortgageEndAge: 51 },
    { mortgagePayoffAmount: 100, mortgagePayoffAge: 91 },
    { homeSaleAmount: 100, downsizeAge: 91 },
    { statePensionAnnual: 100, statePensionAge: 91 },
  ]) assert.throws(() => evaluateExample("early-dc", change), /within/);
  assert.equal(evaluateExample("early-dc", { horizonAge: 95, homeSaleAmount: 100, downsizeAge: 91 }).rows.find((r) => r.primaryAge === 91).homeCashReleased, 100);
  const inactive = evaluateExample("early-dc", { mortgagePayoffAmount: 0, mortgagePayoffAge: 18, homeSaleAmount: 0, downsizeAge: 18, mortgageMonthly: 0, mortgageEndAge: 18 });
  const base = evaluateExample("early-dc");
  assert.deepEqual(inactive.rows, base.rows);
  assert.deepEqual(inactive.events, base.events);
  for (const [key, value] of [["mortgagePayoffAmount", -1], ["homeSaleAmount", Infinity], ["downsizeAge", 55.5], ["statePensionAge", 101]])
    assert.throws(() => normaliseOverrides({ [key]: value }), /Invalid/);
});

test("combined home release cash payoff major expense and mortgage reduction reconcile annually", () => {
  const result = evaluateExample("early-dc", { homeSaleAmount: 400000, replacementHomeCost: 200000, movingCosts: 10000, downsizeAge: 55, mortgagePayoffAmount: 30000, mortgagePayoffAge: 55, mortgageMonthly: 500, mortgageEndAge: 60, majorCost: 15000, majorCostAge: 55, statePensionAnnual: 11000, statePensionAge: 66, horizonAge: 95 });
  const event = result.rows.find((r) => r.primaryAge === 55);
  assert.equal(event.homeCashReleased, 190000);
  assert.equal(event.mortgagePayoff, 30000);
  assert.equal(event.majorCost, 15000);
  assert.equal(event.spending, 30000);
  for (const r of result.rows) {
    const accessible = r.openingAccessible + r.accessibleGrowth + r.homeCashReleased - r.mortgagePayoff + Math.max(0, r.income - r.spending - r.majorCost) - r.withdrawalsAccessible;
    const pension = r.openingPension + r.pensionGrowth + r.contributions - r.withdrawalsPension;
    assert.ok(Math.abs(r.closingAccessible - accessible) < 0.03);
    assert.ok(Math.abs(r.closingPension - pension) < 0.03);
    assert.ok(Math.abs(r.income + r.withdrawalsAccessible + r.withdrawalsPension + r.annualGap - Math.max(r.income, r.spending + r.majorCost)) < 0.03);
    assert.ok(r.closingAccessible >= 0 && r.closingPension >= 0);
  }
});
