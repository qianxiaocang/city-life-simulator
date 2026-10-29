import { CHINA_JOBS } from './data/china-society.js';

// Game calibration in constant 2025 CNY, not statutory wage limits.
export function boundedSalary(life, salary, job = life.job) {
  const canonical = CHINA_JOBS.find(item => item.id === job?.id);
  if (!canonical) return Math.round(Math.max(0, Number(salary) || 0));
  const scale = Math.max(1000, life.profile?.typicalIncome || 0);
  const ceiling = scale * canonical.multiplier * (canonical.sector === 'self-employed' ? 6 : 1.8);
  return Math.round(Math.min(Math.max(0, Number(salary) || 0), ceiling));
}

export function normalizeIncome(life) {
  if (life.job) {
    life.job.salary = boundedSalary(life, life.job.salary);
    life.income = Math.min(Math.max(0, life.income || 0), Math.round(life.job.salary * 1.08));
  } else if (life.retired) {
    if (life.lastJob) life.lastJob.salary = boundedSalary(life, life.lastJob.salary, life.lastJob);
    const scale = Math.max(1000, life.profile?.typicalIncome || 0);
    const ratio = life.location.region === 'taiwan' ? .65 : .8;
    life.pension = Math.round(Math.min(Math.max(0, life.pension || 0), scale * ratio));
    life.income = life.pension + Math.max(0, life.basicSupport || 0);
  }
}
