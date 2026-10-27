import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,startLife,advanceYear,choose,autoChoose,configureLocations} from '../app/engine.js';
import {bookNetWorth} from '../app/accounting.js';
import {locations} from '../app/data/locations.js';

configureLocations(locations);

test('a life decision buys a household asset and records both asset and cash changes',()=>{
  const life=createLife({seed:'memorial-finance-choice',birthYear:2000,world:'past',location:locations.find(place=>place.region==='mainland')});
  startLife(life);
  life.money=1_000_000;
  life.accounts.openingNetWorth=bookNetWorth(life);
  let steps=0;
  while(steps++<180&&life.phase==='life'&&life.pending?.action!=='financial'){
    if(life.pending)autoChoose(life);else advanceYear(life);
  }
  assert.equal(life.pending?.action,'financial');
  assert.ok(life.pending.options.some(option=>option.id==='phone'));
  const age=life.age,cash=life.money;
  assert.equal(choose(life,'phone'),true);
  assert.equal(life.age,age);
  assert.ok(life.assets.phone>0);
  assert.ok(life.money<cash);
  assert.ok(life.log.some(event=>event.age===age&&event.type==='asset'&&event.text.zhCN.includes('通信设备')));
  assert.ok(life.log.some(event=>event.age===age&&event.type==='money'&&event.text.zhCN.includes('现金减少')));
  assert.equal(life.debt,0);
});

test('recurring finance decisions expose investments and different life needs without forcing spending',()=>{
  const seen=new Set();
  for(let seed=0;seed<24;seed++){
    const life=createLife({seed:`financial-rotation-${seed}`,birthYear:2000,world:'past',location:locations.find(place=>place.region==='mainland')});
    startLife(life);
    life.money=1_000_000;
    life.accounts.openingNetWorth=bookNetWorth(life);
    let steps=0;
    while(life.phase==='life'&&steps++<900){
      if(life.pending?.action==='financial'){
        for(const option of life.pending.options)seen.add(option.id);
        const before={cash:life.money,investment:life.investment,assets:structuredClone(life.assets),debt:life.debt};
        choose(life,'keep');
        assert.deepEqual({cash:life.money,investment:life.investment,assets:life.assets,debt:life.debt},before);
      }else if(life.pending)autoChoose(life);else advanceYear(life);
    }
    assert.equal(life.phase,'dead');
  }
  for(const item of ['invest-bond','invest-fund','invest-stock','computer','health','child-school','furniture','appliances','car'])assert.ok(seen.has(item),`${item} was never offered`);
});
