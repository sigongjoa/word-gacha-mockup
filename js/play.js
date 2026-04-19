// play — interactions in the playroom. Pure functions.
// All actions take a creature + now, return { creature, reward, speech, error? }.

import { interact, BOND_MAX, HUNGER_MAX, moodOf } from './creature.js';

// Cooldowns (ms). tap is a creature.js concern but we keep its gate here for UI parity.
export const COOLDOWNS = {
  tap:   3_000,
  feed:  0,
  pet:   30_000,
  ball:  300_000,
  sleep: 86_400_000, // once a day
};

const MS = { sec: 1000 };

export function canDo(kind, lastAt, now) {
  if (!(kind in COOLDOWNS)) return false;
  if (!lastAt) return true;
  const elapsed = new Date(now) - new Date(lastAt);
  return elapsed >= COOLDOWNS[kind];
}

export function remainingMs(kind, lastAt, now) {
  if (!lastAt) return 0;
  const elapsed = new Date(now) - new Date(lastAt);
  return Math.max(0, COOLDOWNS[kind] - elapsed);
}

// moodSpeech — tiny pool per mood. returns a string.
const SPEECH = {
  happy:   ['오늘도 같이 놀자!', '재밌어!', '좋아 좋아~'],
  neutral: ['안녕!', '뭐하고 놀까?', '음…'],
  hungry:  ['배고파…', '뭐 먹을 거 있어?', '밥 줘~'],
  sad:     ['어디 갔었어?', '심심했어…', '보고 싶었어'],
};
export function speechFor(mood, seed = 0) {
  const pool = SPEECH[mood] ?? SPEECH.neutral;
  return pool[seed % pool.length];
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function performAction(creature, kind, now) {
  if (!creature) return { error: 'no creature' };
  switch (kind) {
    case 'tap': {
      const next = interact(creature, 'tap', now);
      return { creature: next, reward: { bond: 0.5 }, speech: speechFor(next.mood, Date.now()) };
    }
    case 'feed': {
      if ((creature.hunger ?? HUNGER_MAX) >= 80) {
        return { error: 'not hungry', speech: '배 안 고파!' };
      }
      const next = {
        ...creature,
        hunger: clamp((creature.hunger ?? 0) + 30, 0, HUNGER_MAX),
        bond:   clamp((creature.bond ?? 0) + 1, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { hunger: 30, bond: 1 }, speech: '맛있어!' };
    }
    case 'pet': {
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 3, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 3 }, speech: '쓰담쓰담 좋아~' };
    }
    case 'ball': {
      // bond +2 on correct answer (caller decides); baseline +0.5 for playing.
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 0.5, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 0.5 }, speech: '공이다!' };
    }
    case 'ball:correct': {
      const next = {
        ...creature,
        bond: clamp((creature.bond ?? 0) + 2, 0, BOND_MAX),
        lastInteractionAt: now,
      };
      next.mood = moodOf(next, now);
      return { creature: next, reward: { bond: 2, exp: 5 }, speech: '정답!' };
    }
    case 'sleep': {
      // restores mood baseline, does not change bond
      const next = { ...creature, mood: 'happy', lastInteractionAt: now };
      return { creature: next, reward: {}, speech: 'zZz…' };
    }
    default:
      return { error: 'unknown action' };
  }
}
