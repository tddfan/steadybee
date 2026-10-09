/**
 * Deterministic worked examples. These fictional inputs are not UK tax/pension
 * rules, a personal planning engine, or investment recommendations.
 */
import { createDraft, field, normaliseOverrides } from "./state.mjs";

export const FIXTURE_VERSION = "2026-10-09.3";
const SOURCE_DATE = "2026-10-09";
const round = (amount) => Math.round((amount + Number.EPSILON) * 100) / 100;
const clone = (value) => JSON.parse(JSON.stringify(value));

const source = [
  {
    id: "early-dc",
    name: "Alex · an early retirement bridge",
    description:
      "A fictional 52-year-old compares retiring at 55 with waiting until 58. Their pension becomes accessible at an assumed age 60.",
    profile: {
      startYear: 2026,
      horizonAge: 90,
      monthlySpending: 3_000,
      realAccessibleReturn: 0.01,
      realPensionReturn: 0.02,
      primary: {
        name: "Alex",
        age: 52,
        retirementAge: 55,
        pensionPot: 400_000,
        pensionAccessAge: 60,
        savings: 70_000,
        monthlyContributions: 600,
        employmentAnnualNet: 36_000,
      },
      partner: null,
      incomeStreams: [
        {
          owner: "primary",
          type: "state",
          label: "Alex’s fictional later pension income",
          annualNet: 12_000,
          startAge: 67,
          endAge: null,
        },
      ],
      partTimeAnnual: 0,
      partTimeEndAge: 60,
      majorCost: 0,
      majorCostAge: 65,
    },
  },
  {
    id: "mixed-household",
    name: "Morgan & Sam · plan together",
    description:
      "A fictional household with invested pots and promised DB income compares both retirement dates, part-time work, spending and a major cost together.",
    profile: {
      startYear: 2026,
      horizonAge: 90,
      monthlySpending: 3_800,
      realAccessibleReturn: 0.01,
      realPensionReturn: 0.02,
      primary: {
        name: "Morgan",
        age: 57,
        retirementAge: 60,
        pensionPot: 420_000,
        pensionAccessAge: 60,
        savings: 90_000,
        monthlyContributions: 700,
        employmentAnnualNet: 42_000,
      },
      partner: {
        name: "Sam",
        age: 55,
        retirementAge: 62,
        pensionPot: 220_000,
        pensionAccessAge: 60,
        savings: 40_000,
        monthlyContributions: 350,
        employmentAnnualNet: 24_000,
      },
      incomeStreams: [
        {
          owner: "primary",
          type: "db",
          label: "Morgan’s fictional DB income",
          annualNet: 12_000,
          startAge: 62,
          endAge: null,
        },
        {
          owner: "partner",
          type: "db",
          label: "Sam’s fictional DB income",
          annualNet: 6_000,
          startAge: 65,
          endAge: null,
        },
        {
          owner: "primary",
          type: "state",
          label: "Morgan’s fictional later pension income",
          annualNet: 10_000,
          startAge: 68,
          endAge: null,
        },
        {
          owner: "partner",
          type: "state",
          label: "Sam’s fictional later pension income",
          annualNet: 10_000,
          startAge: 68,
          endAge: null,
        },
      ],
      partTimeAnnual: 0,
      partTimeEndAge: 65,
      majorCost: 0,
      majorCostAge: 70,
    },
  },
  {
    id: "already-retired",
    name: "Priya · a retired income picture",
    description:
      "A fictional 66-year-old brings regular pension income, accessible savings and an invested pot together, with later income starting at an assumed age 68.",
    profile: {
      startYear: 2026,
      horizonAge: 90,
      monthlySpending: 2_200,
      realAccessibleReturn: 0.01,
      realPensionReturn: 0.02,
      primary: {
        name: "Priya",
        age: 66,
        retirementAge: 64,
        pensionPot: 200_000,
        pensionAccessAge: 64,
        savings: 50_000,
        monthlyContributions: 0,
        employmentAnnualNet: 0,
      },
      partner: null,
      incomeStreams: [
        {
          owner: "primary",
          type: "db",
          label: "Priya’s fictional current pension income",
          annualNet: 10_000,
          startAge: 64,
          endAge: null,
        },
        {
          owner: "primary",
          type: "state",
          label: "Priya’s fictional later pension income",
          annualNet: 11_000,
          startAge: 68,
          endAge: null,
        },
      ],
      partTimeAnnual: 0,
      partTimeEndAge: 70,
      majorCost: 0,
      majorCostAge: 72,
    },
  },
];

function exampleDraft(example) {
  const p = example.profile,
    route = example.id === "already-retired" ? "retired" : "dc";
  const draft = createDraft(route, p.partner ? "household" : "individual");
  draft.draftId = `fictional-${example.id}`;
  draft.mode = "fictional-example";
  draft.fixtureId = example.id;
  draft.updatedAt = `${SOURCE_DATE}T00:00:00.000Z`;
  const assignPerson = (person) => ({
    age: field(person.age),
    targetRetirementAge: field(person.retirementAge),
    pensionTotal: field(person.pensionPot),
    nonPensionTotal: field(person.savings),
    annualPensionIncome: field(
      p.incomeStreams
        .filter(
          (stream) =>
            stream.owner === (person === p.primary ? "primary" : "partner"),
        )
        .reduce((sum, stream) => sum + stream.annualNet, 0),
    ),
    monthlySpending: field(p.monthlySpending),
    retirementStatus:
      person.retirementAge < person.age ? "already-retired" : "working",
    incomeBasis: "net",
    savingsAccessibility: "accessible",
  });
  draft.profile = assignPerson(p.primary);
  draft.partner = p.partner ? assignPerson(p.partner) : null;
  draft.householdStatus = p.partner ? "confirmed" : "individual";
  draft.details.monthlyContributions = field(p.primary.monthlyContributions);
  draft.details.employerIncluded = true;
  draft.details.pensionAccessAge = field(p.primary.pensionAccessAge);
  draft.details.cashTotal = field(
    p.primary.savings + (p.partner?.savings || 0),
  );
  draft.details.investedTotal = field(0);
  draft.details.housingIncluded = true;
  draft.details.incomeStreams = p.incomeStreams.map((stream, index) => ({
    id: `income-${example.id}-${index}`,
    owner: stream.owner,
    type: stream.type,
    label: stream.label,
    annualAmount: field(stream.annualNet),
    startAge: field(stream.startAge),
    endAge: field(stream.endAge),
    incomeBasis: "net",
  }));
  draft.ui.activeView = "overview";
  return draft;
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

export const examples = freeze(
  source.map((example) => ({ ...example, draft: exampleDraft(example) })),
);

const changeLabels = {
  retirementAge: "Morgan / primary retirement age",
  partnerRetirementAge: "Partner retirement age",
  monthlySpending: "Monthly household spending",
  monthlyContributions: "Primary monthly pension contributions",
  partTimeAnnual: "Annual part-time income (net-assumed)",
  partTimeEndAge: "Primary age when part-time income ends",
  majorCost: "One-off major cost",
  majorCostAge: "Primary age at the major cost",
  horizonAge: "Illustrated horizon (primary age)",
};

function baselineValue(profile, key) {
  if (key === "retirementAge") return profile.primary.retirementAge;
  if (key === "partnerRetirementAge")
    return profile.partner?.retirementAge ?? null;
  if (key === "monthlyContributions")
    return profile.primary.monthlyContributions;
  return profile[key];
}

export function evaluateExample(exampleId, overrides = {}) {
  const example = examples.find((item) => item.id === exampleId);
  if (!example) throw new Error("Choose a named fictional example.");
  const clean = normaliseOverrides(overrides),
    p = clone(example.profile),
    original = example.profile;
  if (clean.retirementAge !== undefined)
    p.primary.retirementAge = clean.retirementAge;
  if (clean.partnerRetirementAge !== undefined) {
    if (!p.partner) throw new Error("This example has no partner.");
    p.partner.retirementAge = clean.partnerRetirementAge;
  }
  if (clean.monthlyContributions !== undefined)
    p.primary.monthlyContributions = clean.monthlyContributions;
  for (const key of [
    "monthlySpending",
    "partTimeAnnual",
    "partTimeEndAge",
    "majorCost",
    "majorCostAge",
    "horizonAge",
  ])
    if (clean[key] !== undefined) p[key] = clean[key];
  if (
    original.primary.retirementAge >= original.primary.age &&
    p.primary.retirementAge < p.primary.age
  )
    throw new Error(
      "Retirement cannot precede this fictional person’s current age.",
    );
  if (
    original.primary.retirementAge < original.primary.age &&
    clean.retirementAge !== undefined &&
    p.primary.retirementAge !== original.primary.retirementAge
  )
    throw new Error(
      "Past retirement timing is fixed in the already-retired example.",
    );
  if (p.partner && p.partner.retirementAge < p.partner.age)
    throw new Error("Partner retirement cannot precede their current age.");
  if (
    p.partTimeAnnual > 0 &&
    p.partTimeEndAge <= Math.max(p.primary.retirementAge, p.primary.age)
  )
    throw new Error(
      "Part-time income must end after retirement or the current age.",
    );
  if (p.majorCost > 0 && p.majorCostAge < p.primary.age)
    throw new Error("A major cost cannot be placed before the example starts.");
  if (p.majorCost > 0 && p.majorCostAge > p.horizonAge)
    throw new Error("A major cost is outside this worked example’s horizon.");
  if (
    p.primary.retirementAge > p.horizonAge ||
    (p.partner &&
      p.partner.retirementAge > p.partner.age + p.horizonAge - p.primary.age)
  )
    throw new Error("Retirement is outside this worked example’s horizon.");

  const people = [
    { owner: "primary", ...p.primary },
    ...(p.partner ? [{ owner: "partner", ...p.partner }] : []),
  ];
  let accessible = people.reduce((sum, person) => sum + person.savings, 0);
  const pots = Object.fromEntries(
    people.map((person) => [person.owner, person.pensionPot]),
  );
  const rows = [],
    events = [];
  let cumulativeGap = 0;
  const event = (type, label, owner, age) => {
    const person = people.find((item) => item.owner === owner);
    const offset = age - person.age;
    events.push({
      type,
      label,
      owner,
      year: p.startYear + offset,
      primaryAge: p.primary.age + offset,
      partnerAge: p.partner ? p.partner.age + offset : null,
    });
  };
  for (const person of people) {
    event(
      "retirement",
      `${person.name} ${person.retirementAge < person.age ? "retired" : "retires"} at ${person.retirementAge}`,
      person.owner,
      person.retirementAge,
    );
    event(
      "pension-access",
      `${person.name}’s invested pot is accessible at the fictional age ${person.pensionAccessAge}`,
      person.owner,
      person.pensionAccessAge,
    );
  }
  for (const stream of p.incomeStreams)
    event(
      "income-start",
      `${stream.label} starts at ${stream.startAge}`,
      stream.owner,
      stream.startAge,
    );
  if (p.partTimeAnnual > 0) {
    event(
      "part-time-start",
      `${p.primary.name}’s part-time income starts`,
      "primary",
      Math.max(p.primary.age, p.primary.retirementAge),
    );
    event(
      "part-time-end",
      `${p.primary.name}’s part-time income ends at ${p.partTimeEndAge}`,
      "primary",
      p.partTimeEndAge,
    );
  }
  if (p.majorCost > 0)
    event(
      "major-cost",
      `One-off cost of £${p.majorCost.toLocaleString("en-GB")}`,
      "primary",
      p.majorCostAge,
    );

  for (let offset = 0; offset <= p.horizonAge - p.primary.age; offset++) {
    const primaryAge = p.primary.age + offset,
      partnerAge = p.partner ? p.partner.age + offset : null;
    const openingAccessible = accessible,
      openingPension = Object.values(pots).reduce(
        (sum, amount) => sum + amount,
        0,
      );
    const accessibleGrowth = accessible * p.realAccessibleReturn;
    accessible += accessibleGrowth;
    let pensionGrowth = 0,
      contributions = 0;
    const incomeBreakdown = {
      employment: 0,
      db: 0,
      state: 0,
      other: 0,
      partTime: 0,
    };
    for (const person of people) {
      const age = person.age + offset;
      const growth = pots[person.owner] * p.realPensionReturn;
      pots[person.owner] += growth;
      pensionGrowth += growth;
      if (age < person.retirementAge) {
        const amount = person.monthlyContributions * 12;
        pots[person.owner] += amount;
        contributions += amount;
        incomeBreakdown.employment += person.employmentAnnualNet;
      }
    }
    if (primaryAge >= p.primary.retirementAge && primaryAge < p.partTimeEndAge)
      incomeBreakdown.partTime = p.partTimeAnnual;
    for (const stream of p.incomeStreams) {
      const age = stream.owner === "partner" ? partnerAge : primaryAge;
      if (
        age >= stream.startAge &&
        (stream.endAge === null || age < stream.endAge)
      )
        incomeBreakdown[stream.type] += stream.annualNet;
    }
    const income = Object.values(incomeBreakdown).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const spending = p.monthlySpending * 12,
      majorCost = primaryAge === p.majorCostAge ? p.majorCost : 0;
    let need = Math.max(0, spending + majorCost - income);
    if (income > spending + majorCost)
      accessible += income - spending - majorCost;
    const withdrawalsAccessible = Math.min(accessible, need);
    accessible -= withdrawalsAccessible;
    need -= withdrawalsAccessible;
    let withdrawalsPension = 0;
    for (const person of people) {
      if (person.age + offset < person.pensionAccessAge) continue;
      const withdrawal = Math.min(pots[person.owner], need);
      pots[person.owner] -= withdrawal;
      withdrawalsPension += withdrawal;
      need -= withdrawal;
    }
    const annualGap = Math.max(0, need);
    const inaccessiblePension = people
      .filter((person) => person.age + offset < person.pensionAccessAge)
      .reduce((sum, person) => sum + pots[person.owner], 0);
    const bridgeGap = inaccessiblePension > 0 ? annualGap : 0;
    cumulativeGap += annualGap;
    const closingPension = Object.values(pots).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    rows.push({
      year: p.startYear + offset,
      primaryAge,
      partnerAge,
      openingAccessible: round(openingAccessible),
      openingPension: round(openingPension),
      accessibleGrowth: round(accessibleGrowth),
      pensionGrowth: round(pensionGrowth),
      contributions: round(contributions),
      income: round(income),
      incomeBreakdown,
      spending: round(spending),
      majorCost: round(majorCost),
      withdrawalsAccessible: round(withdrawalsAccessible),
      withdrawalsPension: round(withdrawalsPension),
      closingAccessible: round(accessible),
      closingPension: round(closingPension),
      closingLockedPension: round(inaccessiblePension),
      closingAvailablePension: round(closingPension - inaccessiblePension),
      closingTotal: round(accessible + closingPension),
      annualGap: round(annualGap),
      cumulativeGap: round(cumulativeGap),
      bridgeGap: round(bridgeGap),
      phase: people.every(
        (person) => person.age + offset >= person.retirementAge,
      )
        ? "retired"
        : people.every((person) => person.age + offset < person.retirementAge)
          ? "working"
          : "mixed",
    });
  }
  const firstGap = rows.find((row) => row.annualGap > 0),
    bridgeYears = rows.filter((row) => row.bridgeGap > 0),
    final = rows.at(-1);
  const changes = Object.entries(clean)
    .filter(([key, to]) => to !== baselineValue(original, key))
    .map(([key, to]) => ({
      key,
      label:
        key === "retirementAge"
          ? `${p.primary.name} retirement age`
          : key === "partnerRetirementAge"
            ? `${p.partner.name} retirement age`
            : key === "monthlyContributions"
              ? `${p.primary.name} pension contributions / month`
              : key === "partTimeEndAge"
                ? `Part-time income ends at ${p.primary.name} age`
                : key === "majorCostAge"
                  ? `One-off cost at ${p.primary.name} age`
                  : key === "monthlySpending" && !p.partner
                    ? "Monthly spending"
                    : changeLabels[key],
      from: baselineValue(original, key),
      to,
    }));
  const summary = {
    firstGapYear: firstGap?.year ?? null,
    firstGapAge: firstGap?.primaryAge ?? null,
    bridgeGapYears: bridgeYears.map((row) => row.year),
    bridgeGapTotal: round(
      bridgeYears.reduce((sum, row) => sum + row.bridgeGap, 0),
    ),
    totalGap: final.cumulativeGap,
    finalAccessible: final.closingAccessible,
    finalPension: final.closingPension,
    finalTotal: final.closingTotal,
    horizonAge: p.horizonAge,
    retirementAge: p.primary.retirementAge,
    partnerRetirementAge: p.partner?.retirementAge ?? null,
    retirementYear: p.startYear + p.primary.retirementAge - p.primary.age,
    partnerRetirementYear: p.partner
      ? p.startYear + p.partner.retirementAge - p.partner.age
      : null,
    monthlySpending: p.monthlySpending,
    statement: firstGap
      ? `This fictional illustration first has spending not covered in ${firstGap.year} (${p.primary.name} age ${firstGap.primaryAge}). Later years may be covered; earlier gaps remain unpaid.`
      : `The fictional inputs cover the stated spending through primary age ${p.horizonAge} under these fixed assumptions.`,
  };
  const assumptions = [
    "Fictional worked example only. Illustration, not advice. No personal retirement calculation is connected.",
    "All wages and pension streams are fictional net-assumed amounts; no UK tax engine is used. Pot withdrawals are assumed spendable pound for pound, with no tax deductions.",
    `All amounts are in today’s pounds. Accessible savings have a fixed ${(p.realAccessibleReturn * 100).toFixed(0)}% annual real return; invested pension pots have a fixed ${(p.realPensionReturn * 100).toFixed(0)}% annual real return, both after an assumed fee allowance. These are chosen illustrative assumptions, not market estimates.`,
    "Each year: opening assets grow, working contributions are added, income meets spending, then accessible savings are used before eligible pension pots. Growth uses opening balances. Income above spending is saved to accessible money.",
    "Net employment income is assumed after the supplied pension contributions; those contributions include the employer and stop at each person’s chosen retirement age.",
    "Promised DB and later pension income start at the fixed fictional ages shown. Changing retirement dates does not alter DB income or infer scheme terms. Pension access ages are supplied fictional facts, not current eligibility rules.",
    "Monthly spending includes housing and debt payments in these examples. A scenario’s major cost is additional, one time only, at the primary person’s selected age. Spending and income stay constant in real pounds.",
    `The horizon is the end of primary age ${p.horizonAge}. This does not infer lifespan. Income ending at a stated age stops at the beginning of that year.`,
    "Uncovered spending is reported as an annual gap and accumulated unpaid amount. Assets never become negative. No borrowing, deficit interest or automatic spending reduction is assumed.",
    "No tax, survivor/death benefits, changing investment returns, scheme-specific DB reductions or regulated recommendations are modelled. A covered fictional path is not proof of retirement affordability.",
  ];
  return {
    rows,
    summary,
    assumptions,
    changes,
    events: events.sort(
      (a, b) => a.year - b.year || a.owner.localeCompare(b.owner),
    ),
    profile: p,
    provenance: {
      mode: "fictional-example",
      fixtureId: exampleId,
      fixtureVersion: FIXTURE_VERSION,
      sourceDate: SOURCE_DATE,
      overrides: clean,
    },
  };
}
