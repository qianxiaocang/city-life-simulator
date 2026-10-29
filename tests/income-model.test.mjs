import test from 'node:test';
import assert from 'node:assert/strict';
import { createLife, ensureModelState } from '../app/engine.js';
import { locations } from '../app/data/locations.js';
import { economyYear } from '../app/economy.js';

test('a legacy Taiwan bus driver is corrected on load and cannot compound into executive pay', () => {
  const life=createLife({location:locations.find(p=>p.region==='taiwan'),birthYear:1980,seed:'bus-income-regression'});
  life.phase='life'; life.age=38; life.year=2018; delete life.incomeModelVersion;
  life.job={id:'bus-driver',salary:821311,years:16,marketIncomeReference:300000}; life.income=821311;
  ensureModelState(life);
  assert.ok(life.income<300000, 'the screenshot wage must be corrected in the stored model, not just formatted');
  const reference=life.profile.typicalIncome;
  for(let n=0;n<25;n++){
    life.year++;life.age++;
    economyYear(life,{normal:()=>1,chance:()=>true});
    assert.ok(life.job.salary<=reference*.95*1.8+1);
    assert.ok(life.income<=reference*.95*1.8*1.08+1);
  }
  life.lastJob=life.job;life.job=null;life.retired=true;life.pension=465057;
  ensureModelState(life);
  assert.ok(life.income<=reference*.65+1,'retirement cannot retain the inflated legacy salary');
});
