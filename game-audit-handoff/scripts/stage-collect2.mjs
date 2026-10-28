/* stage-collect2.mjs — engine-side distributions for the LIFE-STAGE axis (v2, clean).
 *
 * Reads only the shipped engine's own structures:
 *   l.years[]  = engine's own year-by-year progression rows (age, year, education, job,
 *                income, netWorth, locationId, health/happiness/knowledge/relationships, children)
 *   l.family   = partner{sinceYear,birthYear} + children[]{birthYear,sex}
 *   l.death    = {age, year, cause}
 *   l.profile  = {lifeExpectancy, typicalIncome, childMortality, ...}
 * Nothing in the game bundle is modified. Deterministic: seeds st<i>.
 *
 * usage:  node stage-collect2.mjs [N] [out.json]
 *         node stage-collect2.mjs --trace <seed> [world] [birthYear]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

await import(resolve(process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs'));
const E = globalThis.__ENGINE_SHIPPED__;
const T = (v) => (typeof v === 'string' ? v : v?.zhCN ?? v?.en ?? '');

function live(seed, world, birthYear) {
  const l = E.createLife({ locations: E.locations, seed, world, birthYear, paceMinutes: 30 });
  E.startLife(l);
  l.__birthProfile = structuredClone(l.profile);
  let g = 0, retireAge = l.retired ? l.age : undefined, wasRetired=l.retired;
  while (l.phase === 'life' && g++ < 400) { if (l.pending) E.autoChoose(l); else E.advanceYear(l); if (l.retired && !wasRetired) retireAge = l.age; wasRetired=l.retired; }
  l.__retireAge = retireAge;
  return l;
}

const argv = process.argv.slice(2);
if (argv.includes('--trace')) {
  const at = argv.indexOf('--trace');
  const l = live(argv[at + 1], argv[at + 2] ?? 'past', +(argv[at + 3] ?? 1955));
  console.log(JSON.stringify({
    seed: l.seed, world: l.world, birthYear: l.birthYear, sex: l.sex, name: T(l.name), urbanAtBirth: l.urban,
    origin: `${T(l.born?.province)} / ${T(l.born?.name)} / ${T(l.born?.level)}`, classRank: l.classRank,
    profileAtBirth: l.__birthProfile, profileAtEnd: l.profile, died: { age: l.death?.age, year: l.death?.year, cause: T(l.death?.cause), place: T(l.death?.location?.name) },
    partner: l.family?.partner ? { name: T(l.family.partner.name), sinceYear: l.family.partner.sinceYear, partnerBirthYear: l.family.partner.birthYear } : null,
    children: (l.family?.children ?? []).map((c) => ({ name: T(c.name), sex: c.sex, birthYear: c.birthYear })),
    retired: l.retired, retirementRule: l.retirementRule ?? null,
    contributionYears: l.contributionYears, educationNow: l.education,
    yearly: (l.years ?? []).map((y) => ({ age: y.age, year: y.year, edu: y.education, job: y.job, income: Math.round(y.income ?? 0), nw: Math.round(y.netWorth ?? 0), loc: y.locationId, h: Math.round(y.health ?? 0), hp: Math.round(y.happiness ?? 0), k: Math.round(y.knowledge ?? 0), r: Math.round(y.relationships ?? 0), kids: y.children })),
    logSample: (l.log ?? []).slice(0, 400).map((e) => ({ age: e.age, year: e.year, type: e.type, text: T(e.text) })),
  }, null, 1));
  process.exit(0);
}

const N = +(argv[0] ?? 40000);
const OUT = argv[1] ?? argv[0] ?? 'out/stage-engine.json';
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))]; };
const st = (a) => a.length ? { n: a.length, min: Math.min(...a), p25: q(a, .25), p50: q(a, .5), p75: q(a, .75), p95: q(a, .95), max: Math.max(...a) } : { n: 0 };
const pct = (n, d) => d ? +(n / d * 100).toFixed(2) : null;
const dec = (y) => Math.floor(y / 10) * 10;
const A = {}, CNT = {};
const push = (o, k, v) => { if (Number.isFinite(v)) (o[k] ??= []).push(v); };
const bump = (k) => { CNT[k] = (CNT[k] ?? 0) + 1; };

let lives = 0, deaths = 0;
for (let i = 0; i < N; i++) {
  const world = i % 3 === 2 ? 'now' : 'past';
  const birthYear = world === 'now' ? 2026 : 1949 + ((i * 7) % 67);
  let l;
  try { l = live('st' + i, world, birthYear); } catch { bump('engineThrow'); continue; }
  lives++;
  const sex = l.sex === 'female' ? 'F' : 'M';
  const rows = l.years ?? [];
  const K = (nm) => `${nm}|${world}|${sex}`;
  const D = (nm, x) => `${nm}|${world}|${sex}|${x}`;

  const attJobFlag = {}; const eduFirst = {}; let lastJob = null, jobStarts = 0, firstJobAge = null, peakIncome = 0, retireAge = null;
  let lastLoc = null, moves = 0, marriedNow = false, prevMarried = false, marries = 0, firstMarriageAge = null;
  for (const y of rows) {
    if (y.education && !(y.education in eduFirst)) { eduFirst[y.education] = y.age; attJobFlag[y.education] = !!y.job; }
    if (y.job && y.job !== lastJob) { jobStarts++; if (firstJobAge == null) { firstJobAge = y.age; push(A, K('firstJobAge'), y.age); } }
    if (y.job) lastJob = y.job;
    if ((y.income ?? 0) > peakIncome) peakIncome = y.income;
    if (lastLoc && y.locationId && y.locationId !== lastLoc) moves++;
    if (y.locationId) lastLoc = y.locationId;
  }
  for (const [lv, age] of Object.entries(eduFirst)) push(A, D('eduAt', lv), age);
  if ((l.death?.age ?? l.age) >= 18) {
    const decade=dec(birthYear);
    push(A,`tertiaryAttainedByDec|${decade}`,['associate','university','masters','doctorate'].some(x=>x in eduFirst)?1:0);
    push(A,`juniorAttainedByDec|${decade}`,['junior','high','vocational','associate','university','masters','doctorate'].some(x=>x in eduFirst)?1:0);
  }
  const topAt = Math.max(...['doctorate', 'masters', 'postgraduate', 'university', 'associate', 'vocational', 'high', 'junior', 'primary'].map((lv) => (lv in eduFirst ? eduFirst[lv] : -1)));
  if (firstJobAge != null && topAt > firstJobAge) { push(A, K('jobBeforeDiplomaGap'), topAt - firstJobAge); bump(`jobBeforeDiploma|${world}`); }
  push(A, K('jobStarts'), jobStarts);
  /* In-service study (成人教育/自考/在职研) is normal in China: a diploma earned while working
     is NOT a timeline defect. Only a full-time diploma at an implausible age is. Use the engine's
     own yearly row (job != null) to tell them apart. */
  const topLv = ['doctorate', 'masters', 'postgraduate', 'university', 'associate', 'vocational', 'high', 'junior', 'primary'].find((lv) => lv in eduFirst) ?? null;
  if (['university', 'associate', 'masters', 'postgraduate', 'doctorate'].includes(topLv) && topAt > 24) {
    if (attJobFlag[topLv]) { push(A, K('onJobLateDiplomaAge'), topAt); bump('onJobLateDiploma|' + world); }
    else { push(A, K('fulltimeLateDiplomaAge'), topAt); bump('fulltimeLateDiploma|' + world); }
  }
  if (topLv === 'primary' || topLv === 'junior' || topLv === 'preschool' || topLv == null) bump('noTertiary|' + world);
  bump('allLives|' + world);
  push(A, K('moves'), moves);

  /* marriage / children straight from engine family records */
  const p = l.family?.partner;
  if (p?.married || (l.flags?.marriageCount ?? 0) > 0) {
    marries = 1;
    firstMarriageAge = l.marriageAge ?? (p?.marriedYear == null ? null : p.marriedYear - l.birthYear);
    if (firstMarriageAge != null) push(A, K('marriageAge'), firstMarriageAge);
  }
  const kids = l.family?.children ?? [];
  push(A, K('kids'), kids.length);
  push(A, `kidsByDec|${dec(birthYear)}`, kids.length);
  push(A, `urbanOriginByDec|${dec(birthYear)}`, l.urban === true ? 1 : 0);
  if (firstMarriageAge != null) push(A, `marriageAgeByDec|${dec(birthYear)}`, firstMarriageAge);
  if (kids.length) push(A, `firstChildAgeByDec|${dec(birthYear)}`, kids[0].birthYear - l.birthYear);
  kids.forEach((c, idx) => push(A, D('childAge', 'n' + (idx + 1)), c.birthYear - l.birthYear));
  if (kids.length) push(A, K('firstChildAge'), kids[0].birthYear - l.birthYear);
  push(A, K('married'), marries);

  if (l.retired) {
    push(A, K('retireAge'), l.__retireAge ?? l.age);
    const rr = l.retirementRule;
    if (rr?.ageMonths != null) {
      push(A, K('ruleRetireAge'), rr.ageMonths / 12);
      push(A, K('retiredLateBy'), (l.__retireAge ?? l.age) - rr.ageMonths / 12);
      if (l.location?.region === 'mainland' && rr.statutory) {
        push(A, K('statutoryRetireAge'), l.__retireAge ?? l.age);
        push(A, K('statutoryRuleAge'), rr.ageMonths / 12);
        if (sex === 'F') bump(`retireCategory|${rr.category ?? 'missing'}`);
        const actual=l.retirementEffectiveDate;
        const actualMonth=actual?actual.year*12+actual.month:((l.__retireAge??l.age)+l.birthYear)*12+l.birthMonth;
        const legalMonth=rr.retirementYear*12+rr.retirementMonth;
        if (actualMonth-legalMonth > (rr.retirementYear>=2025?36:0)) bump(`retireBeyondRule|${sex}`);
        if (sex === 'M' && rr.retirementYear < 2025 && actualMonth!==legalMonth) bump('pre2025MaleRetireNot60');
        if (firstJobAge != null && l.contributionYears > Math.max(0,(l.__retireAge ?? l.age)-Math.max(16,firstJobAge))) bump('contribBeyondPhysicalBound');
      }
    }
  }
  if (l.death) {
    deaths++;
    const band = l.death.age < 1 ? 'lt1' : l.death.age < 5 ? '1-4' : l.death.age < 15 ? '5-14' : l.death.age < 30 ? '15-29' : l.death.age < 45 ? '30-44' : l.death.age < 60 ? '45-59' : l.death.age < 75 ? '60-74' : '75p';
    const cause = T(l.death.cause) || 'unknown';
    bump(`cause|${world}|${band}|${cause}`);
    bump(`bandN|${world}|${band}`);
    const calendarEra=l.death.year<2000?'pre2000':l.death.year<2050?'2000-2049':'2050plus';
    bump(`causeCalendar|${calendarEra}|${band}|${cause}`);
    bump(`bandCalendarN|${calendarEra}|${band}`);
    push(A, 'deathAge|ALL|X', l.death.age);
    push(A, `deathAge|${world}|${sex}`, l.death.age);
    push(A, D('deathAge_dec' + dec(birthYear), 'x'), l.death.age);
    push(A, `deathAge|${world}|_`, l.death.age);
  }
  const last = rows.at(-1) ?? {};
  const anchor = l.profile?.typicalIncome ?? 0;
  push(A, K('peakIncome2025'), peakIncome);
  push(A, `peakIncomeByDec${dec(birthYear)}`, peakIncome);
  push(A, K('peakOverAnchor'), anchor > 0 ? peakIncome / anchor : NaN);
  push(A, K('endNetWorth'), last.netWorth ?? 0);
  push(A, K('nwOverPeak'), peakIncome > 0 ? (last.netWorth ?? 0) / peakIncome : NaN);
  push(A, K('profileLifeExp'), l.__birthProfile?.lifeExpectancy);
  push(A, K('urbanOrigin'), l.urban === true ? 1 : 0);
  push(A, K('contribYears'), l.contributionYears ?? 0);
  push(A, `lifeExpProfile|${world}|_`, l.__birthProfile?.lifeExpectancy);
  /* calendar-decade facts: income and urban status while aged 20-24 */
  for (const y of rows) if (y.age >= 20 && y.age <= 24) {
    push(A, `inc20to24|dec${dec(y.year)}`, y.income ?? 0);
    const lc = E.locations?.find?.((x) => x.id === y.locationId);
    push(A, `urban20to24|dec${dec(y.year)}`, lc?.urban === true ? 1 : 0);
    bump(`decN|${dec(y.year)}`);
    break;
  }
  push(A, `nwAtDeath|dec${dec(birthYear)}`, last.netWorth ?? 0);
}

const out = {
  meta: {
    engine: process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs', sha: globalThis.__AUDIT_ENGINE_LABEL__ || 'f703243ce9662d66', lives, deaths,
    moneyBasis: 'CNY-2025-model fixed purchasing power (engine self-declared)',
    seedFamily: 'st<i>', cohort: 'past: birthYear 1949+7k cycle to 2015 (2/3 of runs); now: 2026 (1/3)',
    generatedAt: new Date().toISOString(),
  },
  dist: Object.fromEntries(Object.entries(A).filter(([, v]) => v.length).map(([k, v]) => [k, st(v)])),
};
out.means = Object.fromEntries ? null : Object.fromArray;
out.means = Object.fromEntries(Object.entries(A).filter(([, v]) => v.length > 8).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)]));
out.ratesPct = {};
for (const [k, v] of Object.entries(A)) if (k.endsWith('|married') || k.endsWith('|urbanOrigin') || k.endsWith('|urban20to24|') || k.startsWith('urban20to24|')) out.ratesPct[k] = pct(v.filter((x) => x === 1).length, v.length);
out.causeSharePct = {};
for (const [k, v] of Object.entries(CNT)) {
  const m = /^cause\|([^|]+)\|([^|]+)\|(.+)$/.exec(k); if (!m) continue;
  const bag = `${m[1]}|${m[2]}`;
  out.causeSharePct[bag] ??= {};
  out.causeSharePct[bag][m[3]] = pct(v, CNT[`bandN|${m[1]}|${m[2]}`]);
}
out.causeShareByDeathEraPct={};
for(const [k,v] of Object.entries(CNT)){
  const m=/^causeCalendar\|([^|]+)\|([^|]+)\|(.+)$/.exec(k);if(!m)continue;
  const bag=`${m[1]}|${m[2]}`;out.causeShareByDeathEraPct[bag]??={};
  out.causeShareByDeathEraPct[bag][m[3]]=pct(v,CNT[`bandCalendarN|${m[1]}|${m[2]}`]);
}
out.counters = Object.fromEntries(Object.entries(CNT).filter(([k]) => !k.startsWith('cause|') && !k.startsWith('bandN|') && !k.startsWith('decN|') && !k.startsWith('causeCalendar|') && !k.startsWith('bandCalendarN|')));
out.deathsByBand = Object.fromEntries(Object.entries(CNT).filter(([k]) => k.startsWith('bandN|')).map(([k, v]) => [k.slice(6), v]));
out.deathsByDecade20to24 = Object.fromEntries(Object.entries(CNT).filter(([k]) => k.startsWith('decN|')).map(([k, v]) => [k.slice(5), v]));
writeFileSync(resolve(OUT), JSON.stringify(out, null, 1), 'utf8');
console.log(`wrote ${OUT} · lives=${lives} deaths=${deaths} distKeys=${Object.keys(out.dist).length}`);
