/** Reporting facts derived from the annual ledger, never a personal forecast. */
export function exampleInsights(result) {
  const { rows, profile } = result;
  const gapPeriods = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.annualGap <= 0) continue;
    const kind = row.bridgeGap > 0 ? "access" : "later";
    let period = gapPeriods.at(-1);
    if (!period || period.end.year !== row.year - 1 || period.kind !== kind) {
      period = { kind, start: row, end: row, total: 0, nextCovered: null };
      gapPeriods.push(period);
    }
    period.end = row;
    period.total = Math.round((period.total + row.annualGap) * 100) / 100;
    const next = rows[index + 1];
    period.nextCovered = next?.annualGap === 0 ? next : null;
  }
  const firstGap = rows.find((row) => row.annualGap > 0) || null;
  const firstPensionWithdrawal =
    rows.find((row) => row.withdrawalsPension > 0) || null;
  const retirementRow = rows.find(
    (row) => row.primaryAge >= profile.primary.retirementAge,
  );
  return {
    firstGap,
    gapPeriods,
    firstPensionWithdrawal,
    yearsFromStart: firstGap ? firstGap.year - profile.startYear : null,
    yearsAfterRetirement:
      firstGap &&
      profile.primary.retirementAge >= profile.primary.age &&
      firstGap.primaryAge >= profile.primary.retirementAge
        ? firstGap.primaryAge - profile.primary.retirementAge
        : null,
    focusIndex: Math.max(
      0,
      rows.indexOf(
        firstGap || firstPensionWithdrawal || retirementRow || rows[0],
      ),
    ),
  };
}

export const exampleChoices = {
  "early-dc": [
    {
      id: "later",
      label: "Retire at 58",
      name: "Retire at 58",
      overrides: { retirementAge: 58 },
    },
    {
      id: "part-time",
      label: "Work part-time from 55",
      name: "Step back at 55 with part-time income",
      overrides: {
        retirementAge: 55,
        partTimeAnnual: 24000,
        partTimeEndAge: 60,
      },
    },
  ],
  "mixed-household": [
    {
      id: "household",
      label: "Try a combined household change",
      name: "Step back with part-time work",
      overrides: {
        retirementAge: 59,
        partnerRetirementAge: 59,
        partTimeAnnual: 15000,
        partTimeEndAge: 63,
        monthlySpending: 3200,
      },
    },
  ],
  "already-retired": [
    {
      id: "cost",
      label: "Try a £20k cost at 70",
      name: "A £20,000 one-off cost at 70",
      overrides: { majorCost: 20000, majorCostAge: 70 },
    },
    {
      id: "spending",
      label: "Try £2,000/month spending",
      name: "Spend £2,000 a month",
      overrides: { monthlySpending: 2000 },
    },
  ],
};
