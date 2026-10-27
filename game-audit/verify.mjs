import {E,locations,Meter,drive,save} from './lib/harness.mjs';
const m=new Meter();
for(let i=0;i<Number(process.env.N??4000);i++)drive(E.createLife({locations,seed:'v'+i,world:'past',birthYear:1990+i%20}),m);
const out=m.report();save('verify-results.json',out);
for(const code of ['EMPLOYMENT_AGE','RETIREMENT_AGE','PENSION_MIN_CONTRIBUTIONS','PENSION_JURISDICTION','MARRIAGE_HAS_LAW','MARRIAGE_AGE']){
 const c=out.checks[code];console.log(code,c?`${c.status}: ${c.failed} / ${c.denominator}, unsupported ${c.unsupported}`:'NOT_CHECKED: 0 / 0');
}
for(const code of ['firstJobAge','retirementAge','firstMarriageAge','pensionReplacement'])console.log(code,JSON.stringify(out.aggregates[code]));
