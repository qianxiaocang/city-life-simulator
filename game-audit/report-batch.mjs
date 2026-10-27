import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const batch=process.argv[2]||'B1',dir=resolve(root,'results',batch),base=resolve(root,'results',batch==='B0'?'B0-final':batch);
const read=name=>JSON.parse(readFileSync(resolve(base,name),'utf8'));
const audit=read('audit-results.json');let target={},exp={};try{target=read('batch-assertions.json');}catch{}try{exp=read('exp3-results.json').out;}catch{}
const lines=[`# ${batch} 提交说明与实测记录`,'',`本批全量：${audit.meta.lives}局引擎无头对局；不是浏览器逐局点击。来源：${audit.meta.source}。耗时${audit.meta.seconds}秒。`,'', '上一轮提供的审计口径为13.7万局无头模拟，本次各批分别记录，不将未执行的局数并入。','', '|检查|pass/fail|实测违规数 / 分母|未覆盖|','|---|---|---:|---:|'];
for(const[k,c]of Object.entries({...audit.checks,...target.checks}))lines.push(`|${k}|${c.status}|${c.failed} / ${c.denominator}|${c.unsupported}|`);
lines.push('',`历史事件可达 ${audit.coverage.historyFired}/${audit.coverage.historyTotal}；职业可达 ${audit.coverage.jobsTotal-audit.coverage.jobsNeverTaken.length}/${audit.coverage.jobsTotal}。`,'','## 抉择分叉（未达标项保留，不放宽阈值）','','|类型|宽松差异率|p95寿命差|分母|','|---|---:|---:|---:|');
for(const[k,v]of Object.entries(exp.byAction||{}))lines.push(`|${k}|${(100-v.pctWithinToleranceIdentical).toFixed(1)}%|${v.p95DeathAgeSpread??'未计量'}|${v.probed}|`);
lines.push('','详细分布与文化曝光分母见同目录JSON；指南口径纠正见 ../B0/度量修正说明.md。待后续批处理的FAIL不伪报完成。');
mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,'提交说明.md'),lines.join('\n')+'\n');
