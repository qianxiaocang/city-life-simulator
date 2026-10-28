/**
 * Original education state machine. Legal guardrails and sourced history live
 * in china-law.js; all exam scores, admissions bands, fictional school fees and
 * grant chances are explicitly game parameters.
 */
import {loanPolicyInModelUnits} from './data/money-basis.js';
import { admissionPolicy } from './data/admission-policy.js';
import { educationAdmissionRoute, tuitionModel, studentLoanPolicy } from './data/china-law.js';
import { familyBudget } from './family-finance.js';
const T = (zhCN,zhTW,en) => ({zhCN,zhTW,en});
const clamp = (value,min=0,max=100) => Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
const NAMES = {
  primary:T('小学','小學','Primary school'),
  junior:T('初中','國中','Junior secondary school'),
  high:T('普通高中','普通高中','Senior secondary school'),
  vocational:T('中等职业教育','中等職業教育','Secondary vocational school'),
  associate:T('高职／专科','高職／專科','Higher-vocational / associate program'),
  university:T('大学本科','大學','Bachelor’s program'),
  masters:T('硕士研究生','碩士研究所','Master’s program'),
  doctorate:T('博士研究生','博士研究所','Doctoral program'),
};
const RANK = {preschool:0,primary:1,junior:2,high:3,vocational:3,associate:4,university:5,masters:6,doctorate:7};
const HIGHER = new Set(['associate','university','masters','doctorate']);
const DURATIONS = {primary:6,junior:3,high:3,vocational:3,associate:3,university:4,masters:3,doctorate:4};
const sumText = (value, suffix) => T(value.zhCN+suffix.zhCN,value.zhTW+suffix.zhTW,value.en+suffix.en);
const numberText = value => Math.round(value).toLocaleString('en-US');
function option(env,id,label,description,weight=1) { return env.option(id,label,description || T('','',''),weight); }
function seen(life,key) { const flags=life.educationState.offered; if(flags[key])return true; flags[key]=true;return false; }
export function ensureEducationState(life) {
  life.flags ||= {};
  life.pendingQueue ||= [];
  life.educationState ||= {};
  Object.assign(life.educationState,{
    version:1,
    completedCompulsory:life.educationState.completedCompulsory ?? (RANK[life.education]>=2),
    offered:life.educationState.offered || {},
    exams:life.educationState.exams || [],
    repeatUntil:life.educationState.repeatUntil || life.flags.repeatExam || null,
    repeats:life.educationState.repeats || 0,
    justGraduated:life.educationState.justGraduated || null,
  });
  delete life.flags.repeatExam;
  if(life.school) {
    life.school.annualTuition ??= 0;life.school.livingCost ??= 0;
    life.school.ownership ||= 'public';life.school.label ||= NAMES[life.school.stage] || NAMES.high;
    life.school.loanApproved ??= false;life.school.financialNeed ??= false;
    life.school.familyContribution ??= 0;life.school.scholarship ??= 0;
    life.school.studyRegion ||= life.location.region;
    life.school.startedAt ??= life.school.endsAt-(DURATIONS[life.school.stage] || 3);
    life.school.segmentStartedAt ??= life.school.startedAt;
    life.school.creditedAcademicYears ??= 0;
    life.school.segmentDelayedAcademicYears ??= 0;
  }
  return life.educationState;
}
function fees(life,stage,ownership='public') {
  const cost=tuitionModel({year:life.year,level:stage,ownership,region:life.location.region,urban:life.urban,incomeReference:life.profile.typicalIncome});
  if(cost)return {...cost,annualLivingCost:HIGHER.has(stage)?cost.annualLivingCost:0};
  // The three non-mainland systems are kept separate from mainland statutes.
  // These are deliberately labeled fictional local-school prices in CNY terms.
  return {tuition:HIGHER.has(stage)?ownership==='private'?26000:8000:1800,annualLivingCost:HIGHER.has(stage)?12000:0,modelOnly:true,sourceIds:[],currency:'CNY'};
}
function programFor(life,stage,ownership,label,extra={}) {
  const cost=fees(life,stage,ownership);
  return {stage,ownership,label:label || NAMES[stage],duration:DURATIONS[stage],annualTuition:cost.tuition,livingCost:cost.annualLivingCost || 0,publicSupport:!!cost.publicSupport,modelOnly:cost.modelOnly,sourceIds:cost.sourceIds,...extra};
}
function enroll(life,program,env) {
  const state=ensureEducationState(life);
  if (HIGHER.has(program.stage) && life.age + (program.duration || DURATIONS[program.stage]) > 45) {
    env.log(life,T('这一阶段的课程无法在本作设定的继续教育年龄范围内完成。你保留已有学历，重新安排工作和学习。','這階段課程無法在本作設定的進修年齡範圍內完成。你保留既有學歷，重新安排工作與學習。','This course cannot be completed within the game’s continuing-education age range. You keep the qualification already earned and reconsider work and study.'),'education');
    env.offerWork(life);return false;
  }
  if(life.location.region==='mainland'&&life.year>=1966&&life.year<=1969&&HIGHER.has(program.stage)&&!program.wasEnrolled){
    env.log(life,T('这一年高校停止招生，录取或资金安排不能绕过停招。','這一年高校停止招生，錄取或資金安排不能繞過停招。','Admissions are suspended this year; a funding plan cannot bypass the closure.'),'education');env.offerWork(life);return false;
  }
  const mode=life.age>35?'adult':program.mode||'full-time';
  if(mode==='adult'&&['masters','doctorate'].includes(program.stage)){env.offerWork(life);return false;}
  if(HIGHER.has(program.stage))state.firstHigherAdmissionAge??=life.age;
  life.school={...program,mode,endsAt:life.age+program.duration,startedAt:program.resuming?program.startedAt:life.age,segmentStartedAt:life.age,creditedAcademicYears:program.completedAcademicYears || 0,segmentDelayedAcademicYears:0,wasEnrolled:true,studyRegion:life.location.region,loanApproved:!!program.loanApproved,financialNeed:!!program.financialNeed,familyContribution:program.familyContribution || 0,scholarship:program.scholarship || 0,fundingGap:0,unfundedAcademicYears:0};
  if(life.job)life.lastJob={...life.job};
  life.job=null;life.income=0;life.focus='study';
  state.repeatUntil=null;state.justGraduated=null;state.suspendedStudy=null;
  if(HIGHER.has(program.stage)&&!program.wasEnrolled) {
    life.schoolHistory ||= [];
    life.schoolHistory.push({stage:program.stage,ownership:program.ownership,admissionTier:program.admissionTier||null,label:program.label,startedAt:life.age,year:life.year,annualTuition:program.annualTuition,mode,currencyBasis:'CNY-2025-model'});
  }
  env.log(life,program.resuming?T('你重新安排了'+program.label.zhCN+'的资金，保留已完成的学习进度，继续完成剩余课程。','你重新安排了'+program.label.zhTW+'的資金，保留已完成的學習進度，繼續完成剩餘課程。','You arranged funding for '+program.label.en+' and resumed the remaining modeled course, retaining completed progress.'):T('你进入'+program.label.zhCN+'。学习需要时间，毕业后才会获得相应学历。','你進入'+program.label.zhTW+'。學習需要時間，畢業後才會獲得相應學歷。','You entered '+program.label.en+'. The qualification is earned only after completing the course.'),'education');
}
function modelScore(life,kind,env) {
  const n=typeof env.normal==='function'?env.normal(life):0;
  const focus=life.focus==='study'?4:0;
  const tier=kind==='gaokao'?(life.education==='vocational'?-6:life.educationState?.seniorSchoolTier==='selective'?4:0):0;
  const score=Math.round(clamp(14+life.stats.knowledge*.74+(life.talent ?? .5)*15+n*8+focus+tier,5,99));
  const record={year:life.year,age:life.age,kind,score,maxScore:100,modelOnly:true};
  life.educationState.exams.push(record);
  return score;
}
function secondaryAid(life,program){
  const budget=familyBudget(life),shortfall=Math.max(0,program.annualTuition-budget);
  if(!shortfall||life.location.region!=='mainland'||life.year<2012||program.ownership!=='public'||(life.classRank>2&&budget>0))return 0;
  // Need-based secondary aid is represented as a modeled award, not an
  // automatic statutory amount for every locality or student.
  const orphan=budget===0;
  return Math.min(shortfall,Math.round(program.annualTuition*(orphan?1:program.stage==='vocational'?.8:.6)));
}
function secondaryDecision(life,env) {
  if(seen(life,'secondary-'+life.age))return;
  const mainland=life.location.region==='mainland';
  const historicalRecommendation=mainland&&life.year>=1966&&life.year<=1976;
  const score=historicalRecommendation?null:modelScore(life,mainland?'zhongkao':'local-secondary-assessment',env);
  const candidates=[];
  if(!historicalRecommendation&&score>=77)candidates.push(programFor(life,'high','public',T('公办重点／高选拔性高中','公辦重點／高選拔性高中','Selective public senior secondary school'),{schoolTier:'selective'}));
  if(historicalRecommendation||score>=50)candidates.push(programFor(life,'high','public',T('公办普通高中','公辦普通高中','Public senior secondary school'),{schoolTier:'ordinary'}));
  if(!historicalRecommendation&&score>=50&&life.year>=1993)candidates.push(programFor(life,'high','private',T('民办普通高中','民辦普通高中','Private senior secondary school'),{schoolTier:'ordinary'}));
  candidates.push(programFor(life,'vocational','public',NAMES.vocational,{schoolTier:'vocational'}));
  const description=historicalRecommendation
    ?T('这一时期的升学制度受到时代影响，本次不采用现代中考分数线。推荐与学业安排在此简化模拟，不能看作每个地方的历史细则。','這一時期的升學制度受到時代影響，本次不採現代中考分數線。推薦與學業安排在此簡化模擬，不代表各地全部歷史細則。','Education is affected by the period. This route does not apply modern examination cut-offs. Recommendation and school arrangements are a simplified historical model.')
    :mainland?T('你的模拟中考标准分为'+score+'/100。它不是本市真实分数线。符合相应学业条件的高中才出现在选项中；高中不属于九年义务教育。','你的模擬中考標準分為'+score+'/100。這不是本市真實分數線。符合相應學業條件的高中才列入選項；高中不屬於九年義務教育。','Your modeled lower-secondary exam score is '+score+'/100, not a real local cut-off. Only eligible school bands appear. Senior secondary school is outside the nine compulsory years.')
    :T('本地学业评估模拟分为'+score+'/100。这里使用虚构学校与统一游戏分段，不代表当地真实升学考试、学制或免费教育规定。','本地學業評估模擬分為'+score+'/100。這裡使用虛構學校與統一遊戲分段，不代表當地真實升學考試、學制或免費教育規定。','Your local academic assessment is modeled at '+score+'/100. Fictional schools and game bands do not represent the local examination, school system or free-education rules.');
  const title=historicalRecommendation||!mainland?T('选择下一段学业','選擇下一段學業','The next stage of education'):T('中考之后，选择下一段学业','中考之後，選擇下一段學業','After the lower-secondary examination');
  const budget=familyBudget(life);
  const programs=candidates.map(program=>({...program,scholarship:secondaryAid(life,program)}));
  const options=programs.flatMap((program,i)=>{
    const familyContribution=Math.min(budget,Math.max(0,program.annualTuition-program.scholarship));
    if(familyContribution+program.scholarship<program.annualTuition)return [];
    return [option(env,'school-'+i,program.label,T('模型年学费 ¥'+numberText(program.annualTuition)+'，家庭可承担 ¥'+numberText(familyContribution)+'，模型资助 ¥'+numberText(program.scholarship)+'。','模型年學費 ¥'+numberText(program.annualTuition)+'，家庭可負擔 ¥'+numberText(familyContribution)+'，模型資助 ¥'+numberText(program.scholarship)+'。','Modeled annual tuition: CNY '+numberText(program.annualTuition)+'; family: '+numberText(familyContribution)+'; modeled aid: '+numberText(program.scholarship)+'.'),program.ownership==='public'?2:.55)];
  });
  options.push(option(env,'work',T('暂缓升学，先寻找技能与工作机会','暫緩升學，先尋找技能與工作機會','Defer school and seek skills or work'),T('不会因此自动获得工作；仍须达到当地就业年龄。','不會因此自動獲得工作；仍須達到當地就業年齡。','Employment still requires the local minimum age.'),options.length?.3:2));
  const fundingNote=T(' 家庭可用于本阶段学费的模型额度约 ¥'+numberText(budget)+'；未有资金保障的学校不会出现在选项中。',' 家庭可用於本階段學費的模型額度約 ¥'+numberText(budget)+'；未有資金保障的學校不會列入選項。',' The modeled family tuition capacity is CNY '+numberText(budget)+'; unfunded schools are not offered.');
  env.decision(life,'edu-secondary',title,T(description.zhCN+fundingNote.zhCN,description.zhTW+fundingNote.zhTW,description.en+fundingNote.en),options,{programs,score,sourceIds:mainland?['compulsory-education','school-admission',...(life.year>=2012?['secondary-student-aid-2012']:[])]:[],modelOnly:true});
}
function admissionPrograms(life,score) {
  const bands=[
    [.85,'university','public',T('高选拔性公办本科','高選拔性公辦大學','Selective public bachelor’s program'),'research-public'],
    [.66,'university','public',T('公办普通本科','公辦一般大學','Public bachelor’s program'),'public-bachelor'],
    [.54,'university','private',T('民办本科','民辦大學','Private bachelor’s program'),'private-bachelor'],
    [.36,'associate','public',T('公办高职／专科','公辦高職／專科','Public higher-vocational / associate program'),'public-associate'],
    [.24,'associate','private',T('民办高职／专科','民辦高職／專科','Private higher-vocational / associate program'),'private-associate'],
  ];
  return bands.filter(([threshold,,ownership])=>score/100>=threshold&&(ownership!=='private'||life.year>=1993)).map(([,stage,ownership,label,tier])=>programFor(life,stage,ownership,label,{admissionTier:tier,examScore:score}));
}
function higherDecision(life,env,{restored=false}={}) {
  const state=ensureEducationState(life);
  if(seen(life,'higher-'+life.age+'-'+life.year))return;
  const mainland=life.location.region==='mainland';
  const route=mainland?educationAdmissionRoute(life.year):{id:'local-assessment',exam:true};
  if(route.id==='suspended') {
    state.historicalBlocked=true;
    env.decision(life,'edu-suspended',T('这年的大学门暂未打开','這年的大學門暫未打開','University admission is suspended'),T('1966至1969年普通高校停止招生。你不能在这一年通过现代高考直接读大学，可以保留学习，再寻找工作或技能机会。','1966至1969年一般高校停止招生。你不能在這一年經現代高考直接讀大學，可以繼續學習，再尋找工作或技能機會。','Ordinary university admission stopped in 1966–1969. You cannot enter a modern entrance examination this year. Keep learning and look for work or skills opportunities.'),[option(env,'work',T('先积累生活与工作经历','先累積生活與工作經歷','Gain practical experience'),undefined,2)],{sourceIds:['gaokao-history']});
    return;
  }
  if(route.id==='recommendation') {
    const experience=life.workHistory?.reduce((sum,item)=>sum+(item.years || 0),0) || life.job?.years || Math.max(0,life.age-18);
    const eligible=experience>=2&&(life.flags.communityRecommendation||env.chance(life,.35));
    env.decision(life,'edu-recommendation',T('推荐选拔时期的求学机会','推薦選拔時期的求學機會','A recommendation-based study opportunity'),T('1970至1976年部分高校通过工农兵推荐选拔招生，不是现代高考。本作要求至少两年实践经历，并将推荐审核简化为有不确定性的情景。','1970至1976年部分高校透過工農兵推薦選拔招生，並非現代高考。本作要求至少兩年實踐經歷，推薦審查為有不確定性的簡化情景。','Some universities used recommendation-based worker, farmer and soldier selection in 1970–1976, not the modern entrance exam. The model requires two years of practical experience and uncertain recommendation review.'),[...(eligible?[option(env,'recommend',T('申请推荐与学校复审','申請推薦與學校複審','Seek recommendation and institutional review'),undefined,.8)]:[]),option(env,'work',T('继续实践并保留学习','繼續實踐並保留學習','Continue practical work and learning'),undefined,2)],{eligible,sourceIds:['gaokao-history','higher-education-aid-history']});
    return;
  }
  const score=modelScore(life,mainland?'gaokao':'local-assessment',env);
  const policy=admissionPolicy(life.year,{vocational:life.education==='vocational',region:life.location.region});
  const contextualAccess=clamp(1+(life.marketContext?.educationAccess||0),.6,1.3);
  const admitted=env.chance(life,Math.min(1,policy.total*contextualAccess));
  const bachelor=admitted&&env.chance(life,policy.bachelor/Math.max(.001,policy.total));
  const selective=bachelor&&env.chance(life,Math.min(1,policy.selective/Math.max(.001,policy.bachelor)));
  const programs=admitted?admissionPrograms(life,score).filter(program=>(program.stage!=='university'||bachelor)&&(program.admissionTier!=='research-public'||selective)):[];
  state.admissionAttempts||=[];state.admissionAttempts.push({year:life.year,age:life.age,admitted,bachelor,policy,contextualAccess,modelOnly:true});
  const description=T((restored?'恢复高考带来一次重新出发的机会。':'')+'本次模拟标准分 '+score+'/100。分段只用于游戏，不代表真实省级录取线；本科／专科与公办／民办是两个不同维度。',(restored?'恢復高考帶來一次重新出發的機會。':'')+'本次模擬標準分 '+score+'/100。分段僅用於遊戲，不代表真實省級錄取線；大學／專科與公辦／民辦是不同維度。',(restored?'The restored entrance examination offers a new start. ':'')+'Modeled score: '+score+'/100. These bands are game parameters, not provincial cut-offs. Qualification and public/private ownership are separate.');
  const options=programs.map((program,i)=>option(env,'program-'+i,T('选择'+program.label.zhCN,'選擇'+program.label.zhTW,'Choose '+program.label.en),T('模型学费 ¥'+numberText(program.annualTuition)+'/年；再选择家庭支持、奖助或符合条件的助学贷款。','模型學費 ¥'+numberText(program.annualTuition)+'/年；再選家庭支持、獎助或合資格助學貸款。','Modeled tuition: CNY '+numberText(program.annualTuition)+'/year. Next arrange family support, aid or an eligible student loan.'),program.ownership==='public'?2.2:.7));
  if(state.repeats<2&&life.age<=24)options.push(option(env,'repeat',T('准备一年，再试一次','準備一年，再試一次','Prepare and try again next year'),T('推迟一年，不保证下一次成绩提高。','延後一年，不保證下次成績提高。','A year of preparation does not guarantee a higher score.'),.4));
  options.push(option(env,'work',T('先进入工作，保留继续教育机会','先進入工作，保留繼續教育機會','Work first; keep learning later'),undefined,programs.length?.7:2));
  env.decision(life,'edu-college',T(mainland?'高考之后，选择去向':'毕业评估后的升学去向',mainland?'高考之後，選擇去向':'畢業評估後的升學去向',mainland?'After the entrance examination':'Study choices after graduation assessment'),description,options,{programs,score,route:route.id,sourceIds:['admission-batches','gaokao-history'],modelOnly:true});
}
function fundingDecision(life,program,env) {
  const familyContribution=Math.min(familyBudget(life),program.annualTuition+program.livingCost);
  const scholarship=program.scholarship || 0;
  const gap=Math.max(0,program.annualTuition+program.livingCost-familyContribution-scholarship-Math.max(0,life.money));
  const financialNeed=life.classRank<=2||familyContribution+Math.max(0,life.money)<program.annualTuition+program.livingCost-scholarship;
  const policy=loanPolicyInModelUnits(studentLoanPolicy(life.year,program.stage,life.location.region,{cityName:life.location.name.zhCN}),life.year);
  const canLoan=!program.loanAttempted&&financialNeed&&policy.available&&gap>0&&gap<=policy.annualCap;
  const choices=[];
  if(gap<=0)choices.push(option(env,'family',T('用家庭支持、积蓄与已获奖助安排入学','用家庭支持、積蓄及已獲獎助安排入學','Enroll using family support, savings and awarded aid'),undefined,3));
  if(canLoan)choices.push(option(env,'loan',T('申请国家助学贷款并接受资格审核','申請國家助學貸款並接受資格審查','Apply for a national student loan and assessment'),T('本学年上限 ¥'+numberText(policy.annualCap)+'；审核并非自动通过，之后每学年仅按实际缺口借款。','本學年上限 ¥'+numberText(policy.annualCap)+'；審查不保證通過，往後各學年僅依實際缺口借款。','Annual cap: CNY '+numberText(policy.annualCap)+'. Approval is not automatic. Later borrowing covers only the actual annual shortfall.'),2));
  if(!program.aidAttempted&&financialNeed)choices.push(option(env,'aid',T('申请奖助与校内困难支持','申請獎助及校內困難支持','Seek scholarships and hardship support'),T('需要申请和评估；金额与结果为情景模型。','需要申請與評估；金額和結果為情景模型。','Requires application and assessment. Amounts and outcomes are modeled.'),1.6));
  if((program.ownership==='private'||program.stage==='university')&&program.examScore>=36)choices.push(option(env,'cheaper',T('改选费用较低的公办专科路径','改選費用較低的公辦專科途徑','Consider a lower-cost public associate program'),undefined,1.3));
  choices.push(option(env,'work',program.resuming?T('保留进度，休学工作后再申请','保留進度，休學工作後再申請','Retain progress, take leave to work and reapply'):T('暂缓入学，先工作并继续学习','暫緩入學，先工作並持續學習','Defer enrollment, work and keep learning'),undefined,.45));
  const title=program.resuming?T('重新安排资金，继续未完成的学业','重新安排資金，繼續未完成的學業','Arrange funding to resume unfinished study'):T('录取以后，先安排求学资金','錄取以後，先安排求學資金','An offer needs a funding plan');
  env.decision(life,'edu-funding',title,T('已获'+program.label.zhCN+'的模拟学习资格。每年学费 ¥'+numberText(program.annualTuition)+'、生活费模型 ¥'+numberText(program.livingCost)+'；家庭支持约 ¥'+numberText(familyContribution)+'、已获奖助 ¥'+numberText(scholarship)+'、现有积蓄 ¥'+numberText(Math.max(0,life.money))+'，本学年剩余缺口 ¥'+numberText(gap)+'。没有资金保障时，不会让未就业学生自动背上消费债务。','已獲'+program.label.zhTW+'的模擬學習資格。每年學費 ¥'+numberText(program.annualTuition)+'、生活費模型 ¥'+numberText(program.livingCost)+'；家庭支持約 ¥'+numberText(familyContribution)+'、已獲獎助 ¥'+numberText(scholarship)+'、現有積蓄 ¥'+numberText(Math.max(0,life.money))+'，本學年剩餘缺口 ¥'+numberText(gap)+'。資金未有保障時，不會令未就業學生自動承擔消費債務。','You have a modeled study place at '+program.label.en+'. Annual tuition: CNY '+numberText(program.annualTuition)+'; modeled living costs: '+numberText(program.livingCost)+'; family support: '+numberText(familyContribution)+'; awarded aid: '+numberText(scholarship)+'; existing savings: '+numberText(Math.max(0,life.money))+'; remaining annual shortfall: '+numberText(gap)+'. An unemployed student will not automatically acquire consumer debt.'),choices,{program:{...program,familyContribution,financialNeed},policy,gap,sourceIds:policy.sourceIds,modelOnly:true});
}
function postgraduateDecision(life,stage,env) {
  const target=stage==='university'?'masters':stage==='masters'?'doctorate':null;
  if(!target){env.offerWork(life);return;}
  env.decision(life,'edu-postgraduate',T('毕业以后，再决定下一步','畢業以後，再決定下一步','After graduation, the next step'),T('学历不会随年龄自动增加。继续读'+NAMES[target].zhCN+'需要新的考试／申请与资金安排。','學歷不隨年齡自動增加。繼續讀'+NAMES[target].zhTW+'需要新的考試／申請與資金安排。','Qualifications do not grow automatically with age. Further study requires a new examination or application and a funding plan.'),[option(env,'apply',sumText(NAMES[target],T('：申请与考核','：申請與考核',': apply and be assessed')),undefined,.8),option(env,'work',T('开始工作并积累经验','開始工作並累積經驗','Start work and gain experience'),undefined,2)],{target,sourceIds:['admission-batches'],modelOnly:true});
}
export function finishEducation(life,env) {
  const state=ensureEducationState(life);
  if(!life.school)return false;
  const school=life.school;
  if (school.stage==='junior' && Number.isInteger(life.birthYear) && life.location.region==='mainland' && life.age>=13 &&
      !state.juniorExitChecked) {
    state.juniorExitChecked=true;
    const exitRisk=life.birthYear<1970?.24:life.birthYear<1990?.11:.035;
    if(env.chance(life,exitRisk)){
      life.school=null;state.completedCompulsory=false;state.juniorDroppedOut=true;
      env.log(life,T('家庭和时代条件使你暂时离开初中，九年学业尚未完成；此时不能按完成义务教育者进入岗位。','家庭與時代條件使你暫時離開國中，九年學業尚未完成；此時不能按完成義務教育者進入職位。','Family and period conditions interrupted lower-secondary study. The nine years remain incomplete, so employment requiring completion is unavailable.'),'education');
      return false;
    }
  }
  if (HIGHER.has(school.stage) && life.age > 45) {
    life.school=null;
    env.log(life,T('你保留此前已获得的学历，这段长期未完成的课程在这里结束。','你保留此前已取得的學歷，這段長期未完成的課程在此結束。','You retain your previous qualification; this long-unfinished course ends here.'),'education');
    env.offerWork(life);return false;
  }
  school.completedAcademicYears=school.creditedAcademicYears+Math.max(0,life.age-school.segmentStartedAt-school.segmentDelayedAcademicYears);
  if(['high','vocational'].includes(school.stage)&&school.fundingGap>0){
    life.school=null;
    state.secondaryInterrupted=true;
    env.log(life,T('家庭和已获资助未能付清上一学年的高中阶段费用，这段学业暂时中断；未付费用没有变成你的消费贷款。','家庭與已獲資助未能付清上一學年的高中階段費用，這段學業暫時中斷；未付費用沒有變成你的消費貸款。','Family resources and awarded aid did not cover last year’s secondary-school fees. Study was interrupted, and the unpaid amount did not become consumer debt.'),'education');
    env.offerWork(life);return false;
  }
  if(HIGHER.has(school.stage)&&school.lastFundingReviewYear!==life.year) {
    const incomplete=Math.max(0,school.unfundedAcademicYears || (school.fundingGap>0?1:0));
    if(incomplete>0) {
      school.endsAt=Math.max(school.endsAt,life.age)+incomplete;school.delayedAcademicYears=(school.delayedAcademicYears || 0)+incomplete;
      school.segmentDelayedAcademicYears+=incomplete;
      school.completedAcademicYears=Math.max(0,school.completedAcademicYears-incomplete);
      school.unfundedAcademicYears=0;school.lastFundingReviewYear=life.year;
      env.log(life,T('本学年的高教学费没有付清，本作将这一课程年视为未完成，毕业时间顺延。未付部分不变成消费债务；你可以重新申请资金、选择合资格低收费路径，或保留进度休学工作。','本學年的高教學費未付清，本作將此課程年視為未完成，畢業時間順延。未付部分不轉為消費債務；你可重新申請資金、選合資格低收費途徑，或保留進度休學工作。','This year’s higher-education tuition was not fully funded. The model treats the academic year as incomplete and delays graduation. No consumer debt is created. Reapply for support, choose an eligible lower-cost route or retain progress while taking leave to work.'),'education');
      fundingDecision(life,{...school,duration:Math.max(1,school.endsAt-life.age),resuming:true,loanAttempted:false,aidAttempted:false},env);
      return false;
    }
  }
  if(life.age<school.endsAt)return false;
  const completed={...life.school};life.previousSchool=completed;
  life.school=null;life.education=completed.stage;state.justGraduated=completed.stage;state.graduationAge=life.age;
  if(completed.stage==='junior')state.completedCompulsory=true;
  if(HIGHER.has(completed.stage)&&life.studentLoan?.balance>0)life.studentLoan.graduationYear=life.year;
  // Selective programs confer a small modeled learning gain, so choosing one
  // is more than a different label when its tuition matches ordinary public study.
  env.log(life,T('你完成了'+completed.label.zhCN+'的学业，获得相应学历。','你完成了'+completed.label.zhTW+'的學業，取得相應學歷。','You completed '+completed.label.en+' and earned the corresponding qualification.'),'education',{knowledge:completed.admissionTier==='research-public'?5:3,happiness:4});
  return true;
}
export function educationMilestones(life,env) {
  const state=ensureEducationState(life);
  if(life.phase!=='life')return;
  if(life.age===(life.schoolStartAge??6)&&life.education==='preschool'&&!life.school&&!seen(life,'primary')) {
    enroll(life,programFor(life,'primary','public',NAMES.primary,{familyContribution:0,duration:life.primaryYears??6}),env);
    return;
  }
  const stage=state.justGraduated;
  if(stage) {
    state.justGraduated=null;
    if(stage==='primary'){enroll(life,programFor(life,'junior','public',NAMES.junior,{familyContribution:0}),env);return;}
    if(stage==='junior'){secondaryDecision(life,env);return;}
    if(['high','vocational'].includes(stage)){higherDecision(life,env);return;}
    if(stage==='associate') {
      env.decision(life,'edu-bridge',T('专科毕业后的路','專科畢業後的路','After an associate qualification'),T('专科学历与本科不同。可以工作，也可以尝试选拔性衔接本科；这里的考核是游戏模型。','專科學歷與大學不同。可先工作，或嘗試選拔性銜接大學；這裡的考核是遊戲模型。','An associate qualification is distinct from a bachelor’s degree. Work, or attempt a selective bridging route; this assessment is modeled.'),[option(env,'work',T('开始工作','開始工作','Start working'),undefined,2),option(env,'bridge',T('参加本科衔接选拔','參加大學銜接選拔','Attempt bachelor’s bridging admission'),undefined,.8)],{modelOnly:true});
      return;
    }
    postgraduateDecision(life,stage,env);return;
  }
  if(state.repeatUntil&&life.age>=state.repeatUntil&&!life.school) {
    state.repeatUntil=null;higherDecision(life,env);return;
  }
  if(state.suspendedStudy&&!life.school&&life.age>state.suspendedStudy.pausedAt&&!seen(life,'resume-study-'+life.year)) {
    const suspended=state.suspendedStudy;
    fundingDecision(life,{...suspended,duration:suspended.remainingYears,resuming:true,loanAttempted:false,aidAttempted:false},env);
    return;
  }
  if(life.location.region==='mainland'&&life.year===1977&&life.age>=18&&life.age<=35&&!HIGHER.has(life.education)&&!life.school&&!seen(life,'gaokao-restored'))higherDecision(life,env,{restored:true});
  if(life.location.region==='mainland'&&life.year>=1970&&life.year<=1976&&state.historicalBlocked&&life.age>=20&&!life.school&&!seen(life,'recommendation-'+life.year))higherDecision(life,env);
}
/** Rebuild a carried study plan with this year's fees, aid and admission route. */
export function refreshEducationDecision(life,pending,env){
  let rebuilt=null;
  const capture={...env,decision:(_life,action,title,description,options,data={},kind='choice')=>{
    rebuilt={...pending,action,title,description,options,data,kind};return true;
  }};
  if(pending.action==='edu-funding'&&pending.data?.program){
    const old=pending.data.program;
    const route=life.location.region==='mainland'?educationAdmissionRoute(life.year):null;
    if(!old.wasEnrolled&&['suspended','recommendation'].includes(route?.id))higherDecision(life,capture);
    else {
      const cost=fees(life,old.stage,old.ownership);
      const refreshed={...old,annualTuition:cost.tuition,livingCost:cost.annualLivingCost||0};
      refreshed.scholarship=Math.min(old.scholarship||0,refreshed.annualTuition+refreshed.livingCost);
      fundingDecision(life,refreshed,capture);
    }
  }else if(pending.action==='edu-secondary')secondaryDecision(life,capture);
  else if(['edu-college','edu-suspended','edu-recommendation'].includes(pending.action))higherDecision(life,capture);
  else return pending;
  return rebuilt;
}
export function resolveEducationDecision(life,pending,optionId,env) {
  // Legacy saves carried pending decisions before exam scores and funding plans
  // existed. Re-open the corresponding assessment instead of granting a degree.
  if(['secondary','university','postgraduate','enroll'].includes(pending?.action)) {
    ensureEducationState(life);
    if(pending.action==='secondary')secondaryDecision(life,env);
    else if(pending.action==='postgraduate') {
      if(optionId==='masters')return resolveEducationDecision(life,{action:'edu-postgraduate',data:{target:'masters'}},'apply',env);
      env.offerWork(life);
    } else if(pending.action==='university') {
      if(optionId==='work')env.offerWork(life);
      else higherDecision(life,env);
    } else if(life.age<12)enroll(life,programFor(life,'primary','public',NAMES.primary),env);
    else if(life.age<15)enroll(life,programFor(life,'junior','public',NAMES.junior),env);
    else if(life.age<18)secondaryDecision(life,env);
    else higherDecision(life,env);
    return true;
  }
  if(!pending?.action?.startsWith('edu-'))return false;
  ensureEducationState(life);
  const data=pending.data || {};
  switch(pending.action) {
    case 'edu-secondary': {
      const program=data.programs?.[Number(optionId.replace('school-',''))];
      if(optionId==='work')env.offerWork(life);
      else if(program){
        const contribution=Math.min(familyBudget(life),Math.max(0,program.annualTuition-(program.scholarship||0)));
        if(contribution+(program.scholarship||0)<program.annualTuition){env.log(life,T('家庭目前无法承担这所学校的费用，你先寻找其他求学或技能机会。','家庭目前無法負擔這所學校的費用，你先尋找其他求學或技能機會。','Your household cannot currently cover this school’s cost, so you look for another study or skills route.'),'education');env.offerWork(life);break;}
        life.educationState.seniorSchoolTier=program.schoolTier;enroll(life,{...program,familyContribution:contribution},env);
      }
      break;
    }
    case 'edu-college':
      if(optionId==='repeat') {
        life.educationState.repeats++;life.educationState.repeatUntil=life.age+1;life.focus='learn';
        env.effects(life,{knowledge:4,happiness:-2});
        env.log(life,T('你留出一年重新准备考试，生活并没有自动停下。','你留出一年重新準備考試，生活並沒有自動停下。','You set aside a year to prepare again. Life does not stand still.'),'education');
      } else if(optionId==='work')env.offerWork(life);
      else {const program=data.programs?.[Number(optionId.replace('program-',''))];if(program)fundingDecision(life,program,env);}
      break;
    case 'edu-funding': {
      const program=data.program;
      if(!program)break;
      if(optionId==='family') {
        const topup=Math.max(0,program.annualTuition+program.livingCost-program.familyContribution-(program.scholarship || 0));
        // Funds are checked now and charged by the annual economy settlement.
        // Spending here as well would double-charge the first academic year.
        if(topup>Math.max(0,life.money)){fundingDecision(life,program,env);break;}
        enroll(life,{...program,loanApproved:false,loanCap:0},env);
      } else if(optionId==='loan') {
        const policy=loanPolicyInModelUnits(studentLoanPolicy(life.year,program.stage,life.location.region,{cityName:life.location.name.zhCN}),life.year);
        if(program.loanAttempted||!policy.available||!program.financialNeed||data.gap<=0||data.gap>policy.annualCap) { fundingDecision(life,{...program,loanAttempted:true},env);break; }
        const approved=env.chance(life,.9);
        if(approved) {
          life.studentLoan ||= {balance:0,borrowedByYear:{},approved:true,studyStage:program.stage,graduationYear:null};
          life.studentLoan.approved=true;life.studentLoan.studyStage=program.stage;life.studentLoan.graduationYear=null;
          enroll(life,{...program,loanApproved:true,loanCap:policy.annualCap},env);
          env.log(life,T('助学贷款资格审核通过。此后按学年实际缺口借款，不会一次借满全部学制。','助學貸款資格審查通過。往後依學年實際缺口借款，不會一次借滿整個學制。','Your student-loan eligibility was approved. Borrowing follows actual annual shortfalls, not the full course at once.'),'education');
        } else {env.log(life,T('这次贷款审核未通过，你需要重新安排资金或选择较低费用的路径。','這次貸款審查未通過，你需要重新安排資金或選擇較低費用的途徑。','The loan application was not approved this time. Rework funding or consider a lower-cost route.'),'education');fundingDecision(life,{...program,loanAttempted:true},env);}
      } else if(optionId==='aid') {
        if(env.chance(life,.45+(life.classRank<=2?.2:0)+(program.examScore>=85?.15:0))) {
          const scholarship=Math.round(program.annualTuition*.8+program.livingCost*.6);
          env.log(life,T('你的奖助申请获得支持，预计每学年可用 ¥'+numberText(scholarship)+'支付求学费用。','你的獎助申請獲得支持，預計每學年可用 ¥'+numberText(scholarship)+'支付求學費用。','Your aid application succeeded and can contribute CNY '+numberText(scholarship)+' per academic year toward study costs.'),'education');
          fundingDecision(life,{...program,scholarship,aidAttempted:true},env);
        } else {env.log(life,T('这次奖助申请未获支持，录取选择仍需要可承担的资金方案。','這次獎助申請未獲支持，錄取選擇仍需要可負擔的資金安排。','This aid application was unsuccessful. An affordable funding plan is still needed.'),'education');fundingDecision(life,{...program,aidAttempted:true},env);}
      } else if(optionId==='cheaper') {
        const completedYears=program.resuming?Math.max(0,program.completedAcademicYears || 0):0;
        const remainingYears=program.resuming?Math.max(1,3-Math.min(2,completedYears)):3;
        fundingDecision(life,programFor(life,'associate','public',T('公办高职／专科','公辦高職／專科','Public higher-vocational / associate program'),{examScore:program.examScore,duration:remainingYears,resuming:!!program.resuming,startedAt:program.resuming?life.age:undefined,completedAcademicYears:Math.min(2,completedYears),creditTransferIsModel:!!program.resuming}),env);
      } else if(optionId==='work') {
        life.educationState.deferredOffer=program;
        if(HIGHER.has(program.stage)) {
          life.educationState.suspendedStudy={...program,remainingYears:program.duration,pausedAt:life.age,startedAt:program.startedAt ?? life.age};
          life.school=null;
          env.log(life,T('你保留已完成的学习进度，暂时休学寻找收入。以后每年可以重新申请求学资金；本作不为休学自动增加消费贷款。','你保留已完成的學習進度，暫時休學尋找收入。日後每年可重新申請求學資金；本作不因休學自動增加消費貸款。','You retained completed study progress and took modeled academic leave to seek income. Funding can be reviewed again each year; leave creates no automatic consumer loan.'),'education');
        }
        env.offerWork(life);
      }
      break;
    }
    case 'edu-postgraduate':
      if(optionId==='work')env.offerWork(life);
      else {
        const score=modelScore(life,'postgraduate',env);
        if(life.age<=35&&!(data.target==='doctorate'&&life.educationState.firstHigherAdmissionAge>25)&&score>= (data.target==='doctorate'?82:72)&&env.chance(life,(data.target==='doctorate'?.20:.30)*(life.educationState.firstHigherAdmissionAge>30?.15:1)))fundingDecision(life,programFor(life,data.target,'public',NAMES[data.target],{examScore:score}),env);
        else {env.log(life,T('本次研究生考核未能录取，模拟标准分 '+score+'/100。你决定先积累工作经验。','本次研究所考核未獲錄取，模擬標準分 '+score+'/100。你決定先累積工作經驗。','You were not admitted after the modeled postgraduate assessment ('+score+'/100). Gain work experience first.'),'education',{happiness:-3});env.offerWork(life);}
      }
      break;
    case 'edu-bridge':
      if(optionId==='work')env.offerWork(life);
      else {
        env.effects(life,{knowledge:1,happiness:-1});
        if(modelScore(life,'bridge',env)>=65)fundingDecision(life,programFor(life,'university','public',T('公办本科衔接课程','公辦大學銜接課程','Public bachelor’s bridging program'),{duration:2}),env);
        else {env.log(life,T('这次本科衔接选拔未通过，专科学历仍然有效。','這次大學銜接選拔未通過，專科學歷仍然有效。','The bridging assessment was unsuccessful. Your associate qualification remains valid.'),'education');env.offerWork(life);}
      }
      break;
    case 'edu-recommendation':
      if(optionId==='recommend'){
        life.totals.learning=(life.totals.learning||0)+.75;
        env.effects(life,{knowledge:1,happiness:-1});
      }
      if(optionId==='recommend'&&data.eligible&&env.chance(life,.025))fundingDecision(life,programFor(life,'university','public',T('推荐入学的高校学习','推薦入學的高校學習','University study through recommendation'),{duration:3,field:'agricultural-industrial',mode:'full-time',recommendationIsModel:true}),env);
      else {life.educationState.historicalBlocked=true;env.log(life,T('你继续在实践中生活和学习，等待之后的求学机会。','你繼續在實踐中生活和學習，等待之後的求學機會。','You continue practical work and learning, waiting for later study opportunities.'),'education');env.offerWork(life);}
      break;
    case 'edu-suspended':env.offerWork(life);break;
    default:return false;
  }
  return true;
}
