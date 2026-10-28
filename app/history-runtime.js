/** Historical facts are separate from the explicitly modeled personal effects. */
import { HISTORY_EVENTS, HISTORY_META, HISTORY_SOURCES, activeHistoryEffects, getHistoricalEra, matchesHistoryLocation } from './data/history.js';
import { developmentAt, DEVELOPMENT_SOURCES } from './data/development.js';

const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
const clamp = (n, low, high) => Math.max(low, Math.min(high, Number.isFinite(n) ? n : low));
const sourceUrls = ids => [...new Set(ids.map(id => HISTORY_SOURCES[id]?.url || DEVELOPMENT_SOURCES.find(s => s.id === id)?.url).filter(Boolean))];
const yearStart = year => Date.UTC(year, 0, 1);
const yearLength = year => yearStart(year + 1) - yearStart(year);

/** Fractions describe the current calendar year. Unknown dates wait for its summary. */
function eventFraction(event) {
  if (event.datePrecision === 'year') return 1;
  const [year, month, day] = event.date.split('-').map(Number);
  if (event.datePrecision === 'month') return (Date.UTC(year, month, 1) - yearStart(year)) / yearLength(year);
  const [hour, minute] = (event.timeBeijing || '00:00').split(':').map(Number);
  // The fractions use local calendar components, so there is no host-timezone shift.
  return (Date.UTC(year, month - 1, day, hour, minute) - yearStart(year)) / yearLength(year);
}
function birthFraction(life) {
  const month = clamp(Math.floor(Number(life.birthMonth) || 1), 1, 12);
  const day = clamp(Math.floor(Number(life.birthDay) || 1), 1, new Date(Date.UTC(life.birthYear, month, 0)).getUTCDate());
  return (Date.UTC(life.birthYear, month - 1, day) - yearStart(life.birthYear)) / yearLength(life.birthYear);
}
function beforeBirth(event, life) {
  if (event.year !== life.birthYear) return event.year < life.birthYear;
  // Year-only records have no asserted month/day; do not invent pre-birth exposure.
  if (event.datePrecision === 'year') return false;
  if (event.datePrecision === 'month') return Number(event.date.slice(5, 7)) < (life.birthMonth || 1);
  return eventFraction(event) < birthFraction(life);
}
function displayDate(event) {
  return event.datePrecision === 'year' ? event.date.slice(0, 4) : event.datePrecision === 'month' ? event.date.slice(0, 7) : event.date;
}

export function ensureHistoryState(life) {
  if (!life.history || typeof life.history !== 'object') life.history = {};
  const h = life.history;
  if (!Array.isArray(h.seen)) h.seen = [];
  if (!Array.isArray(h.experienced)) h.experienced = [];
  if (!Array.isArray(h.eraSeen)) h.eraSeen = [];
  if (!Number.isInteger(h.processedYear)) h.processedYear = life.year;
  if (!Number.isFinite(h.throughFraction)) h.throughFraction = 0;
  h.version = 1;
  h.cutoff = HISTORY_META.cutoff;
  return h;
}

function fallbackEffects(life, changes) {
  for (const [key, value] of Object.entries(changes || {})) {
    if (life.stats && key in life.stats) life.stats[key] = clamp(life.stats[key] + value, 0, 100);
    else if (key === 'money') life.money = (life.money || 0) + value;
  }
}
function emit(life, text, type, changes, metadata, env) {
  let entry;
  if (env.log) {
    entry = env.log(life, text, type, changes);
    // Older saves/embedders may provide a log helper without a return value.
    if (!entry && life.log?.[0]?.text === text) entry = life.log[0];
  } else {
    (env.effects || fallbackEffects)(life, changes);
    life.log ||= [];
    life.logSequence = (life.logSequence || 0) + 1;
    entry = { id: `${life.id || 'life'}-history-${life.logSequence}`, age: life.age, year: life.year, text, type, effects: changes || null };
    life.log.unshift(entry);
  }
  if (entry) Object.assign(entry, metadata);
  return entry;
}
function metadataFor(event,life) {
  return {
    historicalEventId: event.id, historicalDate: displayDate(event), date: displayDate(event),
    historicalLocationId:life.location.id,locationId:life.location.id,appliesTo:event.appliesTo,
    datePrecision: event.datePrecision, timeBeijing: event.timeBeijing,
    sourceIds: [...event.sourceIds], sourceUrls: [...event.sourceUrls],
    modelNote: event.modelNote, effectKind: 'game-scenario-not-measured-individual-risk',
  };
}
function draw(life, probability, env) {
  if (!(probability > 0)) return false;
  if (env.chance) return env.chance(life, clamp(probability, 0, 1));
  // Keep standalone embedding deterministic and serializable, like the engine.
  let x = life.rngState | 0 || 1;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  life.rngState = x >>> 0;
  return life.rngState / 4294967296 < probability;
}

function applyPersonalEvent(life, event, env) {
  const fx = event.effects;
  const metadata = metadataFor(event,life);
  const before={health:life.stats.health,happiness:life.stats.happiness,relationships:life.stats.relationships,knowledge:life.stats.knowledge,money:life.money,house:life.assets?.house||0,phase:life.phase};
  const changes = Object.fromEntries(['health', 'happiness', 'relationships', 'knowledge'].filter(k => Number.isFinite(fx[k])).map(k => [k, fx[k]]));
  const date = displayDate(event);
  const place = life.location?.name || {};
  const primary=emit(life, T(
    `${date} · 你在${place.zhCN || '这座城市'}生活的这一年，${event.title.zhCN}。${event.description.zhCN}`,
    `${date} · 你在${place.zhTW || place.zhCN || '這座城市'}生活的這一年，${event.title.zhTW}。${event.description.zhTW}`,
    `${date} · While you were living in ${place.en || 'your city'}, ${event.title.en} occurred. ${event.description.en}`,
  ), 'history', changes, metadata, env);

  // Independent draws: displacement and injury do not imply a death outcome.
  if (draw(life, fx.injuryRisk, env)) {
    const illness = event.category === 'health';
    emit(life, illness
      ? T('你在这场公共卫生事件中患病，需要诊治、休养与照护。', '你在這場公共衛生事件中患病，需要診治、休養與照護。', 'You became ill during the public-health emergency and needed treatment, rest and care.')
      : T('这次灾害让你受了伤，救助与休养成为当下最重要的事。', '這次災害讓你受了傷，救助與休養成為當下最重要的事。', 'You were injured in the disaster; assistance and recovery became the immediate priority.'),
    'health', { health: -9, happiness: -3 }, { ...metadata, historicalOutcome: illness ? 'illness' : 'injury' }, env);
  }
  if (draw(life, fx.homeLossRisk, env)) {
    const house = Math.max(0, Number(life.assets?.house) || 0);
    const loss = Math.round(house * .35);
    if(house){if(env.changeAsset)env.changeAsset(life,'house',house-loss,'disaster-property-loss');else life.assets.house=Math.max(0,house-loss);}
    // Dependants receive household support; no disaster automatically creates debt.
    const cash = Math.max(0, Number(life.money) || 0);
    const cashLoss = life.age >= 18 ? Math.round(Math.min(cash * .06, (life.profile?.typicalIncome || 30000) * .05)) : 0;
    emit(life, T(
      '住所或家中物品受到影响，你和家人安排临时安置与修复。',
      '住所或家中物品受到影響，你和家人安排臨時安置與修復。',
      'Your home or belongings were affected. You and your family arranged temporary shelter and repairs.',
    ), 'home', { happiness: -4, money: -cashLoss }, { ...metadata, historicalOutcome: 'housing-damage', modeledPropertyLoss: loss, modeledCashLoss: cashLoss }, env);
  }
  if (Number.isFinite(fx.wealthMultiplier) && fx.wealthMultiplier < 1 && life.money > 0) {
    const loss = life.money * (1 - clamp(fx.wealthMultiplier, 0, 1));
    (env.effects || fallbackEffects)(life, { money: -Math.round(loss) });
  }
  if (draw(life, fx.deathRisk, env)) {
    const cause = T(`“${event.title.zhCN}”中的灾害或疾病`, `「${event.title.zhTW}」中的災害或疾病`, `disaster or illness during ${event.title.en}`);
    const deathMetadata = { ...metadata, historicalOutcome: 'death', historicalLocationId: life.location.id };
    if (env.die) {
      env.die(life, cause, deathMetadata);
      // The host may attach metadata to life.death but emit a separate log.
      // Preserve the same verifiable date/source details on that visible entry.
      const deathEntry = life.log?.[0];
      if (deathEntry?.type === 'death' && deathEntry.year === life.year) Object.assign(deathEntry, deathMetadata);
    }
    else {
      life.phase = 'dead'; life.pending = null; life.pendingQueue = [];
      life.death = { age: life.age, year: life.year, cause, location: life.location, ...deathMetadata };
      emit(life, T('你在这场灾害或疾病中离世。', '你在這場災害或疾病中離世。', 'Your life ended during this disaster or illness.'), 'death', null, deathMetadata, env);
    }
    if(primary)primary.mechanicalEffect={changed:true,delta:{phase:'dead'},modelOnly:true};
    return true;
  }
  // A contextual event can miss an unemployed, child or fully invested player.
  // Give the event a small, explicitly modeled personal response instead of
  // displaying a choice-free fact as though it had changed the simulation.
  const immediatelyChanged=Object.entries(before).some(([key,value])=>key==='house'?(life.assets?.house||0)!==value:key==='phase'?life.phase!==value:key==='money'?life.money!==value:life.stats[key]!==value);
  if(!immediatelyChanged){
    const adverse=fx.incomeMultiplier<1||fx.livingCostMultiplier>1||fx.injuryRisk>0||fx.deathRisk>0||fx.unemploymentRisk>0;
    const sign=adverse?-1:1;
    const key=Math.abs(life.stats.happiness-(sign>0?100:0))<.5?'knowledge':'happiness';
    const direction=key==='knowledge'&&life.stats.knowledge>99?-1:sign;
    emit(life,T(`你在${place.zhCN || '这座城市'}的日常感受也随之改变。`,`你在${place.zhTW || place.zhCN || '這座城市'}的日常感受也隨之改變。`,`Your daily life in ${place.en || 'your city'} also felt different.`),'history',{[key]:direction*.5},{...metadata,historicalOutcome:'modeled-context-response'},env);
  }
  if(primary){
    const delta=Object.fromEntries(Object.entries(before).map(([key,value])=>[key,key==='house'?(life.assets?.house||0)-value:key==='phase'?life.phase:key==='money'?life.money-value:life.stats[key]-value]).filter(([key,value])=>key==='phase'?value!==before.phase:value!==0));
    primary.mechanicalEffect={changed:Object.keys(delta).length>0,delta,modelOnly:true};
  }
  return false;
}

/** Call before a move and as calendar progress advances; completed events never replay. */
export function processHistory(life, throughFraction = 1, env = {}) {
  if (!life || life.phase === 'dead' || !life.location) return { changed: false, dead: life?.phase === 'dead' };
  const h = ensureHistoryState(life);
  const fraction = clamp(Number(throughFraction), 0, 1);
  if (life.year < HISTORY_META.startYear || life.year > HISTORY_META.endYear) return { changed: false, dead: false };
  if (h.processedYear !== life.year) { h.processedYear = life.year; h.throughFraction = 0; }
  // A rewind from a UI refresh cannot reopen an already elapsed event window.
  h.throughFraction = Math.max(h.throughFraction, fraction);
  let changed = false;
  const era = getHistoricalEra(life.year, life.location.region);
  const eraKey = `${life.location.region}:${era.id}`;
  if (!h.eraSeen.includes(eraKey)) {
    const first = h.eraSeen.length === 0;
    h.eraSeen.push(eraKey); h.eraId = era.id;
    const label = era.title;
    emit(life, T(
      `${first ? '你生活的时代' : '时代进入新的阶段'}：${label.zhCN}。当地的就业、求学与医疗条件会随年代变化。`,
      `${first ? '你生活的時代' : '時代進入新的階段'}：${label.zhTW}。當地的就業、求學與醫療條件會隨年代變化。`,
      `${first ? 'Your historical setting' : 'A new historical phase'}: ${label.en}. Local opportunities, education and healthcare change over time.`,
    ), 'history', null, { historicalEraId: era.id, sourceIds: [...era.sourceIds], sourceUrls: sourceUrls(era.sourceIds), modelNote: era.modelNote, datePrecision: 'period' }, env);
    changed = true;
  }
  const due = HISTORY_EVENTS.filter(event => event.year === life.year && event.date <= HISTORY_META.cutoff && eventFraction(event) <= h.throughFraction)
    .sort((a, b) => eventFraction(a) - eventFraction(b) || a.id.localeCompare(b.id));
  const seen = new Set(h.seen);
  for (const event of due) {
    if (seen.has(event.id)) continue;
    // Mark elapsed events even outside this residence, so moving later cannot
    // retroactively place the character in an already completed local disaster.
    h.seen.push(event.id); seen.add(event.id);
    if (beforeBirth(event, life) || !matchesHistoryLocation(event, life.location)) continue;
    h.experienced.push(event.id);
    changed = true;
    if (applyPersonalEvent(life, event, env)) return { changed: true, dead: true };
  }
  return { changed, dead: life.phase === 'dead' };
}

/** Continuing effects apply to current residence; deaths/injuries are never rerolled here. */
export function historicalContext(life) {
  const h = ensureHistoryState(life);
  const currentProgress = h.processedYear === life.year ? h.throughFraction : 0;
  const result = {
    incomeMultiplier: 1, livingCostMultiplier: 1, migrationCostMultiplier:1, wealthMultiplier: 1, mortalityMultiplier:1,
    investmentReturnShock: 0, unemploymentRisk: 0, educationAccess: 0,
    health: 0, happiness: 0, relationships: 0,
    eventIds: [], sourceIds: [], sourceUrls: [], projection: life.year > HISTORY_META.endYear,
    dataKind: 'historical-facts-with-scenario-effects',
  };
  for (const event of activeHistoryEffects(life.year, life.location)) {
    if (beforeBirth(event, life) && event.endYear === event.year) continue;
    if (event.duration === 1 && !h.experienced.includes(event.id)) continue;
    if (event.year === life.year && eventFraction(event) > currentProgress) continue;
    if (event.date > HISTORY_META.cutoff) continue;
    result.eventIds.push(event.id); result.sourceIds.push(...event.sourceIds);
    for (const [key, value] of Object.entries(event.effects)) {
      if (['incomeMultiplier', 'livingCostMultiplier', 'wealthMultiplier'].includes(key)) result[key] *= value;
      else if (['investmentReturnShock', 'unemploymentRisk', 'educationAccess', 'health', 'happiness', 'relationships'].includes(key)) result[key] += value;
    }
    if(event.effects.mortalityMultiplier&&life.location.region==='mainland'){
      const annual=event.effects.mortalityMultiplier[life.year];
      if(Number.isFinite(annual)&&annual>0)result.mortalityMultiplier*=annual;
    }
    // Scenario transmission: difficult living costs and earnings affect the
    // savings needed for a move, without claiming a measured city migration fee.
    result.migrationCostMultiplier*=1+.3*((event.effects.livingCostMultiplier??1)-1)-.2*((event.effects.incomeMultiplier??1)-1);
  }
  result.incomeMultiplier = clamp(result.incomeMultiplier, .5, 1.65);
  result.livingCostMultiplier = clamp(result.livingCostMultiplier, .65, 1.65);
  result.migrationCostMultiplier=clamp(result.migrationCostMultiplier,.75,1.35);
  result.mortalityMultiplier=clamp(result.mortalityMultiplier,1,4);
  result.unemploymentRisk = clamp(result.unemploymentRisk, 0, .3);
  result.investmentReturnShock = clamp(result.investmentReturnShock, -.4, .2);
  result.educationAccess = clamp(result.educationAccess, -.4, .3);
  result.sourceIds = [...new Set(result.sourceIds)]; result.sourceUrls = sourceUrls(result.sourceIds);
  return result;
}

/** Statistics anchors and scenario calibration have distinct provenance labels. */
export function historicalProfile(location, sex, world, year) {
  const era = getHistoricalEra(year, location.region);
  const development = developmentAt(year, location, world);
  const prosperity = clamp(Number(location.prosperity ?? .55), .1, 1);
  const mainland = location.region === 'mainland';
  const sexAdjustment = sex === 'female' ? 2.6 : -2.1;
  const sourceIds = [...new Set([...development.sourceIds, ...(mainland ? era.sourceIds : [])])];
  const educationBase = mainland ? development.educationIndex * .65 + era.educationAccess * .35 : era.educationAccess;
  return {
    lifeExpectancy: clamp(development.lifeExpectancy + sexAdjustment + (prosperity - .55) * 3, 30, 95),
    lifeExpectancyAt25: clamp(development.lifeExpectancyAt25 + sexAdjustment + (prosperity - .55) * 3, 45, 98),
    childMortality: clamp(development.under5Mortality * (sex === 'male' ? 1.06 : .94), .0001, .65),
    typicalIncome:Math.round((mainland?(24000+prosperity*84000)*development.mainlandIncomeFactor:66500*(.90+prosperity*.20)*development.regionIncomeFactor)*development.incomeIndex),
    developmentIncomeIndex:development.incomeIndex,regionCostFactor:development.regionCostFactor,regionIncomeFactor:development.regionIncomeFactor,currencyBasis:development.currencyBasis,
    educationAccess: clamp(educationBase + (prosperity - .55) * .12, .12, .995),
    urbanization: development.urbanization, healthcare: era.healthcare,
    eraId: era.id, eraLabel: era.title, sourceIds, sourceUrls: sourceUrls(sourceIds),
    dataKind: mainland ? 'official-national-anchors-with-modeled-interpolation-and-city-sex-adjustments' : 'regional-scenario-not-regional-official-statistics',
    historicalCutoff: HISTORY_META.cutoff, projection: year > 2025, observedThrough:development.observedThrough,historicalEstimate:development.historicalEstimate,modelOnly:development.modelOnly,
    modelNote: T('全国观测锚点与城市、性别、个人风险的情景参数分别记录；收入为固定购买力游戏金额。', '全國觀測錨點與城市、性別、個人風險的情景參數分別記錄；收入為固定購買力遊戲金額。', 'National observations are separated from modeled city, sex and personal-risk parameters; income uses fixed-purchasing-power game money.'),
  };
}
