// pitch-types — 3 구종. Each exposes generate(tier, rand) → { prompt, answer, options, meta }.
// rand is an optional () => number in [0,1) for deterministic tests.

const defaultRand = Math.random;

// === 직구: 영단어 → 뜻 4지선다 ===
const FASTBALL_POOL = {
  1: [
    ['apple','사과'],['book','책'],['run','달리다'],['water','물'],['happy','행복한'],
    ['friend','친구'],['school','학교'],['eat','먹다'],['sleep','자다'],['walk','걷다'],
    ['brave','용감한'],['kind','친절한'],['fast','빠른'],['strong','강한'],['begin','시작하다'],
  ],
  2: [
    ['decide','결정하다'],['clever','영리한'],['prepare','준비하다'],['notice','알아차리다'],
    ['suggest','제안하다'],['promise','약속하다'],['explain','설명하다'],['describe','묘사하다'],
    ['honest','정직한'],['dangerous','위험한'],['difficult','어려운'],['popular','인기있는'],
  ],
  3: [
    ['compromise','타협'],['reluctant','꺼리는'],['obvious','명백한'],['genuine','진정한'],
    ['efficient','효율적인'],['stubborn','고집 센'],['flexible','유연한'],['generous','관대한'],
    ['anxious','불안한'],['cautious','조심스러운'],['rational','이성적인'],['humble','겸손한'],
  ],
};

// === 슬라이더: 영단어 → 동의어 1 + 무관어 3 ===
// [word, synonym, distractors[3]]
const SLIDER_POOL = {
  1: [
    ['big',    'large',   ['small','short','thin']],
    ['fast',   'quick',   ['slow','heavy','cold']],
    ['happy',  'glad',    ['sad','angry','tired']],
    ['smart',  'clever',  ['dumb','weak','loud']],
    ['brave',  'bold',    ['shy','lazy','soft']],
  ],
  2: [
    ['begin',  'start',    ['end','stop','finish']],
    ['help',   'assist',   ['block','avoid','ignore']],
    ['answer', 'reply',    ['ask','forget','silence']],
    ['choose', 'pick',     ['reject','delay','waste']],
    ['enemy',  'foe',      ['friend','ally','helper']],
  ],
  3: [
    ['honest',   'sincere',   ['cruel','vague','idle']],
    ['obvious',  'apparent',  ['hidden','subtle','vague']],
    ['generous', 'giving',    ['stingy','cruel','hostile']],
    ['humble',   'modest',    ['arrogant','boastful','proud']],
    ['cautious', 'careful',   ['reckless','rash','wild']],
  ],
};

// === 커브: 한 줄 cloze — 올바른 동사 형태 고르기 ===
// [sentence with ___, correct, distractors[3]]
const CURVE_POOL = {
  1: [
    ['She ___ to school every day.',  'goes',   ['go','going','gone']],
    ['They ___ soccer last Sunday.',   'played', ['play','plays','playing']],
    ['I ___ an apple now.',            'am eating', ['eat','eats','ate']],
    ['He ___ tall.',                   'is',     ['are','am','be']],
    ['We ___ friends since 2020.',     'have been', ['are','were','being']],
  ],
  2: [
    ['If it ___ tomorrow, we stay home.',   'rains',     ['rain','rained','raining']],
    ['The book ___ by many students.',      'is read',   ['reads','reading','read']],
    ['She wishes she ___ more time.',       'had',       ['has','have','having']],
    ['By 2030, AI ___ many jobs.',          'will change', ['changes','changed','change']],
    ['The door ___ open when I arrived.',   'was left',  ['leaves','leaving','leaves']],
  ],
  3: [
    ['Had I known, I ___ earlier.',                'would have come',    ['came','come','will come']],
    ['Rarely ___ such talent.',                    'have I seen',        ['I have seen','I saw','did I see']],
    ['It is essential that he ___ present.',       'be',                 ['is','was','been']],
    ['Not only ___ late, but also unprepared.',    'was he',             ['he was','he is','did he be']],
    ['The project, ___ last year, is thriving.',   'launched',           ['launch','launches','launching']],
  ],
};

// --- Helpers --------------------------------------------------------
function shuffle(arr, rand = defaultRand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pickOne(arr, rand = defaultRand) {
  return arr[Math.floor(rand() * arr.length)];
}
function clampTier(tier) {
  return Math.max(1, Math.min(3, tier | 0));
}

// --- Generators -----------------------------------------------------

// 직구: word → meaning
export function generateFastball(tier = 1, rand = defaultRand) {
  const pool = FASTBALL_POOL[clampTier(tier)];
  const [eng, ko] = pickOne(pool, rand);
  const distractors = shuffle(pool.filter(w => w[1] !== ko), rand).slice(0, 3).map(w => w[1]);
  const options = shuffle([ko, ...distractors], rand);
  return { type: '직구', prompt: eng, answer: ko, options, meta: { eng, ko } };
}

// 슬라이더: word → synonym
export function generateSlider(tier = 1, rand = defaultRand) {
  const pool = SLIDER_POOL[clampTier(tier)];
  const [word, syn, dist] = pickOne(pool, rand);
  const options = shuffle([syn, ...dist], rand);
  return { type: '슬라이더', prompt: word, answer: syn, options, meta: { word } };
}

// 커브: cloze → correct form
export function generateCurve(tier = 1, rand = defaultRand) {
  const pool = CURVE_POOL[clampTier(tier)];
  const [sentence, correct, dist] = pickOne(pool, rand);
  const options = shuffle([correct, ...dist], rand);
  return { type: '커브', prompt: sentence, answer: correct, options, meta: { sentence } };
}

export function generateQuestion(pitchType, tier = 1, rand = defaultRand) {
  switch (pitchType) {
    case '직구':     return generateFastball(tier, rand);
    case '슬라이더':  return generateSlider(tier, rand);
    case '커브':     return generateCurve(tier, rand);
    default: throw new Error('unknown pitch type: ' + pitchType);
  }
}

export const POOLS = { FASTBALL_POOL, SLIDER_POOL, CURVE_POOL };
