// MockTransport — 싱글 플레이용. Local client = human batter.
// Remote side = AI pitcher, all state server-authoritative inside this module.
//
// Swap later with WebSocketTransport: same send(event, payload) / on(event, fn) surface.

import { EV, envelope, validate } from './pvp-proto.js';
import { generateQuestion } from './pitch-types.js';
import {
  createGame, applyPitchSelect, applyPitchThrown, applyBatAnswer, winnerOf,
} from './pvp-state.js';

const PITCHES = ['직구', '슬라이더', '커브'];

export function createMockTransport({ humanRole = 'batter', tier = 1, rand = Math.random } = {}) {
  let seq = 0;
  const listeners = new Map();
  let game = createGame();
  let log = []; // all envelopes, both directions — for event log UI

  function emit(type, payload) {
    const env = envelope(seq++, type, payload);
    const err = validate(env);
    if (err) throw new Error('invalid outbound envelope: ' + err);
    log.push({ dir: 'S→C', env });
    const fns = listeners.get(type) ?? [];
    for (const fn of fns) {
      // Defer to next tick to simulate network.
      Promise.resolve().then(() => fn(env.payload, env));
    }
  }

  function aiPickPitch() {
    // Simple AI: random pitch weighted by current count.
    // More strikes → prefer curve (closer to K). More balls → prefer fastball (safer).
    const w = { '직구': 1, '슬라이더': 1, '커브': 1 };
    if (game.strikes === 2) w['커브'] += 2;
    if (game.balls >= 2)    w['직구'] += 2;
    const total = w['직구'] + w['슬라이더'] + w['커브'];
    let r = rand() * total;
    for (const k of PITCHES) { if ((r -= w[k]) < 0) return k; }
    return '직구';
  }

  // --- Inbound (client → server) ---
  function send(type, payload = {}) {
    const env = envelope(seq++, type, payload);
    const err = validate(env);
    if (err) throw new Error('invalid inbound envelope: ' + err);
    log.push({ dir: 'C→S', env });

    if (type === EV.ROOM_JOIN) {
      emit(EV.ROOM_STATE, snapshotRoomState());
      // AI pitcher immediately takes turn if that's the config
      if (humanRole === 'batter') scheduleAIPitch();
      return;
    }

    if (type === EV.PITCH_SELECT) {
      // Human-pitcher path (humanRole === 'pitcher').
      const q = generateQuestion(payload.type, tier, rand);
      game = applyPitchSelect(game, { type: payload.type, question: q });
      const { state, broadcast } = applyPitchThrown(game);
      game = state;
      emit(EV.PITCH_THROWN, broadcast);
      // Pitcher-only side channel: include answer so human pitcher sees it.
      emit(EV.PITCH_INFO, {
        type: q.type,
        answer: q.answer,
        correctIndex: game._serverAnswer.correctIndex,
      });
      // AI batter answers after ball flight completes (matches --ball-dur 1800ms).
      setTimeout(() => {
        const correctIdx = game._serverAnswer.correctIndex;
        const acc = 0.6;
        const pick = rand() < acc ? correctIdx : (correctIdx + 1 + Math.floor(rand() * 3)) % 4;
        feedBatAnswer(pick);
      }, 2200);
      return;
    }

    if (type === EV.BAT_ANSWER) {
      feedBatAnswer(payload.pickedIndex);
      return;
    }
  }

  function feedBatAnswer(pickedIndex) {
    game = applyBatAnswer(game, pickedIndex);
    emit(EV.PLAY_RESULT, {
      correct: game.lastPlay.correct,
      result: game.lastPlay.result,
      runs: game.lastPlay.runs,
      type: game.lastPlay.type,
    });
    emit(EV.ROOM_STATE, snapshotRoomState());
    if (game.phase === 'END') {
      emit(EV.GAME_END, { home: game.homeScore, away: game.awayScore, winner: winnerOf(game) });
      return;
    }
    // Next turn
    if (humanRole === 'batter') scheduleAIPitch();
    else emit(EV.TURN_START, { whoseTurn: 'pitcher' });
  }

  function scheduleAIPitch() {
    setTimeout(() => {
      if (game.phase !== 'IDLE') return;
      const pt = aiPickPitch();
      const q = generateQuestion(pt, tier, rand);
      game = applyPitchSelect(game, { type: pt, question: q });
      const { state, broadcast } = applyPitchThrown(game);
      game = state;
      emit(EV.PITCH_THROWN, broadcast);
      emit(EV.TURN_START, { whoseTurn: 'batter' });
    }, 500);
  }

  function snapshotRoomState() {
    return {
      players: [{ role: humanRole, nick: 'you' }, { role: humanRole === 'batter' ? 'pitcher' : 'batter', nick: 'AI' }],
      inning: game.inning,
      half: game.half,
      awayScore: game.awayScore,
      homeScore: game.homeScore,
      outs: game.outs,
      strikes: game.strikes,
      balls: game.balls,
      bases: game.bases,
      phase: game.phase,
      whoseTurn: game.whoseTurn,
    };
  }

  function on(type, fn) {
    const arr = listeners.get(type) ?? [];
    arr.push(fn);
    listeners.set(type, arr);
    return () => { listeners.set(type, arr.filter(f => f !== fn)); };
  }

  function close() { listeners.clear(); }

  function getLog() { return log.slice(); }

  return { send, on, close, getLog, _debug: () => ({ game, seq, log }) };
}
