const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const {safeText}=require('./safe-text');
const validId=id=>typeof id==='string'&&(/^[A-Za-z0-9]{46}$/.test(id)||/^m_[a-f0-9]{40}$/.test(id));
const publicId=value=>{let n=BigInt('0x'+crypto.createHash('sha256').update(value).digest('hex')),out='';const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';do{out=chars[Number(n%62n)]+out;n/=62n;}while(n);return 'Pp0'+out.padStart(43,'0');};
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const lives = db.collection('memorial_lives');
const lights = db.collection('memorial_lights');
const aliases=db.collection('memorial_aliases');
async function resolveId(id){if(!/^m_/.test(id))return id;const alias=await aliases.doc(id).get().catch(()=>null);return alias?.data?.id||id;}
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 40);
const fail = (message) => ({ ok: false, message });

async function collectFacts(owner){
 const result=await lives.aggregate().match(owner?{owner}:{}).project({age:'$summary.age',moments:{$size:{$ifNull:['$summary.stars',[]]}},candles:{$ifNull:['$summary.candles',0]},places:{$map:{input:{$ifNull:['$summary.visited',[]]},as:'p',in:'$$p.id'}}}).group({_id:null,total:{$sum:1},years:{$sum:'$age'},longest:{$max:'$age'},moments:{$sum:'$moments'},candles:{$sum:'$candles'},places:{$addToSet:'$places'}}).project({_id:0,total:1,years:1,longest:1,moments:1,candles:1,places:{$size:{$reduce:{input:'$places',initialValue:[],in:{$setUnion:['$$value','$$this']}}}}}).end();
 return (result.list||result.data||[])[0]||{total:0,years:0,longest:0,places:0,moments:0,candles:0};
}
exports.main = async event => {
  if(!event||typeof event!=='object'||['openid','owner','_openid'].some(key=>Object.hasOwn(event,key)))return fail('不允许指定用户身份');
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return fail('请在微信中登录后重试');
  if(event.action==='shareCover') {
    const encoded=event.base64;
    if(typeof encoded!=='string'||encoded.length>1000000||!/^[A-Za-z0-9+/=]+$/.test(encoded))return fail('封面图片无效');
    const bytes=Buffer.from(encoded,'base64');
    if(bytes.length<8||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')return fail('封面必须为PNG图片');
    const cloudPath='birth-covers/'+digest(openid)+'/'+digest(encoded)+'.png';
    const uploaded=await cloud.uploadFile({cloudPath,fileContent:bytes});
    const urls=await cloud.getTempFileURL({fileList:[uploaded.fileID]});
    const imageUrl=urls.fileList?.[0]?.tempFileURL;
    if(!imageUrl||!imageUrl.startsWith('https://'))return fail('封面暂时无法读取，请重试');
    return {ok:true,imageUrl};
  }
  if (event.action === 'publish') {
    let life = event.life;
    if (!life || life.phase !== 'dead' || life.version !== 1 || typeof life.id !== 'string' || !life.name || !life.born || !Array.isArray(life.log) || !Array.isArray(life.years)) return fail('人生存档不完整');
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(life.id)||!life.location||!life.family||!Array.isArray(life.family.children)||!life.stats||!Number.isInteger(life.age)||life.age<0||life.age>130||!Number.isInteger(life.birthYear)||life.year!==life.birthYear+life.age)return fail('人生存档格式不正确');
    if (Buffer.byteLength(JSON.stringify(life)) > 700000) return fail('人生记录过长，暂时无法安放');
    life=JSON.parse(JSON.stringify(life),(key,value)=>(['__proto__','prototype','constructor','openid','owner','_openid'].includes(key)||key.startsWith('$'))?undefined:typeof value==='string'?safeText(value,10000):value);
    life.farewell=safeText(life.farewell,200);
    const id = publicId(openid + ':' + life.id);
    const existing = await lives.doc(id).get().catch(() => null);
    if (existing?.data?._id) {
      if(existing.data.owner!==openid)return fail('无法修改其他用户的人生');
      const farewell=safeText(life.farewell,200);
      await lives.doc(id).update({data:{'life.farewell':farewell,'summary.farewell':farewell}});
      return { ok: true, id, cacheKey:digest(openid), alreadySaved: true };
    }
    const previewEvent = life.log.find(row => row.id === event.previewEventId) || life.log.find(row => row.type !== 'birth') || life.log[0];
    const summary = {
      id, sourceId: life.id, name: life.name, birthYear: life.birthYear, year: life.year, age: life.age,
      born: life.born, location: life.location, sex: life.sex, job: life.job, lastJob: life.lastJob,
      retired: !!life.retired, education: life.education, classRank: life.classRank, death: life.death,
      money: life.money, debt: life.debt, income: life.income, assets: life.assets || {},
      family: { children: life.family?.children || [] }, visited: life.visited || [],
      stars: life.stars || [], farewell: safeText(life.farewell,200), totals: life.totals || {},
      candles: 0, phase: 'dead', log: previewEvent ? [previewEvent] : [], years: [],
    };
    await lives.doc(id).set({ data: { owner: openid, openid, createdAt: db.serverDate(), summary, life } });
    return { ok: true, id, cacheKey:digest(openid), alreadySaved: false };
  }
  if(event.action==='stats'||event.action==='list') {
    if(event.scope!==undefined&&!['all','mine'].includes(event.scope))return fail('无效的列表范围');
    const query=event.scope==='mine'?lives.where({owner:openid}):lives;
    if(event.action==='stats'){const facts=await collectFacts(event.scope==='mine'?openid:null);return {ok:true,total:facts.total,facts,cacheKey:digest(openid)};}
    const total=(await query.count()).total;
    const offset=Number(event.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)return fail('无效的分页参数');
    const result=await query.orderBy('createdAt','desc').skip(offset).limit(8).field({summary:true}).get();
    return {ok:true,total,items:(result.data||[]).map(row=>({...row.summary,id:row._id||row.summary.id,farewell:safeText(row.summary.farewell,200)})),hasMore:offset+(result.data||[]).length<total,cacheKey:digest(openid)};
  }
  if (event.action === 'get') {
    let id = String(event.id || '');
    if (!validId(id)) return fail('无效的人生记录');
    id=await resolveId(id);
    const result = await lives.doc(id).get().catch(() => null);
    if (!result?.data?.life) return fail('这段人生暂时无法读取');
    return { ok: true, life: { ...result.data.life, farewell:safeText(result.data.life.farewell,200), id, sourceId: result.data.life.id, candles: result.data.summary.candles || 0 } };
  }
  if (event.action === 'candle') {
    let id = String(event.id || '');
    if (!validId(id)) return fail('无效的人生记录');
    id=await resolveId(id);
    const lightId = 'l_' + digest(openid + ':' + id);
    const result = await lives.doc(id).get().catch(() => null);
    if (!result?.data?.summary) return fail('这段人生暂时无法读取');
    const old = await lights.doc(lightId).get().catch(() => null);
    if (!old?.data?._id) await lights.doc(lightId).set({ data: { memorialId: id, openid, createdAt: db.serverDate() } });
    const tally = await lights.where({ memorialId: id }).count();
    await lives.doc(id).update({ data: { 'summary.candles': tally.total } });
    return { ok: true, id, candles: tally.total, alreadyLit: !!old?.data?._id };
  }
  return fail('不支持的操作');
};
