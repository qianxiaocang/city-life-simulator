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

module.exports = { publish, list, get, candle };
