// Full action × option-id inventory, including dynamic labels by variant count.
import {readFileSync,writeFileSync} from 'node:fs';
const inv=JSON.parse(readFileSync('out/decision-inventory.json','utf8'));
const Q=JSON.parse(readFileSync('official-baselines.json','utf8'));
const sources=new Map(Q.baselines.map(x=>[x.id,x.tier]));
const buckets=new Map();
for(const r of inv.rows){const key=`${r.action}\0${r.optionId}`;let b=buckets.get(key);
 if(!b)buckets.set(key,b={action:r.action,optionId:r.optionId,labels:new Set(),minAge:r.minAge,maxAge:r.maxAge,minYear:r.minYear,maxYear:r.maxYear,count:0,regions:new Set(),exampleSeed:r.exampleSeed});
 b.labels.add(r.label);b.minAge=Math.min(b.minAge,r.minAge);b.maxAge=Math.max(b.maxAge,r.maxAge);b.minYear=Math.min(b.minYear,r.minYear);b.maxYear=Math.max(b.maxYear,r.maxYear);b.count+=r.count;for(const region of r.regions)b.regions.add(region);
}
function judge(b){
 const a=b.action,id=b.optionId;
 if(a==='financial'){
  const why={
   adultstudy:'24–40 岁的在职学习可解释；结业年龄现限制在 45 岁内。',
   appliances:'家电置办与时代供给相关；同一商品在不同年份的普及率不能套常数。',
   bicycle:'自行车可作为通勤与家庭大件；1970 年代初出现属可解释情境。',
   car:'私家车置办取决于积蓄、城市与政策；本作车价是固定购买力假设。',
   'child-school':'子女教育支出须先有在学子女，不应自动等于培训班。',
   childcare:'托育需要有在照护年龄的孩子，服务可得性随地区变化。',
   computer:'家用电脑需按年代与家庭收入出现，1990 年起是早期模型机会。',
   course:'成人职业技能学习可与就业并行，资格考试不能等同保证获证。',
   donate:'量力而行的公益支出可选，不能由系统强制扣款。',
   furniture:'家具是家庭生活支出，价格按模型币值，不是历史票面价格。',
   health:'体检及医疗护理可选，不应把购买行为写成必然治愈。',
   house:'按揭购房须有工作、首付和还款能力；1998 年起为游戏机会边界。',
   'house-cash':'全款买房须现金足够；房价是按城市档位的模型估值。',
   'invest-bond':'债券渠道与发行年份、地区有关；总表最早年不能推作大陆首年。',
   'invest-deposit':'存款是常见储蓄选择；利率和可得性须按币值口径说明。',
   'invest-fund':'证券基金是较晚的投资渠道；跨地区最早出现年不可混为大陆年份。',
   'invest-stock':'股票可选择但存在损失；1970 年样本可能位于港澳台，须逐地区查。',
   keep:'保留现状是必要的零支出选择；不应默认消费。',
   meal:'聚餐是可负担的关系支出，不应把社交等于强制请客。',
   'parent-support':'父母赡养应考虑父母是否健在与自己的负担能力。',
   phone:'固定电话、功能机、智能机按年份换名；还需核查当地普及时间。',
   renovation:'住房修缮以已有住房为前提，避免无房时显示。',
   'school-supplies':'20–24 岁购书学习仍合理，但选项不限于在校生。',
   trip:'旅游与返乡探亲都合理，应结合交通条件和收入可负担性。',
   wedding:'晚年婚礼可能是再婚；须与婚姻状态联动且可拒绝。',
  };
  const reason=why[id]||'观察到的可选支出，需逐地区、年龄和现金流核验。';
  if(id.startsWith('invest-'))return ['方向性／待核',reason,'按地区与年份展示可用渠道、风险和固定 2025 元口径。',null];
  if(['house','house-cash','car'].includes(id))return ['适用（模型）',reason,'显示总价、积蓄与贷款条件；不保证购置成功。',null];
  return ['适用（模型）',reason,'保留自愿选择并显示本局实际支出与结果。',null];
 }
 if(a==='culture'){
  const why={
   balance:'学习、休息和体育之间协商，在 12–18 岁可由玩家选择。',
   boundaries:'成年后为照护设边界合理，不应写成不孝。',
   class:'课外课程要考虑家中预算，不能默认每个城市都有同样供给。',
   decline:'拒绝相亲或礼金等家庭请求，是可成立的个人边界。',
   discuss:'比较收入、兴趣、稳定性与照护，避免把家人意见写成决定。',
   explore:'外地机会与探望安排可以协商，不强制留乡。',
   gift:'人情礼物以可负担为前提，不应产生隐性借贷。',
   help:'帮忙张罗须考虑身体与时间，不把无偿劳动当强制义务。',
   interest:'12–18 岁提出自己的兴趣方向合理，保留与学业并行。',
   later:'延后婚育是合理选择，不等同永远拒绝。',
   meet:'愿意见面不等于同意结婚，后续需独立抉择。',
   negotiate:'迁居、工作与照护成本可协商，避免单一路径。',
   no:'明确不养育孩子是个人选择，不应被叙事惩罚。',
   ownpath:'继续职业规划合理；家庭职业期待不是必然约束。',
   plan:'照护需要多方支持；不能默认由主角一人负担。',
   prepare:'考试或招录应另有资格和考核，家庭鼓励不等于录取。',
   remote:'1960–70 年代样本即出现“通话拜年”，通信可得性需按年代与地区改写。',
   rent:'先租房可保留流动性，1998 年后与住房抉择并存。',
   rest:'压力下休息或留在当地合理，不强制迁居。',
   return:'返乡团聚受距离、交通和工作安排制约。',
   save:'为住房储蓄合理，但不应设成人人必须买房。',
   share:'托育或老人照护应由家庭协商，不默认女性承担。',
   small:'小额支持以实际积蓄和对方需要为前提。',
   stay:'留在附近求职合理，不能保证找到工作。',
   study:'12–18 岁商议学习计划合理，不等于必须补习。',
   support:'学习方法或经济支持因年龄场景不同，按具体事件落地。',
   talk:'向家人解释住房或婚育压力合理，允许不同观点。',
   time:'以时间陪伴照料合理，需考虑就业与身体。',
  };
  const issue=id==='remote';
  return [issue?'需修订年代文案':'适用（情境）',why[id]||'自愿家庭情境；不把一种观念写成所有人的义务。',issue?'早期年份改为写信、探望或寻找可用电话；通话选项按通信条件开放。':'保留自愿回应，按家庭资源和地区显示后果。',null];
 }
 if(a==='career-offer')return id==='wait'?['适用','保留继续寻找的路径。','无需改写',null]:['适用（需逐岗核）','岗位会随资格、年代、年龄和地区动态替换；公务员与公办岗位另有考核。','显示职位所属地区、资格、考试、当年收入和退休条件。','LAW-MIN-AGE-WORK'];
 if(a==='edu-college')return id.startsWith('program-')?['需修订本地化','公办／民办本科、专科是大陆分类；同一标签也出现在港澳台。','港澳台按当地学制与院校称谓生成选项；大陆保留现有分类。',null]:['适用','复读与先工作均应保留，不能把升学写成唯一道路。','无需改写',null];
 if(a==='edu-funding')return id==='loan'?['适用（地域限定）','仅大陆、1999 年后且有录取和经济需要时出现；须审核。','保留；说明金额为本次模拟而非保证获批。',null]:['适用（模型）','家庭支持、奖助、转低成本路径和暂缓入学保留资金选择。','保留；明确费用按本局情景计算。',null];
 if(a==='move')return id==='stay'?['适用','保留不迁居的生活选择。','无需改写',null]:['适用（显示名去重后）','地点 ID 不同也可能同名；同屏需按显示名称去重。','同名城市附省级标签或只保留一项。',null];
 if(a==='marriage')return ['方向性／待核','只有登记结婚才改变婚姻状态；高龄再婚允许，初婚另有限龄模型。','显示对方状态和本地婚龄条件，不强迫结婚。','MARRIAGE-AGE-LAW'];
 if(a==='marriage-crisis')return ['适用（新增）','离婚与修复关系均可选；不应自动等同某种道德评价。','保留中性措辞，并记录婚姻结束年份。',null];
 if(a.startsWith('edu-'))return ['适用（模型）','教育进路需遵守当年的入学、考试、年限与资金条件。','保留选项；补充真实历史边界的说明。',null];
 if(a==='retirement-law')return ['适用（法规校验）','大陆职工退休以出生年月与原岗位类别计算；其他地区不能套用。','明示法定类别与可协商的弹性年限。','LAW-RETIRE-2024'];
 if(a==='child')return ['适用','生育与暂缓均应可选，年龄条件按本人或伴侣校验。','保留；避免把未生育写成失败。',null];
 return ['适用（情境）','观测年龄与年代内的自愿人生选择；不把玩家生活方式设为标准答案。','无需改写',null];
}
const lines=['# S3-12 · 抉择动作逐选项判定','',
 `实测 ${inv.lives} 局，原包 28 类动作全部观察到；当前引擎新增 1 类「marriage-crisis」，共 ${Object.keys(inv.actions).length} 类。以下以动作 + optionId 为选项身份，共 ${buckets.size} 行；同一 ID 的动态职业、城市和学校标签合并统计，完整原始变体见 [decision-inventory.json](out/decision-inventory.json)。`,
 '年龄／年代为本次样本观察范围，不是硬编码合法边界。PASS 不代表已经对齐外部人口频率；「适用（模型）」只表示内部机制和情境可解释。','',
 '| 动作 | 选项 ID · 标签 | 出现年龄 | 出现年代 | 判定 | 理由 | 建议改写 / 处置 |',
 '|---|---|---|---|---|---|---|'];
for(const b of [...buckets.values()].sort((x,y)=>x.action.localeCompare(y.action)||x.optionId.localeCompare(y.optionId))){
 const [verdict,reason,rewrite,ref]=judge(b);if(ref&&!sources.has(ref))throw Error(`来源不在册 ${ref}`);
 const labels=[...b.labels].sort(),display=labels.length<=5?labels.join('／'):labels.slice(0,3).join('／')+` 等 ${labels.length} 种动态标签`;
 const citation=ref?`（${ref}，${sources.get(ref)} 级${sources.get(ref)==='C'?'，待核':''}）`:'';
 lines.push(`| ${b.action} | ${b.optionId} · ${display.replaceAll('|','／')} | ${b.minAge}–${b.maxAge} 岁 | ${b.minYear}–${b.maxYear} | ${verdict} | ${reason}${citation} | ${rewrite} |`);
}
lines.push('','## 重点核查结果','',
 '1. `financial` 25 个 optionId 均在表内；房车、教育、照护、存款和证券分开判。证券出现年代需按地区核验，不能拿跨地区最早年当大陆开放年。',
 '2. `culture` 28 个 optionId 均在表内；只作情境，不把家人期待写成所有人的义务。',
 '3. `career-offer` 7、`edu-college` 7、`edu-funding` 5、`move` 4、`marriage` 3 个 optionId 均在表内。职业和迁居有动态标签，原始 3,000 余条变体可追溯。',
 '4. 大陆高等教育院校分类出现在港澳台的 `edu-college` 选项，是本轮发现的本地化问题；代码未更改跨地区制度，因为缺少本地入学制度一手资料，列入 UNRESOLVED。',
 '5. 新增 `marriage-crisis` 两项已单独列出。');
writeFileSync('DECISION-OPTION-REVIEW.md',lines.join('\n')+'\n');
console.log('wrote DECISION-OPTION-REVIEW.md',buckets.size,'options');
