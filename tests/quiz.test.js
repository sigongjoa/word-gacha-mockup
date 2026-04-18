import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestion, startQuiz, answer, finishQuiz,
  QUIZ_SIZE, HP_MAX, EXP_PER_CORRECT,
} from '../js/quiz.js';

const WORDS = [
  { id: 'a', word: 'apple',  meaning: '사과', pos: 'noun', box: 1, wrongCount: 0 },
  { id: 'b', word: 'banana', meaning: '바나나', pos: 'noun', box: 2, wrongCount: 0 },
  { id: 'c', word: 'cherry', meaning: '체리', pos: 'noun', box: 3, wrongCount: 0 },
  { id: 'd', word: 'dog',    meaning: '개',   pos: 'noun', box: 4, wrongCount: 1 },
  { id: 'e', word: 'elf',    meaning: '요정', pos: 'noun', box: 5, wrongCount: 0 },
];

describe('buildQuestion', () => {
  test('target word meaning is in choices', () => {
    const rng = (n) => 0;
    const q = buildQuestion(WORDS[0], WORDS, rng);
    assert.ok(q.choices.includes('사과'));
    assert.equal(q.choices.length, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
    assert.equal(q.choices[q.correctIndex], '사과');
  });
  test('no duplicate choices', () => {
    const q = buildQuestion(WORDS[0], WORDS, () => 0);
    assert.equal(new Set(q.choices).size, q.choices.length);
  });
});

describe('startQuiz', () => {
  test('creates session with up to QUIZ_SIZE questions', () => {
    const s = startQuiz(WORDS, () => 0);
    assert.ok(s.questions.length <= QUIZ_SIZE);
    assert.equal(s.index, 0);
    assert.equal(s.hp, HP_MAX);
    assert.equal(s.correct, 0);
    assert.equal(s.wrong, 0);
    assert.equal(s.finished, false);
  });
  test('throws on empty pool', () => {
    assert.throws(() => startQuiz([], () => 0));
  });
  test('handles pool smaller than QUIZ_SIZE (uses all words)', () => {
    const small = WORDS.slice(0, 3);
    const s = startQuiz(small, () => 0);
    assert.equal(s.questions.length, 3);
  });
});

describe('answer', () => {
  test('correct answer: increments correct, advances index', () => {
    const s = startQuiz(WORDS, () => 0);
    const q0 = s.questions[0];
    const next = answer(s, q0.correctIndex);
    assert.equal(next.correct, 1);
    assert.equal(next.index, 1);
    assert.equal(next.hp, HP_MAX);
    assert.equal(next.results[0].correct, true);
  });
  test('wrong answer: decrements hp, increments wrong', () => {
    const s = startQuiz(WORDS, () => 0);
    const q0 = s.questions[0];
    const badIdx = (q0.correctIndex + 1) % 4;
    const next = answer(s, badIdx);
    assert.equal(next.wrong, 1);
    assert.equal(next.hp, HP_MAX - 1);
    assert.equal(next.results[0].correct, false);
  });
  test('hp reaching 0 finishes quiz early', () => {
    let s = startQuiz(WORDS, () => 0);
    for (let i = 0; i < HP_MAX; i++) {
      const q = s.questions[s.index];
      s = answer(s, (q.correctIndex + 1) % 4);
      if (s.finished) break;
    }
    assert.equal(s.finished, true);
    assert.equal(s.hp, 0);
  });
  test('answering after finished is a no-op', () => {
    let s = startQuiz(WORDS.slice(0, 1), () => 0);
    s = answer(s, s.questions[0].correctIndex);
    assert.equal(s.finished, true);
    const again = answer(s, 0);
    assert.equal(again.index, s.index);
    assert.equal(again.correct, s.correct);
  });
});

describe('finishQuiz — Leitner rules', () => {
  test('correct promotes box +1 (max 5)', () => {
    let s = startQuiz(WORDS.slice(0, 1), () => 0);
    s = answer(s, s.questions[0].correctIndex);
    const out = finishQuiz(s, WORDS);
    const target = out.updatedWords.find(w => w.id === 'a');
    assert.equal(target.box, 2);
  });
  test('wrong resets box to 1 and increments wrongCount', () => {
    let s = startQuiz([WORDS[3]], () => 0); // box 4, wrongCount 1
    const q = s.questions[0];
    s = answer(s, (q.correctIndex + 1) % 4);
    const out = finishQuiz(s, WORDS);
    const target = out.updatedWords.find(w => w.id === 'd');
    assert.equal(target.box, 1);
    assert.equal(target.wrongCount, 2);
  });
  test('box 5 correct stays at 5 (cap)', () => {
    let s = startQuiz([WORDS[4]], () => 0);
    s = answer(s, s.questions[0].correctIndex);
    const out = finishQuiz(s, WORDS);
    assert.equal(out.updatedWords.find(w => w.id === 'e').box, 5);
  });
  test('returns score summary', () => {
    let s = startQuiz(WORDS.slice(0, 2), () => 0);
    s = answer(s, s.questions[0].correctIndex);
    s = answer(s, s.questions[1].correctIndex);
    const out = finishQuiz(s, WORDS);
    assert.equal(out.correct, 2);
    assert.equal(out.total, 2);
    assert.equal(out.accuracy, 1);
    assert.equal(out.expGained, 2 * EXP_PER_CORRECT);
  });
  test('does not mutate input word list', () => {
    const frozen = Object.freeze([...WORDS.slice(0, 1).map(w => Object.freeze({ ...w }))]);
    let s = startQuiz(frozen, () => 0);
    s = answer(s, s.questions[0].correctIndex);
    assert.doesNotThrow(() => finishQuiz(s, frozen));
  });
  test('history entry has date + wordIds + correct/total', () => {
    let s = startQuiz(WORDS.slice(0, 1), () => 0);
    s = answer(s, s.questions[0].correctIndex);
    const out = finishQuiz(s, WORDS);
    assert.ok(out.historyEntry.date);
    assert.deepEqual(out.historyEntry.wordIds, ['a']);
    assert.equal(out.historyEntry.correct, 1);
    assert.equal(out.historyEntry.total, 1);
  });
});
