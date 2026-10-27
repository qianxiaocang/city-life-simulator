// 游戏模块目录：默认 ./src；指向真实仓库：GAME_SRC=/path/to/src node 本脚本
//   相对路径按“本脚本所在位置”解析，例如 GAME_SRC=../../repo/src
import { pathToFileURL } from 'node:url';
const GS = (process.env.GAME_SRC ?? './src').replace(/\/+$/, '');
const u = p => (/^[.\/]/.test(GS) ? new URL(`${GS}/${p}`, import.meta.url).href : pathToFileURL(`${GS}/${p}`).href);
import { existsSync } from 'node:fs';
if (!existsSync(new URL(u('engine.js')))) {
  console.error ??= console.log;
  console.error(`[audit] 找不到游戏模块 ${GS}/engine.js\n` +
    `        用 GAME_SRC 指向含 engine.js 的目录，例如：GAME_SRC=/绝对路径/游戏src node ${process.argv[1].split('/').pop()}`);
  process.exit(2);
}
// ────────────────────────────────────────────────────────────────────
/**
 * Headless audit of the shipped life-sim engine (opportunity-tszy.site).
 * Drives the game's OWN engine + data tables for N lives; every number below is
 * produced by shipped code, not by a reimplementation.
 */
import { writeFileSync } from 'node:fs';
const E = await import(u('engine.js'));
const { locations } = await import(u('data/locations.js'));
const { CHINA_JOBS, CULTURAL_EVENTS } = await import(u('data/china-society.js'));
const { HISTORY_EVENTS } = await import(u('data/history.js'));
const { legalMarriageAge, pensionMinimumYears, retirementRule, tuitionModel } = await import(u('data/china-law.js'));

const N = Number(process.env.N ?? 12000);
const T = (v) => (typeof v === 'string' ? v : v?.zhCN ?? '');
const EDUCATION_RANK = { preschool: 0, primary: 1, junior: 2, vocational: 3, high: 3, associate: 3.5, university: 4, masters: 5, doctorate: 6 };
const HE_BY_ID = new Map(HISTORY_EVENTS.map((e) => [e.id, e]));

const A = {};
const hit = (code, payload, note = '') => { const a = (A[code] ??= { count: 0, samples: [], note }); a.count++; if (a.samples.length < 4) a.samples.push(payload); };
const S = {};
const push = (k, v) => { (S[k] ??= []).push(v); };
const bump = (k, n = 1) => { S[k] ??= 0; S[k] = (S[k] ?? 0) + n; };

const seenBirth = new Map(), seenHistory = new Map(), seenCultural = new Map(), seenJob = new Map(), seenAction = new Map();
const heEffectsEmpty = new Map();

const snap = (l) => ({
  age: l.age, year: l.year, married: !!l.family.partner?.married, partnerAge: l.family.partner?.age ?? null,
  children: l.family.children.length, jobId: l.job?.id ?? null, education: l.education, retired: !!l.retired,
  money: l.money, netWorth: E.netWorth(l), income: l.income,
  pensionOn: (l.pension ?? 0) > 0,
  health: l.stats.health, happiness: l.stats.happiness, knowledge: l.stats.knowledge, relationships: l.stats.relationships,
});


function diffTransitions(l, prev, ctx) {
  const { seed, region } = ctx;
  const now = snap(l);
  if (now.jobId && !prev.jobId) {
    const j = l.job;
    push('firstJobAge', now.age); push(`firstJobAge@${region}`, now.age);
    if (now.age < 16) hit('EMPLOYMENT_UNDER_16', { seed, age: now.age, region, year: now.year, jobId: j?.id });
    if (j?.minYear != null && now.year < j.minYear) hit('JOB_STARTED_BEFORE_ITS_MIN_YEAR', { seed, jobId: j.id, minYear: j.minYear, year: now.year, birthYear: ctx.birthYear });
    if (j?.minAge != null && now.age < j.minAge) hit('JOB_STARTED_UNDER_JOB_MIN_AGE', { seed, jobId: j.id, minAge: j.minAge, age: now.age });
    const rank = EDUCATION_RANK[l.education] ?? 0;
    if (j?.educationRank != null && rank + 1e-9 < j.educationRank) hit('JOB_ABOVE_OWN_EDUCATION_LEVEL', { seed, jobId: j.id, need: j.educationRank, have: l.education, rank, age: now.age });
    push('jobSalaryRatio', (j?.salary ?? 0) / (l.profile.typicalIncome || 1));
    seenJob.set(j?.id ?? '?', (seenJob.get(j?.id ?? '?') ?? 0) + 1);
    ctx.hired = true;
  }
  if ((l.pension ?? 0) > 0 && !prev.pensionOn) {
    push('pensionStartAge', now.age);
    const rule = retirementRule({ birthYear: ctx.birthYear, birthMonth: l.birthMonth, sex: l.sex, category: l.job?.retirementCategory ?? l.lastJob?.retirementCategory ?? 'worker', region, year: now.year });
    if (rule?.age != null) { push(`retireGapVsLaw@${region}`, +(now.age - rule.age).toFixed(2)); if (now.age < rule.age - 0.6) hit('PENSION_BEFORE_LEGAL_RETIRE_AGE', { seed, age: now.age, legal: rule.age, year: now.year }); }
    const minY = pensionMinimumYears(now.year, region);
    if (minY != null && (l.contributionYears ?? 0) < minY) hit('PENSION_WITH_INSUFFICIENT_CONTRIBUTIONS', { seed, age: now.age, contrib: l.contributionYears, need: minY, year: now.year, pension: Math.round(l.pension) });
    if (region !== 'mainland') hit('PENSION_FROM_MAINLAND_RULE_IN_NONMAINLAND', { seed, region, age: now.age });
  }
  if (now.retired && !prev.retired) push(`retireAge@${region}`, now.age);
  if (now.education !== prev.education) { ctx.eduAgeAt[now.education] = ctx.eduAgeAt[now.education] ?? now.age; }
  return now;
}

const numOk = (x) => typeof x === 'number' && Number.isFinite(x);
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const world = i % 5 === 0 ? 'past' : i % 7 === 0 ? 'future' : 'now';
  const birthYear = world === 'past' ? [1950, 1955, 1958, 1961, 1965, 1968, 1971, 1975, 1978, 1982, 1986, 1990, 1995, 2000, 2005, 2010, 2015, 2020][i % 18] : 2026;
  const seed = `a${i}`;
  let l;
  try { l = E.createLife({ locations, seed, world, birthYear, paceMinutes: 30 }); E.startLife(l); }
  catch (e) { hit('ENGINE_THROW_create', { seed, err: String(e).slice(0, 150) }); continue; }

  const region = l.born.region;
  seenBirth.set(l.born.id, (seenBirth.get(l.born.id) ?? 0) + 1);
  push('profile.lifeExpectancy', l.profile.lifeExpectancy);
  push(`profile.lifeExpectancy@${world}@by${birthYear}`, l.profile.lifeExpectancy);
  push(`profile.typicalIncome@${region}`, l.profile.typicalIncome);
  push(`profile.prosperity@${region}`, l.born.prosperity);
  push('profile.urbanization', l.profile.urbanization);
  push('profile.healthcare', l.profile.healthcare);
  push('profile.childMortality', l.profile.childMortality);

  const sibs = l.family.siblings.length;
  push(`siblings@${birthYear < 1980 ? 'pre1980' : birthYear <= 2015 ? 'onechild1980-2015' : 'post2015'}`, sibs);
  if (birthYear < 1980 && sibs === 0) hit('IMPOSSIBLE_ONLY_CHILD_PRE1980', { seed, birthYear });
  if (birthYear >= 1980 && birthYear <= 2015 && sibs >= 2) hit('SIBLING_COUNT_IGNORES_ONE_CHILD_POLICY', { seed, birthYear, sibs });
  if (birthYear < 1980) push('motherAge@pre1980', l.family.mother.age); else push('motherAge@post1980', l.family.mother.age);
  if (birthYear < 1980 && l.family.mother.age > 29) hit('MATERNAL_AGE_TOO_HIGH_FOR_COHORT', { seed, birthYear, momAge: l.family.mother.age });
  if (l.family.father.age < l.family.mother.age - 1) hit('FATHER_YOUNGER_THAN_MOTHER_EDGE', { seed, dad: l.family.father.age, mom: l.family.mother.age });

  let guard = 0, prev = snap(l), focusSet = 0, workYears = 0;
  const eduAgeAt = {};
  const ctx = { seed, region, birthYear, eduAgeAt, hired: false };
  try {
    while (l.phase === 'life' && guard++ < 300) {
      if (l.pending) {
        const p = l.pending, ids = (p.options ?? []).map((o) => o.id);
        if (!ids.length) hit('EMPTY_DECISION', { seed, action: p.action });
        if (new Set(ids).size !== ids.length) hit('DUPLICATE_OPTION_IDS', { seed, action: p.action, ids });
        if (p.options.some((o) => !(o.autoWeight > 0))) hit('OPTION_WITHOUT_AUTO_WEIGHT', { seed, action: p.action, opts: p.options.map((o) => [o.id, o.autoWeight]) });
        if (p.options.some((o) => !o.description || !T(o.description))) hit('OPTION_WITHOUT_DESCRIPTION', { seed, action: p.action });
        seenAction.set(p.action, (seenAction.get(p.action) ?? 0) + 1);
        const before = { ...prev };
        E.autoChoose(l);
        prev = diffTransitions(l, prev, ctx);
        if (prev.married && !before.married) {
          const legal = legalMarriageAge(l.sex, region, l.year);
          if (legal == null) { hit('MARRIAGE_LAW_GATE_NULL_NONMAINLAND', { seed, region, age: l.age, year: l.year }); if (l.age < 18) hit('MARRIAGE_UNDER_18_NONMAINLAND', { seed, region, age: l.age }); }
          else if (l.age < legal) hit('MARRIAGE_UNDER_LEGAL_AGE', { seed, region, age: l.age, legal, year: l.year });
          push('marriageAge', l.age);
          if (prev.partnerAge != null) push('partnerAgeGap', prev.partnerAge - l.age);
        }
        if (prev.children > before.children) {
          if (prev.children === 1) { push('firstChildAge', l.age); if (!before.married) hit('FIRST_BIRTH_OUT_OF_WEDLOCK', { seed, age: l.age }); }
          if (l.sex === 'female' && l.age > 43) hit('FEMALE_FIRST_BIRTH_OVER_43', { seed, age: l.age });
          if (l.age > 50) hit('BIRTH_OVER_50', { seed, age: l.age, sex: l.sex });
        }
        continue;
      }
      // Player policy: an employed adult focuses on career (mirrors the UI's focus control).
      if (l.job && E.getFocusOptions(l).some((f) => f.id === 'work')) { if (E.setFocus(l, 'work')) { focusSet++; if (l.focus === 'work') workYears++; } }
      E.advanceYear(l);
      const now = snap(l);
      prev = diffTransitions(l, prev, ctx);
      if (now.year - l.birthYear !== now.age) hit('TIMELINE_YEAR_AGE_MISMATCH', { seed, year: now.year, age: now.age, birthYear: l.birthYear });
      for (const [k, v] of Object.entries({ money: now.money, netWorth: now.netWorth, income: now.income, health: now.health, happiness: now.happiness }))
        if (!numOk(v)) hit('NON_FINITE_STATE', { seed, field: k, v: String(v), age: now.age });
      for (const [k, v] of Object.entries({ health: now.health, happiness: now.happiness, knowledge: now.knowledge, relationships: now.relationships }))
        if (v > 100 || v < 0) hit('STAT_OUT_OF_BOUNDS', { seed, field: k, v, age: now.age });
      prev = diffTransitions(l, prev, ctx);
    }
  } catch (e) { hit('ENGINE_THROW_advance', { seed, age: l.age, err: String(e).slice(0, 150) }); continue; }

  /* ---- post-life ---- */
  const dAge = l.death?.age ?? l.age, dYear = l.death?.year ?? l.year;
  if (dYear !== l.birthYear + dAge) hit('DEATH_YEAR_AGE_MISMATCH', { seed, dYear, dAge, birthYear: l.birthYear });
  if (dAge > 120) hit('DEATH_AGE_OVER_120', { seed, dAge });
  push(`deathAge@${region}`, dAge);
  push(`deathAge@${world}@by${birthYear}`, dAge);
  if (world === 'past' && birthYear <= 1975) push(`deathAge@cohortPre1975`, dAge);
  if (world === 'now') push('deathAge@cohort2026', dAge);
  const cause = T(l.death?.cause);
  if (dAge < 12 && /癌症|衰老|脑血管/.test(cause)) hit('SENESCENT_CAUSE_IN_CHILDHOOD', { seed, dAge, cause });
  if (dAge >= 65 && /先天性|严重感染/.test(cause)) hit('PAEDIATRIC_CAUSE_IN_OLD_AGE', { seed, dAge, cause });

  for (const [who, person] of [['mother', l.family.mother], ['father', l.family.father], ['partner', l.family.partner]]) {
    if (!person) continue;
    const attained = person.alive ? null : person.age;
    push(`${who}DeathAge@cohort${Math.floor(birthYear / 10) * 10}`, attained);
    if (!person.alive && attained != null && attained < 25) hit(`PARENT_DIED_BEFORE_${who.toUpperCase()}_25`, { seed, attained, myAge: dAge });
    if (!person.alive && attained != null && who !== 'partner' && attained > l.age + 5 && dAge > 20) void 0;
  }
  for (const c of l.family.children) { if (!c.alive && c.age < 5) hit('OWN_CHILD_DIED_BEFORE_5', { seed, age: c.age, birthYear }); push('ownChildMaxAge', c.alive ? null : c.age); }
  if (l.family.children.length && l.family.partner?.married && l.family.partner.yearsTogether != null) {
    const firstBirth = l.years.find((y) => y.children > 0);
    if (firstBirth && l.family.partner.married && firstBirth.age < l.age - l.family.partner.yearsTogether) hit('CHILD_BORN_BEFORE_MEETING_PARTNER', { seed });
  }

  /* economics */
  const nw = E.netWorth(l), ti = l.profile.typicalIncome || 1;
  push(`netWorthOverIncome@${region}`, nw / ti);
  push('netWorth@final', nw);
  push('earnings@final', l.totals.earned);
  push('spend@final', l.totals.spent);
  push('houseAsset', l.assets.house);
  if (l.assets.house) push('houseOverIncome', l.assets.house / ti);
  if (nw / ti > 12) hit('FINAL_NETWORTH_GT_12X_ANNUAL_INCOME', { seed, netWorth: Math.round(nw), typicalIncome: Math.round(ti), ratio: +(nw / ti).toFixed(1), earned: Math.round(l.totals.earned), spent: Math.round(l.totals.spent), workYears, savingsRate: +((l.totals.earned - l.totals.spent) / Math.max(1, l.totals.earned)).toFixed(2) });
  if (l.totals.earned > 0 && Math.abs(l.totals.earned - l.totals.spent - (nw + (l.assets.house ?? 0) * 0)) > Math.max(50000, l.totals.earned * 0.5))
    hit('CASHFLOW_DOES_NOT_RECONCILE_TO_NETWORTH', { seed, earned: Math.round(l.totals.earned), spent: Math.round(l.totals.spent), netWorth: Math.round(nw), debt: Math.round(l.debt) });
  if (nw < -200000) hit('DEEP_NEGATIVE_NETWORTH', { seed, nw: Math.round(nw), debt: Math.round(l.debt) });
  if (l.income > 0 && dAge >= 90 && !l.job) push('pensionIncomeAt90', l.income);
  if (l.job && dAge >= 75) hit('STILL_EMPLOYED_AT_75', { seed, age: dAge, jobId: l.job.id });
  if (l.pension && l.lastJob?.salary) { const rr = l.pension / l.lastJob.salary; push('pensionReplacement', rr); if (rr > 1) hit('PENSION_EXCEEDS_FINAL_SALARY', { seed, rr: +rr.toFixed(2) }); }
  if ((l.totals.work ?? 0) <= 0 && l.totals.earned > 300000) hit('HIGH_EARNINGS_WITH_ZERO_CAREER_FOCUS', { seed, earned: Math.round(l.totals.earned), totalsWork: l.totals.work, workYears, focusSet });
  push('workFocusYears', workYears);

  /* history consistency */
  let emptyEffectEntries = 0, histEntries = 0;
  let lastAgeSeen = 1e9;
  for (const entry of l.log) {
    if (entry.age > lastAgeSeen) { hit('LOG_NOT_NEWEST_FIRST_ORDERED', { seed, from: lastAgeSeen, to: entry.age }); break; }
    lastAgeSeen = entry.age;
    const id = entry.historicalEventId;
    if (!id) continue;
    histEntries++;
    const ev = HE_BY_ID.get(id);
    if (!ev) { hit('UNKNOWN_HISTORICAL_EVENT_ID', { seed, id }); continue; }
    seenHistory.set(id, (seenHistory.get(id) ?? 0) + 1);
    const shownYear = Number(entry.historicalDate?.slice?.(0, 4) ?? ev.year);
    if (entry.year < shownYear) hit('HISTORY_EVENT_APPLIED_BEFORE_IT_HAPPENED', { seed, id, eventYear: shownYear, appliedYear: entry.year, age: entry.age, birthYear });
    else if (entry.year - shownYear > 3) hit('HISTORY_EVENT_APPLIED_TOO_LATE', { seed, id, eventYear: shownYear, appliedYear: entry.year, lag: entry.year - shownYear, birthYear });
    if (Array.isArray(ev.regions) && ev.regions.length && !ev.regions.includes(region)) hit('HISTORY_EVENT_WRONG_REGION', { seed, id, region, eventRegions: ev.regions.join('/') });
    if (!ev.effects || !Object.keys(ev.effects).length) hit('HISTORY_EVENT_HAS_NO_MECHANICAL_EFFECT', { seed, id });
    else emptyEffectEntries++;
    if (entry.effects && Object.keys(entry.effects).length === 0) bump('historyEntryLoggedWithEmptyEffects');
    if (!ev.modelNote) hit('HISTORY_EVENT_FACT_WITHOUT_MODEL_NOTE', { seed, id });
    if (ev.sourceIds && !ev.sourceIds.length) hit('HISTORY_EVENT_WITHOUT_SOURCE', { seed, id });
    if (T(entry.text).includes('undefined') || T(entry.text).includes('NaN')) hit('BROKEN_HISTORY_LOG_TEXT', { seed, id, text: T(entry.text).slice(0, 90) });
  }
  push('historyEntriesPerLife', histEntries);
  push('historyEntriesWithEffectPerLife', emptyEffectEntries);

  /* education vs historical admission route */
  const gaokaoYear = birthYear + 18;
  if (gaokaoYear >= 1966 && gaokaoYear <= 1969 && (EDUCATION_RANK[eduAgeAt.university] != null || l.education === 'university' && eduAgeAt.university <= 22))
    hit('UNIVERSITY_ADMISSION_DURING_SUSPENDED_GAOKAO', { seed, birthYear, gaokaoYear, universityAge: eduAgeAt.university ?? null });
  if (eduAgeAt.university != null && eduAgeAt.university < 16) hit('UNIVERSITY_BEFORE_16', { seed, age: eduAgeAt.university });
  if (eduAgeAt.university != null && eduAgeAt.university > 30) hit('UNIVERSITY_ENTRY_AFTER_30', { seed, age: eduAgeAt.university });
  if (l.education === 'doctorate') bump('doctorates');
  if (l.education === 'university' || l.education === 'associate') bump('higherEd');

  /* tuition real-terms contradiction */
  if (eduAgeAt.university != null && birthYear + eduAgeAt.university < 1985 && region === 'mainland') {
    const t = tuitionModel({ year: birthYear + eduAgeAt.university, level: 'university', ownership: 'public', region, urban: l.urban });
    push(`tuitionPre1985@${birthYear + eduAgeAt.university}`, t.tuition);
    push(`tuitionOverIncomePre1985@${birthYear + eduAgeAt.university}`, t.tuition / (l.income || ti));
    hit('PRE1985_TUITION_NOMINAL_VS_CONSTANT_INCOME', { seed, year: birthYear + eduAgeAt.university, tuition: t.tuition, incomeAtTime: Math.round(l.income), typicalIncome: Math.round(ti), note: 'see tuitionModel scale' }, '');
  }

  if (l.pending) hit('UNRESOLVED_DECISION_AT_DEATH', { seed, action: l.pending.action });
  if ((l.pendingQueue?.length ?? 0) > 2) hit('PENDING_QUEUE_OVERFLOW', { seed, len: l.pendingQueue.length });
  if (T(l.log[0]?.text).includes('undefined') || T(l.log[0]?.text).includes('NaN')) hit('BROKEN_LOG_TEXT', { seed, text: T(l.log[0]?.text).slice(0, 90) });
  push('deathsByGentleOff', 1);
}

/* ---------------- static content audit ---------------- */
const weightTiers = [...new Set(locations.map((l) => l.weight))].sort((a, b) => b - a);
const prosperityByRegion = {};
for (const l of locations) (prosperityByRegion[l.region] ??= []).push(l.prosperity);
const staticAudit = {
  locationsTotal: locations.length,
  locationsNeverBorn: locations.length - seenBirth.size,
  coveragePctBirthplaces: +((seenBirth.size / locations.length) * 100).toFixed(1),
  distinctBirthWeights: weightTiers.length,
  weightTiers: weightTiers.map((w) => +w.toFixed(2)),
  locationsPerWeightTier: weightTiers.map((w) => locations.filter((l) => l.weight === w).length),
  populationRecordedAnywhere: locations.filter((l) => l.population != null).length,
  weightKindSimulated: locations.filter((l) => l.weightKind === 'simulated').length,
  prosperityKindSimulated: locations.filter((l) => l.prosperityKind === 'simulated').length,
  prosperityByRegion: Object.fromEntries(Object.entries(prosperityByRegion).map(([k, v]) => [k, { n: v.length, min: Math.min(...v), max: Math.max ? Math.max(...v) : Math.max(...v) }])),
  historyEventsTotal: HISTORY_EVENTS.length,
  historyEventsNeverFired: HISTORY_EVENTS.filter((e) => !seenHistory.has(e.id)).map((e) => `${e.id}(${e.year})`),
  historyEventsWithNoEffectsField: HISTORY_EVENTS.filter((e) => !e.effects || !Object.keys(e.effects).length).map((e) => `${e.id}(${e.year})`),
  historyEventsWithoutSource: HISTORY_EVENTS.filter((e) => !e.sourceIds?.length).map((e) => e.id),
  historyEventsWithoutModelNote: HISTORY_EVENTS.filter((e) => !e.modelNote).map((e) => e.id),
  historyEventsRegionalScope: HISTORY_EVENTS.filter((e) => e.scope !== 'national').length,
  culturalTotal: CULTURAL_EVENTS.length,
  culturalNeverFired: CULTURAL_EVENTS.filter((e) => !seenCultural.has(e.id)).map((e) => e.id),
  jobsTotal: CHINA_JOBS.length,
  jobsNeverTaken: CHINA_JOBS.filter((j) => !seenJob.has(j.id)).map((j) => `${j.id}(min${j.minYear})`),
  jobsFlaggedIllustrative: CHINA_JOBS.filter((j) => j.modelKind?.includes('illustrative')).length,
  actionsTotal: seenAction.size,
};

const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
const agg = {};
for (const k of Object.keys(S)) {
  const v = S[k];
  if (!Array.isArray?.(v) && !Array.isArray(v)) { agg[k] = v; continue; }
  const a = v.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  agg[k] = { n: a.length, mean: a.length ? +(a.reduce((p, c) => p + c, 0) / a.length).toFixed(2) : null, min: a[0] ?? null, p25: q(a, .25), p50: q(a, .5), p75: q(a, .75), p95: q(a, .95), max: a[a.length - 1] ?? null };
}

const out = {
  meta: { lives: N, seconds: +((Date.now() - t0) / 1000).toFixed(1), engineVersion: E.ENGINE_VERSION, generatedAt: new Date().toISOString(), note: 'engine driven headlessly; autoChoose for decisions; focus=work when employed' },
  anomalies: Object.fromEntries(Object.entries(A).sort((a, b) => b[1].count - a[1].count).map(([k, v]) => [k, { count: v.count, per1000Lives: +((v.count / N) * 1000).toFixed(1), note: v.note, samples: v.samples }])),
  coverage: staticAudit,
  aggregates: agg,
};
writeFileSync('audit-results.json', JSON.stringify(out, null, 2));
console.log ??= console.info;
console.log(JSON.stringify(out.meta));
console.log('\n=== ANOMALIES (count | per 1000 lives) ===');
for (const [k, v] of Object.entries(out.anomalies)) console.log(`${String(v.count).padStart(7)} | ${String(v.per1000Lives).padStart(7)} | ${k}`);
