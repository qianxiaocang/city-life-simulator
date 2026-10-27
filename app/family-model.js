// Demographic calibration scenarios, modelOnly. Distributions describe older
// siblings present at birth, not statutory limits on an individual family.
export function siblingWeights(year,urban,region='mainland'){
 if(region!=='mainland')return year<1975?[.16,.23,.25,.20,.11,.05]:year<2000?[.30,.36,.23,.09,.02]:[.48,.34,.14,.04];
 if(year<=1970)return [.10,.18,.24,.22,.16,.10];
 if(year<=1979)return [.14,.24,.28,.20,.10,.04];
 if(year<=2015)return urban?[.55,.19,.15,.08,.03]:[.42,.25,.14,.10,.06,.03];
 if(year<=2020)return [.30,.36,.23,.09,.02];
 return [.37,.30,.24,.09];
}
export const maternalFirstBirthAge=year=>20+Math.max(0,Math.min(8,(year-1950)/70*8));
export const idealMarriageAge=year=>20+Math.max(0,Math.min(9,(year-1950)/76*9));
export function fecundity(age){return age<18?0:age<20?.55:age<25?1:age<30?.92:age<35?.68:age<40?.30:age<45?.04:age<50?.006:0;}
export function canConceive(life){
 const partner=life.family.partner;
 if(!partner?.alive||!partner.married||!Number.isFinite(partner.sinceYear)||partner.sinceYear>=life.year)return false;
 const age=life.sex==='female'?life.age:partner.age;
 return fecundity(age)>0;
}
