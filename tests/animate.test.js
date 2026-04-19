import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  particleText, particleOffsets, burstOffsets,
  animForAction, particleForAction, ANIM_DURATION_MS,
} from '../js/animate.js';

describe('particleText', () => {
  test('known kinds return symbols', () => {
    assert.equal(particleText('heart'), '♥');
    assert.equal(particleText('zzz'), 'z');
    assert.equal(particleText('star'), '★');
    assert.equal(particleText('evolve'), '✦');
  });
  test('unknown → fallback', () => {
    assert.equal(particleText('xxx'), '·');
  });
});

describe('particleOffsets', () => {
  test('count=1 → single centered', () => {
    const r = particleOffsets(1, 40);
    assert.equal(r.length, 1);
    assert.equal(r[0].dx, 0);
  });
  test('count=3 → symmetric fan', () => {
    const r = particleOffsets(3, 40);
    assert.equal(r.length, 3);
    assert.equal(r[0].dx, -40);
    assert.equal(r[1].dx, 0);
    assert.equal(r[2].dx, 40);
  });
  test('delays increase linearly', () => {
    const r = particleOffsets(4, 40);
    assert.equal(r[0].delay, 0);
    assert.equal(r[1].delay, 80);
    assert.equal(r[2].delay, 160);
    assert.equal(r[3].delay, 240);
  });
  test('spread parameter affects dx magnitude', () => {
    const a = particleOffsets(3, 20);
    const b = particleOffsets(3, 80);
    assert.ok(Math.abs(b[0].dx) > Math.abs(a[0].dx));
  });
});

describe('burstOffsets', () => {
  test('count=8 → 8 points roughly on circle', () => {
    const r = burstOffsets(8, 60);
    assert.equal(r.length, 8);
    for (const p of r) {
      const dist = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
      assert.ok(Math.abs(dist - 60) < 2, `point not on radius 60: ${dist}`);
    }
  });
  test('radius parameter respected', () => {
    const r = burstOffsets(4, 100);
    const dists = r.map(p => Math.sqrt(p.dx * p.dx + p.dy * p.dy));
    for (const d of dists) assert.ok(Math.abs(d - 100) < 2, `radius wrong: ${d}`);
  });
});

describe('animForAction', () => {
  test('tap → bounce', () => { assert.equal(animForAction('tap'), 'bounce'); });
  test('feed success → eating', () => { assert.equal(animForAction('feed', { reward: {} }), 'eating'); });
  test('feed error → tilt', () => { assert.equal(animForAction('feed', { error: 'not hungry' }), 'tilt'); });
  test('pet → petting', () => { assert.equal(animForAction('pet'), 'petting'); });
  test('ball:correct → bounce', () => { assert.equal(animForAction('ball:correct'), 'bounce'); });
  test('ball:wrong → tilt', () => { assert.equal(animForAction('ball:wrong'), 'tilt'); });
  test('sleep → sleeping', () => { assert.equal(animForAction('sleep'), 'sleeping'); });
  test('evolve → evolving', () => { assert.equal(animForAction('evolve'), 'evolving'); });
  test('unknown → null', () => { assert.equal(animForAction('xxx'), null); });
});

describe('particleForAction', () => {
  test('pet → 3 hearts', () => {
    const p = particleForAction('pet');
    assert.equal(p.kind, 'heart');
    assert.equal(p.count, 3);
  });
  test('sleep → zzz', () => {
    const p = particleForAction('sleep');
    assert.equal(p.kind, 'zzz');
  });
  test('evolve → 8 burst', () => {
    const p = particleForAction('evolve');
    assert.equal(p.kind, 'evolve');
    assert.equal(p.count, 8);
  });
  test('levelup → 5 stars', () => {
    const p = particleForAction('levelup');
    assert.equal(p.kind, 'star');
    assert.equal(p.count, 5);
  });
  test('tap → null (no particles)', () => {
    assert.equal(particleForAction('tap'), null);
  });
});

describe('ANIM_DURATION_MS', () => {
  test('all known anims have durations', () => {
    for (const k of ['bounce', 'eating', 'petting', 'tilt', 'evolving']) {
      assert.ok(ANIM_DURATION_MS[k] > 0, `${k} missing duration`);
    }
  });
  test('sleeping is persistent (0)', () => {
    assert.equal(ANIM_DURATION_MS.sleeping, 0);
  });
  test('evolving is longest action', () => {
    assert.ok(ANIM_DURATION_MS.evolving >= ANIM_DURATION_MS.eating);
  });
});
