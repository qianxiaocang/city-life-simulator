// Run once through the authenticated CloudBase management API, then delete the function.
// Accepts no caller-selected records or identity. Existing owner data is preserved.
const cloud=require('wx-server-sdk'),crypto=require('crypto');cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db=cloud.database(),lives=db.collection('memorial_lives'),aliases=db.collection('memorial_aliases'),lights=db.collection('memorial_lights');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,40);
function idFor(s){let n=BigInt('0x'+crypto.createHash('sha256').update(s).digest('hex')),out='';const chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';do{out=chars[Number(n%62n)]+out;n/=62n;}while(n);return 'Pp0'+out.padStart(43,'0');}
exports.main=async()=>{
 const result=await lives.limit(100).get();let migrated=0;
 for(const row of result.data){
  if(!/^m_/.test(row._id))continue;
  if(typeof row.owner!=='string'||!row.life?.id)throw new Error('Legacy record has no verified owner');
  const {_id,...data}=row,id=idFor(row.owner+':'+row.life.id);
  data.openid=row.owner;data.summary.id=id;
  const note=String(row.life.farewell||'').replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,'');data.life.farewell=Array.from(note).slice(0,200).join('');data.summary.farewell=data.life.farewell;
  await lives.doc(id).set({data});await aliases.doc(_id).set({data:{id}});
  const candles=await lights.where({memorialId:_id}).limit(100).get();
  for(const old of candles.data){const {_id:oldId,...light}=old;light.memorialId=id;await lights.doc('l_'+digest(light.openid+':'+id)).set({data:light});await lights.doc(oldId).remove();}
  await lives.doc(_id).remove();migrated++;
 }
 return {migrated};
};
