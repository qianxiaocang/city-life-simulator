const game = require('./game');

// wx Canvas 2D uses the same painting operations as the web renderer. Keeping the
// scene renderer shared preserves the relationship between a record and its art.
const imageCache = new Map();
let imageSequence = 0;
function offscreen(width, height) {
  if (typeof wx.createOffscreenCanvas === 'function') return wx.createOffscreenCanvas({ type: '2d', width, height });
  // Mini Games expose wx.createCanvas for additional offscreen canvases.
  const canvas = wx.createCanvas(); canvas.width = width; canvas.height = height; return canvas;
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
  return canvasFile(canvas);
}
async function createBirthShare(life, language = 'zh-CN') {
  const L = value => game.valueText(value, language);
  const canvas = offscreen(600, 480), context = canvas.getContext('2d');
  context.fillStyle = '#f3f0e8'; context.fillRect(0, 0, 600, 480);
  const birth = (life.log || []).find(event => event.type === 'birth') || { type: 'birth', age: 0 };
  const scene = offscreen(640, 280);
  game.drawHighlightScene(scene, birth, life);
  context.drawImage(scene, 24, 24, 552, 242);
  context.fillStyle = '#236b59'; context.font = 'bold 20px sans-serif'; context.textAlign = 'left';
  context.fillText(language === 'en' ? 'BIRTH CARD' : language === 'zh-TW' ? '出生登記' : '出生登记', 32, 301);
  context.fillStyle = '#242b26'; context.font = 'bold 44px serif';
  context.fillText(L(life.name), 32, 363, 520);
  context.fillStyle = '#75796f'; context.font = '23px sans-serif';
  context.fillText(`${life.birthYear} · ${L(life.born.name)}`, 32, 409, 520);
  context.fillStyle = '#bc9349'; context.fillRect(32, 433, 58, 3);
  context.fillStyle = '#236b59'; context.font = '18px sans-serif';
  context.fillText(language === 'en' ? 'One in 1.4 Billion' : '14亿分之一', 104, 441, 450);
  return canvasFile(canvas);
}
async function generateSurvivalChart(life, dark = false, language = 'zh-CN') {
  const canvas = offscreen(640, 320), c = canvas.getContext('2d');
  const ink = dark ? '#b1b6a9' : '#888477', line = dark ? '#424c40' : '#e4dfd3';
  const green = dark ? '#9bceb7' : '#267b65', gold = dark ? '#d0ae66' : '#bc9349';
  c.fillStyle = dark ? '#2a332c' : '#fffdfa'; c.fillRect(0, 0, 640, 320);
  const x = age => 56 + age / 120 * 560, y = p => 28 + (1-p)*230;
  const probability = age => Math.exp(-Math.exp((age-life.profile.lifeExpectancy-4)/11));
  c.font = '19px sans-serif'; c.lineWidth = 1;
  for (const p of [0, .5, 1]) {
    c.strokeStyle = line; c.beginPath(); c.moveTo(x(0),y(p)); c.lineTo(x(120),y(p)); c.stroke();
    c.fillStyle = ink; c.textAlign = 'right'; c.fillText(`${p*100}%`,48,y(p)+6);
  }
  c.beginPath(); c.moveTo(x(0),y(0));
  for(let age=0;age<=120;age++)c.lineTo(x(age),y(probability(age)));
  c.lineTo(x(120),y(0)); c.closePath(); c.fillStyle = dark ? '#9bceb718' : '#267b6512'; c.fill();
  c.beginPath();
  for(let age=0;age<=120;age++){if(age===0)c.moveTo(x(age),y(probability(age)));else c.lineTo(x(age),y(probability(age)));}
  c.strokeStyle=green;c.lineWidth=3;c.stroke();
  const age=Math.max(0,Math.min(120,life.age));
  c.strokeStyle=gold;c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();c.moveTo(x(age),y(1));c.lineTo(x(age),y(0));c.stroke();c.setLineDash([]);
  c.fillStyle=gold;c.beginPath();c.arc(x(age),y(probability(age)),5,0,Math.PI*2);c.fill();
  c.textAlign='center';c.fillStyle=ink;
  for(const tick of [0,30,60,90,120])c.fillText(String(tick),x(tick),285);
  c.textAlign='right';c.fillStyle=gold;c.fillText(language==='en'?`Age ${life.age}`:`${language==='zh-TW'?'目前':'当前'} ${life.age}${language==='zh-TW'?'歲':'岁'}`,616,314);
  return canvasFile(canvas);
}
function cleanSceneFiles() {
  const manager = wx.getFileSystemManager();
  manager.readdir({ dirPath: wx.env.USER_DATA_PATH, success: result => {
    for (const name of result.files || []) if (/^life-scene-[0-9-]+\.png$/.test(name)) manager.unlink({ filePath: `${wx.env.USER_DATA_PATH}/${name}`, fail() {} });
  }, fail() {} });
}
function albumAuthorized() {
  return new Promise(resolve => wx.getSetting({success: result => resolve(!!result.authSetting['scope.writePhotosAlbum']), fail: () => resolve(false)}));
}
function requestAlbumAccess() {
  return new Promise((resolve, reject) => wx.authorize({scope:'scope.writePhotosAlbum',success:resolve,fail:reject}));
}
function memorialFileName(life, language) {
  const name = [...String(game.valueText(life.name, language) || '人生纪念')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, '-')].slice(0, 24).join('');
  const date = new Date(), pad = value => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${String(date.getMilliseconds()).padStart(3,'0')}`;
  const unique = `${++imageSequence}-${Math.random().toString(36).slice(2,6).padEnd(4,'0')}`;
  return `14亿分之一_${name}_${Number(life.birthYear)||0}-${Number(life.year)||0}_${stamp}_${unique}.png`;
}
async function saveImage(filePath, life, language = 'zh-CN') {
  const manager = life ? wx.getFileSystemManager() : null;
  const savedPath = life ? `${wx.env.USER_DATA_PATH}/${memorialFileName(life, language)}` : filePath;
  // Album APIs accept a path, not a fileName. Give every export a descriptive,
  // unique local basename, including when the same cached poster is saved again.
  if (manager) await new Promise((resolve, reject) => manager.copyFile({srcPath:filePath,destPath:savedPath,success:resolve,fail:reject}));
  try {
    return await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({
      filePath: savedPath,
      success: () => resolve(savedPath),
      fail: reject
    }));
  } finally {
    if (manager) manager.unlink({filePath:savedPath,fail(){}});
  }
}
const MUSIC_TRACKS = ['/assets/music.wav', '/assets/music-2.wav', '/assets/music-3.wav', '/assets/music-4.wav', '/assets/music-5.wav'];
let audio = null, musicWanted = false, suspended = false, lastTrack = -1;
function musicContext() {
  if (!audio) {
    audio = wx.createInnerAudioContext(); audio.src = '/assets/music.wav'; audio.loop = true; audio.volume = .32; audio.obeyMuteSwitch = false;
    audio.onError(error => { musicWanted = false; console.error('[music]', error); wx.showToast({ title: '音乐暂时无法播放', icon: 'none' }); });
  }
  return audio;
}
function toggleMusic() {
  musicWanted = !musicWanted;
  if (musicWanted) {
    const candidates = MUSIC_TRACKS.map((_,index)=>index).filter(index=>index!==lastTrack);
    lastTrack = candidates[Math.floor(Math.random()*candidates.length)];
    const player = musicContext(); player.src = MUSIC_TRACKS[lastTrack];
    if (!suspended) player.play();
  } else if (audio) audio.pause();
  return musicWanted;
}
function stopMusic() { musicWanted = false; if (audio) audio.stop(); }
function suspendMusic() { suspended = true; if (audio) audio.pause(); }
function resumeMusic() { suspended = false; if (musicWanted) musicContext().play(); }
module.exports = { drawScene, generateScene, generateSurvivalChart, captureMemorial, createBirthShare, albumAuthorized, requestAlbumAccess, saveImage, cleanSceneFiles, toggleMusic, stopMusic, suspendMusic, resumeMusic };
