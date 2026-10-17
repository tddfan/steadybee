import test from "node:test";
import assert from "node:assert/strict";
import { estimateUkTakeHome2026 } from "../prototype/uk-pay-estimate.mjs";

test("synthetic salary, bonus and pension rates produce an auditable annual estimate", () => {
  const result = estimateUkTakeHome2026({ baseSalary: 47000, bonus: 2000, employeePensionRate: 7, employerPensionRate: 8 });
  assert.equal(result.grossPay, 49000);
  assert.equal(result.employeePension, 3290);
  assert.equal(result.employerPension, 3760);
  assert.equal(result.incomeTax, 6628);
  assert.equal(result.employeeNI, 2914.40);
  assert.equal(result.takeHome, 36167.60);
});

test("pension contributions get net-pay income tax relief but not NI relief", () => {
  const result = estimateUkTakeHome2026({ baseSalary: 48000, bonus: 0, employeePensionAmount: 4000 });
  assert.equal(result.incomeTax, 6286);
  assert.equal(result.employeeNI, 2834.40);
  assert.equal(result.takeHome, 34879.60);
});

test("income tax personal allowance tapers to zero and inputs are bounded", () => {
  assert.equal(estimateUkTakeHome2026({ baseSalary: 125140 }).personalAllowance, 0);
  assert.throws(() => estimateUkTakeHome2026({ baseSalary: 100000, employeePensionRate: 7, employeePensionAmount: 1000 }), RangeError);
  assert.throws(() => estimateUkTakeHome2026({ baseSalary: -1 }), RangeError);
});
