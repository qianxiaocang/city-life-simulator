// Native WeChat Mini Game presentation. All coordinates are logical screen px;
// the engine and save format remain shared with the mini program.
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
    this.textLayouts = new Map();
    this.inertiaToken = 0;
    this.resize();
  }
  resize() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const deviceWidth=Number(info.windowWidth)||390,deviceHeight=Number(info.windowHeight)||844,pixelRatio=Math.min(3,Number(info.pixelRatio)||1);
    this.deviceScale=deviceWidth/390;this.width=390;this.height=deviceHeight/this.deviceScale;
    this.dpr=pixelRatio*this.deviceScale;
    this.status = Math.max(0, Number(info.statusBarHeight) || 20)/this.deviceScale;
    this.safeBottom = Math.max(0, deviceHeight - (Number(info.safeArea?.bottom) || deviceHeight))/this.deviceScale;
    this.footerHeight = 150 + this.safeBottom;
    this.navHeight = Math.max(64/this.deviceScale, this.status + 44/this.deviceScale);
    this.canvas.width = Math.round(deviceWidth * pixelRatio);
    this.canvas.height = Math.round(deviceHeight * pixelRatio);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.invalidate();
  }
  onData(patch) {
    const dark=this.page.data.theme==='dark'||this.page.data.view==='ending',statusStyle=dark?'white':'black';
    if(statusStyle!==this.statusStyle){this.statusStyle=statusStyle;wx.setStatusBarStyle?.({style:statusStyle});wx.setMenuStyle?.({style:dark?'dark':'light'});}
    if (patch.view && patch.view !== this.lastView) {
      this.inertiaToken++;this.scroll = 0; this.homeOffset = 0; this.lastView = patch.view;
      this.keyboardKind=null;
    }
    if ('modal' in patch && patch.modal !== this.lastModal) {
      this.inertiaToken++;this.modalScroll = 0; this.lastModal = patch.modal;
      if(!patch.modal&&this.keyboardKind){this.keyboardKind=null;wx.hideKeyboard?.();}
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
    return dark ? { bg:this.page.data.view==='ending'?'#101b15':'#202823',paper:'#2a332c',paper2:'#344b40',inset:'#222b25',ink:'#edece3',muted:'#b1b6a9',line:'#424c40',green:'#9bceb7',greenDark:'#344b40',gold:'#d0ae66',button:'#b8ccbc',buttonInk:'#17291f',nav:this.page.data.view==='ending'?'#101b15':'#202823',shade:'#1d2221',cream:'#f0ecdf',accent:'#267b65' }
      : { bg:'#f4f1e9',paper:'#fffdfa',paper2:'#eaf2e8',inset:'#eeece4',ink:'#292c28',muted:'#888477',line:'#e4dfd3',green:'#267b65',greenDark:'#eaf2e8',gold:'#bc9349',button:'#267b65',buttonInk:'#fffdfa',nav:'#f4f1e9',shade:'#1d2221',cream:'#f0ecdf',accent:'#267b65' };
  }
  box(x,y,w,h,fill,r=0,stroke=null) {
    const c=this.ctx; c.beginPath();
    r=Math.max(0,Math.min(r,w/2,h/2));
    c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
  }
  text(value,x,y,size=16,color=this.p.ink,weight='normal',maxWidth,family='sans-serif') {
    const c=this.ctx;c.fillStyle=color;c.font=`${weight} ${size}px ${family==='serif'? 'Georgia, "Songti SC", serif':'-apple-system, "PingFang SC", sans-serif'}`;c.textBaseline='top';c.textAlign='left';
    if(maxWidth)c.fillText(String(value??''),x,y,maxWidth);else c.fillText(String(value??''),x,y);
  }
  lines(value,width,size=16,max=0,family='sans-serif') {
    const key=[value,width,size,max,family].join('|');if(this.textLayouts.has(key))return this.textLayouts.get(key);
    const c=this.ctx;c.font=`${size}px ${family==='serif'?'Georgia, "Songti SC", serif':'-apple-system, "PingFang SC", sans-serif'}`;
    const out=[];let line='';
    for(const part of String(value??'').split('\n')){
      for(const token of part.match(/[A-Za-z0-9¥￥,.%+\/-]+|./gu)||[]){
        if(line&&/^[，。！？；：、）】》」』”’]$/u.test(token)){line+=token;continue;}
        if(c.measureText(line+token).width>width&&line){out.push(line);line='';if(max&&out.length>=max)return this.cacheLines(key,out);}
        line+=token;
      }
      out.push(line);line='';if(max&&out.length>=max)return this.cacheLines(key,out);
    }
    if(out.length===0)out.push('');
    return this.cacheLines(key,out);
  }
  cacheLines(key,rows){if(this.textLayouts.size>2000)this.textLayouts.clear();this.textLayouts.set(key,rows);return rows;}
  paragraph(value,x,y,width,size=16,lineHeight=25,color=this.p.ink,max=0,family='sans-serif') {
    const rows=this.lines(value,width,size,max,family);
    rows.forEach((row,i)=>this.text(row,x,y+i*lineHeight,size,color,'normal',width,family));
    return rows.length*lineHeight;
  }
  title(value,x,y,size=24,color=this.p.ink,maxWidth) { this.text(value,x,y,size,color,'bold',maxWidth,'serif'); }
  trackedTitle(value,x,y,size,tracking=-1.5){this.ctx.font=`bold ${size}px Georgia, "Songti SC", serif`;for(const char of String(value)){const width=this.ctx.measureText(char).width;this.title(char,x,y,size);x+=width+tracking;}}
  prose(value,x,y,width,size=16,lineHeight=25,color=this.p.ink,max=0) { return this.paragraph(value,x,y,width,size,lineHeight,color,max,'serif'); }
  line(x,y,w){this.box(x,y,w,1,this.p.line);}
  chevron(cx,cy,size=6,up=false,color=this.p.muted){const c=this.ctx;c.beginPath();c.strokeStyle=color;c.lineWidth=1.6;c.moveTo(cx-size/2,cy+(up?size/4:-size/4));c.lineTo(cx,cy+(up?-size/4:size/4));c.lineTo(cx+size/2,cy+(up?size/4:-size/4));c.stroke();}
  diagonalArrow(x,y,size=15,color=this.p.green){const c=this.ctx;c.beginPath();c.strokeStyle=color;c.lineWidth=1.9;c.moveTo(x,y+size);c.lineTo(x+size,y);c.moveTo(x+size*.25,y);c.lineTo(x+size,y);c.lineTo(x+size,y+size*.75);c.stroke();}
  roundedImage(path,x,y,w,h,r=12,topOnly=false){
    this.ctx.save();this.box(x,y,w,h+(topOnly?r:0),null,r);this.ctx.clip();this.image(path,x,y,w,h);this.ctx.restore();
  }
  hit(x,y,w,h,action,value,mode='content') {
    const actualY=mode==='content'?y+this.navHeight-this.scroll:mode==='modal-content'?y-this.modalScroll:y;
    const target=mode==='modal'||mode==='modal-content'?this.modalHits:this.hits;
    let clip=mode==='modal-content'?this.modalBounds:mode==='content'?{x:0,y:this.navHeight,w:this.width,h:this.viewportBottom-this.navHeight}:null;
    if(mode==='content'&&this.contentHitClip){const local=this.contentHitClip,left=Math.max(clip.x,local.x),top=Math.max(clip.y,local.y);clip={x:left,y:top,w:Math.max(0,Math.min(clip.x+clip.w,local.x+local.w)-left),h:Math.max(0,Math.min(clip.y+clip.h,local.y+local.h)-top)};}
    if(clip){const left=Math.max(x,clip.x),top=Math.max(actualY,clip.y),right=Math.min(x+w,clip.x+clip.w),bottom=Math.min(actualY+h,clip.y+clip.h);if(right<=left||bottom<=top)return;target.push({x:left,y:top,w:right-left,h:bottom-top,action,value});}
    else target.push({x,y:actualY,w,h,action,value});
  }
  button(label,x,y,w,h,action,value,style='primary',mode='content') {
    if(mode==='fixed'){
      const active=style==='active',selected=style==='selected';
      const fill=active?'#f1eee5':selected?'#9bceb7':'#282d2b',ink=active||selected?'#1f2824':action==='next'?'#9acfb8':'#e7e6dc';
      this.box(x,y,w,h,fill,h/2,active?'#f1eee5':selected?'#9bceb7':'#3d4540');this.centerText(label,x,y,w,h,12.5,ink,active||selected?'bold':'normal');
      if(this.isPressed(action,value))this.box(x,y,w,h,'#ffffff18',h/2);
      this.hit(x,y,w,h,action,value,mode);return;
    }
    const p=this.p,fill=style==='primary'?p.button:style==='cream'?p.cream||p.paper:style==='active'?p.cream||p.paper:style==='soft'?p.paper2:style==='selected'?p.paper2:style==='outline'?null:p.paper;
    this.box(x,y,w,h,fill,12,style==='outline'||style==='selected'?p.line:null);
    const size=mode==='fixed'?Math.min(13,Math.max(10,w/Math.max(4,Array.from(String(label)).length)*1.25)):Math.min(17,Math.max(12,w/Math.max(4,Array.from(String(label)).length)*1.6));
    const c=this.ctx;c.font=`bold ${size}px sans-serif`;const tw=c.measureText(String(label)).width;
    this.text(label,x+(w-tw)/2,y+(h-size)/2-1,size,['cream','active'].includes(style)?'#243429':style==='primary'?p.buttonInk:style==='selected'?p.green:p.ink,'bold');
    if(this.isPressed(action,value))this.box(x,y,w,h,'#ffffff18',12);
    this.hit(x,y,w,h,action,value,mode);
  }
  centerText(label,x,y,w,h,size,color,weight='normal',family='sans-serif'){this.ctx.font=`${weight} ${size}px ${family==='serif'?'Georgia, "Songti SC", serif':'-apple-system, "PingFang SC", sans-serif'}`;const tw=this.ctx.measureText(String(label)).width,drawWidth=Math.min(tw,Math.max(1,w-4));this.text(label,x+(w-drawWidth)/2,y+(h-size)/2,size,color,weight,tw>drawWidth?drawWidth:undefined,family);}
  rightText(label,right,y,size,color,weight='normal'){this.ctx.font=`${weight} ${size}px -apple-system, "PingFang SC", sans-serif`;const tw=this.ctx.measureText(String(label)).width;this.text(label,right-tw,y,size,color,weight);}
  elideText(label,x,y,width,size,color,weight='normal'){this.ctx.font=`${weight} ${size}px -apple-system, "PingFang SC", sans-serif`;let value=String(label);if(this.ctx.measureText(value).width>width){while(value&&this.ctx.measureText(value+'…').width>width)value=value.slice(0,-1);value+='…';}this.text(value,x,y,size,color,weight);}
  isPressed(action,value){return this.touch&&!this.touch.moved&&this.touch.hit?.action===action&&this.touch.hit?.value===value;}
  image(path,x,y,w,h,fit='cover') {
    if(!path){this.placeholder(x,y,w,h);return;}
    let img=this.images.get(path);
    if(!this.images.has(path)){
      try{img=wx.createImage();this.images.set(path,img);img.onload=()=>this.invalidate();img.onerror=()=>{this.images.set(path,null);this.invalidate();};img.src=path;}
      catch(error){this.images.set(path,null);}
    }
    if(!img||!img.width){this.placeholder(x,y,w,h);return;}
    if(fit==='contain'){const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale;this.ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);return;}
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
    const lifeView=d.view==='life';this.viewportBottom=lifeView?H-this.footerHeight:H;
    this.box(0,0,W,this.navHeight,p.nav);
    if(d.view!=='ending')this.line(0,this.navHeight-1,W);
    if(d.view!=='ending'){
      if(d.view!=='home'){this.text('‹',17,this.status+5,29,p.ink);this.hit(0,this.status,55,47,'back',null,'fixed');}
      const label=d.view==='home'?d.ui.brand:d.view==='life'?d.ui.living:d.view==='archive'?d.ui.archive:d.view==='certificate'?d.ui.certificate:d.ui.report;
      c.font='bold 18px Songti SC, STSong, serif';const tw=c.measureText(label).width;this.title(label,(W-tw)/2,this.status+12,18,p.ink);
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
    this.contentHeight=end+24+(!lifeView?this.safeBottom:0);
    const maxScroll=Math.max(0,this.contentHeight-(this.viewportBottom-this.navHeight));if(this.scroll>maxScroll){this.scroll=maxScroll;this.invalidate();}
    if(lifeView)this.footer();
    if(d.view==='home')this.music();
    if(d.toast){const tw=Math.min(W-28,Math.max(150,Array.from(d.toast).length*11.8+24)),tx=(W-tw)/2;this.box(tx,this.navHeight+8,tw,35,'#faf7ef',10);this.text(d.toast,tx+12,this.navHeight+19,Math.min(12,(tw-24)/Math.max(1,Array.from(d.toast).length)),'#28352c','normal',tw-24);}
    if(this.picker||d.modal)this.modal();
  }
  music(){
    const d=this.page.data,p=this.p,saved=d.settings?.canvasMusicPosition;
    const pos=this.musicPosition||(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y)?saved:{x:this.width-191,y:this.navHeight+8});
    this.musicPosition=this.clampMusicPosition(pos);const {x,y}=this.musicPosition;
    this.box(x-4,y-4,58,58,'#54735f18',29);this.box(x,y,50,50,d.musicPlaying?'#288d71':'#43584d',25,'#ffffff30');
    this.text('♪',x+12,y+11,27,'#f3f0e4');for(let i=0;i<3;i++){const h=d.musicPlaying?9+(Math.sin(Date.now()/210+i)+1)*4:8;this.box(x+29+i*4,y+26-h/2,2,h,'#f3f0e4',1);}
    this.hit(x-3,y-3,56,56,'music',null,'fixed');
    if(d.musicPlaying&&this.page._foreground!==false)this.invalidate();
  }
  home() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=49;
    const ctlX=W-118;this.box(ctlX,7,102,33,p.paper,9,p.line);this.box(ctlX+75,10,1,27,p.line);
    this.centerText(d.languageLabels[d.languageIndex]?.label||'简体中文',ctlX+3,7,58,33,11.5,p.ink,'bold');this.chevron(ctlX+66,23.5,5.5);
    this.hit(ctlX,7,75,33,'picker','language');
    this.centerText(d.theme==='dark'?'☀':'◐',ctlX+76,7,26,33,18,p.ink);
    this.hit(ctlX+75,7,27,33,'theme');
    this.text('—  '+d.ui.eyebrow,x,y,13,p.green,'bold');y+=34;
    this.trackedTitle(d.ui.brand,x,y,40);y+=58;
    y+=this.prose(d.ui.heroText,x,y,w,16,27,p.ink,3)+13;
    const coverH=Math.round(w*.315);this.roundedImage(d.homeCover,x,y,w,coverH,15);y+=coverH+14;
    if(d.resume){this.box(x,y,w,66,p.paper2,13);this.text(d.resume.name+' · '+d.resume.age,x+13,y+13,16,p.ink,'bold');this.text(d.resume.place,x+13,y+38,12,p.muted);this.box(W-125,y+14,96,38,'#267b65',9);this.centerText(d.ui.resume,W-125,y+14,96,38,14,'#fffdfa');this.hit(W-125,y+14,96,38,'resume');y+=82;}
    const past=d.settings.world==='past',advanced=d.advancedOpen;
    const cardH=advanced?(past?578:508):(past?344:274);
    this.box(x,y,w,cardH,p.paper,18,p.line);
    this.title(d.ui.pastPresent,x+16,y+18,19,p.ink);
    const countText=d.ui.locationCount,countW=Math.min(116,Array.from(countText).length*9+14);
    this.box(W-32-countW,y+17,countW,26,p.paper2,14);this.centerText(countText,W-32-countW,y+17,countW,26,11,p.green);
    let row=y+56;this.box(x+16,row,w-32,46,p.inset,11,p.line);
    const tabW=(w-32)/2;this.box(past?x+19:x+16+tabW,row+3,tabW-3,40,p.paper2,9);
    this.title(d.ui.past,x+16+tabW*.38,row+12,16,past?p.green:p.ink);
    this.title(d.ui.now,x+16+tabW+tabW*.38,row+12,16,past?p.ink:p.green);
    this.hit(x+16,row,tabW,46,'world','past');this.hit(x+16+tabW,row,tabW,46,'world','now');row+=61;
    row+=this.paragraph(past?d.ui.pastHint:d.ui.nowHint,x+16,row,w-32,12,18,p.muted,2)+14;
    if(past){this.box(x+16,row,w-32,58,p.inset,11,p.line);this.text(d.ui.birthYear,x+28,row+21,13,p.muted,'bold');this.box(W-147,row+10,101,38,p.paper,9,p.line);this.text(String(d.settings.birthYear),W-136,row+20,16,p.ink,'bold');this.chevron(W-57,row+28,7);this.hit(x+16,row,w-32,58,'picker','birthYear');row+=70;}
    this.box(x+16,row,w-32,advanced?286:47,p.paper,11,p.line);if(advanced)this.line(x+16,row+47,w-32);this.text(d.ui.birthSettings,x+28,row+16,14,p.ink,'bold');this.chevron(W-46,row+24,7,advanced,p.green);this.hit(x+16,row,w-32,47,'toggle-advanced');row+=advanced?54:0;
    if(advanced){
      for(const [key,label,opts,index] of [['scope',d.ui.scope,d.regions,d.regionIndex],['province',d.ui.province,d.provinces,d.provinceIndex]]){
        this.text(label,x+28,row+3,12,p.muted,'bold');row+=25;this.box(x+28,row,w-56,40,p.inset,9,p.line);this.text(opts[index]?.label||'全部',x+40,row+13,14,p.ink,'bold',w-100);this.chevron(W-49,row+20,7);this.hit(x+28,row,w-56,40,'picker',key);row+=52;
      }
      this.text(d.ui.pace,x+28,row+3,12,p.muted,'bold');row+=27;this.box(x+28,row,w-56,39,p.inset,9,p.line);const pw=(w-56)/3;
      [30,60,90].forEach((n,i)=>{if(d.settings.pace===n)this.box(x+31+i*pw,row+3,pw-6,33,p.paper2,8);this.centerText(n+' '+(d.ui.minutes||'分钟'),x+28+i*pw,row,pw,39,12,d.settings.pace===n?p.green:p.ink,d.settings.pace===n?'bold':'normal','serif');this.hit(x+28+i*pw,row,pw,39,'pace',n);});
    }
    this.box(x+16,y+cardH-60,w-32,46,p.button,12);this.text(d.ui.born,x+33,y+cardH-45,16,p.buttonInk,'bold');this.diagonalArrow(W-61,y+cardH-45,14,p.buttonInk);this.hit(x+16,y+cardH-60,w-32,46,'born');y+=cardH+34;
    this.title(d.ui.rememberedLives,x,y,19,p.ink);this.text(d.ui.viewAll+' ↗',W-92,y+3,12,p.green,'bold');this.hit(W-112,y-4,100,34,'archive');y+=39;
    if(!d.memories.length){this.box(x,y,w,76,p.paper,11,p.line);this.text(d.ui.memorialEmpty,x+14,y+25,13,p.muted);return y+95;}
    const cw=(w-11)/2,clipY=y;this.ctx.save();this.ctx.beginPath();this.ctx.rect(x,y,w,132);this.ctx.clip();
    this.contentHitClip={x,y:y+this.navHeight-this.scroll,w,h:124};
    d.memories.slice(0,8).forEach((item,i)=>{const left=x+i*(cw+11)-this.homeOffset;this.box(left,y,cw,124,p.paper,11,p.line);this.roundedImage(item.cover,left,y,cw,73,9,true);this.elideText(item.name,left+9,y+82,cw-18,14.5,p.ink,'bold');this.elideText(item.date,left+9,y+105,cw-18,11,p.muted);if(this.isPressed('review',item.id))this.box(left,y,cw,124,'#ffffff24',11);if(left+cw>x&&left<x+w)this.hit(left,y,cw,124,'review',item.id);});
    this.contentHitClip=null;
    this.ctx.restore();this.homeCarousel={x,y:clipY,w,cw,h:124,count:Math.min(8,d.memories.length)};return y+140;
  }
  certificate() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=16,w=W-32,top=18;if(!P)return top;
    const inner=w-32,col=inner/2,colText=col-10;
    const metaRows=this.lines(P.meta,inner,14,0),birthRows=this.lines(P.birthText,inner,15,0,'serif');
    const facts=(P.facts||[]).slice(0,4),companions=(P.companions||[]).slice(0,4);
    const pairs=(items,size)=>{const result=[];for(let i=0;i<items.length;i+=2){const pair=items.slice(i,i+2);const lines=pair.map(item=>this.lines(size==='fact'?item.value:item.meta,colText,size==='fact'?15:11,0));result.push({pair,lines,height:Math.max(size==='fact'?48:44,22+Math.max(...lines.map(row=>row.length))*(size==='fact'?19:16)+9)});}return result;};
    const factPairs=pairs(facts,'fact'),companionPairs=pairs(companions,'companion');
    const factHeight=factPairs.reduce((sum,row)=>sum+row.height,0),companionHeight=companionPairs.reduce((sum,row)=>sum+row.height,0);
    const actionsY=top+139+28+42+metaRows.length*21+18+birthRows.length*26+14+factHeight+12+32+companionHeight+12;
    const cardHeight=actionsY-top+71;this.box(x,top,w,cardHeight,p.paper,18,p.line);
    this.roundedImage(P.cover,x,top,w,121,17,true);let y=top+139;
    this.text(d.ui.certificate,x+16,y,14,p.green,'bold');y+=28;
    this.title(P.name,x+16,y,29,p.ink,inner);y+=42;
    metaRows.forEach((line,i)=>this.text(line,x+16,y+i*21,14,p.muted,'normal',inner));y+=metaRows.length*21+18;
    birthRows.forEach((line,i)=>this.text(line,x+16,y+i*26,15,p.ink,'normal',inner,'serif'));y+=birthRows.length*26+14;
    for(const row of factPairs){row.pair.forEach((fact,i)=>{const fx=x+16+i*col;this.text(fact.label,fx,y,12,p.muted,'normal',colText);row.lines[i].forEach((line,j)=>this.text(line,fx,y+18+j*19,15,p.ink,'bold',colText));});y+=row.height;}
    y+=12;this.title(d.ui.sameMoment,x+16,y,18,p.ink,inner);y+=32;
    for(const row of companionPairs){row.pair.forEach((person,i)=>{const fx=x+16+i*col;this.text(person.name,fx,y,14,p.ink,'bold',colText);row.lines[i].forEach((line,j)=>this.text(line,fx,y+20+j*16,11,p.muted,'normal',colText));});y+=row.height;}
    this.line(x,actionsY,w);const aw=(w-34)/2;
    this.button(d.ui.birthCard,x+12,actionsY+12,aw,46,'share-birth',null,'outline');this.button(d.ui.begin,x+22+aw,actionsY+12,aw,46,'begin',null,'primary');
    return top+cardHeight+24;
  }
  overview(y) {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=12,w=W-24;if(!P)return y;
    const expanded=!d.settings.overviewCollapsed,h=expanded?244:151;
    this.box(x,y,w,h,p.paper,16,p.line);
    this.ctx.save();this.box(x,y,w,h,null,16);this.ctx.clip();
    if(this.ctx.createLinearGradient){const rainbow=this.ctx.createLinearGradient(x,0,x+w,0);rainbow.addColorStop(0,'#257963');rainbow.addColorStop(.35,'#9fa772');rainbow.addColorStop(.65,'#c3a25d');rainbow.addColorStop(1,'#ac3c56');this.box(x,y,w,3.5,rainbow);}else ['#257963','#9fa772','#c3a25d','#ac3c56'].forEach((color,i)=>this.box(x+i*w/4,y,w/4,3.5,color));
    this.ctx.restore();
    this.text(d.ui.overview,x+12,y+18,12,p.green,'bold');this.text(P.year+' · '+P.age,x+83,y+19,10.5,p.muted);
    this.box(W-70,y+11,46,27,p.inset,7,p.line);this.text(expanded?d.ui.collapse:d.ui.expand,W-63,y+20,11.5,p.green);this.chevron(W-32,y+24,6,expanded,p.green);this.hit(W-74,y+7,54,35,'toggle-overview');
    this.box(x+12,y+45,33,33,p.paper2,10);this.centerText(P.initial,x+12,y+45,33,33,19,p.green,'bold','serif');
    this.title(P.name,x+53,y+44,20,p.ink,w-78);this.text(P.meta,x+53,y+69,11,p.muted,'normal',w-68);
    this.line(x,y+91,w);
    const sw=(w-24)/4;
    (P.stats||[]).forEach((item,i)=>{const sx=x+12+i*sw;this.text(item.label,sx,y+101,11,p.muted,'normal',sw-4);this.text(item.value,sx,y+119,16,p.ink,'bold');this.box(sx,y+138,sw-9,3.5,p.line,2);this.box(sx,y+138,(sw-9)*(item.width||0)/100,3.5,['#5d9d79','#d5a145','#85aab8','#b785a4'][i],2);});
    if(expanded){this.line(x,y+151,w);P.finances.forEach((f,i)=>{const fx=x+12+i*(w-24)/3;this.text(f.label,fx,y+160,10.5,p.muted);this.text(f.value,fx,y+178,14,p.ink,'bold',(w-32)/3);});this.line(x,y+202,w);this.text(d.ui.lifeDetails,x+12,y+217,12,p.green,'bold');this.diagonalArrow(W-34,y+218,10,p.green);this.hit(x,y+202,w,42,'life-details');}
    return y+h+22;
  }
  life() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=this.overview(14);
    this.box(x,y+2,3.5,15,p.green,2);this.text(d.ui.lifeLog,x+9,y+1,16,p.green,'bold');y+=32;
    const logs=d.logs||[];
    for(const event of logs){
      const rows=this.lines(event.text,w-78,15.6,0,'serif'),extra=event.effects?22:0;
      const h=Math.max(54,9+rows.length*25.5+extra+9+(event.date?18:0));
      if(y+h>=this.scroll-8&&y<=this.scroll+(this.viewportBottom-this.navHeight)+8){
        this.text(event.age,x+2,y+11,12,p.muted,'normal',undefined,'serif');
        if(event.date)this.text(event.date,x+32,y+5,11,p.muted);
        const color=['death','illness','danger'].includes(event.type)?'#d1644d':['positive','asset'].includes(event.type)?p.green:p.ink;
        const ty=y+9+(event.date?18:0);rows.forEach((row,i)=>this.text(row,x+32,ty+i*25.5,15.6,color,'normal',w-77,'serif'));
        if(event.effects)this.text(event.effects,x+32,ty+rows.length*25.5+4,12,p.green);
        this.text(event.starred?'★':'☆',W-44,y+7,22,event.starred?p.gold:p.muted);
        this.line(x,y+h-1,w);
      }
      this.hit(W-58,y,42,h,'star',event.id);y+=h;
    }
    return y+20;
  }
  footer() {
    const d=this.page.data,p=this.p,W=this.width,H=this.height,y=H-this.footerHeight;
    this.box(0,y,W,this.footerHeight,'#1d2221');this.text(d.ui.thisYear+' · '+(d.person?.year||''),14,y+12,12,'#bdc0b6');
    this.rightText((d.progress||0)+'% '+d.speed+'×',W-14,y+12,12,'#f4f0e5','bold');
    this.box(14,y+36,W-28,5,'#464c46',3);
    const progressWidth=(W-28)*(d.progress||0)/100;if(progressWidth>0){const c=this.ctx;if(c.createLinearGradient){const g=c.createLinearGradient(14,0,W-14,0);g.addColorStop(0,'#62c8a4');g.addColorStop(.48,'#d1ab6f');g.addColorStop(1,'#be698e');this.box(14,y+36,progressWidth,5,g,3);}else this.box(14,y+36,progressWidth,5,p.green,3);}
    this.text(d.person?.career||'',14,y+52,11,'#bdc0b6');
    this.rightText((d.person?.income||'')+' / '+d.ui.yearUnit,W-14,y+52,11,'#bdc0b6');
    const gap=5,bw=(W-28-6*gap)/7.3,pauseWidth=bw*1.3;let by=y+76;
    this.button(d.paused?d.ui.play:d.ui.pause,14,by,pauseWidth,31,'pause',null,'outline','fixed');
    d.speeds.forEach((s,i)=>this.button(s+'×',14+pauseWidth+gap+i*(bw+gap),by,bw,31,'speed',s,d.speed===s?'active':'outline','fixed'));
    const labels=[[d.ui.next,'next'],[d.ui.advance,'year'],[d.ui.autopilot,'autopilot']];const widths=[81,68,76];let xx=14;by=y+114;
    labels.forEach(([label,action],i)=>{this.button(label+(i===0?' »':''),xx,by,widths[i],29,action,null,d.automatic&&i===2?'selected':'outline','fixed');xx+=widths[i]+6;});
  }
  ending() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=20,w=W-40;if(!P)return 0;
    const coverH=120,storyRows=this.lines(d.endingText,w,15.6,0,'serif'),blockHeight=coverH+28+56+55+storyRows.length*29.6+34+50;
    let y=Math.max(24,Math.round((this.height-this.navHeight-this.safeBottom-blockHeight)/2)+5);
    this.roundedImage(P.cover,x,y,w,coverH,10);y+=coverH+28;
    this.ctx.font='36px Georgia, "Songti SC", serif';let tw=this.ctx.measureText(P.name).width;this.text(P.name,(W-tw)/2,y,36,p.ink,'normal',undefined,'serif');y+=56;
    const date=String(P.date),tracking=1.5,c=this.ctx;c.font='14px Menlo, monospace';tw=Array.from(date).reduce((sum,char)=>sum+c.measureText(char).width,0)+Math.max(0,date.length-1)*tracking;let dx=(W-tw)/2;c.fillStyle='#a9baab';c.textBaseline='top';c.textAlign='left';for(const char of date){c.fillText(char,dx,y);dx+=c.measureText(char).width+tracking;}y+=55;
    y+=this.prose(d.endingText,x,y,w,15.6,29.6,'#b6c2b4')+34;
    const bw=(w-10)/2;this.box(x,y,bw,50,'#f0ecdf',12);this.centerText(d.ui.photo,x,y,bw,50,15.5,'#243429','bold');this.hit(x,y,bw,50,'capture-ending');
    this.box(x+bw+10,y,bw,50,null,12,'#6a806b');this.centerText(d.ui.viewReport,x+bw+10,y,bw,50,15.5,'#f0ecdf','bold');this.hit(x+bw+10,y,bw,50,'end-done');return y+74;
  }
  archive() {
    const d=this.page.data,p=this.p,W=this.width,x=16,w=W-32;let y=22;
    this.text('MEMORIAL HALL',x,y,12,p.green,'bold');y+=29;this.title(d.ui.archive,x,y,32,p.ink);y+=54;
    y+=this.paragraph(d.ui.archiveIntro,x,y,w,14,26,p.muted)+18;
    const facts=d.archiveFacts||[];this.box(x,y,w,138,p.paper,16,p.line);
    facts.forEach((f,i)=>{const fw=(w-16)/3,fx=x+8+(i%3)*fw,fy=y+17+Math.floor(i/3)*62;this.centerText(f.value,fx,fy,fw,26,20,p.green,'bold','serif');this.centerText(f.label,fx,fy+29,fw,20,11.5,p.muted);});y+=155;
    if(!d.archiveList.length){this.box(x,y,w,106,p.paper,12,p.line);this.text(d.ui.noLives,x+15,y+18,14,p.muted);this.button(d.ui.born,x+14,y+53,w-28,39,'home',null,'primary');return y+122;}
    for(const item of d.archiveList){
      const rows=this.lines(item.review,w-28,13,3),h=121+86+rows.length*23+58;
      this.box(x,y,w,h,p.paper,14,p.line);this.roundedImage(item.cover,x,y,w,121,14,true);
      this.title(item.name,x+15,y+138,21,p.ink);this.text(item.date,x+15,y+169,12.5,p.muted);
      this.text(item.tagline,x+15,y+198,14.5,p.ink,'bold',w-30);
      this.paragraph(item.review,x+15,y+228,w-30,13,23,p.muted,3);
      this.text('🕯 '+item.candles,x+13,y+h-25,12,p.gold);
      if(this.isPressed('review',item.id))this.box(x,y,w,h,'#ffffff18',14);this.hit(x,y,w,h,'review',item.id);this.hit(x+9,y+h-39,75,38,'candle',item.id);y+=h+16;
    }
    return y;
  }
  report() {
    const d=this.page.data,p=this.p,P=d.person,W=this.width,x=13,w=W-26;let y=13;if(!P)return y;
    const rows=Math.ceil(P.facts.length/2),reviewRows=this.lines(P.review,w-52,15,0,'serif'),reviewHeight=24+reviewRows.length*27+(P.canEditReview?28:0);
    const cardH=121+17+35+27+39+28+rows*52+19+reviewHeight+20+42+18;
    this.box(x,y,w,cardH,p.paper,16,p.line);this.roundedImage(P.cover,x,y,w,121,15,true);let cy=y+136;
    this.title(P.name,x+15,cy,26,p.ink);cy+=36;this.text(P.date,x+15,cy,13,p.muted);cy+=29;
    this.title(P.tagline,x+14,cy,16,p.ink,w-28);cy+=31;
    this.text(P.reportMeta,x+14,cy,12,p.muted,'normal',w-28);cy+=35;this.line(x+14,cy,w-28);cy+=15;
    P.facts.forEach((f,i)=>{const fx=x+15+(i%2)*(w-30)/2,fy=cy+Math.floor(i/2)*52;this.text(f.label,fx,fy,12,p.muted);this.text(f.value,fx,fy+21,14.5,p.ink,'bold',(w-40)/2);});cy+=rows*52+4;
    this.line(x+14,cy,w-28);cy+=16;
    this.box(x+14,cy,w-28,reviewHeight,p.paper2,11);this.box(x+14,cy,2,reviewHeight,p.green);
    this.prose(P.review,x+27,cy+12,w-53,15,27,p.ink);
    if(P.canEditReview){this.text(d.ui.writeWords+' ↗',W-129,cy+reviewHeight-23,12,p.green,'bold');this.hit(W-148,cy+reviewHeight-30,126,30,'edit-review');}
    cy+=reviewHeight+17;this.text('🕯 '+P.candles,x+16,cy+2,13,p.muted);this.hit(x+10,cy,w-20,36,'candle',P.id);
    y+=cardH+28;
    if(d.momentGroups.length){
      this.title(d.ui.moments,x,y,22,p.ink);y+=42;
      for(const group of d.momentGroups){
        this.box(x,y,3,29,p.gold,2);this.title(group.title,x+14,y+6,16,p.ink);this.text(group.years,x+92,y+8,12,p.muted);y+=37;
        const cw=(w-10)/2;
        for(let start=0;start<group.events.length;start+=2){
          const pair=group.events.slice(start,start+2);const rowH=87+Math.max(...pair.map(item=>this.lines(item.text,cw,13,0,'serif').length))*21.5;
          pair.forEach((item,i)=>{const left=x+i*(cw+10);this.box(left,y,cw,60,p.inset,2,p.gold);this.image(item.cover,left+3,y+3,cw-6,54);this.title(item.age,left,y+67,13,p.ink);const ageWidth=this.ctx.measureText(item.age).width;this.text(String(item.year),left+ageWidth+8,y+68,11.5,p.muted);this.prose(item.text,left,y+87,cw,13,21.5,p.ink);});
          y+=rowH+12;
        }
      }
      if(d.hasMoreMoments){this.button(d.ui.moreMoments,x,y,w,40,'more-moments',null,'outline');y+=54;}
    }
    this.title(d.ui.wholeLife,x,y,22,p.ink);y+=41;
    const logRows=(d.logs||[]).map(item=>({item,rows:this.lines(item.text,w-70,14,0,'serif')}));
    const heights=logRows.map(({rows})=>Math.max(47,18+rows.length*22+12));const total=heights.reduce((a,b)=>a+b,0);
    this.box(x,y,w,total+3,p.paper,15,p.line);let ly=y+2;
    logRows.forEach(({item,rows},i)=>{const h=heights[i];if(ly+h>=this.scroll-10&&ly<this.scroll+(this.viewportBottom-this.navHeight)+10){const color=['death','illness','danger'].includes(item.type)?'#d1644d':['positive','asset'].includes(item.type)?p.green:p.ink;this.text(item.age,x+15,ly+12,11,p.muted);rows.forEach((row,j)=>this.text(row,x+45,ly+11+j*22,14,color,'normal',w-63,'serif'));this.line(x+14,ly+h-1,w-28);}ly+=h;});y+=total+25;
    if(!d.fromArchive){if(!d.memorialSaved){this.button(d.ui.memorialize,x,y,w,45,'memorialize',null,'primary');y+=60;}else{this.text('✓ '+d.ui.memorialSaved,x+(w-130)/2,y+14,13,p.green);y+=58;}this.button(d.ui.replay,x,y,w,44,'replay',null,'outline');y+=68;}
    return y;
  }
  modal() {
    const d=this.page.data,p=this.p,W=this.width,H=this.height,kind=this.picker?'picker':d.modal;
    this.box(0,0,W,H,'rgba(0,0,0,.72)');
    const head=kind==='choice'?(d.automatic?57:43):kind==='review'?42:51;
    let choiceHeight=0;
    if(kind==='choice'&&d.choice){
      const choice=d.choice,optionHeights=choice.options.reduce((sum,item)=>sum+17+this.lines(item.label,W-88,13,2).length*18+(item.description?3+this.lines(item.description,W-88,11).length*15:0),0);
      choiceHeight=head+12+23+this.lines(choice.title,W-54,16.5,0,'serif').length*23+5+this.lines(choice.description,W-54,11.5).length*17+9+(choice.input?63:0)+optionHeights+10;
    }
    const maxH=H-this.navHeight-this.safeBottom-16;
    const h=kind==='details'?H-this.navHeight-8:kind==='review'?303:kind==='picker'?Math.min(maxH,Math.max(150,51+this.picker.options.length*44+18)):Math.min(maxH,kind==='choice'?choiceHeight:360);
    const top=kind==='details'?this.navHeight+8:Math.max(this.navHeight+8,Math.round((H-h)/2)),x=14,w=W-28;
    this.box(x,top,w,h+(kind==='details'?17:0),p.paper,17,p.line);
    this.text(kind==='picker'?this.picker.label:kind==='choice'?d.ui.choice:kind==='details'?d.ui.details:d.ui.write,x+14,top+16,14.5,p.green,'bold');
    if(kind==='choice'&&d.automatic)this.text(d.paused?d.ui.autoChoicePaused:String(d.autoChoiceSeconds)+d.ui.autoChoiceSuffix,x+14,top+38,10.5,p.muted);
    this.text(d.ui.close,W-51,top+17,12.5,p.muted);this.hit(W-76,top,58,head,'close-'+(kind==='picker'?'picker':'modal'),null,'modal');
    this.line(x,top+head,w);
    this.ctx.save();this.ctx.beginPath();this.ctx.rect(x+1,top+head+1,w-2,h-head-4);this.ctx.clip();this.ctx.translate(0,-this.modalScroll);
    this.modalBounds={x:x+1,y:top+head+1,w:w-2,h:h-head-4};
    let y=top+head+(kind==='choice'?12:16);
    if(kind==='choice'){
      const ch=d.choice;if(ch){
        this.text(ch.meta,x+13,y,11.5,p.green,'bold');y+=23;
        y+=this.prose(ch.title,x+13,y,w-26,16.5,23,p.ink)+5;
        y+=this.paragraph(ch.description,x+13,y,w-26,11.5,17,p.muted)+9;
        if(ch.input){
          this.box(x+13,y,w-26,55,p.inset,9,p.line);
          this.paragraph(d.reflectionDraft||d.ui.reflectionPlaceholder,x+20,y+10,w-40,12,18,d.reflectionDraft?p.ink:p.muted,2);
          this.hit(x+13,y,w-26,55,'input-reflection',null,'modal-content');y+=63;
        }
        for(const item of ch.options){
          const labels=this.lines(item.label,w-60,13,2),desc=item.description?this.lines(item.description,w-60,11):[],oh=12+labels.length*18+(desc.length?3+desc.length*15:0);
          this.box(x+12,y,w-24,oh,p.paper2,8,p.line);this.box(x+20,y+8,17,17,p.paper,5);
          this.centerText(item.number,x+20,y+8,17,17,11.5,p.green,'bold','serif');labels.forEach((label,i)=>this.text(label,x+45,y+6+i*18,13,p.green,'bold',w-60));
          desc.forEach((line,i)=>this.text(line,x+45,y+6+labels.length*18+3+i*15,11,p.muted,'normal',w-60));
          if(this.isPressed('choose',item.id))this.box(x+12,y,w-24,oh,'#ffffff20',8);
          this.hit(x+12,y,w-24,oh,'choose',item.id,'modal-content');y+=oh+5;
        }
      }
    }else if(kind==='details'){
      const P=d.person;if(P){
        this.box(x+17,y,43,43,p.paper2,11);this.title(P.initial,x+27,y+9,23,p.green);
        this.title(P.name,x+71,y+2,22,p.ink,w-95);this.text(P.year+' · '+P.age,x+71,y+30,12,p.muted);y+=59;this.line(x+17,y,w-34);y+=17;
        this.text(d.ui.identity,x+17,y,15,p.green,'bold');y+=34;
        const fw=(w-48)/2;P.identityFacts.forEach((f,i)=>{const fx=x+17+(i%2)*(fw+14),fy=y+Math.floor(i/2)*58;this.text(f.label,fx,fy,11,p.muted);this.text(f.value,fx,fy+21,14,p.ink,'bold',fw-5);});y+=Math.ceil(P.identityFacts.length/2)*58+9;this.line(x+17,y,w-34);y+=18;
        this.text(d.ui.family,x+17,y,15,p.green,'bold');y+=30;
        P.family.forEach(member=>{this.text(member.label,x+17,y+10,11,p.muted);this.text(member.name,x+79,y+8,13,p.ink,'bold',w-170);this.text(member.detail,W-98,y+10,11,p.muted,'normal',74);y+=43;this.line(x+17,y,w-34);});y+=15;
        this.text(d.ui.assets,x+17,y,15,p.green,'bold');y+=33;
        P.assets.forEach((asset,i)=>{const fx=x+17+(i%2)*(fw+14),fy=y+Math.floor(i/2)*58;this.text(asset.label,fx,fy,11,p.muted);this.text(asset.value,fx,fy+21,14,p.ink,'bold',fw-4);});y+=Math.ceil(P.assets.length/2)*58+16;this.line(x+17,y,w-34);y+=18;
        if(P.companions?.length){
          this.text(d.ui.sameMoment,x+17,y,15,p.green,'bold');y+=36;
          const cw=(w-47)/2;P.companions.slice(0,4).forEach((person,i)=>{const fx=x+17+(i%2)*(cw+13),fy=y+Math.floor(i/2)*91;this.box(fx,fy,cw,81,p.bg,10,p.line);this.text(person.name,fx+10,fy+11,14,p.ink,'bold',cw-20);this.text(person.meta,fx+10,fy+36,10,p.muted,'normal',cw-20);this.text(person.status,fx+10,fy+57,11,p.green,'normal',cw-20);});y+=Math.ceil(Math.min(4,P.companions.length)/2)*91+13;
          this.paragraph(d.ui.companionHint,x+17,y,w-34,11,17,p.muted,2);y+=46;this.line(x+17,y,w-34);y+=18;
        }
        if(P.yearMap?.length){
          this.text(d.ui.lifeMap,x+17,y,15,p.green,'bold');y+=36;
          const mapX=x+17,cols=24,gap=2,cell=(w-34-(cols-1)*gap)/cols;
          P.yearMap.slice(0,120).forEach((year,i)=>{const col=i%cols,row=Math.floor(i/cols),cx=mapX+col*(cell+gap),cy=y+row*(cell+gap);this.box(cx,cy,cell,cell,year.color||p.bg,2,year.current?p.gold:p.line);});
          y+=Math.ceil(Math.min(120,P.yearMap.length)/cols)*(cell+gap)+12;
          this.text('0',mapX,y,10,p.muted);this.text('48',mapX+(w-34)/2-10,y,10,p.muted);this.text(P.age,mapX+w-68,y,10,p.muted);y+=24;
          this.paragraph(d.ui.lifeMapHint,x+17,y,w-34,11,18,p.muted,2);y+=45;this.line(x+17,y,w-34);y+=18;
        }
        this.text(d.ui.survival,x+17,y,15,p.green,'bold');y+=33;
        this.image(P.survivalCurve,x+17,y,w-34,(w-34)/2,'contain');y+=(w-34)/2+12;
        this.paragraph(d.ui.survivalHint,x+17,y,w-34,11,18,p.muted,2);y+=48;
      }
    }else if(kind==='review'){
      y+=this.paragraph(d.ui.reviewHelp,x+17,y,w-34,12,19,p.muted)+12;
      this.text(d.ui.yourWords,x+17,y,14,p.green,'bold');y+=27;
      this.box(x+17,y,w-34,84,p.inset,9,p.line);this.paragraph(d.reviewDraft||d.ui.reviewPlaceholder,x+26,y+11,w-52,12,18,d.reviewDraft?p.ink:p.muted,3);this.hit(x+17,y,w-34,84,'input-review',null,'modal-content');y+=91;this.text(Array.from(d.reviewDraft||'').length+' / 300',W-89,y,11,p.muted);y+=24;
      this.button(d.ui.save,x+17,y,w-34,38,'save-review',null,'primary','modal-content');y+=47;
    }else if(kind==='picker'){
      this.picker.options.forEach((item,index)=>{const py=y+index*44;this.text(item.label,x+22,py+10,14,index===this.picker.selected?p.green:p.ink,index===this.picker.selected?'bold':'normal',w-42);this.line(x+17,py+43,w-34);this.hit(x+14,py,w-28,44,'pick',index,'modal-content');});y+=this.picker.options.length*44;
    }
    this.modalContentHeight=y-(top+head)+12;this.modalViewportHeight=h-head-3;
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
    if(!this.keyboardKind)return;
    const event={detail:{value:String(value||'')}};
    if(this.keyboardKind==='review')this.page.onReviewInput(event);else this.page.onReflectionInput(event);
    this.invalidate();
  }
  point(event){
    const t=event.touches?.[0]||event.changedTouches?.[0];if(!t)return null;
    const x=Number.isFinite(t.clientX)?t.clientX:Number.isFinite(t.x)?t.x:t.pageX,y=Number.isFinite(t.clientY)?t.clientY:Number.isFinite(t.y)?t.y:t.pageY;
    return Number.isFinite(x)&&Number.isFinite(y)?{x:x/this.deviceScale,y:y/this.deviceScale}:null;
  }
  clampMusicPosition(pos){
    const minY=this.status+4,maxY=Math.max(minY,this.height-this.safeBottom-54);
    return {x:Math.max(5,Math.min(this.width-55,pos.x)),y:Math.max(minY,Math.min(maxY,pos.y))};
  }
  saveMusicPosition(){
    if(!this.musicPosition)return;
    const position={...this.musicPosition};this.page.store.settings.canvasMusicPosition=position;
    if(this.page.data.settings)this.page.data.settings.canvasMusicPosition=position;
    this.page._musicMoved=Date.now();this.page.persist();
  }
  targetAt(point){if(!point)return null;const list=this.picker||this.page.data.modal?this.modalHits:this.hits;return [...list].reverse().find(item=>point.x>=item.x&&point.x<=item.x+item.w&&point.y>=item.y&&point.y<=item.y+item.h);}
  scrollLimit(kind){return kind==='modal'?Math.max(0,this.modalContentHeight-this.modalViewportHeight):kind==='carousel'?Math.max(0,(this.homeCarousel.count-2)*(this.homeCarousel.cw+11)):Math.max(0,this.contentHeight-(this.viewportBottom-this.navHeight));}
  touchStart(event){
    const point=this.point(event);if(!point)return;this.inertiaToken++;
    const hit=this.targetAt(point),modal=!!(this.picker||this.page.data.modal),onCarousel=!modal&&this.homeCarousel&&this.page.data.view==='home'&&point.y+this.scroll-this.navHeight>=this.homeCarousel.y&&point.y+this.scroll-this.navHeight<=this.homeCarousel.y+this.homeCarousel.h;
    this.touch={...point,hit,scroll:this.scroll,modalScroll:this.modalScroll,homeOffset:this.homeOffset,moved:false,kind:modal?'modal':'page',onCarousel,lastX:point.x,lastY:point.y,lastTime:Date.now(),velocity:0,music:hit?.action==='music',musicStart:this.musicPosition&&{...this.musicPosition}};this.invalidate();
  }
  touchMove(event){
    if(!this.touch)return;const point=this.point(event);if(!point)return;const t=this.touch,dx=point.x-t.x,dy=point.y-t.y,now=Date.now();
    if(Math.abs(dx)>6||Math.abs(dy)>6)t.moved=true;if(!t.moved)return;
    if(t.music&&t.musicStart){this.musicPosition=this.clampMusicPosition({x:t.musicStart.x+dx,y:t.musicStart.y+dy});this.invalidate();return;}
    if(t.onCarousel&&Math.abs(dx)>Math.abs(dy))t.kind='carousel';
    const delta=t.kind==='carousel'?dx:dy,origin=t.kind==='modal'?t.modalScroll:t.kind==='carousel'?t.homeOffset:t.scroll;
    const value=Math.max(0,Math.min(this.scrollLimit(t.kind),origin-delta));
    if(t.kind==='modal')this.modalScroll=value;else if(t.kind==='carousel')this.homeOffset=value;else this.scroll=value;
    const elapsed=Math.max(8,now-t.lastTime),velocity=-((t.kind==='carousel'?point.x-t.lastX:point.y-t.lastY)/elapsed);t.velocity=t.velocity*.35+velocity*.65;t.lastX=point.x;t.lastY=point.y;t.lastTime=now;
    this.invalidate();
  }
  touchEnd(event){
    if(!this.touch)return;const point=this.point({changedTouches:event.changedTouches||event.touches}),start=this.touch;this.touch=null;
    if(start.music&&start.musicStart&&point){const dx=point.x-start.x,dy=point.y-start.y;if(Math.abs(dx)>6||Math.abs(dy)>6){start.moved=true;this.musicPosition=this.clampMusicPosition({x:start.musicStart.x+dx,y:start.musicStart.y+dy});}}
    if(start.music&&start.moved){this.saveMusicPosition();this.invalidate();return;}
    if(start.moved){if(Date.now()-start.lastTime<100)this.startInertia(start.kind,start.velocity);this.invalidate();return;}
    const hit=this.targetAt(point);if(hit&&hit.action===start.hit?.action&&hit.value===start.hit?.value)this.action(hit);this.invalidate();
  }
  touchCancel(){if(this.touch?.music&&this.touch.moved)this.saveMusicPosition();this.touch=null;this.inertiaToken++;this.invalidate();}
  startInertia(kind,velocity){
    if(Math.abs(velocity)<.12)return;let speed=Math.max(-1.7,Math.min(1.7,velocity)),last=Date.now();const token=++this.inertiaToken;
    const request=this.canvas.requestAnimationFrame?.bind(this.canvas)||globalThis.requestAnimationFrame||(fn=>setTimeout(fn,16));
    const step=()=>{if(token!==this.inertiaToken||this.touch)return;const now=Date.now(),dt=Math.min(32,Math.max(8,now-last));last=now;const key=kind==='modal'?'modalScroll':kind==='carousel'?'homeOffset':'scroll',old=this[key],next=Math.max(0,Math.min(this.scrollLimit(kind),old+speed*dt));this[key]=next;speed*=Math.pow(.9,dt/16);this.invalidate();if(Math.abs(speed)>.025&&next!==old)request(step);};request(step);
  }
}

module.exports = CanvasUI;
