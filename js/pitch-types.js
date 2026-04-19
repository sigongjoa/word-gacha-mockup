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

// === 슬라이더 (문법): 시제/형태/수 일치 — cloze ===
// [sentence with ___, correct form, distractor forms[3]]
const SLIDER_POOL = {
  1: [
    ['She ___ to school every day.',     'goes',      ['go','going','gone']],
    ['They ___ soccer last Sunday.',      'played',    ['play','plays','playing']],
    ['He ___ tall.',                      'is',        ['are','am','be']],
    ['I ___ an apple now.',               'am eating', ['eat','eats','ate']],
    ['My brother ___ books.',             'likes',     ['like','liking','liked']],
  ],
  2: [
    ['If it ___ tomorrow, we stay home.',  'rains',      ['rain','rained','raining']],
    ['The book ___ by many students.',     'is read',    ['reads','reading','read']],
    ['She wishes she ___ more time.',      'had',        ['has','have','having']],
    ['By 2030, AI ___ many jobs.',         'will change',['changes','changed','change']],
    ['We ___ friends since 2020.',         'have been',  ['are','were','being']],
  ],
  3: [
    ['Had I known, I ___ earlier.',               'would have come', ['came','come','will come']],
    ['It is essential that he ___ present.',      'be',              ['is','was','been']],
    ['Not only ___ late, but also unprepared.',   'was he',          ['he was','he is','did he be']],
    ['The project, ___ last year, is thriving.',  'launched',        ['launch','launches','launching']],
    ['Rarely ___ such talent.',                   'have I seen',     ['I have seen','I saw','did I see']],
  ],
};

// === 커브 (빈칸/독해): 문맥 어휘 cloze — 의미에 맞는 단어 ===
// [sentence with ___, correct word, distractor words[3]]
const CURVE_POOL = {
  1: [
    ['Despite the ___, they continued the game.',  'rain',    ['sun','book','apple']],
    ['I was so ___ that I cried tears of joy.',    'happy',   ['hungry','cold','tired']],
    ['The cat is ___ the table.',                  'under',   ['angry','book','slow']],
    ['She is ___ because she didn\'t sleep.',      'tired',   ['fast','red','quick']],
    ['Please ___ the door before leaving.',        'close',   ['eat','run','sleep']],
  ],
  2: [
    ['The detective ___ the suspect for hours.',    'questioned', ['cooked','painted','danced']],
    ['Her argument was too ___ to accept.',         'vague',      ['delicious','quiet','blue']],
    ['We need to ___ a decision by Friday.',        'reach',      ['eat','sleep','draw']],
    ['The new law will ___ everyone equally.',      'affect',     ['taste','smell','climb']],
    ['He showed ___ skill in solving the puzzle.',  'remarkable', ['edible','frozen','loud']],
  ],
  3: [
    ['The policy had ___ consequences no one foresaw.',  'unintended',  ['delicious','flammable','rectangular']],
    ['His ___ approach saved the company from ruin.',    'pragmatic',   ['edible','nocturnal','aromatic']],
    ['The evidence was ___, leaving jurors uncertain.',  'inconclusive',['alphabetical','fragrant','vertical']],
    ['She made a ___ effort to meet the deadline.',      'concerted',   ['edible','circular','aquatic']],
    ['The critic\'s ___ review ended her career.',       'scathing',    ['aromatic','metallic','spherical']],
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

// 직구 (어휘): word → meaning
export function generateFastball(tier = 1, rand = defaultRand) {
  const pool = FASTBALL_POOL[clampTier(tier)];
  const [eng, ko] = pickOne(pool, rand);
  const distractors = shuffle(pool.filter(w => w[1] !== ko), rand).slice(0, 3).map(w => w[1]);
  const options = shuffle([ko, ...distractors], rand);
  return { type: '직구', category: '어휘', prompt: eng, answer: ko, options, meta: { eng, ko } };
}

// 슬라이더 (문법): sentence cloze → correct verb form
export function generateSlider(tier = 1, rand = defaultRand) {
  const pool = SLIDER_POOL[clampTier(tier)];
  const [sentence, correct, dist] = pickOne(pool, rand);
  const options = shuffle([correct, ...dist], rand);
  return { type: '슬라이더', category: '문법', prompt: sentence, answer: correct, options, meta: { sentence } };
}

// 커브 (빈칸/독해): context-meaning cloze → correct word
export function generateCurve(tier = 1, rand = defaultRand) {
  const pool = CURVE_POOL[clampTier(tier)];
  const [sentence, correct, dist] = pickOne(pool, rand);
  const options = shuffle([correct, ...dist], rand);
  return { type: '커브', category: '빈칸', prompt: sentence, answer: correct, options, meta: { sentence } };
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

export const PITCH_CATEGORY = Object.freeze({
  '직구':   '어휘',
  '슬라이더': '문법',
  '커브':   '빈칸',
});
