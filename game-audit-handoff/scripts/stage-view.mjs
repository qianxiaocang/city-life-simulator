/* stage-view.mjs — pretty-print a stage-collect2 output */
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.argv[2] ?? 'out/stage-engine.json', 'utf8'));
const line = (k, v) => console.log(k.padEnd(30), `n=${String(v.n).padEnd(6)} min=${String(v.min).padEnd(6)} p25=${String(v.p25).padEnd(7)} p50=${String(v.p50).padEnd(7)} p75=${String(v.p75).padEnd(7)} p95=${String(v.p95).padEnd(7)} max=${v.max}`);
const P = (re) => { for (const k of Object.keys(s.dist).sort()) if (re.test(k)) line(k, s.dist[k]); };
console.log('META', JSON.stringify(s.meta));
const groups = [
  ['EDUCATION ATTAINMENT AGE', /^eduAt/],
  ['MARRIAGE', /^marriageAge/],
  ['FERTILITY', /^firstChildAge|^childAge|^kids/],
  ['FIRST JOB / JOBS / MOVES', /^firstJobAge|^jobStarts|^moves/],
  ['RETIREMENT', /retired|ruleRetire|contribYears/],
  ['DEATH AGE', /^deathAge/],
  ['INCOME / WEALTH', /peakIncome|Anchor|NetWorth|nwOver/],
  ['PROFILE ANCHORS', /profileLifeExp|lifeExpProfile|urbanOrigin/],
  ['INCOME AT 20-24 BY CALENDAR DECADE', /^inc20to24/],
  ['URBAN AT 20-24 BY CALENDAR DECADE', /^urban20to24/],
];
for (const [title, re] of groups) { console.log('\n=== ' + title + ' ==='); P(re); }
console.log('\n=== RATES % ==='); console.log = console.log; console.log(JSON.stringify(s.ratesPct, null, 1));
console.log('\n=== DEATHS BY AGE BAND ==='); console.log(JSON.stringify(s.deathsByBand, null, 1));
console.log('\n=== CAUSE SHARE % BY BAND ===');
for (const [bag, m] of Object.entries ? Object.entries(s.causeSharePct) : Object.entries(s.causeSharePct))
  console.log(bag, JSON.stringify(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)));
console.log('\n=== N BY DECADE (age 20-24) ===', JSON.stringify(s.deathsByDecade20to24));
