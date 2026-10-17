// Shared, authored choices. Landing previews and workspace handoffs use the same overrides.
export const landingChoices = [
  { id: "baseline", label: "Retire at 55", name: "Baseline", overrides: {} },
  {
    id: "later",
    label: "Retire at 58",
    name: "Retire at 58",
    overrides: { retirementAge: 58 },
  },
  {
    id: "part-time",
    label: "Work part-time",
    name: "Step back at 55 with part-time income",
    overrides: { retirementAge: 55, partTimeAnnual: 24000, partTimeEndAge: 60 },
  },
];
