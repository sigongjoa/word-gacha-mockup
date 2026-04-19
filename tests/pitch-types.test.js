import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateFastball, generateSlider, generateCurve, generateQuestion, POOLS } from '../js/pitch-types.js';

const seqRand = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('generateFastball', () => {
  test('returns 4 options with answer included', () => {
    const q = generateFastball(1);
    assert.equal(q.type, '직구');
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.answer));
  });
  test('prompt is english, answer is korean', () => {
    const q = generateFastball(1);
    assert.match(q.prompt, /^[a-z]+$/i);
  });
  test('options unique', () => {
    const q = generateFastball(1);
    assert.equal(new Set(q.options).size, 4);
  });
});

describe('generateSlider', () => {
  test('answer is a synonym of prompt from pool', () => {
    const q = generateSlider(1);
    assert.equal(q.type, '슬라이더');
    const pool = POOLS.SLIDER_POOL[1];
    const entry = pool.find(e => e[0] === q.prompt);
    assert.ok(entry, 'prompt should be from pool');
    assert.equal(entry[1], q.answer);
  });
  test('options length 4', () => {
    const q = generateSlider(2);
    assert.equal(q.options.length, 4);
  });
});

describe('generateCurve', () => {
  test('prompt contains blank marker ___', () => {
    const q = generateCurve(1);
    assert.equal(q.type, '커브');
    assert.ok(q.prompt.includes('___'));
  });
  test('answer is in options', () => {
    const q = generateCurve(2);
    assert.ok(q.options.includes(q.answer));
    assert.equal(q.options.length, 4);
  });
});

describe('generateQuestion dispatch', () => {
  test('directs to correct generator', () => {
    for (const t of ['직구', '슬라이더', '커브']) {
      const q = generateQuestion(t, 1);
      assert.equal(q.type, t);
    }
  });
  test('unknown type throws', () => {
    assert.throws(() => generateQuestion('너클볼', 1));
  });
});

describe('tier handling', () => {
  test('clamps tier above 3 to 3', () => {
    const q = generateFastball(99);
    const ok = POOLS.FASTBALL_POOL[3].some(e => e[0] === q.prompt);
    assert.ok(ok);
  });
  test('clamps tier below 1 to 1', () => {
    const q = generateFastball(-1);
    const ok = POOLS.FASTBALL_POOL[1].some(e => e[0] === q.prompt);
    assert.ok(ok);
  });
});

describe('determinism via injected rand', () => {
  test('same seed → same question', () => {
    const r1 = seqRand([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const r2 = seqRand([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    const a = generateFastball(1, r1);
    const b = generateFastball(1, r2);
    assert.deepEqual(a, b);
  });
});
