// Historical intake ratios are policy calibration anchors. Intermediate years,
// vocational selection and postgraduate chances are modelOnly, not cutoffs.
// Higher-education entry rates and adult-education scale are 待核／方向性校准
// (S3-B6); these are not verified annual official admission probabilities.
export const ADMISSION_RATES = [[1952,.12,.10],[1965,.09,.07],[1977,.048,.048],[1978,.066,.066],[1980,.078,.078],[1990,.22,.17],[1999,.55,.28],[2010,.69,.35],[2025,.80,.385]];
export function admissionPolicy(year,{vocational=false,region='mainland'}={}){
 if(region!=='mainland')return {total:.85,bachelor:.65,selective:.06,modelOnly:true};
 if(year>=1966&&year<=1969)return {total:0,bachelor:0,selective:0,route:'suspended',modelOnly:false};
 if(year>=1970&&year<=1976)return {total:.025,bachelor:.025,selective:0,route:'recommendation',modelOnly:true};
 let a=ADMISSION_RATES[0];for(let i=1;i<ADMISSION_RATES.length;i++){const b=ADMISSION_RATES[i];if(year<=b[0]){const t=Math.max(0,(year-a[0])/(b[0]-a[0]));a=[year,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];break;}a=b;}
 const factor=vocational?.15:1;
 return {total:a[1]*factor,bachelor:a[2]*factor,selective:year>=1999?.05:year>=1977?.01:.005,modelOnly:true};
}
