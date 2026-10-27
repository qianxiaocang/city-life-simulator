// Double-entry economic bridge: loans and asset purchases are capital exchanges,
// not income or consumption. All amounts use the same CNY-2025 model basis.
export function bookNetWorth(life){const loans=life.loans;const debt=loans?(loans.student?.balance||0)+(loans.mortgage?.balance||0):(life.debt||0);return (life.money||0)+(life.assets?.house||0)+(life.assets?.car||0)+(life.assets?.retirement||0)-debt;}
export function ensureAccounts(life){life.accounts??={version:1,currencyBasis:'CNY-2025-model',openingNetWorth:bookNetWorth(life),flows:{},reconciliationError:0};return life.accounts;}
export function recordFlow(life,kind,value){const a=ensureAccounts(life);a.flows[kind]=(a.flows[kind]||0)+value;reconcile(life);}
export function reconcile(life){const a=ensureAccounts(life);a.expectedNetWorth=a.openingNetWorth+Object.values(a.flows).reduce((s,x)=>s+x,0);a.reconciliationError=bookNetWorth(life)-a.expectedNetWorth;return a.reconciliationError;}
export function noteCashChange(life,previous,current){
  const delta=Math.round(current-previous);
  if(!delta||!Array.isArray(life.log))return;
  life.logSequence??=life.log.length;
  const amount=Math.abs(delta).toLocaleString('zh-CN'),balance=Math.round(current).toLocaleString('zh-CN');
  life.log.unshift({id:`${life.id}-${life.logSequence++}`,age:life.age,year:life.year,type:'money',text:{zhCN:`现金${delta>0?'增加':'减少'} ¥${amount}，结余 ¥${balance}。`,zhTW:`現金${delta>0?'增加':'減少'} ¥${amount}，結餘 ¥${balance}。`,en:`Cash ${delta>0?'increased':'decreased'} by ¥${amount}; balance ¥${balance}.`}});
}
export function transferCash(life,amount,kind='family-transfer'){ensureAccounts(life);const before=life.money;life.money+=amount;recordFlow(life,kind,amount);noteCashChange(life,before,life.money);}
const ASSET_NAMES={house:['房产','房產','home'],car:['车辆','車輛','car'],retirement:['养老金账户','退休金帳戶','retirement account'],furniture:['家具','家具','furniture'],appliances:['家电','家電','appliances'],phone:['通信设备','通訊設備','communication device'],computer:['电脑','電腦','computer'],bicycle:['自行车','自行車','bicycle']};
export function noteAssetChange(life,key,previous,current){
  const delta=Math.round(current-previous);
  if(!delta||!Array.isArray(life.log))return;
  life.logSequence??=life.log.length;
  const [zhCN,zhTW,en]=ASSET_NAMES[key]||[key,key,key];
  const amount=Math.abs(delta).toLocaleString('zh-CN');
  life.log.unshift({id:`${life.id}-${life.logSequence++}`,age:life.age,year:life.year,type:'asset',text:{zhCN:`${zhCN}估值${delta>0?'增加':'减少'} ¥${amount}，现为 ¥${Math.round(current).toLocaleString('zh-CN')}。`,zhTW:`${zhTW}估值${delta>0?'增加':'減少'} ¥${amount}，現為 ¥${Math.round(current).toLocaleString('zh-CN')}。`,en:`${en} value ${delta>0?'rose':'fell'} by ¥${amount} to ¥${Math.round(current).toLocaleString('en')}.`}});
}
export function changeAsset(life,key,value,kind='asset-revaluation'){ensureAccounts(life);const previous=life.assets[key]||0;life.assets[key]=Math.max(0,value);recordFlow(life,kind,life.assets[key]-previous);noteAssetChange(life,key,previous,life.assets[key]);}
