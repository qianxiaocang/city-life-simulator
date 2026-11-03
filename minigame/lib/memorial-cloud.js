// The Mini Game and Mini Program use the same cloud function. Only the server
// writes memorial documents; the client never has collection write access.
const ENV = 'cloud1-d8gwoxbv9568494b0';
let initialized = false;

function call(action, data = {}) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') return Promise.reject(new Error('微信云开发不可用'));
  if (!initialized) { wx.cloud.init({ env: ENV, traceUser: true }); initialized = true; }
  return wx.cloud.callFunction({ name: 'memorial', data: { action, ...data } }).then(response => {
    const result = response.result;
    if (!result || !result.ok) throw new Error(result?.message || '云端请求失败');
    return result;
  });
}

function publish(life, previewEventId) {
  return call('publish', { life, previewEventId });
}
function list(offset=0,scope='all'){return call('list',{offset,scope});}
let accountKey='',totals={};
try{accountKey=wx.getStorageSync('parallel-current-cache-key')||'';}catch{}
const cacheName=scope=>'parallel-lives.v2.'+accountKey+'.'+scope;
function cachedPage(offset=0,scope='mine'){
 if(!accountKey)return null;
 try{const meta=wx.getStorageSync(cacheName(scope)),page=wx.getStorageSync(cacheName(scope)+'.page.'+offset);if(meta&&page?.token===meta.token&&Array.isArray(page.items))return {ok:true,total:meta.total,items:page.items,hasMore:offset+page.items.length<meta.total,offset,facts:meta.facts};}catch{}
 return null;
}
async function loadPage(offset=0,scope='all'){
 if(scope==='mine'){const local=cachedPage(offset,scope);if(local)return local;}
 const previous=totals[scope];
 const stats=offset===0||!previous?await call('stats',{scope}):previous;
 accountKey=stats.cacheKey;totals[scope]=stats;try{wx.setStorageSync('parallel-current-cache-key',accountKey);}catch{}
 let meta;try{meta=wx.getStorageSync(cacheName(scope));}catch{}
 const unchanged=meta&&meta.total===stats.total&&typeof meta.token==='string';
 if(!unchanged){if(offset>0)offset=0;meta={total:stats.total,token:Date.now().toString(36)+Math.random().toString(36)};}
 const pageKey=cacheName(scope)+'.page.'+offset;
 let cached;try{cached=wx.getStorageSync(pageKey);}catch{}
 if(unchanged&&cached?.token===meta.token&&Array.isArray(cached.items))return {ok:true,total:stats.total,items:cached.items,hasMore:offset+cached.items.length<stats.total,offset,facts:stats.facts};
 const result=stats.total===0?{ok:true,total:0,items:[],hasMore:false}:await list(offset,scope);
 meta.total=result.total;meta.facts=stats.facts;totals[scope]={...stats,total:result.total};
 try{wx.setStorageSync(cacheName(scope),meta);wx.setStorageSync(pageKey,{token:meta.token,items:result.items});}catch(error){console.warn('Parallel life cache unavailable');}
 return {...result,offset,facts:stats.facts};
}
function invalidate(){totals={};if(accountKey)for(const scope of ['all','mine'])try{wx.removeStorageSync(cacheName(scope));}catch{}}

function get(id) { return call('get', { id }); }
function candle(id) { return call('candle', { id }); }

async function shareCover(filePath) {
  const base64=await new Promise((resolve,reject)=>wx.getFileSystemManager().readFile({filePath,encoding:'base64',success:r=>resolve(r.data),fail:reject}));
  const result=await call('shareCover',{base64});
  if(!/^https:\/\//.test(result.imageUrl||''))throw new Error('分享封面地址不可用');
  if(typeof wx.createImage==='function')await new Promise((resolve,reject)=>{
    const image=wx.createImage();
    const timeout=setTimeout(()=>reject(new Error('分享封面加载超时')),15000);
    image.onload=()=>{clearTimeout(timeout);resolve();};
    image.onerror=()=>{clearTimeout(timeout);reject(new Error('分享封面加载失败'));};
    image.src=result.imageUrl;
  });
  return result.imageUrl;
}
module.exports = { publish, list, get, candle, shareCover, loadPage, cachedPage, invalidate };
