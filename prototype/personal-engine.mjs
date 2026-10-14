/**
 * A deterministic, deliberately limited one-person cash-flow illustration.
 * Money inputs are pounds at the as-of date. Income and spending keep their
 * purchasing power through the selected inflation assumption. This is not a
 * UK tax calculation, a legal pension-access check, or financial advice.
 */

const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.2425;
const MAX_MONEY = 100_000_000;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const iso = (date) => date.toISOString().slice(0, 10);

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && iso(date) === value ? date : null;
}

function addYears(date, years) {
  const year = date.getUTCFullYear() + years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

function addMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const first = new Date(Date.UTC(year, month, 1));
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate());
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), day));
}

function ageOn(birthDate, date) {
  let age = date.getUTCFullYear() - birthDate.getUTCFullYear();
  if (date < addYears(birthDate, age)) age -= 1;
  return age;
}

function within(date, start, end) {
  return date > start && date < end;
}

function sumBalances(balance) {
  return balance.cash + balance.isa + balance.dc;
}

const DEFAULTS = Object.freeze({
  inflationRate: 0.025,
  investedReturnRate: 0.05,
  cashReturnRate: 0.02,
  shockRate: -0.2,
});

function normalized(input) {
  return { ...DEFAULTS, ...input };
}

/** Return validation errors before doing any personal calculation. */
export function validatePlan(input) {
  const errors = [];
  const warnings = [];
  const error = (field, message) => errors.push({ field, message });
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: [{ field: "plan", message: "Enter plan details." }], warnings };
  }
  const p = normalized(input);
  const birthDate = parseDate(p.birthDate);
  const asOfDate = parseDate(p.asOfDate);
  const accessDate = parseDate(p.pensionAccessDate);
  const hasDc = p.dc > 0 || p.annualDcContribution > 0;
  if (!birthDate) error("birthDate", "Enter a valid date of birth.");
  if (!asOfDate) error("asOfDate", "Enter a valid illustration date.");
  if (hasDc && !accessDate) error("pensionAccessDate", "Enter the first DC access date confirmed by your provider.");
  if (hasDc && p.pensionAccessConfirmed !== true) error("pensionAccessConfirmed", "Confirm that the first DC access date came from your provider or scheme information.");
  if (hasDc && p.dcTaxAssumptionConfirmed !== true) error("dcTaxAssumptionConfirmed", "Confirm the simplified effective tax assumption for DC withdrawals.");
  if (!["cash-first", "isa-first"].includes(p.withdrawalPolicy)) {
    error("withdrawalPolicy", "Choose cash first or ISA first before drawing DC pension.");
  }
  const integer = (key, minimum, maximum) => {
    if (!Number.isInteger(p[key]) || p[key] < minimum || p[key] > maximum) {
      error(key, `Enter a whole number from ${minimum} to ${maximum}.`);
    }
  };
  const number = (key, minimum, maximum) => {
    if (typeof p[key] !== "number" || !Number.isFinite(p[key]) || p[key] < minimum || p[key] > maximum) {
      error(key, `Enter a number from ${minimum} to ${maximum}. Use 0 when it is genuinely zero.`);
    }
  };
  integer("retirementAge", 18, 100);
  integer("endAge", 50, 110);
  if (p.annualStatePensionNet > 0) integer("statePensionAge", 60, 100);
  else if (p.statePensionAge !== 0) integer("statePensionAge", 18, 110);
  for (const key of ["spendingToday", "cash", "isa", "dc", "annualNetEarnings", "annualDcContribution", "annualStatePensionNet"]) {
    number(key, 0, MAX_MONEY);
  }
  if (hasDc) number("dcWithdrawalTaxRate", 0, 0.8);
  number("inflationRate", -0.05, 0.2);
  number("investedReturnRate", -0.95, 0.3);
  number("cashReturnRate", -0.95, 0.3);
  number("shockRate", -0.95, 0);
  if (birthDate && asOfDate) {
    const currentAge = ageOn(birthDate, asOfDate);
    if (currentAge < 18 || currentAge > 100) error("birthDate", "This one-person illustration supports ages 18 to 100 today.");
    if (p.endAge < currentAge) error("endAge", "The endpoint must follow your current age.");
    if (p.retirementAge > p.endAge) error("retirementAge", "The retirement age must be within the illustrated years.");
  }
  if (hasDc && birthDate && accessDate) {
    const accessAge = ageOn(birthDate, accessDate);
    if (accessDate < birthDate || accessAge < 55 || accessAge > 100) {
      error("pensionAccessDate", "This prototype supports a provider-supplied first DC access date from age 55 to 100. Earlier exceptional access is outside scope.");
    } else if (accessDate >= parseDate("2028-04-06") && accessAge < 57 && p.protectedPensionAgeConfirmed !== true) {
      error("protectedPensionAgeConfirmed", "For access at age 55 or 56 from 6 April 2028, confirm that your provider says this pot has a protected pension age.");
    }
  }
  if (p.spendingToday === 0) warnings.push({ field: "spendingToday", message: "Confirm that £0 annual spending is intentional." });
  if (birthDate && asOfDate && Number.isInteger(p.retirementAge) && addYears(birthDate, p.retirementAge) <= asOfDate && p.annualNetEarnings > 0) {
    warnings.push({ field: "annualNetEarnings", message: "Net earnings are ignored because the selected retirement date has passed." });
  }
  if (hasDc) {
    warnings.push({ field: "dcWithdrawalTaxRate", message: "DC tax is a flat user-selected effective proxy. This illustration does not calculate UK income tax, tax-free cash or tax bands." });
    warnings.push({ field: "pensionAccessDate", message: "The first-access date and any protected age are supplied by you from your provider. These checks do not determine legal eligibility." });
  }
  return { valid: errors.length === 0, errors, warnings, currentAge: birthDate && asOfDate ? ageOn(birthDate, asOfDate) : null };
}

function getPlan(input) {
  const validation = validatePlan(input);
  if (!validation.valid) {
    const problem = validation.errors.map(({ field, message }) => `${field}: ${message}`).join(" ");
    const error = new TypeError(problem);
    error.validation = validation;
    throw error;
  }
  return { plan: normalized(input), validation };
}

function moneyObject(source) {
  return { cash: round(source.cash), isa: round(source.isa), dc: round(source.dc) };
}

function simulate(p, validation, shockTiming = "none", anchor = null) {
  const birthDate = parseDate(p.birthDate);
  const asOfDate = parseDate(p.asOfDate);
  const hasDc = p.dc > 0 || p.annualDcContribution > 0;
  const pensionAccessDate = parseDate(p.pensionAccessDate);
  const retirementDate = addYears(birthDate, p.retirementAge);
  const statePensionDate = p.statePensionAge === 0 ? null : addYears(birthDate, p.statePensionAge);
  const currentAge = validation.currentAge;
  const horizonDate = addYears(birthDate, p.endAge + 1);
  const shockStart = anchor && shockTiming !== "none" ? addYears(anchor, shockTiming === "late" ? 5 : 0) : null;
  const shockEnd = shockStart ? addYears(shockStart, 1) : null;
  const shockAvailable = shockTiming === "none" || (shockStart !== null && shockEnd <= horizonDate);
  const actualShockStart = shockAvailable ? shockStart : null;
  const actualShockEnd = shockAvailable ? shockEnd : null;
  const months = [];
  for (let month = 1; ; month += 1) {
    const date = addMonths(asOfDate, month);
    if (date >= horizonDate) break;
    months.push(date);
  }
  const balance = { cash: p.cash, isa: p.isa, dc: p.dc };
  const years = [];
  let firstInvestedDrawdownDate = null;
  let firstGapAge = null;
  let firstBridgeGapAge = null;
  let firstLaterGapAge = null;
  const laterGapAges = [];
  const totals = {
    spendingNominal: 0,
    spendingToday: 0,
    uncoveredNominal: 0,
    uncoveredToday: 0,
    totalNetEarningsNominal: 0,
    totalStatePensionNetNominal: 0,
    totalDcTaxNominal: 0,
    totalDcContributionsNominal: 0,
  };

  for (let age = currentAge; age <= p.endAge; age += 1) {
    const birthday = addYears(birthDate, age);
    const nextBirthday = addYears(birthDate, age + 1);
    const start = birthday > asOfDate ? birthday : asOfDate;
    const end = nextBirthday;
    if (start >= end) continue;
    const ageYearDays = (end - birthday) / DAY_MS;
    const opening = { ...balance };
    const returns = { cash: 0, isa: 0, dc: 0 };
    const withdrawals = { cash: 0, isa: 0, dcGross: 0, dcTax: 0, dcNet: 0 };
    let netEarningsNominal = 0;
    let statePensionNetNominal = 0;
    let dcContributionsNominal = 0;
    let incomeUsedNominal = 0;
    let spendingNominal = 0;
    let spendingToday = 0;
    let uncoveredNominal = 0;
    let uncoveredToday = 0;
    let uncoveredBeforeAccessNominal = 0;
    let uncoveredBeforeAccessToday = 0;
    let uncoveredAfterAccessNominal = 0;
    let uncoveredAfterAccessToday = 0;
    const boundaries = [start, end];
    for (const date of months) if (within(date, start, end)) boundaries.push(date);
    for (const date of [retirementDate, statePensionDate, pensionAccessDate, actualShockStart, actualShockEnd]) {
      if (date && within(date, start, end)) boundaries.push(date);
    }
    boundaries.sort((a, b) => a - b);

    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const intervalStart = boundaries[index];
      const intervalEnd = boundaries[index + 1];
      const elapsedDays = (intervalEnd - intervalStart) / DAY_MS;
      if (elapsedDays <= 0) continue;
      const yearFraction = elapsedDays / YEAR_DAYS;
      const flowFraction = elapsedDays / ageYearDays;
      const midpointDays = (intervalStart - asOfDate) / DAY_MS + elapsedDays / 2;
      const inflationFactor = (1 + p.inflationRate) ** (midpointDays / YEAR_DAYS);
      const inShock = actualShockStart && intervalStart >= actualShockStart && intervalStart < actualShockEnd;
      const investedRate = inShock ? p.shockRate : p.investedReturnRate;
      const investedExponent = inShock ? elapsedDays / ((actualShockEnd - actualShockStart) / DAY_MS) : yearFraction;
      const cashGrowth = balance.cash * ((1 + p.cashReturnRate) ** yearFraction - 1);
      const isaGrowth = balance.isa * ((1 + investedRate) ** investedExponent - 1);
      const dcGrowth = balance.dc * ((1 + investedRate) ** investedExponent - 1);
      balance.cash += cashGrowth;
      balance.isa += isaGrowth;
      balance.dc += dcGrowth;
      returns.cash += cashGrowth;
      returns.isa += isaGrowth;
      returns.dc += dcGrowth;

      const working = intervalStart < retirementDate;
      const earnings = working ? p.annualNetEarnings * flowFraction * inflationFactor : 0;
      const pensionIncome = statePensionDate && intervalStart >= statePensionDate ? p.annualStatePensionNet * flowFraction * inflationFactor : 0;
      const contribution = working ? p.annualDcContribution * flowFraction * inflationFactor : 0;
      const spending = p.spendingToday * flowFraction * inflationFactor;
      netEarningsNominal += earnings;
      statePensionNetNominal += pensionIncome;
      dcContributionsNominal += contribution;
      spendingNominal += spending;
      spendingToday += spending / inflationFactor;
      balance.dc += contribution;

      const income = earnings + pensionIncome;
      const incomeUsed = Math.min(spending, income);
      incomeUsedNominal += incomeUsed;
      balance.cash += income - incomeUsed;
      let needed = spending - incomeUsed;
      const order = p.withdrawalPolicy === "isa-first" ? ["isa", "cash"] : ["cash", "isa"];
      for (const pot of order) {
        const used = Math.min(needed, balance[pot]);
        balance[pot] -= used;
        withdrawals[pot] += used;
        needed -= used;
      }
      if (hasDc && needed > 0 && intervalStart >= pensionAccessDate && p.dcWithdrawalTaxRate < 1) {
        const gross = Math.min(balance.dc, needed / (1 - p.dcWithdrawalTaxRate));
        const tax = gross * p.dcWithdrawalTaxRate;
        const net = gross - tax;
        balance.dc -= gross;
        withdrawals.dcGross += gross;
        withdrawals.dcTax += tax;
        withdrawals.dcNet += net;
        needed -= net;
      }
      if (needed > 1e-8) {
        uncoveredNominal += needed;
        uncoveredToday += needed / inflationFactor;
        if (hasDc && intervalStart < pensionAccessDate) {
          uncoveredBeforeAccessNominal += needed;
          uncoveredBeforeAccessToday += needed / inflationFactor;
        } else {
          uncoveredAfterAccessNominal += needed;
          uncoveredAfterAccessToday += needed / inflationFactor;
        }
      }
      if (!firstInvestedDrawdownDate && (withdrawals.isa > 0 || withdrawals.dcGross > 0)) {
        firstInvestedDrawdownDate = intervalStart;
      }
    }

    const accessStatus = !hasDc ? "not-applicable" : pensionAccessDate <= start ? "available" : pensionAccessDate >= end ? "locked" : "mixed";
    const startInflationFactor = (1 + p.inflationRate) ** (((start - asOfDate) / DAY_MS) / YEAR_DAYS);
    const inflationFactor = (1 + p.inflationRate) ** (((end - asOfDate) / DAY_MS) / YEAR_DAYS);
    const row = {
      age,
      startDate: iso(start),
      endDate: iso(end),
      accessStatus,
      dcLocked: accessStatus === "locked" || accessStatus === "mixed",
      inflationFactor: round(inflationFactor * 1_000_000) / 1_000_000,
      spendingInflationFactor: spendingToday > 0 ? round((spendingNominal / spendingToday) * 1_000_000) / 1_000_000 : null,
      opening: moneyObject(opening),
      openingToday: moneyObject({ cash: opening.cash / startInflationFactor, isa: opening.isa / startInflationFactor, dc: opening.dc / startInflationFactor }),
      returns: moneyObject(returns),
      afterReturn: moneyObject({ cash: opening.cash + returns.cash, isa: opening.isa + returns.isa, dc: opening.dc + returns.dc }),
      netEarningsNominal: round(netEarningsNominal),
      statePensionNetNominal: round(statePensionNetNominal),
      dcContributionsNominal: round(dcContributionsNominal),
      incomeUsedNominal: round(incomeUsedNominal),
      spendingNominal: round(spendingNominal),
      spendingToday: round(spendingToday),
      withdrawals: Object.fromEntries(Object.entries(withdrawals).map(([key, value]) => [key, round(value)])),
      uncoveredNominal: round(uncoveredNominal),
      uncoveredToday: round(uncoveredToday),
      uncoveredBeforeAccessNominal: round(uncoveredBeforeAccessNominal),
      uncoveredBeforeAccessToday: round(uncoveredBeforeAccessToday),
      uncoveredAfterAccessNominal: round(uncoveredAfterAccessNominal),
      uncoveredAfterAccessToday: round(uncoveredAfterAccessToday),
      closing: moneyObject(balance),
      closingToday: moneyObject({ cash: balance.cash / inflationFactor, isa: balance.isa / inflationFactor, dc: balance.dc / inflationFactor }),
      covered: uncoveredNominal < 0.005,
    };
    years.push(row);
    if (uncoveredNominal >= 0.005) {
      if (firstGapAge === null) firstGapAge = age;
      if (uncoveredBeforeAccessNominal >= 0.005 && firstBridgeGapAge === null) firstBridgeGapAge = age;
      if (uncoveredAfterAccessNominal >= 0.005) {
        if (firstLaterGapAge === null) firstLaterGapAge = age;
        laterGapAges.push(age);
      }
    }
    totals.spendingNominal += spendingNominal;
    totals.spendingToday += spendingToday;
    totals.uncoveredNominal += uncoveredNominal;
    totals.uncoveredToday += uncoveredToday;
    totals.totalNetEarningsNominal += netEarningsNominal;
    totals.totalStatePensionNetNominal += statePensionNetNominal;
    totals.totalDcTaxNominal += withdrawals.dcTax;
    totals.totalDcContributionsNominal += dcContributionsNominal;
  }

  const totalsRounded = Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)]));
  totalsRounded.finalBalances = moneyObject(balance);
  totalsRounded.finalTotal = round(sumBalances(balance));
  const horizonInflationFactor = (1 + p.inflationRate) ** (((horizonDate - asOfDate) / DAY_MS) / YEAR_DAYS);
  totalsRounded.finalBalancesToday = moneyObject({ cash: balance.cash / horizonInflationFactor, isa: balance.isa / horizonInflationFactor, dc: balance.dc / horizonInflationFactor });
  totalsRounded.finalTotalToday = round(sumBalances(balance) / horizonInflationFactor);
  const warnings = [...validation.warnings];
  if (!shockAvailable) warnings.push({ field: "shockTiming", message: "The selected horizon has no full one-year shock window at that timing, or no ISA/DC drawdown starts within it." });
  const assumptions = {
    asOfDate: p.asOfDate,
    birthDate: p.birthDate,
    currentAge,
    retirementAge: p.retirementAge,
    retirementDate: iso(retirementDate),
    endAge: p.endAge,
    horizonEndDate: iso(horizonDate),
    pensionAccessDate: hasDc ? p.pensionAccessDate : null,
    accessRule: hasDc ? "DC is available only from the first-access date supplied as provider-confirmed by the user. Access before 55 is outside scope; access at 55 or 56 from 6 April 2028 requires a user-confirmed protected age. Legal eligibility is not verified." : "Not applicable: no DC balance or contributions are entered.",
    protectedPensionAgeConfirmed: hasDc ? p.protectedPensionAgeConfirmed === true : null,
    accessTiming: hasDc ? "The model splits monthly cash-flow periods at the supplied access date and never draws DC before it." : "Not applicable: no DC balance or contributions are entered.",
    withdrawalPolicy: p.withdrawalPolicy,
    dcWithdrawalTaxRate: hasDc ? p.dcWithdrawalTaxRate : null,
    dcTaxTreatment: hasDc ? "A flat user-selected effective percentage is deducted from every DC withdrawal; UK income tax, tax-free cash, bands and personal allowance are not calculated." : "Not applicable: no DC balance or contributions are entered.",
    statePensionAge: p.statePensionAge,
    statePensionDate: statePensionDate ? iso(statePensionDate) : null,
    inflationRate: p.inflationRate,
    investedReturnRate: p.investedReturnRate,
    cashReturnRate: p.cashReturnRate,
    inflationTreatment: "Spending, net earnings, DC contributions and net State Pension estimates are entered in today's pounds then inflated into nominal withdrawals and income each year. Today's-pound rows divide by the same inflation factor.",
    returnTiming: "Nominal returns accrue between roughly monthly cash flows. Cash uses its cash rate; ISA and DC use the invested return. A shock replaces the invested return for one year only.",
    contributionTreatment: "Net earnings are spendable pay after regular DC contributions. The separately entered DC contribution is added while working; unused net earnings stay in cash.",
    statePensionTreatment: "State Pension is a user-entered net estimate from the selected age, indexed by the inflation assumption; entitlement and tax are not checked.",
    shockTiming,
    shockRate: p.shockRate,
    shockDurationYears: 1,
    shockYearsAfterDrawdown: shockTiming === "early" ? 0 : shockTiming === "late" ? 5 : null,
    firstInvestedDrawdownDate: anchor ? iso(anchor) : firstInvestedDrawdownDate ? iso(firstInvestedDrawdownDate) : null,
    shockStartDate: actualShockStart ? iso(actualShockStart) : null,
    shockEndDate: actualShockEnd ? iso(actualShockEnd) : null,
    shockAge: actualShockStart ? ageOn(birthDate, actualShockStart) : null,
    shockAvailable,
    claim: "Conditional illustration, not a verified personal forecast or advice.",
  };
  return { assumptions, years, firstGapAge, firstBridgeGapAge, firstLaterGapAge, laterGapAges, totals: totalsRounded, warnings };
}

/** Project from today through the end of the selected endpoint age. */
export function projectPlan(input, options = {}) {
  const { plan, validation } = getPlan(input);
  const shockTiming = options.shockTiming ?? "none";
  if (!["none", "early", "late"].includes(shockTiming)) throw new TypeError("shockTiming must be none, early or late.");
  const baseline = simulate(plan, validation);
  if (shockTiming === "none") return baseline;
  const anchor = baseline.assumptions.firstInvestedDrawdownDate
    ? parseDate(baseline.assumptions.firstInvestedDrawdownDate)
    : null;
  return simulate(plan, validation, shockTiming, anchor);
}

/** Show a user-chosen alternative beside one baseline and two return sequences. */
export function comparePlans(input, alternativeOverrides = {}) {
  return {
    baseline: projectPlan(input),
    alternative: projectPlan({ ...input, ...alternativeOverrides }),
    earlyShock: projectPlan(input, { shockTiming: "early" }),
    lateShock: projectPlan(input, { shockTiming: "late" }),
  };
}
