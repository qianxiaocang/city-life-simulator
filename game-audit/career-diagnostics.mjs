import {E,locations,society,load,Meter,drive,save} from './lib/harness.mjs';
const {careerEligibility}=await load('career.js');
const counts={},ever=new Set(),N=Number(process.env.N??5000);let eligibleLives=0,agriManual=0;
const manual=/farmer|livestock|fishery|agricultural|cooperative|mechanic|factory|textile|welder|electrician|plumber|construction|carpenter|machine-technician/;
for(let i=0;i<N;i++){
 const l=E.createLife({locations,seed:'occupations-'+i,world:'past',birthYear:1950+i%36}),m=new Meter();let touched=false;
 drive(l,m,{onStep:l=>{
  if(l.job){ever.add(l.job.id);if(manual.test(l.job.id))touched=true;}
  if(l.pending?.action==='career-offer')for(const job of society.CHINA_JOBS){const reason=careerEligibility(l,job);const key=job.id+'|'+reason;counts[key]=(counts[key]||0)+1;}
 }});eligibleLives++;if(touched)agriManual++;
}
const out={lives:N,everAgricultureManufacturing:{count:agriManual,denominator:eligibleLives,rate:agriManual/eligibleLives},jobsNeverTaken:society.CHINA_JOBS.filter(j=>!ever.has(j.id)).map(j=>j.id),firstFailureReasons:counts};save('career-diagnostics.json',out);console.log(JSON.stringify({...out,firstFailureReasons:'see JSON'},null,2));
