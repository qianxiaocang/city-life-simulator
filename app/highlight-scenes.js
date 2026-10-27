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
};
export function drawHighlightScene(canvas, event, life) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  const p = makePainter(context, canvas.width, canvas.height);
  const type = event?.type;
  const scene = type === 'birth' ? 'hospital' : type === 'education' ? 'school' : type === 'family' || type === 'love' ? 'home' : type === 'decision' ? 'birthday' : life?.urban ? 'city' : 'field';
  scenes[scene](p);
}
