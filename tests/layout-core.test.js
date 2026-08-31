import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitVertical, splitHorizontal, clampFrac } from '../js/layout-core.js';

test('splitVertical sums to w', () => {
  const { left, right } = splitVertical(1000, 0.4);
  assert.equal(left + right, 1000);
  assert.equal(left, 400);
});

test('splitHorizontal sums to h', () => {
  const { top, bottom } = splitHorizontal(800, 0.3);
  assert.equal(top + bottom, 800);
  assert.equal(top, 240);
});

test('clampFrac bounds to safe range', () => {
  assert.equal(clampFrac(0.1), 0.25);
  assert.equal(clampFrac(0.9), 0.75);
  assert.equal(clampFrac(0.5), 0.5);
});
