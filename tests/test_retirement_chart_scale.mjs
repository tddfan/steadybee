import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartScale, estateComparisonRange } from '../prototype/retirement-chart-scale.mjs';

test('annual income axes use round amounts and contain the modelled maximum', () => {
  const scale = chartScale(394100);
  assert.deepEqual(scale.ticks, [0, 100000, 200000, 300000, 400000]);
  assert.ok(scale.ceiling >= 394100);
});

test('large negative wealth cannot create an unbounded number of chart ticks', () => {
  for (const debt of [383000, 10000000, 1000000000]) {
    const scale = chartScale(1, -debt);
    assert.ok(scale.ticks.length >= 2 && scale.ticks.length <= 8);
    assert.ok(scale.floor <= -debt);
    assert.ok(scale.ceiling >= 1);
    assert.ok(scale.ticks.every(Number.isFinite));
  }
});

test('small debt remains visible without dominating a large asset chart', () => {
  const scale = chartScale(49500000, -372000);
  assert.equal(scale.floor, -372000);
  assert.ok(scale.ticks.includes(0));
  assert.ok(scale.ticks.every(value => !Object.is(value, -0)));
});

test('an empty portfolio retains a usable axis', () => {
  const scale = chartScale(1);
  assert.ok(scale.ceiling > scale.floor);
  assert.ok(scale.ticks.length <= 8);
});

test('comparison axis shows a substantial fall in positive assets', () => {
  const range = estateComparisonRange([1000000, 600000, 300000]);
  assert.ok(range.min > 0 && range.min < 300000);
  assert.ok(range.max > 1000000);
  const scale = chartScale(range.max, range.min);
  assert.ok(scale.floor > 0 && scale.ceiling >= 1000000);
});

test('comparison axis includes zero for small changes and negative wealth', () => {
  assert.equal(estateComparisonRange([1000000, 950000]).min, 0);
  assert.ok(estateComparisonRange([1000000, -100000]).min <= -100000);
});
