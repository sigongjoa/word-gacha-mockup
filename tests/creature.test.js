import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCreature, tick, interact, moodOf, canEvolve, evolve,
  STARTER_SPECIES, PERSONALITIES, HUNGER_MAX, BOND_MAX,
} from '../js/creature.js';

const NOW = '2026-04-19T10:00:00.000Z';
const plus = (iso, hours) => new Date(new Date(iso).getTime() + hours * 3600000).toISOString();

describe('createCreature', () => {
  test('defaults: hunger=100, bond=0, stage=1, mood=neutral', () => {
    const c = createCreature({ speciesKey: 'sprout', name: '초싹이', personality: 'brave', now: NOW });
    assert.equal(c.stage, 1);
    assert.equal(c.hunger, HUNGER_MAX);
    assert.equal(c.bond, 0);
    assert.equal(c.mood, 'happy');
    assert.equal(c.bornAt, NOW);
    assert.equal(c.lastInteractionAt, NOW);
  });
  test('rejects unknown species', () => {
    assert.throws(() => createCreature({ speciesKey: 'dragon', name: 'x', personality: 'brave', now: NOW }));
  });
  test('rejects unknown personality', () => {
    assert.throws(() => createCreature({ speciesKey: 'sprout', name: 'x', personality: 'evil', now: NOW }));
  });
  test('trims empty name', () => {
    assert.throws(() => createCreature({ speciesKey: 'sprout', name: '  ', personality: 'brave', now: NOW }));
  });
});

describe('tick — idle hunger decay', () => {
  test('6 hours → hunger -10', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = tick(c, plus(NOW, 6));
    assert.equal(next.hunger, 90);
  });
  test('12 hours → hunger -20, mood still ok', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = tick(c, plus(NOW, 12));
    assert.equal(next.hunger, 80);
  });
  test('48 hours → hunger floors at 0, mood=sad', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = tick(c, plus(NOW, 48));
    assert.equal(next.hunger, 20);
    assert.equal(next.mood, 'sad');
  });
  test('72 hours still floors — never negative', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = tick(c, plus(NOW, 72));
    assert.ok(next.hunger >= 0);
  });
  test('tick is idempotent at the same instant', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const a = tick(c, plus(NOW, 6));
    const b = tick(a, plus(NOW, 6));
    assert.equal(a.hunger, b.hunger);
  });
});

describe('moodOf', () => {
  test('hungry when hunger<=20', () => {
    const c = { hunger: 20, bond: 50, lastInteractionAt: NOW };
    assert.equal(moodOf(c, NOW), 'hungry');
  });
  test('sad when idle > 48h', () => {
    const c = { hunger: 80, bond: 50, lastInteractionAt: NOW };
    assert.equal(moodOf(c, plus(NOW, 49)), 'sad');
  });
  test('happy when bond>=80 and hunger>60', () => {
    const c = { hunger: 80, bond: 85, lastInteractionAt: NOW };
    assert.equal(moodOf(c, NOW), 'happy');
  });
  test('neutral otherwise', () => {
    const c = { hunger: 50, bond: 30, lastInteractionAt: NOW };
    assert.equal(moodOf(c, NOW), 'neutral');
  });
  test('hungry takes priority over sad', () => {
    const c = { hunger: 10, bond: 50, lastInteractionAt: NOW };
    assert.equal(moodOf(c, plus(NOW, 60)), 'hungry');
  });
});

describe('interact — bond + hunger change', () => {
  test('tap: bond +0.5, hunger unchanged', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = interact(c, 'tap', plus(NOW, 1));
    assert.equal(next.bond, 0.5);
    assert.equal(next.hunger, c.hunger);
  });
  test('answer: bond +1, hunger +2', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    c.hunger = 50;
    const next = interact(c, 'answer', NOW);
    assert.equal(next.bond, 1);
    assert.equal(next.hunger, 52);
  });
  test('addWord: bond +2', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = interact(c, 'addWord', NOW);
    assert.equal(next.bond, 2);
  });
  test('dailyVisit: bond +5', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = interact(c, 'dailyVisit', NOW);
    assert.equal(next.bond, 5);
  });
  test('bond caps at BOND_MAX', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    c.bond = BOND_MAX - 1;
    const next = interact(c, 'dailyVisit', NOW);
    assert.equal(next.bond, BOND_MAX);
  });
  test('hunger caps at HUNGER_MAX', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    c.hunger = HUNGER_MAX - 1;
    const next = interact(c, 'answer', NOW);
    assert.equal(next.hunger, HUNGER_MAX);
  });
  test('updates lastInteractionAt', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const later = plus(NOW, 3);
    const next = interact(c, 'tap', later);
    assert.equal(next.lastInteractionAt, later);
  });
  test('unknown kind → no change', () => {
    const c = createCreature({ speciesKey: 'sprout', name: 'x', personality: 'brave', now: NOW });
    const next = interact(c, 'unknown', NOW);
    assert.equal(next.bond, c.bond);
  });
});

describe('evolution', () => {
  test('canEvolve: bond<20 → no', () => {
    const c = { stage: 1, bond: 10 };
    assert.equal(canEvolve(c, [{box:5},{box:5},{box:5}], 0), false);
  });
  test('canEvolve 1→2: bond>=20 + 3 box5 words', () => {
    const c = { stage: 1, bond: 25 };
    const words = [{ box: 5 }, { box: 5 }, { box: 5 }];
    assert.equal(canEvolve(c, words, 0), true);
  });
  test('canEvolve 2→3: requires bond>=50 + 10 box5 words', () => {
    const c = { stage: 2, bond: 60 };
    const words = Array.from({ length: 10 }, () => ({ box: 5 }));
    assert.equal(canEvolve(c, words, 0), true);
  });
  test('canEvolve 4→5: also requires streak>=14', () => {
    const c = { stage: 4, bond: 100 };
    const words = Array.from({ length: 30 }, () => ({ box: 5 }));
    assert.equal(canEvolve(c, words, 7), false);
    assert.equal(canEvolve(c, words, 14), true);
  });
  test('evolve increments stage', () => {
    const c = { stage: 1, bond: 25 };
    const next = evolve(c);
    assert.equal(next.stage, 2);
  });
  test('evolve caps at 5', () => {
    const c = { stage: 5, bond: 100 };
    const next = evolve(c);
    assert.equal(next.stage, 5);
  });
});

describe('constants', () => {
  test('STARTER_SPECIES has exactly 3 entries', () => {
    assert.equal(STARTER_SPECIES.length, 3);
    for (const s of STARTER_SPECIES) {
      assert.ok(s.key && s.label && s.color);
    }
  });
  test('PERSONALITIES has 4 entries', () => {
    assert.equal(PERSONALITIES.length, 4);
  });
});
