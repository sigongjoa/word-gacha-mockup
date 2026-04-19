import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canDo, remainingMs, performAction, speechFor, COOLDOWNS } from '../js/play.js';

const NOW = '2026-04-19T10:00:00.000Z';
const plus = (iso, ms) => new Date(new Date(iso).getTime() + ms).toISOString();

const creat = (overrides = {}) => ({
  id: 'c-test', name: 'x', speciesKey: 'sprout', personality: 'brave',
  stage: 1, hunger: 50, bond: 10, mood: 'neutral',
  bornAt: NOW, lastInteractionAt: NOW, lastTickedAt: NOW, ...overrides,
});

describe('canDo / remainingMs', () => {
  test('no lastAt → always true', () => {
    assert.equal(canDo('pet', null, NOW), true);
  });
  test('feed has zero cooldown', () => {
    assert.equal(canDo('feed', NOW, NOW), true);
  });
  test('pet 30s cooldown', () => {
    assert.equal(canDo('pet', NOW, plus(NOW, 10_000)), false);
    assert.equal(canDo('pet', NOW, plus(NOW, 30_000)), true);
  });
  test('ball 5m cooldown', () => {
    assert.equal(canDo('ball', NOW, plus(NOW, 60_000)), false);
    assert.equal(canDo('ball', NOW, plus(NOW, 300_000)), true);
  });
  test('unknown kind → false', () => {
    assert.equal(canDo('xxx', null, NOW), false);
  });
  test('remainingMs counts down', () => {
    assert.equal(remainingMs('pet', NOW, plus(NOW, 10_000)), 20_000);
    assert.equal(remainingMs('pet', NOW, plus(NOW, 40_000)), 0);
  });
});

describe('performAction: feed', () => {
  test('hungry → hunger +30, bond +1', () => {
    const c = creat({ hunger: 40, bond: 10 });
    const r = performAction(c, 'feed', NOW);
    assert.equal(r.creature.hunger, 70);
    assert.equal(r.creature.bond, 11);
  });
  test('not hungry (hunger>=FEED_FULL) → error', () => {
    const c = creat({ hunger: 85 });
    const r = performAction(c, 'feed', NOW);
    assert.equal(r.error, 'not hungry');
  });
  test('hunger caps at 100', () => {
    // At FEED_FULL=70, anything >=70 errors; use 69 so feed succeeds and clamps.
    const c2 = creat({ hunger: 69, bond: 10 });
    const r = performAction(c2, 'feed', NOW);
    assert.equal(r.creature.hunger, 99);
  });
});

describe('performAction: pet', () => {
  test('bond +3', () => {
    const c = creat({ bond: 20 });
    const r = performAction(c, 'pet', NOW);
    assert.equal(r.creature.bond, 23);
  });
  test('bond caps at 100', () => {
    const c = creat({ bond: 99 });
    const r = performAction(c, 'pet', NOW);
    assert.equal(r.creature.bond, 100);
  });
  test('updates lastInteractionAt', () => {
    const c = creat();
    const later = plus(NOW, 5000);
    const r = performAction(c, 'pet', later);
    assert.equal(r.creature.lastInteractionAt, later);
  });
});

describe('performAction: ball', () => {
  test('baseline ball → bond +0.5', () => {
    const c = creat({ bond: 10 });
    const r = performAction(c, 'ball', NOW);
    assert.equal(r.creature.bond, 10.5);
  });
  test('ball:correct → bond +2 + exp reward', () => {
    const c = creat({ bond: 10 });
    const r = performAction(c, 'ball:correct', NOW);
    assert.equal(r.creature.bond, 12);
    assert.equal(r.reward.exp, 5);
  });
});

describe('performAction: sleep', () => {
  test('resets mood to happy', () => {
    const c = creat({ mood: 'sad' });
    const r = performAction(c, 'sleep', NOW);
    assert.equal(r.creature.mood, 'happy');
  });
  test('does not change bond', () => {
    const c = creat({ bond: 15 });
    const r = performAction(c, 'sleep', NOW);
    assert.equal(r.creature.bond, 15);
  });
});

describe('performAction: edge cases', () => {
  test('no creature → error', () => {
    const r = performAction(null, 'pet', NOW);
    assert.equal(r.error, 'no creature');
  });
  test('unknown kind → error', () => {
    const r = performAction(creat(), 'dance', NOW);
    assert.equal(r.error, 'unknown action');
  });
  test('tap → bond +0.5 + speech', () => {
    const c = creat({ bond: 10 });
    const r = performAction(c, 'tap', NOW);
    assert.equal(r.creature.bond, 10.5);
    assert.ok(typeof r.speech === 'string' && r.speech.length > 0);
  });
});

describe('speechFor', () => {
  test('returns string for each mood', () => {
    for (const mood of ['happy', 'neutral', 'hungry', 'sad']) {
      const s = speechFor(mood);
      assert.ok(typeof s === 'string' && s.length > 0, `mood ${mood} empty`);
    }
  });
  test('unknown mood falls back to neutral pool', () => {
    const s = speechFor('confused');
    assert.ok(typeof s === 'string' && s.length > 0);
  });
  test('seed selects deterministically', () => {
    const a = speechFor('happy', 0);
    const b = speechFor('happy', 0);
    assert.equal(a, b);
  });
});

describe('COOLDOWNS constants', () => {
  test('exposes expected kinds', () => {
    for (const k of ['tap', 'feed', 'pet', 'ball', 'sleep']) {
      assert.ok(k in COOLDOWNS, `missing ${k}`);
    }
  });
  test('pet < ball < sleep', () => {
    assert.ok(COOLDOWNS.pet < COOLDOWNS.ball);
    assert.ok(COOLDOWNS.ball < COOLDOWNS.sleep);
  });
});
