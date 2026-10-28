/* marriage-true.mjs — 用引擎**自己的**婚姻字段重测（不猜字段名）
 *   l.marriageAge / l.flags.marriageCount / l.family.partner.{married,marriedYear,alive,age}
 * 输出：已婚率、初婚年龄、再婚率与再婚年龄、成婚当年是否达到引擎自己的法定婚龄
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
await import(resolve(process.env.AUDIT_ENGINE || './shipped/engine-shipped.mjs'));
const E = globalThis.__ENGINE_SHIPPED__;
const N = +(process.argv[2] ?? 6000);
const OUT = process.argv[3] ?? 'out/marriage-true.json';
const first = [], rewor = [], mc = {}, below = [], partnerWidow = [];
const dec = (y) => Math.floor(y / 10) * 10;
const byDec = {}, byDecN = {};
let lives = 0, marriedN = 0, everMarriedN = 0, datingN = 0;
for (let i = 0; i < N; i++) {
  const world = i % 3 === 2 ? 'now' : 'past';
  const birthYear = world === 'now' ? 2026 : 1949 + ((i * 7) % 67);
  const l = E.createLife({ locations: E.locations, seed: 'st' + i, world, birthYear, paceMinutes: 30 });
  E.startLife(l);
  let g = 0; while (l.phase === 'life' && g++ < 400) { if (l.pending) E.autoChoose(l); else E.advanceYear(l); }
  lives++;
  const k = String(l.flags?.marriageCount ?? 'none');
  mc[k] = (mc[k] ?? 0) + 1;
  const p = l.family?.partner;
  if (p) datingN++;
  if (p?.married && p.alive !== false) marriedN++;
  const history = l.marriageHistory?.length
    ? l.marriageHistory.map(h => ({ year:h.year, age:h.age ?? h.year-l.birthYear, type:h.type }))
    : +(k) > 0 && p?.marriedYear
      ? [{year:p.marriedYear,age:l.marriageAge ?? p.marriedYear-l.birthYear,type:'unknown'}] : [];
  if (history.length) {
    everMarriedN++;
    first.push(history[0].age);
    const d=dec(l.birthYear);(byDec[d] ??= []).push(history[0].age);byDecN[d]=(byDecN[d]??0)+1;
    for(const h of history.slice(1)) rewor.push(h.age);
    for(const h of history) {
      const locId=l.years?.find(y=>y.year===h.year)?.locationId;
      const region=E.locations.find(x=>x.id===locId)?.region ?? l.location?.region ?? 'mainland';
      const req=E.legalMarriageAge(l.sex,region,h.year) ?? 18;
      if(h.age<req)below.push({seed:'st'+i,sex:l.sex,marriedYear:h.year,age:h.age,req,region,type:h.type,marriageCount:k});
    }
  }
  if (p && p.alive === false && +k >= 2) partnerWidow.push({ seed: 'st' + i, remarried: true });
}
const st = (a) => { const b = a.slice().sort((x, y) => x - y); const q = (p) => b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : null; return { n: b.length, min: b[0], p25: q(.25), p50: q(.5), p75: q(.75), p95: q(.95), max: b.at(-1) }; };
writeFileSync(resolve(OUT), JSON.stringify({
  lives, everPartner: datingN, everPartnerPct: +(datingN / lives * 100).toFixed(2),
  married: marriedN, marriedPct: +(marriedN / lives * 100).toFixed(2),
  everMarried:everMarriedN,everMarriedPct:+(everMarriedN/lives*100).toFixed(2),
  marriageCountHistogram: mc,
  firstMarriageAge: st(first), remarriageAge_inclFirst: st(rewor),
  belowOwnLegalAgeAtMarriage: below.length, belowSamples: below.slice(0, 10),
  remarriedAfterPartnerDeath_n: partnerWidow.length,
  firstMarriageAgeByDecade: Object.fromEntries(Object.entries(byDec).sort((a,b)=>a[0]-b[0]).map(([k2,v])=>[k2, st(v)])),
}, null, 1));
console.log('wrote '+OUT);
