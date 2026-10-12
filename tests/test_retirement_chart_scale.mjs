import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartScale } from '../prototype/retirement-chart-scale.mjs';

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
