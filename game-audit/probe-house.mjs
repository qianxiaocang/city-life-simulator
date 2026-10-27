import {E,locations,Meter,observe,save} from './lib/harness.mjs';
const N=Number(process.env.N??3000),m=new Meter();let checked=0,owners=0,cars=0;const ratios=[];
for(let i=0;i<N;i++){
 const l=E.createLife({locations,seed:'h'+i,world:'past',birthYear:[1985,1990,1995][i%3]});observe(l,m,'startLife');let guard=0;
 while(l.phase==='life'&&guard++<1000&&l.age<39){
  if(l.pending){observe(l,m,'autoChoose');continue;}
  if(l.job)observe(l,m,'setFocus','work');
  if(l.age>=24&&!l.school){const items=E.getShopItems(l),home=items.find(x=>x.id==='house'),cash=items.find(x=>x.id==='house-cash');if(home?.available)observe(l,m,'purchase','house');else if(cash?.available)observe(l,m,'purchase','house-cash');
   if(l.assets.house&&E.getShopItems(l).find(x=>x.id==='car')?.available)observe(l,m,'purchase','car');
   if(home?.mortgageTerms&&l.job)ratios.push(home.mortgageTerms.annualPayment/l.job.salary);
  }
  observe(l,m,'advanceYear');
 }
 if(l.phase==='life'&&l.age===39){checked++;if(l.assets.house>0)owners++;if(l.assets.car>0)cars++;}
}
const out={policy:'actively buy affordable housing at ages24–38, then car; observations conditional on alive at39; not total population housing ownership',housing:{count:owners,denominator:checked,rate:owners/checked},cars:{count:cars,denominator:checked,rate:cars/checked},checks:m.report().checks};save('housing-results.json',out);console.log(JSON.stringify(out,null,2));
