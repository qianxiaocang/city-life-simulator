import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const f = process.argv[3];
const re = new RegExp(f);
const out = {};
for (const [k, v] of Object.entries(s.dist)) if (re.test(k)) out[k] = v;
console.log('MATCH', JSON.stringify(out, null, 1).slice(0, 1600));
console.log('COUNTERS', JSON.stringify(s.counters));
console.log('RATES', JSON.stringify(s.ratesPct));
