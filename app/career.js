import { CHINA_JOBS, CHINA_SOCIETY_SOURCES, CULTURAL_EVENTS, culturalEventEligible } from './data/china-society.js';
import { canStartEmployment, legalEmploymentAge, retirementRule, pensionMinimumYears, legalMarriageAge } from './data/china-law.js';
import { noteAssetChange,noteCashChange } from './accounting.js';
const T=(zhCN,zhTW,en)=>({zhCN,zhTW,en});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const rankOf=stage=>({preschool:0,primary:1,junior:2,vocational:3,high:3,associate:3.5,university:4,masters:5,doctorate:6}[stage]??0);
export const SECTOR_NAMES={
  private:T('民营企业','民營企業','Private enterprise'),
  'state-owned':T('国有企业','國有企業','State-owned enterprise'),
  'civil-service':T('公务员','公務員','Civil service'),
  'public-institution':T('事业单位／公共服务','事業單位／公共服務','Public institution / public service'),
  'self-employed':T('个体经营','個體經營','Self-employment'),
  agriculture:T('农业生产','農業生產','Agriculture'),
};
const ENTRY_NAMES={
  'civil-exam':T('公务员考试与考察','公務員考試與考察','Civil-service examination and assessment'),
  'teacher-qualification':T('教师资格与岗位招聘','教師資格與職位招聘','Teaching qualification and recruitment'),
  'public-exam':T('事业单位公开招聘','事業單位公開招聘','Public-institution recruitment'),
  'professional-license':T('专业资格与岗位考核','專業資格與職位考核','Professional qualification and recruitment'),
};
export function ensureCareerState(life){
  life.qualifications||={};
  life.contributionYears=Number.isFinite(life.contributionYears)?life.contributionYears:0;
  life.everWorked=life.everWorked??!!(life.job||life.lastJob||life.totals?.earned);
  life.birthMonth=Number.isInteger(life.birthMonth)?life.birthMonth:1;
  life.culturalSeen||={};
  if(life.job){
    const base=CHINA_JOBS.find(j=>j.id===life.job.id);
    if(base)life.job={...base,...life.job};
  }
  return life;
}
export function employmentAllowed(life,job=null){
  const mainland=canStartEmployment({age:life.age,region:life.location.region,year:life.year,
    compulsoryComplete:rankOf(life.education)>=2,isEnrolled:!!life.school,hazardous:job?.hazardous??false});
  if(mainland!==null)return mainland;
  const minimum=legalEmploymentAge(life.location.region,life.year);
  return minimum!==null&&life.age>=minimum&&!life.school&&rankOf(life.education)>=2&&(!job?.hazardous||life.age>=18);
}
function qualificationFor(job,year){
  if(job.entry==='direct'||year<(job.entrySinceYear??job.minYear))return null;
  return job.entry;
}
export function careerEligibility(life,job,registration=null){
  if(life.year<job.minYear||life.year>(job.maxYear??Infinity))return 'era';
  if(life.age<job.minAge)return 'age';
  if(job.educationRank>rankOf(life.education))return 'education';
  if(job.urban===false&&life.urban)return 'residence';
  if(!employmentAllowed(life,job))return 'employment-law-or-enrollment';
  return permittedCareer(life,job,registration)?'eligible':'recruitment';
}
function permittedCareer(life,job,registration=null){
  if(life.year<job.minYear||life.year>(job.maxYear??Infinity)||life.age<job.minAge||job.educationRank>rankOf(life.education))return false;
  if(job.urban===false&&life.urban)return false;
  if(!employmentAllowed(life,job))return false;
  if(life.flags.ruralMigrantYear&&life.year-life.flags.ruralMigrantYear<=5&&rankOf(life.education)<4&&!/factory|textile|welder|electrician|plumber|construction|carpenter|machine-technician|quality-control|robotics|mechanic/.test(job.id))return false;
  if(job.entry==='civil-exam'&&life.location.region==='mainland'){
    // Postgraduate age relaxation is for current graduating cohorts, not every holder.
    const freshPostgraduate=rankOf(life.education)>=5&&life.educationState?.graduationAge===life.age;
    const limit=life.year>=2026?(freshPostgraduate?43:38):(freshPostgraduate?40:35);
    const timelyApplication=registration?.eligibleAtRegistration&&registration.job?.id===job.id&&life.year===registration.applicantYear+1;
    if(!timelyApplication&&life.age>limit)return false;
  }
  return true;
}
export function candidateCareers(life){
  ensureCareerState(life);
  return CHINA_JOBS.filter(job=>permittedCareer(life,job)&&(job.sector!=='self-employed'||life.money>=life.profile.typicalIncome*.15));
}
function offeredJob(life,job,env){
  return {...job,marketIncomeReference:life.profile.typicalIncome,salary:Math.round(life.profile.typicalIncome*job.multiplier*(life.earningPotential||1)*(.84+env.normal(life)*.08)*(.85+life.stats.knowledge/300))};
}
function sourceUrls(keys){
  return CHINA_SOCIETY_SOURCES.filter(s=>keys?.includes(s.id)).map(s=>s.url);
}
export function offerCareers(life,env,title=T('寻找下一份工作','尋找下一份工作','Finding your next job')){
  if(!employmentAllowed(life))return false;
  const candidates=candidateCareers(life);
  const jobs=[];
  const pool=[...candidates];
  // Keep several sectors visible, rather than randomly hiding every regulated route.
  for(const sector of ['private','state-owned','civil-service','public-institution','agriculture','self-employed']){
    const choices=pool.filter(j=>j.sector===sector);
    if(choices.length){
      const job=choices[env.integer(life,0,choices.length-1)];
      jobs.push(offeredJob(life,job,env));pool.splice(pool.indexOf(job),1);
    }
  }
  while(jobs.length<5&&pool.length)jobs.push(offeredJob(life,pool.splice(env.integer(life,0,pool.length-1),1)[0],env));
  if(!jobs.length)return false;
  const options=jobs.map((job,i)=>{
    const gate=qualificationFor(job,life.year);
    const qualified=!gate||life.qualifications[job.id];
    const description=T(
      SECTOR_NAMES[job.sector].zhCN+' · 模型年收入 ¥'+job.salary.toLocaleString('en-US')+(qualified?'':' · 先参加'+ENTRY_NAMES[gate].zhCN),
      SECTOR_NAMES[job.sector].zhTW+' · 模型年收入 ¥'+job.salary.toLocaleString('en-US')+(qualified?'':' · 先參加'+ENTRY_NAMES[gate].zhTW),
      SECTOR_NAMES[job.sector].en+' · Modeled annual CNY '+job.salary.toLocaleString('en-US')+(qualified?'':' · First complete '+ENTRY_NAMES[gate].en.toLowerCase()));
    const firstRural=!life.urban&&!life.everWorked;const manual=/farmer|livestock|fishery|mechanic|factory|textile|welder/.test(job.id);
    return env.option('career-'+i,job.name,description,job.sector==='agriculture'&&firstRural?9:manual&&life.education==='vocational'?5:job.sector==='civil-service'?.9:2);
  });
  options.push(env.option('wait',T('继续寻找或准备资格','繼續尋找或準備資格','Continue searching or preparing'),T('不会因为等待而自动获得公务员或教师岗位','不會因等待而自動獲得公務員或教師職位','Waiting never automatically grants a civil-service or teaching post'),.55));
  env.decision(life,'career-offer',title,T(
    '岗位按年代、学历、年龄和准入条件筛选。公务员、教师与其他受监管岗位须先完成对应考试、资格和招聘程序。',
    '職位依年代、學歷、年齡與准入條件篩選。公務員、教師與其他受規範職位須先完成相應考試、資格及招聘程序。',
    'Jobs depend on era, education, age and entry requirements. Regulated posts require the relevant examination, qualification and recruitment process.'),
    options,{jobs,sourceUrls:sourceUrls(['civil-service-law','civil-exam-1994','teacher-qualification-1995','public-recruitment-2006'])});
  return true;
}
export function acceptCareer(life,job,env,registration=null){
  if(!employmentAllowed(life,job))return false;
  const canonical=CHINA_JOBS.find(j=>j.id===job.id);
  if(canonical){
    if(!permittedCareer(life,canonical,registration))return false;
    const gate=qualificationFor(canonical,life.year);
    if(gate&&!life.qualifications[canonical.id])return false;
  }
  if(canonical?.sector==='self-employed'&&!env.spend(life,life.profile.typicalIncome*.15,'self-employment-capital'))return false;
  life.workHistory||=[];if(life.job)life.lastJob={...life.job};
  life.workHistory.push({id:job.id,sector:job.sector,year:life.year,age:life.age});
  life.job={...canonical,...job,years:0,marketIncomeReference:life.profile.typicalIncome};
  life.everWorked=true;life.retired=false;life.income=job.salary;life.focus='balance';
  env.log(life,T('你成为了'+job.name.zhCN+'，开始积累工作经验和社会保障缴费。','你成為了'+job.name.zhTW+'，開始累積工作經驗與社會保障繳費。','You began work as a '+job.name.en.toLowerCase()+', building experience and social-insurance contributions.'),'work',{happiness:4});
  return true;
}
export function resolveCareerDecision(life,pending,id,env){
  ensureCareerState(life);
  if(pending.action==='career-offer'){
    if(id==='wait')return true;
    const job=pending.data.jobs[Number(id.split('-')[1])];
    if(!job||!permittedCareer(life,job))return true;
    const gate=qualificationFor(job,life.year);
    if(gate&&!life.qualifications[job.id]){
      life.careerPreparation={job,gate,examYear:life.year+1,applicantYear:life.year,registrationAge:life.age,eligibleAtRegistration:true};
      env.log(life,T('你报名准备'+ENTRY_NAMES[gate].zhCN+'。录用仍需考试、面试或考察，不保证成功。','你報名準備'+ENTRY_NAMES[gate].zhTW+'。錄用仍需考試、面試或考察，不保證成功。','You began preparing for '+ENTRY_NAMES[gate].en.toLowerCase()+'. Examination, interview or assessment is still required.'),'work');
    }else acceptCareer(life,job,env);
    return true;
  }
  if(pending.action==='career-result'){
    if(id==='accept'&&pending.data.passed){
      life.qualifications[pending.data.job.id]=true;
      acceptCareer(life,pending.data.job,env,pending.data.registration);
    }
    return true;
  }
  if(pending.action==='retirement-law'){
    const current=retirementFor(life);
    const monthReached=life.year>current.retirementYear||life.year===current.retirementYear&&(life.uiProgress??1)>=(current.retirementMonth-1)/12;
    if(!life.job||!monthReached){
      life.flags.retirementOffered=false;delete life.flags.retirementDeferredUntil;life.retirementRule=current;
      env.log(life,T('岗位或退休类别已经变化，原退休提醒不再适用；按当前岗位重新计算。','職位或退休類別已變更，原退休提醒不再適用；按目前職位重新計算。','The job or retirement category changed; the previous reminder no longer applies and the current rule is recalculated.'),'work');
      return true;
    }
    life.retirementRule=current;
    if(id==='defer'&&pending.data.flexible){
      life.flags.retirementDeferredUntil=life.year+3;
      life.flags.retirementOffered=false;
      env.log(life,T('你与单位协商，按模型延后最多三年退休。','你與單位協商，依模型延後最多三年退休。','You agreed a modeled delay of up to three years with your employer.'),'work');
    }else retireWithContributions(life,env);
    return true;
  }
  if(pending.action==='culture'){
    const event=CULTURAL_EVENTS.find(e=>e.id===pending.data.eventId);
    const choice=event?.options.find(o=>o.id===id);
    if(choice){
      const fx={...choice.effects};
      const cost=Math.max(0,fx.costRatio??-(fx.moneyRatio??0))*life.profile.typicalIncome;
      delete fx.costRatio;delete fx.moneyRatio;
      if(cost>0&&!env.spend(life,cost,'family')){
        env.log(life,T('积蓄不足，你改用时间、沟通或公共支持回应家人的需要，没有自动借款。','積蓄不足，你改用時間、溝通或公共支持回應家人的需要，沒有自動借款。','Savings were insufficient. You used time, communication or public support instead, without automatic borrowing.'),'family');
        delete fx.money;
      }
      if(fx.careerExamPreparation){life.flags.examPreparation=(life.flags.examPreparation||0)+fx.careerExamPreparation;delete fx.careerExamPreparation;}
      life.familyExpectations=clamp((life.familyExpectations||50)+(fx.familyExpectation||0),0,100);delete fx.familyExpectation;
      env.effects(life,fx);
      const record=env.log(life,choice.description||choice.label,'culture');
      record.sourceUrls=sourceUrls(event.sourceKeys);
    }
    return true;
  }
  return false;
}
export function careerYear(life,env){
  ensureCareerState(life);
  if(life.job&&!life.retired&&life.job.sector!=='self-employed'&&life.job.sector!=='agriculture')life.contributionYears+=1;
  const preparation=life.careerPreparation;
  if(preparation&&life.year>=preparation.examYear){
    life.careerPreparation=null;
    const eligible=permittedCareer(life,preparation.job,preparation);
    const score=clamp(28+life.stats.knowledge*.65+env.normal(life)*11+(life.flags.examPreparation||0)*2,0,100);
    const threshold=preparation.gate==='civil-exam'?79:preparation.gate==='public-exam'?72:65;
    const passed=eligible&&score>=threshold&&env.chance(life,preparation.gate==='civil-exam'?.65:.85);
    const result=T('模拟考核分 '+Math.round(score)+'/100。'+(passed?'你通过了考试与后续考核，可以接受岗位。':'这次未能完成全部录用条件。'),'模擬考核分 '+Math.round(score)+'/100。'+(passed?'你通過考試與後續考核，可以接受職位。':'這次未能完成全部錄用條件。'),'Modeled assessment '+Math.round(score)+'/100. '+(passed?'You passed the examination and subsequent assessment.':'You did not meet every recruitment condition this time.'));
    env.decision(life,'career-result',ENTRY_NAMES[preparation.gate],result,passed?[
      env.option('accept',T('接受岗位','接受職位','Accept the post'),preparation.job.name,3),
      env.option('decline',T('保留现有安排','保留現有安排','Keep your current plans'))]:
      [env.option('continue',T('整理经验，继续努力','整理經驗，繼續努力','Reflect and keep going'))],
      {job:preparation.job,passed,score,registration:preparation,sourceUrls:sourceUrls(preparation.job.sourceKeys)});
  }
  const risk=life.marketContext?.unemploymentRisk||0;
  if(life.job&&!life.retired&&risk>0&&env.chance(life,risk*(life.job.sector==='state-owned'?.35:1))){
    life.lastJob={...life.job};life.job=null;life.income=0;
    env.log(life,T('经济和行业变化影响了你的岗位，你开始重新寻找机会。','經濟與產業變化影響了你的職位，你開始重新尋找機會。','Economic and industry changes affected your job. You began searching again.'),'work',{happiness:-5});
  }
}
export function retirementFor(life){
  ensureCareerState(life);
  const job=life.job||life.lastJob;
  const category=job?.retirementCategory||'worker';
  const rule=retirementRule({birthYear:life.birthYear,birthMonth:life.birthMonth,sex:life.sex,category,region:life.location.region,year:life.year});
  if(rule)return {...rule,jurisdiction:'mainland',statutory:true};
  if(life.location.region==='mainland'&&category==='self-employed')return {ageMonths:65*12,retirementYear:life.birthYear+65,retirementMonth:life.birthMonth,statutory:false,jurisdiction:'mainland',sourceIds:[]};
  // These are playable job-exit references, not a single statutory retirement
  // age. HK MPF withdrawal and TW/MO pension claiming remain separate below.
  const region=life.location.region;
  const sourceIds=region==='hongkong'?['hk-mpf']:region==='taiwan'?['tw-labor-pension']:['mo-social-pension'];
  return {ageMonths:65*12,retirementYear:life.birthYear+65,retirementMonth:life.birthMonth,statutory:false,jurisdiction:region,sourceIds,modelOnly:true,benefitKind:region==='hongkong'?'mpf-withdrawal':region==='taiwan'?'labor-insurance-claim':'social-pension-claim'};
}
export function retirementMilestone(life,fraction,env){
  if(!life.job||life.retired||life.flags.retirementOffered)return false;
  const rule=retirementFor(life);
  const due=life.flags.retirementDeferredUntil?life.year>=life.flags.retirementDeferredUntil:
    life.year>rule.retirementYear||life.year===rule.retirementYear&&fraction>=(rule.retirementMonth-1)/12;
  if(!due)return false;
  life.flags.retirementOffered=true;life.retirementRule=rule;
  const years=Math.floor(rule.ageMonths/12),months=rule.ageMonths%12;
  const flexible=rule.statutory&&life.year>=2025&&!life.flags.retirementDeferredUntil;
  const description=T(
    (rule.statutory?'按出生年月、性别与原退休类别，本次法定退休年龄为':'此岗位采用游戏退休参考年龄：')+years+'岁'+(months?months+'个月':'')+'。养老金另需满足缴费条件；当前模型缴费'+Math.floor(life.contributionYears)+'年。',
    (rule.statutory?'依出生年月、性別與原退休類別，本次法定退休年齡為':'此職位採用遊戲退休參考年齡：')+years+'歲'+(months?months+'個月':'')+'。退休給付另須符合繳費條件；目前模型繳費'+Math.floor(life.contributionYears)+'年。',
    (rule.statutory?'The statutory age for your birth month, sex and original category is ':'This job uses a modeled retirement reference of ')+years+' years '+months+' months. Pension entitlement is separate. Modeled contribution years: '+Math.floor(life.contributionYears)+'.');
  const options=[env.option('retire',T('办理退休，安排下一阶段','辦理退休，安排下一階段','Retire and plan the next stage'),undefined,3)];
  if(flexible)options.push(env.option('defer',T('与单位协商弹性延后','與單位協商彈性延後','Discuss flexible postponement'),T('本作简化为延后三年，需协商；不是所有人自动适用','本作簡化為延後三年，須協商；並非人人自動適用','A simplified three-year delay by agreement; not automatic for every worker'),.6));
  env.decision(life,'retirement-law',T('退休与下一段生活','退休與下一段生活','Retirement and the next stage'),description,options,{rule,flexible});
  return true;
}
export function retireWithContributions(life,env){
  const region=life.location.region,minimum=pensionMinimumYears(life.year,region);
  const eligible=minimum!==null&&life.contributionYears>=minimum;
  const salary=life.job?.salary||life.income;
  if(region==='mainland'){
    life.pension=eligible?Math.round(Math.max(life.profile.typicalIncome*.22,salary*.38)):0;
    life.basicSupport=eligible?0:Math.round(life.profile.typicalIncome*.12);
  }else if(region==='taiwan'){
    // 1.55% per modeled contribution year is an illustrative insured-wage
    // approximation; actual benefits use official wage histories and elections.
    life.pension=eligible?Math.round(salary*Math.min(.60,life.contributionYears*.0155)):0;
    life.basicSupport=0;
  }else if(region==='macau'){
    const residence=(life.residenceYears?.macau||0)>=7;
    life.pension=eligible&&residence?Math.round(life.profile.typicalIncome*.16):0;
    life.basicSupport=0;
  }else{
    // MPF is a personal accumulated balance, not an automatic annual annuity.
    const saved=life.assets?.retirement||0;
    const beforeCash=life.money;life.money+=saved;noteCashChange(life,beforeCash,life.money);life.assets.retirement=0;noteAssetChange(life,'retirement',saved,0);life.mpfWithdrawal=saved;
    life.pension=0;life.basicSupport=0;
  }
  life.pensionJurisdiction=region;
  life.lastJob=life.job?{...life.job}:life.lastJob;life.job=null;life.retired=true;
  life.income=life.pension+life.basicSupport;life.focus='family';
  const record=env.log(life,T(
    region==='hongkong'?'你结束工作并提取模型强积金个人账户；这不是自动发放的年金。':'你结束了这段工作。'+(life.pension>0?'按本地模型条件安排退休给付。':'尚未满足本作的本地养老金条件，之后依积蓄安排生活。'),
    region==='hongkong'?'你結束工作並提取模型強積金個人帳戶；這不是自動發放的年金。':'你結束了這段工作。'+(life.pension>0?'按本地模型條件安排退休給付。':'尚未符合本作的本地退休金條件，日後依積蓄安排生活。'),
    region==='hongkong'?'You left work and withdrew the modeled MPF account; this is not an automatic annuity.':'You left work. '+(life.pension>0?'A simplified local retirement benefit applies.':'The modeled local pension conditions are not met; later living depends on savings.')),'work',{health:3,happiness:3});
  record.sourceIds=life.retirementRule?.sourceIds||[];
}
export function marriageAllowed(life){
  if(!(life.flags?.marriageCount>0)&&life.age>55)return false;
  const required=legalMarriageAge(life.sex,life.location.region,life.year)??18;
  const partnerRequired=legalMarriageAge(life.sex==='male'?'female':'male',life.location.region,life.year)??18;
  if(life.location.region==='hongkong'&&(life.age<21||life.family.partner?.age<21)&&!life.flags.guardianMarriageConsent)return false;
  if(life.location.region==='macau'&&(life.age<18||life.family.partner?.age<18)&&!life.flags.guardianMarriageConsent)return false;
  return life.age>=required&&!!life.family.partner?.alive&&life.family.partner.age>=partnerRequired;
}
export function culturalMilestone(life,env){
  ensureCareerState(life);
  if(life.pending||life.pendingQueue.length||life.age<6)return false;
  const pool=CULTURAL_EVENTS.filter(event=>culturalEventEligible(event,life)&&life.year-(life.culturalSeen[event.id]??-100)>=(event.cooldownYears??6));
  // Predictable opportunities across life stages, with individual random variation.
  if(!pool.length||!env.chance(life,.34))return false;
  const event=pool[env.integer(life,0,pool.length-1)];
  life.culturalSeen[event.id]=life.year;
  env.decision(life,'culture',event.title,event.description,event.options.map(o=>({...o})),{eventId:event.id,sourceUrls:sourceUrls(event.sourceKeys)},'culture');
  return true;
}
