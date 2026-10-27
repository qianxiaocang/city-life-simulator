import {E,locations,load,stats,save} from './lib/harness.mjs';
const {historicalProfile}=await load('history-runtime.js');
const years=[1950,1955,1957,1959,1960,1961,1963,1965,1970,1975,1980,1985,1990,2000,2010,2020,2025,2026];
const ids=['cn-110100','cn-440100','cn-410800','hk-city','tw-taipei','mo-city'];
const out=[];
for(const id of ids){const place=locations.find(x=>x.id===id)||locations.find(x=>x.region===(id.startsWith('hk')?'hongkong':id.startsWith('tw')?'taiwan':'macau'));for(const sex of ['male','female'])for(const year of years){
 const measures=[];for(let i=0;i<60;i++){
  const l=E.createLife({locations,location:place,seed:`controlled-${id}-${i}`,birthYear:year,world:'past'});
  l.sex=sex;l.profile=historicalProfile(place,sex,'past',year);
  measures.push({le:l.profile.lifeExpectancy,u5:l.profile.childMortality,income:l.profile.typicalIncome});
 }
 out.push({id:place.id,sex,year,denominator:60,lifeExpectancy:stats(measures.map(x=>x.le)),under5:stats(measures.map(x=>x.u5)),income:stats(measures.map(x=>x.income))});
}}
save('controlled-probe.json',{method:'fixed sex, fixed location, 60 matched seeds/cell; profile metrics are not realized lifetime mortality',cells:out});
for(const id of ids)console.log(id,JSON.stringify(out.filter(x=>x.id===id&&x.sex==='female').map(x=>({year:x.year,le:x.lifeExpectancy.mean,u5:x.under5.mean,n:x.denominator}))));
