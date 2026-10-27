// Scene shapes and palette adapted from the supplied preview.html canvas reference.
const PAL = {
  sky: '#aed9e8', skyLight: '#cfe8f0', cloud: '#fff', sun: '#f7ce55',
  grass: '#7fb069', grassDark: '#5e9150', path: '#d8c49a',
  wall: '#b08a5e', wallDark: '#8f6e48', floor: '#cbb99a', floorDark: '#b5a284',
  bedBlue: '#7fa8c9', bedWhite: '#edf2f5', skin: '#e8b48c', hair: '#4a3a2c',
  red: '#c05555', pink: '#e8a0a8', heart: '#d96c6c', city: '#9fb2c4',
  cityBlue: '#7e97ac', cityDark: '#62798c', roofRed: '#b85c50',
  roofTeal: '#4e8f8a', bunting: ['#d96c6c', '#f2c14e', '#7fb069', '#7fa8c9', '#b268b0'],
};
function makePainter(context, width, height) {
  const xScale = width / 64, yScale = height / 36;
  return {
    px(x, y, w, h, color) { context.fillStyle = color; context.fillRect(x * xScale, y * yScale, w * xScale, h * yScale); },
    person(x, y, color, skin = PAL.skin) {
      this.px(x, y - 3, 3, 3, skin); this.px(x + 1, y - 3.2, 1.2, 1, PAL.hair);
      this.px(x - .3, y, 3.6, 5, color); this.px(x, y + 5, 1, 2, PAL.hair); this.px(x + 2, y + 5, 1, 2, PAL.hair);
    },
  };
}
function bands(painter, rows) { rows.forEach(([y, h, color]) => painter.px(0, y, 64, h, color)); }
const scenes = {
  hospital(p) {
    bands(p, [[0, 27, PAL.bedWhite], [27, 5, '#e3ddd2'], [32, 4, PAL.floorDark]]);
    p.px(6, 4, 20, 14, '#c9e4ee'); p.px(6, 4, 20, 1.4, '#b8c6cc'); p.px(6, 16.6, 20, 1.4, '#b8c6cc');
    p.px(6, 4, 1.4, 14, '#b8c6cc'); p.px(24.6, 4, 1.4, 14, '#b8c6cc'); p.px(15.3, 4, 1.4, 14, '#b8c6cc');
    p.px(34, 20, 16, 1.6, '#6e8698'); p.px(34, 14, 16, 6, PAL.bedBlue); p.px(34, 13, 5, 4, '#f2f0ea');
    p.px(44, 15, 4, 4, PAL.skin); p.px(45, 14.4, 2.5, 1.4, PAL.hair); p.px(48, 12, 1.2, 8, '#6e8698');
    p.px(30, 6, 2, 2, PAL.heart); p.px(34, 7, 1.6, 1.6, PAL.pink); p.px(55, 10, .8, 12, '#6e8698'); p.px(53, 8, 3, 4, '#dde7ec');
  },
  home(p) {
    bands(p, [[0, 28, PAL.wall], [28, 3, PAL.wallDark], [31, 5, PAL.floor]]);
    p.px(8, 4, 12, 10, '#cfe4ec'); p.px(8, 4, 12, 1.2, PAL.wallDark); p.px(8, 12.8, 12, 1.2, PAL.wallDark);
    p.px(8, 4, 1.2, 10, PAL.wallDark); p.px(18.8, 4, 1.2, 10, PAL.wallDark);
    p.px(28, 6, 5, 4, '#d8d2c2'); p.px(29, 7, 3, 2, PAL.grass); p.px(52, 5, 5, 6, '#d8d2c2'); p.px(53, 6, 3, 4, PAL.sky);
    p.person(16, 23, PAL.red); p.person(22, 23, '#4e8f8a'); p.person(19, 24, '#e2a23b', '#f0c298');
    p.px(10, 32, 22, 2, '#d9b98c');
  },
  school(p) {
    bands(p, [[0, 27, PAL.sky], [27, 4, PAL.path], [31, 5, PAL.grass]]);
    p.px(50, 3, 6, 6, PAL.sun); p.px(12, 6, 7, 2, PAL.cloud);
    p.px(8, 10, 30, 17, '#e4c9a0'); p.px(8, 10, 30, 3, PAL.roofRed);
    for (const y of [15, 21]) for (const x of [11, 19, 27]) p.px(x, y, 4, 4, PAL.sky);
    p.px(21, 21, 4, 6, '#7a5c3e'); p.px(44, 8, .8, 19, PAL.city); p.px(44.8, 8, 4, 2.6, PAL.red);
    p.person(14, 28, PAL.bunting[1], '#f0c298'); p.person(19, 28, PAL.bunting[2]); p.person(38, 28, PAL.bunting[3]);
    p.px(54, 14, 8, 8, '#4e7d46'); p.px(56, 22, 1.6, 6, '#7a5c3e');
  },
  birthday(p) {
    bands(p, [[0, 28, '#a8875f'], [28, 3, PAL.wallDark], [31, 5, PAL.floor]]);
    for (let i = 0; i < 9; i++) p.px(3 + i * 6.4, 2 + Math.sin(i) * .8, 3, 2.4, PAL.bunting[i % 5]);
    p.px(48, 5, 3, 4, PAL.heart); p.px(52, 7, 2.6, 3.4, PAL.bunting[1]);
    p.px(8, 22, 16, 1.6, PAL.wallDark); p.px(9, 23.6, 1.2, 3, PAL.wallDark); p.px(22, 23.6, 1.2, 3, PAL.wallDark);
    p.px(12, 19.5, 8, 3, PAL.bedWhite); p.px(14, 18.5, 4, 1.2, PAL.pink); p.px(15.4, 16.8, .8, 1.6, PAL.bunting[1]);
    p.person(30, 24, '#4e8f8a'); p.person(36, 24, PAL.red); p.person(42, 24, PAL.bunting[2]);
  },
  city(p) {
    bands(p, [[0, 29, PAL.sky], [29, 3, '#e8e3d5'], [32, 4, PAL.grass]]);
    p.px(4, 3, 6, 6, PAL.sun); p.px(14, 5, 8, 2, PAL.cloud); p.px(17, 3.4, 5, 2, PAL.cloud);
    p.px(42, 6, 9, 2, PAL.cloud); p.px(45, 4.6, 5, 1.6, PAL.cloud);
    const blocks = [[4,18,6,11,PAL.cityBlue],[11,14,7,15,PAL.city],[19,20,5,9,PAL.cityDark],[25,12,8,17,PAL.cityBlue],[34,17,6,12,PAL.city],[41,19,7,10,PAL.cityDark],[49,13,8,16,PAL.cityBlue],[58,18,5,11,PAL.city]];
    blocks.forEach(([x,y,w,h,color],i) => { p.px(x,y,w,h,color); for(let wy=y+2;wy<y+h-1;wy+=3)for(let wx=x+1;wx<x+w-1;wx+=2.4)p.px(wx,wy,1,1.4,i%2?'#cfe4ec':'#e8f0f4'); });
    p.person(30, 28, PAL.red);
  },
  field(p) {
    bands(p, [[0, 23, '#cfe8f0'], [23, 10, PAL.grass], [33, 3, PAL.grassDark]]);
    p.px(8, 4, 7, 7, PAL.sun); p.px(30, 5, 8, 2.2, PAL.cloud); p.px(33, 3.4, 5, 2, PAL.cloud);
    p.px(12, 18, 8, 5, '#e0c9a0'); p.px(11, 15.5, 10, 2.6, PAL.roofTeal);
    p.px(26, 19, 6, 4, '#e0c9a0'); p.px(25, 17, 8, 2.2, PAL.roofRed);
    for(let i=0;i<5;i++)p.px(6,25+i*1.8,52,.9,PAL.grassDark);
    p.px(50,18,7,7,'#4e7d46');p.px(52.5,25,1.8,6,'#7a5c3e');
  },
  office(p) {
    bands(p, [[0, 27, '#dce8e8'], [27, 2, '#927a60'], [29, 7, '#c8c4b6']]);
    p.px(6, 4, 49, 16, '#93c7d5');
    for (let x = 9; x < 54; x += 9) { p.px(x, 12, 5, 8, '#abc5c4'); p.px(x + 2, 7, 2, 5, '#abc5c4'); }
    for (let x = 10; x < 55; x += 16) { p.px(x, 24, 11, 1.5, '#765f4c'); p.px(x + 1, 25, 1, 5, '#765f4c'); p.px(x + 9, 25, 1, 5, '#765f4c'); p.px(x + 3, 18, 6, 5, '#62798c'); p.person(x + 1, 23, '#4e8f8a'); }
  },
  park(p) {
    bands(p, [[0, 22, '#b9dbe3'], [22, 7, '#8fb98b'], [29, 3, '#d8c49a'], [32, 4, '#79a36e']]);
    p.px(49, 4, 6, 6, PAL.sun); p.px(13, 5, 9, 2, PAL.cloud);
    for (const x of [7, 52]) { p.px(x, 12, 8, 11, '#5c956e'); p.px(x + 2, 21, 2, 7, '#7a5c3e'); }
    p.px(25, 23, 16, 1.5, '#8f6e48'); p.px(27, 24, 1, 5, '#8f6e48'); p.px(38, 24, 1, 5, '#8f6e48');
    p.person(30, 22, '#c05555'); p.person(37, 22, '#4e8f8a');
  },
};
const momentWords = event => Object.values(event?.text || {}).join(' ').toLowerCase();
const hashText = text => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.codePointAt(0), 16777619) >>> 0; return value; };
export function describeHighlight(event, life) {
  const words = momentWords(event);
  const type = event?.type || '';
  let scene = life?.urban ? 'city' : 'field', motif = 'memory';
  if (type === 'birth') { scene = 'hospital'; motif = 'baby'; }
  else if (/地震|洪水|台风|颱風|earthquake|flood|typhoon/.test(words)) { motif = 'storm'; }
  else if (/病|诊|診|医生|醫生|医院|醫院|健康|treatment|hospital|doctor|illness|health/.test(words) || ['health', 'death'].includes(type)) { scene = 'hospital'; motif = 'health'; }
  else if (/生日|birthday/.test(words)) { scene = 'birthday'; motif = 'cake'; }
  else if (/拍照|照片|摄影|攝影|photo|camera/.test(words)) { scene = 'home'; motif = 'camera'; }
  else if (/画画|繪畫|绘画|painting|drawing/.test(words)) { scene = 'home'; motif = 'paint'; }
  else if (/毕业|畢業|考试|考試|学校|學校|大学|大學|学位|學位|入学|入學|graduat|exam|school|college|university|degree/.test(words) || type === 'education') { scene = 'school'; motif = /毕业|畢業|学位|學位|graduat|degree/.test(words) ? 'graduate' : 'book'; }
  else if (/结婚|結婚|婚礼|婚禮|married|wedding/.test(words)) { scene = 'home'; motif = 'wedding'; }
  else if (/出生了|孩子|小生命|child|baby|grandparent/.test(words) || type === 'family') { scene = 'home'; motif = 'baby'; }
  else if (/交往|伴侣|伴侶|恋|戀|love|relationship|partner/.test(words) || type === 'love') { scene = 'home'; motif = 'heart'; }
  else if (/汽车|汽車|车辆|車輛|car|vehicle/.test(words)) { scene = 'city'; motif = 'car'; }
  else if (/买房|買房|住房|房产|房產|新家|house|housing|home purchase/.test(words)) { scene = 'home'; motif = 'house'; }
  else if (/投资|投資|存款|股票|基金|债券|債券|现金|現金|investment|stock|fund|bond|cash/.test(words) || ['asset', 'money'].includes(type)) { scene = 'office'; motif = 'coin'; }
  else if (/搬到|搬家|迁|遷|旅|move|relocat|travel/.test(words) || type === 'move') { motif = 'suitcase'; }
  else if (/工作|职业|職業|公务|公務|企业|企業|退休|job|work|career|retir/.test(words) || ['career', 'work'].includes(type)) { scene = 'office'; motif = 'work'; }
  else if (/公园|公園|散步|朋友|邻居|鄰居|运动|運動|读书|讀書|park|walk|friend|neighbor|sport|read/.test(words) || type === 'warm') { scene = 'park'; motif = 'sun'; }
  const sequence = Number(event?.id?.match(/-(\d+)$/)?.[1]);
  return { scene, motif, variant: Number.isSafeInteger(sequence) ? sequence : hashText(`${event?.id || ''}|${words}`) };
}
function drawMotif(p, motif) {
  const x = 52, y = 15;
  if (motif === 'baby') { p.px(x, y + 4, 8, 5, PAL.bedWhite); p.px(x + 2, y + 2, 4, 4, PAL.skin); p.px(x + 1, y + 8, 6, 2, PAL.pink); }
  else if (motif === 'heart' || motif === 'wedding') { p.px(x + 1, y + 2, 2, 2, PAL.heart); p.px(x + 5, y + 2, 2, 2, PAL.heart); p.px(x + 1, y + 4, 6, 2, PAL.heart); p.px(x + 2, y + 6, 4, 2, PAL.heart); p.px(x + 3, y + 8, 2, 2, PAL.heart); if (motif === 'wedding') p.px(x + 1, y + 11, 6, 1, PAL.sun); }
  else if (motif === 'book' || motif === 'graduate') { p.px(x, y + 4, 8, 7, '#f7eee0'); p.px(x + 3.5, y + 4, 1, 7, PAL.cityDark); p.px(x + 1, y + 5, 2, 1, PAL.cityBlue); p.px(x + 5, y + 5, 2, 1, PAL.cityBlue); if (motif === 'graduate') { p.px(x - 1, y + 1, 10, 2, PAL.hair); p.px(x + 2, y, 4, 1, PAL.hair); } }
  else if (motif === 'car') { p.px(x, y + 5, 9, 4, PAL.roofTeal); p.px(x + 2, y + 3, 5, 2, PAL.sky); p.px(x + 1, y + 9, 2, 2, PAL.hair); p.px(x + 6, y + 9, 2, 2, PAL.hair); }
  else if (motif === 'house') { p.px(x + 1, y + 5, 8, 7, PAL.bedWhite); p.px(x, y + 3, 10, 2, PAL.roofRed); p.px(x + 4, y + 8, 2, 4, PAL.wallDark); }
  else if (motif === 'coin') { p.px(x + 1, y + 2, 7, 9, PAL.sun); p.px(x + 3, y + 4, 3, 5, '#a8875f'); }
  else if (motif === 'health') { p.px(x + 3, y + 2, 3, 10, PAL.red); p.px(x, y + 5, 9, 3, PAL.red); }
  else if (motif === 'suitcase' || motif === 'work') { p.px(x + 1, y + 5, 8, 7, PAL.wallDark); p.px(x + 3, y + 3, 4, 2, PAL.wallDark); p.px(x + 2, y + 7, 6, 1, PAL.floor); }
  else if (motif === 'storm') { p.px(x, y + 1, 8, 3, PAL.cityDark); p.px(x + 2, y + 5, 2, 4, PAL.sun); p.px(x + 4, y + 7, 2, 4, PAL.sun); }
  else if (motif === 'cake') { p.px(x + 1, y + 6, 8, 5, PAL.bedWhite); p.px(x + 2, y + 4, 6, 2, PAL.pink); p.px(x + 4, y + 1, 1, 3, PAL.sun); }
  else if (motif === 'camera') { p.px(x, y + 4, 10, 7, PAL.cityDark); p.px(x + 2, y + 2, 4, 2, PAL.cityDark); p.px(x + 4, y + 6, 3, 3, PAL.sky); }
  else if (motif === 'paint') { p.px(x, y + 2, 9, 9, PAL.bedWhite); p.px(x + 2, y + 4, 2, 2, PAL.red); p.px(x + 5, y + 4, 2, 2, PAL.sun); p.px(x + 3, y + 7, 2, 2, PAL.roofTeal); }
  else { p.px(x + 2, y + 2, 5, 5, PAL.sun); }
}
export function drawHighlightScene(canvas, event, life) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  const p = makePainter(context, canvas.width, canvas.height);
  const { scene, motif, variant } = describeHighlight(event, life);
  scenes[scene](p);
  drawMotif(p, motif);
  // The six colored date tiles encode each record's sequence (up to the save's
  // 3,000-record limit), so repeated descriptions still have distinct art.
  const colors = ['#d96c6c', '#f2c14e', '#7fb069', '#7fa8c9'];
  for (let tile = 0; tile < 6; tile++) p.px(2 + tile * 2, 2, 1.6, 1.6, colors[Math.floor(variant / (4 ** tile)) % 4]);
  p.person(39 + variant % 3 * 3, 24, colors[Math.floor(variant / 7) % 4]);
}
