import test from 'node:test';import assert from 'node:assert/strict';
import {siblingWeights,maternalFirstBirthAge,fecundity,canConceive} from '../app/family-model.js';
import {createLife,configureLocations} from '../app/engine.js';import {locations} from '../app/data/locations.js';
test('family calibration distinguishes policy eras without declaring family size unlawful',()=>{
 const mean=w=>w.reduce((s,x,i)=>s+x*i,0);assert.ok(siblingWeights(1950,true)[0]>0);assert.ok(siblingWeights(2000,true)[0]>.4);assert.ok(mean(siblingWeights(2020,true))>mean(siblingWeights(2000,true)));assert.ok(maternalFirstBirthAge(2020)>maternalFirstBirthAge(1950));
});
test('conception uses the maternal age and a recorded prior relationship',()=>{
 const l={year:2026,age:38,sex:'male',family:{partner:{alive:true,married:true,age:50,sinceYear:2020}}};assert.equal(canConceive(l),false);l.family.partner.age=30;assert.equal(canConceive(l),true);l.family.partner.sinceYear=2027;assert.equal(canConceive(l),false);assert.ok(fecundity(46)<.01);assert.equal(fecundity(50),0);
});
test('parents and siblings carry consistent birth dates and sex for independent hazards',()=>{
 configureLocations(locations);for(let seed=0;seed<60;seed++){const l=createLife({locations,seed:'family-fields-'+seed,birthYear:1950});for(const p of [l.family.mother,l.family.father,...l.family.siblings]){assert.equal(p.birthYear,1950-p.age);assert.ok(['male','female'].includes(p.sex));}assert.ok(l.family.mother.age-l.family.siblings.length*2>=18);}
});
