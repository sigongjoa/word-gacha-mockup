import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWord, updateWord, deleteWord, filterByBox, filterByPos,
  validateWord, VALID_POS, Leitner,
} from '../js/vocab.js';

const W = (over = {}) => ({ word: 'hello', meaning: '안녕', pos: 'noun', example: 'Hello!', ...over });

describe('validateWord', () => {
  test('requires non-empty word + meaning', () => {
    assert.equal(validateWord(W({ word: '' })).ok, false);
    assert.equal(validateWord(W({ meaning: '' })).ok, false);
    assert.equal(validateWord(W()).ok, true);
  });
  test('rejects invalid pos', () => {
    assert.equal(validateWord(W({ pos: 'xxx' })).ok, false);
  });
  test('trims whitespace', () => {
    const r = validateWord(W({ word: '  hello  ', meaning: '  안녕  ' }));
    assert.equal(r.ok, true);
    assert.equal(r.clean.word, 'hello');
    assert.equal(r.clean.meaning, '안녕');
  });
  test('rejects non-English word', () => {
    assert.equal(validateWord(W({ word: '안녕' })).ok, false);
  });
});

describe('addWord', () => {
  test('assigns id, box=1, wrongCount=0, addedAt', () => {
    const { words } = addWord([], W());
    assert.equal(words.length, 1);
    assert.ok(words[0].id);
    assert.equal(words[0].box, 1);
    assert.equal(words[0].wrongCount, 0);
    assert.ok(words[0].addedAt);
  });
  test('rejects duplicate word (case-insensitive)', () => {
    const start = [{ id: 'x', word: 'Hello', meaning: '안녕', pos: 'noun', box: 1 }];
    const r = addWord(start, W({ word: 'HELLO' }));
    assert.equal(r.ok, false);
  });
  test('rejects invalid input', () => {
    const r = addWord([], W({ pos: 'bad' }));
    assert.equal(r.ok, false);
  });
  test('returns new array (does not mutate)', () => {
    const start = Object.freeze([]);
    assert.doesNotThrow(() => addWord(start, W()));
  });
});

describe('updateWord', () => {
  test('patches fields of given id', () => {
    const start = [{ id: '1', word: 'cat', meaning: '고양이', pos: 'noun', box: 1 }];
    const r = updateWord(start, '1', { meaning: '야옹이' });
    assert.equal(r.words[0].meaning, '야옹이');
    assert.equal(r.words[0].word, 'cat');
  });
  test('returns ok=false on unknown id', () => {
    assert.equal(updateWord([], 'missing', { meaning: 'x' }).ok, false);
  });
});

describe('deleteWord', () => {
  test('removes entry by id', () => {
    const start = [{ id: '1' }, { id: '2' }];
    const { words } = deleteWord(start, '1');
    assert.equal(words.length, 1);
    assert.equal(words[0].id, '2');
  });
  test('no-op on unknown id still returns ok=true', () => {
    const r = deleteWord([{ id: '1' }], 'x');
    assert.equal(r.ok, true);
    assert.equal(r.words.length, 1);
  });
});

describe('filterByBox / filterByPos', () => {
  const list = [
    { id: '1', box: 1, pos: 'noun' }, { id: '2', box: 1, pos: 'verb' },
    { id: '3', box: 3, pos: 'noun' }, { id: '4', box: 5, pos: 'adj' },
  ];
  test('filterByBox picks exact box', () => {
    assert.equal(filterByBox(list, 1).length, 2);
    assert.equal(filterByBox(list, 5).length, 1);
  });
  test('filterByBox null/undefined → return all', () => {
    assert.equal(filterByBox(list, null).length, 4);
  });
  test('filterByPos picks exact pos', () => {
    assert.equal(filterByPos(list, 'noun').length, 2);
  });
});

describe('Leitner rules (pure helper)', () => {
  test('promote caps at 5', () => {
    assert.equal(Leitner.promote({ box: 5 }).box, 5);
    assert.equal(Leitner.promote({ box: 2 }).box, 3);
  });
  test('reset sets box=1 and +1 wrongCount', () => {
    const w = Leitner.reset({ box: 4, wrongCount: 2 });
    assert.equal(w.box, 1);
    assert.equal(w.wrongCount, 3);
  });
});

describe('VALID_POS', () => {
  test('covers 6 types from mockup (noun/verb/adj/adv/prep/conj)', () => {
    for (const p of ['noun','verb','adj','adv','prep','conj']) {
      assert.ok(VALID_POS.includes(p));
    }
  });
});
