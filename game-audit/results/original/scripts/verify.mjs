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
const E = await import(u('engine.js'));
const { locations } = await import(u('data/locations.js'));
const { legalEmploymentAge, canStartEmployment, retirementRule, pensionMinimumYears, legalMarriageAge } = await import(u('data/china-law.js'));
let hired=0, retired=0, under16=0, minPensionBad=0, retireGapBad=0, marrNull=0, marrChecked=0, marrBad=0;
const firstJob=[],retAge=[];
for(let i=0;i<4000;i++){
  const l=E.createLife({locations,seed:'v'+i,world:'past',birthYear:1990+(i%20)});E.startLife(l);
  let g=0, pj=false, pr=false;
  while(l.phase==='life'&&g++<200){
    if(l.pending)E.autoChoose(l);
    else{ if(l.job&&E.getFocusOptions(l).some(f=>f.id==='work'))E.setFocus(l,'work'); E.advanceYear(l); }
    if(l.job&&!pj){pj=true;hired++;firstJob.push(l.age);const la=legalEmploymentAge(l.location,l.year);if(la&&l.age<la)under16++;}
    if(!l.job&&pj&&!pr&&(l.flags?.retired||l.phase==='life'&&l.age>=55)){ if(l.flags?.retired){pr=true;retired++;retAge.push(l.age);} }
    if(l.phase==='dead')break;
  }
  if(l.flags?.married&&l.marriageAge){marrChecked++;const m=legalMarriageAge(l.location,l.marriageAge?l.birthYear+l.marriageAge:l.year);if(m===null)marrNull++;else if(l.marriageAge<m)marrBad++;}
  const p=l.pension||l.flags?.pension;
  if(p?.active||p?.started){ const need=pensionMinimumYears(l.location,l.year); if(need&&(p.years??l.flags?.pensionYears)!==undefined&&(p.years??l.flags?.pensionYears)<need)minPensionBad++; }
}
console.log('denominators → hired:',hired,'retired:',retired,'marriageChecked:',marrChecked);
console.log('under16 violations:',under16,'| pension<minYears:',minPensionBad,'| retirementGapBad:',retireGapBad);
console.log('marriage: nullGate(non-mainland):',marrNull,'| belowLegalAge:',marrBad);
const s=a=>a.length?({n:a.length,min:Math.min(...a),p50:a.sort((x,y)=>x-y)[Math.floor(a.length/2)],max:Math.max(...a)}):'none';
console.log('firstJobAge:',JSON.stringify(s(firstJob)),'| retireAge:',JSON.stringify(s(retAge)));
