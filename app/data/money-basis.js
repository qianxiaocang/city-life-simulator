import {interpolateAnchors} from './development.js';
// modelOnly: transparent illustrative purchasing-power conversion, not an
// official CPI series or a bank contract. Legal nominal limits remain separate.
export const MONEY_BASIS='CNY-2025-model';
export function nominalToModel(amount,year){return amount*interpolateAnchors([[1950,4],[1978,3.2],[1990,2],[2000,1.6],[2010,1.3],[2020,1.05],[2025,1]],Math.min(2025,year));}
export function loanPolicyInModelUnits(policy,year){return {...policy,nominalAnnualCap:policy.annualCap,annualCap:Math.round(nominalToModel(policy.annualCap,year)),currencyBasis:MONEY_BASIS,conversionModelOnly:true};}
