import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { updateStreak, checkBadges, grantCoins, BADGE_MILESTONES, COIN_PER_CORRECT } from '../js/streak.js';

describe('updateStreak', () => {
  test('first ever activity → streak=1', () => {
    const p = { lv: 1, exp: 0, coin: 0, streak: 0, lastActiveDate: null };
    const r = updateStreak(p, '2026-04-19');
    assert.equal(r.streak, 1);
    assert.equal(r.lastActiveDate, '2026-04-19');
  });
  test('same day activity → unchanged', () => {
    const p = { streak: 3, lastActiveDate: '2026-04-19' };
    const r = updateStreak(p, '2026-04-19');
    assert.equal(r.streak, 3);
  });
  test('consecutive day → streak +1', () => {
    const p = { streak: 3, lastActiveDate: '2026-04-18' };
    const r = updateStreak(p, '2026-04-19');
    assert.equal(r.streak, 4);
  });
  test('gap of 2+ days → reset to 1', () => {
    const p = { streak: 5, lastActiveDate: '2026-04-15' };
    const r = updateStreak(p, '2026-04-19');
    assert.equal(r.streak, 1);
  });
  test('handles month boundary', () => {
    const p = { streak: 2, lastActiveDate: '2026-03-31' };
    const r = updateStreak(p, '2026-04-01');
    assert.equal(r.streak, 3);
  });
  test('is pure (does not mutate profile)', () => {
    const p = Object.freeze({ streak: 1, lastActiveDate: '2026-04-18' });
    assert.doesNotThrow(() => updateStreak(p, '2026-04-19'));
  });
});

describe('BADGE_MILESTONES', () => {
  test('includes 7/14/30 day milestones per issue', () => {
    const days = BADGE_MILESTONES.filter(m => m.type === 'streak').map(m => m.threshold);
    assert.ok(days.includes(7));
    assert.ok(days.includes(14));
    assert.ok(days.includes(30));
  });
});

describe('checkBadges', () => {
  test('returns empty on streak below first milestone', () => {
    const out = checkBadges({ streak: 3 }, []);
    assert.equal(out.newBadges.length, 0);
  });
  test('awards streak-7 at streak 7', () => {
    const out = checkBadges({ streak: 7 }, []);
    const ids = out.newBadges.map(b => b.id);
    assert.ok(ids.includes('streak-7'));
  });
  test('does not re-award already-earned badge', () => {
    const earned = [{ id: 'streak-7', earnedAt: '2026-04-10' }];
    const out = checkBadges({ streak: 10 }, earned);
    assert.equal(out.newBadges.find(b => b.id === 'streak-7'), undefined);
  });
  test('awards all earned milestones at once', () => {
    const out = checkBadges({ streak: 30 }, []);
    const ids = out.newBadges.map(b => b.id);
    assert.ok(ids.includes('streak-7'));
    assert.ok(ids.includes('streak-14'));
    assert.ok(ids.includes('streak-30'));
  });
  test('merged badges list includes old + new', () => {
    const earned = [{ id: 'streak-7', earnedAt: '2026-04-10' }];
    const out = checkBadges({ streak: 14 }, earned);
    assert.equal(out.badges.length, 2);
  });
  test('earnedAt is ISO date string', () => {
    const out = checkBadges({ streak: 7 }, []);
    assert.match(out.newBadges[0].earnedAt, /^\d{4}-\d{2}-\d{2}/);
  });
});

describe('grantCoins', () => {
  test('adds correct*COIN_PER_CORRECT to profile.coin', () => {
    const p = { coin: 10 };
    const r = grantCoins(p, 3);
    assert.equal(r.coin, 10 + 3 * COIN_PER_CORRECT);
  });
  test('zero correct → no change', () => {
    const r = grantCoins({ coin: 5 }, 0);
    assert.equal(r.coin, 5);
  });
});
