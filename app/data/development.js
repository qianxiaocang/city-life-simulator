// Observed mainland anchors. Interpolation and city adjustments are game models.
export const DEVELOPMENT_SOURCES = [
  {id:'nbs-urban-history',url:'https://www.stats.gov.cn/sj/sjjd/202409/t20240923_1956628.html',title:{zhCN:'国家统计局：新中国75年城市发展',zhTW:'國家統計局：新中國75年城市發展',en:'NBS: 75 years of urban development'}},
  {id:'nbs-life-census',url:'https://www.stats.gov.cn/sj/tjgb/rkpcgb/qgrkpcgb/202302/t20230206_1902000.html',title:{zhCN:'国家统计局：1981—2010人口预期寿命',zhTW:'國家統計局：1981—2010人口預期壽命',en:'NBS: life expectancy, 1981–2010'}},
  {id:'nhc-life-2025',url:'https://www.nhc.gov.cn/wjw/mtbd/202603/5dbc449df3014d939ec74c6aab30c8ae.shtml',title:{zhCN:'国家卫健委：2025年预期寿命79.25岁',zhTW:'國家衛健委：2025年預期壽命79.25歲',en:'NHC: 2025 life expectancy of 79.25'}},
  {id:'nhc-life-2024',url:'https://www.nhc.gov.cn/wjw/mtbd/202503/3bfb889a16c6499dba0e6c0eb2b70887.shtml',title:{zhCN:'国家卫健委：2024年预期寿命79岁',zhTW:'國家衛健委：2024年預期壽命79歲',en:'NHC: 2024 life expectancy of 79'}},
  {id:'nbs-income-history',url:'https://www.stats.gov.cn/zt_18555/ztfx/jnggkf30n/202303/t20230301_1920464.html',title:{zhCN:'国家统计局：改革开放以来城乡居民生活',zhTW:'國家統計局：改革開放以來城鄉居民生活',en:'NBS: household living standards since reform'}},
  {id:'nbs-income-2025',url:'https://www.stats.gov.cn/sj/zxfb/202601/t20260119_1962321.html',title:{zhCN:'国家统计局：2025年居民收入和消费',zhTW:'國家統計局：2025年居民收入和消費',en:'NBS: 2025 household income and expenditure'}},
  {id:'nbs-2025',url:'https://www.stats.gov.cn/sj/zxfb/202602/t20260228_1962662.html',title:{zhCN:'国家统计局：2025年统计公报',zhTW:'國家統計局：2025年統計公報',en:'NBS: 2025 statistical communiqué'}},
];
export const MAINLAND_OBSERVED = {
  // 1949/1957/1978 and modern anchors use the published national series.
  urbanization:[[1949,.1064],[1957,.1539],[1978,.1792],[1995,.2904],[2011,.5183],[2023,.6616],[2024,.67],[2025,.6789]],
  lifeExpectancy:[[1950,43.8],[1954,49],[1957,53],[1959,47],[1960,43.8],[1961,41],[1963,55],[1965,58],[1970,63],[1975,65.5],[1978,67],[1981,67.77],[1990,68.55],[2000,71.40],[2010,74.83],[2020,77.93],[2024,79],[2025,79.25]],
  // modelOnly: expected age at death conditional on surviving to 25.
  // These calibration anchors are not an official conditional life table.
  lifeExpectancyAt25:[[1950,63],[1960,64],[1970,65],[1980,67],[1990,69],[2000,72],[2010,75],[2020,78],[2025,78.6]],
  // Historical income concepts differ. These anchors are displayed as provenance;
  // they are NOT spliced into one falsely comparable annual nominal income series.
  householdIncome:[{year:1978,urban:343.4,rural:133.6,sourceId:'nbs-income-history'},{year:2007,urban:13785.8,rural:4140.4,sourceId:'nbs-income-history'},{year:2025,urban:56502,rural:24456,all:43377,sourceId:'nbs-income-2025'}],
};
// modelOnly: pre-1981 mainland and early regional anchors are the audit's
// historical calibration estimates, not a newly obtained official life table.
export const UNDER5_MORTALITY = {
 mainland:[[1950,.29],[1957,.24],[1960,.26],[1963,.20],[1970,.15],[1980,.081],[1990,.05],[2000,.037],[2010,.016],[2020,.0075],[2025,.006]],
 hongkong:[[1950,.105],[1960,.065],[1970,.033],[1980,.012],[1990,.007],[2000,.004],[2010,.0027],[2025,.002]],
 taiwan:[[1950,.14],[1960,.08],[1970,.047],[1980,.024],[1990,.012],[2000,.008],[2010,.005],[2025,.004]],
 macau:[[1950,.12],[1960,.075],[1970,.04],[1980,.02],[1990,.009],[2000,.005],[2010,.0035],[2025,.0025]],
};
export const REGION_LIFESPAN = {
 hongkong:[[1950,61.8],[1961,67.8],[1971,72.1],[1981,76.6],[1991,78.9],[2001,81.6],[2011,83.9],[2023,85.5],[2025,86]],
 taiwan:[[1950,58],[1961,65.5],[1971,69.7],[1981,73.5],[1991,76],[2001,78.5],[2011,80],[2023,80.6],[2024,80.77],[2025,80.85]],
 macau:[[1950,60],[1961,67],[1971,71.5],[1981,75.5],[1991,78],[2001,80.5],[2011,82.5],[2023,83.6],[2025,83.8]],
};
export function underFiveRate(year,region='mainland'){return interpolateAnchors(UNDER5_MORTALITY[region]||UNDER5_MORTALITY.mainland,Math.min(2025,year));}
// modelOnly: audit scenario coefficients, not GDP-to-wage conversions.
export const REGION_ECONOMY={mainland:{income:1,cost:1},taiwan:{income:3.9,cost:2.6},hongkong:{income:5.8,cost:4.2},macau:{income:7.4,cost:3.8}};
export function mainlandIncomeFactor(location){const p=(location.id||'').slice(3,5);return ['11','12','13','31','32','33','35','37','44','46'].includes(p)?1.26:['14','34','36','41','42','43'].includes(p)?.85:['21','22','23'].includes(p)?.85:.80;}
export function housingTier(location){const id=location.id||'';if(/^cn-(11|31|4401|4403)/.test(id))return 5.5;if(/^cn-(12|50|5101|4201|3301|3201|6101|4301|3701|3702|4101|3502|3501)/.test(id))return 2.6;if(/0000$/.test(id)||location.level==='municipality')return 1.3;return .75;}
const limit=(x,a,b)=>Math.max(a,Math.min(b,x));
export function interpolateAnchors(anchors,year) {
  if(year<=anchors[0][0])return anchors[0][1];
  for(let i=1;i<anchors.length;i++)if(year<=anchors[i][0]){
    const [a,x]=anchors[i-1],[b,y]=anchors[i];return x+(y-x)*(year-a)/(b-a);
  }
  return anchors.at(-1)[1];
}
export function developmentAt(year,location,world='past') {
  const observedYear=Math.min(2025,Math.max(1950,year));
  const isMainland=location.region==='mainland';
  // Historical real purchasing-power scale, a transparent game calibration.
  const incomeIndex=interpolateAnchors([[1950,.075],[1960,.09],[1970,.12],[1978,.16],[1990,.28],[2000,.43],[2010,.66],[2020,.91],[2025,1]],observedYear);
  const educationIndex=interpolateAnchors([[1950,.25],[1965,.34],[1977,.42],[1986,.58],[2000,.77],[2010,.9],[2025,.98]],observedYear);
  const id=location.id||'';
  let cityFactor=1;
  if(isMainland){
    // Growth trajectories for major development zones; magnitudes are modeled.
    if(/^cn-4403/.test(id))cityFactor=year<1980?.46:year<1992?.7:year<2005?.9:1;
    else if(/^cn-(4404|4405|3502)/.test(id))cityFactor=year<1980?.7:year<1992?.88:1;
    else if(/^cn-31/.test(id))cityFactor=year<1990?.87:1;
    else if(/^cn-46/.test(id))cityFactor=year<1988?.72:year<2000?.9:1;
    else if(/^cn-(50|51|52|53|54|61|62|63|64|65)/.test(id))cityFactor=year<2000?.84:year<2012?.94:1;
  }
  let lifespan=interpolateAnchors(isMainland?MAINLAND_OBSERVED.lifeExpectancy:REGION_LIFESPAN[location.region],observedYear);
  const adultLifespan=isMainland
    ? interpolateAnchors(MAINLAND_OBSERVED.lifeExpectancyAt25,observedYear)
    : limit(lifespan+Math.min(12,underFiveRate(observedYear,location.region)*45),63,90);
  const future=year>2026&&world==='future'?Math.min(80,year-2026):0;
  return {
    year,observedThrough:2025,projection:year>2025,
    incomeIndex:incomeIndex*(1+future*.009)*cityFactor,
    educationIndex:limit(educationIndex+future*.001,.2,.995),
    urbanization:isMainland?interpolateAnchors(MAINLAND_OBSERVED.urbanization,observedYear):location.region==='taiwan'?.8:.99,
    lifeExpectancy:limit(lifespan+Math.min(4,future*.04),30,95),
    lifeExpectancyAt25:limit(adultLifespan+Math.min(4,future*.04),45,95),
    historicalEstimate:year<1981||!isMainland,under5Mortality:underFiveRate(year,location.region),
    cityFactor,regionIncomeFactor:REGION_ECONOMY[location.region].income,regionCostFactor:REGION_ECONOMY[location.region].cost,mainlandIncomeFactor:isMainland?mainlandIncomeFactor(location):1,currencyBasis:'CNY-2025-model',sourceIds:isMainland?['nbs-urban-history','nbs-life-census','nhc-life-2025','nbs-2025']:[],
    modelOnly:['incomeIndex','educationIndex','cityFactor','historical interpolation','conditional adult-life calibration','pre-1981 historical lifespan estimates','regional anchor estimates','regional under-five estimates','regional income and cost scenario coefficients','housing tier assumptions','city/sex adjustments','future projection'],
  };
}
