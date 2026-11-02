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
function list(offset = 0) { return call('list', { offset }); }
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
module.exports = { publish, list, get, candle, shareCover };
