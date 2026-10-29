const game = require('./game');

// wx Canvas 2D uses the same painting operations as the web renderer. Keeping the
// scene renderer shared preserves the relationship between a record and its art.
const imageCache = new Map();
let imageSequence = 0;
function offscreen(width, height) {
  if (typeof wx.createOffscreenCanvas !== 'function') throw new Error('请升级微信后再生成纪念图片。');
  return wx.createOffscreenCanvas({ type: '2d', width, height });
}
function canvasFile(canvas) {
  if (typeof canvas.toDataURL === 'function') {
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    const filePath = `${wx.env.USER_DATA_PATH}/life-scene-${Date.now()}-${++imageSequence}.png`;
    return new Promise((resolve, reject) => wx.getFileSystemManager().writeFile({ filePath, data: base64, encoding: 'base64', success: () => resolve(filePath), fail: reject }));
  }
  return new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: 'png', success: result => resolve(result.tempFilePath), fail: reject }));
}
function generateScene(event, life) {
  const key = `${life && life.id || 'home'}:${life && life.urban ? 'urban' : 'rural'}:${event && event.id || 'default'}:${JSON.stringify(event && event.text || {})}`;
  if (imageCache.has(key)) return imageCache.get(key);
  const job = Promise.resolve().then(() => {
    const canvas = offscreen(640, 280);
    game.drawHighlightScene(canvas, event || { type: 'warm', text: { zhCN: '你和家人在城市中散步。' } }, life || { urban: true });
    return canvasFile(canvas);
  }).catch(error => { imageCache.delete(key); throw error; });
  imageCache.set(key, job);
  // Bound promise memory; referenced files remain valid until the next launch.
  // The page controller can still hold a URL after this cache evicts its entry.
  if (imageCache.size > 512) {
    const oldest = imageCache.keys().next().value;
    imageCache.delete(oldest);
  }
  return job;
}
function drawScene(page, selector, event, life) {
  return new Promise((resolve, reject) => {
    const query = page.createSelectorQuery ? page.createSelectorQuery() : wx.createSelectorQuery().in(page);
    query.select(selector).fields({ node: true, size: true }).exec(result => {
      const entry = result && result[0];
      if (!entry || !entry.node) { reject(new Error(`未找到像素画布 ${selector}`)); return; }
      const canvas = entry.node;
      canvas.width = Math.max(1, Math.round((entry.width || 320) * 2));
      canvas.height = Math.max(1, Math.round((entry.height || 140) * 2));
      game.drawHighlightScene(canvas, event, life);
      resolve(canvas);
    });
  });
}
function wrapText(context, text, x, y, width, lineHeight) {
  let line = '';
  for (const character of Array.from(String(text || ''))) {
    if (character === '\n') { context.fillText(line, x, y); y += lineHeight; line = ''; continue; }
    if (context.measureText(line + character).width > width && line) { context.fillText(line, x, y); y += lineHeight; line = ''; }
    line += character;
  }
  if (line) { context.fillText(line, x, y); y += lineHeight; }
  return y;
}
async function captureMemorial(page, life, options) {
  const { language = 'zh-CN', birth = false } = options || {};
  const L = value => game.valueText(value, language);
  const isEnglish = language === 'en';
  const text = birth ? L((life.log || []).find(event => event.type === 'birth')?.text) : game.lifeEndingNarrative(life, language);
  const width = 750, lineHeight = 43, textWidth = 622;
  const measureCanvas = offscreen(1, 1), measure = measureCanvas.getContext('2d');
  measure.font = '28px sans-serif';
  const bodyEnd = wrapText(measure, text, 0, 0, textWidth, lineHeight);
  const height = Math.max(1030, 680 + bodyEnd + 150);
  const canvas = offscreen(width, height), context = canvas.getContext('2d');
  context.fillStyle = birth ? '#f3f0e8' : '#101916'; context.fillRect(0, 0, width, height);
  const moments = game.selectLifeMoments(life);
  const event = birth ? (life.log || []).find(item => item.type === 'birth') : moments.find(item => item.type !== 'birth') || (life.log || [])[life.log.length - 1];
  const scene = offscreen(640, 280);
  game.drawHighlightScene(scene, event || { type: 'warm', text: { zhCN: '在熟悉的地方散步' } }, life);
  context.drawImage(scene, 48, 60, 654, 286);
  context.textAlign = 'center'; context.fillStyle = birth ? '#292b27' : '#f3efe2';
  context.font = 'bold 62px serif'; context.fillText(L(life.name), width / 2, 459);
  context.font = '28px monospace'; context.fillStyle = birth ? '#777a70' : '#adb9ad';
  context.fillText(birth ? `${life.birthYear} · ${L(life.born.name)}` : `${life.birthYear} — ${life.year} · ${life.age}${isEnglish ? ' years' : language === 'zh-TW' ? '歲' : '岁'}`, width / 2, 523);
  context.textAlign = 'left'; context.font = '28px sans-serif';
  wrapText(context, text, 64, 604, textWidth, lineHeight);
  context.fillStyle = birth ? '#297c65' : '#93c8b1'; context.font = '26px serif'; context.textAlign = 'center';
  context.fillText(isEnglish ? 'One in 1.4 Billion' : '14亿分之一', width / 2, height - 90);
  context.font = '20px sans-serif'; context.fillStyle = birth ? '#777a70' : '#7d9083';
  context.fillText(isEnglish ? 'An ordinary, irreplaceable life' : language === 'zh-TW' ? '平凡，又不可替代的一生' : '平凡，又不可替代的一生', width / 2, height - 50);
  const path = await canvasFile(canvas);
  wx.previewImage({ current: path, urls: [path] });
  return path;
}
function cleanSceneFiles() {
  const manager = wx.getFileSystemManager();
  manager.readdir({ dirPath: wx.env.USER_DATA_PATH, success: result => {
    for (const name of result.files || []) if (/^life-scene-[0-9-]+\.png$/.test(name)) manager.unlink({ filePath: `${wx.env.USER_DATA_PATH}/${name}`, fail() {} });
  }, fail() {} });
}
function saveImage(filePath) {
  return new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
    filePath,
    success: () => { wx.showToast({ title: '已保存到相册', icon: 'success' }); resolve(filePath); },
    fail: error => {
      if (/auth deny|authorize|auth denied/.test(error.errMsg || '')) {
        wx.showModal({ title: '保存纪念图片', content: '请在设置中允许保存到相册，然后再试一次。', confirmText: '去设置', success: result => { if (result.confirm) wx.openSetting({}); } });
      } else wx.showToast({ title: '图片未保存，可在预览中长按保存', icon: 'none' });
      reject(error);
    }
  }));
}
let audio = null, musicWanted = false, suspended = false;
function musicContext() {
  if (!audio) {
    audio = wx.createInnerAudioContext(); audio.src = '/assets/music.wav'; audio.loop = true; audio.volume = .32; audio.obeyMuteSwitch = false;
    audio.onError(error => { musicWanted = false; console.error('[music]', error); wx.showToast({ title: '音乐暂时无法播放', icon: 'none' }); });
  }
  return audio;
}
function toggleMusic() { musicWanted = !musicWanted; if (musicWanted && !suspended) musicContext().play(); else if (audio) audio.pause(); return musicWanted; }
function stopMusic() { musicWanted = false; if (audio) audio.stop(); }
function suspendMusic() { suspended = true; if (audio) audio.pause(); }
function resumeMusic() { suspended = false; if (musicWanted) musicContext().play(); }
module.exports = { drawScene, generateScene, captureMemorial, saveImage, cleanSceneFiles, toggleMusic, stopMusic, suspendMusic, resumeMusic };
