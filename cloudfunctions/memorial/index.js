const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const lives = db.collection('memorial_lives');
const lights = db.collection('memorial_lights');
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 40);
const fail = (message) => ({ ok: false, message });

exports.main = async event => {
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
    const life = event.life;
    if (!life || life.phase !== 'dead' || life.version !== 1 || typeof life.id !== 'string' || !life.name || !life.born || !Array.isArray(life.log) || !Array.isArray(life.years)) return fail('人生存档不完整');
    if (Buffer.byteLength(JSON.stringify(life)) > 700000) return fail('人生记录过长，暂时无法安放');
    const id = 'm_' + digest(openid + ':' + life.id);
    const existing = await lives.doc(id).get().catch(() => null);
    if (existing?.data?._id) {
      const farewell=String(life.farewell||'').slice(0,300);
      await lives.doc(id).update({data:{'life.farewell':farewell,'summary.farewell':farewell}});
      return { ok: true, id, alreadySaved: true };
    }
    const previewEvent = life.log.find(row => row.id === event.previewEventId) || life.log.find(row => row.type !== 'birth') || life.log[0];
    const summary = {
      id, sourceId: life.id, name: life.name, birthYear: life.birthYear, year: life.year, age: life.age,
      born: life.born, location: life.location, sex: life.sex, job: life.job, lastJob: life.lastJob,
      retired: !!life.retired, education: life.education, classRank: life.classRank, death: life.death,
      money: life.money, debt: life.debt, income: life.income, assets: life.assets || {},
      family: { children: life.family?.children || [] }, visited: life.visited || [],
      stars: life.stars || [], farewell: String(life.farewell || '').slice(0, 300), totals: life.totals || {},
      candles: 0, phase: 'dead', log: previewEvent ? [previewEvent] : [], years: [],
    };
    await lives.doc(id).set({ data: { owner: openid, createdAt: db.serverDate(), summary, life } });
    return { ok: true, id, alreadySaved: false };
  }
  if (event.action === 'list') {
    const offset = Math.max(0, Math.min(10000, Number(event.offset) || 0));
    const result = await lives.orderBy('createdAt', 'desc').skip(offset).limit(51).field({ summary: true }).get();
    const rows = result.data || [];
    return { ok: true, items: rows.slice(0, 50).map(row => ({ ...row.summary, id: row._id || row.summary.id })), hasMore: rows.length > 50 };
  }
  if (event.action === 'get') {
    const id = String(event.id || '');
    if (!/^m_[a-f0-9]{40}$/.test(id)) return fail('无效的人生记录');
    const result = await lives.doc(id).get().catch(() => null);
    if (!result?.data?.life) return fail('这段人生暂时无法读取');
    return { ok: true, life: { ...result.data.life, id, sourceId: result.data.life.id, candles: result.data.summary.candles || 0 } };
  }
  if (event.action === 'candle') {
    const id = String(event.id || '');
    if (!/^m_[a-f0-9]{40}$/.test(id)) return fail('无效的人生记录');
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
