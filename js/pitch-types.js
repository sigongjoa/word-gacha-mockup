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
// [sentence with ___, correct form, distractor forms[3], explanation]
const SLIDER_POOL = {
  1: [
    ['She ___ to school every day.',     'goes',      ['go','went','will go'],
      "주어 She(3인칭 단수) + 반복(every day) → 현재시제 + -s/-es를 붙여 goes. go는 수 일치 실수, went는 과거형, will go는 미래형이라 '매일 반복'과 안 맞음."],
    ['They ___ soccer last Sunday.',      'played',    ['play','are playing','will play'],
      "last Sunday는 과거 시점 → 과거형 played. 현재/현재진행/미래는 모두 과거 시점을 가리키는 'last Sunday'와 호응하지 못함."],
    ['He ___ tall.',                      'is',        ['are','was','has been'],
      "주어 He(3인칭 단수) + 현재 상태 → is. are는 복수/you용이라 수 일치 오류, was는 과거, has been은 현재완료라 '지금의 상태'를 단순히 말할 때 어색."],
    ['I ___ an apple now.',               'am eating', ['eat','will eat','ate'],
      "now(지금 이 순간) → 현재진행형 am eating. 단순현재 eat은 '지금 진행' 불가, will eat는 미래, ate는 과거."],
    ['My brother ___ books.',             'likes',     ['like','liked','will like'],
      "주어 My brother(3인칭 단수) + 현재 일반 → likes. like는 수 일치 실수, liked는 과거, will like는 미래."],
  ],
  2: [
    ['If it ___ tomorrow, we stay home.',  'rains',      ['rain','rained','raining'],
      "조건 부사절(If~)에서는 미래 대신 현재시제 사용. 주어 it → rains."],
    ['The book ___ by many students.',     'is read',    ['reads','reading','read'],
      "by + 행위자 → 수동태. 주어(The book) + be + 과거분사 = is read."],
    ['She wishes she ___ more time.',      'had',        ['has','have','having'],
      "wish + 가정법 과거(현재 사실의 반대). 현재 사실을 반대로 가정 → 과거형 had."],
    ['By 2030, AI ___ many jobs.',         'will change',['changes','changed','change'],
      "By 2030은 미래의 시점 → 미래시제 will change."],
    ['We ___ friends since 2020.',         'have been',  ['are','were','being'],
      "since 2020(특정 과거 시점부터 지금까지) → 현재완료 have been."],
  ],
  3: [
    ['Had I known, I ___ earlier.',               'would have come', ['came','come','will come'],
      "도치된 가정법 과거완료(Had I known = If I had known). 귀결절은 would/could have + p.p."],
    ['It is essential that he ___ present.',      'be',              ['is','was','been'],
      "'It is essential/necessary that S + (should) 동사원형' 구조. should 생략 시 원형 be."],
    ['Not only ___ late, but also unprepared.',   'was he',          ['he was','he is','had he'],
      "부정어(Not only)가 문두로 나가면 주어-동사 도치 필요 → 'was he'. he was는 도치 실패, he is는 시제·도치 둘 다 실패, had he는 완료형이라 상태 서술에 부적합."],
    ['The project, ___ last year, is thriving.',  'launched',        ['launch','launches','launching'],
      "명사구 수식용 과거분사(수동). '작년에 출시된 프로젝트' → launched last year."],
    ['Rarely ___ such talent.',                   'have I seen',     ['I have seen','I saw','did I see'],
      "부정부사(Rarely) 문두 → 도치 + 현재완료 경험 → have I seen."],
  ],
};

// === 커브 (빈칸/독해): 문맥 어휘 cloze — 의미에 맞는 단어 ===
// [sentence with ___, correct word, distractor words[3], explanation]
const CURVE_POOL = {
  1: [
    ['Despite the ___, they continued the game.',  'rain',    ['sun','book','apple'],
      "Despite는 '~에도 불구하고'. 경기를 계속하게 만든 '장애물'이 필요 → rain(비). sun은 오히려 경기를 방해하지 않음."],
    ['I was so ___ that I cried tears of joy.',    'happy',   ['hungry','cold','tired'],
      "'tears of joy'는 '기쁨의 눈물'. so ___ that …(너무 ~해서 …하다) + 기쁨의 눈물을 흘릴 감정 → happy(행복한)."],
    ['The cat is ___ the table.',                  'under',   ['angry','book','slow'],
      "빈칸은 장소 전치사 자리. under(아래에)만 전치사이며, angry/book/slow는 품사가 맞지 않음."],
    ['She is ___ because she didn\'t sleep.',      'tired',   ['fast','red','quick'],
      "잠을 못 잤다(원인) → 그 결과로 나오는 상태 → tired(피곤한). fast/red/quick은 인과에 맞지 않음."],
    ['Please ___ the door before leaving.',        'close',   ['eat','run','sleep'],
      "나가기 전에 문에 대해 하는 행동 → '닫다' close. eat/run/sleep은 the door와 결합 불가."],
  ],
  2: [
    ['The detective ___ the suspect for hours.',    'questioned', ['cooked','painted','danced'],
      "형사(detective)가 용의자(suspect)에게 몇 시간 동안 하는 전형적 행동은 '심문·질문하다' questioned. 요리·그림·춤은 직업 맥락에 안 맞음."],
    ['Her argument was too ___ to accept.',         'vague',      ['delicious','quiet','blue'],
      "too ~ to …(너무 ~해서 …할 수 없다). 받아들일 수 없는 주장(argument)을 수식하는 부정적 형용사 → vague(모호한)."],
    ['We need to ___ a decision by Friday.',        'reach',      ['eat','sleep','draw'],
      "'reach a decision'은 '결정을 내리다'의 관용 연어(collocation). eat/sleep/draw는 decision과 결합하지 않음."],
    ['The new law will ___ everyone equally.',      'affect',     ['taste','smell','climb'],
      "법(law)이 사람에게 미치는 전형적 동사는 '영향을 주다' affect. taste/smell/climb은 주어-목적어 호응 불가."],
    ['He showed ___ skill in solving the puzzle.',  'remarkable', ['edible','frozen','loud'],
      "퍼즐을 푼 실력(skill)에 대한 칭찬 맥락. skill을 수식할 수 있는 긍정 형용사 → remarkable(놀라운). edible/frozen/loud는 skill과 어울리지 않음."],
  ],
  3: [
    ['The policy had ___ consequences no one foresaw.',  'unintended',  ['delicious','flammable','rectangular'],
      "'no one foresaw'(아무도 예상 못함) → 의도되지 않은(unintended) 결과. 맛·가연성·사각형 등은 consequences를 수식하지 못함."],
    ['His ___ approach saved the company from ruin.',    'pragmatic',   ['edible','nocturnal','aromatic'],
      "회사를 위기에서 구한 접근법 → 실용적인(pragmatic) 방식. 식용·야행성·향긋한은 approach 수식에 부적절."],
    ['The evidence was ___, leaving jurors uncertain.',  'inconclusive',['alphabetical','fragrant','vertical'],
      "배심원을 확신 못하게 한 증거 → '결정적이지 않은' inconclusive. 알파벳순·향기·수직 등은 증거 성격과 무관."],
    ['She made a ___ effort to meet the deadline.',      'concerted',   ['edible','circular','aquatic'],
      "'concerted effort'는 '집중적·협력적 노력'의 관용 연어. 식용·원형·수생 등은 effort와 결합 불가."],
    ['The critic\'s ___ review ended her career.',       'scathing',    ['aromatic','metallic','spherical'],
      "경력을 끝낸 혹평(review) → 혹독한(scathing). 향긋한·금속성·구형 등은 review를 수식하지 않음."],
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
  const explanation = `영단어 "${eng}"의 우리말 뜻은 "${ko}"입니다.`;
  return { type: '직구', category: '어휘', prompt: eng, answer: ko, options, explanation, meta: { eng, ko } };
}

// 슬라이더 (문법): sentence cloze → correct verb form
export function generateSlider(tier = 1, rand = defaultRand) {
  const pool = SLIDER_POOL[clampTier(tier)];
  const [sentence, correct, dist, explanation = ''] = pickOne(pool, rand);
  const options = shuffle([correct, ...dist], rand);
  return { type: '슬라이더', category: '문법', prompt: sentence, answer: correct, options, explanation, meta: { sentence } };
}

// 커브 (빈칸/독해): context-meaning cloze → correct word
export function generateCurve(tier = 1, rand = defaultRand) {
  const pool = CURVE_POOL[clampTier(tier)];
  const [sentence, correct, dist, explanation = ''] = pickOne(pool, rand);
  const options = shuffle([correct, ...dist], rand);
  return { type: '커브', category: '빈칸', prompt: sentence, answer: correct, options, explanation, meta: { sentence } };
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
