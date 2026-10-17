import test from "node:test";
import assert from "node:assert/strict";
import { estimateRepaymentMortgagePayment } from "../prototype/mortgage-payment.mjs";

test("example 21-year repayment mortgage computes a penny-rounded monthly payment", () => {
  assert.equal(estimateRepaymentMortgagePayment({ balance: 235000, annualRate: 4.3, remainingYears: 25 }), 1279.67);
});

test("zero interest divides principal across remaining months", () => {
  assert.equal(estimateRepaymentMortgagePayment({ balance: 120000, annualRate: 0, remainingYears: 10 }), 1000);
});

test("missing or invalid mortgage inputs cannot invent a payment", () => {
  assert.equal(estimateRepaymentMortgagePayment({ balance: 235000, annualRate: undefined, remainingYears: 25 }), null);
  assert.equal(estimateRepaymentMortgagePayment({ balance: 235000, annualRate: 4.3, remainingYears: undefined }), null);
  assert.throws(() => estimateRepaymentMortgagePayment({ balance: -1, annualRate: 4.7, remainingYears: 21 }), RangeError);
});
