import {interpolateAnchors} from './development.js';
// modelOnly: transparent illustrative purchasing-power conversion, not an
// official CPI series or a bank contract. Legal nominal limits remain separate.
// Full 1949–2025 CPI base-index series is 待核／方向性校准 (S3-B4).
export const MONEY_BASIS='CNY-2025-model';
/** Label modeled amounts before they enter player-visible records or choices. */
export function moneyBasisText(life,text){
  if(!text||typeof text!=='object'||life.year>=1990&&life.location?.region==='mainland')return text;
  const historic=life.year<1990;
  const prefix={zhCN:historic?'2025基准模型折算人民币（非当年实付）¥':'模型折合人民币 ¥',zhTW:historic?'2025基準模型折算人民幣（非當年實付）¥':'模型折合人民幣 ¥',en:historic?'2025-reference model estimate, not a historical payment: CNY ':'Modeled CNY equivalent '};
  return Object.fromEntries(['zhCN','zhTW','en'].map(lang=>[lang,String(text[lang]||'').replace(/\bCNY (?!equivalent)/g,lang==='en'?prefix.en:'CNY ').replace(/¥/g,prefix[lang])]));
}
export function nominalToModel(amount,year){return amount*interpolateAnchors([[1950,4],[1978,3.2],[1990,2],[2000,1.6],[2010,1.3],[2020,1.05],[2025,1]],Math.min(2025,year));}
export function loanPolicyInModelUnits(policy,year){return {...policy,nominalAnnualCap:policy.annualCap,annualCap:Math.round(nominalToModel(policy.annualCap,year)),currencyBasis:MONEY_BASIS,conversionModelOnly:true};}
