import {writeFileSync} from 'node:fs';
await import('../shipped/engine-shipped.mjs');
const before=globalThis.__ENGINE_SHIPPED__;
await import('../current-engine.mjs');
const after=globalThis.__ENGINE_SHIPPED__;
const T=x=>typeof x==='string'?x:x?.zhCN||'';
function life(E,seed,world,birthYear){const l=E.createLife({locations:E.locations,seed,world,birthYear});E.startLife(l);const choices=[];let n=0;while(l.phase==='life'&&n++<420){if(l.pending){if(l.pending.action==='edu-college')choices.push(l.pending.options.map(o=>T(o.label)));E.autoChoose(l);}else E.advanceYear(l);}return {logs:l.log.map(x=>T(x.text)),choices};}
const terms=['不把全国人口设为同一死亡概率','没有自动借款','只是增加迁居意愿','按本地模型条件','该金额是本次情景设定','没有因此自动背上消费债务'];
const check=E=>{const c=life(E,'cf0','past',1950),d=life(E,'cf2','now',2026);return {seed:'cf0@1950/past',terms:Object.fromEntries(terms.map(t=>[t,c.logs.filter(x=>x.includes(t)).length])),seedChoices:'cf2@2026/now',eduCollege:d.choices};};
writeFileSync('out/text-controls.json',JSON.stringify({before:check(before),after:check(after)},null,2));console.log('wrote out/text-controls.json');
