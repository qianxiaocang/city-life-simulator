import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));

function harness() {
  const collections = new Map();
  const table = name => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  const database = {
    serverDate: () => new Date('2026-11-02T00:00:00Z'),
    collection(name) {
      const rows = table(name);
      return {
        doc(id) { return {
          async get() { if (!rows.has(id)) throw new Error('missing'); return { data: { _id: id, ...rows.get(id) } }; },
          async set({ data }) { rows.set(id, data); },
          async update({ data }) { const row = rows.get(id); for (const [key, value] of Object.entries(data)) { if (key === 'summary.candles') row.summary.candles = value; else row[key] = value; } },
        }; },
        aggregate(){let filter={};const pipeline={match(value){filter=value;return this;},project(){return this;},group(){return this;},async end(){const list=[...rows.values()].filter(row=>Object.entries(filter).every(([key,value])=>row[key]===value));return {list:[{total:list.length,years:list.reduce((n,row)=>n+row.summary.age,0),longest:Math.max(0,...list.map(row=>row.summary.age)),places:new Set(list.flatMap(row=>(row.summary.visited||[]).map(p=>p.id))).size,moments:list.reduce((n,row)=>n+(row.summary.stars||[]).length,0),candles:list.reduce((n,row)=>n+(row.summary.candles||0),0)}]};}};return pipeline;},
        ...query(),
      };
      function query(filter={}){
        const records=()=>[...rows].filter(([,row])=>Object.entries(filter).every(([key,value])=>row[key]===value));
        return {where:next=>query(next),count:async()=>({total:records().length}),orderBy:()=>({skip:offset=>({limit:size=>({field:()=>({get:async()=>({data:records().reverse().slice(offset,offset+size).map(([id,row])=>({_id:id,summary:row.summary}))})})})})})};
      }

    },
  };
  let openid = 'person-one';
  const sdk = { uploadFile: async()=>({fileID:'cloud://birth-cover'}), getTempFileURL:async()=>({fileList:[{tempFileURL:'https://example.com/birth-cover.png'}]}), DYNAMIC_CURRENT_ENV: 'dynamic', init() {}, database: () => database, getWXContext: () => ({ OPENID: openid }) };
  const safe={module:{exports:{}}};vm.runInNewContext(readFileSync(resolve(root,'cloudfunctions/memorial/safe-text.js'),'utf8'),safe);
  const sandbox = { exports: {}, require: name => name === 'wx-server-sdk' ? sdk : name==='./safe-text'?safe.module.exports:crypto, Buffer };
  vm.runInNewContext(readFileSync(resolve(root, 'cloudfunctions/memorial/index.js'), 'utf8'), sandbox);
  return { main: sandbox.exports.main, collections, setOpenid: value => { openid = value; } };
}

test('memorial cloud function publishes once, lists cloud records, opens full lives and counts unique candle lighters', async () => {
  const { main, collections, setOpenid } = harness();
  const life = { version: 1, id: 'life-one', phase: 'dead', name: { zhCN: '测试人物' }, born: { name: { zhCN: '成都市' } }, birthYear: 2026, year: 2100, age: 74,location:{name:{zhCN:'成都市'}},family:{children:[]},stats:{health:80}, log: [{ id: 'birth', type: 'birth' }, { id: 'last', type: 'daily' }], years: [] };
  const first = await main({ action: 'publish', life, previewEventId: 'last' });
  assert.equal(first.ok, true);
  assert.equal((await main({ action: 'publish', life })).alreadySaved, true);
  assert.equal(collections.get('memorial_lives').size, 1);
  const listed = await main({ action: 'list' });
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].log[0].id, 'last');
  assert.equal(listed.items[0].id, first.id);
  const opened = await main({ action: 'get', id: first.id });
  assert.equal(opened.life.sourceId, life.id);
  assert.equal(opened.life.log.length, 2);
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 1);
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 1);
  setOpenid('person-two');
  assert.equal((await main({ action: 'candle', id: first.id })).candles, 2);
  assert.equal((await main({ action: 'list' })).items[0].candles, 2);
  assert.equal((await main({ action: 'publish', life: { ...life, phase: 'life' } })).ok, false);
});


test('birth cover returns a HTTPS image URL and rejects invalid image data', async()=>{
 const {main}=harness();
 const cover=await main({action:'shareCover',base64:Buffer.from('89504e470d0a1a0a','hex').toString('base64')});
 assert.equal(cover.ok,true);assert.equal(cover.imageUrl,'https://example.com/birth-cover.png');
 assert.equal((await main({action:'shareCover',base64:'not-an-image'})).ok,false);
});

test('parallel lives enforce trusted identity, alphanumeric IDs, 8-row paging and safe 200-character notes',async()=>{
 const {main,collections,setOpenid}=harness();
 const life=n=>({version:1,id:'source-'+n,phase:'dead',name:{zhCN:'人物'},born:{name:{zhCN:'北京'}},year:2100,birthYear:2026,age:74,location:{name:{zhCN:'北京'}},family:{children:[]},stats:{health:80},log:[],years:[],farewell:'<script>alert(1)</script>'+ '好'.repeat(220),openid:'forged'});
 for(let i=0;i<17;i++){const r=await main({action:'publish',life:life(i)});assert.match(r.id,/^[A-Za-z0-9]{46}$/);assert.match(r.id,/[A-Z]/);assert.match(r.id,/[a-z]/);assert.match(r.id,/[0-9]/);}
 const facts=await main({action:'stats'});assert.equal(facts.facts.total,17);assert.equal(facts.facts.years,17*74);assert.equal(facts.facts.longest,74);
 const first=await main({action:'list',scope:'mine'});assert.equal(first.total,17);assert.equal(first.items.length,8);assert.equal(first.hasMore,true);
 const row=collections.get('memorial_lives').get(first.items[0].id);assert.equal(row.openid,'person-one');assert.equal(row.owner,'person-one');assert.equal(row.life.openid,undefined);assert.equal(Array.from(row.life.farewell).length,200);assert.doesNotMatch(row.life.farewell,/script|alert/);
 setOpenid('person-two');assert.equal((await main({action:'list',scope:'mine'})).total,0);
 assert.equal((await main({action:'list',scope:'all'})).total,17);
 assert.equal((await main({action:'publish',openid:'person-one',life:life(99)})).ok,false);
 assert.equal((await main({action:'list',scope:'mine',owner:{$ne:null}})).ok,false);
 const tail=await main({action:'list',offset:16});assert.equal(tail.items.length,1);assert.equal(tail.hasMore,false);
 assert.equal((await main({action:'list',offset:{$gt:0}})).ok,false);
});

test('legacy share IDs resolve to migrated records without changing identity',async()=>{
 const {main,collections}=harness();
 const life={version:1,id:'old-source',phase:'dead',name:{zhCN:'人物'},born:{name:{zhCN:'北京'}},location:{name:{zhCN:'北京'}},family:{children:[]},stats:{health:80},year:2100,birthYear:2026,age:74,log:[],years:[]};
 const published=await main({action:'publish',life});const old='m_'+'0'.repeat(40);
 collections.get('memorial_aliases').set(old,{id:published.id});
 const result=await main({action:'get',id:old});assert.equal(result.life.id,published.id);assert.equal(result.life.sourceId,'old-source');
});
