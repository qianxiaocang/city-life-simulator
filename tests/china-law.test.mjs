import test from 'node:test';
import assert from 'node:assert/strict';
import { retirementAgeMonths, retirementRule, pensionMinimumYears, legalEmploymentAge, canStartEmployment, compulsoryYears, compulsoryEducationPolicy, legalMarriageAge, civilCapacity, studentLoanCap, studentLoanPolicy, canTakeStudentLoan, canTakeConsumerLoan, educationAdmissionRoute, examUniversityTier, tuitionModel, CHINA_LAW_SOURCES } from '../app/data/china-law.js';

test('retirement reform follows birth month and original female category', () => {
  assert.equal(retirementAgeMonths({birthYear:1964,birthMonth:12,sex:'male'}),720);
  assert.equal(retirementAgeMonths({birthYear:1965,birthMonth:1,sex:'male'}),721);
  assert.equal(retirementAgeMonths({birthYear:1965,birthMonth:4,sex:'male'}),721);
  assert.equal(retirementAgeMonths({birthYear:1965,birthMonth:5,sex:'male'}),722);
  assert.equal(retirementAgeMonths({birthYear:1977,birthMonth:1,sex:'male'}),756);
  assert.equal(retirementAgeMonths({birthYear:1970,birthMonth:1,sex:'female',category:'female55'}),661);
  assert.equal(retirementAgeMonths({birthYear:1975,birthMonth:1,sex:'female',category:'worker'}),601);
  assert.equal(retirementAgeMonths({birthYear:1975,birthMonth:3,sex:'female',category:'worker'}),602);
  assert.equal(retirementAgeMonths({birthYear:1985,birthMonth:1,sex:'female',category:'worker'}),660);
  assert.equal(retirementAgeMonths({birthYear:1985,birthMonth:1,sex:'female',category:'female55'}),696);
  assert.equal(retirementRule({birthYear:1965,birthMonth:1,sex:'male'}).retirementMonth,2);
  assert.equal(retirementAgeMonths({birthYear:1965,birthMonth:1,sex:'male',year:2024}),720);
  assert.equal(retirementAgeMonths({birthYear:1980,sex:'male',category:'self-employed'}),null);
});

test('mainland legal rules are never silently applied to the other regions', () => {
  const local={taiwan:{employment:15,marriage:18},hongkong:{employment:15,marriage:16},macau:{employment:16,marriage:16}};
  for (const region of ['taiwan','hongkong','macau']) {
    assert.equal(retirementAgeMonths({birthYear:1975,sex:'female',region}),null);
    assert.equal(legalEmploymentAge(region,2026),local[region].employment);
    assert.equal(compulsoryYears(region,2026),null);
    assert.equal(legalMarriageAge('male',region,2026),local[region].marriage);
    assert.equal(examUniversityTier(80,2026,{region}),null);
    assert.equal(studentLoanCap(2026,'university',region),0);
  }
  assert.equal(legalMarriageAge('female','taiwan',2022),16);
  assert.equal(legalMarriageAge('female','taiwan',2023),18);
  assert.equal(pensionMinimumYears(2026,'taiwan'),15);
  assert.equal(pensionMinimumYears(2026,'macau'),5);
  assert.equal(pensionMinimumYears(2026,'hongkong'),null);
});

test('nine compulsory years exclude high school and employment begins at sixteen', () => {
  assert.equal(compulsoryYears('mainland',1985),null);
  assert.equal(compulsoryYears('mainland',1986),9);
  assert.equal(compulsoryEducationPolicy().includesHighSchool,false);
  assert.deepEqual(compulsoryEducationPolicy().stages,['primary','junior']);
  assert.equal(legalEmploymentAge('mainland',2026),16);
  assert.equal(canStartEmployment({age:15}),false);
  assert.equal(canStartEmployment({age:16}),true);
  assert.equal(canStartEmployment({age:17,hazardous:true}),false);
  assert.equal(canStartEmployment({age:18,hazardous:true}),true);
  assert.equal(canStartEmployment({age:16,compulsoryComplete:false}),false);
  assert.equal(canStartEmployment({age:20,isEnrolled:true}),false);
});

test('student loan caps follow pilot geography, school stage and historical changes', () => {
  assert.equal(studentLoanCap(1998,'university','mainland'),0);
  assert.equal(studentLoanCap(1999,'university','mainland',{cityName:'成都市'}),0);
  assert.equal(studentLoanCap(1999,'university','mainland',{cityName:'北京市'}),6000);
  assert.equal(studentLoanCap(1999,'masters','mainland',{cityName:'北京市'}),0);
  assert.equal(studentLoanCap(2000,'university','mainland'),6000);
  assert.equal(studentLoanPolicy(2005,'university','mainland').mayCoverLivingCosts,true);
  assert.equal(studentLoanPolicy(2005,'university','mainland').channel,'campus-national-student-loan');
  assert.equal(studentLoanCap(2014,'university','mainland'),8000);
  assert.equal(studentLoanCap(2014,'masters','mainland'),12000);
  assert.equal(studentLoanCap(2021,'university','mainland'),12000);
  assert.equal(studentLoanCap(2023,'university','mainland'),16000);
  assert.equal(studentLoanCap(2024,'university','mainland'),20000);
  assert.equal(studentLoanCap(2026,'masters','mainland'),25000);
  assert.equal(studentLoanCap(2026,'high','mainland'),0);
  assert.equal(canTakeStudentLoan({admitted:false,financialNeed:true}),false);
  assert.equal(canTakeStudentLoan({admitted:true,financialNeed:false}),false);
  assert.equal(canTakeStudentLoan({admitted:true,financialNeed:true}),true);
  assert.equal(canTakeStudentLoan({admitted:true,financialNeed:true,alreadyBorrowedThisYear:20000}),false);
});

test('civil capacity, marriage and conservative consumer credit remain distinct', () => {
  assert.equal(civilCapacity({age:16}), 'limited');
  assert.equal(civilCapacity({age:16,selfSupportingByWork:true}), 'full');
  assert.equal(civilCapacity({age:18}), 'full');
  assert.equal(legalMarriageAge('male','mainland',1980),20);
  assert.equal(legalMarriageAge('male','mainland',1981),22);
  assert.equal(legalMarriageAge('female','mainland',2026),20);
  assert.equal(canTakeConsumerLoan({age:20,employed:false,stableIncome:100000}),false);
  assert.equal(canTakeConsumerLoan({age:20,employed:true,stableIncome:100000,requestedAnnualPayment:30000}),true);
  assert.equal(canTakeConsumerLoan({age:20,employed:true,stableIncome:100000,requestedAnnualPayment:50000}),false);
  assert.equal(pensionMinimumYears(2029),15);
  assert.equal(pensionMinimumYears(2030),15.5);
  assert.equal(pensionMinimumYears(2039),20);
});

test('admission uses historical routes, distinct qualification and ownership, and labeled model bands', () => {
  assert.equal(educationAdmissionRoute(1951).id,'institution-exam');
  assert.equal(educationAdmissionRoute(1952).id,'gaokao');
  assert.equal(educationAdmissionRoute(1966).exam,false);
  assert.equal(educationAdmissionRoute(1966).id,'suspended');
  assert.equal(educationAdmissionRoute(1970).id,'recommendation');
  assert.equal(educationAdmissionRoute(1976).id,'recommendation');
  assert.equal(educationAdmissionRoute(1977).exam,true);
  assert.equal(examUniversityTier(95,1968).admitted,false);
  assert.equal(examUniversityTier(95,1973).admitted,false);
  assert.equal(examUniversityTier(70,2026).tier,'public-bachelor');
  assert.equal(examUniversityTier(60,2026).level,'university');
  assert.equal(examUniversityTier(60,2026).ownership,'private');
  assert.equal(examUniversityTier(60,1980).ownership,'public');
  assert.equal(examUniversityTier(60,2026).modelOnly,true);
  assert.equal(examUniversityTier(525,2026,{maxScore:750}).tier,'public-bachelor');
  assert.equal(examUniversityTier(15,2026).admitted,false);
  assert.equal(tuitionModel({level:'primary',year:2026}).tuition,0);
  assert.equal(tuitionModel({level:'junior',year:2026}).miscellaneous,0);
  assert.ok(tuitionModel({level:'university',ownership:'private'}).tuition > tuitionModel({level:'university'}).tuition);
  for(const source of CHINA_LAW_SOURCES) assert.ok(source.url.startsWith('https://') && source.title.zhCN && source.title.zhTW && source.title.en);
});
