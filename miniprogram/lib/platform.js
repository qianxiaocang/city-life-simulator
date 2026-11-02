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
  const options={x:0,y:0,width:canvas.width,height:canvas.height,destWidth:canvas.width,destHeight:canvas.height,fileType:'png'};
  if(typeof canvas.toTempFilePathSync==='function') {
    try { const path=canvas.toTempFilePathSync(options); if(!path)throw new Error('纪念图片导出为空'); return Promise.resolve(path); }
    catch(error){return Promise.reject(error);}
  }
  if(typeof canvas.toTempFilePath==='function')return new Promise((resolve,reject)=>canvas.toTempFilePath({...options,success:r=>r.tempFilePath?resolve(r.tempFilePath):reject(new Error('纪念图片导出为空')),fail:reject}));
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
  // Use an exportable Mini Game Canvas for the final poster. OffscreenCanvas
  // is suitable for drawing but does not expose the Mini Game file-export API.
  const canvas = typeof wx.createCanvas==='function' ? wx.createCanvas() : offscreen(width,height);
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');
  context.fillStyle = birth ? '#f3f0e8' : '#101916'; context.fillRect(0, 0, width, height);
  const moments = game.selectLifeMoments(life);
  const event = birth ? (life.log || []).find(item => item.type === 'birth') : moments.find(item => item.type !== 'birth') || (life.log || [])[life.log.length - 1];
  const scene = typeof wx.createCanvas==='function' ? wx.createCanvas() : offscreen(640,280);
  scene.width=640;scene.height=280;
  game.drawHighlightScene(scene, event || { type: 'warm', text: { zhCN: '在熟悉的地方散步' } }, life);
  context.drawImage(scene, 48, 60, 654, 286);
  context.textAlign = 'center'; context.fillStyle = birth ? '#292b27' : '#f3efe2';
  context.font = 'bold 62px serif'; context.fillText(L(life.name), width / 2, 459);
  context.font = '28px monospace'; context.fillStyle = birth ? '#777a70' : '#adb9ad';
  context.fillText(birth ? `${life.birthYear} · ${L(life.born.name)}` : `${life.birthYear} — ${life.year} · ${life.age}${isEnglish ? ' years' : language === 'zh-TW' ? '歲' : '岁'}`, width / 2, 523);
  context.textAlign = 'left'; context.font = '28px sans-serif';
  wrapText(context, text, 64, 604, textWidth, lineHeight);
  context.fillStyle = birth ? '#297c65' : '#93c8b1'; context.font = '26px serif'; context.textAlign = 'center';
  context.fillText(isEnglish ? 'One in 1.3 Billion' : '13亿分之一', width / 2, height - 90);
  context.font = '20px sans-serif'; context.fillStyle = birth ? '#777a70' : '#7d9083';
  context.fillText(isEnglish ? 'An ordinary, irreplaceable life' : language === 'zh-TW' ? '平凡，又不可替代的一生' : '平凡，又不可替代的一生', width / 2, height - 50);
  return canvasFile(canvas);
}
async function createBirthShare(life, language = 'zh-CN', theme = 'dark') {
  const L = value => game.valueText(value, language);
  const canvas = typeof wx.createCanvas==='function' ? wx.createCanvas() : offscreen(600,480);
  canvas.width=600;canvas.height=480;
  const context=canvas.getContext('2d');
  const birth = (life.log || []).find(event => event.type === 'birth');
  const place = game.locationLabel(life.born, language);
  const story = game.birthPlaceNarrative(L(birth?.text), life.born, language);
  const title = language === 'en' ? 'BIRTH REGISTRATION' : language === 'zh-TW' ? '出生登記' : '出生登记';
  const sameMoment = language === 'en' ? 'BORN AT THE SAME MOMENT' : language === 'zh-TW' ? '同一刻出生的人' : '同一刻出生的人';
  const drawClamped = (text, x, y, width, lineHeight, maxLines) => {
    let remaining = String(text || ''), lines = [];
    while (remaining && lines.length < maxLines) {
      let line = '';
      for (const char of Array.from(remaining)) {
        if (context.measureText(line + char).width > width && line) break;
        line += char;
      }
      remaining = remaining.slice(line.length);
      if (lines.length === maxLines - 1 && remaining) {
        while (line && context.measureText(line + '…').width > width) line = line.slice(0, -1);
        line += '…';
      }
      lines.push(line);
    }
    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  };
  const dark=theme==='dark';
  context.fillStyle = dark ? '#202823' : '#f3f0e8'; context.fillRect(0, 0, 600, 480);
  context.fillStyle = dark ? '#344b40' : '#e3ece2'; context.fillRect(18,18,564,444);
  context.fillStyle = dark ? '#a1ceb9' : '#267b65'; context.font = 'bold 20px sans-serif'; context.textAlign = 'left';
  context.fillText(title, 30, 45);
  context.fillStyle = dark ? '#f4f0e6' : '#292c28'; context.font = 'bold 48px serif';
  context.fillText(L(life.name), 30, 105, 390);
  context.fillStyle = dark ? '#bac0b5' : '#656c60'; context.font = '20px sans-serif';
  drawClamped(`${game.t(life.sex, language)} · ${place} · ${game.t(`class${life.classRank}`, language)}`, 30, 140, 397, 27, 2);
  context.fillStyle = dark ? '#f0eee4' : '#292c28'; context.font = '22px serif';
  drawClamped(story, 30, 199, 538, 31, 2);
  context.fillStyle = '#465146'; context.fillRect(30, 259, 540, 1);
  const facts = [
    [language === 'en' ? 'GENDER' : '性别', game.t(life.sex, language)],
    [language === 'en' ? 'BIRTHPLACE' : language === 'zh-TW' ? '出生地' : '出生地', place],
    [language === 'en' ? 'BIRTH YEAR' : '出生年份', String(life.birthYear)],
    [language === 'en' ? 'FAMILY' : '出身家庭', game.t(`class${life.classRank}`, language)]
  ];
  facts.forEach(([label, value], index) => {
    const fx = 30 + (index % 2) * 275, fy = 289 + Math.floor(index / 2) * 68;
    context.fillStyle = dark ? '#aeb9ad' : '#656c60'; context.font = '16px sans-serif'; context.fillText(label, fx, fy);
    context.fillStyle = dark ? '#f0eee4' : '#292c28'; context.font = `bold ${index === 1 ? 18 : 20}px sans-serif`;
    drawClamped(value, fx, fy + 27, 256, 21, index === 1 ? 2 : 1);
  });
  context.fillStyle = dark ? '#a1ceb9' : '#267b65'; context.font = 'bold 18px sans-serif'; context.fillText(sameMoment, 30, 428);
  const companions = (life.companions || []).slice(0, 3).map(person => L(person.name));
  context.fillStyle = dark ? '#e8e8de' : '#292c28'; context.font = '19px sans-serif';
  drawClamped(companions.join('   ·   '), 30, 459, 415, 23, 1);
  context.fillStyle = dark ? '#a1ceb9' : '#267b65'; context.font = 'bold 16px serif'; context.textAlign = 'right';
  context.fillText(language === 'en' ? 'One in 1.3 Billion' : '13亿分之一', 570, 457);
  // Mini Game sharing expects an exported canvas image, rather than a manually written wxfile URL.
  if(typeof canvas.toTempFilePathSync==='function')return canvas.toTempFilePathSync({x:0,y:0,width:600,height:480,destWidth:600,destHeight:480,fileType:'png'});
  if(typeof canvas.toTempFilePath==='function')return new Promise((resolve,reject)=>canvas.toTempFilePath({fileType:'png',success:r=>resolve(r.tempFilePath),fail:reject}));
  return canvasFile(canvas);
}
async function createLifeShare(life,language='zh-CN',theme='dark') {
  const L=value=>game.valueText(value,language),dark=theme==='dark';
  const canvas=typeof wx.createCanvas==='function'?wx.createCanvas():offscreen(600,480);canvas.width=600;canvas.height=480;
  const c=canvas.getContext('2d'),ink=dark?'#edece3':'#292c28',muted=dark?'#b1b6a9':'#77796d',green=dark?'#9bceb7':'#267b65';
  c.fillStyle=dark?'#202823':'#f4f1e9';c.fillRect(0,0,600,480);
  const scene=typeof wx.createCanvas==='function'?wx.createCanvas():offscreen(640,280);scene.width=640;scene.height=280;
  const event=game.selectLifeMoments(life).find(row=>row.type!=='birth')||life.log[0];game.drawHighlightScene(scene,event,life);c.drawImage(scene,0,0,600,162);
  const line=(text,x,y,width,size,color,weight='normal')=>{c.font=weight+' '+size+'px sans-serif';c.fillStyle=color;let value=String(text);while(value&&c.measureText(value).width>width)value=value.slice(0,-1);if(value!==String(text))value=value.slice(0,-1)+'…';c.fillText(value,x,y);};
  line(L(life.name),26,212,548,36,ink,'bold');
  line(life.birthYear+'—'+life.year+' · '+life.age+(language==='en'?' years':'岁'),26,246,548,20,muted);
  line(game.locationLabel(life.born,language),26,275,548,19,muted);
  const summary=game.summarize(life);line(L(summary.job)+' · '+game.educationText(life.education,language),26,311,548,21,ink,'bold');
  c.fillStyle=dark?'#344b40':'#e3ece2';c.fillRect(22,333,556,103);
  line(language==='en'?'Words to remember':'人生寄语',36,359,528,17,green,'bold');
  c.font='20px serif';c.fillStyle=ink;
  const note=game.memorialReview(life,language).text;let remaining=note;
  for(let i=0;i<2&&remaining;i++){let row='';for(const ch of remaining){if(c.measureText(row+ch).width>528)break;row+=ch;}remaining=remaining.slice(row.length);if(i===1&&remaining)row=row.slice(0,-1)+'…';c.fillText(row,36,389+i*27);}
  line(language==='en'?'One in 1.3 Billion · View this life':'13亿分之一 · 打开看看这一生',26,465,548,17,green);
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
async function requestAlbumAccess() {
  if (typeof wx.requirePrivacyAuthorize === 'function') await new Promise((resolve,reject)=>wx.requirePrivacyAuthorize({success:resolve,fail:reject}));
  const settings = await new Promise(resolve=>wx.getSetting({success:r=>resolve(r.authSetting||{}),fail:()=>resolve({})}));
  if(settings['scope.writePhotosAlbum'])return;
  if(settings['scope.writePhotosAlbum']!==false){
    try { await new Promise((resolve,reject)=>wx.authorize({scope:'scope.writePhotosAlbum',success:resolve,fail:reject})); return; }
    catch(error){ if(!/auth deny|authorize|permission|scope/i.test(error.errMsg||''))throw error; }
  }
  const consent=await new Promise(resolve=>wx.showModal({title:'允许保存纪念照片',content:'保存照片需要相册权限。请点击去授权，并开启“保存到相册”，授权后将自动继续保存。',confirmText:'去授权',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));
  if(!consent)throw {cancelled:true};
  const result=await new Promise((resolve,reject)=>wx.openSetting({success:resolve,fail:reject}));
  if(!result.authSetting?.['scope.writePhotosAlbum'])throw {cancelled:true};
}
function memorialFileName(life, language) {
  const name = [...String(game.valueText(life.name, language) || '人生纪念')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, '-')].slice(0, 24).join('');
  const date = new Date(), pad = value => String(value).padStart(2, '0');
  const stamp = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${String(date.getMilliseconds()).padStart(3,'0')}`;
  const unique = `${++imageSequence}-${Math.random().toString(36).slice(2,6).padEnd(4,'0')}`;
  return `13亿分之一_${name}_${Number(life.birthYear)||0}-${Number(life.year)||0}_${stamp}_${unique}.png`;
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
module.exports = { createLifeShare, drawScene, generateScene, generateSurvivalChart, captureMemorial, createBirthShare, albumAuthorized, requestAlbumAccess, saveImage, cleanSceneFiles, toggleMusic, stopMusic, suspendMusic, resumeMusic };
