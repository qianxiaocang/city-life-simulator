import {ensureAccounts,transferCash,changeAsset,bookNetWorth,reconcile} from './accounting.js';
import {describeChoice} from './choice-guide.js';
import {siblingWeights,maternalFirstBirthAge,idealMarriageAge,fecundity,canConceive} from './family-model.js';
import { CHINA_JOBS } from './data/china-society.js';
import { ensureEducationState, educationMilestones, resolveEducationDecision, finishEducation } from './education.js';
import { ensureEconomyState, economyYear, getEconomyShopItems, purchaseEconomyItem, spend } from './economy.js';
import { ensureHistoryState, processHistory, historicalContext, historicalProfile } from './history-runtime.js';
import { ensureCareerState, offerCareers, acceptCareer, resolveCareerDecision, careerYear, retirementMilestone, retireWithContributions, marriageAllowed, culturalMilestone } from './career.js';
/**
 * An original, serializable city-life simulation. All monetary amounts are
 * illustrative CNY purchasing-power amounts, never city-level official forecasts.
 * The engine intentionally has no DOM, network, storage, or third-party code.
 */
export const ENGINE_VERSION = 1;
const REGIONS = new Set(['mainland', 'taiwan', 'hongkong', 'macau']);
let locations = [];
const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
export function localize(value, language = 'zh-CN') {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const key = language.startsWith('en') ? 'en' : /TW|Hant|HK/.test(language) ? 'zhTW' : 'zhCN';
  return value[key] ?? value.zhCN ?? value.en ?? '';
}
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
function hash(value) {
  let result = 2166136261;
  for (const letter of String(value)) result = Math.imul(result ^ letter.charCodeAt(0), 16777619);
  return result >>> 0 || 1;
}
// An independent lifetime risk threshold makes cloned lives face the same
// underlying hazard draw after a single decision. Annual hazards still compound
// as survival probabilities; branch-specific RNG consumption cannot reroll death.
const riskBudget = seed => -Math.log(Math.max((hash(`${seed}:lifetime-risk`) + .5) / 4294967296, 1e-12));
function random(life) {
  let x = life.rngState | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  life.rngState = x >>> 0;
  return life.rngState / 4294967296;
}
const integer = (life, min, max) => min + Math.floor(random(life) * (max - min + 1));
const pick = (life, values) => values[Math.floor(random(life) * values.length)];
const chance = (life, probability) => random(life) < probability;
function normal(life) {
  return Math.sqrt(-2 * Math.log(Math.max(random(life), 1e-9))) * Math.cos(2 * Math.PI * random(life));
}
function weighted(life, list) {
  const sum = list.reduce((value, item) => value + Math.max(0, item.autoWeight ?? item.weight ?? 1), 0);
  let remaining = random(life) * (sum || list.length);
  for (const item of list) {
    remaining -= sum ? Math.max(0, item.autoWeight ?? item.weight ?? 1) : 1;
    if (remaining <= 0) return item;
  }
  return list.at(-1);
}
function validateLocation(location) {
  if (!location || !location.id || !REGIONS.has(location.region) || !location.name) {
    throw new TypeError('A birthplace must be a supported mainland / Taiwan / Hong Kong / Macau location.');
  }
  return { ...location, prosperity: clamp(Number(location.prosperity ?? 0.55), 0.1, 1), name: { ...location.name } };
}
export function configureLocations(values) {
  if (!Array.isArray(values) || !values.length) throw new TypeError('A non-empty location catalogue is required.');
  locations = values.map(validateLocation);
  if (new Set(locations.map(item => item.id)).size !== locations.length) throw new TypeError('Location IDs must be unique.');
  return locations.length;
}

const SURNAMES = [T('陈', '陳', 'Chen'), T('林', '林', 'Lin'), T('王', '王', 'Wang'), T('李', '李', 'Li'), T('张', '張', 'Zhang'), T('黄', '黃', 'Huang'), T('刘', '劉', 'Liu'), T('周', '周', 'Zhou'), T('杨', '楊', 'Yang'), T('吴', '吳', 'Wu'), T('许', '許', 'Xu'), T('郑', '鄭', 'Zheng'), T('何', '何', 'He'), T('赵', '趙', 'Zhao'), T('蔡', '蔡', 'Cai'), T('沈', '沈', 'Shen')];
const GIVEN = {
  male: [T('远航', '遠航', 'Yuanhang'), T('子安', '子安', 'Zian'), T('明轩', '明軒', 'Mingxuan'), T('宇辰', '宇辰', 'Yuchen'), T('嘉树', '嘉樹', 'Jiashu'), T('景行', '景行', 'Jingxing'), T('思源', '思源', 'Siyuan'), T('俊熙', '俊熙', 'Junxi'), T('浩然', '浩然', 'Haoran'), T('承宇', '承宇', 'Chengyu')],
  female: [T('知夏', '知夏', 'Zhixia'), T('雨桐', '雨桐', 'Yutong'), T('若宁', '若寧', 'Ruoning'), T('嘉怡', '嘉怡', 'Jiayi'), T('语晴', '語晴', 'Yuqing'), T('书瑶', '書瑤', 'Shuyao'), T('安然', '安然', 'Anran'), T('以宁', '以寧', 'Yining'), T('心悦', '心悅', 'Xinyue'), T('晓岚', '曉嵐', 'Xiaolan')],
};
function nameFor(life, sex, surname = null) {
  const family = surname ?? pick(life, SURNAMES);
  const given = pick(life, GIVEN[sex]);
  return T(family.zhCN + given.zhCN, family.zhTW + given.zhTW, `${given.en} ${family.en}`);
}
function familyNameFor(life, sex) {
  const surname = T(life.name.zhCN.slice(0, 1), life.name.zhTW.slice(0, 1), life.name.en.split(' ').at(-1));
  const used = [life.name.zhCN, ...[life.family.mother, life.family.father, ...(life.family.siblings || []), ...(life.family.children || [])].filter(Boolean).map(person => person.name.zhCN)];
  let result;
  for (let attempt = 0; attempt < 20; attempt++) { result = nameFor(life, sex, surname); if (!used.includes(result.zhCN)) break; }
  return result;
}
const sexText = sex => sex === 'female' ? T('女孩', '女孩', 'girl') : T('男孩', '男孩', 'boy');
const personWord = sex => sex === 'female' ? T('她', '她', 'she') : T('他', '他', 'he');
export const EDUCATION = {
  associate: T('高职／专科', '高職／專科', 'Associate / higher vocational'),
  preschool: T('学龄前', '學齡前', 'Preschool'), primary: T('小学', '小學', 'Primary school'), junior: T('初中', '國中', 'Junior secondary'), high: T('高中', '高中', 'Senior secondary'), vocational: T('职业教育', '職業教育', 'Vocational education'), university: T('大学本科', '大學', "Bachelor’s degree"), masters: T('硕士研究生', '碩士', "Master’s degree"), doctorate: T('博士研究生', '博士', 'Doctorate'),
};
const EDUCATION_RANK = { preschool: 0, primary: 1, junior: 2, vocational: 3, high: 3, associate: 3.5, university: 4, masters: 5, doctorate: 6 };
const CLASS_NAMES = [T('经济拮据的家庭', '經濟拮据的家庭', 'a financially struggling family'), T('需要精打细算的家庭', '需要精打細算的家庭', 'a family on a tight budget'), T('普通家庭', '普通家庭', 'an ordinary family'), T('生活宽裕的家庭', '生活寬裕的家庭', 'a comfortable family'), T('富裕家庭', '富裕家庭', 'a wealthy family')];
const TEMPERAMENTS = { curious: T('好奇', '好奇', 'Curious'), caring: T('体贴', '體貼', 'Caring'), resilient: T('坚韧', '堅韌', 'Resilient'), outgoing: T('开朗', '開朗', 'Outgoing') };
export const JOBS = CHINA_JOBS;
const FOCUS = {
  study: { label: T('认真学习', '認真學習', 'Study'), description: T('知识↑，少一点玩耍时间', '知識↑，少一點玩耍時間', 'Knowledge ↑; less time to play'), effects: { knowledge: 4.8, happiness: -1, relationships: -.6 } },
  friends: { label: T('朋友与玩耍', '朋友與玩耍', 'Friends & play'), description: T('人际↑，幸福↑', '人際↑，幸福↑', 'Relationships ↑; happiness ↑'), effects: { relationships: 4.2, happiness: 3.5 } },
  family: { label: T('陪伴家人', '陪伴家人', 'Family'), description: T('关系↑，幸福↑', '關係↑，幸福↑', 'Relationships ↑; happiness ↑'), effects: { relationships: 4.8, happiness: 2.5 } },
  sport: { label: T('运动', '運動', 'Exercise'), description: T('健康↑，幸福略↑', '健康↑，幸福略↑', 'Health ↑; happiness slightly ↑'), effects: { health: 4.8, happiness: 1.8, relationships: .6 } },
  hobby: { label: T('兴趣', '興趣', 'Hobbies'), description: T('幸福↑，技能成长', '幸福↑，技能成長', 'Happiness ↑; develop a skill'), effects: { happiness: 4, knowledge: .7, relationships: .8 } },
  work: { label: T('专注工作', '專注工作', 'Career'), description: T('收入与晋升↑，健康与关系略↓', '收入與升遷↑，健康與關係略↓', 'Income & promotion ↑; health & relationships slightly ↓'), effects: { health: -2, happiness: -1, relationships: -2 } },
  balance: { label: T('保持均衡', '保持均衡', 'Balance'), description: T('给每件重要的事留一点时间', '給每件重要的事留一點時間', 'Make time for what matters'), effects: { health: 1.4, happiness: 1.6, relationships: 1.4, knowledge: .7 } },
  health: { label: T('照顾身体', '照顧身體', 'Health'), description: T('健康↑，少量支出', '健康↑，少量支出', 'Health ↑; a small expense'), effects: { health: 6, happiness: 1 } },
  learn: { label: T('自我提升', '自我提升', 'Keep learning'), description: T('知识↑，职业机会↑', '知識↑，職涯機會↑', 'Knowledge ↑; career opportunities ↑'), effects: { knowledge: 3.4, happiness: -.5 } },
  rest: { label: T('好好休息', '好好休息', 'Rest'), description: T('健康↑，幸福↑', '健康↑，幸福↑', 'Health ↑; happiness ↑'), effects: { health: 2.8, happiness: 2 } },
  volunteer: { label: T('志愿服务', '志願服務', 'Volunteer'), description: T('关系↑，幸福↑', '關係↑，幸福↑', 'Relationships ↑; happiness ↑'), effects: { relationships: 4, happiness: 3.2, knowledge: .5 } },
};
export function getFocusOptions(life) {
  if (life.age < 6 || life.phase === 'dead') return [];
  const ids = life.school ? ['study', 'balance', 'friends', 'family', 'sport', 'hobby'] : life.age < 16 ? ['balance', 'friends', 'family', 'sport', 'hobby', 'learn'] : life.retired ? ['balance', 'family', 'health', 'learn', 'hobby', 'volunteer', 'rest'] : life.job ? ['work', 'balance', 'family', 'health', 'learn', 'hobby'] : ['balance', 'learn', 'family', 'health', 'hobby', 'rest'];
  return ids.map(id => ({ id, label: FOCUS[id].label, description: FOCUS[id].description }));
}
export function setFocus(life, id) {
  if (!getFocusOptions(life).some(item => item.id === id)) return false;
  life.focus = id;
  return true;
}
export const AUTOPILOT_STRATEGIES=['strive','balanced','health','family','academic'];
export function setAutopilot(life,enabled,strategy='balanced'){
  ensureModelState(life);
  if(!AUTOPILOT_STRATEGIES.includes(strategy))return false;
  life.autopilot={enabled:!!enabled,strategy,modelOnly:true};
  delete life.flags.autopilotYear;
  return true;
}
/** Automated pacing still chooses a focus; purchases are offered as life decisions. */
export function runAutopilot(life){
  if(!life.autopilot?.enabled||life.pending||life.phase!=='life'||life.flags.autopilotYear===life.year)return false;
  const strategy=life.autopilot.strategy;
  const available=new Set(getFocusOptions(life).map(x=>x.id));
  const secondary={strive:'learn',balanced:'balance',health:'health',family:'family',academic:'learn'}[strategy];
  if(life.school){
    const alternate=available.has(secondary)?secondary:'family';
    life.focusTime=alternate==='study'?{study:1}:{study:.65,[alternate]:.35};
    life.focus='study';
  }else if(life.job&&available.has('work')){
    const alternate=available.has(secondary)?secondary:'balance';
    const workShare={strive:.72,balanced:.62,health:.57,family:.57,academic:.58}[strategy];
    life.focusTime=alternate==='work'?{work:1}:{work:workShare,[alternate]:1-workShare};
    life.focus='work';
  }else{
    const preferred={strive:'learn',balanced:'rest',health:'health',family:'family',academic:'learn'}[strategy];
    const focus=available.has(preferred)?preferred:[...available][0];
    if(focus){life.focus=focus;life.focusTime={[focus]:1};}
  }
  life.flags.autopilotYear=life.year;
  return true;
}
function effects(life, changes) {
  for (const [key, value] of Object.entries(changes ?? {})) {
    if (key in life.stats) life.stats[key] = clamp(life.stats[key] + value);
    else if (key === 'money') { if(value<0)spend(life,-value,'event');else transferCash(life,value); }
  }
}
function log(life, text, type = 'life', changes = null) {
  life.log.unshift({ id: `${life.id}-${life.logSequence++}`, age: life.age, year: life.year, type, text, effects: changes });
  if (changes) effects(life, changes);
  return life.log[0];
}
function ageSnapshot(life) {
  const snapshot = { age: life.age, year: life.year, ...life.stats, money: life.money, netWorth: netWorth(life), income: life.income, locationId: life.location.id, education: life.education, job: life.job?.name ?? null, children: life.family.children.length };
  const existing = life.years.findIndex(year => year.age === life.age);
  if (existing >= 0) life.years[existing] = snapshot; else life.years.push(snapshot);
}
function profileFor(location,sex,world,year) {
  return historicalProfile(location,sex,world,year);
}
export function ensureModelState(life) {
  if (!life || typeof life !== 'object') return life;
  life.flags ||= {}; life.pendingQueue ||= []; life.years ||= [];
  life.birthMonth ||= 1; life.birthDay ||= 1;
  life.mortalityRisk ||= {budget:riskBudget(life.seed),exposure:0,modelOnly:true};
  life.residenceYears||={[life.location.region]:life.age};
  ensureEconomyState(life); ensureEducationState(life); ensureCareerState(life); ensureHistoryState(life);
  life.rulesVersion=2;
  return life;
}
function culturalMilestoneBridge(life) { culturalMilestone(life,modelEnv(life)); }
function modelEnv(life) {
  return {log,effects,chance,normal,integer,option,decision,offerWork,takeJob,enroll,die,spend,changeAsset,
    locations, context:historicalContext(life)};
}
export function processTimeline(life,throughFraction=1) {
  if(life.phase!=='life'||life.pending)return {changed:false,dead:life.phase==='dead'};
  ensureModelState(life);
  const env=modelEnv(life),result=processHistory(life,throughFraction,env);
  life.marketContext=historicalContext(life);
  if(life.phase==='life')result.changed=retirementMilestone(life,throughFraction,env)||result.changed;
  return result;
}

export function createLife({ location, locations: catalogue, language = 'zh-CN', seed = `${Date.now()}`, birthYear = 2026, world = 'now', paceMinutes = 30 } = {}) {
  if (catalogue) configureLocations(catalogue);
  const state = hash(seed);
  if (!location) {
    if (!locations.length) throw new TypeError('A birthplace or configured location catalogue is required.');
    const chooser = { rngState: state };
    location = weighted(chooser, locations.map(item => ({ ...item, autoWeight: Math.max(.01, item.weight ?? 1) })));
  }
  location = validateLocation(location);
  const life = {
    version: ENGINE_VERSION, id: `life-${state.toString(36)}`, seed: String(seed), rngState: state, language, world,
    birthYear: clamp(Math.round(birthYear), 1950, 2100), year: Math.round(birthYear), age: 0, phase: 'birth',
    born: location, location, sex: '', name: null, classRank: 3, urban: true,
    stats: { health: 80, happiness: 62, knowledge: 50, relationships: 60 },
    money: 0, income: 0, assets: { house: 0, car: 0, retirement:0 }, debt: 0, investment: 'deposit', investmentBasis: 0,
    education: 'preschool', school: null, continuingEducation: null, job: null, retired: false,
    family: { mother: null, father: null, partner: null, children: [], siblings: [] },
    focus: null, focusTime: {}, hobbies: [], owns: [], temperament: null, conditions: [],
    log: [], years: [], pending: null, pendingQueue: [], flags: {}, journal: [], visited: [location],
    death: null, logSequence: 0, profile: null, paceMinutes: clamp(paceMinutes, 1, 90), yearSeconds: 25,
    totals: { earned: 0, spent: 0, work: 0, family: 0, health: 0, learning: 0, migrations: 0, charity: 0 },
    lastCashflow: { income: 0, living: 0, education: 0, returns: 0, change: 0 },
    mortalityRisk: {budget:riskBudget(seed),exposure:0,modelOnly:true},
    residenceYears:{[location.region]:0},
  };
  life.year = life.birthYear;
  life.birthMonth = integer(life,1,12); life.birthDay=1;
  life.sex = chance(life, .515) ? 'male' : 'female';
  life.classRank = integer(life, 1, 5);
  life.profile = profileFor(location,life.sex,world,life.year);
  life.urban = chance(life, clamp((life.profile?.urbanization ?? .55) + (life.classRank-3)*.045,.1,.99));
  life.name = nameFor(life, life.sex);
  life.profile = profileFor(location, life.sex, world, life.year);
  life.yearSeconds = life.paceMinutes * 60 / life.profile.lifeExpectancy;
  life.stats = { health: clamp(76 + life.classRank * 2 + integer(life, -5, 5)), happiness: integer(life, 54, 72), knowledge: integer(life, 36, 65), relationships: integer(life, 49, 71) };
  life.talent = clamp(.5 + normal(life) * .17, .1, .95);
  life.earningPotential=Math.exp(normal(life)*.58-.58*.58/2);
  const siblings=siblingWeights(life.birthYear,life.urban,location.region);
  const siblingCount=Number(weighted(life,siblings.map((autoWeight,id)=>({id,autoWeight}))).id);
  const firstBirthAge=Math.max(18,Math.round(maternalFirstBirthAge(life.birthYear)+normal(life)*1.5));
  const maternalAge=Math.min(45,firstBirthAge+siblingCount*2);
  life.family.mother={name:nameFor(life,'female'),sex:'female',age:maternalAge,firstBirthAge,birthYear:life.birthYear-maternalAge,alive:true,relationship:75};
  const paternalAge=maternalAge+integer(life,-1,5);
  life.family.father={name:familyNameFor(life,'male'),sex:'male',age:paternalAge,birthYear:life.birthYear-paternalAge,alive:true,relationship:72};
  for(let i=0;i<siblingCount;i++){
    const sex=chance(life,.5)?'male':'female',age=2*(siblingCount-i);
    life.family.siblings.push({name:familyNameFor(life,sex),sex,age,birthYear:life.birthYear-age,alive:true});
  }
  log(life, T(`你出生在${location.name.zhCN}，一个${CLASS_NAMES[life.classRank - 1].zhCN}。你是个${sexText(life.sex).zhCN}。`, `你出生在${location.name.zhTW}，一個${CLASS_NAMES[life.classRank - 1].zhTW}。你是個${sexText(life.sex).zhTW}。`, `You were born in ${location.name.en}, into ${CLASS_NAMES[life.classRank - 1].en}. You are a ${sexText(life.sex).en}.`), 'birth');
  ensureModelState(life);
  ageSnapshot(life);
  return life;
}

export function startLife(life) {
  if (life.phase !== 'birth') return life;
  life.phase = 'life';
  ensureModelState(life);
  log(life, T('家人把小小的你抱在怀里。窗外，是你将慢慢认识的城市。', '家人把小小的你抱在懷裡。窗外，是你將慢慢認識的城市。', 'Your family holds you close. Beyond the window is the city you will slowly come to know.'), 'warm');
  return life;
}
function option(id, label, description = T('', '', ''), autoWeight = 1) { return { id, label, description, autoWeight }; }
function decision(life, id, title, description, options, data = {}, kind = 'choice') {
  const value = { id: `${id}-${life.age}`, action: id, kind, title, description, options:options.map(o=>({...o,description:describeChoice(id,o,life)})), data };
  if (kind === 'reflection') value.input = true;
  if (life.pending) life.pendingQueue.push(value); else life.pending = value;
}
function reflection(life) {
  const questions = {
    5: T('五岁时，你拥有什么曾被视为理所当然的东西？', '五歲時，你擁有什麼曾被視為理所當然的東西？', 'At five, what did you have that once felt ordinary?'),
    15: T('站在人生的岔路口，你最想守护什么？', '站在人生的岔路口，你最想守護什麼？', 'At this crossroads, what would you most like to protect?'),
    30: T('三十岁的此刻，你想对这个人说些什么？', '三十歲的此刻，你想對這個人說些什麼？', 'What would you say to this person at thirty?'),
    50: T('回头看，哪些关系让这段人生有了重量？', '回頭看，哪些關係讓這段人生有了重量？', 'Looking back, which relationships have given this life meaning?'),
    70: T('走过这么多年，有什么值得留给后来的人？', '走過這麼多年，有什麼值得留給後來的人？', 'After all these years, what would you pass on to those who follow?'),
  };
  decision(life, 'reflect', T('暂停片刻', '暫停片刻', 'A moment to reflect'), questions[life.age], [option('write', T('写下来，继续生活', '寫下來，繼續生活', 'Write it down and continue')), option('continue', T('留在心里，继续生活', '留在心裡，繼續生活', 'Keep it in mind and continue'), undefined, 3)], {}, 'reflection');
}
function enroll(life, stage, duration) {
  life.school = { stage, endsAt: life.age + duration };
  life.job = null; life.income = 0; life.focus = 'study';
  log(life, T(`你开始了${EDUCATION[stage].zhCN}阶段的学习。`, `你開始了${EDUCATION[stage].zhTW}階段的學習。`, `You began ${EDUCATION[stage].en.toLowerCase()}.`), 'education');
}
function offerWork(life,title) { return offerCareers(life,modelEnv(life),title); }
function takeJob(life,job) { return acceptCareer(life,job,modelEnv(life)); }

function finishContinuingEducation(life) {
  const study = life.continuingEducation;
  if (!study || life.age < study.endsAt) return;
  life.continuingEducation = null;
  if (chance(life, clamp(.25 + life.stats.knowledge / 150, .35, .9))) {
    life.education = study.target;
    log(life, T('经过几年的在职学习与考核，你取得了新的学历资格。', '經過幾年的在職學習與考核，你取得了新的學歷資格。', 'After several years of part-time study and assessment, you gained a new qualification.'), 'education', { knowledge: 4, happiness: 5 });
  } else log(life, T('这次考核未能通过，但学习积累的知识仍会陪着你。', '這次考核未能通過，但學習累積的知識仍會陪著你。', 'You did not pass this assessment, but the knowledge you gained stays with you.'), 'education', { knowledge: 2, happiness: -2 });
}
function arrangeAge(life) {
  const age = life.age;
  if (age === 1) log(life, T('你迈出了第一步，家人紧张地伸出手，又笑了起来。', '你邁出了第一步，家人緊張地伸出手，又笑了起來。', 'You took your first steps. Your family reached out, then burst into smiles.'), 'warm');
  if (age === 2) decision(life, 'temperament', T('你开始探索世界', '你開始探索世界', 'A world to discover'), T('陌生的公园里，你最先被什么吸引？一次小小的选择，成为气质的一部分。', '陌生的公園裡，你最先被什麼吸引？一次小小的選擇，成為氣質的一部分。', 'In a new park, what catches your attention first? A small choice becomes part of your temperament.'), [option('curious', T('看看树叶背面的纹路', '看看樹葉背面的紋路', 'Examine the patterns on a leaf')), option('caring', T('陪一陪哭泣的小朋友', '陪一陪哭泣的小朋友', 'Sit with a child who is crying')), option('resilient', T('跌倒后再试一次', '跌倒後再試一次', 'Get up and try again')), option('outgoing', T('加入正在玩耍的人群', '加入正在玩耍的人群', 'Join the children playing'))]);
  if ([5, 15, 30, 50, 70].includes(age) && !life.flags[`reflection-${age}`]) {
    life.flags[`reflection-${age}`] = true;
    reflection(life);
  }
  if (age === 7) decision(life, 'hobby', T('找到喜欢的事', '找到喜歡的事', 'Something you love'), T('放学后的时间，你想慢慢学会一件自己的事。', '放學後的時間，你想慢慢學會一件自己的事。', 'After school, you would like to learn something just for yourself.'), [option('music', T('音乐', '音樂', 'Music')), option('drawing', T('画画', '畫畫', 'Drawing')), option('sport', T('球类运动', '球類運動', 'Ball games')), option('reading', T('阅读', '閱讀', 'Reading'))]);
  educationMilestones(life,modelEnv(life));
  if(age>=16&&!life.school&&!life.job&&!life.retired&&!life.pending&&!life.pendingQueue.length&&!life.careerPreparation&&!life.flags.repeatExam)offerWork(life);
  familyMilestone(life);
  retirementMilestone(life,0,modelEnv(life));
}

function financialDecision(life) {
  if(life.age<18||life.age>75||life.age%4!==0||life.flags[`financialDecision-${life.age}`])return;
  const available=getShopItems(life).filter(item=>item.available);
  const priorities=life.age<27?['adultstudy','course','phone','computer','school-supplies','bicycle','furniture','appliances','health']:
    ['child-school','childcare','house','house-cash','car','parent-support','health','renovation','furniture','appliances','adultstudy','course'];
  // Count offers, not purchases, so recurring inexpensive items cannot hide
  // education, care or investments when the player keeps declining them.
  const offered=life.flags.financialOffers??={};
  const rank=item=>{const index=priorities.indexOf(item.id);return index<0?priorities.length:index;};
  const spending=available.filter(item=>!item.id.startsWith('invest-')).sort((a,b)=>(offered[a.id]||0)-(offered[b.id]||0)||rank(a)-rank(b));
  const investments=available.filter(item=>item.id.startsWith('invest-')).sort((a,b)=>(offered[a.id]||0)-(offered[b.id]||0));
  const offers=[...spending.slice(0,2),...investments.slice(0,1)];
  if(!offers.length)return;
  for(const item of offers)offered[item.id]=(offered[item.id]||0)+1;
  life.flags[`financialDecision-${life.age}`]=true;
  decision(life,'financial',T('为生活做一笔安排','為生活做一筆安排','A choice for your finances'),
    T('你重新看了看积蓄和眼前的需要。这一笔钱该放在哪里？','你重新看了看積蓄和眼前的需要。這一筆錢該放在哪裡？','You review your savings and current needs. What should you do with this money?'),
    [...offers.map(item=>option(item.id,item.name,item.id.startsWith('invest-')?
      T('调整今后的资金打理方式，本次不扣款；收益与亏损随市场变化。','調整今後的資金打理方式，本次不扣款；收益與虧損隨市場變化。','Change how your available funds earn returns, with no immediate charge. Market changes can bring gains or losses.'):
      T(`约需 ¥${item.cost.toLocaleString('zh-CN')}。${item.description.zhCN}`,`約需 ¥${item.cost.toLocaleString('zh-CN')}。${item.description.zhTW}`,`About ¥${item.cost.toLocaleString('en')}. ${item.description.en}`))),
      option('keep',T('维持目前安排','維持目前安排','Keep the current plan'),T('本次不花钱，沿用现有储蓄或投资方式。','本次不花錢，沿用現有儲蓄或投資方式。','Spend nothing now and keep your current saving or investment plan.'),2)]);
}

const ROUTINE_EVENTS = [
  { min: 0, max: 5, text: T('家人给你拍了一张照片，背面写下了今天的日期。', '家人給你拍了一張照片，背面寫下了今天的日期。', 'Your family took a photograph and wrote today’s date on the back.'), effects: { happiness: 2 } },
  { min: 0, max: 5, text: T('你在家人的怀里睡着了，外面的街道渐渐安静下来。', '你在家人的懷裡睡著了，外面的街道漸漸安靜下來。', 'You fell asleep in a family member’s arms as the street grew quiet.'), effects: { health: 1, relationships: 1 } },
  { min: 0, max: 5, text: T('你第一次清楚地喊出了家人的称呼。', '你第一次清楚地喊出了家人的稱呼。', 'For the first time, you clearly called a family member by name.'), effects: { relationships: 2 } },
  { min: 1, max: 10, text: T('一场小感冒让你在家待了几天，有人守在床边。', '一場小感冒讓你在家待了幾天，有人守在床邊。', 'A cold kept you home for a few days. Someone stayed by your bed.'), effects: { health: -2, relationships: 1 } },
  { min: 6, max: 17, text: T('放学路上，你和朋友分享了一份热腾腾的小吃。', '放學路上，你和朋友分享了一份熱騰騰的小吃。', 'On the way home from school, you shared a warm snack with a friend.'), effects: { happiness: 2, relationships: 1 } },
  { min: 6, max: 20, text: T('你读到一本让自己舍不得合上的书。', '你讀到一本讓自己捨不得合上的書。', 'You found a book you could hardly put down.'), effects: { knowledge: 1.6, happiness: 1 } },
  { min: 6, max: 18, text: T('这次考试的成绩不太理想，你决定再弄懂一道题。', '這次考試的成績不太理想，你決定再弄懂一道題。', 'Your exam result disappointed you, so you worked through one more problem.'), effects: { knowledge: 1, happiness: -1 } },
  { min: 6, max: 18, text: T('操场上的一场比赛，成为你和朋友聊了很久的话题。', '操場上的一場比賽，成為你和朋友聊了很久的話題。', 'A game on the school field gave you and your friends plenty to talk about.'), effects: { health: 1.3, relationships: 1 } },
  { min: 13, max: 30, text: T('有人认真听完了你的烦恼，你觉得轻松了一点。', '有人認真聽完了你的煩惱，你覺得輕鬆了一點。', 'Someone listened to your worries. You felt a little lighter.'), effects: { happiness: 2, relationships: 2 } },
  { min: 18, max: 65, text: T('这周的工作有些忙，你终于在周末睡了一个好觉。', '這週的工作有些忙，你終於在週末睡了一個好覺。', 'It was a busy week. At the weekend, you finally slept well.'), effects: { health: 1, happiness: 1 } },
  { min: 18, max: 70, text: T('久未联系的朋友发来消息，你们聊起以前的日子。', '久未聯絡的朋友傳來訊息，你們聊起以前的日子。', 'An old friend got in touch, and you talked about earlier days.'), effects: { relationships: 2.5, happiness: 1 } },
  { min: 18, max: 80, text: T('你走进一条没去过的街道，发现了一家喜欢的小店。', '你走進一條沒去過的街道，發現了一家喜歡的小店。', 'On an unfamiliar street, you found a little shop you liked.'), effects: { happiness: 1.8, knowledge: .4 } },
  { min: 18, max: 75, text: T('你参与了一次社区活动，记住了几个新的名字。', '你參與了一次社區活動，記住了幾個新的名字。', 'At a neighbourhood event, you learned a few new names.'), effects: { relationships: 2, happiness: 1 } },
  { min: 20, max: 90, text: T('节日的餐桌上，熟悉的味道让你想起了小时候。', '節日的餐桌上，熟悉的味道讓你想起了小時候。', 'At a festive meal, a familiar flavour brought back childhood memories.'), effects: { happiness: 2, relationships: 1 } },
  { min: 25, max: 80, text: T('你整理旧照片，想起了一位很久没见的人。', '你整理舊照片，想起了一位很久沒見的人。', 'Sorting old photographs, you thought of someone you had not seen in years.'), effects: { happiness: 1, relationships: .8 } },
  { min: 35, max: 80, text: T('一次例行检查提醒你，身体也需要长期照顾。', '一次例行檢查提醒你，身體也需要長期照顧。', 'A routine checkup reminded you that health needs regular attention.'), effects: { health: 1 } },
  { min: 45, max: 100, text: T('你把一段经历讲给年轻人听，也从他们身上学到新东西。', '你把一段經歷講給年輕人聽，也從他們身上學到新東西。', 'You shared an experience with younger people, and learned something from them too.'), effects: { knowledge: .6, happiness: 1.6, relationships: 1 } },
  { min: 60, max: 120, text: T('早晨的公园里，你遇见了几位每天散步的老朋友。', '早晨的公園裡，你遇見了幾位每天散步的老朋友。', 'On a morning walk in the park, you met some familiar faces.'), effects: { health: 1, relationships: 1, happiness: 1 } },
  { min: 65, max: 120, text: T('阳光落在窗边，你安静地喝完一杯茶。', '陽光落在窗邊，你安靜地喝完一杯茶。', 'Sunlight rested by the window as you finished a quiet cup of tea.'), effects: { happiness: 2 } },
];
function routineYear(life) {
  const eligible = ROUTINE_EVENTS.filter(event => life.age >= event.min && life.age <= event.max);
  for (let i = 0; i < 2 && eligible.length; i++) {
    const index = Math.floor(random(life) * eligible.length);
    const event = eligible.splice(index, 1)[0];
    log(life, event.text, 'life', event.effects);
  }
  if (life.hobbies.length && chance(life, .2)) {
    life.hobbies[0].level = Math.min(10, life.hobbies[0].level + 1);
    log(life, T(`你在${life.hobbies[0].name.zhCN}上又进步了一点。`, `你在${life.hobbies[0].name.zhTW}上又進步了一點。`, `You made a little more progress in ${life.hobbies[0].name.en.toLowerCase()}.`), 'warm', { happiness: 2 });
  }
}
function applyFocus(life) {
  if (life.age < 6) return;
  const options = getFocusOptions(life);
  if (!options.some(item => item.id === life.focus)) life.focus = options[0]?.id ?? 'rest';
  const allowed = new Set(options.map(item => item.id));
  let weights = Object.entries(life.focusTime ?? {}).filter(([id, value]) => allowed.has(id) && Number.isFinite(value) && value > 0);
  if (!weights.length) weights = [[life.focus, 1]];
  const total = weights.reduce((sum, [, time]) => sum + time, 0);
  for (const [id, time] of weights) {
    const fraction = time / total;
    const focus = FOCUS[id];
    const changes = Object.fromEntries(Object.entries(focus.effects).map(([key, value]) => [key, value * fraction]));
    if (changes.knowledge) changes.knowledge *= .5 + life.talent;
    effects(life, changes);
    if (id === 'work') life.totals.work += fraction;
    if (['family', 'friends', 'volunteer'].includes(id)) life.totals.family += fraction;
    if (id === 'volunteer') life.totals.charity += 40*fraction;
    if (['learn', 'study'].includes(id)) life.totals.learning += fraction;
    if (['health', 'sport', 'rest'].includes(id)) life.totals.health += fraction;
    if (id === 'health') spend(life,Math.min(1200,life.profile.typicalIncome*.015)*fraction,'health');
    if (id === 'hobby') for (const hobby of life.hobbies) hobby.level = Math.min(10, hobby.level + .65 * fraction);
  }
  life.flags.workFraction = weights.filter(([id]) => id === 'work').reduce((sum, [, time]) => sum + time / total, 0);
  life.focusTime = {};
}
function financeYear(life) { return economyYear(life,modelEnv(life)); }
function familyYear(life) {
  const people = [life.family.mother, life.family.father, life.family.partner, ...life.family.siblings, ...life.family.children].filter(Boolean);
  for (const person of people) {
    if (!person.alive) continue;
    person.sex||=person===life.family.mother?'female':person===life.family.father?'male':'female';
    person.birthYear??=life.year-person.age;
    const reference=profileFor(life.location,person.sex,life.world,person.birthYear);
    // This relative has survived to the current year; adult risk uses the
    // separate conditional-at-25 calibration, never their birth LE directly.
    // qx is modelOnly; no unobserved official life table is asserted.
    const subject={...life,age:person.age,born:life.location,profile:reference,stats:{health:person.age<5?82:person.chronic?62:76},classRank:3,conditions:person.chronic?['chronic']:[],flags:{treatment:!!person.treatment}};
    const hazard=mortality(subject);
    person.age++;
    if(chance(life,hazard)||person.age>110){
      person.alive = false;
      log(life, T(`${person.name.zhCN}在${person.age}岁时离开了人世。你把共同的记忆留在心里。`, `${person.name.zhTW}在${person.age}歲時離開了人世。你把共同的記憶留在心裡。`, `${person.name.en} died at ${person.age}. You keep your shared memories close.`), 'loss', { happiness: -9, relationships: -3 });
    }
  }
  if(life.family.partner?.alive){life.family.partner.sinceYear??=life.year-(life.family.partner.yearsTogether||0);life.family.partner.yearsTogether=life.year+1-life.family.partner.sinceYear;}
  for (const child of life.family.children) {
    if (!child.alive) continue;
    if (child.age === 6) log(life, T(`${child.name.zhCN}开始上学了。`, `${child.name.zhTW}開始上學了。`, `${child.name.en} started school.`), 'family', { happiness: 3 });
    if (child.age === 22) log(life, T(`${child.name.zhCN}开始独自安排生活，你努力学着放手。`, `${child.name.zhTW}開始獨自安排生活，你努力學著放手。`, `${child.name.en} began an independent life. You learned to give them space.`), 'family', { happiness: 2, relationships: 2 });
    if (child.age === 29 && chance(life, .65)) {
      child.children = integer(life, 1, 2);
      log(life, T('家里迎来了新一代的小生命，你成为了祖辈。', '家裡迎來了新一代的小生命，你成為了祖輩。', 'A new generation arrived. You became a grandparent.'), 'family', { happiness: 7 });
    }
  }
}
function healthYear(life) {
  const expected = life.age < 5 ? 82 : life.age < 30 ? 89 : Math.max(24, 89 - (life.age - 30) * .66);
  life.stats.health += (expected - life.stats.health) * .15;
  life.stats.knowledge += (48 + (life.talent - .5) * 30 - life.stats.knowledge) * (life.age < 6 ? .12 : .018);
  life.stats.relationships += ((life.family.partner?.alive ? 66 : 55) - life.stats.relationships) * .065;
  const happinessTarget = 54 + life.stats.relationships * .15 + (life.classRank - 3) * 1.3 - (life.money < -life.profile.typicalIncome ? 7 : 0);
  life.stats.happiness += (happinessTarget - life.stats.happiness) * .12;
  if (life.conditions.includes('chronic')) effects(life, { health: life.flags.treatment ? -.3 : -.6 });
  for(const hobby of life.hobbies||[]){
    const trained=Math.min(1,(hobby.level||0)/5+.2);
    if(hobby.id==='sport')effects(life,{health:.65*trained,happiness:.2*trained});
    if(hobby.id==='reading')effects(life,{knowledge:.75*trained,relationships:-.1*trained});
    if(hobby.id==='music')effects(life,{happiness:.45*trained,relationships:.25*trained});
    if(hobby.id==='drawing')effects(life,{happiness:.5*trained,knowledge:.25*trained});
  }
  if(life.flags.familyCareSkill&&[life.family.mother,life.family.father].some(p=>p?.alive&&p.age>=65))effects(life,{relationships:.45});
  if(life.flags.communityMember&&life.age>=60)effects(life,{relationships:.2,happiness:.15});
  if (life.age > 70 && life.focus !== 'learn') effects(life, { knowledge: -.7 });
  for (const key of Object.keys(life.stats)) life.stats[key] = Math.round(clamp(life.stats[key]) * 10) / 10;
}
export function mortality(life) {
  if (life.age >= 120) return 1;
  const urbanization=life.profile.urbanization??.5;
  // National U5 probabilities are divided over the five childhood years.
  // Normalize urban/rural multipliers so their population mixture retains q5.
  const urbanRate=life.year<1990?.6:.75,ruralRate=life.year<1990?1.6:1.35;
  const residence=(life.urban?urbanRate:ruralRate)/(urbanization*urbanRate+(1-urbanization)*ruralRate);
  const q5=clamp(life.profile.childMortality*residence,0,.8);
  let base = life.age < 5 ? 1-Math.pow(1-q5,life.age===0?.65:.35/4) : life.age < 18 ? .0001 : .00022 + .0025 * Math.exp((life.age - 50) / 10);
  // Child risk already follows historical healthcare; birth LE includes those
  // losses and must not amplify risk again for someone who reached adulthood.
  // The conditional-at-25 anchors and divisor are model calibration, not an
  // observed age-specific life table. Migrants retain half their origin signal.
  const adultLE=profile=>Number.isFinite(profile.lifeExpectancyAt25)?profile.lifeExpectancyAt25:clamp(64+(Number(profile.lifeExpectancy)-41)*(14.6/38),55,90);
  const currentAdult=adultLE(life.profile);
  const originAdult=life.born?.id!==life.location?.id?adultLE(profileFor(life.born,life.sex,life.world,life.year)):currentAdult;
  const blendedAdult=(originAdult+currentAdult)/2;
  const expectancyFactor = life.age < 18 ? 1 : Math.exp((78.6-blendedAdult)/22.5);
  const healthFactor = life.age<5?Math.exp((82-life.stats.health)/80):Math.exp((67 - life.stats.health) / 55);
  const incomeFactor = life.classRank <= 2 ? 1.08 : life.classRank >= 4 ? .92 : 1;
  base *= expectancyFactor * healthFactor * incomeFactor;
  if(life.age>=18){
    // Recalibrate the shared adult baseline after removing birth-LE inflation.
    // Lower conditional adult LE mainly steepens later-life risk, while the
    // 40- and 60-year relative hazards remain separately bounded.
    base*=.45;
    if(life.age>60)base*=Math.exp(Math.max(0,78.6-blendedAdult-2)*(life.age-60)/40);
  }
  if (life.conditions.includes('chronic') && !life.flags.treatment) base *= 1.35;
  // The 1959–61 hardship acts in its actual calendar year, only for mainland
  // residents; infants receive the explicitly modeled additional exposure.
  const famineShock=life.location?.region==='mainland'?(life.marketContext?.mortalityMultiplier||1):1;
  if(famineShock>1)base*=famineShock*(life.age<5?1.6:1);
  return clamp(base, 0, .95);
}
const CAUSES = {
  childhood: [T('先天性疾病', '先天性疾病', 'a congenital condition'), T('严重感染', '嚴重感染', 'a severe infection')],
  adult: [T('急性疾病', '急性疾病', 'an acute illness'), T('意外事故', '意外事故', 'an accident'), T('心血管疾病', '心血管疾病', 'cardiovascular disease')],
  older: [T('心血管疾病', '心血管疾病', 'cardiovascular disease'), T('癌症', '癌症', 'cancer'), T('呼吸系统疾病', '呼吸系統疾病', 'a respiratory illness'), T('脑血管疾病', '腦血管疾病', 'cerebrovascular disease'), T('衰老相关疾病', '衰老相關疾病', 'an age-related illness')],
};
function die(life, explicitCause=null, metadata={}) {
  const cause = explicitCause || pick(life, life.age < 12 ? CAUSES.childhood : life.age < 60 ? CAUSES.adult : CAUSES.older);
  reconcile(life);life.estate={currencyBasis:'CNY-2025-model',netValue:Math.max(0,Math.round(bookNetWorth(life))),heirs:[...[life.family.mother,life.family.father].filter(p=>p?.alive).map(p=>({kind:'parent',name:p.name})),...(life.family.partner?.alive?[{kind:'partner',name:life.family.partner.name}]:[]),...life.family.children.filter(c=>c.alive).map(c=>({kind:'child',name:c.name}))],distribution:'equal-shares-game-model-not-statutory-inheritance'};
  life.phase = 'dead'; life.pending = null; life.pendingQueue = [];
  life.death = { age: life.age, year: life.year, cause, location: life.location, ...metadata };
  log(life, T(`在${life.location.name.zhCN}，你因${cause.zhCN}离开了人世。这段人生走到了最后。`, `在${life.location.name.zhTW}，你因${cause.zhTW}離開了人世。這段人生走到了最後。`, `In ${life.location.name.en}, your life ended from ${cause.en}. This particular journey came to its close.`), 'death');
  ageSnapshot(life);
}
function marriageDecision(life) {
  if(!marriageAllowed(life))return;
  decision(life, 'marriage', T('要不要一起生活', '要不要一起生活', 'A life together'), T('你们已经了解彼此，也开始认真谈论未来。', '你們已經了解彼此，也開始認真談論未來。', 'You have come to know each other and are talking seriously about the future.'), [option('marry', T('共同建立一个家', '共同建立一個家', 'Build a home together'), undefined, 2.6), option('wait', T('再相处一段时间', '再相處一段時間', 'Give it more time')), option('separate', T('坦诚地结束这段关系', '坦誠地結束這段關係', 'Part honestly'), undefined, .25)]);
}
function familyMilestone(life){
 if(life.pending||life.pendingQueue.length||life.age<18)return;
 const ideal=idealMarriageAge(life.year),partner=life.family.partner;
 if(!partner?.alive){
  const remarriage=(life.flags.marriageCount||0)>0;
  const start=remarriage?20:Math.max(18,Math.round(ideal-5));
  if(life.age<start||life.age>(remarriage?75:55))return;
  const decay=Math.exp(-Math.max(0,life.age-ideal)/(remarriage?12:6));
  if(chance(life,.45*decay))decision(life,'romance',T('认识一个新的人','認識一個新的人','Meeting someone new'),T('是否开始了解彼此，由你决定。','是否開始了解彼此，由你決定。','You decide whether to get to know each other.'),[option('date',T('试着了解彼此','試著了解彼此','Get to know each other'),undefined,3),option('alone',T('保留自己的节奏','保留自己的節奏','Keep your own pace'))]);
 }else if(!partner.married&&partner.yearsTogether>=2&&marriageAllowed(life)&&chance(life,.8*Math.exp(-Math.max(0,life.age-ideal-3)/8)))marriageDecision(life);
 else if(partner.married&&canConceive(life)&&life.family.children.length===0&&life.age>=20&&life.age-(life.flags.lastChildOffer??-10)>=2&&chance(life,.55)){
  life.flags.lastChildOffer=life.age;
  decision(life,'child',T('是否迎接一个孩子','是否迎接一個孩子','Thinking about a child'),T('这需要双方商量，也意味着长期的时间和经济责任。','這需要雙方商量，也意味著長期的時間及經濟責任。','This takes a joint decision and a long commitment of time and money.'),[option('try',T('尝试迎接新生命','嘗試迎接新生命','Try to have a child'),undefined,2),option('later',T('现在还没准备好','現在還沒準備好','We are not ready yet'))]);
 }
}
function randomDecision(life) {
  if (life.pending || life.pendingQueue.length || life.age < 9 || !chance(life, .42)) return;
  const possibilities = [];
  if (life.age <= 17) { possibilities.push('familyhelp'); if(life.school)possibilities.push('schoolfriend'); if(life.year>=1980)possibilities.push('screen'); }


  if (canConceive(life) && life.age >= 20 && life.family.children.length < 3 && life.age - (life.flags.lastChildOffer ?? -10) >= 4) possibilities.push('child');
  if (life.job && life.age < 62 && life.job.years >= 4) possibilities.push('career', 'worklife');
  if (life.age >= 22 && life.age < 70 && life.age - (life.flags.lastMoveOffer ?? -20) > 9 && locations.length > 1 && life.money>=life.profile.typicalIncome*.08*(historicalContext(life).migrationCostMultiplier||1)) possibilities.push('move');
  if (life.year>=1980 && life.age >= 28 && life.age <= 60 && life.money > life.profile.typicalIncome * .55 && !life.flags.business) possibilities.push('startup');
  if (life.age >= 35 && !life.conditions.includes('chronic')) possibilities.push('checkup');
  if (life.age >= 50 && [life.family.mother, life.family.father].some(person => person.alive && person.age > 73)) possibilities.push('care');
  if (life.age >= 55) possibilities.push('memory', 'community');
  if (!possibilities.length) return;
  const type = pick(life, possibilities);
  switch (type) {
    case 'schoolfriend': decision(life, type, T('身边的那个人', '身邊的那個人', 'Someone beside you'), T('新来的同学还不太适应，午休时总是一个人。', '新來的同學還不太適應，午休時總是一個人。', 'A new classmate is finding it hard to settle in and spends breaks alone.'), [option('include', T('邀请对方一起玩', '邀請對方一起玩', 'Invite them to join you'), undefined, 2), option('quiet', T('先给彼此一点空间', '先給彼此一點空間', 'Give them some space'))]); break;
    case 'screen': decision(life, type, T('屏幕与睡眠', '螢幕與睡眠', 'A screen or some sleep'), T('夜深了，你还是很想再看一会儿。', '夜深了，你還是很想再看一會兒。', 'It is late, but you want to keep watching for a little longer.'), [option('sleep', T('放下设备，去睡觉', '放下裝置，去睡覺', 'Put it away and sleep'), undefined, 2), option('watch', T('再看一会儿', '再看一會兒', 'Keep watching a while'))]); break;
    case 'familyhelp': decision(life, type, T('家里忙碌的一天', '家裡忙碌的一天', 'A busy day at home'), T('家人今天很忙，你还有自己的作业和安排。', '家人今天很忙，你還有自己的作業和安排。', 'Your family is busy today, and you also have homework and plans.'), [option('help', T('分担一些家务', '分擔一些家務', 'Help with chores'), undefined, 2), option('study', T('先完成学习任务', '先完成學習任務', 'Finish your schoolwork first'))]); break;
    case 'romance': decision(life, type, T('认识一个新的人', '認識一個新的人', 'Meeting someone new'), T('一次普通的相遇，让你开始期待下一次见面。', '一次普通的相遇，讓你開始期待下一次見面。', 'An ordinary encounter leaves you looking forward to seeing someone again.'), [option('date', T('试着了解彼此', '試著了解彼此', 'Get to know each other'), undefined, 2), option('alone', T('暂时保持自己的节奏', '暫時保持自己的節奏', 'Keep your own pace for now'))]); break;
    case 'marriage': marriageDecision(life); break;
    case 'child': life.flags.lastChildOffer = life.age; decision(life, type, T('是否迎接一个孩子', '是否迎接一個孩子', 'Thinking about a child'), T('这是期待，也意味着长期的陪伴、时间和开支。', '這是期待，也意味著長期的陪伴、時間和開支。', 'It is a hope, and a long commitment of care, time and money.'), [option('try', T('尝试迎接新生命', '嘗試迎接新生命', 'Try to have a child'), undefined, 1.5), option('later', T('现在还没准备好', '現在還沒準備好', 'We are not ready yet'))]); break;
    case 'career': offerWork(life, T('新的职业机会', '新的職涯機會', 'A new career opportunity')); break;
    case 'worklife': decision(life, type, T('工作的边界', '工作的邊界', 'The boundaries of work'), T('一个重要项目需要更多时间。你也答应了家人一起度过周末。', '一個重要專案需要更多時間。你也答應了家人一起度過週末。', 'An important project needs more time. You also promised your family the weekend.'), [option('project', T('投入项目，争取机会', '投入專案，爭取機會', 'Commit to the project'), undefined, 1.3), option('boundary', T('沟通安排，留住周末', '溝通安排，留住週末', 'Discuss the schedule and protect the weekend'), undefined, 1.7)]); break;
    case 'move': {
      life.flags.lastMoveOffer = life.age;
      const pool = locations.filter(place => place.id !== life.location.id);
      const destinations = [];
      while (destinations.length < 3 && pool.length) destinations.push(pool.splice(Math.floor(random(life) * pool.length), 1)[0]);
      decision(life, type, T('去另一座城市生活', '去另一座城市生活', 'A different city'), T('新的城市可能带来机会，也意味着重新建立生活。这里只包含本游戏的四个地区。', '新的城市可能帶來機會，也意味著重新建立生活。這裡只包含本遊戲的四個地區。', 'A new city may bring opportunities, and the work of rebuilding a life. Destinations stay within the game’s four regions.'), [option('stay', T('留在熟悉的地方', '留在熟悉的地方', 'Stay where you are'), undefined, 3), ...destinations.map((place, i) => option(`move-${i}`, place.name, T('搬迁费用约为当地模型年收入的8%', '搬遷費用約為當地模型年收入的8%', 'Moving costs about 8% of the model annual income'), .8))], { destinations }); break;
    }
    case 'startup': decision(life, type, T('把一个想法变成生意', '把一個想法變成生意', 'Turning an idea into a business'), T('你积累了一些经验和存款，也想过经营自己的小事业。', '你累積了一些經驗和存款，也想過經營自己的小事業。', 'With some experience and savings, you have considered starting a small business.'), [option('start', T('投入积蓄试一试', '投入積蓄試一試', 'Invest some savings and try'), T('需要资金，经营也可能失败', '需要資金，經營也可能失敗', 'Requires capital and may fail'), .55), option('steady', T('保留稳定的工作', '保留穩定的工作', 'Keep a stable job'), undefined, 2)]); break;
    case 'checkup': decision(life, type, T('身体发来的信号', '身體發來的訊號', 'A message from your body'), T('最近的疲惫让你意识到，是时候认真关注健康了。', '最近的疲憊讓你意識到，是時候認真關注健康了。', 'Recent fatigue makes you realise it is time to pay attention to your health.'), [option('doctor', T('安排检查和治疗', '安排檢查和治療', 'Arrange a checkup and treatment'), T('会产生一定医疗支出', '會產生一定醫療支出', 'Some medical expenses apply'), 3), option('postpone', T('先忙完手上的事', '先忙完手上的事', 'Finish other commitments first'))]); break;
    case 'care': decision(life, type, T('父母需要更多照顾', '父母需要更多照顧', 'Your parents need more care'), T('家人的步伐慢了下来，你开始重新安排自己的时间。', '家人的步伐慢了下來，你開始重新安排自己的時間。', 'Your parents are slowing down. You reconsider how to spend your time.'), [option('time', T('投入更多陪伴', '投入更多陪伴', 'Spend more time together'), undefined, 2), option('service', T('请专业照护协助', '請專業照護協助', 'Arrange professional care'), T('用一些开支换取照护支持', '用一些開支換取照護支持', 'Pay for care and support'), 1.4)]); break;
    case 'memory': decision(life, type, T('留下一段记忆', '留下一段記憶', 'Preserving a memory'), T('有人请你讲讲年轻时的故事。', '有人請你講講年輕時的故事。', 'Someone asks you to tell a story from your younger years.'), [option('record', T('写下来或录下来', '寫下來或錄下來', 'Write it down or record it'), undefined, 2), option('tell', T('一起坐下来慢慢聊', '一起坐下來慢慢聊', 'Sit down and talk'))]); break;
    case 'community': decision(life, type, T('社区里的一点小事', '社區裡的一點小事', 'A small part of the community'), T('附近的活动中心正在招募志愿者。', '附近的活動中心正在招募志願者。', 'The nearby community centre is looking for volunteers.'), [option('join', T('报名，尽一份力', '報名，盡一份力', 'Join and help out'), undefined, 2), option('rest', T('把时间留给自己', '把時間留給自己', 'Keep some time for yourself'))]); break;
  }
}

export function advanceYear(life) {
  if (life.phase === 'birth') return startLife(life);
  if (life.phase !== 'life' || life.pending) return life;
  ensureModelState(life);
  // Calendar shocks use a common annual stream for identical seeds. A choice
  // can consume random numbers now without rerolling every later life year.
  life.rngState=hash(`${life.seed}:annual:${life.year}`);
  runAutopilot(life);
  processTimeline(life,1);
  if(life.phase!=='life'||life.pending)return life;
  applyFocus(life);
  financeYear(life);
  familyYear(life);
  routineYear(life);
  healthYear(life);
  ageSnapshot(life);
  const annualRisk=mortality(life);
  life.mortalityRisk.exposure+=-Math.log1p(-Math.min(annualRisk,.999999));
  if (life.mortalityRisk.exposure>=life.mortalityRisk.budget || life.age >= 120) { die(life); return life; }
  life.age++; life.year = life.birthYear + life.age;
  life.residenceYears[life.location.region]=(life.residenceYears[life.location.region]||0)+1;
  life.rngState=hash(`${life.seed}:milestones:${life.year}`);
  life.profile = profileFor(life.location, life.sex, life.world, life.year);
  finishEducation(life,modelEnv(life));
  finishContinuingEducation(life);
  if (life.flags.business && life.job?.id === 'business' && chance(life, .045)) {
    log(life, T('生意遇到困难，你结束经营，开始寻找新的工作。', '生意遇到困難，你結束經營，開始尋找新的工作。', 'The business ran into difficulties. You closed it and began looking for work.'), 'work', { happiness: -7 });
    life.lastJob = { ...life.job }; life.job = null; life.income = 0; delete life.flags.business;
  }
  careerYear(life,modelEnv(life));
  arrangeAge(life);
  culturalMilestoneBridge(life);
  financialDecision(life);
  randomDecision(life);
  if (!getFocusOptions(life).some(item => item.id === life.focus)) life.focus = getFocusOptions(life)[0]?.id ?? null;
  ageSnapshot(life);
  return life;
}
function retire(life) { retireWithContributions(life,modelEnv(life)); }
export function choose(life, optionId, input = '') {
  const pending = life.pending;
  if (life.phase !== 'life' || !pending) return false;
  const selected = pending.options.find(item => item.id === optionId);
  if (!selected) return false;
  life.pending = null;
  log(life, T(`${pending.title.zhCN}：${selected.label.zhCN}`, `${pending.title.zhTW}：${selected.label.zhTW}`, `${pending.title.en}: ${selected.label.en}`), 'choice');
  const handled=resolveEducationDecision(life,pending,optionId,modelEnv(life))||resolveCareerDecision(life,pending,optionId,modelEnv(life));
  if(!handled) switch (pending.action) {
    case 'financial':
      if(optionId!=='keep'&&!purchaseEconomyItem(life,optionId,modelEnv(life)))log(life,T('这项安排暂时无法完成，你保留了积蓄。','這項安排暫時無法完成，你保留了積蓄。','This plan could not be completed, so you kept your savings.'),'money');
      break;
    case 'temperament': life.temperament = TEMPERAMENTS[optionId]; effects(life, optionId === 'curious' ? { knowledge: 4 } : optionId === 'caring' ? { relationships: 5 } : optionId === 'resilient' ? { health: 3 } : { happiness: 4, relationships: 2 }); break;
    case 'reflect': {
      const note = typeof input === 'string' ? input.trim().slice(0, 200) : '';
      if (optionId === 'write') {
        life.totals.learning+=.2;
        effects(life,{happiness:note?2:1,knowledge:.5});
        if(note){life.journal.push({ age: life.age, year: life.year, question: pending.description, text: note }); log(life, T(`写下的想法：${note}`, `寫下的想法：${note}`, `A thought you wrote: ${note}`), 'journal');}
      } else {life.totals.health+=.2;effects(life,{health:1,happiness:.5});}
      break;
    }
    case 'hobby': {
      const name = { music: T('音乐', '音樂', 'Music'), drawing: T('画画', '畫畫', 'Drawing'), sport: T('球类运动', '球類運動', 'Ball games'), reading: T('阅读', '閱讀', 'Reading') }[optionId];
      life.hobbies.push({ id: optionId, name, level: 0 }); effects(life, { happiness: 4 }); break;
    }
    case 'secondary':
      if (optionId === 'high' && chance(life, clamp(.27 + life.stats.knowledge / 130 + life.profile.educationAccess * .16 + life.classRank * .025, .35, .96))) enroll(life, 'high', 3);
      else { if (optionId === 'high') log(life, T('这次没能进入理想的高中，你转而选择了适合自己的职业课程。', '這次沒能進入理想的高中，你轉而選擇了適合自己的職業課程。', 'You did not enter your preferred school and chose a vocational course that suited you.'), 'education'); enroll(life, 'vocational', 3); }
      break;
    case 'university':
      if (optionId === 'apply') {
        const odds = clamp(.12 + life.stats.knowledge / 145 + life.profile.educationAccess * .16 + (life.classRank - 3) * .035 + (life.education === 'vocational' ? -.1 : .04), .2, .94);
        if (chance(life, odds)) enroll(life, 'university', 4);
        else { log(life, T('你没能获得这次录取机会。失落过后，生活仍在向前。', '你沒能獲得這次錄取機會。失落過後，生活仍在向前。', 'You did not receive an offer this time. After the disappointment, life moved on.'), 'education', { happiness: -5 }); offerWork(life); }
      } else if (optionId === 'repeat') { life.flags.repeatExam = life.age + 1; effects(life, { knowledge: 5, happiness: -2 }); }
      else offerWork(life);
      break;
    case 'postgraduate':
      if (optionId === 'masters' && chance(life, clamp(.2 + life.stats.knowledge / 150, .3, .85))) enroll(life, 'masters', 3);
      else { if (optionId === 'masters') log(life, T('研究生申请未能如愿，你决定先在工作中累积经验。', '研究所申請未能如願，你決定先在工作中累積經驗。', 'Your postgraduate application was unsuccessful, so you decided to gain experience at work.'), 'education'); offerWork(life); }
      break;
    case 'job': if (optionId !== 'wait') { const job = pending.data.jobs[Number(optionId.split('-')[1])]; if (job) takeJob(life, job); } break;
    case 'retire': if (optionId === 'retire') retire(life); break;
    case 'schoolfriend': effects(life, optionId === 'include' ? { relationships: 5, happiness: 3 } : { happiness: 1 }); break;
    case 'screen': effects(life, optionId === 'sleep' ? { health: 3, knowledge: 1 } : { happiness: 2, health: -3 }); break;
    case 'familyhelp': if(optionId==='help'){life.flags.familyCareSkill=true;life.totals.family+=.2;effects(life,{relationships:4,knowledge:-1});}else{life.flags.examPreparation=(life.flags.examPreparation||0)+.25;life.totals.learning+=.2;effects(life,{knowledge:3,relationships:-1});} break;
    case 'romance':
      if (optionId === 'date' && life.age<=((life.flags.marriageCount||0)?75:55) && chance(life, .88)) { const partnerSex=life.sex==='male'?'female':'male'; const partnerAge=Math.max(18,life.age+integer(life,-3,3));life.family.partner = {sex:partnerSex,sinceYear:life.year,birthYear:life.year-partnerAge, name: nameFor(life, life.sex === 'male' ? 'female' : 'male'), age:partnerAge, alive: true, married: false, yearsTogether: 0 }; log(life, T(`你和${life.family.partner.name.zhCN}开始交往。`, `你和${life.family.partner.name.zhTW}開始交往。`, `You and ${life.family.partner.name.en} began a relationship.`), 'love', { happiness: 7, relationships: 5 }); }
      else if(optionId==='alone'){life.totals.health+=.1;effects(life,{happiness:1});}
      else effects(life,{happiness:-1});
      break;
    case 'marriage':
      if (optionId === 'marry' && marriageAllowed(life)) { life.family.partner.married = true;life.family.partner.marriedYear=life.year;life.flags.marriageCount=(life.flags.marriageCount||0)+1;life.marriageAge??=life.age; spend(life,Math.min(Math.max(life.money*.12,0),life.profile.typicalIncome*.35),'wedding'); log(life, T('你们结婚了，约定一起面对接下来的生活。', '你們結婚了，約定一起面對接下來的生活。', 'You married and promised to face the years ahead together.'), 'love', { happiness: 8, relationships: 5 }); }
      else if (optionId === 'separate') { life.family.partner = null; effects(life, { happiness: -4, relationships: -3 }); }
      break;
    case 'child':
      if (optionId === 'try'&&canConceive(life)) {
        if (chance(life, fecundity(life.sex==='female'?life.age:life.family.partner.age)*.8)) { const sex = chance(life, .51) ? 'male' : 'female'; const child = { name: familyNameFor(life, sex), age: 0, sex, birthYear:life.year,parentSinceYear:life.family.partner.sinceYear, alive: true }; life.family.children.push(child); log(life, T(`${child.name.zhCN}出生了。家里多了一双需要牵着的小手。`, `${child.name.zhTW}出生了。家裡多了一雙需要牽著的小手。`, `${child.name.en} was born. There was a new little hand to hold.`), 'family', { happiness: 8, relationships: 4, health: life.sex === 'female' ? -3 : -1 }); }
        else log(life, T('这一次未能如愿。你们相互陪伴，慢慢整理心情。', '這一次未能如願。你們相互陪伴，慢慢整理心情。', 'It did not happen this time. You supported each other and gave yourselves time.'), 'family', { happiness: -2 });
      }
      break;
    case 'worklife': if (optionId === 'project') { if (life.job) life.job.salary *= 1.08; effects(life, { health: -3, relationships: -3 }); } else effects(life, { relationships: 4, happiness: 3 }); break;
    case 'move': if (optionId !== 'stay') { const destination = pending.data.destinations[Number(optionId.split('-')[1])]; if (destination) relocate(life, destination); } break;
    case 'startup':
      if (optionId === 'start') { if(!spend(life,life.profile.typicalIncome*.55,'startup'))break; if (chance(life, .65)) { life.flags.business = true; takeJob(life, { id: 'business', name: JOBS.find(job => job.id === 'business').name, salary: Math.round(life.profile.typicalIncome * (1 + random(life) * 1.2)) }); } else log(life, T('创业的尝试没有站稳，你带着经验重新出发。', '創業的嘗試沒有站穩，你帶著經驗重新出發。', 'The venture did not take hold. You started again with more experience.'), 'work', { happiness: -5 }); }
      break;
    case 'checkup':
      if (optionId === 'doctor') { const paid=spend(life,life.profile.typicalIncome*.05,'health'); life.flags.treatment = true; effects(life, { health: paid?7:3 }); if(!paid)log(life,T('积蓄不足，你先寻求基层医疗和救助支持，安排基本诊疗与后续复查。','積蓄不足，你先尋求基層醫療與救助支持，安排基本診療及後續複查。','With insufficient savings, you sought basic care and assistance, arranging follow-up treatment.'),'health'); if (chance(life, .25)) { life.conditions.push('chronic'); log(life, T('检查发现一项需要长期管理的慢性病。规律复诊成为生活的一部分。', '檢查發現一項需要長期管理的慢性病。規律回診成為生活的一部分。', 'A chronic condition was found. Regular follow-ups became part of your routine.'), 'health'); } }
      else { effects(life, { health: -4 }); if (chance(life, .3)) life.conditions.push('chronic'); }
      break;
    case 'care': if (optionId === 'time') { effects(life, { relationships: 5, happiness: 2 }); if (life.job) life.job.salary *= .98; } else { spend(life,life.profile.typicalIncome*.065,'care'); effects(life, { relationships: 3 }); } break;
    case 'memory': effects(life, optionId === 'record' ? { knowledge: 2, happiness: 3 } : { relationships: 4, happiness: 3 }); break;
    case 'community': if(optionId==='join'){life.flags.communityMember=true;life.totals.charity+=40;effects(life,{relationships:5,happiness:3});}else{life.totals.health+=.15;effects(life,{health:2,happiness:2});} break;
  }
  if (!life.pending && life.pendingQueue.length) life.pending = life.pendingQueue.shift();
  ageSnapshot(life);
  return true;
}
export function autoChoose(life) {
  if (!life.pending) return false;
  const selected = weighted(life, life.pending.options);
  return choose(life, selected.id);
}
export function relocate(life, destination) {
  const requested = validateLocation(destination);
  const canonical = locations.find(item => item.id === requested.id);
  if (!canonical || life.phase !== 'life' || life.age < 18) return false;
  const location = validateLocation(canonical);
  if (location.id === life.location.id) return false;
  processTimeline(life,Number(life.uiProgress)||0);
  if(life.phase!=='life'||life.pending)return false;
  const priorIncome = life.profile.typicalIncome;
  if(!spend(life,priorIncome*.08*(historicalContext(life).migrationCostMultiplier||1),'moving'))return false;
  const wasRural=!life.urban;
  life.location = location;
  life.urban = true;
  if(wasRural){life.flags.ruralMigrantYear=life.year;if(life.job?.sector==='agriculture'){life.lastJob={...life.job};life.job=null;life.income=0;}}
  life.profile = profileFor(location, life.sex, life.world, life.year);
  if (life.job) { life.job.salary = Math.round(life.job.salary * clamp(life.profile.typicalIncome / priorIncome, .6, 1.6) * .94); life.job.marketIncomeReference=life.profile.typicalIncome; life.income=life.job.salary; }
  if (!life.visited.some(item => item.id === location.id)) life.visited.push(location);
  life.totals.migrations++;
  log(life, T(`你搬到了${location.name.zhCN}。新的街道上，你开始建立新的日常。`, `你搬到了${location.name.zhTW}。新的街道上，你開始建立新的日常。`, `You moved to ${location.name.en} and began building a new routine.`), 'move', { happiness: 3, relationships: -6 });
  return true;
}

export function netWorth(life) { return Math.round(bookNetWorth(life)); }
export function getShopItems(life) {
  if(life.phase!=='life'||life.age<6)return [];
  ensureModelState(life);
  return getEconomyShopItems(life);
}
export function purchase(life,itemId) {
  if(life.pending||life.phase!=='life')return false;
  ensureModelState(life);
  const result=purchaseEconomyItem(life,itemId,modelEnv(life));
  if(result)ageSnapshot(life);
  return result;
}

export function summarize(life) {
  const job = life.job?.name ?? life.lastJob?.name ?? T('尚未开始工作', '尚未開始工作', 'Had not entered work');
  const education = EDUCATION[life.education] ?? EDUCATION.preschool;
  const end = life.death?.cause ?? T('仍在继续的人生', '仍在繼續的人生', 'A life still unfolding');
  const happiestYear = [...life.years].sort((a, b) => b.happiness - a.happiness)[0] ?? null;
  const children = life.family.children.length;
  const partner = life.family.partner?.name ?? null;
  const total = life.totals.work + life.totals.family || 1;
  const texture = [
    { id: 'care', left: T('陪伴', '陪伴', 'Togetherness'), right: T('工作', '工作', 'Work'), value: Math.round(100 * life.totals.work / total) },
    { id: 'roots', left: T('扎根', '扎根', 'Roots'), right: T('远行', '遠行', 'Wanderlust'), value: Math.min(100, life.totals.migrations * 24) },
    { id: 'pace', left: T('安稳', '安穩', 'Steadiness'), right: T('探索', '探索', 'Exploration'), value: Math.round(clamp(life.totals.learning * 3 + life.totals.migrations * 8)) },
    { id: 'time', left: T('今天', '今天', 'Today'), right: T('明天', '明天', 'Tomorrow'), value: Math.round(clamp(35 + life.totals.learning * 1.4 + (life.assets.house ? 12 : 0) - life.totals.family * .5)) },
  ];
  return {
    title: life.name, age: life.age, deathCause: end, education, job, netWorth: netWorth(life), income: life.income, happiestYear, children, partner, visited: life.visited, texture, years: life.years,
    text: T(`${life.name.zhCN}出生在${life.born.name.zhCN}，来自${CLASS_NAMES[life.classRank - 1].zhCN}。最高学历是${education.zhCN}，${life.job || life.lastJob ? `做过${job.zhCN}` : '还没有开始工作'}。${children ? `养育了${children}个孩子。` : ''}${life.death ? `${life.age}岁时因${end.zhCN}离世。` : '这段人生仍在继续。'}`, `${life.name.zhTW}出生在${life.born.name.zhTW}，來自${CLASS_NAMES[life.classRank - 1].zhTW}。最高學歷是${education.zhTW}，${life.job || life.lastJob ? `做過${job.zhTW}` : '還沒有開始工作'}。${children ? `養育了${children}個孩子。` : ''}${life.death ? `${life.age}歲時因${end.zhTW}離世。` : '這段人生仍在繼續。'}`, `${life.name.en} was born in ${life.born.name.en}, into ${CLASS_NAMES[life.classRank - 1].en}. Education: ${education.en}. ${life.job || life.lastJob ? `Worked as a ${job.en.toLowerCase()}. ` : 'Had not yet started work. '}${children ? `Raised ${children} ${children === 1 ? 'child' : 'children'}. ` : ''}${life.death ? `Died at ${life.age} from ${end.en}.` : 'This life is still unfolding.'}`),
  };
}
export function generateCompanions({ locations: catalogue = locations, seed = 'companions', birthYear = 2026, world = 'now', count = 4 } = {}) {
  if (catalogue?.length) configureLocations(catalogue);
  if (!locations.length) return [];
  const result = [];
  for (let i = 0; i < Math.min(8, count); i++) {
    const life = createLife({ seed: `${seed}-companion-${i}`, birthYear, world, paceMinutes: 30 });
    startLife(life);
    let iterations = 0;
    while (life.phase !== 'dead' && iterations++ < 1500) {
      if (life.pending) autoChoose(life);
      else {
        const options = getFocusOptions(life);
        if (options.length) setFocus(life, pick(life, options).id);
        advanceYear(life);
      }
    }
    result.push({ id: life.id, name: life.name, born: life.born, sex: life.sex, deathAge: life.age, education: EDUCATION[life.education], job: life.job?.name ?? life.lastJob?.name ?? null, years: life.years, summary: summarize(life) });
  }
  return result;
}
