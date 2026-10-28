/* marriage-at-appear.mjs — 在"伴侣出现的那一年"就地读取引擎自己的量
 * 记录：l.age / l.year / l.location.region / partner.age / 引擎 legalMarriageAge(位置参数)
 * 目的：分辨「未达法定婚龄即结婚」还是「sinceYear 被回填（伴侣出现年份 ≠ 记录成婚年份）」
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
await import(resolve(process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs'));
const E = globalThis.__ENGINE_SHIPPED__;
const OUT = process.argv[3] ?? 'out/marriage-at-appear.json';
const N = +(process.argv[2] ?? 4000);
const rec = [];
let belowAtAppear = 0, firstSeenMismatch = 0, regions = {}, ap = [];
for (let i = 0; i < N; i++) {
  const world = i % 3 === 2 ? 'now' : 'past';
  const birthYear = world === 'now' ? 2026 : 1949 + ((i * 7) % 67);
  const l = E.createLife({ locations: E.locations, seed: 'st' + i, world, birthYear, paceMinutes: 30 });
  E.startLife(l);
  let g = 0, seen = false;
  while (l.phase === 'life' && g++ < 400) {
    if (l.pending) E.autoChoose(l); else E.advanceYear(l);
    if (!seen && l.family?.partner) {
      seen = true;
      const region = l.location?.region ?? 'mainland';
      regions[region] = (regions[region] ?? 0) + 1;
      const selfReq = E.legalMarriageAge(l.sex, region, l.year) ?? 18;
      const parReq = E.legalMarriageAge(l.sex === 'male' ? 'female' : 'male', region, l.year) ?? 18;
      const pal = l.family.partner.age;
      const below = l.age < selfReq || (typeof pal === 'number' && pal < parReq);
      if (below) belowAtAppear++;
      const since = l.family.partner.sinceYear;
      if (since !== l.year) firstSeenMismatch++;
      ap.push(l.age - selfReq);
      if (rec.length < 12 && below) rec.push({ seed: 'st' + i, world, birthYear, sex: l.sex, age: l.age, year: l.year, region, selfReq, partnerAge: pal, parReq, sinceYear: since, marriageCount: l.flags?.marriageCount ?? null });
    }
  }
}
ap.sort((a, b) => a - b);
const q = (p) => ap.length ? ap[Math.min(ap.length - 1, Math.floor(ap.length * p))] : null;
writeFileSync(resolve(OUT), JSON.stringify({
  N, partnersSeen: ap.length, belowLegalAtAppearance: belowAtAppear,
  belowLegalPct: ap.length ? +(belowAtAppear / ap.length * 100).toFixed(3) : null,
  sinceYearNotEqualAppearanceYear: firstSeenMismatch,
  ageMinusLegalAge: { min: ap[0], p5: q(.05), p50: q(.5), p95: q(.95), max: ap.at(-1) },
  regions, samplesBelow: rec,
}, null, 1));
console.log('wrote '+OUT);
