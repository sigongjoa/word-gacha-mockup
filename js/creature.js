// creature — vitals + mood + bond + evolution. Pure functions.

export const HUNGER_MAX = 100;
export const BOND_MAX = 100;
export const HUNGER_DECAY_PER_HOUR = 10 / 6; // -10 per 6h

export const STARTER_SPECIES = [
  { key: 'sprout',  label: '초록 새싹',  color: '#2f9e57' },
  { key: 'ember',   label: '불씨',      color: '#d4232c' },
  { key: 'droplet', label: '물방울',    color: '#2174d4' },
];

export const PERSONALITIES = [
  { key: 'brave',   label: '용감한' },
  { key: 'gentle',  label: '상냥한' },
  { key: 'curious', label: '호기심 많은' },
  { key: 'lazy',    label: '느긋한' },
];

const EVOLUTION_REQS = [
  { from: 1, to: 2, bond: 20,  box5: 3  },
  { from: 2, to: 3, bond: 50,  box5: 10 },
  { from: 3, to: 4, bond: 80,  box5: 25 },
  { from: 4, to: 5, bond: 100, box5: 25, streak: 14 },
];

const INTERACTION_EFFECTS = {
  tap:        { bond: 0.5, hunger: 0 },
  answer:     { bond: 1,   hunger: 2 },
  addWord:    { bond: 2,   hunger: 0 },
  dailyVisit: { bond: 5,   hunger: 0 },
  evolve:     { bond: 0,   hunger: 0 },
};

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function hoursBetween(a, b) { return (new Date(b) - new Date(a)) / 3600000; }

export function createCreature({ speciesKey, name, personality, now }) {
  if (!STARTER_SPECIES.some(s => s.key === speciesKey)) throw new Error('unknown species: ' + speciesKey);
  if (!PERSONALITIES.some(p => p.key === personality))  throw new Error('unknown personality: ' + personality);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('name required');
  const c = {
    id: 'c-' + Date.now().toString(36),
    name: trimmed,
    speciesKey,
    personality,
    stage: 1,
    hunger: HUNGER_MAX,
    bond: 0,
    mood: 'happy',
    bornAt: now,
    lastInteractionAt: now,
  };
  c.lastTickedAt = now;
  c.mood = 'happy'; // 첫 만남은 늘 happy
  return c;
}

export function moodOf(creature, now) {
  const hunger = creature.hunger ?? HUNGER_MAX;
  if (hunger <= 10) return 'hungry'; // critical hunger overrides neglect
  const idle = hoursBetween(creature.lastInteractionAt, now);
  if (idle >= 48) return 'sad';      // big neglect window
  if (hunger <= 20) return 'hungry';
  if ((creature.bond ?? 0) >= 80 && hunger > 60) return 'happy';
  return 'neutral';
}

export function tick(creature, now) {
  const checkpoint = creature.lastTickedAt ?? creature.lastInteractionAt;
  const idleH = Math.max(0, hoursBetween(checkpoint, now));
  const decay = Math.floor(idleH * HUNGER_DECAY_PER_HOUR);
  const next = {
    ...creature,
    hunger: clamp((creature.hunger ?? HUNGER_MAX) - decay, 0, HUNGER_MAX),
    lastTickedAt: now, // checkpoint separate from lastInteractionAt
  };
  next.mood = moodOf(next, now);
  return next;
}

export function interact(creature, kind, now) {
  const eff = INTERACTION_EFFECTS[kind];
  if (!eff) return creature;
  const next = {
    ...creature,
    bond:   clamp((creature.bond ?? 0) + eff.bond, 0, BOND_MAX),
    hunger: clamp((creature.hunger ?? HUNGER_MAX) + eff.hunger, 0, HUNGER_MAX),
    lastInteractionAt: now,
  };
  next.mood = moodOf(next, now);
  return next;
}

export function canEvolve(creature, words, streak) {
  const req = EVOLUTION_REQS.find(r => r.from === creature.stage);
  if (!req) return false;
  const box5 = words.filter(w => w.box === 5).length;
  if ((creature.bond ?? 0) < req.bond) return false;
  if (box5 < req.box5) return false;
  if (req.streak !== undefined && (streak ?? 0) < req.streak) return false;
  return true;
}

export function evolve(creature) {
  return { ...creature, stage: Math.min(5, (creature.stage ?? 1) + 1) };
}
