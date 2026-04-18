// End-to-end integration — simulates full user flows from issue #1.
// Proves modules work together (state + quiz + vocab + dex + streak + me).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEYS, seed, migrate, DEFAULT_PROFILE } from '../js/state.js';
import { startQuiz, answer, finishQuiz, EXP_PER_CORRECT } from '../js/quiz.js';
import { addWord, Leitner } from '../js/vocab.js';
import { syncSeen, collectionRate } from '../js/dex.js';
import { updateStreak, checkBadges, grantCoins } from '../js/streak.js';
import { trainerCard } from '../js/me.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

function bootstrapStore() {
  const store = createStore(memStorage());
  migrate(store);
  seed(store);
  return store;
}

// Fixed RNG for determinism
const seqRng = (seq = [0]) => { let i = 0; return () => seq[i++ % seq.length]; };

// =============================================================
// P0 — 퀴즈 한 세트 완주
// =============================================================
describe('P0 use case: 홈 → 퀴즈 시작 → 10문제 → 결과 → HUD 갱신', () => {
  test('full quiz round persists exp/coin and updates boxes', () => {
    const store = bootstrapStore();
    const today = '2026-04-19';

    let profile = store.get(KEYS.profile);
    profile = updateStreak(profile, today);
    store.set(KEYS.profile, profile);

    const words = store.get(KEYS.words);
    let session = startQuiz(words, seqRng([0]));
    while (!session.finished) {
      session = answer(session, session.questions[session.index].correctIndex);
    }
    const out = finishQuiz(session, words);

    store.set(KEYS.words, out.updatedWords);
    const history = store.get(KEYS.quizHistory);
    store.set(KEYS.quizHistory, [...history, out.historyEntry]);

    profile = {
      ...profile,
      exp: (profile.exp ?? 0) + out.expGained,
    };
    profile = grantCoins(profile, out.correct);
    store.set(KEYS.profile, profile);

    const persisted = store.get(KEYS.profile);
    assert.equal(persisted.exp, out.correct * EXP_PER_CORRECT);
    assert.ok(persisted.coin > 0);
    assert.equal(persisted.streak, 1);
    assert.equal(store.get(KEYS.quizHistory).length, 1);
    assert.ok(store.get(KEYS.words).some(w => w.box > 1), 'at least one word promoted');
  });

  test('quitting early via HP=0 still advances state', () => {
    const store = bootstrapStore();
    const words = store.get(KEYS.words);
    let s = startQuiz(words, seqRng([0]));
    while (!s.finished) {
      const q = s.questions[s.index];
      s = answer(s, (q.correctIndex + 1) % 4);
    }
    assert.equal(s.finished, true);
    const out = finishQuiz(s, words);
    assert.ok(out.updatedWords.filter(w => w.wrongCount > 0).length >= 1);
  });
});

// =============================================================
// P1 — 단어장 CRUD + Leitner 박스 이동
// =============================================================
describe('P1 use case: 단어 추가 → 퀴즈에서 맞히면 Box +1, 틀리면 Box 1', () => {
  test('user adds word then promotes it through quiz', () => {
    const store = bootstrapStore();
    const r = addWord(store.get(KEYS.words), {
      word: 'journey', meaning: '여정', pos: 'noun', example: 'A long journey.',
    });
    assert.equal(r.ok, true);
    store.set(KEYS.words, r.words);

    const added = r.words.at(-1);
    assert.equal(added.box, 1);

    const promoted = Leitner.promote(added);
    assert.equal(promoted.box, 2);

    const reset = Leitner.reset(promoted);
    assert.equal(reset.box, 1);
    assert.equal(reset.wrongCount, 1);
  });

  test('duplicate add rejected', () => {
    const store = bootstrapStore();
    const r = addWord(store.get(KEYS.words), {
      word: 'identity', meaning: '정체성', pos: 'noun',
    });
    assert.equal(r.ok, false);
  });
});

// =============================================================
// P2 — 도감 수집
// =============================================================
describe('P2 use case: Box 5 도달 → 도감 잠금해제 → 수집률 반영', () => {
  test('repeated correct quizzes eventually unlock dex for that word', () => {
    const store = bootstrapStore();
    const targetId = store.get(KEYS.words)[0].id;

    for (let round = 0; round < 5; round++) {
      const words = store.get(KEYS.words);
      const target = words.find(w => w.id === targetId);
      if (!target) break;
      let s = startQuiz([target], seqRng([0]));
      s = answer(s, s.questions[0].correctIndex);
      const out = finishQuiz(s, words);
      store.set(KEYS.words, out.updatedWords);
    }

    const final = store.get(KEYS.words).find(w => w.id === targetId);
    assert.equal(final.box, 5);

    const seen = syncSeen(store.get(KEYS.words), store.get(KEYS.seen));
    store.set(KEYS.seen, seen);
    assert.ok(seen.includes(targetId));

    const rate = collectionRate(store.get(KEYS.words), store.get(KEYS.seen));
    assert.ok(rate > 0);
  });
});

// =============================================================
// P3 — 연속일수 / 배지 보상
// =============================================================
describe('P3 use case: 7일 연속 접속 → streak-7 배지 자동 지급', () => {
  test('consecutive days produce streak and 7-day badge', () => {
    const store = bootstrapStore();
    let profile = store.get(KEYS.profile);
    const dates = ['2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-18','2026-04-19'];
    for (const d of dates) profile = updateStreak(profile, d);
    assert.equal(profile.streak, 7);

    const { badges, newBadges } = checkBadges(profile, store.get(KEYS.badges));
    assert.ok(newBadges.some(b => b.id === 'streak-7'));
    store.set(KEYS.badges, badges);
    store.set(KEYS.profile, profile);
    assert.equal(store.get(KEYS.badges).length, 1);
  });

  test('gap breaks streak — no badge awarded', () => {
    const store = bootstrapStore();
    let profile = store.get(KEYS.profile);
    profile = updateStreak(profile, '2026-04-13');
    profile = updateStreak(profile, '2026-04-14');
    profile = updateStreak(profile, '2026-04-19'); // gap → reset
    const { newBadges } = checkBadges(profile, []);
    assert.equal(newBadges.length, 0);
    assert.equal(profile.streak, 1);
  });
});

// =============================================================
// P4 — 기록(Me) 탭 실데이터
// =============================================================
describe('P4 use case: 트레이너 카드 — 실시간 LV/연속일수/도감 수 반영', () => {
  test('trainer card aggregates all state correctly', () => {
    const store = bootstrapStore();
    const today = '2026-04-19';

    let profile = store.get(KEYS.profile);
    profile = updateStreak(profile, today);

    const words = store.get(KEYS.words);
    let session = startQuiz(words, seqRng([0]));
    while (!session.finished) {
      session = answer(session, session.questions[session.index].correctIndex);
    }
    const out = finishQuiz(session, words);
    profile = { ...profile, exp: (profile.exp ?? 0) + out.expGained };
    profile = grantCoins(profile, out.correct);

    store.set(KEYS.profile, profile);
    store.set(KEYS.words, out.updatedWords);
    store.set(KEYS.quizHistory, [out.historyEntry]);
    store.set(KEYS.seen, syncSeen(out.updatedWords, []));

    const card = trainerCard({
      profile: store.get(KEYS.profile),
      words: store.get(KEYS.words),
      history: store.get(KEYS.quizHistory),
      seen: store.get(KEYS.seen),
      today,
    });

    assert.equal(card.streak, 1);
    assert.equal(card.weekSessions, 1);
    assert.ok(card.weekAccuracy > 0);
    assert.equal(card.totalWords, store.get(KEYS.words).length);
    assert.ok(card.weeklyBars.length === 7);
    assert.equal(card.weeklyBars.at(-1).date, today);
  });
});

// =============================================================
// Schema persistence — 재입장 시 데이터 복원
// =============================================================
describe('Storage round-trip — 페이지 새로고침 시나리오', () => {
  test('state survives simulated reload (same backing storage)', () => {
    const storage = memStorage();
    {
      const store = createStore(storage);
      migrate(store); seed(store);
      const p = store.get(KEYS.profile);
      store.set(KEYS.profile, { ...p, lv: 42, exp: 999 });
    }
    // reload
    {
      const store = createStore(storage);
      migrate(store); seed(store); // idempotent
      const p = store.get(KEYS.profile);
      assert.equal(p.lv, 42);
      assert.equal(p.exp, 999);
    }
  });
});
