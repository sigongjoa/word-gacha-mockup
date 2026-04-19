import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EV, ROLE, PITCH_TYPES, envelope, validate, isClientBound, isServerBound } from '../js/pvp-proto.js';

describe('envelope', () => {
  test('wraps payload with seq/t/type', () => {
    const e = envelope(0, EV.PITCH_SELECT, { type: '직구' }, 100);
    assert.equal(e.seq, 0); assert.equal(e.t, 100); assert.equal(e.type, EV.PITCH_SELECT);
    assert.deepEqual(e.payload, { type: '직구' });
  });
  test('rejects negative seq', () => {
    assert.throws(() => envelope(-1, EV.PITCH_SELECT, {}));
  });
  test('rejects missing type', () => {
    assert.throws(() => envelope(0, '', {}));
  });
});

describe('validate — room:join', () => {
  test('ok', () => {
    assert.equal(validate(envelope(0, EV.ROOM_JOIN, { roomId: 'A', role: ROLE.PITCHER })), null);
  });
  test('rejects unknown role', () => {
    assert.ok(validate(envelope(0, EV.ROOM_JOIN, { roomId: 'A', role: 'cheater' })));
  });
});

describe('validate — pitch:select', () => {
  test('ok for known pitch', () => {
    assert.equal(validate(envelope(0, EV.PITCH_SELECT, { type: '슬라이더' })), null);
  });
  test('rejects unknown pitch', () => {
    assert.ok(validate(envelope(0, EV.PITCH_SELECT, { type: '너클볼' })));
  });
});

describe('validate — pitch:thrown', () => {
  test('ok with 4 options and no answer field', () => {
    const ok = envelope(0, EV.PITCH_THROWN, { type: '직구', prompt: 'brave', options: ['a','b','c','d'] });
    assert.equal(validate(ok), null);
  });
  test('rejects when options != 4', () => {
    assert.ok(validate(envelope(0, EV.PITCH_THROWN, { type: '직구', prompt: 'brave', options: ['a','b'] })));
  });
});

describe('validate — bat:answer', () => {
  test('ok 0..3', () => {
    for (let i = 0; i < 4; i++) assert.equal(validate(envelope(0, EV.BAT_ANSWER, { pickedIndex: i })), null);
  });
  test('rejects out of range', () => {
    assert.ok(validate(envelope(0, EV.BAT_ANSWER, { pickedIndex: 4 })));
    assert.ok(validate(envelope(0, EV.BAT_ANSWER, { pickedIndex: -1 })));
  });
});

describe('validate — misc', () => {
  test('unknown type rejected', () => {
    assert.ok(validate(envelope(0, 'evil:hack', {})));
  });
  test('non-envelope rejected', () => {
    assert.ok(validate(null));
    assert.ok(validate('not an object'));
  });
});

describe('direction helpers', () => {
  test('client-bound / server-bound partition covers all known events', () => {
    for (const ev of Object.values(EV)) {
      assert.ok(isClientBound(ev) || isServerBound(ev), `event ${ev} has no direction`);
    }
  });
  test('no event is both directions', () => {
    for (const ev of Object.values(EV)) {
      assert.ok(!(isClientBound(ev) && isServerBound(ev)), `event ${ev} is both`);
    }
  });
});

describe('constants', () => {
  test('PITCH_TYPES has 3 entries', () => {
    assert.equal(PITCH_TYPES.length, 3);
  });
  test('ROLE has pitcher/batter/spectator', () => {
    assert.ok(ROLE.PITCHER && ROLE.BATTER && ROLE.SPECTATOR);
  });
});
