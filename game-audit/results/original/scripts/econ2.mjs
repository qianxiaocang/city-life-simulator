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
function run(i){
  const l=E.createLife({locations,seed:'q'+i,world:'past',birthYear:1990});E.startLife(l);
  let g=0;while(l.phase==='life'&&g++<200){if(l.pending){E.autoChoose(l);continue;}if(l.job&&E.getFocusOptions(l).some(f=>f.id==='work'))E.setFocus(l,'work');E.advanceYear(l);}
  const nw=E.netWorth(l),e=l.totals.earned,s=l.totals.spent;
  return {nw,e,s,ratio:nw/Math.max(1,e),unspent:e>0?(e-s)/e:null,save:e>0?s/e:null};
}
const rs=[];for(let i=0;i<3000;i++)rs.push(run(i));
const st=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);return a.length?({n:a.length,p10:+a[Math.floor(a.length*.1)].toFixed(2),p50:+a[Math.floor(a.length*.5)].toFixed(2),p90:+a[Math.floor(a.length*.9)].toFixed(2),max:+a[a.length-1].toFixed(2)}):{};};
console.log('netWorth/lifetimeEarned:',JSON.stringify(st(rs.map(r=>r.ratio))));
console.log('spend/earned:',JSON.stringify(st(rs.map(r=>r.save))));
console.log('unspent/earned:',JSON.stringify(st(rs.map(r=>r.unspent))));
console.log('mean earned:',Math.round(rs.reduce((x,r)=>x+r.e,0)/rs.length).toLocaleString(),'mean netWorth:',Math.round(rs.reduce((x,r)=>x+r.nw,0)/rs.length).toLocaleString());
