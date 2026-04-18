import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyGraph, trainerCard, levelFromExp, EXP_PER_LEVEL } from '../js/me.js';

const history = [
  { date: '2026-04-13', correct: 5,  total: 10 },
  { date: '2026-04-15', correct: 7,  total: 10 },
  { date: '2026-04-15', correct: 10, total: 10 },
  { date: '2026-04-19', correct: 8,  total: 10 },
  { date: '2026-04-05', correct: 1,  total: 10 },
];

describe('weeklyGraph', () => {
  test('returns 7 bars ending at `today`', () => {
    const bars = weeklyGraph(history, '2026-04-19');
    assert.equal(bars.length, 7);
    assert.equal(bars[6].date, '2026-04-19');
    assert.equal(bars[0].date, '2026-04-13');
  });
  test('sums correct/total per day (multiple sessions merge)', () => {
    const bars = weeklyGraph(history, '2026-04-19');
    const d15 = bars.find(b => b.date === '2026-04-15');
    assert.equal(d15.correct, 17);
    assert.equal(d15.total, 20);
  });
  test('days with no activity → zeros', () => {
    const bars = weeklyGraph(history, '2026-04-19');
    const d14 = bars.find(b => b.date === '2026-04-14');
    assert.equal(d14.correct, 0);
    assert.equal(d14.total, 0);
  });
  test('excludes entries outside 7-day window', () => {
    const bars = weeklyGraph(history, '2026-04-19');
    assert.ok(bars.every(b => b.date >= '2026-04-13' && b.date <= '2026-04-19'));
    const totalSum = bars.reduce((s, b) => s + b.total, 0);
    assert.equal(totalSum, 40);
  });
  test('ratio is correct/total or 0 when total=0', () => {
    const bars = weeklyGraph(history, '2026-04-19');
    for (const b of bars) {
      if (b.total === 0) assert.equal(b.ratio, 0);
      else assert.equal(b.ratio, b.correct / b.total);
    }
  });
});

describe('levelFromExp', () => {
  test('level 1 at exp 0', () => {
    assert.equal(levelFromExp(0).lv, 1);
  });
  test('level increases every EXP_PER_LEVEL', () => {
    assert.equal(levelFromExp(EXP_PER_LEVEL).lv, 2);
    assert.equal(levelFromExp(EXP_PER_LEVEL * 5 - 1).lv, 5);
  });
  test('returns progress-to-next within bar', () => {
    const r = levelFromExp(EXP_PER_LEVEL + 10);
    assert.equal(r.lv, 2);
    assert.equal(r.intoLevel, 10);
    assert.equal(r.toNext, EXP_PER_LEVEL);
  });
});

describe('trainerCard', () => {
  test('aggregates lv/streak/dex count + weekly stats', () => {
    const profile = { lv: 1, exp: 150, coin: 30, streak: 5, lastActiveDate: '2026-04-19' };
    const words = [
      { id: '1', box: 5 }, { id: '2', box: 5 }, { id: '3', box: 3 },
    ];
    const seen = ['1', '2'];
    const card = trainerCard({ profile, words, history, seen, today: '2026-04-19' });
    assert.equal(card.streak, 5);
    assert.equal(card.dexCount, 2);
    assert.equal(card.totalWords, 3);
    assert.equal(card.coin, 30);
    assert.equal(card.weekSessions, 4); // 4 entries within 7d window
    assert.ok(card.weekAccuracy > 0 && card.weekAccuracy <= 1);
  });
  test('handles zero history gracefully', () => {
    const profile = { lv: 1, exp: 0, coin: 0, streak: 0, lastActiveDate: null };
    const card = trainerCard({ profile, words: [], history: [], seen: [], today: '2026-04-19' });
    assert.equal(card.weekSessions, 0);
    assert.equal(card.weekAccuracy, 0);
    assert.equal(card.dexCount, 0);
  });
});
