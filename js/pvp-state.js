// pvp-state — pure functions for turn-based baseball state.
// No timers, no IO. Server-authoritative: batter never sees `answer`.

export const MAX_INNING = 4;

export function createGame() {
  return {
    inning: 1,
    half: 'top',                 // 'top' = away bats, 'bottom' = home bats
    outs: 0,
    strikes: 0,
    balls: 0,
    bases: [0, 0, 0],            // [1st, 2nd, 3rd], 1 = runner present
    awayScore: 0,
    homeScore: 0,
    phase: 'IDLE',               // IDLE → PITCH_SELECTED → WAITING_BAT → RESOLVING → IDLE | END
    whoseTurn: 'pitcher',        // 'pitcher' | 'batter'
    lastPlay: null,              // { type, correct, result, runs } for UI
  };
}

function currentBatterSide(state) {
  return state.half === 'top' ? 'away' : 'home';
}
function addRun(state, n) {
  const side = currentBatterSide(state);
  return side === 'away'
    ? { ...state, awayScore: state.awayScore + n }
    : { ...state, homeScore: state.homeScore + n };
}

function advanceRunners(bases, n) {
  let runs = 0;
  const next = [0, 0, 0];
  const runners = [1, ...bases]; // batter is 0th runner
  for (let i = 0; i < runners.length; i++) {
    if (!runners[i]) continue;
    const newBase = i + n;
    if (newBase >= 4) runs += 1;
    else next[newBase - 1] = 1;
  }
  return { bases: next, runs };
}

// Server marks a pitch as selected (answer stored internally, not returned to client).
export function applyPitchSelect(state, { type, question }) {
  if (state.phase !== 'IDLE') throw new Error('cannot select pitch in phase: ' + state.phase);
  return {
    ...state,
    phase: 'PITCH_SELECTED',
    _serverAnswer: { pitchType: type, correctIndex: question.options.indexOf(question.answer), prompt: question.prompt, options: question.options },
  };
}

// Server "throws" the pitch — broadcasts prompt/options, moves to WAITING_BAT.
// Returns { state, broadcast } where broadcast has no answer info.
export function applyPitchThrown(state) {
  if (state.phase !== 'PITCH_SELECTED') throw new Error('pitch not selected');
  const { pitchType, prompt, options } = state._serverAnswer;
  return {
    state: { ...state, phase: 'WAITING_BAT', whoseTurn: 'batter' },
    broadcast: { type: pitchType, prompt, options },
  };
}

// Batter answers. Server compares pickedIndex to _serverAnswer.correctIndex.
export function applyBatAnswer(state, pickedIndex) {
  if (state.phase !== 'WAITING_BAT') throw new Error('not waiting on batter');
  const correct = pickedIndex === state._serverAnswer.correctIndex;
  return resolvePlay(state, correct);
}

// Turn timeout / no answer = automatic ball count.
export function applyTimeout(state) {
  if (state.phase !== 'WAITING_BAT') throw new Error('no pitch pending');
  return resolvePlay(state, false);
}

function resolvePlay(state, correct) {
  const pitchType = state._serverAnswer.pitchType;
  let next = { ...state, phase: 'RESOLVING', _serverAnswer: null };

  // 직구: 기본 볼/스트라이크 카운트 기반
  // 슬라이더: 맞추면 1루타, 틀리면 스트라이크
  // 커브: 맞추면 2루타, 틀리면 아웃 바로 (난이도 ↑)
  let result = '';
  let runs = 0;

  if (correct) {
    const hit = pitchType === '커브' ? 2 : pitchType === '슬라이더' ? 1 : 1; // 직구도 1루타
    const adv = advanceRunners(next.bases, hit);
    next.bases = adv.bases;
    runs = adv.runs;
    if (runs > 0) next = addRun(next, runs);
    result = hit === 2 ? '2루타' : '1루타';
    next.strikes = 0; next.balls = 0;
  } else {
    if (pitchType === '커브') {
      next.outs += 1;
      result = '삼진';
      next.strikes = 0; next.balls = 0;
    } else if (pitchType === '슬라이더') {
      next.strikes += 1;
      result = 'S' + next.strikes;
      if (next.strikes >= 3) { next.outs += 1; next.strikes = 0; next.balls = 0; result = '삼진'; }
    } else {
      // 직구 오답 — 볼넷 유발
      next.balls += 1;
      result = 'B' + next.balls;
      if (next.balls >= 4) {
        const adv = advanceRunners(next.bases, 1);
        next.bases = adv.bases;
        runs = adv.runs;
        if (runs > 0) next = addRun(next, runs);
        next.strikes = 0; next.balls = 0;
        result = '볼넷';
      }
    }
  }

  next.lastPlay = { type: pitchType, correct, result, runs };

  if (next.outs >= 3) return endHalf(next);
  next.phase = 'IDLE';
  next.whoseTurn = 'pitcher';
  return next;
}

function endHalf(state) {
  let next = { ...state, outs: 0, strikes: 0, balls: 0, bases: [0,0,0] };
  if (state.half === 'top') {
    next.half = 'bottom';
    next.phase = 'IDLE';
    next.whoseTurn = 'pitcher';
  } else {
    next.half = 'top';
    next.inning = state.inning + 1;
    if (next.inning > MAX_INNING) {
      next.phase = 'END';
      next.whoseTurn = null;
    } else {
      next.phase = 'IDLE';
      next.whoseTurn = 'pitcher';
    }
  }
  return next;
}

export function winnerOf(state) {
  if (state.phase !== 'END') return null;
  if (state.homeScore > state.awayScore) return 'home';
  if (state.awayScore > state.homeScore) return 'away';
  return 'tie';
}
