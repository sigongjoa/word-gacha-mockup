// pvp-proto — event constants + envelope schema + validator.
// All messages are wrapped in an envelope: { seq, t, type, payload }.

export const EV = Object.freeze({
  ROOM_JOIN:      'room:join',      // C→S
  ROOM_STATE:     'room:state',     // S→C
  PITCH_SELECT:   'pitch:select',   // C→S  (pitcher only)
  PITCH_THROWN:   'pitch:thrown',   // S→C  (broadcast — no answer inside)
  PITCH_INFO:     'pitch:info',     // S→C  (pitcher only — includes answer)
  BAT_ANSWER:     'bat:answer',     // C→S  (batter only)
  PLAY_RESULT:    'play:result',    // S→C  (includes correct flag + state delta)
  TURN_START:     'turn:start',     // S→C
  GAME_END:       'game:end',       // S→C
});

export const ROLE = Object.freeze({
  PITCHER:   'pitcher',
  BATTER:    'batter',
  SPECTATOR: 'spectator',
});

export const PITCH_TYPES = Object.freeze(['직구', '슬라이더', '커브']);

export function envelope(seq, type, payload, now = Date.now()) {
  if (!Number.isInteger(seq) || seq < 0) throw new Error('seq must be non-negative int');
  if (!type || typeof type !== 'string') throw new Error('type required');
  return { seq, t: now, type, payload: payload ?? {} };
}

// Per-event payload validators. Returns null on ok, string describing issue on fail.
const VALIDATORS = {
  [EV.ROOM_JOIN]:    p => str(p.roomId) && str(p.role) && ROLE_SET.has(p.role) ? null : 'invalid room:join',
  [EV.ROOM_STATE]:   p => Array.isArray(p.players) && num(p.inning) && str(p.half) ? null : 'invalid room:state',
  [EV.PITCH_SELECT]: p => str(p.type) && PITCH_SET.has(p.type) ? null : 'invalid pitch:select',
  [EV.PITCH_THROWN]: p => str(p.type) && str(p.prompt) && Array.isArray(p.options) && p.options.length === 4 ? null : 'invalid pitch:thrown',
  [EV.PITCH_INFO]:   p => str(p.type) && str(p.answer) && Number.isInteger(p.correctIndex) ? null : 'invalid pitch:info',
  [EV.BAT_ANSWER]:   p => Number.isInteger(p.pickedIndex) && p.pickedIndex >= 0 && p.pickedIndex < 4 ? null : 'invalid bat:answer',
  [EV.PLAY_RESULT]:  p => typeof p.correct === 'boolean' && str(p.result) ? null : 'invalid play:result',
  [EV.TURN_START]:   p => str(p.whoseTurn) ? null : 'invalid turn:start',
  [EV.GAME_END]:     p => num(p.home) && num(p.away) ? null : 'invalid game:end',
};
const ROLE_SET  = new Set(Object.values(ROLE));
const PITCH_SET = new Set(PITCH_TYPES);
const str = v => typeof v === 'string' && v.length > 0;
const num = v => typeof v === 'number' && Number.isFinite(v);

export function validate(env) {
  if (!env || typeof env !== 'object')    return 'envelope required';
  if (!Number.isInteger(env.seq))         return 'seq must be int';
  if (!num(env.t))                        return 't must be number';
  if (!str(env.type))                     return 'type must be non-empty string';
  const fn = VALIDATORS[env.type];
  if (!fn) return 'unknown event type: ' + env.type;
  return fn(env.payload ?? {});
}

export function isClientBound(type) {
  return [EV.ROOM_STATE, EV.PITCH_THROWN, EV.PITCH_INFO, EV.PLAY_RESULT, EV.TURN_START, EV.GAME_END].includes(type);
}
export function isServerBound(type) {
  return [EV.ROOM_JOIN, EV.PITCH_SELECT, EV.BAT_ANSWER].includes(type);
}
