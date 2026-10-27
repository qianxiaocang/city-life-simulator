import {loanPolicyInModelUnits} from './data/money-basis.js';
import {ensureAccounts,recordFlow,reconcile,changeAsset,noteAssetChange,noteCashChange,bookNetWorth} from './accounting.js';
import {housingTier,REGION_ECONOMY} from './data/development.js';
import { CHINA_CONSUMPTION, INVESTMENT_AVAILABILITY, investmentAvailable } from './data/china-society.js';
import { studentLoanPolicy } from './data/china-law.js';
const T=(zhCN,zhTW,en)=>({zhCN,zhTW,en});
const finite=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;
const positive=x=>Math.max(0,finite(x));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,finite(x)));
const HIGHER=new Set(['associate','university','masters','doctorate']);
const envLog=(env,life,text,type='money',changes=null)=>env?.log?.(life,text,type,changes);
const envEffects=(env,life,changes)=>env?.effects?.(life,changes);
function syncDebt(life){
  life.loans.student.balance=positive(life.loans.student.balance);
  life.loans.mortgage.balance=positive(life.loans.mortgage.balance);
  life.studentLoan=life.loans.student;
  life.debt=Math.round(life.loans.student.balance+life.loans.mortgage.balance);
}
export function ensureEconomyState(life){
  life.flags??={};life.totals??={earned:0,spent:0,charity:0};
  life.assets??={house:0,car:0,retirement:0};life.assets.retirement??=0;life.owns??=[];life.investment??='deposit';
  const legacyCash=finite(life.money);
  if(legacyCash<0){life.flags.legacyUnsecuredBalanceCleared=true;life.flags.legacyNegativeCash=legacyCash;}
  life.money=Math.max(0,legacyCash);
  life.loans??={};
  const oldStudent=life.studentLoan||{}, storedStudent=life.loans.student||{};
  life.loans.student={balance:0,borrowedByYear:{},approved:false,...oldStudent,...storedStudent};
  life.loans.student.borrowedByYear={...(oldStudent.borrowedByYear||{}),...(storedStudent.borrowedByYear||{})};
  // The split-loan ledger is canonical once present. A stale compatibility
  // alias from an imported save must never resurrect already repaid principal.
  life.loans.student.balance=Object.hasOwn(storedStudent,'balance')?positive(storedStudent.balance):positive(oldStudent.balance);
  const legacyMortgage=!life.loans.mortgage&&positive(life.debt)>0&&positive(life.assets.house)>0?positive(life.debt)-life.loans.student.balance:0;
  life.loans.mortgage={balance:Math.max(0,legacyMortgage),annualPayment:positive(life.flags.mortgagePayment),rate:.035,remainingYears:25,...(life.loans.mortgage||{})};
  if(life.job||life.lastJob||positive(life.totals.earned)>0)life.everWorked=true;
  syncDebt(life);
  ensureAccounts(life);
  return life;
}
/** Optional spending never creates a loan or a negative cash balance. */
export function spend(life,amount,purpose='optional'){
  ensureEconomyState(life);
  amount=finite(amount,-1);
  if(amount<0||amount>life.money+1e-7)return false;
  const before=life.money;
  life.money=Math.max(0,life.money-amount);
  life.totals.spent=positive(life.totals.spent)+amount;
  life.flags.lastSpendingPurpose=purpose;
  recordFlow(life,purpose.startsWith('purchase-house')?'capital-outlay':'spending:'+purpose,-amount);
  noteCashChange(life,before,life.money);
  return true;
}
function regionInvestmentYear(id,region){
  // Stock exchange milestones are sourced. Other non-mainland dates below are
  // conservative access assumptions, not a replacement for local legislation.
  const local={
    hongkong:{deposit:1950,stock:1950,bond:2000,fund:2001,mix:2001},
    taiwan:{deposit:1950,stock:1962,bond:2000,fund:2001,mix:2001},
    macau:{deposit:1950,stock:1990,bond:2000,fund:2001,mix:2001}
  };
  return local[region]?.[id]??Infinity;
}
function investmentAllowed(life,id){
  const region=life.location?.region||'mainland';
  if(region==='mainland')return investmentAvailable(id,life.year,region);
  const override=life.regionInvestmentYears?.[id];
  return life.year>=(Number.isFinite(override)?override:regionInvestmentYear(id,region));
}
function supportFromFamily(life,required,school){
  const livingParent=[life.family?.mother,life.family?.father].some(person=>person?.alive);
  // A child's personal wallet is not the household's means of subsistence.
  // School familyContribution=0 records tuition, not absence of parental care.
  if(life.age<18)return livingParent?required:0;
  if(Number.isFinite(school?.familyContribution))return positive(school.familyContribution);
  if(!livingParent)return 0;
  if(school||life.age<24&&!life.job)return Math.min(required,life.profile.typicalIncome*(.025+life.classRank*.025));
  return 0;
}
function studentFunding(life,school,tuition,living,available){
  const student=life.loans.student;
  const region=school?.studyRegion||life.location.region;
  const city=school?.studyCity?.zhCN||school?.studyCity||life.location.name.zhCN;
  const policy=loanPolicyInModelUnits(studentLoanPolicy(life.year,school?.stage,region,{cityName:city}),life.year);
  const eligible=school&&HIGHER.has(school.stage)&&school.loanApproved&&school.financialNeed&&policy.available;
  if(!eligible)return 0;
  const previous=positive(student.borrowedByYear[life.year]);
  const cap=Math.min(policy.annualCap,positive(school.loanCap)||policy.annualCap);
  // Route-specific policy decides whether tuition and living costs are eligible.
  const eligibleNeed=policy.mayCoverLivingCosts?tuition+living:tuition;
  const gap=Math.max(0,eligibleNeed-available);
  const borrowed=Math.min(gap,Math.max(0,cap-previous));
  if(!borrowed)return 0;
  student.balance+=borrowed;student.borrowedByYear[life.year]=previous+borrowed;
  student.approved=true;student.studyStage=school.stage;student.lastStudyYear=life.year;
  student.lastDisbursementYear=life.year;student.subsidizedInSchool=policy.inSchoolInterestSubsidized;
  student.originalStudyYears=student.originalStudyYears||(school.endsAt-life.age);
  student.firstBorrowedYear??=life.year;
  return borrowed;
}
function debtService(life,env){
  let studentRepayment=0,mortgageRepayment=0,interestPaid=0;
  const student=life.loans.student,mortgage=life.loans.mortgage;
  const enrolled=life.school&&HIGHER.has(life.school.stage);
  if(student.balance>0){
    if(enrolled){
      const policy=studentLoanPolicy(life.year,life.school.stage,life.school.studyRegion||life.location.region,{cityName:life.location.name.zhCN});
      if(!policy.inSchoolInterestSubsidized){
        const interest=student.balance*.02;
        // Explicit student-loan interest capitalisation, never ordinary consumer debt.
        student.balance+=interest;recordFlow(life,'loan-interest',-interest);student.capitalizedInterest=positive(student.capitalizedInterest)+interest;
      }
    }else{
      student.graduationYear??=life.year;
      const elapsed=Math.max(0,life.year-student.graduationYear);
      const grace=student.graduationYear>=2020?5:student.graduationYear>=2015?3:2;
      const interest=student.balance*.02;
      // This is a transparent annual repayment model, not an individual contract.
      // It also respects the modeled maximum total term from first borrowing.
      const studyYears=Math.max(1,positive(student.originalStudyYears)||4);
      const totalTerm=student.graduationYear>=2020?Math.min(studyYears+15,22):student.graduationYear>=2015?Math.min(studyYears+13,20):Math.min(studyYears+6,10);
      const deadline=(student.firstBorrowedYear??student.graduationYear-studyYears)+totalTerm;
      student.modelGraceYears=grace;student.modelRepaymentDeadline=deadline;
      const principal=elapsed>=grace?student.balance/Math.max(1,deadline-life.year):0;
      recordFlow(life,'loan-interest',-interest);
      const due=interest+principal;
      studentRepayment=Math.min(life.money,due);
      life.money-=studentRepayment;interestPaid+=Math.min(interest,studentRepayment);
      const paidPrincipal=Math.max(0,studentRepayment-interest);
      student.balance=Math.max(0,student.balance-paidPrincipal);
      const unpaidInterest=Math.max(0,interest-studentRepayment);
      student.balance+=unpaidInterest;student.arrears=positive(student.arrears)+Math.max(0,due-studentRepayment);
    }
  }
  if(mortgage.balance>0){
    const interest=mortgage.balance*positive(mortgage.rate);
    recordFlow(life,'loan-interest',-interest);
    const due=Math.min(mortgage.balance+interest,positive(mortgage.annualPayment)||mortgage.balance/20+interest);
    mortgageRepayment=Math.min(life.money,due);
    life.money-=mortgageRepayment;interestPaid+=Math.min(interest,mortgageRepayment);
    mortgage.balance=Math.max(0,mortgage.balance-Math.max(0,mortgageRepayment-interest))+Math.max(0,interest-mortgageRepayment);
    mortgage.arrears=positive(mortgage.arrears)+Math.max(0,due-mortgageRepayment);
    mortgage.remainingYears=Math.max(0,finite(mortgage.remainingYears,25)-1);
    if(mortgageRepayment<due)envLog(env,life,T('今年的房贷还款遇到困难，你需要与银行协商或调整住房安排。','今年的房貸還款遇到困難，你需要與銀行協商或調整住房安排。','You could not meet the full mortgage payment this year and need to discuss repayment or housing arrangements.'),'money');
  }
  syncDebt(life);
  return {studentRepayment,mortgageRepayment,interestPaid};
}
export function economyYear(life,env={}){
  ensureEconomyState(life);
  if(life.flags.economySettledYear===life.year)return life;
  life.flags.economySettledYear=life.year;
  const starting=life.money,scale=Math.max(1000,positive(life.profile?.typicalIncome));
  const context=env.context||life.marketContext||{};
  const incomeFactor=clamp(context.incomeMultiplier??1,.1,3),livingFactor=clamp(context.livingCostMultiplier??1,.2,4);
  let earned=0;
  if(life.job){
    life.everWorked=true;life.job.years=positive(life.job.years)+1;
    // This follows the city's purchasing-power development model. A missing
    // reference establishes today's baseline; it never applies retroactive pay.
    const marketReference=positive(life.profile?.typicalIncome)||scale;
    const previousReference=positive(life.job.marketIncomeReference);
    const marketAdjustment=previousReference>0?marketReference/previousReference:1;
    life.job.marketIncomeReference=marketReference;
    const growth=clamp(.015+(env.normal?.(life)||0)*.018+positive(life.flags.workFraction)*.025,-.06,.09);
    life.job.salary=Math.round(positive(life.job.salary)*marketAdjustment*(1+growth));
    earned=life.job.salary*(1+positive(life.flags.workFraction)*.08)*incomeFactor;
    if(life.job.years>3&&life.job.years%7===0&&(env.chance?.(life,.5)??false)){
      life.job.salary*=1.1;envLog(env,life,T('经验积累带来一次岗位晋升，收入与责任有所增加。','經驗累積帶來一次職位升遷，收入與責任有所增加。','Experience led to a promotion, with more pay and responsibility.'),'work',{happiness:2});
    }
  }else if(life.retired)earned=positive(life.pension)+positive(life.basicSupport);
  life.income=Math.round(earned);
  // Effective tax/social deductions are calibrated game parameters, not tax advice.
  const grossEmployment=life.job?earned:0;
  const socialRate=life.year>=1990&&life.job&&!['self-employed','agriculture'].includes(life.job.sector)?.12:0;
  const taxRate=life.year>=1980&&life.job?(grossEmployment>scale*3?.12:grossEmployment>scale*1.5?.08:.04):0;
  const deductions=grossEmployment*(socialRate+taxRate);
  earned-=deductions;
  const partnerIncome=life.family?.partner?.alive&&life.family.partner.married?scale*.17*incomeFactor:0;
  const school=life.school;
  const dependent=life.age<18;
  const children=(life.family?.children||[]).filter(child=>child.alive&&child.age<22).length;
  const carRunningCost=positive(life.assets.car)>0?scale*.035:0;
  const schoolLiving=school?.publicSupport?0:positive(school?.livingCost)||scale*.12;
  const ownBase=clamp(life.retired?(life.lastJob?.salary||scale)*.8:life.income,scale*.45,scale*2.2);
  const housing=dependent||school?0:positive(life.assets.house)>0?ownBase*.10:life.urban?scale*.30:scale*.12;
  let living=(school?schoolLiving:dependent?scale*.1:ownBase*.28+housing)+children*scale*(life.urban?.35:.25)+carRunningCost;
  const retirementCare=life.retired?Math.min(life.money,Math.max(0,bookNetWorth(life))*.06,scale*1.0):0;
  const medicalShock=life.age>=60&&(env.chance?.(life,Math.min(.16,.02+(life.age-60)*.003))??false)?scale*(.5+Math.min(2.5,Math.abs(env.normal?.(life)||0))):0;
  living+=retirementCare+medicalShock;
  living*=(life.profile.regionCostFactor||1)/(life.profile.regionIncomeFactor||1);
  living*=livingFactor*(life.flags.frugal===true?.85:1);
  living=Math.max(0,living);
  const tuition=school?positive(school.annualTuition):0;
  const scholarship=school?positive(school.scholarship):0;
  const familySupport=supportFromFamily(life,tuition+living,school);
  // If parents have died, a minor is modeled under guardian/community support.
  // This is a subsistence backstop, not a claim about a statutory benefit amount.
  const basicRelief=dependent?Math.max(0,tuition+living-familySupport-scholarship):!life.job&&!life.retired&&!school?scale*.06:0;
  life.money+=earned+partnerIncome+familySupport+scholarship+basicRelief;
  recordFlow(life,'gross-income',grossEmployment||earned);recordFlow(life,'tax-and-social',-deductions);recordFlow(life,'partner-income',partnerIncome);recordFlow(life,'family-aid-relief',familySupport+scholarship+basicRelief);
  if(life.location.region==='hongkong'&&life.year>=2000&&life.job){
    // Modeled recoverable portion of payroll deductions; not a claim about
    // this character's actual MPF contribution account or investment choice.
    changeAsset(life,'retirement',life.assets.retirement+grossEmployment*.05,'modeled-mpf-saving');
  }
  const borrowed=studentFunding(life,school,tuition,living,life.money);
  life.money+=borrowed;
  // School fees are paid first; unfinanced fees are visible, never silently borrowed.
  const educationPaid=Math.min(life.money,tuition);life.money-=educationPaid;recordFlow(life,'tuition',-educationPaid);
  const educationGap=Math.max(0,tuition-educationPaid);
  if(school)school.fundingGap=Math.round(educationGap);
  // A genuinely unpaid higher-education tuition year is not a completed course
  // year. Keep the count until education consumes it, even if a later payment
  // clears the current monetary gap. This never creates a consumer loan.
  if(school&&HIGHER.has(school.stage)&&educationGap>0&&school.lastUnfundedYear!==life.year){
    school.unfundedAcademicYears=Math.max(0,finite(school.unfundedAcademicYears))+1;
    school.lastUnfundedYear=life.year;
  }
  if(educationGap>0){
    life.flags.educationFundingGap=educationGap;
    envLog(env,life,T('本学年的教育费用仍有缺口，需要申请奖助、调整学校或与家人商量；没有生成普通消费贷款。','本學年的教育費用仍有缺口，需要申請獎助、調整學校或與家人商量；沒有產生一般消費貸款。','An education funding gap remains. Seek aid, discuss family support or consider another school; no consumer loan was created.'),'education');
  }else delete life.flags.educationFundingGap;
  const livingPaid=Math.min(life.money,living);life.money-=livingPaid;recordFlow(life,'household-consumption',-livingPaid);
  const unmetLiving=Math.max(0,living-livingPaid);
  if(unmetLiving>0){
    life.flags.materialHardship=true;
    envEffects(env,life,{happiness:-Math.min(4,unmetLiving/scale*12),health:-Math.min(2,unmetLiving/scale*5)});
    if(life.age>=16)envLog(env,life,T('收入不足以覆盖原来的生活安排，你缩减开支并寻求家人或救助支持，没有因此自动背上消费债务。','收入不足以支付原來的生活安排，你縮減開支並尋求家人或救助支持，沒有因此自動背上消費債務。','You reduced spending and sought family or relief support when money ran short. No automatic consumer debt was created.'),'money');
  }else life.flags.materialHardship=false;
  const debts=debtService(life,env);
  if(!investmentAllowed(life,life.investment))life.investment='deposit';
  const market=env.normal?.(life)||0;
  const cashRate=life.year<1978?.005:life.year<1997?.017:life.year<2015?.012:.007;
  const rate=({deposit:cashRate,bond:.015+market*.035,fund:.035+market*.13,mix:.025+market*.08,stock:.045+market*.22}[life.investment]??cashRate)+finite(context.investmentReturnShock);
  const returns=Math.round(life.money*clamp(rate,-.65,.8));
  const precise=life.money+returns;life.money=Math.max(0,Math.round(precise));recordFlow(life,'investment-real-return',returns);recordFlow(life,'rounding',life.money-precise);
  if(positive(life.assets.house))changeAsset(life,'house',Math.round(life.assets.house*clamp(1.005+market*.015+finite(context.housePriceShock),.8,1.18)));
  if(positive(life.assets.car))changeAsset(life,'car',Math.round(life.assets.car*.89));
  if(positive(life.assets.retirement))changeAsset(life,'retirement',Math.round(life.assets.retirement*1.01),'modeled-mpf-return');
  life.totals.earned=positive(life.totals.earned)+(grossEmployment||earned);
  life.totals.taxAndSocial=positive(life.totals.taxAndSocial)+deductions;
  life.totals.spent=positive(life.totals.spent)+deductions+livingPaid+educationPaid+debts.studentRepayment+debts.mortgageRepayment;
  syncDebt(life);
  reconcile(life);
  life.lastCashflow={currencyBasis:'CNY-2025-model',grossEmploymentIncome:grossEmployment,taxAndSocial:deductions,takeHomeRatio:grossEmployment?earned/grossEmployment:null,housing:housing*livingFactor,retirementCare,medicalShock,income:Math.round(earned+partnerIncome),employmentIncome:Math.round(earned),partnerContribution:Math.round(partnerIncome),familySupport:Math.round(familySupport),scholarship:Math.round(scholarship),basicRelief:Math.round(basicRelief),living:Math.round(livingPaid),carRunningCost:Math.round(carRunningCost*livingFactor*(life.flags.frugal===true?.85:1)),unmetLiving:Math.round(unmetLiving),education:Math.round(educationPaid),unfundedEducation:Math.round(educationGap),borrowing:Math.round(borrowed),studentRepayment:Math.round(debts.studentRepayment),mortgageRepayment:Math.round(debts.mortgageRepayment),interestPaid:Math.round(debts.interestPaid),returns,change:Math.round(life.money-starting)};
  noteCashChange(life,starting,life.money);
  return life;
}
function stableIncome(life){return positive(life.job?.salary)||positive(life.income);}
export function canBorrowHousing(life,amount,annualPayment){
  ensureEconomyState(life);
  if(life.age<18||!life.everWorked||!life.job||stableIncome(life)<=0||amount<=0)return false;
  if(life.location.region==='mainland'&&life.year<1998)return false;
  const otherPayment=positive(life.loans.mortgage.annualPayment)+(life.loans.student.balance>0?life.loans.student.balance*.09:0);
  return annualPayment>0&&annualPayment+otherPayment<=stableIncome(life)*.4&&amount<=stableIncome(life)*12;
}
function itemPrice(life,item){
  const scale=Math.max(1000,positive(life.profile.typicalIncome)),p=item.priceModel;
  if(item.id==='house-cash')return homeTerms(life).totalPrice;
  if(item.id==='phone')return communicationDevice(life).cost;
  if(p.kind==='fixed-real')return p.amount;
  if(p.kind==='home-ratio')return Math.max(0,positive(life.assets.house)*p.ratio);
  if(p.kind==='annual-income-multiple')return scale*p.multiple;
  if(p.kind==='home-down-payment')return homeTerms(life).down;
  return scale*p.ratio;
}
function communicationDevice(life){
  const scale=Math.max(1000,positive(life.profile.typicalIncome));
  // Guangzhou's first commercial network is a milestone, not instant national access.
  const earlyMobile=life.year>=1987&&(life.location.name.zhCN.includes('广州')||life.year>=1995);
  if(life.year<2000&&!earlyMobile)return {name:T('安装固定电话','安裝固定電話','Install a landline'),cost:scale*.06};
  if(life.year<2000)return {name:T('购买早期移动电话','購買早期行動電話','Buy an early mobile phone'),cost:scale*(life.year<1995?3:.2)};
  if(life.year<2010)return {name:T('购买功能手机','購買功能手機','Buy a feature phone'),cost:1200};
  return {name:T('购买智能手机','購買智慧型手機','Buy a smartphone'),cost:2400};
}
export function homeTerms(life){
  const scale=Math.max(1000,positive(life.profile.typicalIncome));
  const region=life.location.region,regional={mainland:1,taiwan:2.6,hongkong:12.5,macau:9}[region]||1;
  const referencePrice=10005*(region==='mainland'?housingTier(life.location):regional);
  // modelOnly: 2025 CNY purchasing-power price proxy, not a local appraisal.
  const developmentScale=clamp(life.profile.developmentIncomeIndex??1,.075,2);
  const totalPrice=Math.round(referencePrice*(life.urban?74:110)*developmentScale);
  const down=Math.round(totalPrice*.3),principal=totalPrice-down;
  const rate=life.year<2000?.065:life.year<2015?.055:life.year<2023?.045:.035;
  const years=life.year<1999?20:25;
  const annualPayment=principal*rate/(1-Math.pow(1+rate,-years));
  return {totalPrice,down,principal,rate,years,annualPayment};
}
export function getEconomyShopItems(life){
  ensureEconomyState(life);
  if(life.phase==='dead'||life.age<6)return [];
  const rows=CHINA_CONSUMPTION.filter(item=>{
    if(life.age<item.minAge||life.year<item.minYear)return false;
    if(item.oneTime&&(life.owns.includes(item.id)||item.assetKey==='house'&&positive(life.assets.house)))return false;
    if(item.requiresHouse&&!positive(life.assets.house))return false;
    if(item.requiresSchool&&!life.school)return false;
    if(item.requiresChildren&&!life.family.children.some(p=>p.alive&&p.age<22))return false;
    if(item.requiresPartner&&!life.family.partner?.alive)return false;
    if(item.requiresLivingParent&&!([life.family.mother,life.family.father].some(p=>p?.alive)))return false;
    if(item.id==='adultstudy'&&(life.school||life.continuingEducation||life.age>60||!['high','vocational','associate','university'].includes(life.education)))return false;
    return true;
  }).map(item=>{
    const cost=Math.round(itemPrice(life,item));
    const last=life.flags['purchase-'+item.id],cooldown=item.cooldownYears??(item.oneTime?0:1);
    const cooling=Number.isFinite(last)&&life.age-last<cooldown;
    let available=life.money>=cost&&!cooling;
    if(item.requiresEmployment&&!canBorrowHousing(life,homeTerms(life).principal,homeTerms(life).annualPayment))available=false;
    return {...item,...(item.id==='phone'?{name:communicationDevice(life).name}:{}),cost,available,...(item.id==='house'?{totalPrice:homeTerms(life).totalPrice,mortgageTerms:homeTerms(life)}:{}),availabilityReason:cooling?T('尚在使用或本年已安排','尚在使用或本年已安排','Still in use or already arranged this year'):life.money<cost?T('积蓄不足','積蓄不足','Not enough savings'):!available?T('尚不符合就业或还款能力条件','尚不符合就業或還款能力條件','Employment or repayment requirements are not met'):null};
  });
  if(life.age>=18)for(const id of ['deposit','bond','fund','stock']){
    if(!investmentAllowed(life,id))continue;
    const meta=INVESTMENT_AVAILABILITY[id];
    rows.push({id:'invest-'+id,name:meta.label,description:meta.note,cost:0,available:life.investment!==id,sourceKeys:meta.sourceKeys});
  }
  if(life.age>=18)rows.push({id:'donate',name:T('支持公益项目','支持公益專案','Support a community cause'),description:T('量力而行，不借贷捐款','量力而行，不借貸捐款','Give within your means without borrowing'),cost:Math.round(life.profile.typicalIncome*.01),available:life.money>=life.profile.typicalIncome*.01&&life.flags['purchase-donate']!==life.age,effects:{happiness:3,relationships:2}});
  return rows;
}
export function purchaseEconomyItem(life,id,env={}){
  ensureEconomyState(life);
  if(life.pending)return false;
  const item=getEconomyShopItems(life).find(row=>row.id===id);
  if(!item?.available||!spend(life,item.cost,'purchase-'+id))return false;
  life.flags['purchase-'+id]=life.age;
  if(item.oneTime)life.owns.push(id);
  if(id.startsWith('invest-'))life.investment=id.slice(7);
  else if(id==='house'){
    const terms=homeTerms(life),before=life.assets.house;life.assets.house=terms.totalPrice;noteAssetChange(life,'house',before,life.assets.house);
    life.loans.mortgage={balance:terms.principal,annualPayment:terms.annualPayment,rate:terms.rate,remainingYears:terms.years,startedYear:life.year};
    recordFlow(life,'capital-acquisition',terms.totalPrice-terms.principal);
    life.flags.mortgagePayment=terms.annualPayment;envEffects(env,life,{happiness:5});
  }else if(id==='house-cash'){changeAsset(life,'house',item.cost,'capital-acquisition');envEffects(env,life,{happiness:5});}
  else if(id==='car'){changeAsset(life,'car',item.cost*.8,'capital-acquisition');envEffects(env,life,{happiness:3});}
  else if(id==='adultstudy')life.continuingEducation={target:life.education==='university'?'masters':'university',endsAt:life.age+3};
  else{
    if(item.assetKey){const before=life.assets[item.assetKey]||0;life.assets[item.assetKey]=item.cost;noteAssetChange(life,item.assetKey,before,life.assets[item.assetKey]);}
    if(id==='donate')life.totals.charity=positive(life.totals.charity)+item.cost;
    if(id==='course'&&life.job)life.job.salary*=1.01;
    if(id==='health')life.flags.treatment=true;
    envEffects(env,life,item.effects||{});
  }
  syncDebt(life);reconcile(life);
  envLog(env,life,T('你安排了：'+item.name.zhCN+'。','你安排了：'+item.name.zhTW+'。','You arranged: '+item.name.en+'.'),'spending');
  return true;
}
