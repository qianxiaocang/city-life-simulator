import test from 'node:test';
import assert from 'node:assert/strict';
import {locations} from '../app/data/locations.js';
import {createLife,startLife,advanceYear,autoChoose,setFocus,getFocusOptions,processTimeline,mortality} from '../app/engine.js';

const places=['cn-511800','tw-taipei','hk-city','mo-city'].map(id=>locations.find(place=>place.id===id));
// Catalogue IDs are canonical, while this fixture chooses one place per jurisdiction.
for(let i=0;i<places.length;i++)places[i]??=locations.find(place=>place.region===['mainland','taiwan','hongkong','macau'][i]);
test('48 complete lifetimes preserve funding, chronology, geography and translations across eras and regions',()=>{
  for(const location of places)for(const birthYear of [1950,1970,1995,2026])for(const language of ['zh-CN','zh-TW','en']){
    const life=createLife({locations,location,birthYear,world:'past',language,seed:`matrix-${location.id}-${birthYear}-${language}`});
    startLife(life);
    let steps=0;
    while(life.phase!=='dead'&&steps++<2000){
      if(life.pending)autoChoose(life);
      else {const focus=getFocusOptions(life);if(focus.length)setFocus(life,focus[life.age%focus.length].id);advanceYear(life);}
      assert.ok(life.money>=0,`${life.id}: cash`);
      if(!life.everWorked)assert.equal(life.loans.mortgage.balance,0);
      assert.equal(life.year,life.birthYear+life.age);
      assert.equal(new Set(life.history.experienced).size,life.history.experienced.length);
      assert.ok(locations.some(place=>place.id===life.location.id));
      assert.equal(life.debt,Math.round(life.loans.student.balance+life.loans.mortgage.balance));
    }
    assert.equal(life.phase,'dead');
    for(const event of life.log)for(const language of ['zhCN','zhTW','en'])assert.ok(event.text[language]);
  }
});
test('timeline source metadata and once-only exposure survive an engine save round trip',()=>{
  const life=createLife({locations,location:places[0],birthYear:1995,seed:'lushan-integration',world:'past'});
  startLife(life);life.age=18;life.year=2013;life.pending=null;life.pendingQueue=[];
  processTimeline(life,.2);
  assert.ok(!life.history.experienced.includes('lushan2013'));
  processTimeline(life,.4);
  assert.ok(life.history.experienced.includes('lushan2013'));
  const entry=life.log.find(item=>item.historicalEventId==='lushan2013');
  assert.ok(entry.sourceUrls.length);assert.equal(entry.timeBeijing,'08:02');
  const restored=JSON.parse(JSON.stringify(life));const count=restored.log.length;
  processTimeline(restored,.4);assert.equal(restored.log.length,count);
});
test('historical child mortality does not count healthcare changes twice',()=>{
  const life=createLife({locations,location:places[0],birthYear:1950,seed:'historical-child'});
  life.stats.health=82;life.classRank=3;life.urban=false;
  const urbanization=life.profile.urbanization;
  const q=life.profile.childMortality*1.6/(urbanization*.6+(1-urbanization)*1.6);
  const infant=1-Math.pow(1-q,.65),later=1-Math.pow(1-q,.35/4);
  assert.ok(Math.abs(mortality(life)-infant)<1e-9);
  life.age=1;
  assert.ok(Math.abs(mortality(life)-later)<1e-9);
  assert.ok(Math.abs(1-(1-infant)*Math.pow(1-later,4)-q)<1e-9);
  assert.ok(q>=.2&&q<.5);

});
