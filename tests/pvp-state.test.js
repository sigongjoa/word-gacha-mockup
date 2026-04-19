import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyPitchSelect, applyPitchThrown, applyBatAnswer, applyTimeout,
  winnerOf, MAX_INNING,
} from '../js/pvp-state.js';

const q = (type, answer) => ({
  type, prompt: 'x', answer, options: [answer, 'a', 'b', 'c'],
});

describe('createGame', () => {
  test('initial state', () => {
    const g = createGame();
    assert.equal(g.inning, 1);
    assert.equal(g.half, 'top');
    assert.equal(g.outs, 0);
    assert.deepEqual(g.bases, [0,0,0]);
    assert.equal(g.phase, 'IDLE');
    assert.equal(g.whoseTurn, 'pitcher');
  });
});

describe('pitch lifecycle', () => {
  test('select → thrown → answer cycle', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '직구', question: q('직구', 'k') });
    assert.equal(g.phase, 'PITCH_SELECTED');
    const { state, broadcast } = applyPitchThrown(g);
    assert.equal(state.phase, 'WAITING_BAT');
    assert.equal(state.whoseTurn, 'batter');
    // broadcast MUST NOT contain the answer
    assert.equal(broadcast.answer, undefined);
    assert.equal(broadcast.correctIndex, undefined);
    g = state;
    const correctIdx = g._serverAnswer.correctIndex;
    const after = applyBatAnswer(g, correctIdx);
    assert.equal(after.phase, 'IDLE');
    assert.equal(after.whoseTurn, 'pitcher');
  });
  test('cannot throw without select', () => {
    const g = createGame();
    assert.throws(() => applyPitchThrown(g));
  });
  test('cannot answer while IDLE', () => {
    assert.throws(() => applyBatAnswer(createGame(), 0));
  });
});

describe('fastball resolution', () => {
  test('correct → 1루타', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '직구', question: q('직구', 'k') });
    g = applyPitchThrown(g).state;
    const idx = g._serverAnswer.correctIndex;
    g = applyBatAnswer(g, idx);
    assert.equal(g.lastPlay.result, '1루타');
    assert.deepEqual(g.bases, [1,0,0]);
  });
  test('wrong → 볼 (B1)', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '직구', question: q('직구', 'k') });
    g = applyPitchThrown(g).state;
    const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
    g = applyBatAnswer(g, wrongIdx);
    assert.equal(g.balls, 1);
    assert.equal(g.lastPlay.result, 'B1');
  });
  test('4 balls → 볼넷 (주자 진루)', () => {
    let g = createGame();
    for (let i = 0; i < 4; i++) {
      g = applyPitchSelect(g, { type: '직구', question: q('직구', 'k') });
      g = applyPitchThrown(g).state;
      const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
      g = applyBatAnswer(g, wrongIdx);
    }
    assert.equal(g.lastPlay.result, '볼넷');
    assert.deepEqual(g.bases, [1,0,0]);
    assert.equal(g.balls, 0);
  });
});

describe('slider resolution', () => {
  test('wrong → strike, 3 strikes → 삼진+아웃', () => {
    let g = createGame();
    for (let i = 0; i < 3; i++) {
      g = applyPitchSelect(g, { type: '슬라이더', question: q('슬라이더', 'k') });
      g = applyPitchThrown(g).state;
      const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
      g = applyBatAnswer(g, wrongIdx);
    }
    assert.equal(g.outs, 1);
    assert.equal(g.lastPlay.result, '삼진');
  });
});

describe('curve resolution', () => {
  test('correct → 2루타', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '커브', question: q('커브', 'k') });
    g = applyPitchThrown(g).state;
    g = applyBatAnswer(g, g._serverAnswer.correctIndex);
    assert.equal(g.lastPlay.result, '2루타');
    assert.deepEqual(g.bases, [0,1,0]);
  });
  test('wrong → 즉시 삼진 아웃', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '커브', question: q('커브', 'k') });
    g = applyPitchThrown(g).state;
    const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
    g = applyBatAnswer(g, wrongIdx);
    assert.equal(g.outs, 1);
    assert.equal(g.lastPlay.result, '삼진');
  });
});

describe('half/inning transitions', () => {
  test('3 outs → 공수교대 (top → bottom)', () => {
    let g = createGame();
    for (let i = 0; i < 3; i++) {
      g = applyPitchSelect(g, { type: '커브', question: q('커브', 'k') });
      g = applyPitchThrown(g).state;
      const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
      g = applyBatAnswer(g, wrongIdx);
    }
    assert.equal(g.half, 'bottom');
    assert.equal(g.outs, 0);
    assert.equal(g.inning, 1);
  });
  test('6 outs → 다음 이닝', () => {
    let g = createGame();
    for (let i = 0; i < 6; i++) {
      g = applyPitchSelect(g, { type: '커브', question: q('커브', 'k') });
      g = applyPitchThrown(g).state;
      const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
      g = applyBatAnswer(g, wrongIdx);
    }
    assert.equal(g.inning, 2);
    assert.equal(g.half, 'top');
  });
  test('MAX_INNING*2 outs → END phase', () => {
    let g = createGame();
    for (let i = 0; i < MAX_INNING * 2 * 3; i++) {
      g = applyPitchSelect(g, { type: '커브', question: q('커브', 'k') });
      g = applyPitchThrown(g).state;
      const wrongIdx = (g._serverAnswer.correctIndex + 1) % 4;
      g = applyBatAnswer(g, wrongIdx);
    }
    assert.equal(g.phase, 'END');
  });
});

describe('timeout', () => {
  test('counts as wrong answer', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '직구', question: q('직구', 'k') });
    g = applyPitchThrown(g).state;
    g = applyTimeout(g);
    assert.equal(g.balls, 1);
  });
});

describe('winnerOf', () => {
  test('null when not ended', () => {
    assert.equal(winnerOf(createGame()), null);
  });
  test('tie / home / away', () => {
    assert.equal(winnerOf({ phase: 'END', homeScore: 3, awayScore: 3 }), 'tie');
    assert.equal(winnerOf({ phase: 'END', homeScore: 5, awayScore: 2 }), 'home');
    assert.equal(winnerOf({ phase: 'END', homeScore: 1, awayScore: 4 }), 'away');
  });
});

describe('information hiding', () => {
  test('pitch:thrown broadcast has no answer fields', () => {
    let g = createGame();
    g = applyPitchSelect(g, { type: '슬라이더', question: q('슬라이더', 'secret') });
    const { broadcast } = applyPitchThrown(g);
    const json = JSON.stringify(broadcast);
    assert.ok(!json.includes('secret') || broadcast.options.includes('secret'));
    // answer/correctIndex should never appear on broadcast
    assert.equal(broadcast.answer, undefined);
    assert.equal(broadcast.correctIndex, undefined);
  });
});
