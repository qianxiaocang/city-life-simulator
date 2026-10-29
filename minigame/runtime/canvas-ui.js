// Native WeChat Mini Game presentation. All coordinates are logical screen px;
// the engine and save format remain shared with the mini program.
const platform = require('../lib/platform');

class CanvasUI {
  constructor(canvas, page) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.page = page;
    this.scroll = 0;
    this.modalScroll = 0;
    this.homeOffset = 0;
    this.hits = [];
    this.modalHits = [];
    this.images = new Map();
    this.resize();
  }
  resize() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.width = Number(info.windowWidth) || 390;
    this.height = Number(info.windowHeight) || 844;
    this.dpr = Math.min(3, Number(info.pixelRatio) || 1);
    this.status = Math.max(0, Number(info.statusBarHeight) || 20);
    this.safeBottom = Math.max(0, this.height - (Number(info.safeArea?.bottom) || this.height));
    this.footerHeight = 150 + this.safeBottom;
    this.navHeight = Math.max(64, this.status + 48);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.invalidate();
  }
  onData(patch) {
    if (patch.view && patch.view !== this.lastView) {
      this.scroll = 0; this.homeOffset = 0; this.lastView = patch.view;
    }
    if ('modal' in patch && patch.modal !== this.lastModal) {
      this.modalScroll = 0; this.lastModal = patch.modal;
    }
    this.invalidate();
  }
  invalidate() {
    if (this.frame) return;
    const request = this.canvas.requestAnimationFrame?.bind(this.canvas) || globalThis.requestAnimationFrame || (fn => setTimeout(fn, 16));
    this.frame = request(() => { this.frame = 0; this.draw(); });
  }
  palette() {
    const dark = this.page.data.theme === 'dark' || this.page.data.view === 'ending';
    return dark ? { bg:'#1e2823',paper:'#2a342d',paper2:'#34443a',ink:'#f7f2e7',muted:'#acb9ad',line:'#475349',green:'#9bcdb9',greenDark:'#244c40',gold:'#d6b36f',button:'#eae6d9',buttonInk:'#1e2823',nav:'#1d2621',shade:'#121a16' }
      : { bg:'#f3f0e8',paper:'#fffdfa',paper2:'#e9f2e9',ink:'#292d29',muted:'#837f73',line:'#e5dfd2',green:'#227a65',greenDark:'#d9e9df',gold:'#bc9145',button:'#237b65',buttonInk:'#ffffff',nav:'#f3f0e8',shade:'#18231e' };
  }
  box(x,y,w,h,fill,r=0,stroke=null) {
    const c=this.ctx; c.beginPath();
    r=Math.max(0,Math.min(r,w/2,h/2));
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
  }
  text(value,x,y,size=16,color=this.p.ink,weight='normal',maxWidth) {
    const c=this.ctx;c.fillStyle=color;c.font=`${weight} ${size}px ${/\p{Script=Han}/u.test(String(value))?'sans-serif':'sans-serif'}`;c.textBaseline='top';c.textAlign='left';
    if(maxWidth)c.fillText(String(value??''),x,y,maxWidth);else c.fillText(String(value??''),x,y);
  }
  lines(value,width,size=16,max=0) {
    const c=this.ctx;c.font=`${size}px sans-serif`;
    const out=[];let line='';
    for(const part of String(value??'').split('\n')){
      for(const char of Array.from(part)){
        if(c.measureText(line+char).width>width&&line){out.push(line);line='';if(max&&out.length>=max)return out;}
        line+=char;
      }
      out.push(line);line='';if(max&&out.length>=max)return out;
    }
    if(out.length===0)out.push('');
    return out;
  }
  paragraph(value,x,y,width,size=16,lineHeight=25,color=this.p.ink,max=0) {
    const rows=this.lines(value,width,size,max);
    rows.forEach((row,i)=>this.text(row,x,y+i*lineHeight,size,color));
    return rows.length*lineHeight;
  }
  line(x,y,w){this.box(x,y,w,1,this.p.line);}
  hit(x,y,w,h,action,value,mode='content') {
    const actualY=mode==='content'?y+this.navHeight-this.scroll:mode==='modal-content'?y-this.modalScroll:y;
    const target=mode==='modal'||mode==='modal-content'?this.modalHits:this.hits;
    if(mode==='content'&&(actualY+h<this.navHeight||actualY>this.viewportBottom))return;
    target.push({x,y:actualY,w,h,action,value});
  }
  button(label,x,y,w,h,action,value,style='primary',mode='content') {
    const p=this.p,fill=style==='primary'?p.button:style==='soft'?p.paper2:style==='selected'?p.greenDark:p.paper;
    this.box(x,y,w,h,fill,12,style==='outline'?p.line:null);
    const size=Math.min(17,Math.max(12,w/Math.max(4,Array.from(String(label)).length)*1.6));
    const c=this.ctx;c.font=`bold ${size}px sans-serif`;const tw=c.measureText(String(label)).width;
    this.text(label,x+(w-tw)/2,y+(h-size)/2-1,size,style==='primary'?p.buttonInk:style==='selected'?p.green:p.ink,'bold');
    this.hit(x,y,w,h,action,value,mode);
  }
  image(path,x,y,w,h) {
    if(!path){this.placeholder(x,y,w,h);return;}
    let img=this.images.get(path);
    if(!this.images.has(path)){
      try{img=wx.createImage();this.images.set(path,img);img.onload=()=>this.invalidate();img.onerror=()=>{this.images.set(path,null);this.invalidate();};img.src=path;}
      catch(error){this.images.set(path,null);}
    }
    if(!img||!img.width){this.placeholder(x,y,w,h);return;}
    const ratio=Math.max(w/img.width,h/img.height),sw=w/ratio,sh=h/ratio;
    try{this.ctx.drawImage(img,(img.width-sw)/2,(img.height-sh)/2,sw,sh,x,y,w,h);}catch(error){this.placeholder(x,y,w,h);}
  }
  placeholder(x,y,w,h){
    this.box(x,y,w,h,'#b7d3d0',10);
    const unit=Math.max(3,Math.round(w/70));
    this.box(x,y+h*.63,w,h*.37,'#b7a283');
    for(const [dx,dy,dw,dh,color] of [[.07,.38,.20,.28,'#a3bcb4'],[.28,.27,.22,.39,'#d1c8ad'],[.53,.34,.19,.32,'#a8b3aa'],[.76,.30,.18,.36,'#c6bcaa']])this.box(x+w*dx,y+h*dy,w*dw,h*dh,color);
    for(let i=0;i<4;i++)this.box(x+w*(.31+i*.10),y+h*.68,w*.045,h*.15,['#b86d68','#d8aa55','#5f9991','#829b75'][i]);
    this.box(x+w*.84,y+h*.14,unit*4,unit*4,'#f5d76b');
  }
  draw() {
    if(!this.page.data.ui)return;
    const d=this.page.data,p=this.p=this.palette(),c=this.ctx,W=this.width,H=this.height;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.clearRect(0,0,W,H);this.box(0,0,W,H,p.bg);
    this.hits=[];this.modalHits=[];if(d.view!=='home')this.homeCarousel=null;
    const lifeView=d.view==='life';this.viewportBottom=lifeView?H-this.footerHeight:H-this.safeBottom;
    this.box(0,0,W,this.navHeight,p.nav);
    this.line(0,this.navHeight-1,W);
    if(d.view!=='ending'){
      if(d.view!=='home'){this.text('‹',18,this.status+6,34,p.ink);this.hit(0,this.status,58,46,'back',null,'fixed');}
      const label=d.view==='home'?d.ui.brand:d.view==='life'?d.ui.living:d.view==='archive'?d.ui.archive:d.view==='certificate'?d.ui.certificate:d.ui.report;
      c.font='bold 20px sans-serif';const tw=c.measureText(label).width;this.text(label,(W-tw)/2,this.status+12,20,p.ink,'bold');
    }
    c.save();c.beginPath();c.rect(0,this.navHeight,W,this.viewportBottom-this.navHeight);c.clip();c.translate(0,this.navHeight-this.scroll);
    let end=0;
    if(d.view==='home')end=this.home();
    else if(d.view==='certificate')end=this.certificate();
    else if(d.view==='life')end=this.life();
    else if(d.view==='archive')end=this.archive();
    else if(d.view==='report')end=this.report();
    else if(d.view==='ending')end=this.ending();
    c.restore();
    this.contentHeight=end+24;
    if(lifeView)this.footer();
    if(d.toast){this.box(12,this.navHeight+8,W-24,40,p.paper,10,p.line);this.text(d.toast,22,this.navHeight+18,Math.min(15,(W-48)/Math.max(1,Array.from(d.toast).length)),p.ink,'bold',W-44);}
    if(d.view==='home'){
      this.box(W-62,this.navHeight+14,44,44,d.musicPlaying?'#288a70':'#65756d',22);
      this.text(d.musicPlaying?'♫':'♪',W-49,this.navHeight+20,28,'#fff');
      this.hit(W-62,this.navHeight+14,44,44,'music',null,'fixed');
    }
    if(this.picker||d.modal)this.modal();
  }
  home() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=76;
    this.button(`${d.languageLabels[d.languageIndex]?.label||'简体中文'}  ▾`,x,17,153,39,'picker','language','outline');
    this.button(d.theme==='dark'?'☀':'◐',x+161,17,42,39,'theme',null,'outline');
    this.text(d.ui.eyebrow,x,y,14,p.green,'bold');y+=37;
    this.text(d.ui.brand,x,y,44,p.ink,'bold');y+=61;
    y+=this.paragraph(d.ui.heroText,x,y,w,16,25,p.ink,3)+18;
    this.image(d.homeCover,x,y,w,Math.round(w*.42));y+=Math.round(w*.42)+18;
    if(d.resume){this.box(x,y,w,66,p.paper2,14);this.text(`${d.resume.name} · ${d.resume.age}`,x+14,y+12,17,p.ink,'bold');this.text(d.resume.place,x+14,y+37,13,p.muted);this.button(d.ui.resume,W-136,y+14,106,38,'resume',null,'primary');y+=82;}
    this.box(x,y,w,d.advancedOpen?390:d.settings.world==='past'?255:205,p.paper,18,p.line);
    this.text(d.ui.pastPresent,x+16,y+17,21,p.ink,'bold');
    this.text(d.ui.locationCount,W-142,y+23,12,p.muted);
    const tabY=y+53,tabW=(w-32)/2;
    this.button(d.ui.past,x+12,tabY,tabW-3,43,'world','past',d.settings.world==='past'?'selected':'outline');
    this.button(d.ui.now,x+15+tabW,tabY,tabW-3,43,'world','now',d.settings.world==='now'?'selected':'outline');
    const hintY=y+105;this.paragraph(d.settings.world==='past'?d.ui.pastHint:d.ui.nowHint,x+16,hintY,w-32,13,20,p.muted,2);
    let row=hintY+47;
    if(d.settings.world==='past'){
      this.text(d.ui.birthYear,x+16,row+9,15,p.muted);this.button(String(d.settings.birthYear)+' ▾',W-153,row,121,39,'picker','birthYear','outline');row+=54;
    }
    this.button(`${d.ui.birthSettings} ${d.advancedOpen?'⌃':'⌄'}`,x+12,row,w-24,39,'toggle-advanced',null,'outline');row+=48;
    if(d.advancedOpen){
      for(const [key,label,opts,index] of [['scope',d.ui.scope,d.regions,d.regionIndex],['province',d.ui.province,d.provinces,d.provinceIndex]]){
        this.text(label,x+16,row+8,14,p.muted);this.button(`${opts[index]?.label||'全部'} ▾`,W-181,row,149,36,'picker',key,'outline');row+=43;
      }
      this.text(d.ui.pace,x+16,row+10,14,p.muted);
      const pw=60;[30,60,90].forEach((n,i)=>this.button(`${n}`,W-216+i*65,row,60,36,'pace',n,d.settings.pace===n?'selected':'outline'));
    }
    y+=d.advancedOpen?390:d.settings.world==='past'?255:205;
    this.button(d.ui.born,x,y+15,w,51,'born',null,'primary');y+=82;
    this.text(d.ui.rememberedLives,x,y,20,p.ink,'bold');
    this.text(`${d.ui.viewAll} ↗`,W-111,y+4,14,p.green,'bold');this.hit(W-125,y-3,109,34,'archive');y+=37;
    if(!d.memories.length){this.box(x,y,w,77,p.paper,12,p.line);this.text(d.ui.memorialEmpty,x+16,y+28,14,p.muted);y+=93;}
    else{
      const cw=(w-10)/2,clipY=y;this.ctx.save();this.ctx.beginPath();this.ctx.rect(x,y,w,164);this.ctx.clip();
      d.memories.slice(0,8).forEach((item,i)=>{const left=x+i*(cw+10)-this.homeOffset;this.box(left,y,cw,151,p.paper,13,p.line);this.image(item.cover,left,y,cw,82);this.text(item.name,left+9,y+91,15,p.ink,'bold',cw-18);this.text(item.date,left+9,y+118,11,p.muted,'normal',cw-18);if(left+cw>x&&left<x+w)this.hit(left,y,cw,151,'review',item.id);});
      this.ctx.restore();this.homeCarousel={x,y:clipY,w,cw,count:Math.min(8,d.memories.length)};y+=170;
    }
    return y;
  }
  certificate() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=16,w=W-32;let y=18;
    if(!P)return y;
    this.box(x,y,w,588,p.paper,18,p.line);
    this.image(P.cover,x,y,w,158);y+=176;
    this.text(d.ui.certificate,x+16,y,14,p.green,'bold');y+=28;
    this.text(P.name,x+16,y,30,p.ink,'bold');y+=42;
    this.paragraph(P.meta,x+16,y,w-32,14,21,p.muted,2);y+=49;
    y+=this.paragraph(P.birthText,x+16,y,w-32,15,23,p.ink,4)+8;
    const facts=P.facts.slice(0,4);facts.forEach((f,i)=>{const fx=x+16+(i%2)*(w-32)/2,fy=y+Math.floor(i/2)*52;this.text(f.label,fx,fy,12,p.muted);this.text(f.value,fx,fy+18,15,p.ink,'bold',(w-42)/2);});y+=108;
    this.text(d.ui.sameMoment,x+16,y,18,p.ink,'bold');y+=32;
    P.companions.slice(0,4).forEach((person,i)=>{const fx=x+16+(i%2)*(w-32)/2,fy=y+Math.floor(i/2)*47;this.text(person.name,fx,fy,14,p.ink,'bold');this.text(person.meta,fx,fy+20,11,p.muted,'normal',(w-42)/2);});y+=105;
    const aw=(w-10)/2;this.button(d.ui.birthCard,x,y,aw,50,'share-birth',null,'outline');this.button(d.ui.begin,x+aw+10,y,aw,50,'begin',null,'primary');return y+80;
  }
  overview(y) {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=16,w=W-32;if(!P)return y;
    const expanded=!d.settings.overviewCollapsed,h=expanded?304:207;
    this.box(x,y,w,h,p.paper,17,p.line);this.box(x,y,w,4,p.green,2);
    this.text(d.ui.overview,x+15,y+18,16,p.green,'bold');this.text(`${P.year} · ${P.age}`,x+15,y+42,13,p.muted);
    this.button(`${expanded?d.ui.collapse+' ⌃':d.ui.expand+' ⌄'}`,W-102,y+17,70,34,'toggle-overview',null,'outline');
    this.box(x+15,y+74,46,46,p.greenDark,11);this.text(P.initial,x+27,y+80,27,p.green,'bold');
    this.text(P.name,x+73,y+73,24,p.ink,'bold',w-100);this.paragraph(P.meta,x+73,y+105,w-99,12,18,p.muted,2);
    this.line(x,y+130,w);
    const stats=P.stats||[],sw=(w-28)/4;
    stats.forEach((item,i)=>{const sx=x+14+i*sw;this.text(item.label,sx,y+142,12,p.muted,'normal',sw-4);this.text(item.value,sx,y+162,20,p.ink,'bold');this.box(sx,y+191,sw-9,4,p.line,2);this.box(sx,y+191,(sw-9)*(item.width||0)/100,4,['#5c9c79','#d49f49','#89aebe','#b881a3'][i],2);});
    if(expanded){this.line(x,y+208,w);P.finances.forEach((f,i)=>{const fx=x+14+i*(w-28)/3;this.text(f.label,fx,y+219,11,p.muted);this.text(f.value,fx,y+237,14,p.ink,'bold',(w-35)/3);});this.line(x,y+260,w);this.text(`${d.ui.lifeDetails} ↗`,x+14,y+272,14,p.green,'bold');this.hit(x,y+260,w,44,'life-details');}
    this.hit(x,y,w,67,'toggle-overview');
    return y+h+16;
  }
  life() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=this.overview(16);
    this.box(x,y+2,4,24,p.green,2);this.text(d.ui.lifeLog,x+14,y,21,p.ink,'bold');y+=43;
    const logs=d.logs||[];
    for(const event of logs){
      const lines=this.lines(event.text,w-85,16),extra=event.effects?20:0;
      const h=Math.max(65,16+lines.length*24+extra+15+(event.date?20:0));
      if(y+h>=this.scroll-8&&y<=this.scroll+(this.viewportBottom-this.navHeight)+8){
        this.text(event.age,x+2,y+7,13,p.muted);
        if(event.date)this.text(event.date,x+42,y+3,12,p.muted);
        const ty=y+7+(event.date?21:0);lines.forEach((line,i)=>this.text(line,x+42,ty+i*24,16,event.type==='death'?'#bd5747':p.ink,'normal',w-88));
        if(event.effects)this.text(event.effects,x+42,ty+lines.length*24+4,12,p.green);
        this.text(event.starred?'★':'☆',W-47,y+6,24,event.starred?p.gold:p.muted);
        this.line(x,y+h-1,w);
      }
      this.hit(W-59,y,43,h,'star',event.id);y+=h;
    }
    return y+20;
  }
  footer() {
    const d=this.page.data,p=this.p,W=this.width,H=this.height,y=H-this.footerHeight;
    this.box(0,y,W,this.footerHeight,p.shade);this.text(`${d.ui.thisYear} · ${d.person?.year||''}`,14,y+13,13,'#ccd1c7');
    this.text(`${d.progress}%  ${d.speed}×`,W-102,y+13,14,'#f8f4e9','bold');
    this.box(14,y+38,W-28,5,'#485149',3);this.box(14,y+38,(W-28)*(d.progress||0)/100,5,p.green,3);
    this.text(d.person?.career||'',14,y+53,12,'#b7c0b5');this.text(`${d.person?.income||''} / ${d.ui.yearUnit}`,W-142,y+53,12,'#b7c0b5','normal',130);
    const gap=4,bw=(W-28-6*gap)/7;let by=y+77;
    this.button(d.paused?d.ui.play:d.ui.pause,14,by,bw,31,'pause',null,d.paused?'selected':'outline','fixed');
    d.speeds.forEach((s,i)=>this.button(`${s}×`,14+(i+1)*(bw+gap),by,bw,31,'speed',s,d.speed===s?'selected':'outline','fixed'));
    const aw=(W-28-10)/3;by=y+114;
    this.button(d.ui.next,14,by,aw,29,'next',null,'outline','fixed');
    this.button(d.ui.advance,19+aw,by,aw,29,'year',null,'outline','fixed');
    this.button(d.ui.autopilot,24+2*aw,by,aw,29,'autopilot',null,d.automatic?'selected':'outline','fixed');
  }
  ending() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=16,w=W-32;let y=25;if(!P)return y;
    this.image(P.cover,x,y,w,Math.min(190,w*.46));y+=Math.min(190,w*.46)+30;
    this.text(P.name,x,y,36,p.ink,'bold');y+=54;this.text(P.date,x,y,16,p.muted);y+=40;
    y+=this.paragraph(d.endingText,x,y,w,17,30,p.ink)+25;
    const bw=(w-10)/2;this.button(d.ui.photo,x,y,bw,52,'capture-ending',null,'primary');this.button(d.ui.viewReport,x+bw+10,y,bw,52,'end-done',null,'outline');return y+80;
  }
  archive() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=22;
    this.text('MEMORIAL HALL',x,y,13,p.green,'bold');y+=27;this.text(d.ui.archive,x,y,32,p.ink,'bold');y+=52;
    y+=this.paragraph(d.ui.archiveIntro,x,y,w,14,23,p.muted)+18;
    const facts=d.archiveFacts||[];this.box(x,y,w,106,p.paper,15,p.line);facts.forEach((f,i)=>{const fx=x+16+(i%3)*(w-32)/3,fy=y+14+Math.floor(i/3)*46;this.text(f.value,fx,fy,19,p.green,'bold');this.text(f.label,fx,fy+23,11,p.muted);});y+=125;
    if(!d.archiveList.length){this.box(x,y,w,100,p.paper,12,p.line);this.text(d.ui.noLives,x+15,y+18,15,p.muted);this.button(d.ui.born,x+14,y+49,w-28,40,'home',null,'primary');return y+115;}
    for(const item of d.archiveList){const h=249;this.box(x,y,w,h,p.paper,14,p.line);this.image(item.cover,x,y,w,132);this.text(item.name,x+13,y+143,20,p.ink,'bold');this.text(item.date,x+13,y+172,12,p.muted);this.paragraph(item.tagline,x+13,y+193,w-26,13,19,p.ink,2);this.text(`🕯 ${item.candles}`,x+13,y+222,13,p.gold);this.hit(x,y,w,h,'review',item.id);y+=h+14;}
    return y;
  }
  report() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=16,w=W-32;let y=18;if(!P)return y;
    this.box(x,y,w,1,p.paper);
    this.image(P.cover,x,y,w,150);y+=169;
    this.text(P.name,x,y,31,p.ink,'bold');y+=44;this.text(P.date,x,y,13,p.muted);y+=28;
    this.paragraph(P.tagline,x,y,w,17,24,p.ink,2);y+=50;
    this.paragraph(P.reportMeta,x,y,w,13,19,p.muted,2);y+=42;
    this.box(x,y,w,Math.ceil(P.facts.length/2)*58+26,p.paper,14,p.line);y+=13;
    P.facts.forEach((f,i)=>{const fx=x+14+(i%2)*(w-28)/2,fy=y+Math.floor(i/2)*58;this.text(f.label,fx,fy,12,p.muted);this.text(f.value,fx,fy+21,15,p.ink,'bold',(w-35)/2);});y+=Math.ceil(P.facts.length/2)*58+26;
    const reviewLines=this.lines(P.review,w-38,15),reviewHeight=24+reviewLines.length*23+(P.canEditReview?32:0);
    this.box(x,y,w,reviewHeight,p.paper2,12);this.paragraph(P.review,x+15,y+12,w-30,15,23,p.ink);if(P.canEditReview){this.text(`✎ ${d.ui.writeWords}`,W-145,y+reviewHeight-28,13,p.green,'bold');this.hit(W-165,y+reviewHeight-34,145,34,'edit-review');}y+=reviewHeight+18;
    this.button(`🕯 ${P.candles}`,x,y,100,37,'candle',P.id,'outline');y+=59;
    if(d.momentGroups.length){this.text(d.ui.moments,x,y,23,p.ink,'bold');y+=38;for(const group of d.momentGroups){this.box(x,y,w,34,p.paper2,8);this.text(`${group.title}  ${group.years}`,x+12,y+8,14,p.ink,'bold');y+=46;for(const item of group.events){this.image(item.cover,x,y,w,126);y+=132;this.text(`${item.age} · ${item.year}`,x,y,13,p.green,'bold');y+=24;y+=this.paragraph(item.text,x,y,w,14,22,p.ink,3)+17;}}if(d.hasMoreMoments){this.button(d.ui.moreMoments,x,y,w,40,'more-moments',null,'outline');y+=54;}}
    this.text(d.ui.wholeLife,x,y,23,p.ink,'bold');y+=42;
    this.box(x,y,w,1,p.line);for(const item of d.logs){const rows=this.lines(item.text,w-58,15),h=18+rows.length*23+12;if(y+h>=this.scroll-8&&y<this.scroll+(this.viewportBottom-this.navHeight)+8){this.text(item.age,x+9,y+13,12,p.muted);this.paragraph(item.text,x+45,y+11,w-58,15,23,item.type==='death'?'#bc5949':p.ink);this.line(x,y+h-1,w);}y+=h;}
    if(!d.fromArchive){y+=15;if(!d.memorialSaved){this.button(d.ui.memorialize,x,y,w,48,'memorialize',null,'primary');y+=59;}else{this.text(`✓ ${d.ui.memorialSaved}`,x+12,y+10,15,p.green);y+=44;}this.button(d.ui.replay,x,y,w,48,'replay',null,'outline');y+=65;}
    return y;
  }
  modal() {
    const d=this.page.data,p=this.p,W=this.width,H=this.height,kind=this.picker?'picker':d.modal;
    this.box(0,0,W,H,'rgba(0,0,0,.64)');
    const head=kind==='choice'&&d.automatic?73:60;
    let choiceHeight=0;
    if(kind==='choice'&&d.choice){
      const choice=d.choice,optionHeights=choice.options.reduce((sum,item)=>sum+61+(item.description?this.lines(item.description,W-108,12).length*18:0),0);
      choiceHeight=head+17+30+this.lines(choice.title,W-64,21).length*28+6+this.lines(choice.description,W-64,13).length*20+13+(choice.input?46:0)+optionHeights+13;
    }
    const h=kind==='review'?330:kind==='picker'?Math.min(H-this.navHeight-24,Math.max(170,60+this.picker.options.length*45+25)):Math.min(H-this.navHeight-this.safeBottom-18,kind==='choice'?choiceHeight:Math.min(620,H*.82));
    const top=Math.max(this.navHeight+8,(H-h)/2),x=14,w=W-28;
    this.box(x,top,w,h,p.paper,20,p.line);
    this.text(kind==='picker'?this.picker.label:kind==='choice'?d.ui.choice:kind==='details'?d.ui.details:d.ui.write, x+18,top+16,20,p.green,'bold');
    if(kind==='choice'&&d.automatic)this.text(d.paused?d.ui.autoChoicePaused:`${d.autoChoiceSeconds}${d.ui.autoChoiceSuffix}`,x+18,top+43,12,p.muted);
    this.text(d.ui.close,W-61,top+19,15,p.muted);this.hit(W-80,top,62,55,kind==='picker'?'close-picker':'close-modal',null,'modal');
    this.line(x,top+head,w);
    this.ctx.save();this.ctx.beginPath();this.ctx.rect(x+1,top+head+1,w-2,h-head-5);this.ctx.clip();this.ctx.translate(0,-this.modalScroll);
    let y=top+head+17;
    if(kind==='choice'){
      const ch=d.choice;if(ch){this.text(ch.meta,x+18,y,14,p.green,'bold');y+=30;y+=this.paragraph(ch.title,x+18,y,w-36,21,28,p.ink)+6;y+=this.paragraph(ch.description,x+18,y,w-36,13,20,p.muted)+13;
        if(ch.input){this.button(d.ui.reflectionPlaceholder,x+18,y,w-36,37,'input-reflection',null,'outline','modal-content');y+=46;}
        for(const item of ch.options){const desc=item.description?this.lines(item.description,w-80,12):[],oh=42+desc.length*18+10;this.box(x+14,y,w-28,oh,p.paper2,12,p.line);this.box(x+22,y+11,25,25,p.paper,6);this.text(item.number,x+30,y+16,14,p.green,'bold');this.text(item.label,x+58,y+9,17,p.green,'bold',w-76);if(desc.length)desc.forEach((line,i)=>this.text(line,x+58,y+33+i*18,12,p.muted,'normal',w-76));this.hit(x+14,y,w-28,oh,'choose',item.id,'modal-content');y+=oh+9;}
      }
    }else if(kind==='details'){
      const P=d.person;if(P){
        this.text(`${P.name} · ${P.age}`,x+18,y,20,p.ink,'bold');y+=40;
        const sections=[[d.ui.identity,P.identityFacts],[d.ui.family,P.family.map(m=>({label:m.label,value:`${m.name} · ${m.detail}`}))],[d.ui.assets,P.assets]];
        for(const [label,items] of sections){this.text(label,x+18,y,18,p.green,'bold');y+=31;for(const item of items){this.text(item.label,x+20,y,12,p.muted);y+=18;y+=this.paragraph(item.value,x+20,y,w-40,15,23,p.ink)+12;}y+=12;}
        this.text(d.ui.survival,x+18,y,18,p.green,'bold');y+=30;this.image(P.survivalCurve,x+18,y,w-36,155);y+=165;
      }
    }else if(kind==='review'){
      y+=this.paragraph(d.ui.reviewHelp,x+18,y,w-36,13,21,p.muted)+16;
      this.text(d.ui.yourWords,x+18,y,15,p.ink,'bold');y+=28;
      this.box(x+18,y,w-36,93,p.bg,10,p.line);this.paragraph(d.reviewDraft||d.ui.reviewPlaceholder,x+27,y+10,w-54,14,21,d.reviewDraft?p.ink:p.muted,3);this.hit(x+18,y,w-36,93,'input-review',null,'modal-content');y+=108;
      this.button(d.ui.save,x+18,y,w-36,43,'save-review',null,'primary','modal-content');y+=52;
    }else if(kind==='picker'){
      this.picker.options.forEach((item,index)=>{const py=y+index*45;this.text(item.label,x+22,py+9,15,index===this.picker.selected?p.green:p.ink,index===this.picker.selected?'bold':'normal',w-42);this.line(x+18,py+44,w-36);this.hit(x+14,py,w-28,44,'pick',index,'modal-content');});y+=this.picker.options.length*45;
    }
    this.modalContentHeight=y-(top+head)+13;this.modalViewportHeight=h-head-3;
    this.ctx.restore();
  }
  openPicker(key){
    const d=this.page.data,lists={language:d.languageLabels,birthYear:d.years,scope:d.regions,province:d.provinces};
    const options=lists[key];if(!options)return;
    this.picker={key,options,label:key==='language'?'语言':key==='birthYear'?d.ui.birthYear:key==='scope'?d.ui.scope:d.ui.province,selected:key==='language'?d.languageIndex:key==='birthYear'?d.yearIndex:key==='scope'?d.regionIndex:d.provinceIndex};
    this.modalScroll=Math.max(0,Math.min(this.picker.selected*45-100,options.length*45-400));this.invalidate();
  }
  action(hit) {
    if(!hit)return;
    if(hit.action==='picker')return this.openPicker(hit.value);
    if(hit.action==='close-picker'){this.picker=null;this.modalScroll=0;return this.invalidate();}
    if(hit.action==='pick'){
      const {key}=this.picker;this.page.onSetting({currentTarget:{dataset:{key}},detail:{value:hit.value}});
      this.picker=null;this.modalScroll=0;return this.invalidate();
    }
    if(hit.action==='share-birth'){
      const {path, ...data}=this.page.onShareAppMessage();
      if(wx.shareAppMessage)wx.shareAppMessage(data);
      return;
    }
    if(hit.action==='input-review'||hit.action==='input-reflection')return this.keyboard(hit.action==='input-review'?'review':'reflection');
    this.page.onAction({currentTarget:{dataset:{action:hit.action,value:hit.value}}});
  }
  keyboard(kind){
    this.keyboardKind=kind;
    const value=kind==='review'?this.page.data.reviewDraft:this.page.data.reflectionDraft;
    if(wx.showKeyboard)wx.showKeyboard({defaultValue:value||'',maxLength:300,multiple:true,confirmHold:false});
    else wx.showModal?.({title:kind==='review'?this.page.data.ui.yourWords:this.page.data.ui.reflectionPlaceholder,editable:true,placeholderText:value||'',success:result=>{if(result.confirm)this.keyboardValue(result.content||'');}});
  }
  keyboardValue(value){
    const event={detail:{value:String(value||'')}};
    if(this.keyboardKind==='review')this.page.onReviewInput(event);else this.page.onReflectionInput(event);
    this.invalidate();
  }
  touchStart(event){const t=event.touches?.[0]||event.changedTouches?.[0];if(!t)return;this.touch={x:t.clientX,y:t.clientY,scroll:this.scroll,modalScroll:this.modalScroll,homeOffset:this.homeOffset,moved:false};}
  touchMove(event){if(!this.touch)return;const t=event.touches?.[0]||event.changedTouches?.[0];if(!t)return;const dx=t.clientX-this.touch.x,dy=t.clientY-this.touch.y;if(Math.abs(dx)>7||Math.abs(dy)>7)this.touch.moved=true;
    if(this.picker||this.page.data.modal)this.modalScroll=Math.max(0,Math.min(Math.max(0,this.modalContentHeight-this.modalViewportHeight),this.touch.modalScroll-dy));
    else if(this.homeCarousel&&this.page.data.view==='home'&&this.touch.y+this.scroll-this.navHeight>=this.homeCarousel.y&&this.touch.y+this.scroll-this.navHeight<=this.homeCarousel.y+165&&Math.abs(dx)>Math.abs(dy))this.homeOffset=Math.max(0,Math.min(Math.max(0,(this.homeCarousel.count-2)*(this.homeCarousel.cw+10)),this.touch.homeOffset-dx));
    else this.scroll=Math.max(0,Math.min(Math.max(0,this.contentHeight-(this.viewportBottom-this.navHeight)),this.touch.scroll-dy));
    this.invalidate();
  }
  touchEnd(event){if(!this.touch)return;const t=event.changedTouches?.[0]||event.touches?.[0];const start=this.touch;this.touch=null;if(!t||start.moved)return;
    const list=this.picker||this.page.data.modal?this.modalHits:this.hits;
    const hit=[...list].reverse().find(item=>t.clientX>=item.x&&t.clientX<=item.x+item.w&&t.clientY>=item.y&&t.clientY<=item.y+item.h);
    this.action(hit);
  }
}

module.exports = CanvasUI;
