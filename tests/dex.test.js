import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncSeen, isUnlocked, collectionRate, countByType, filterDex, DEX_UNLOCK_BOX,
} from '../js/dex.js';

const mkWords = () => ([
  { id: '1', word: 'a', meaning: 'A', pos: 'noun', box: 5 },
  { id: '2', word: 'b', meaning: 'B', pos: 'noun', box: 3 },
  { id: '3', word: 'c', meaning: 'C', pos: 'verb', box: 5 },
  { id: '4', word: 'd', meaning: 'D', pos: 'adj',  box: 1 },
  { id: '5', word: 'e', meaning: 'E', pos: 'adj',  box: 5 },
]);

describe('DEX_UNLOCK_BOX', () => {
  test('is box 5 per issue spec', () => {
    assert.equal(DEX_UNLOCK_BOX, 5);
  });
});

describe('syncSeen', () => {
  test('adds words at box 5 to seen set', () => {
    const next = syncSeen(mkWords(), []);
    assert.deepEqual([...next].sort(), ['1', '3', '5']);
  });
  test('is idempotent', () => {
    const a = syncSeen(mkWords(), []);
    const b = syncSeen(mkWords(), a);
    assert.deepEqual([...a].sort(), [...b].sort());
  });
  test('preserves previously seen entries even if word demoted', () => {
    const prev = ['1', '2'];
    const next = syncSeen(mkWords(), prev);
    assert.ok(next.includes('2'));
  });
  test('accepts Array or Set for prev', () => {
    const next = syncSeen(mkWords(), new Set(['99']));
    assert.ok(next.includes('99'));
  });
});

describe('isUnlocked', () => {
  test('true when word id is in seen list', () => {
    assert.equal(isUnlocked('1', ['1', '3']), true);
    assert.equal(isUnlocked('x', ['1', '3']), false);
  });
});

describe('collectionRate', () => {
  test('zero when no words exist', () => {
    assert.equal(collectionRate([], []), 0);
  });
  test('ratio = seen / total', () => {
    const words = mkWords();
    const seen = syncSeen(words, []); // 3 of 5
    assert.equal(collectionRate(words, seen), 3 / 5);
  });
  test('clamps to [0,1]', () => {
    const words = [{ id: '1' }];
    assert.equal(collectionRate(words, ['1', '99']), 1);
  });
});

describe('countByType', () => {
  test('groups seen by pos', () => {
    const words = mkWords();
    const seen = syncSeen(words, []);
    const c = countByType(words, seen);
    assert.equal(c.noun, 1); // id=1
    assert.equal(c.verb, 1); // id=3
    assert.equal(c.adj,  1); // id=5
  });
  test('missing types default to 0', () => {
    const c = countByType([], []);
    assert.equal(c.noun, 0);
    assert.equal(c.conj, 0);
  });
});

describe('filterDex', () => {
  test('returns entries grouped by pos with locked/unlocked state', () => {
    const words = mkWords();
    const seen = syncSeen(words, []);
    const entries = filterDex(words, seen, null);
    assert.equal(entries.length, words.length);
    const byId = new Map(entries.map(e => [e.id, e]));
    assert.equal(byId.get('1').unlocked, true);
    assert.equal(byId.get('2').unlocked, false);
  });
  test('type filter restricts to pos', () => {
    const words = mkWords();
    const entries = filterDex(words, [], 'adj');
    assert.equal(entries.length, 2);
    assert.ok(entries.every(e => e.pos === 'adj'));
  });
});
