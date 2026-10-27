import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {E,locations,law,Meter,save} from './lib/harness.mjs';
const dir=resolve(process.env.AUDIT_OUT||'.');
const audit=JSON.parse(readFileSync(resolve(dir,'audit-results.json'),'utf8'));
const m=new Meter();
const minima={mainland:{job:16,male:22,female:20},taiwan:{job:15,male:18,female:18},hongkong:{job:15,male:16,female:16},macau:{job:16,male:16,female:16}};
for(const [region,expected] of Object.entries(minima)){
  m.check('CURRENT_LOCAL_EMPLOYMENT_RULE',law.legalEmploymentAge(region,2026)===expected.job,{region,expected:expected.job,actual:law.legalEmploymentAge(region,2026)});
  for(const sex of ['male','female'])m.check('CURRENT_LOCAL_MARRIAGE_RULE',law.legalMarriageAge(sex,region,2026)===expected[sex],{region,sex,expected:expected[sex],actual:law.legalMarriageAge(sex,region,2026)});
}
m.check('TAIWAN_2023_MARRIAGE_CHANGE',law.legalMarriageAge('female','taiwan',2022)===16&&law.legalMarriageAge('female','taiwan',2023)===18,{});
m.check('REGIONAL_PENSION_THRESHOLDS',law.pensionMinimumYears(2026,'taiwan')===15&&law.pensionMinimumYears(2026,'macau')===5&&law.pensionMinimumYears(2026,'hongkong')===null,{});
for(const region of Object.keys(minima)){
  const place=locations.find(x=>x.region===region);
  const profile=E.createLife({locations,location:place,seed:'metadata-'+region,birthYear:2026,world:'now'}).profile;
  m.check('MODEL_METADATA_2026',profile.projection===true&&profile.observedThrough===2025&&profile.currencyBasis==='CNY-2025-model',{region,profile:{projection:profile.projection,observedThrough:profile.observedThrough,currencyBasis:profile.currencyBasis}});
}
for(const [id,row] of Object.entries(audit.coverage.cultural))m.check('CULTURAL_EXPOSURE_25_90',row.denominator>0&&row.rate>=.25&&row.rate<=.9,{id,...row});
const weighted=locations.filter(x=>Number.isFinite(x.population)&&x.population>0);
const unique=new Set(weighted.map(x=>x.population));
m.check('REAL_POPULATION_COVERAGE',weighted.length/locations.length>.9,{recorded:weighted.length,total:locations.length,ratio:weighted.length/locations.length});
m.check('REAL_POPULATION_UNIQUE_800',unique.size>=800,{unique:unique.size,required:800});
m.check('POPULATION_TVD',false,{reason:'No complete source-aligned population distribution; TVD cannot be computed honestly.'},weighted.length/locations.length>.9);
const out={meta:{auditLives:audit.meta.lives,method:'local laws/metadata and 60k population/culture counters; missing population remains an explicit failure'},...m.report(),population:{recorded:weighted.length,total:locations.length,unique:unique.size,weightKind:audit.coverage.distinctBirthWeights,sourceStatus:'No 2020 population table for all leaf birthplaces in the supplied local research.',tvd:null}};
save('batch-assertions.json',out);console.log(JSON.stringify(out,null,2));
