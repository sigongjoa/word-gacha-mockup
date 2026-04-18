import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEYS, seed, migrate, DEFAULT_PROFILE, SEED_WORDS } from '../js/state.js';

function memStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    _map: map,
  };
}

describe('KEYS', () => {
  test('uses wg.v1. prefix for all keys', () => {
    for (const v of Object.values(KEYS)) {
      assert.match(v, /^wg\.v1\./);
    }
  });
  test('covers all 5 domains from issue #1', () => {
    assert.ok(KEYS.profile && KEYS.words && KEYS.quizHistory && KEYS.badges && KEYS.seen);
  });
});

describe('createStore', () => {
  test('get returns null for missing key', () => {
    const s = createStore(memStorage());
    assert.equal(s.get('missing'), null);
  });
  test('set/get roundtrip with JSON value', () => {
    const s = createStore(memStorage());
    s.set('x', { a: 1, b: [2, 3] });
    assert.deepEqual(s.get('x'), { a: 1, b: [2, 3] });
  });
  test('get returns null when JSON is corrupt (does not throw)', () => {
    const storage = memStorage({ bad: 'not-json{' });
    const s = createStore(storage);
    assert.equal(s.get('bad'), null);
  });
  test('remove deletes entry', () => {
    const s = createStore(memStorage());
    s.set('x', 1); s.remove('x');
    assert.equal(s.get('x'), null);
  });
});

describe('seed', () => {
  test('creates profile + seed words on first run', () => {
    const s = createStore(memStorage());
    seed(s);
    const p = s.get(KEYS.profile);
    assert.equal(p.lv, DEFAULT_PROFILE.lv);
    assert.equal(p.exp, 0);
    assert.equal(p.coin, 0);
    assert.equal(p.streak, 0);
    assert.ok(Array.isArray(s.get(KEYS.words)));
    assert.ok(s.get(KEYS.words).length >= 10);
  });
  test('is idempotent — does not overwrite existing data', () => {
    const s = createStore(memStorage());
    seed(s);
    s.set(KEYS.profile, { ...DEFAULT_PROFILE, lv: 99, exp: 500 });
    seed(s);
    assert.equal(s.get(KEYS.profile).lv, 99);
    assert.equal(s.get(KEYS.profile).exp, 500);
  });
  test('seed words have valid Leitner shape', () => {
    const s = createStore(memStorage()); seed(s);
    for (const w of s.get(KEYS.words)) {
      assert.ok(w.id && w.word && w.meaning);
      assert.ok(w.box >= 1 && w.box <= 5);
      assert.ok(['noun','verb','adj','adv','prep','conj'].includes(w.pos));
    }
  });
});

describe('migrate', () => {
  test('no-op on fresh storage', () => {
    const s = createStore(memStorage());
    assert.doesNotThrow(() => migrate(s));
  });
  test('writes schema version on first migrate', () => {
    const s = createStore(memStorage());
    migrate(s);
    assert.equal(s.get(KEYS.schemaVersion), 1);
  });
  test('idempotent on already-migrated store', () => {
    const s = createStore(memStorage());
    migrate(s); migrate(s);
    assert.equal(s.get(KEYS.schemaVersion), 1);
  });
});

describe('SEED_WORDS', () => {
  test('contains at least 10 entries with English + Korean meaning', () => {
    assert.ok(SEED_WORDS.length >= 10);
    for (const w of SEED_WORDS) {
      assert.ok(/^[a-zA-Z\s-]+$/.test(w.word), `not english: ${w.word}`);
      assert.ok(w.meaning.length > 0);
    }
  });
});
