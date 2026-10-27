import {developmentAt} from './development.js';
/**
 * Mainland China rules verified against public primary sources on 2026-10-25.
 * A fact lookup is not a complete legal-advice service. Monetary examples and
 * exam bands explicitly marked modelOnly are scenario parameters, not official
 * national prices, provincial score lines or guaranteed admissions.
 */
const T = (zhCN, zhTW, en) => ({ zhCN, zhTW, en });
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const mainland = region => region === 'mainland';
export const CHINA_LAW_CHECKED_AT = '2026-10-25';
export const CHINA_LAW_SOURCES = [
  { id:'hk-young-workers', title:T('香港雇佣条例：雇用儿童及青年','香港僱傭條例：僱用兒童及青年','Hong Kong Employment Ordinance: children and young persons'),url:'https://www.labour.gov.hk/eng/legislat/content2.htm',checkedAt:'2026-10-26',historicalYearsModelOnly:true,scope:'hongkong' },
  { id:'tw-young-workers', title:T('台湾劳动基准法第44、45条','台灣勞動基準法第44、45條','Taiwan Labor Standards Act, articles 44–45'),url:'https://laws.mol.gov.tw/FLAW/FLAWDOC04.aspx?id=FL014930&ldate=20200610&lno=45',checkedAt:'2026-10-26',historicalYearsModelOnly:true,scope:'taiwan' },
  { id:'mo-young-workers', title:T('澳门劳动事务局未成年雇员须知','澳門勞工事務局未成年僱員須知','Macao Labour Affairs Bureau: minor workers'),url:'https://www.dsal.gov.mo/en/text/labor_problem_problem_set_employer.html',checkedAt:'2026-10-26',historicalYearsModelOnly:true,scope:'macau' },
  { id:'tw-marriage-2023', title:T('台湾民法第980条及2023年修法生效','台灣民法第980條及2023年修法生效','Taiwan Civil Code article 980 and 2023 commencement'),url:'https://www.judicial.gov.tw/tw/cp-1454-359073-62da4-1.html',effectiveFrom:'2023-01-01',scope:'taiwan' },
  { id:'hk-marriage', title:T('香港婚姻条例的最低年龄与同意要求','香港婚姻條例的最低年齡與同意要求','Hong Kong Marriage Ordinance age and consent'),url:'https://www.immd.gov.hk/pdforms/mr4.pdf',checkedAt:'2026-10-26',historicalYearsModelOnly:true,scope:'hongkong' },
  { id:'mo-marriage', title:T('澳门民法典第1479、1487条','澳門民法典第1479、1487條','Macao Civil Code articles 1479 and 1487'),url:'https://www.al.gov.mo/file/lei/codigo/civil/cn/c1401-1600.htm',effectiveFrom:'1999-12-20',scope:'macau' },
  { id:'hk-mpf', title:T('香港积金局：65岁退休提取强积金','香港積金局：65歲退休提取強積金','MPFA: withdrawal at age 65'),url:'https://www.mpfa.org.hk/en/mpf-system/withdrawal-of-mpf/withdrawal-of-mpf-upon-retirement',effectiveFrom:'2000-12-01',scope:'hongkong' },
  { id:'tw-labor-pension', title:T('台湾劳保局老年年金年龄与年资','台灣勞保局老年年金年齡與年資','Taiwan labor-insurance old-age pension age and contributions'),url:'https://www.bli.gov.tw/0019821.html',effectiveFrom:'2009-01-01',scope:'taiwan' },
  { id:'mo-social-pension', title:T('澳门社会保障基金养老金条件','澳門社會保障基金養老金條件','Macao Social Security Fund pension conditions'),url:'https://www.fss.gov.mo/text/zh-hant/social/social-faq',effectiveFrom:'2011-01-01',scope:'macau' },
  { id:'retirement-2024', title:T('渐进式延迟法定退休年龄决定及附件','漸進式延遲法定退休年齡決定及附件','Gradual statutory retirement reform and tables'), url:'https://www.guangde.gov.cn/file_xc/5/202411/2024110146297beccc1b4c9a9d149f66369cc037.pdf', effectiveFrom:'2025-01-01', scope:'mainland' },
  { id:'retirement-1978', title:T('人社部关于原退休年龄类别的答复','人社部關於原退休年齡類別的答覆','Ministry explanation of original retirement categories'), url:'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zhgl/jytabl/jydf/201811/t20181123_305405.html', effectiveFrom:'1978-06-02', scope:'mainland' },
  { id:'flexible-retirement-2025', title:T('实施弹性退休制度暂行办法','實施彈性退休制度暫行辦法','Flexible retirement implementation rules'), url:'https://www.mohrss.gov.cn/wap/xw/rsxw/202501/t20250101_533705.html', effectiveFrom:'2025-01-01', scope:'mainland' },
  { id:'labor-law', title:T('劳动法第十五条、第六十四条','勞動法第十五條、第六十四條','Labour Law, articles 15 and 64'), url:'https://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/fl/202011/t20201102_394625.html', effectiveFrom:'1995-01-01', scope:'mainland' },
  { id:'child-labor-1991', title:T('1991年禁止使用童工规定','1991年禁止使用童工規定','1991 child labour prohibition'), url:'https://www.gov.cn/gongbao/shuju/1991/gwyb199117.pdf', effectiveFrom:'1991-04-15', scope:'mainland' },
  { id:'child-labor-2002', title:T('禁止使用童工规定','禁止使用童工規定','Child labour prohibition regulations'), url:'https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/tnull_27719.html', effectiveFrom:'2002-12-01', scope:'mainland' },
  { id:'compulsory-education', title:T('义务教育法','義務教育法','Compulsory Education Law'), url:'https://www.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_jyfl/202110/t20211029_575949.html', effectiveFrom:'1986-07-01', scope:'mainland' },
  { id:'education-free-2008', title:T('城乡全面免除义务教育学杂费历程','城鄉全面免除義務教育學雜費歷程','Expansion of free compulsory education'), url:'https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/s3580/moe_2395/moe_2409/tnull_38342.html', effectiveFrom:'2008-09-01', scope:'mainland' },
  { id:'civil-code', title:T('民法典第17、18、1047条','民法典第17、18、1047條','Civil Code, articles 17, 18 and 1047'), url:'https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250312_1958939.html', effectiveFrom:'2021-01-01', scope:'mainland' },
  { id:'marriage-1980', title:T('1980年婚姻法','1980年婚姻法','1980 Marriage Law'), url:'https://www.nhc.gov.cn/fzs/c100048/198009/22ce10fa231e499389753e10a0035f0a.shtml', effectiveFrom:'1981-01-01', scope:'mainland' },
  { id:'marriage-history', title:T('北京市婚姻登记工作规范中的历史法定婚龄','北京市婚姻登記工作規範中的歷史法定婚齡','Historical marriage ages in Beijing registration guidance'), url:'https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/201605/t20160510_567105.html', effectiveFrom:'1950-05-01', scope:'mainland' },
  { id:'loan-rule-2024', title:T('个人贷款管理办法','個人貸款管理辦法','Personal loan management measures'), url:'https://www.moj.gov.cn/pub/sfbgw/flfggz/flfggzbmgz/202410/t20241031_508785.html', effectiveFrom:'2024-07-01', scope:'mainland' },
  { id:'student-loan-start', title:T('国家助学贷款试点和全面推行范围','國家助學貸款試點和全面推行範圍','Student-loan pilot and nationwide expansion'), url:'https://www.moe.gov.cn/moe_879/moe_1252/s6035/s6038/s2992/moe_1238/tnull_13370.html', effectiveFrom:'1999-09-01', scope:'mainland' },
  { id:'student-loan-history', title:T('国家助学贷款额度历史','國家助學貸款額度歷史','Historical student-loan limits'), url:'https://www.moe.gov.cn/jyb_xwfb/s5147/202306/t20230612_1063823.html', effectiveFrom:'1999-09-01', scope:'mainland' },
  { id:'student-loan-campus-living', title:T('教育部助学贷款发放与生活费问答','教育部助學貸款發放與生活費問答','Ministry guidance on campus student-loan disbursements and living costs'), url:'https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/s7865/s8235/s8239/s8245/201407/t20140731_172617.html', effectiveFrom:'2004-08-01', scope:'mainland' },
  { id:'student-loan-2014', title:T('2014年国家助学贷款政策','2014年國家助學貸款政策','2014 student-loan policy'), url:'https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1779/201407/t20140725_172275.html', effectiveFrom:'2014-07-01', scope:'mainland' },
  { id:'student-loan-2021', title:T('2021年国家助学贷款政策','2021年國家助學貸款政策','2021 student-loan policy'), url:'https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1779/202112/t20211221_588921.html', effectiveFrom:'2021-09-01', scope:'mainland' },
  { id:'student-loan-2020', title:T('2020年国家助学贷款宽限与期限调整','2020年國家助學貸款寬限與期限調整','2020 student-loan grace period and term changes'), url:'https://www.moe.gov.cn/srcsite/A05/s7505/202007/t20200721_474049.html', effectiveFrom:'2020-07-03', scope:'mainland' },
  { id:'student-loan-2023', title:T('2023年国家助学贷款政策','2023年國家助學貸款政策','2023 student-loan policy'), url:'https://www.moe.gov.cn/srcsite/A05/s7505/202309/t20230915_1080601.html', effectiveFrom:'2023-09-01', scope:'mainland' },
  { id:'student-loan-2024', title:T('2024年国家助学贷款政策','2024年國家助學貸款政策','2024 student-loan policy'), url:'https://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1779/202411/t20241104_1160686.html', effectiveFrom:'2024-09-01', scope:'mainland' },
  { id:'student-loan-2026-check', title:T('2026年教育部国家助学贷款发布会','2026年教育部國家助學貸款發布會','2026 Ministry student-loan briefing'), url:'https://www.moe.gov.cn/fbh/live/2026/78343/twwd/202607/t20260728_1445368.html', effectiveFrom:'2026-07-28', scope:'mainland' },
  { id:'school-admission', title:T('高中阶段学校考试招生改革指导意见','高中階段學校考試招生改革指導意見','Senior-secondary admission reform guidance'), url:'https://www.moe.gov.cn/srcsite/A06/s3732/201609/t20160920_281610.html', effectiveFrom:'2016-09-19', scope:'mainland' },
  { id:'gaokao-history', title:T('恢复高考及1952年统考历史','恢復高考及1952年統考歷史','History of national university entrance examinations'), url:'https://www.moe.gov.cn/jyb_xwfb/xw_zt/moe_357/s3580/moe_2448/moe_2450/moe_2451/tnull_39623.html', effectiveFrom:'1977-01-01', scope:'mainland' },
  { id:'higher-education-aid-history', title:T('中国学生资助70年','中國學生資助70年','Seventy years of student financial support'), url:'https://www.moe.gov.cn/jyb_xwfb/s5147/201909/t20190924_400640.html', effectiveFrom:'1950-01-01', scope:'mainland' },
  { id:'admission-batches', title:T('教育部关于一本、二本、三本的解释','教育部關於一本、二本、三本的解釋','Ministry explanation of admission batches'), url:'https://www.moe.gov.cn/moe_879/moe_1252/s8447/201412/t20141204_180289.html', effectiveFrom:'2014-12-04', scope:'mainland' },
  { id:'private-fees', title:T('民办教育促进法收费规定','民辦教育促進法收費規定','Private Education Promotion Law fee rules'), url:'https://hudong.moe.gov.cn/jyb_sjzl/sjzl_zcfg/zcfg_jyfl/202204/t20220421_620261.html', effectiveFrom:'2018-12-29', scope:'mainland' },
  { id:'sichuan-fees-example', title:T('四川农业大学2023年公办高校学费备案实例','四川農業大學2023年公辦高校學費備案實例','2023 public-university fee example in Sichuan'), url:'https://zs.sicau.edu.cn/info/1034/1026.htm', effectiveFrom:'2023-09-01', scope:'mainland' },
];

/**
 * category describes the ORIGINAL statutory retirement category, not the job's
 * prestige: female50/worker and female55/cadre/management/professional.
 * A self-employed person has no modeled mandatory employer retirement date.
 * Birth month is 1..12. year selects the law visible at that simulated time.
 */
export function retirementRule({ birthYear, birthMonth = 1, sex, category = 'worker', region = 'mainland', year = 2026 } = {}) {
  if (!mainland(region) || !finite(birthYear) || !['male','female'].includes(sex) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) return null;
  if (['self-employed','unemployed','none'].includes(category)) return null;
  const female55 = ['female55','cadre','management','professional','civil-service','public-institution'].includes(category);
  const baseAgeMonths = sex === 'male' ? 720 : female55 ? 660 : 600;
  const birthMonthIndex = Math.trunc(birthYear) * 12 + birthMonth - 1;
  const firstAffectedBirthYear = sex === 'male' ? 1965 : female55 ? 1970 : 1975;
  const monthsFromStart = birthMonthIndex - firstAffectedBirthYear * 12;
  const reformVisible = year >= 2025 && monthsFromStart >= 0;
  const delayMonths = reformVisible ? clamp(Math.floor(monthsFromStart / (sex === 'female' && !female55 ? 2 : 4)) + 1, 0, sex === 'female' && !female55 ? 60 : 36) : 0;
  const ageMonths = baseAgeMonths + delayMonths;
  const retirementIndex = birthMonthIndex + ageMonths;
  return {
    ageMonths, baseAgeMonths, delayMonths,
    retirementYear: Math.floor(retirementIndex / 12),
    retirementMonth: retirementIndex % 12 + 1,
    category: sex === 'male' ? 'male60' : female55 ? 'female55' : 'female50',
    sourceIds: year >= 2025 ? ['retirement-1978','retirement-2024'] : ['retirement-1978'],
    modelOnly: year < 1978,
    pensionEligibilitySeparate: true,
    note: T('普通职工基准；特殊工种、伤残、特定干部及弹性退休另有条件，养老金还需满足缴费条件。','一般職工基準；特殊工種、傷殘、特定幹部及彈性退休另有條件，養老金仍需符合繳費條件。','Standard employee baseline. Special occupations, disability, specific cadres and flexible retirement have additional rules; pension contributions are separate.'),
  };
}
export const retirementAgeMonths = options => retirementRule(options)?.ageMonths ?? null;
export function pensionMinimumYears(year = 2026, region = 'mainland') {
  if(region==='taiwan')return year>=2009?15:null;
  if(region==='macau')return year>=2011?5:null;
  if (!mainland(region)) return null;
  return year < 2030 ? 15 : Math.min(20, 15 + (Math.floor(year) - 2029) * .5);
}
export function legalEmploymentAge(region = 'mainland', year = 2026) {
  if(region==='hongkong'||region==='taiwan')return 15;
  if(region==='macau')return 16;
  return mainland(region) && year >= 1991 ? 16 : null;
}
export function employmentRule(region = 'mainland', year = 2026) {
  if (!mainland(region)) return null;
  return {
    legalMinimumAge: legalEmploymentAge(region, year),
    gameMinimumAge: 16,
    protectedMinorFrom: 16, protectedMinorUntil: 18,
    modelOnly: year < 1991,
    sourceIds: year >= 1995 ? ['labor-law','child-labor-2002'] : year >= 1991 ? ['child-labor-1991'] : [],
    note: T('一般岗位16岁起；16至17岁为未成年工，不能安排矿山井下、有毒有害等禁忌劳动。本作不开放特殊文体童工例外。','一般職位16歲起；16至17歲為未成年工，不得安排礦山井下、有毒有害等禁忌勞動。本作不開放特殊文體例外。','Ordinary employment begins at 16. Workers aged 16–17 receive special protection and cannot perform prohibited hazardous work. Special artistic or sporting exceptions are not playable.'),
  };
}
export function canStartEmployment({ age, region = 'mainland', year = 2026, compulsoryComplete = true, isEnrolled = false, hazardous = false } = {}) {
  if (!mainland(region)) return null;
  if (!finite(age) || age < 16 || isEnrolled || (year >= 1986 && !compulsoryComplete)) return false;
  return !hazardous || age >= 18;
}
export function compulsoryYears(region = 'mainland', year = 2026) {
  return mainland(region) && year >= 1986 ? 9 : null;
}
export function compulsoryEducationPolicy({ region = 'mainland', year = 2026, urban = true, westernRural = false } = {}) {
  if (!mainland(region)) return null;
  const freeTuition = year >= 1986;
  const freeMiscFees = year >= (urban ? 2008 : westernRural ? 2006 : 2007);
  return { years: compulsoryYears(region, year), stages:['primary','junior'], includesHighSchool:false, freeTuition, freeMiscFees, sourceIds:['compulsory-education','education-free-2008'], note:T('九年为小学与初中；高中不属于全国九年义务教育。免费学杂费也不意味着所有生活、住宿或自愿服务费用均为零。','九年為小學與初中；高中不屬於全國九年義務教育。免學雜費不表示所有生活、住宿或自願服務費用均為零。','The nine years cover primary and junior secondary school, not senior high school. Free tuition does not make every living, boarding or optional-service cost zero.') };
}
export function legalMarriageAge(sex, region = 'mainland', year = 2026) {
  if(!['male','female'].includes(sex)||year<1950)return null;
  if(region==='taiwan')return year>=2023?18:sex==='male'?18:16;
  if(region==='hongkong')return 16;
  if(region==='macau')return year>=1999?16:18; // pre-code history: conservative modelOnly game bound
  if (!mainland(region)) return null;
  return year >= 1981 ? sex === 'male' ? 22 : 20 : sex === 'male' ? 20 : 18;
}
export function civilCapacity({ age, region = 'mainland', year = 2026, selfSupportingByWork = false } = {}) {
  if (!mainland(region) || year < 2021) return null;
  if (age >= 18 || age >= 16 && selfSupportingByWork) return 'full';
  return age >= 8 ? 'limited' : 'none';
}

const PILOT_CITY_PATTERNS = ['北京','上海','天津','重庆','重慶','武汉','武漢','沈阳','瀋陽','西安','南京','beijing','shanghai','tianjin','chongqing','wuhan','shenyang',"xi'an",'xian','nanjing'];
const POSTGRADUATE = new Set(['masters','doctorate','postgraduate','graduate']);
const HIGHER_EDUCATION = new Set(['associate','college','university','masters','doctorate','undergraduate','postgraduate','graduate','public-associate','private-associate','public-bachelor','private-bachelor','research-public']);
export function studentLoanPolicy(year = 2026, stage = 'university', region = 'mainland', { cityName = '' } = {}) {
  const postgraduate = POSTGRADUATE.has(stage);
  const eligibleStage = HIGHER_EDUCATION.has(stage);
  const pilotEligible = typeof cityName === 'string' && PILOT_CITY_PATTERNS.some(name => cityName.toLowerCase().includes(name));
  const available = mainland(region) && eligibleStage && (year >= 2000 || year === 1999 && !postgraduate && pilotEligible);
  let cap = 0;
  if (available) cap = year >= 2024 ? postgraduate ? 25000 : 20000 : year >= 2023 ? postgraduate ? 20000 : 16000 : year >= 2021 ? postgraduate ? 16000 : 12000 : year >= 2014 ? postgraduate ? 12000 : 8000 : 6000;
  const source = year >= 2024 ? 'student-loan-2024' : year >= 2023 ? 'student-loan-2023' : year >= 2021 ? 'student-loan-2021' : year >= 2014 ? 'student-loan-2014' : 'student-loan-history';
  return {
    available, annualCap:cap, currency:'CNY', stage,
    pilotOnly:year === 1999, requiresFinancialNeed:true,
    inSchoolInterestSubsidized:year >= 2004,
    mayCoverLivingCosts:available,
    channel:'campus-national-student-loan',
    sourceIds:['student-loan-start','student-loan-campus-living',source],
    monthPrecision:'annual-model-uses-autumn-policy',
    modelOnly:year === 1999,
    note:T('额度是每学年上限，不是自动获贷或一次借满整个学制；须获正式录取、符合资助认定和银行审核，同一学年不可重复申请校园地与生源地贷款。','額度是每學年上限，並非自動獲貸或一次借滿整個學制；須獲正式錄取、符合資助認定及銀行審核，同一學年不得重複申請校園地與生源地貸款。','Limits apply per academic year, not automatically or for the entire course at once. Admission, financial-need assessment and lender review are required; campus and home-origin loans cannot be duplicated in one year.'),
  };
}
export const studentLoanCap = (year, stage, region, options) => studentLoanPolicy(year, stage, region, options).annualCap;
export function canTakeStudentLoan({ year = 2026, stage = 'university', region = 'mainland', cityName = '', admitted = false, fullTime = true, financialNeed = false, alreadyBorrowedThisYear = 0 } = {}) {
  const policy = studentLoanPolicy(year, stage, region, {cityName});
  return policy.available && admitted && fullTime && financialNeed && alreadyBorrowedThisYear < policy.annualCap;
}
export function canTakeConsumerLoan({ age, employed = false, stableIncome = 0, annualDebtPayments = 0, requestedAnnualPayment = 0, region = 'mainland' } = {}) {
  if (!mainland(region)) return null;
  // A conservative game credit policy, deliberately stricter than the statute.
  return age >= 18 && employed && finite(stableIncome) && stableIncome > 0 && Math.max(0, annualDebtPayments) + Math.max(0, requestedAnnualPayment) <= stableIncome * .4;
}
export const CONSUMER_LOAN_MODEL_NOTE = T('本作在首次就业前不发放普通消费或住房贷款，助学贷款按专门规则处理。这是保守信用模型，不是法律规定所有无雇佣工作者均不得借款。','本作於首次就業前不發放一般消費或住房貸款，助學貸款依專門規則處理。這是保守信用模型，不是法律規定所有無受僱工作者均不得借款。','The game withholds ordinary consumer and home credit before first employment, with a separate student-loan route. This is a conservative model, not a law banning all loans to people without salaried jobs.');

export function educationAdmissionRoute(year = 2026, region = 'mainland') {
  if (!mainland(region)) return null;
  if (year >= 1966 && year <= 1969) return { id:'suspended', exam:false, label:T('普通高校招生暂停','一般高校招生暫停','Ordinary university admission suspended'), sourceIds:['gaokao-history'], modelOnly:false };
  if (year >= 1966 && year <= 1976) return { id:'recommendation', exam:false, label:T('高考停考时期的推荐选拔','高考停考時期的推薦選拔','Recommendation-based selection during the entrance-exam suspension'), sourceIds:['gaokao-history'], modelOnly:false };
  if (year >= 1952) return { id:'gaokao', exam:true, label:T('高考选拔','高考選拔','National university entrance examination'), sourceIds:['gaokao-history'], modelOnly:false };
  return { id:'institution-exam', exam:true, label:T('高校自主考试／联合招生','高校自主考試／聯合招生','Institutional or joint admission examinations'), sourceIds:['gaokao-history'], modelOnly:true };
}
/**
 * score is a MODEL score, 0..maxScore (100 by default), never a real province's
 * current cut-off. ownership and qualification are orthogonal to batch labels.
 */
export function examUniversityTier(score, year = 2026, { maxScore = 100, region = 'mainland' } = {}) {
  if (!mainland(region)) return null;
  const route = educationAdmissionRoute(year, region);
  if (!route.exam) return { route:route.id, exam:false, tier:route.id, level:null, ownership:null, label:route.label, admitted:false, scoreRatio:null, modelOnly:true, sourceIds:route.sourceIds, note:T('这一年没有可用现代高考分数直接录取的路径；停招与推荐选拔须由相应历史情景处理。','此年不能憑現代高考分數直接錄取；停招及推薦選拔須由相應歷史情景處理。','A modern entrance-exam score cannot directly grant admission in this year. Suspension and recommendation are handled by the corresponding historical scenario.') };
  const scoreRatio = clamp((Number(score) || 0) / Math.max(1, Number(maxScore) || 100), 0, 1);
  const privateAvailable = year >= 1993;
  let tier, level, ownership, label;
  if (scoreRatio >= .85) { tier='research-public';level='university';ownership='public';label=T('高选拔性公办本科','高選拔性公辦大學','Selective public bachelor’s program'); }
  else if (scoreRatio >= .66) { tier='public-bachelor';level='university';ownership='public';label=T('公办普通本科','公辦一般大學','Public bachelor’s program'); }
  else if (scoreRatio >= .54 && privateAvailable) { tier='private-bachelor';level='university';ownership='private';label=T('民办本科','民辦大學','Private bachelor’s program'); }
  else if (scoreRatio >= .36) { tier='public-associate';level='associate';ownership='public';label=T('公办高职／专科','公辦高職／專科','Public higher-vocational / associate program'); }
  else if (scoreRatio >= .24 && privateAvailable) { tier='private-associate';level='associate';ownership='private';label=T('民办高职／专科','民辦高職／專科','Private higher-vocational / associate program'); }
  else { tier='not-admitted';level=null;ownership=null;label=T('本次未获高等教育录取','本次未獲高等教育錄取','Not admitted this time'); }
  return {
    route:route.id, exam:route.exam, tier, level, ownership, label, scoreRatio,
    admitted:level !== null, modelOnly:true, sourceIds:['admission-batches','gaokao-history'],
    note:T('这只是标准化模拟分段，不是全国统一分数线；一本二本三本是随省份和年代变化的录取批次，不能等同于公办、民办或学历等级。','這只是標準化模擬分段，不是全國統一分數線；一本二本三本是隨省份與年代變化的錄取批次，不等同於公辦、民辦或學歷等級。','These are normalized simulation bands, not national score cut-offs. Admission batches vary by province and year and are not equivalent to ownership or degree level.'),
  };
}
export function tuitionModel({ year = 2026, level = 'university', ownership = 'public', region = 'mainland', urban = true, incomeReference = null } = {}) {
  if (!mainland(region)) return null;
  const reference=incomeReference??71590*developmentAt(year,{region:'mainland',id:'cn-reference'},'past').incomeIndex;
  const basis={currencyBasis:'CNY-2025-model',priceModel:'relative-to-era-income'};
  const privateSchool = ownership === 'private';
  const mandatory = ['primary','junior'].includes(level);
  if (!privateSchool && ['associate','university','masters','doctorate'].includes(level) && year < 1985) return { ...basis, tuition:0, miscellaneous:0, annualLivingCost:0, currency:'CNY', modelOnly:true, sourceIds:['higher-education-aid-history'], publicSupport:true, note:T('早期公费高教与助学金的简化情景；零基本生活自付并非人人历史实际补助金额。','早期公費高教及助學金的簡化情景；零基本生活自付並非人人歷史實際補助金額。','A simplified early publicly funded higher-education and aid scenario. Zero basic out-of-pocket living costs are not a historical individual grant amount.') };
  if (mandatory && !privateSchool) {
    const policy = compulsoryEducationPolicy({year,region,urban});
    return { ...basis,tuition:policy.freeTuition ? 0 : Math.round(reference*.005), miscellaneous:policy.freeMiscFees ? 0 : Math.round(reference*.002), annualLivingCost:0, currency:'CNY', modelOnly:!policy.freeMiscFees, sourceIds:policy.sourceIds };
  }
  const now = privateSchool ? level === 'associate' ? 15000 : level === 'high' ? 18000 : 26000 : level === 'associate' ? 5000 : level === 'masters' ? 8000 : level === 'doctorate' ? 10000 : level === 'high' ? 1600 : 6000;
  // Fees are relative game prices in the same basis as model income.
  const ratio=year<1994?.02:now/71590;
  return { ...basis,tuition:Math.round(reference*ratio), miscellaneous:0, annualLivingCost:Math.round(reference*(year<1994?.10:12000/71590)), currency:'CNY', modelOnly:true, privatePremiumIsModel:true, sourceIds:['private-fees','sichuan-fees-example'], note:T('学费因学校、专业、地区和年份不同；此处是虚构学校的情景价格，不是全国法定统一收费，也不保证所有民办学校都更贵。','學費依學校、科系、地區與年份而異；這是虛構學校的情景價格，不是全國法定統一收費，也不保證所有民辦學校都較貴。','Fees vary by institution, course, region and year. These are fictional-school scenario prices, not national legal rates; not every private institution necessarily costs more.') };
}
