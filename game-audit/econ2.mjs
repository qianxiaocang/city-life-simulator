import {E,locations,Meter,drive,save,stats} from './lib/harness.mjs';
const m=new Meter(),N=Number(process.env.N??3000),rows=[];
for(let i=0;i<N;i++){
 const l=E.createLife({locations,seed:'q'+i,world:'past',birthYear:1990});
 const ratios=[];drive(l,m,{shop:process.env.SHOP==='1',onStep:l=>{if(l.lastCashflow?.takeHomeRatio!==null)ratios.push(l.lastCashflow.takeHomeRatio);}});
 const earnings=l.totals.earned;if(earnings>0)rows.push({netRatio:E.netWorth(l)/earnings,spendRatio:l.totals.spent/earnings,earned:earnings,wealth:E.netWorth(l),takeHome:stats(ratios).p50,error:l.accounts?.reconciliationError});
 m.check('ECONOMIC_RECONCILIATION',Math.abs(l.accounts?.reconciliationError||0)<.01,{seed:l.seed,error:l.accounts?.reconciliationError},!!l.accounts);
}
const out={meta:{lives:N,policy:process.env.SHOP==='1'?'active-housing-purchases':'decisions-and-work-focus; no automatic purchases'},checks:m.report().checks,netWorthOverLifetimeIncome:stats(rows.map(r=>r.netRatio)),cashOutflowsOverLifetimeIncome:stats(rows.map(r=>r.spendRatio)),takeHomeOverGross:stats(rows.map(r=>r.takeHome)),accountingErrors:stats(rows.map(r=>r.error))};
save('economy-results.json',out);console.log(JSON.stringify(out,null,2));
