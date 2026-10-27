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
const T=v=>typeof v==='string'?v:v?.zhCN??'';
let n=0, availHouse=0, availCash=0, availCar=0, reasons={}, boughtHouse=0, ratios=[], ratioHi=0;
const ml=[];
for(let i=0;i<3000;i++){
  const l=E.createLife({locations,seed:'h'+i,world:'past',birthYear:[1985,1990,1995][i%3]});E.startLife(l);
  let g=0;
  while(l.phase==='life'&&g++<200){
    if(l.pending){E.autoChoose(l);continue;}
    if(l.job&&E.getFocusOptions(l).some(f=>f.id==='work'))E.setFocus(l,'work');
    E.advanceYear(l);
    if(l.age>=24&&l.age<=45&&l.job){
      const items=E.getShopItems(l);
      const h=items.find(x=>x.id==='house'), c=items.find(x=>x.id==='house-cash'), k=items.find(x=>x.id==='car');
      if(l.age===28){
        n++;
        if(h?.available)availHouse++; else if(h)reasons[T(h.availabilityReason)]=(reasons[T(h.availabilityReason)]||0)+1;
        if(c?.available)availCash++;
        if(k?.available)availCar++;
        if(h?.totalPrice){ const pay=h.totalPrice*0.7*(l.year<2000?.065:l.year<2015?.055:l.year<2023?.045:.035)/(1-Math.pow(1-(l.year<2000?.065:l.year<2015?.055:l.year<2023?.045:.035),-(l.year<1999?20:25))); const r=pay/Math.max(1,l.income||l.job.salary); ratios.push(r); if(r>0.4)ratioHi++; ml.push({inc:l.income||l.job.salary,typ:l.profile.typicalIncome,total:h.totalPrice,priceYrs:+(h.totalPrice/Math.max(1,l.income||l.job.salary)).toFixed(1),payRatio:+r.toFixed(2)}); }
      }
      if(h?.available&&Math.random()<1){ if(E.purchase(l,'house'))boughtHouse++; }
    }
    if(l.age>50)break;
  }
}
ratios.sort((a,b)=>a-b);
const q=p=>ratios[Math.floor(ratios.length*p)]?.toFixed(2);
console.log('atAge28 with job:',n);
console.log('house(mortgage) available:',(availHouse/n*100).toFixed(1)+'%','| house-cash:',(availCash/n*100).toFixed(1)+'%','| car:',(availCar/n*100).toFixed(1)+'%');
console.log??0;console.log('buy attempts succeeded:',boughtHouse);
console.log('unavailability reasons:',JSON.stringify(reasons));
console.log('mortgage payment / own income: p10='+q(.1)+' p50='+q(.5)+' p90='+q(.9)+' | share failing 40% DTI rule:',(ratioHi/ratios.length*100).toFixed(1)+'%');
console.log('samples:',JSON.stringify(ml.slice(0,6)));
