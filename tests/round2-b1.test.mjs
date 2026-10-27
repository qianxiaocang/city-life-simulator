import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife, startLife, processTimeline, mortality} from '../app/engine.js';
import {historicalContext} from '../app/history-runtime.js';
import {locations} from '../app/data/locations.js';

const fixture = (age, region='mainland', multiplier=1) => ({
  age, year: 1960, sex:'female', world:'past', classRank:3, urban:true,
  born:{id:region}, location:{id:region,region}, conditions:[], flags:{},
  stats:{health:age<5?82:67},
  profile:{lifeExpectancy:79,lifeExpectancyAt25:78.6,childMortality:.006,urbanization:.5},
  marketContext:{mortalityMultiplier:multiplier},
});

test('adult conditional lifespan removes the 44.7-fold birth-LE hazard amplification',()=>{
  for(const age of [40,60]){
    const historical=fixture(age),modern=fixture(age);
    delete historical.profile.lifeExpectancyAt25;
    delete modern.profile.lifeExpectancyAt25;
    historical.profile.lifeExpectancy=41;
    const ratio=mortality(historical)/mortality(modern);
    assert.ok(ratio>=1.2&&ratio<=2.2,`${age}: ${ratio}`);
  }
});

test('1959–61 mortality shock follows calendar year and mainland residence',()=>{
  const mainland=locations.find(place=>place.region==='mainland');
  const hongkong=locations.find(place=>place.region==='hongkong');
  for(const [year,expected] of [[1959,2],[1960,2.3],[1961,1.6],[1962,1]]){
    for(const [place,multiplier] of [[mainland,expected],[hongkong,1]]){
      const life=createLife({location:place,locations,seed:`b1-${place.region}-${year}`,birthYear:1955,world:'past'});
      startLife(life);life.year=year;life.age=year-1955;life.pending=null;life.pendingQueue=[];
      processTimeline(life,1);
      assert.equal(historicalContext(life).mortalityMultiplier,multiplier,`${place.region} ${year}`);
    }
  }
  assert.ok(Math.abs(mortality(fixture(40,'mainland',2.3))/mortality(fixture(40))-2.3)<1e-12);
  assert.ok(Math.abs(mortality(fixture(2,'mainland',2.3))/mortality(fixture(2))-3.68)<1e-12);
  assert.equal(mortality(fixture(40,'hongkong',2.3)),mortality(fixture(40,'hongkong')));
});
