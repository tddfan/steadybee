import test from "node:test";
import assert from "node:assert/strict";
import { estimateUkTakeHome2026 } from "../prototype/uk-pay-estimate.mjs";

test("Alex salary, bonus and base-pay pension rates produce an auditable annual estimate", () => {
  const result = estimateUkTakeHome2026({ baseSalary: 146500, bonus: 50000, employeePensionRate: 7, employerPensionRate: 16 });
  assert.equal(result.grossPay, 196500);
  assert.equal(result.employeePension, 10255);
  assert.equal(result.employerPension, 23440);
  assert.equal(result.incomeTax, 70013.25);
  assert.equal(result.employeeNI, 5940.60);
  assert.equal(result.takeHome, 110291.15);
});

test("Gemma annual pension amount gets net-pay income tax relief but not NI relief", () => {
  const result = estimateUkTakeHome2026({ baseSalary: 100000, bonus: 0, employeePensionAmount: 25000 });
  assert.equal(result.incomeTax, 17432);
  assert.equal(result.employeeNI, 4010.60);
  assert.equal(result.takeHome, 53557.40);
});

test("income tax personal allowance tapers to zero and inputs are bounded", () => {
  assert.equal(estimateUkTakeHome2026({ baseSalary: 125140 }).personalAllowance, 0);
  assert.throws(() => estimateUkTakeHome2026({ baseSalary: 100000, employeePensionRate: 7, employeePensionAmount: 1000 }), RangeError);
  assert.throws(() => estimateUkTakeHome2026({ baseSalary: -1 }), RangeError);
});
