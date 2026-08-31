import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScenario, blankZone, validateScenario, searchScenarios, makeId } from '../js/scenarios-core.js';

test('createScenario builds full object', () => {
  const s = createScenario({
    name: 'Reunião',
    notes: { fileName: 'n.md', content: '# nota' },
    left: { type: 'pdf', src: 'x.pdf', fileName: 'x.pdf' },
    rightBottom: blankZone()
  });
  assert.ok(s.id);
  assert.ok(s.createdAt);
  assert.ok(s.updatedAt);
  assert.equal(s.name, 'Reunião');
  assert.equal(s.left.type, 'pdf');
  assert.equal(s.rightBottom.type, 'none');
});

test('validateScenario flags missing name and bad zone', () => {
  const bad = createScenario({ name: '', notes: { fileName: '', content: '' }, left: { type: 'pdf', src: '', fileName: '' }, rightBottom: blankZone() });
  const errs = validateScenario(bad);
  assert.ok(errs.some((e) => e.includes('nome')));
  assert.ok(errs.some((e) => e.includes('origem')));
});

test('validateScenario accepts local file as zone source', () => {
  const s = createScenario({ name: 'Com ficheiro', notes: { fileName: '', content: '' }, left: { type: 'pdf', src: '', fileName: 'x.pdf', file: {} }, rightBottom: blankZone() });
  assert.equal(validateScenario(s).length, 0);
});

test('searchScenarios matches name case-insensitive', () => {
  const a = createScenario({ name: 'Estado diário', notes: { fileName: '', content: '' }, left: blankZone(), rightBottom: blankZone() });
  const b = createScenario({ name: 'Quarterly', notes: { fileName: '', content: '' }, left: blankZone(), rightBottom: blankZone() });
  const list = [a, b];
  assert.equal(searchScenarios(list, 'estado').length, 1);
  assert.equal(searchScenarios(list, '').length, 2);
});

test('makeId unique', () => {
  assert.notEqual(makeId(), makeId());
});
