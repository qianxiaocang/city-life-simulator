/**
 * Build the game's allowed birthplace directory from archived, licensed inputs.
 * No network requests and no third-party runtime dependencies are required.
 * Names/codes are directory facts; weights/prosperity are game parameters.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'research/city-data-sources');
const out = path.join(root, 'app/data');
const read = name => fs.readFileSync(path.join(source, name), 'utf8').replace(/^\uFEFF/, '');

function parseCSV(text) {
  const rows = []; let row = [], field = '', quote = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quote && text[i+1] === '"') {field += '"';i++;} else quote = !quote; }
    else if (!quote && c === ',') {row.push(field);field='';}
    else if (!quote && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(field); if (row.some(Boolean)) rows.push(row);row=[];field='';
    } else field += c;
  }
  if (field || row.length) {row.push(field);rows.push(row);}
  const headers = rows.shift();return rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i] || ''])));
}

function openCCDictionary(name) {
  const map = new Map();
  for (const line of read(name).split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('\t')) continue;
    const [key, values] = line.split('\t');map.set(key, values.split(' ')[0]);
  }
  return map;
}
const chars = openCCDictionary('OpenCC-STCharacters.txt');
const phrases = openCCDictionary('OpenCC-STPhrases.txt');
const maxPhrase = Math.max(...[...phrases.keys()].map(s=>s.length));
function traditional(text) {
  let result='';
  for (let i=0;i<text.length;) {
    let found = false;
    for (let len=Math.min(maxPhrase,text.length-i);len>1;len--) {
      const slice=text.slice(i,i+len);
      if (phrases.has(slice)) {result+=phrases.get(slice);i+=len;found=true;break;}
    }
    if (!found) {result+=chars.get(text[i]) || text[i];i++;}
  }
  return result;
}

const rows = parseCSV(read('ok_data_level3.csv'));
const byId = new Map(rows.map(x=>[x.id,x]));
const provinces = rows.filter(x=>x.deep==='0' && Number(x.id)<70);
const provinceById = new Map(provinces.map(x=>[x.id,x]));
const pinyin = value => {const joined=value.replace(/\s+/g,'');return joined.charAt(0).toUpperCase()+joined.slice(1);};
const provinceEnglish = {
  '11':'Beijing','12':'Tianjin','13':'Hebei','14':'Shanxi','15':'Inner Mongolia',
  '21':'Liaoning','22':'Jilin','23':'Heilongjiang','31':'Shanghai','32':'Jiangsu',
  '33':'Zhejiang','34':'Anhui','35':'Fujian','36':'Jiangxi','37':'Shandong',
  '41':'Henan','42':'Hubei','43':'Hunan','44':'Guangdong','45':'Guangxi',
  '46':'Hainan','50':'Chongqing','51':'Sichuan','52':'Guizhou','53':'Yunnan',
  '54':'Tibet','61':'Shaanxi','62':'Gansu','63':'Qinghai','64':'Ningxia','65':'Xinjiang'
};
const taiwanEnglish = {
  '7101':'Taipei City','7102':'Kaohsiung City','7103':'Tainan City','7104':'Taichung City',
  '7106':'Nantou County','7107':'Keelung City','7108':'Hsinchu City','7109':'Chiayi City',
  '7111':'New Taipei City','7112':'Yilan County','7113':'Hsinchu County','7114':'Taoyuan City',
  '7115':'Miaoli County','7117':'Changhua County','7119':'Chiayi County','7121':'Yunlin County',
  '7124':'Pingtung County','7125':'Taitung County','7126':'Hualien County','7127':'Penghu County'
};
const englishOverrides = {'呼和浩特市':'Hohhot','乌鲁木齐市':'Urumqi','拉萨市':'Lhasa',
  '西安市':"Xi'an",'延安市':"Yan'an",'六安市':"Lu'an",'广安市':"Guang'an",'淮安市':"Huai'an",'泰安市':"Tai'an",'雅安市':"Ya'an",
  '齐齐哈尔市':'Qiqihar','鄂尔多斯市':'Ordos','呼伦贝尔市':'Hulunbuir','巴彦淖尔市':'Bayannur',
  '伊犁哈萨克自治州':'Ili Autonomous Prefecture','博尔塔拉蒙古自治州':'Bortala Autonomous Prefecture','巴音郭楞蒙古自治州':'Bayingolin Autonomous Prefecture',
  '喀什地区':'Kashgar Prefecture','阿里地区':'Ngari Prefecture','日喀则市':'Shigatse',
  '西双版纳傣族自治州':'Xishuangbanna Autonomous Prefecture','锡林郭勒盟':'Xilingol League',
  '阿拉善盟':'Alxa League','阿坝藏族羌族自治州':'Aba Autonomous Prefecture',
  '德宏傣族景颇族自治州':'Dehong Autonomous Prefecture','克孜勒苏柯尔克孜自治州':'Kizilsu Autonomous Prefecture'};
function translatedName(row, region='mainland') {
  const cn=row.ext_name;
  let tw=traditional(cn);
  if(region==='taiwan') tw=tw.replace(/^台(?=[北中南東])/,'臺');
  let en=englishOverrides[cn] || pinyin(row.pinyin);
  if (englishOverrides[cn]) en=englishOverrides[cn];
  else if (region==='taiwan' && taiwanEnglish[row.id]) en=taiwanEnglish[row.id];
  else if (cn.endsWith('自治州')) en+=' Autonomous Prefecture';
  else if (cn.endsWith('地区')) en+=' Prefecture';
  else if (cn.endsWith('盟')) en+=' League';
  else if (region==='taiwan') en+=cn.endsWith('区')?' District':cn.endsWith('市')?' City':' Township';
  return {zhCN:cn,zhTW:tw,en};
}
function hash(id) {let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296;}
const capitalCodes = new Set(['110000','120000','310000','500000','130100','140100','150100','210100','220100','230100','320100','330100','340100','350100','360100','370100','410100','420100','430100','440100','450100','460100','510100','520100','530100','540100','610100','620100','630100','640100','650100']);
const metropolises = new Set(['110000','310000','440100','440300']);
const locations=[];
function add(item) {
  const noise=(hash(item.id)-0.5)*0.1;
  const base=item.region==='mainland' ? (metropolises.has(item.directoryCode)?0.9:capitalCodes.has(item.directoryCode)?0.78:item.level==='county-city'?0.56:0.63)
    : item.region==='taiwan'?0.76:item.region==='hongkong'?0.87:0.85;
  const rawWeight=item.region==='mainland' ? (metropolises.has(item.directoryCode)?12:capitalCodes.has(item.directoryCode)?6:item.level==='county-city'?1:2)
    : item.level==='city'||item.level==='county'?2:1;
  locations.push({...item,population:null,weight:rawWeight,prosperity:+Math.min(.96,Math.max(.42,base+noise)).toFixed(3),dataKind:'administrative-directory+simulation',weightKind:'simulated',prosperityKind:'simulated'});
}
function mainProvince(code) {const p=provinceById.get(code);return{id:`cn-p-${code}`,zhCN:p.ext_name,zhTW:traditional(p.ext_name),en:provinceEnglish[code]};}
const municipalities=new Set(['11','12','31','50']);
for (const p of provinces.filter(x=>municipalities.has(x.id))) {
  const code=`${p.id}0000`;add({id:`cn-${code}`,directoryCode:code,region:'mainland',level:'municipality',name:{zhCN:p.ext_name,zhTW:traditional(p.ext_name),en:provinceEnglish[p.id]},province:mainProvince(p.id),parentId:null,source:'areacity-2026-04'});
}
const prefs=rows.filter(x=>x.deep==='1' && x.id.length===4 && Number(x.id.slice(0,2))<70 && !municipalities.has(x.id.slice(0,2)));
const prefNames=new Set(prefs.map(x=>x.ext_name));
for (const row of prefs) {
  const code=row.ext_id.slice(0,6);
  add({id:`cn-${code}`,directoryCode:code,region:'mainland',level:row.ext_name.endsWith('市')?'prefecture-city':'prefecture',name:translatedName(row),province:mainProvince(row.id.slice(0,2)),parentId:null,source:'areacity-2026-04'});
}
const countyCities=rows.filter(x=>x.deep==='2' && Number(x.id.slice(0,2))<70 && x.ext_name.endsWith('市') && !prefNames.has(x.ext_name));
for(const row of countyCities) {
  const code=row.ext_id.slice(0,6),parent=byId.get(row.pid);
  const parentCode=parent && parent.id.length===4 ? parent.ext_id.slice(0,6):null;
  add({id:`cn-${code}`,directoryCode:code,region:'mainland',level:'county-city',name:translatedName(row),province:mainProvince(row.id.slice(0,2)),parentId:parentCode?`cn-${parentCode}`:null,source:'areacity-2026-04'});
}
// The upstream snapshot predates this officially announced new city.
add({id:'cn-659013',directoryCode:'659013',region:'mainland',level:'county-city',name:{zhCN:'草湖市',zhTW:'草湖市',en:'Caohu'},province:mainProvince('65'),parentId:null,source:'xinjiang-government-2026-04-17'});

for(const county of rows.filter(x=>x.deep==='1' && x.id.startsWith('71'))) {
  const name=translatedName(county,'taiwan'),province={id:`tw-p-${county.id}`,...name};
  add({id:`tw-${county.id}`,directoryCode:county.id,region:'taiwan',level:county.ext_name.endsWith('市')?'city':'county',name,province,parentId:null,source:'areacity-2026-04'});
  for(const town of rows.filter(x=>x.deep==='2' && x.pid===county.id)) {
    add({id:`tw-${town.id}`,directoryCode:town.id,region:'taiwan',level:'township-district',name:translatedName(town,'taiwan'),province,parentId:`tw-${county.id}`,source:'areacity-2026-04'});
  }
}
const offshore=[
  {id:'kinmen',name:{zhCN:'金门县',zhTW:'金門縣',en:'Kinmen County'},towns:[['jincheng','金城镇','金城鎮','Jincheng Township'],['jinsha','金沙镇','金沙鎮','Jinsha Township'],['jinhu','金湖镇','金湖鎮','Jinhu Township'],['jinning','金宁乡','金寧鄉','Jinning Township'],['lieyu','烈屿乡','烈嶼鄉','Lieyu Township'],['wuqiu','乌坵乡','烏坵鄉','Wuqiu Township']]},
  {id:'lienchiang',name:{zhCN:'连江县（马祖）',zhTW:'連江縣（馬祖）',en:'Lienchiang County (Matsu)'},towns:[['nangan','南竿乡','南竿鄉','Nangan Township'],['beigan','北竿乡','北竿鄉','Beigan Township'],['juguang','莒光乡','莒光鄉','Juguang Township'],['dongyin','东引乡','東引鄉','Dongyin Township']]}
];
for(const county of offshore) {
  const province={id:`tw-p-${county.id}`,...county.name};
  add({id:`tw-${county.id}`,directoryCode:null,region:'taiwan',level:'county',name:county.name,province,parentId:null,source:'local-government-directory'});
  for(const [id,zhCN,zhTW,en] of county.towns)add({id:`tw-${county.id}-${id}`,directoryCode:null,region:'taiwan',level:'township-district',name:{zhCN,zhTW,en},province,parentId:`tw-${county.id}`,source:'local-government-directory'});
}

const hkProvince={id:'hk',zhCN:'香港特别行政区',zhTW:'香港特別行政區',en:'Hong Kong SAR'};
add({id:'hk-city',directoryCode:null,region:'hongkong',level:'city',name:{zhCN:'香港',zhTW:'香港',en:'Hong Kong'},province:hkProvince,parentId:null,source:'hongkong-home-affairs'});
const hkDistricts=[['central-western','中西区','中西區','Central and Western'],['wan-chai','湾仔区','灣仔區','Wan Chai'],['eastern','东区','東區','Eastern'],['southern','南区','南區','Southern'],['yau-tsim-mong','油尖旺区','油尖旺區','Yau Tsim Mong'],['sham-shui-po','深水埗区','深水埗區','Sham Shui Po'],['kowloon-city','九龙城区','九龍城區','Kowloon City'],['wong-tai-sin','黄大仙区','黃大仙區','Wong Tai Sin'],['kwun-tong','观塘区','觀塘區','Kwun Tong'],['kwai-tsing','葵青区','葵青區','Kwai Tsing'],['tsuen-wan','荃湾区','荃灣區','Tsuen Wan'],['tuen-mun','屯门区','屯門區','Tuen Mun'],['yuen-long','元朗区','元朗區','Yuen Long'],['north','北区','北區','North'],['tai-po','大埔区','大埔區','Tai Po'],['sha-tin','沙田区','沙田區','Sha Tin'],['sai-kung','西贡区','西貢區','Sai Kung'],['islands','离岛区','離島區','Islands']];
for(const [id,zhCN,zhTW,en] of hkDistricts)add({id:`hk-${id}`,directoryCode:null,region:'hongkong',level:'district',name:{zhCN,zhTW,en:`${en} District`},province:hkProvince,parentId:'hk-city',source:'hongkong-home-affairs'});
const moProvince={id:'mo',zhCN:'澳门特别行政区',zhTW:'澳門特別行政區',en:'Macao SAR'};
add({id:'mo-city',directoryCode:null,region:'macau',level:'city',name:{zhCN:'澳门',zhTW:'澳門',en:'Macao'},province:moProvince,parentId:null,source:'macao-cadastre'});
const moParishes=[['se','大堂区','大堂區','Sé'],['sao-lazaro','望德堂区','望德堂區','São Lázaro'],['sao-lourenco','风顺堂区','風順堂區','São Lourenço'],['fatima','花地玛堂区','花地瑪堂區','Nossa Senhora de Fátima'],['santo-antonio','花王堂区','花王堂區','Santo António'],['carmo','嘉模堂区（氹仔）','嘉模堂區（氹仔）','Nossa Senhora do Carmo (Taipa)'],['sao-francisco-xavier','圣方济各堂区（路环）','聖方濟各堂區（路環）','São Francisco Xavier (Coloane)']];
for(const [id,zhCN,zhTW,en] of moParishes)add({id:`mo-${id}`,directoryCode:null,region:'macau',level:'traditional-parish',name:{zhCN,zhTW,en:`${en} Parish`},province:moProvince,parentId:'mo-city',source:'macao-cadastre'});

// Region totals are an explicitly fictional balance setting, not population/birth statistics.
const regionShares={mainland:.965,taiwan:.025,hongkong:.008,macau:.002};
const rawTotals=Object.fromEntries(Object.keys(regionShares).map(r=>[r,locations.filter(x=>x.region===r).reduce((a,x)=>a+x.weight,0)]));
for(const item of locations)item.weight=+(item.weight/rawTotals[item.region]*regionShares[item.region]*1e6).toFixed(6);
const regionCounts=Object.fromEntries(Object.keys(regionShares).map(r=>[r,locations.filter(x=>x.region===r).length]));
const locationMeta={version:'2026-10-25.1',generatedAt:'2026-10-25',total:locations.length,regionCounts,
  regions:{mainland:{zhCN:'中国大陆',zhTW:'中國大陸',en:'Mainland China'},taiwan:{zhCN:'中国台湾',zhTW:'中國臺灣',en:'Taiwan, China'},hongkong:{zhCN:'中国香港',zhTW:'中國香港',en:'Hong Kong, China'},macau:{zhCN:'中国澳门',zhTW:'中國澳門',en:'Macao, China'}},
  scope:{mainland:{municipalities:4,prefectureDivisions:333,countyCities:398},taiwan:{countiesAndCities:22,townshipsAndDistricts:368},hongkong:{city:1,districts:18},macau:{city:1,traditionalParishes:7}},
  populationKind:'not-provided',weightKind:'simulation-only',prosperityKind:'simulation-only',
  simulatedRegionShares:regionShares,
  notes:{zhCN:'行政区名称为公开目录；出生权重和发展指数为游戏设定，不是真实人口、出生概率或城市排名。大陆目录截至2025年底并补入2026年草湖市，其他后续变更需更新。台湾条目包含22县市及368乡镇市区；香港为城市及18区；澳门堂区为传统地域标签。',
    zhTW:'行政區名稱為公開目錄；出生權重和發展指數為遊戲設定，不是真實人口、出生機率或城市排名。大陸目錄截至2025年底並補入2026年草湖市，其他後續變更需更新。臺灣條目包含22縣市及368鄉鎮市區；香港為城市及18區；澳門堂區為傳統地域標籤。',
    en:'Place names come from public directories. Birth weights and development indices are game settings, not actual populations, birth probabilities or city rankings. The mainland snapshot covers end-2025 and adds Caohu (2026); later changes require updates. Taiwan includes 22 counties/cities and 368 townships/districts. Hong Kong includes its city and 18 districts; Macao parish names are traditional locality labels.'},
  sources:[{id:'areacity-2026-04',url:'https://github.com/xiangyuecn/AreaCity-JsSpider-StatsGov',version:'2025.251231.260403',license:'MIT'},{id:'opencc',url:'https://github.com/BYVoid/OpenCC',license:'Apache-2.0'},{id:'xinjiang-government-2026-04-17',url:'https://www.xinjiang.gov.cn/xinjiang/tzgg/202604/3691350b13064945947d8f78933ccb3e.shtml'},{id:'hongkong-home-affairs',url:'https://www.had.gov.hk/en/18_districts/my_map.htm'},{id:'macao-cadastre',url:'https://cadastre.gis.gov.mo/MGSP_Cad/chn/bak/main_20160628.html'}]};

const ids=new Set();
for(const item of locations) {
  if(ids.has(item.id))throw new Error(`Duplicate location: ${item.id}`);ids.add(item.id);
  if(!Object.hasOwn(regionShares,item.region))throw new Error(`Disallowed region: ${item.region}`);
  for(const field of ['name','province'])for(const lang of ['zhCN','zhTW','en'])if(!item[field][lang])throw new Error(`Missing ${field}.${lang}: ${item.id}`);
  if(!(item.weight>0&&item.prosperity>0&&item.prosperity<=1))throw new Error(`Invalid simulation parameters: ${item.id}`);
}
if(locations.length!==1152 || JSON.stringify(regionCounts)!==JSON.stringify({mainland:735,taiwan:390,hongkong:19,macau:8}))throw new Error(`Unexpected scope: ${JSON.stringify(regionCounts)}`);
for(const item of locations)if(item.parentId&&!ids.has(item.parentId))throw new Error(`Missing parent: ${item.id} → ${item.parentId}`);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'locations.json'),JSON.stringify(locations,null,2)+'\n');
fs.writeFileSync(path.join(out,'location-meta.json'),JSON.stringify(locationMeta,null,2)+'\n');
fs.writeFileSync(path.join(out,'locations.js'),`// Generated by scripts/build-city-data.mjs. See data-sources.md and data/LICENSES.txt.\nexport const locationMeta = ${JSON.stringify(locationMeta)};\nexport const locations = ${JSON.stringify(locations)};\nexport default locations;\n`);
console.log(JSON.stringify({total:locations.length,regionCounts,uniqueIds:ids.size,allNamesPresent:true,allParentsPresent:true}));
